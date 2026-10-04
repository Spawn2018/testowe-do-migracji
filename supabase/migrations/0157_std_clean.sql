-- =====================================================================
-- TOWER — Migracja 0157: STD-CLEAN (U-17)
--
-- Resztki klasy STANDARD w cenniku i w wymogu zezwolenia.
-- Nie kasuje transportów ani pozycji harmonogramu.
-- Nie wpisuje stawek. Pozycje cennika cargo_class = STANDARD są usuwane
-- (to wiersze cennika, nie transporty). Nowe pozycje STANDARD są odrzucane.
-- rate_match nie dobiera stawki dla ładunku STANDARD (to nie jest zero).
-- load_needs_permit nie zwalnia klasy STANDARD.
-- Import pomijania wierszy TYP = STANDARD zostaje (0136).
-- =====================================================================

delete from rate_rules where cargo_class = 'STANDARD';

drop index if exists rate_rules_one_standard;

alter table rate_rules drop constraint if exists rate_rules_cargo_class_check;
alter table rate_rules add constraint rate_rules_cargo_class_check
  check (cargo_class in ('DIMENSIONED', 'SYMBOL'));

comment on constraint rate_rules_cargo_class_check on rate_rules is
  'STD-CLEAN: DIMENSIONED albo SYMBOL. Klasa STANDARD jest poza Watch Tower.';

