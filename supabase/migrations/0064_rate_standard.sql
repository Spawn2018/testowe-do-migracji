-- 0064 — I-12 (D-8 wariant A, właściciel 27.09.2026): pozycja STANDARD w cenniku.
--   rate_rules.cargo_class: DIMENSIONED (domyślnie, przedziały wymiarów) | STANDARD (stała stawka, wymiary bez znaczenia).
--   Najwyżej jedna pozycja STANDARD na cennik (rate_cards: strona COST albo REVENUE — koszt i przychód osobno).
--   rate_match(p_rate_card, p_load) — dobór pozycji dla transportu (HHL):
--     wszystkie pozycje transportu STANDARD → pozycja STANDARD; brak → matched=false, NO_STANDARD_RATE (ostrzeżenie, base_rate NULL — nie zero);
--     transport wymiarowy → przedział wymiarów (bez pozycji STANDARD): NO_BRACKET / AMBIGUOUS / NO_DIMENSIONS;
--     mieszany STANDARD + wymiarowy → MIXED_CARGO (stawkę ustala HHL).
--   Paliwo (SEFS) i kurs NBP — ten sam mechanizm co dla stawki drogowej (bez zmian). Migracja NIE wstawia kwot (D-1).
-- Idempotentna, niedestrukcyjna.

alter table rate_rules add column if not exists cargo_class text not null default 'DIMENSIONED';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rate_rules_cargo_class_check') then
    alter table rate_rules add constraint rate_rules_cargo_class_check check (cargo_class in ('DIMENSIONED', 'STANDARD'));
  end if;
end $$;
create unique index if not exists rate_rules_one_standard on rate_rules (rate_card_id) where cargo_class = 'STANDARD';

create or replace function public.rate_match(p_rate_card uuid, p_load uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c rate_cards%rowtype; l loads%rowtype;
  n_std int; n_dim int; v_class text; v_hits jsonb; v_n int;
  side_pl text;
begin
  if (is_hhl()) is not true then
    raise exception 'Dobór stawki z cennika — wyłącznie HHL' using errcode = '42501';
  end if;
  select * into c from rate_cards where id = p_rate_card;
  if not found then raise exception 'Cennik nie istnieje' using errcode = '22023'; end if;
  select * into l from loads where id = p_load;
  if not found then raise exception 'Transport nie istnieje' using errcode = '22023'; end if;
  side_pl := case c.side when 'COST' then 'koszt' else 'przychód' end;
  select count(*) filter (where cargo_class = 'STANDARD'), count(*) filter (where cargo_class is distinct from 'STANDARD')
    into n_std, n_dim from shipment_items where load_id = p_load;
  v_class := case when n_std > 0 and n_dim = 0 then 'STANDARD' when n_std > 0 then 'MIXED' else 'DIMENSIONED' end;

  if v_class = 'MIXED' then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'MIXED', 'reason', 'MIXED_CARGO', 'base_rate', null,
      'message', format('Transport łączy ładunek STANDARD i wymiarowy — stawkę (%s) ustala HHL', side_pl));
  end if;

  if v_class = 'STANDARD' then
    select coalesce(jsonb_agg(jsonb_build_object('rule_id', r.id, 'base_rate', r.base_rate)), '[]'::jsonb), count(*)
      into v_hits, v_n from rate_rules r where r.rate_card_id = p_rate_card and r.cargo_class = 'STANDARD';
    if v_n = 0 then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'STANDARD', 'reason', 'NO_STANDARD_RATE', 'base_rate', null,
        'message', format('Brak stawki STANDARD w cenniku (%s) — wycena wstrzymana, to nie jest zero. Uzupełnij cennik (D-1)', side_pl));
    end if;
  else
    if (l.combo_length_m is not null and l.combo_width_m is not null and l.combo_height_m is not null and l.combo_weight_t is not null) is not true then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'reason', 'NO_DIMENSIONS', 'base_rate', null,
        'message', 'Transport bez wymiarów i nie jest ładunkiem STANDARD — nie da się dobrać stawki');
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('rule_id', r.id, 'base_rate', r.base_rate)), '[]'::jsonb), count(*)
      into v_hits, v_n from rate_rules r
     where r.rate_card_id = p_rate_card and r.cargo_class = 'DIMENSIONED'
       and l.combo_length_m between r.length_from and r.length_to and l.combo_width_m between r.width_from and r.width_to
       and l.combo_height_m between r.height_from and r.height_to and l.combo_weight_t between r.weight_from and r.weight_to;
    if v_n = 0 then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'reason', 'NO_BRACKET', 'base_rate', null,
        'message', format('Brak przedziału w cenniku (%s) dla wymiarów transportu — wycena wstrzymana, to nie jest zero', side_pl));
    end if;
  end if;
  if v_n > 1 then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', v_class, 'reason', 'AMBIGUOUS', 'base_rate', null,
      'candidates', v_hits, 'message', 'Więcej niż jedna pasująca pozycja cennika — popraw cennik');
  end if;
  return jsonb_build_object('matched', true, 'side', c.side, 'cargo_class', v_class, 'currency', c.currency,
    'rule_id', v_hits->0->'rule_id', 'base_rate', v_hits->0->'base_rate', 'rate_card_version', c.version);
end $$;
revoke all on function public.rate_match(uuid, uuid) from public, anon;
grant execute on function public.rate_match(uuid, uuid) to authenticated;
