-- =====================================================================
-- TOWER — Migracja 0065: I-19 — formularz cennika HHL (koszt i przychód, wersje, dziennik zmian)
--
--   Do 0064 cennik (rate_cards + rate_rules) dało się zapisać tylko SQL-em. Od 0065:
--     • rate_card_save(p_project, p_side, p_org, p) — RPC wyłącznie dla HHL; każda zmiana cennika
--       = NOWA wersja (project, side, org) z kompletem pozycji (przedziały wymiarów i najwyżej jedna
--       pozycja STANDARD); poprzednie wersje zostają bez zmian;
--     • rate_cards i rate_rules są tylko do dopisywania (UPDATE/DELETE zablokowane wyzwalaczem;
--       wyjątek: sprzątanie testów przez właściciela bazy z ustawieniem tower.rate_purge = on);
--     • dziennik zmian w audit_log (RATE_CARD_VERSION: stara i nowa wersja z pozycjami, powód)
--       + rate_card_change_log() dla HHL;
--     • odczyt tabel: tylko HHL (RLS + SELECT dla authenticated; KSH i przewoźnik nie widzą nic).
--   Walidacja: strona COST → organizacja przewoźnika (CARRIER), REVENUE → klient (CLIENT);
--   od wersji 2 powód zmiany jest wymagany; przedziały DIMENSIONED nie mogą się nakładać
--   (rate_match liczy granice włącznie — nakładanie = AMBIGUOUS). Migracja NIE wpisuje kwot (D-1).
--   Idempotentna i niedestrukcyjna.
-- =====================================================================

alter table rate_cards add column if not exists note text;
alter table rate_cards add column if not exists created_by uuid references app_users(id);
alter table rate_cards add column if not exists created_at timestamptz not null default now();
create unique index if not exists rate_cards_version_uq on rate_cards (project_id, side, org_id, version);

create or replace function forbid_rate_mutation() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('tower.rate_purge', true), '') = 'on' then
    return old;
  end if;
  raise exception '% jest tylko do dopisywania — zmiana cennika = nowa wersja', tg_table_name;
end $$;
revoke execute on function forbid_rate_mutation() from public, anon, authenticated;
drop trigger if exists trg_rate_cards_immutable on rate_cards;
create trigger trg_rate_cards_immutable before update or delete on rate_cards
  for each row execute function forbid_rate_mutation();
drop trigger if exists trg_rate_rules_immutable on rate_rules;
create trigger trg_rate_rules_immutable before update or delete on rate_rules
  for each row execute function forbid_rate_mutation();

alter table rate_cards enable row level security;
alter table rate_rules enable row level security;
revoke all on rate_cards, rate_rules from anon;
revoke insert, update, delete, truncate on rate_cards, rate_rules from authenticated;
grant select on rate_cards, rate_rules to authenticated;
drop policy if exists rate_cards_read on rate_cards;
create policy rate_cards_read on rate_cards for select to authenticated using (is_hhl());
drop policy if exists rate_rules_read on rate_rules;
create policy rate_rules_read on rate_rules for select to authenticated using (is_hhl());

create or replace function rate_card_save(p_project uuid, p_side text, p_org uuid, p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid; v_ver int; v_card uuid; v_kind org_kind; v_rules jsonb; v_r jsonb; v_i int := 0;
  v_valid date; v_note text; v_prev uuid; v_std int := 0; v_bad text;
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

  -- walidacja pozycji
  for v_r in select value from jsonb_array_elements(v_rules) loop
    v_i := v_i + 1;
    if (coalesce(v_r->>'cargo_class', 'DIMENSIONED') in ('DIMENSIONED', 'STANDARD')) is not true then
      raise exception 'Pozycja %: nieznana klasa ładunku', v_i using errcode = '22023';
    end if;
    if (jsonb_typeof(v_r->'base_rate') = 'number' and (v_r->>'base_rate')::numeric >= 0
        and (v_r->>'base_rate')::numeric < 10000000000) is not true then
      raise exception 'Pozycja %: stawka musi być liczbą nieujemną', v_i using errcode = '22023';
    end if;
    if coalesce(v_r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then
      v_std := v_std + 1;
    else
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
  if v_std > 1 then
    raise exception 'Najwyżej jedna pozycja STANDARD w cenniku' using errcode = '22023';
  end if;
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
  insert into rate_rules (rate_card_id, cargo_class, length_from, length_to, width_from, width_to,
                          height_from, height_to, weight_from, weight_to, base_rate, note)
  select v_card, coalesce(r->>'cargo_class', 'DIMENSIONED'),
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 0 else (r->>'length_from')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 9999 else (r->>'length_to')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 0 else (r->>'width_from')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 9999 else (r->>'width_to')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 0 else (r->>'height_from')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 9999 else (r->>'height_to')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 0 else (r->>'weight_from')::numeric end,
         case when coalesce(r->>'cargo_class', 'DIMENSIONED') = 'STANDARD' then 9999 else (r->>'weight_to')::numeric end,
         (r->>'base_rate')::numeric, nullif(trim(coalesce(r->>'note', '')), '')
    from jsonb_array_elements(v_rules) r;

  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'RATE_CARD_VERSION', 'rate_cards', p_project::text || ':' || p_side || ':' || p_org::text || ':v' || v_ver,
          case when v_prev is null then null else rate_card_snapshot(v_prev) end,
          rate_card_snapshot(v_card));
  return v_ver;
end $$;

create or replace function rate_card_snapshot(p_card uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(c) - 'id' - 'created_at' - 'created_by' - 'baf_id' - 'project_id'
         || jsonb_build_object('rules', coalesce((
              select jsonb_agg(to_jsonb(r) - 'id' - 'rate_card_id' order by r.cargo_class desc, r.length_from, r.width_from, r.height_from, r.weight_from)
                from rate_rules r where r.rate_card_id = c.id), '[]'::jsonb))
    from rate_cards c where c.id = p_card
$$;
revoke execute on function rate_card_snapshot(uuid) from public, anon, authenticated;

create or replace function rate_card_change_log(p_project uuid, p_limit int default 100)
returns table (at timestamptz, actor text, entity_id text, old_value jsonb, new_value jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then
    raise exception 'Dziennik zmian cennika widzi wyłącznie HHL' using errcode = '42501';
  end if;
  return query
    select a.created_at, coalesce(u.email::text, 'system'), a.entity_id, a.old_value, a.new_value
      from audit_log a left join app_users u on u.id = a.user_id
     where a.action = 'RATE_CARD_VERSION' and a.entity_id like p_project::text || ':%'
     order by a.created_at desc, a.id desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

revoke all on function rate_card_save(uuid, text, uuid, jsonb) from public, anon;
grant execute on function rate_card_save(uuid, text, uuid, jsonb) to authenticated;
revoke all on function rate_card_change_log(uuid, int) from public, anon;
grant execute on function rate_card_change_log(uuid, int) to authenticated;