create or replace function public.rate_match(p_rate_card uuid, p_load uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c rate_cards%rowtype; l loads%rowtype;
  n_std int; n_dim int; v_class text; v_hits jsonb; v_n int;
  side_pl text;
  n_sym int;
  v_code text; v_family text;
  v_len numeric; v_wid numeric; v_hei numeric; v_wgt numeric;
  v_hei_use numeric;
  v_convoy int; v_convoy_cap int;
  v_rule rate_rules%rowtype;
  v_height_adopted boolean := false;
  v_over_convoy boolean := false;
  v_msg text;
begin
  if (is_hhl()) is not true then
    raise exception 'Dobór stawki z cennika — wyłącznie HHL' using errcode = '42501';
  end if;
  select * into c from rate_cards where id = p_rate_card;
  if not found then raise exception 'Cennik nie istnieje' using errcode = '22023'; end if;
  select * into l from loads where id = p_load;
  if not found then raise exception 'Transport nie istnieje' using errcode = '22023'; end if;
  side_pl := case c.side when 'COST' then 'koszt' else 'przychód' end;

  select count(*) into n_sym from rate_rules r where r.rate_card_id = p_rate_card and r.cargo_class = 'SYMBOL';
  if n_sym > 0 then
    select si.shipment_code into v_code
      from shipment_items si where si.load_id = p_load
     order by si.assembly_seq nulls last, si.shipment_code limit 1;
    v_family := shipment_family(v_code);
    if (v_family is not null) is not true then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
        'reason', 'NO_FAMILY', 'base_rate', null,
        'message', format('Brak rodziny cennika dla numeru wysyłki %s — wycena wstrzymana, to nie jest zero', coalesce(v_code, '∅')));
    end if;

    v_len := l.combo_length_m; v_wid := l.combo_width_m; v_hei := l.combo_height_m; v_wgt := l.combo_weight_t;
    -- Decyzja właściciela: PL-1 / PL-10.1 / PL-17.1 przy 2,60 m → jak 2,45 m (PL-B).
    if v_family = 'PL' and upper(btrim(coalesce(v_code, ''))) in ('PL-1', 'PL-10.1', 'PL-17.1')
       and v_hei is not null and abs(v_hei - 2.60) < 0.001 then
      v_hei := 2.45;
      v_height_adopted := true;
    end if;

    if (v_len is not null and v_wid is not null and v_hei is not null and v_wgt is not null) is not true then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
        'reason', 'NO_DIMENSIONS', 'base_rate', null, 'family', v_family, 'shipment_code', v_code,
        'message', 'Transport bez wymiarów — nie da się dobrać stawki według symbolu');
    end if;

    v_convoy := null; v_convoy_cap := null;
    if v_family = 'KR' then
      v_convoy := kr_convoy_count(p_load);
      if (v_convoy is not null and v_convoy > 0) is not true then
        return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
          'reason', 'NO_CONVOY', 'base_rate', null, 'family', v_family, 'shipment_code', v_code,
          'message', 'Kratownica bez daty załadunku lub bez innych KR — brak konwoju do wyceny');
      end if;
      if v_convoy > 3 then
        v_over_convoy := true;
        v_convoy_cap := 3;
      else
        v_convoy_cap := v_convoy;
      end if;
    end if;

    -- Pełne pokrycie L×W×H×masa
    select * into v_rule
      from rate_rules r
     where r.rate_card_id = p_rate_card and r.cargo_class = 'SYMBOL' and r.family = v_family
       and (v_family is distinct from 'KR' or r.convoy_cars = v_convoy_cap)
       and v_len <= r.length_to and v_wid <= r.width_to and v_hei <= r.height_to and v_wgt <= r.weight_to
     order by r.length_to, r.width_to, r.height_to, r.weight_to, r.symbol
     limit 1;

    if not found then
      -- Wyłącznie wysokość poza limitem → najmniejsza obejmująca L/W/masę
      select * into v_rule
        from rate_rules r
       where r.rate_card_id = p_rate_card and r.cargo_class = 'SYMBOL' and r.family = v_family
         and (v_family is distinct from 'KR' or r.convoy_cars = v_convoy_cap)
         and v_len <= r.length_to and v_wid <= r.width_to and v_wgt <= r.weight_to
         and v_hei > r.height_to
       order by r.length_to, r.width_to, r.height_to, r.weight_to, r.symbol
       limit 1;
      if found then
        v_height_adopted := true;
      end if;
    end if;

    if not found then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
        'reason', 'NO_PRICE', 'base_rate', null, 'family', v_family, 'shipment_code', v_code,
        'convoy', v_convoy,
        'message', format('Brak ceny w cenniku (%s) dla %s — wycena wstrzymana, to nie jest zero', side_pl, coalesce(v_code, v_family)));
    end if;

    v_msg := case when v_height_adopted
      then 'wycena przy wysokości przyjętej z cennika (decyzja właściciela)'
      else null end;
    return jsonb_build_object(
      'matched', true, 'side', c.side, 'cargo_class', 'SYMBOL', 'currency', c.currency,
      'rule_id', v_rule.id, 'base_rate', v_rule.base_rate, 'rate_card_version', c.version,
      'symbol', v_rule.symbol, 'family', v_family, 'shipment_code', v_code,
      'convoy', v_convoy, 'convoy_capped', v_over_convoy,
      'height_adopted', v_height_adopted,
      'message', v_msg
    );
  end if;

  select count(*) filter (where cargo_class = 'STANDARD')
    into n_std from shipment_items where load_id = p_load;
  if n_std > 0 then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'STANDARD',
      'reason', 'NO_STANDARD_RATE', 'base_rate', null,
      'message', format('Klasa STANDARD jest poza Watch Tower (ładunki NTG) — brak stawki (%s), to nie jest zero', side_pl));
  end if;

  v_class := 'DIMENSIONED';
  if (l.combo_length_m is not null and l.combo_width_m is not null and l.combo_height_m is not null and l.combo_weight_t is not null) is not true then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'reason', 'NO_DIMENSIONS', 'base_rate', null,
      'message', 'Transport bez wymiarów — nie da się dobrać stawki');
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
  if v_n > 1 then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', v_class, 'reason', 'AMBIGUOUS', 'base_rate', null,
      'candidates', v_hits, 'message', 'Więcej niż jedna pasująca pozycja cennika — popraw cennik');
  end if;
  return jsonb_build_object('matched', true, 'side', c.side, 'cargo_class', v_class, 'currency', c.currency,
    'rule_id', v_hits->0->'rule_id', 'base_rate', v_hits->0->'base_rate', 'rate_card_version', c.version);
end $$;
revoke all on function public.rate_match(uuid, uuid) from public, anon;
grant execute on function public.rate_match(uuid, uuid) to authenticated;

create or replace function rate_card_save(p_project uuid, p_side text, p_org uuid, p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; v_ver int; v_card uuid; v_kind org_kind; v_rules jsonb; v_r jsonb; v_i int := 0;
  v_valid date; v_note text; v_prev uuid; v_std int := 0; v_sym int := 0; v_dim int := 0; v_bad text;
  v_fam text; v_sym_txt text; v_conv int;
begin
  if (is_hhl()) is not true then
    raise exception 'Cennik zapisuje wyłącznie HHL' using errcode = '42501';
  end if;
  if (p_side in ('COST', 'REVENUE')) is not true then
    raise exception 'Strona cennika: COST (koszt przewoźnika) albo REVENUE (przychód od klienta)' using errcode = '22023';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then
    raise exception 'Projekt nie istnieje' using errcode = '22023';
  end if;
  select kind into v_kind from organizations where id = p_org;
  if (v_kind = case p_side when 'COST' then 'CARRIER'::org_kind else 'CLIENT'::org_kind end) is not true then
    raise exception 'Cennik kosztów dotyczy przewoźnika, cennik przychodów — klienta' using errcode = '22023';
  end if;
  v_valid := (p->>'valid_from')::date;
  if (v_valid is not null) is not true then
    raise exception 'Podaj datę obowiązywania (od)' using errcode = '22023';
  end if;
  v_rules := p->'rules';
  if (jsonb_typeof(v_rules) = 'array' and jsonb_array_length(v_rules) between 1 and 200) is not true then
    raise exception 'Cennik musi mieć od 1 do 200 pozycji' using errcode = '22023';
  end if;
  v_note := nullif(trim(coalesce(p->>'note', '')), '');

  for v_r in select value from jsonb_array_elements(v_rules) loop
    v_i := v_i + 1;
    if (coalesce(v_r->>'cargo_class', 'DIMENSIONED') in ('DIMENSIONED', 'STANDARD', 'SYMBOL')) is not true then
      raise exception 'Pozycja %: nieznana klasa ładunku', v_i using errcode = '22023';
    end if;
    if (jsonb_typeof(v_r->'base_rate') = 'number' and (v_r->>'base_rate')::numeric >= 0
        and (v_r->>'base_rate')::numeric < 10000000000) is not true then
      raise exception 'Pozycja %: stawka musi być liczbą nieujemną', v_i using errcode = '22023';
    end if;
    if coalesce(v_r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then
      raise exception 'Pozycja %: klasa STANDARD jest poza Watch Tower (ładunki NTG), bez stawki', v_i using errcode = '22023';
    elsif coalesce(v_r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then
      v_sym := v_sym + 1;
      v_sym_txt := upper(btrim(coalesce(v_r->>'symbol', '')));
      v_fam := upper(btrim(coalesce(v_r->>'family', '')));
      if (v_sym_txt <> '' and v_fam <> '' and v_fam = shipment_family(v_sym_txt)) is not true then
        raise exception 'Pozycja %: symbol/rodzina niezgodne (oczek. rodzina %)', v_i, coalesce(shipment_family(v_sym_txt), '∅') using errcode = '22023';
      end if;
      if (jsonb_typeof(v_r->'length_to') = 'number' and jsonb_typeof(v_r->'width_to') = 'number'
          and jsonb_typeof(v_r->'height_to') = 'number' and jsonb_typeof(v_r->'weight_to') = 'number'
          and (v_r->>'length_to')::numeric > 0 and (v_r->>'width_to')::numeric > 0
          and (v_r->>'height_to')::numeric > 0 and (v_r->>'weight_to')::numeric > 0) is not true then
        raise exception 'Pozycja %: SYMBOL wymaga max długość/szerokość/wysokość/masa > 0', v_i using errcode = '22023';
      end if;
      if v_fam = 'KR' then
        v_conv := (v_r->>'convoy_cars')::int;
        if (v_conv between 1 and 3) is not true then
          raise exception 'Pozycja %: KR wymaga convoy_cars 1..3', v_i using errcode = '22023';
        end if;
      elsif v_r ? 'convoy_cars' and nullif(v_r->>'convoy_cars', '') is not null then
        raise exception 'Pozycja %: convoy_cars tylko dla rodziny KR', v_i using errcode = '22023';
      end if;
    else
      v_dim := v_dim + 1;
      select string_agg(k, ', ') into v_bad from unnest(array['length', 'width', 'height', 'weight']) k
       where (jsonb_typeof(v_r->(k || '_from')) = 'number' and jsonb_typeof(v_r->(k || '_to')) = 'number'
              and (v_r->>(k || '_from'))::numeric >= 0
              and (v_r->>(k || '_from'))::numeric <= (v_r->>(k || '_to'))::numeric
              and (v_r->>(k || '_to'))::numeric <= 9999) is not true;
      if v_bad is not null then
        raise exception 'Pozycja %: niepoprawny przedział (%) — „od” ≥ 0 i nie większe niż „do”', v_i, v_bad using errcode = '22023';
      end if;
    end if;
  end loop;
  if v_sym > 0 and v_dim > 0 then
    raise exception 'Cennik SYMBOL nie łączy się z przedziałami DIMENSIONED' using errcode = '22023';
  end if;

  if v_dim > 0 then
    select format('%s i %s', a.i, b.i) into v_bad
      from jsonb_array_elements(v_rules) with ordinality a(v, i)
      join jsonb_array_elements(v_rules) with ordinality b(v, i) on a.i < b.i
     where coalesce(a.v->>'cargo_class', 'DIMENSIONED') = 'DIMENSIONED' and coalesce(b.v->>'cargo_class', 'DIMENSIONED') = 'DIMENSIONED'
       and (a.v->>'length_from')::numeric <= (b.v->>'length_to')::numeric and (b.v->>'length_from')::numeric <= (a.v->>'length_to')::numeric
       and (a.v->>'width_from')::numeric  <= (b.v->>'width_to')::numeric  and (b.v->>'width_from')::numeric  <= (a.v->>'width_to')::numeric
       and (a.v->>'height_from')::numeric <= (b.v->>'height_to')::numeric and (b.v->>'height_from')::numeric <= (a.v->>'height_to')::numeric
       and (a.v->>'weight_from')::numeric <= (b.v->>'weight_to')::numeric and (b.v->>'weight_from')::numeric <= (a.v->>'weight_to')::numeric
     limit 1;
    if v_bad is not null then
      raise exception 'Pozycje % nakładają się (granice liczone włącznie) — transport pasowałby do obu', v_bad using errcode = '22023';
    end if;
  end if;

  select id into v_me from app_users where auth_id = auth.uid() and active;
  perform pg_advisory_xact_lock(hashtext('rate_cards:' || p_project::text || ':' || p_side || ':' || p_org::text));
  select coalesce(max(version), 0) + 1 into v_ver from rate_cards
   where project_id = p_project and side = p_side and org_id = p_org;
  if (v_ver = 1 or length(coalesce(v_note, '')) >= 3) is not true then
    raise exception 'Nowa wersja cennika wymaga powodu zmiany (min. 3 znaki)' using errcode = '22023';
  end if;
  select id into v_prev from rate_cards where project_id = p_project and side = p_side and org_id = p_org and version = v_ver - 1;

  insert into rate_cards (project_id, side, org_id, valid_from, version, note, created_by)
  values (p_project, p_side, p_org, v_valid, v_ver, v_note, v_me) returning id into v_card;

  insert into rate_rules (rate_card_id, cargo_class, symbol, family, convoy_cars,
                          length_from, length_to, width_from, width_to,
                          height_from, height_to, weight_from, weight_to, base_rate, note)
  select v_card, coalesce(r->>'cargo_class', 'DIMENSIONED'),
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then upper(btrim(r->>'symbol')) end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then upper(btrim(r->>'family')) end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' and upper(btrim(r->>'family')) = 'KR'
              then (r->>'convoy_cars')::int end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then 0
           else (r->>'length_from')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then (r->>'length_to')::numeric
           else (r->>'length_to')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then 0
           else (r->>'width_from')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then (r->>'width_to')::numeric
           else (r->>'width_to')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then 0
           else (r->>'height_from')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then (r->>'height_to')::numeric
           else (r->>'height_to')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then 0
           else (r->>'weight_from')::numeric
         end,
         case
           when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'SYMBOL' then (r->>'weight_to')::numeric
           else (r->>'weight_to')::numeric
         end,
         (r->>'base_rate')::numeric, nullif(trim(coalesce(r->>'note', '')), '')
    from jsonb_array_elements(v_rules) r;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'RATE_CARD_VERSION', 'rate_cards', p_project::text || ':' || p_side || ':' || p_org::text || ':v' || v_ver,
          case when v_prev is null then null else rate_card_snapshot(v_prev) end,
          rate_card_snapshot(v_card));
  return v_ver;
end $$;

revoke all on function rate_card_save(uuid, text, uuid, jsonb) from public, anon;
grant execute on function rate_card_save(uuid, text, uuid, jsonb) to authenticated;

-- Zezwolenie: klasa STANDARD nie jest wyjątkiem. Przełącznik zostaje.
create or replace function load_needs_permit(p_load uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select true
$$;
revoke all on function load_needs_permit(uuid) from public, anon, authenticated;
comment on function load_needs_permit(uuid) is
  'STD-CLEAN: każdy transport wymaga zezwolenia, gdy przełącznik I-27 jest włączony. Klasa STANDARD nie zwalnia.';

