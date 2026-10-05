-- =====================================================================
-- TOWER — Migracja 0187: BAF GoEasy + średnia z publikacji + ceny 94 transportów
-- (polecenie koordynatora 05.10 ~21:48 + uzupełnienie ~21:51, decyzja przy D-2/D-34)
--
-- 1. SEK = OKQ8 GoEasy Diesel, cena listowa firmowa (kolumna „Diesel” w
--    foretagspriser-RRRR-MM-DD.xlsx, okq8.se/foretag/priser/). NIE Q8 Trucks.
--    Odczyty Q8 Trucks 28.09–05.10 korygowane (append-only: corrects_id) na GoEasy.
--    Brakujące odczyty od 21.09 (SEK GoEasy, PLN Orlen ONEkodiesel) dopisane.
-- 2. fuel_index_readings.published_on — data publikacji ceny. Średnia tygodnia =
--    średnia arytmetyczna z cen OPUBLIKOWANYCH w pełnym poprzednim tygodniu (pn–nd),
--    każda publikacja raz; kopie z dni bez publikacji nie wchodzą. Tydzień bez
--    publikacji → ostatnia opublikowana cena. Zaokrąglenie 2 miejsca, „do X”
--    włącznie, niższy z dwóch — bez zmian.
-- 3. Mnożnik OSTATECZNY tylko po zamknięciu poprzedniego tygodnia (po niedzieli,
--    Europe/Warsaw); wcześniej WSTEPNY. Ostateczny = migawka przy transporcie (0166).
-- 4. Parametry SEFS: wersja obowiązująca w dniu załadunku (valid_from ≤ data),
--    nie ślepo najnowsza. Nowa wersja parametrów z nazwą indeksu SEK zgodną ze źródłem.
-- 5. Dobór stawki z wymiarów ŁADUNKU (shipment_items). Wymiary zestawu (combo_*)
--    tylko do zezwoleń i kontroli trasy (D-83). Koszt i przychód dla wszystkich
--    transportów: baza z cennika + dopłata paliwowa = stawka × (mnożnik − 1).
--    Bez dopłaty na anulowaniu i przestojach (opłaty uzgodnione w extras).
-- Idempotentna.
-- =====================================================================

select set_config('tower.audit_source', 'migracja 0187 (BAF GoEasy + ceny)', true);

-- ---------------------------------------------------------------------
-- 2a. Data publikacji
-- ---------------------------------------------------------------------
alter table fuel_index_readings add column if not exists published_on date;
comment on column fuel_index_readings.published_on is
  'BAF pkt 3: data publikacji ceny u źródła (OKQ8 GoEasy / Orlen). Średnia tygodnia liczy każdą publikację raz.';
create index if not exists fuel_index_readings_pub_idx
  on fuel_index_readings (project_id, index_code, published_on);

-- Backfill published_on dla istniejących wierszy: zmiana wartości względem poprzedniego
-- dnia (ten sam indeks) = nowa publikacja; ta sama wartość = kopia poprzedniej publikacji.
-- Jednorazowo, poza strażnikiem append-only (zmienia tylko nową kolumnę metadanych).
alter table fuel_index_readings disable trigger trg_fuel_readings_immutable;
do $$
declare r record; v_prev_val numeric; v_prev_pub date; v_prev_key text := '';
begin
  for r in
    select id, project_id, index_code, period, value
      from fuel_index_readings
     where corrects_id is null and published_on is null
       and period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     order by project_id, index_code, period
  loop
    if v_prev_key <> r.project_id::text || r.index_code then
      v_prev_val := null; v_prev_pub := null; v_prev_key := r.project_id::text || r.index_code;
    end if;
    if v_prev_val is not null and r.value = v_prev_val then
      update fuel_index_readings set published_on = v_prev_pub where id = r.id;
    else
      update fuel_index_readings set published_on = r.period::date where id = r.id;
      v_prev_pub := r.period::date;
    end if;
    v_prev_val := r.value;
  end loop;
  -- korekty dziedziczą datę publikacji oryginału
  update fuel_index_readings c set published_on = o.published_on
    from fuel_index_readings o
   where c.corrects_id = o.id and c.published_on is null;
end $$;
alter table fuel_index_readings enable trigger trg_fuel_readings_immutable;

-- Nowe odczyty bez podanej daty publikacji: ta sama reguła (trigger BEFORE INSERT).
create or replace function public.fuel_reading_set_published_on() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prev record;
begin
  if new.published_on is not null then return new; end if;
  if new.corrects_id is not null then
    select published_on into new.published_on from fuel_index_readings where id = new.corrects_id;
    return new;
  end if;
  if new.period !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return new; end if;
  select coalesce(c.value, r.value) as value, coalesce(c.published_on, r.published_on) as published_on
    into v_prev
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = new.project_id and r.index_code = new.index_code and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and r.period < new.period
   order by r.period desc limit 1;
  if found and v_prev.value = new.value and v_prev.published_on is not null then
    new.published_on := v_prev.published_on;
  else
    new.published_on := new.period::date;
  end if;
  return new;
end $$;
revoke all on function public.fuel_reading_set_published_on() from public, anon, authenticated;
drop trigger if exists trg_fuel_reading_published_on on fuel_index_readings;
create trigger trg_fuel_reading_published_on before insert on fuel_index_readings
  for each row execute function public.fuel_reading_set_published_on();

-- ---------------------------------------------------------------------
-- 1. Dane produkcyjne STEGRA_BODEN: GoEasy (SEK) + Orlen (PLN) od 21.09
--    Tylko projekt produkcyjny (stałe id), lokalna brama nie dostaje danych.
-- ---------------------------------------------------------------------
do $$
declare
  v_p uuid := 'cbb008cd-4c26-48a8-9743-02878b86ff10';
  d record; v_orig record; v_id bigint;
  c_url_sek constant text := 'https://www.okq8.se/foretag/priser/';
  c_url_pln constant text := 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw';
begin
  if (exists (select 1 from projects where id = v_p)) is not true then return; end if;
  for d in
    select * from (values
      -- SEK: OKQ8 GoEasy Diesel, cena listowa firmowa (foretagspriser-2026-10-05.xlsx, kolumna Diesel)
      ('SEK', '2026-09-21', 23.34, '2026-09-21'), ('SEK', '2026-09-22', 22.54, '2026-09-22'),
      ('SEK', '2026-09-23', 22.54, '2026-09-22'), ('SEK', '2026-09-24', 22.94, '2026-09-24'),
      ('SEK', '2026-09-25', 23.34, '2026-09-25'), ('SEK', '2026-09-26', 23.34, '2026-09-25'),
      ('SEK', '2026-09-27', 23.34, '2026-09-25'), ('SEK', '2026-09-28', 22.74, '2026-09-28'),
      ('SEK', '2026-09-29', 22.54, '2026-09-29'), ('SEK', '2026-09-30', 22.09, '2026-09-30'),
      ('SEK', '2026-10-01', 23.14, '2026-10-01'), ('SEK', '2026-10-02', 23.14, '2026-10-01'),
      ('SEK', '2026-10-03', 23.14, '2026-10-01'), ('SEK', '2026-10-04', 23.14, '2026-10-01'),
      ('SEK', '2026-10-05', 22.29, '2026-10-05'),
      -- PLN: Orlen ONEkodiesel, archiwum cennika hurtowego (ByProduct id 43), PLN/m³ / 1000
      ('PLN', '2026-09-22', 7.440, '2026-09-22'), ('PLN', '2026-09-23', 7.347, '2026-09-23'),
      ('PLN', '2026-09-24', 7.342, '2026-09-24'), ('PLN', '2026-09-25', 7.483, '2026-09-25'),
      ('PLN', '2026-09-26', 7.442, '2026-09-26'), ('PLN', '2026-09-27', 7.442, '2026-09-26'),
      ('PLN', '2026-09-28', 7.442, '2026-09-26')
    ) t(code, period, val, pub)
  loop
    select r.id, coalesce(c.value, r.value) as value, c.id as corr_id
      into v_orig
      from fuel_index_readings r
      left join fuel_index_readings c on c.corrects_id = r.id
     where r.project_id = v_p and r.index_code = d.code and r.period = d.period and r.corrects_id is null
     order by r.id limit 1;
    if not found then
      insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note, published_on)
      values (v_p, d.code, d.period, d.period::date, d.val,
              case d.code when 'SEK' then c_url_sek else c_url_pln end,
              case d.code
                when 'SEK' then format('OKQ8 GoEasy Diesel, cena listowa firmowa %s kr (foretagspriser-2026-10-05.xlsx, publikacja %s)', d.val, d.pub)
                else format('Orlen ONEkodiesel %s PLN/l (archiwum cennika hurtowego, publikacja %s)', d.val, d.pub) end,
              d.pub::date)
      returning id into v_id;
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (null, 'FUEL_READING_ADD', 'fuel_index_readings', v_id::text,
              jsonb_build_object('index_code', d.code, 'period', d.period, 'value', d.val, 'published_on', d.pub, 'source', '0187'));
    elsif v_orig.corr_id is null and d.code = 'SEK' and v_orig.value is distinct from d.val then
      insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note,
                                       corrects_id, correction_reason, published_on)
      values (v_p, 'SEK', d.period, d.period::date, d.val, c_url_sek,
              format('OKQ8 GoEasy Diesel, cena listowa firmowa %s kr (foretagspriser-2026-10-05.xlsx, publikacja %s)', d.val, d.pub),
              v_orig.id,
              'Zmiana produktu na zgodny z umową (zał. 1 pkt 3): GoEasy Diesel firmowa zamiast Q8 Trucks — polecenie 05.10',
              d.pub::date)
      returning id into v_id;
      insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
      values (null, 'FUEL_READING_CORRECT', 'fuel_index_readings', v_id::text,
              jsonb_build_object('id', v_orig.id, 'value', v_orig.value, 'product', 'Q8 Trucks Diesel'),
              jsonb_build_object('value', d.val, 'published_on', d.pub, 'product', 'GoEasy Diesel firmowa'));
    end if;
  end loop;

  -- 4b. Nowa wersja parametrów: nazwa indeksu SEK zgodna ze źródłem (append-only → nowa wersja)
  if (exists (select 1 from sefs_parameters where project_id = v_p and index_sek = 'OKQ8 GoEasy Diesel firmowa')) is not true then
    insert into sefs_parameters (project_id, version, valid_from, rule, base_sek, base_pln, index_sek, index_pln,
                                 source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln,
                                 agreed_with_carrier, agreement_ref, note, created_by, applies_to)
    select project_id, version + 1, valid_from, rule, base_sek, base_pln, 'OKQ8 GoEasy Diesel firmowa', index_pln,
           source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln,
           agreed_with_carrier, agreement_ref,
           'Nazwa indeksu SEK zgodna ze źródłem (zał. 1 pkt 3): GoEasy Diesel, cena listowa firmowa. Tabela bez zmian. 0187',
           created_by, applies_to
      from sefs_parameters where project_id = v_p order by version desc limit 1;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Parametry obowiązujące w dniu
-- ---------------------------------------------------------------------
create or replace function public.sefs_params_for(p_project uuid, p_ref_date date)
returns sefs_parameters
language sql stable security definer set search_path = public as $$
  select sp.* from sefs_parameters sp
   where sp.project_id = p_project
     and (p_ref_date is null or sp.valid_from <= p_ref_date)
   order by sp.valid_from desc, sp.version desc
   limit 1
$$;
revoke all on function public.sefs_params_for(uuid, date) from public, anon, authenticated;

create or replace function public.sefs_compute_hybrid_sys(p_project uuid, p_avg_sek numeric, p_avg_pln numeric, p_ref_date date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p sefs_parameters%rowtype;
  v_sek numeric; v_pln numeric; v_app numeric;
  v_over_sek boolean := false; v_over_pln boolean := false;
  v_max_sek numeric; v_max_pln numeric;
begin
  select * into p from sefs_params_for(p_project, p_ref_date);
  if (p.id is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_SEFS_PARAMS',
      'message', 'Brak parametrów SEFS obowiązujących w tygodniu załadunku — wycena paliwowa wstrzymana');
  end if;
  select max((t->>'lte')::numeric) into v_max_sek from jsonb_array_elements(p.tiers_sek) t;
  select max((t->>'lte')::numeric) into v_max_pln from jsonb_array_elements(p.tiers_pln) t;
  if p_avg_sek is not null and v_max_sek is not null and round(p_avg_sek, 2) > v_max_sek then v_over_sek := true; end if;
  if p_avg_pln is not null and v_max_pln is not null and round(p_avg_pln, 2) > v_max_pln then v_over_pln := true; end if;
  v_sek := sefs_lookup_mult(round(p_avg_sek::numeric, 2), p.tiers_sek);
  v_pln := sefs_lookup_mult(round(p_avg_pln::numeric, 2), p.tiers_pln);
  v_app := least(v_sek, v_pln);
  return jsonb_build_object(
    'ok', true,
    'avg_sek', round(p_avg_sek::numeric, 2),
    'avg_pln', round(p_avg_pln::numeric, 2),
    'mult_sek', v_sek, 'mult_pln', v_pln, 'applied_mult', v_app,
    'over_table_sek', v_over_sek, 'over_table_pln', v_over_pln,
    'params_version', p.version, 'params_valid_from', p.valid_from,
    'index_sek', p.index_sek, 'index_pln', p.index_pln,
    'cycle', p.cycle
  );
end $$;
revoke all on function public.sefs_compute_hybrid_sys(uuid, numeric, numeric, date) from public, anon, authenticated;

create or replace function public.sefs_compute_hybrid_sys(p_project uuid, p_avg_sek numeric, p_avg_pln numeric)
returns jsonb
language sql stable security definer set search_path = public as $$
  select public.sefs_compute_hybrid_sys(p_project, p_avg_sek, p_avg_pln, (timezone('Europe/Warsaw', now()))::date)
$$;
revoke all on function public.sefs_compute_hybrid_sys(uuid, numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2b. Średnia z publikacji tygodnia
-- ---------------------------------------------------------------------
create or replace function public.sefs_pub_avg(p_project uuid, p_code text, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_avg numeric; v_n int; v_pubs jsonb; v_last record;
begin
  with eff as (
    select coalesce(c.value, r.value) as value,
           coalesce(c.published_on, r.published_on) as pub,
           r.period
      from fuel_index_readings r
      left join fuel_index_readings c on c.corrects_id = r.id
     where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
       and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ), pubs as (
    select distinct on (pub) pub, value from eff
     where pub between p_from and p_to
     order by pub, period
  )
  select avg(value), count(*),
         coalesce(jsonb_agg(jsonb_build_object('published_on', pub, 'value', value) order by pub), '[]'::jsonb)
    into v_avg, v_n, v_pubs from pubs;
  if v_n > 0 then
    return jsonb_build_object('avg', v_avg, 'n', v_n, 'pubs', v_pubs, 'fallback_last', false);
  end if;
  -- tydzień bez publikacji (są odczyty, cena bez zmiany) → ostatnia opublikowana cena.
  -- Brak jakichkolwiek odczytów w tygodniu = awaria źródła, bez zgadywania.
  if (exists (select 1 from fuel_index_readings r
               where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
                 and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                 and r.period::date between p_from and p_to)) is not true then
    return jsonb_build_object('avg', null, 'n', 0, 'pubs', '[]'::jsonb, 'fallback_last', false, 'no_readings', true);
  end if;
  select coalesce(c.value, r.value) as value, coalesce(c.published_on, r.published_on) as pub
    into v_last
    from fuel_index_readings r
    left join fuel_index_readings c on c.corrects_id = r.id
   where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
     and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     and coalesce(c.published_on, r.published_on) <= p_to
   order by coalesce(c.published_on, r.published_on) desc, r.period desc
   limit 1;
  if found then
    return jsonb_build_object('avg', v_last.value, 'n', 0,
      'pubs', jsonb_build_array(jsonb_build_object('published_on', v_last.pub, 'value', v_last.value)),
      'fallback_last', true);
  end if;
  return jsonb_build_object('avg', null, 'n', 0, 'pubs', '[]'::jsonb, 'fallback_last', false);
end $$;
revoke all on function public.sefs_pub_avg(uuid, text, date, date) from public, anon, authenticated;

-- Ostatnia opublikowana cena do dnia p_to (szacunek wstępny dla tygodnia jeszcze niezamkniętego).
create or replace function public.sefs_last_published(p_project uuid, p_code text, p_to date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('avg', coalesce(c.value, r.value), 'n', 0,
             'pubs', jsonb_build_array(jsonb_build_object('published_on', coalesce(c.published_on, r.published_on), 'value', coalesce(c.value, r.value))),
             'fallback_last', true)
      from fuel_index_readings r
      left join fuel_index_readings c on c.corrects_id = r.id
     where r.project_id = p_project and r.index_code = p_code and r.corrects_id is null
       and r.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and coalesce(c.published_on, r.published_on) <= p_to
     order by coalesce(c.published_on, r.published_on) desc, r.period desc
     limit 1),
    jsonb_build_object('avg', null, 'n', 0, 'pubs', '[]'::jsonb, 'fallback_last', false))
$$;
revoke all on function public.sefs_last_published(uuid, text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Tydzień: wstępny / ostateczny
-- ---------------------------------------------------------------------
create or replace function public.sefs_week_calc(p_project uuid, p_load_date date, p_today date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_week_start date; v_week_end date; v_prev_start date; v_prev_end date;
  v_today date := coalesce(p_today, (timezone('Europe/Warsaw', now()))::date);
  s jsonb; p jsonb; v_res jsonb; v_final boolean;
begin
  if (p_load_date is not null) is not true then
    return jsonb_build_object('ok', false, 'reason', 'NO_LOAD_DATE');
  end if;
  v_week_start := p_load_date - ((extract(isodow from p_load_date)::int) - 1);
  v_week_end := v_week_start + 6;
  v_prev_start := v_week_start - 7;
  v_prev_end := v_week_start - 1;
  v_final := v_today > v_prev_end;

  s := sefs_pub_avg(p_project, 'SEK', v_prev_start, least(v_prev_end, v_today));
  p := sefs_pub_avg(p_project, 'PLN', v_prev_start, least(v_prev_end, v_today));
  -- tydzień jeszcze niezamknięty (lub przyszły): szacunek wstępny z ostatniej opublikowanej ceny
  if not v_final and (s->>'avg') is null then s := sefs_last_published(p_project, 'SEK', v_today); end if;
  if not v_final and (p->>'avg') is null then p := sefs_last_published(p_project, 'PLN', v_today); end if;

  if ((s->>'avg') is not null and (p->>'avg') is not null) is not true then
    return jsonb_build_object(
      'ok', false, 'reason', 'SOURCE_FAILURE',
      'message', 'Brak opublikowanych cen SEK/PLN dla poprzedniego tygodnia — użyj ostatniego mnożnika + ryzyko HHL',
      'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
      'n_sek', coalesce((s->>'n')::int, 0), 'n_pln', coalesce((p->>'n')::int, 0),
      'status', case when v_final then 'OSTATECZNY' else 'WSTEPNY' end);
  end if;

  v_res := sefs_compute_hybrid_sys(p_project, (s->>'avg')::numeric, (p->>'avg')::numeric, p_load_date);
  return v_res || jsonb_build_object(
    'load_week_start', v_week_start, 'load_week_end', v_week_end,
    'prev_week_start', v_prev_start, 'prev_week_end', v_prev_end,
    'n_sek', (s->>'n')::int, 'n_pln', (p->>'n')::int,
    'pubs_sek', s->'pubs', 'pubs_pln', p->'pubs',
    'fallback_last_sek', (s->>'fallback_last')::boolean,
    'fallback_last_pln', (p->>'fallback_last')::boolean,
    'status', case when v_final then 'OSTATECZNY' else 'WSTEPNY' end,
    'final', v_final,
    'computed_on', v_today
  );
end $$;
revoke all on function public.sefs_week_calc(uuid, date, date) from public, anon, authenticated;

create or replace function public.sefs_week_calc(p_project uuid, p_load_date date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select public.sefs_week_calc(p_project, p_load_date, null::date)
$$;
revoke all on function public.sefs_week_calc(uuid, date) from public, anon, authenticated;
comment on function public.sefs_week_calc(uuid, date) is
  'SEFS (0187): średnia z cen OPUBLIKOWANYCH w pełnym poprzednim tygodniu pn–nd (każda publikacja raz; brak → ostatnia opublikowana). Parametry obowiązujące w dniu załadunku. status WSTEPNY do zamknięcia tygodnia (Europe/Warsaw), potem OSTATECZNY.';

-- l1b: ta sama średnia co wycena
create or replace function public.l1b_sefs_note(p_project uuid, p_load_date date)
returns text
language plpgsql security definer set search_path = public as $l1b$
declare v_res jsonb; v_reason text; v_prev_start date;
begin
  if p_project is null or p_load_date is null then return null; end if;
  v_res := sefs_week_calc(p_project, p_load_date);
  v_prev_start := (p_load_date - ((extract(isodow from p_load_date)::int) - 1)) - 7;
  if coalesce(v_res->>'ok', '') <> 'true' then
    v_reason := 'SOURCE';
  elsif coalesce((v_res->>'over_table_sek')::boolean, false) or coalesce((v_res->>'over_table_pln')::boolean, false) then
    v_reason := 'OVER';
  else
    v_reason := 'OK';
  end if;
  if v_reason in ('SOURCE', 'OVER') then
    perform decision_open_from_event(
      p_project, 'SEFS_OUT_OF_TABLE',
      'l1b:sefs:' || p_project::text || ':' || v_prev_start::text || ':' || v_reason,
      case when v_reason = 'SOURCE' then 'SEFS: brak źródła indeksu' else 'SEFS: indeks poza tabelą progów' end,
      jsonb_build_object('reason', v_reason, 'prev_week_start', v_prev_start, 'load_date', p_load_date),
      null, null);
  end if;
  return v_reason;
end
$l1b$;
revoke all on function public.l1b_sefs_note(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Dobór stawki z wymiarów ŁADUNKU
-- ---------------------------------------------------------------------
create or replace function public.load_cargo_dims(p_load uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shipment_code', si.shipment_code,
    'length_m', si.length_m, 'width_m', si.width_m, 'height_m', si.height_m,
    'weight_t', coalesce(si.total_weight_t, si.unit_weight_t * coalesce(si.qty, 1)))
    from shipment_items si where si.load_id = p_load
   order by si.assembly_seq nulls last, si.shipment_code limit 1
$$;
revoke all on function public.load_cargo_dims(uuid) from public, anon, authenticated;

-- KR: liczba konwoju bez strażnika roli (wycena systemowa: migracja, cron, trigger)
create or replace function public.kr_convoy_count_sys(p_load uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when l.plan_load_date is null then null else (
    select count(distinct l2.id)::int
      from loads l2 join shipment_items si on si.load_id = l2.id
     where l2.project_id = l.project_id and l2.plan_load_date = l.plan_load_date
       and l2.status is distinct from 'CANCELLED' and shipment_family(si.shipment_code) = 'KR') end
    from loads l where l.id = p_load
$$;
revoke all on function public.kr_convoy_count_sys(uuid) from public, anon, authenticated;

create or replace function public.rate_match_sys(p_rate_card uuid, p_load uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c rate_cards%rowtype; l loads%rowtype;
  n_std int; v_hits jsonb; v_n int; side_pl text; n_sym int;
  v_code text; v_family text; v_dims jsonb; v_src text := 'CARGO';
  v_len numeric; v_wid numeric; v_hei numeric; v_wgt numeric;
  v_convoy int; v_convoy_cap int; v_rule rate_rules%rowtype;
  v_height_adopted boolean := false; v_over_convoy boolean := false;
begin
  select * into c from rate_cards where id = p_rate_card;
  if not found then raise exception 'Cennik nie istnieje' using errcode = '22023'; end if;
  select * into l from loads where id = p_load;
  if not found then raise exception 'Transport nie istnieje' using errcode = '22023'; end if;
  side_pl := case c.side when 'COST' then 'koszt' else 'przychód' end;

  -- Wymiary ŁADUNKU (shipment_items). Zestaw (combo_*) tylko gdy transport nie ma pozycji ładunku.
  v_dims := load_cargo_dims(p_load);
  if v_dims is not null then
    v_code := v_dims->>'shipment_code';
    v_len := (v_dims->>'length_m')::numeric; v_wid := (v_dims->>'width_m')::numeric;
    v_hei := (v_dims->>'height_m')::numeric; v_wgt := (v_dims->>'weight_t')::numeric;
  end if;
  if v_dims is null or (v_len is not null and v_wid is not null and v_hei is not null and v_wgt is not null) is not true then
    if l.combo_length_m is not null and l.combo_width_m is not null and l.combo_height_m is not null and l.combo_weight_t is not null then
      v_len := l.combo_length_m; v_wid := l.combo_width_m; v_hei := l.combo_height_m; v_wgt := l.combo_weight_t;
      v_src := 'COMBO_FALLBACK';
    end if;
  end if;

  select count(*) into n_sym from rate_rules r where r.rate_card_id = p_rate_card and r.cargo_class = 'SYMBOL';
  if n_sym > 0 then
    v_family := shipment_family(v_code);
    if (v_family is not null) is not true then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
        'reason', 'NO_FAMILY', 'base_rate', null,
        'message', format('Brak rodziny cennika dla numeru wysyłki %s — wycena wstrzymana, to nie jest zero', coalesce(v_code, '∅')));
    end if;
    -- Decyzja właściciela: PL-1 / PL-10.1 / PL-17.1 przy 2,60 m → jak 2,45 m.
    if v_family = 'PL' and upper(btrim(coalesce(v_code, ''))) in ('PL-1', 'PL-10.1', 'PL-17.1')
       and v_hei is not null and abs(v_hei - 2.60) < 0.001 then
      v_hei := 2.45; v_height_adopted := true;
    end if;
    if (v_len is not null and v_wid is not null and v_hei is not null and v_wgt is not null) is not true then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
        'reason', 'NO_DIMENSIONS', 'base_rate', null, 'family', v_family, 'shipment_code', v_code,
        'message', 'Ładunek bez wymiarów lub masy — nie da się dobrać stawki według symbolu');
    end if;
    if v_family = 'KR' then
      v_convoy := kr_convoy_count_sys(p_load);
      if (v_convoy is not null and v_convoy > 0) is not true then
        return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
          'reason', 'NO_CONVOY', 'base_rate', null, 'family', v_family, 'shipment_code', v_code,
          'message', 'Kratownica bez daty załadunku lub bez innych KR — brak konwoju do wyceny');
      end if;
      if v_convoy > 3 then v_over_convoy := true; v_convoy_cap := 3; else v_convoy_cap := v_convoy; end if;
    end if;
    select * into v_rule from rate_rules r
     where r.rate_card_id = p_rate_card and r.cargo_class = 'SYMBOL' and r.family = v_family
       and (v_family is distinct from 'KR' or r.convoy_cars = v_convoy_cap)
       and v_len <= r.length_to and v_wid <= r.width_to and v_hei <= r.height_to and v_wgt <= r.weight_to
     order by r.length_to, r.width_to, r.height_to, r.weight_to, r.symbol limit 1;
    if not found then
      select * into v_rule from rate_rules r
       where r.rate_card_id = p_rate_card and r.cargo_class = 'SYMBOL' and r.family = v_family
         and (v_family is distinct from 'KR' or r.convoy_cars = v_convoy_cap)
         and v_len <= r.length_to and v_wid <= r.width_to and v_wgt <= r.weight_to and v_hei > r.height_to
       order by r.length_to, r.width_to, r.height_to, r.weight_to, r.symbol limit 1;
      if found then v_height_adopted := true; end if;
    end if;
    if not found then
      return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'SYMBOL',
        'reason', 'NO_PRICE', 'base_rate', null, 'family', v_family, 'shipment_code', v_code, 'convoy', v_convoy,
        'dims', jsonb_build_object('l', v_len, 'w', v_wid, 'h', v_hei, 't', v_wgt), 'dims_source', v_src,
        'message', format('Brak ceny w cenniku (%s) dla %s — wycena wstrzymana, to nie jest zero', side_pl, coalesce(v_code, v_family)));
    end if;
    return jsonb_build_object(
      'matched', true, 'side', c.side, 'cargo_class', 'SYMBOL', 'currency', c.currency,
      'rule_id', v_rule.id, 'base_rate', v_rule.base_rate, 'rate_card_version', c.version,
      'symbol', v_rule.symbol, 'family', v_family, 'shipment_code', v_code,
      'convoy', v_convoy, 'convoy_capped', v_over_convoy, 'height_adopted', v_height_adopted,
      'dims', jsonb_build_object('l', v_len, 'w', v_wid, 'h', v_hei, 't', v_wgt), 'dims_source', v_src,
      'message', case when v_height_adopted then 'wycena przy wysokości przyjętej z cennika (decyzja właściciela)' end);
  end if;

  select count(*) filter (where cargo_class = 'STANDARD') into n_std from shipment_items where load_id = p_load;
  if n_std > 0 then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'STANDARD',
      'reason', 'NO_STANDARD_RATE', 'base_rate', null,
      'message', format('Klasa STANDARD jest poza Watch Tower (ładunki NTG) — brak stawki (%s), to nie jest zero', side_pl));
  end if;
  if (v_len is not null and v_wid is not null and v_hei is not null and v_wgt is not null) is not true then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'reason', 'NO_DIMENSIONS', 'base_rate', null,
      'message', 'Ładunek bez wymiarów — nie da się dobrać stawki');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('rule_id', r.id, 'base_rate', r.base_rate)), '[]'::jsonb), count(*)
    into v_hits, v_n from rate_rules r
   where r.rate_card_id = p_rate_card and r.cargo_class = 'DIMENSIONED'
     and v_len between r.length_from and r.length_to and v_wid between r.width_from and r.width_to
     and v_hei between r.height_from and r.height_to and v_wgt between r.weight_from and r.weight_to;
  if v_n = 0 then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'reason', 'NO_BRACKET', 'base_rate', null,
      'message', format('Brak przedziału w cenniku (%s) dla wymiarów ładunku — wycena wstrzymana, to nie jest zero', side_pl));
  end if;
  if v_n > 1 then
    return jsonb_build_object('matched', false, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'reason', 'AMBIGUOUS', 'base_rate', null,
      'candidates', v_hits, 'message', 'Więcej niż jedna pasująca pozycja cennika — popraw cennik');
  end if;
  return jsonb_build_object('matched', true, 'side', c.side, 'cargo_class', 'DIMENSIONED', 'currency', c.currency,
    'rule_id', v_hits->0->'rule_id', 'base_rate', v_hits->0->'base_rate', 'rate_card_version', c.version, 'dims_source', v_src);
end $$;
revoke all on function public.rate_match_sys(uuid, uuid) from public, anon, authenticated;

create or replace function public.rate_match(p_rate_card uuid, p_load uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then
    raise exception 'Dobór stawki z cennika — wyłącznie HHL' using errcode = '42501';
  end if;
  return rate_match_sys(p_rate_card, p_load);
end $$;
revoke all on function public.rate_match(uuid, uuid) from public, anon;
grant execute on function public.rate_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3+5. Wycena transportu: koszt i przychód, migawka mnożnika
-- ---------------------------------------------------------------------
alter table load_cost add column if not exists fuel_status text;
alter table load_revenue add column if not exists fuel_status text;
alter table load_cost add column if not exists fuel_basis jsonb;
alter table load_revenue add column if not exists fuel_basis jsonb;
alter table load_cost add column if not exists rate_basis jsonb;
alter table load_revenue add column if not exists rate_basis jsonb;
alter table load_cost drop constraint if exists load_cost_fuel_status_check;
alter table load_cost add constraint load_cost_fuel_status_check check (fuel_status is null or fuel_status in ('WSTEPNY', 'OSTATECZNY', 'BRAK'));
alter table load_revenue drop constraint if exists load_revenue_fuel_status_check;
alter table load_revenue add constraint load_revenue_fuel_status_check check (fuel_status is null or fuel_status in ('WSTEPNY', 'OSTATECZNY', 'BRAK'));
comment on column load_cost.fuel_status is 'BAF (0187): WSTEPNY do zamknięcia poprzedniego tygodnia, OSTATECZNY = migawka (nie przeliczana, 0166), BRAK = brak odczytów.';
comment on column load_revenue.fuel_status is 'BAF (0187): WSTEPNY do zamknięcia poprzedniego tygodnia, OSTATECZNY = migawka (nie przeliczana, 0166), BRAK = brak odczytów.';

create or replace function public.load_price_compute(p_load uuid, p_today date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loads%rowtype; v_fuel date; v_w jsonb; v_w_ok boolean; v_side text; v_out jsonb := '{}'::jsonb;
  v_card uuid; m jsonb; x record; v_mult numeric; v_msek numeric; v_mpln numeric; v_status text; v_basis jsonb;
  v_base numeric; v_baf numeric; v_extras numeric; v_total numeric; v_cancel boolean; v_frozen boolean;
begin
  select * into l from loads where id = p_load;
  if not found then return jsonb_build_object('ok', false, 'reason', 'NO_LOAD'); end if;
  v_fuel := fuel_load_date(p_load);
  v_cancel := l.status = 'CANCELLED';
  if v_fuel is not null then
    v_w := sefs_week_calc(l.project_id, v_fuel, p_today);
  else
    -- brak daty załadunku: szacunek WSTEPNY z bieżących publikacji (jak załadunek w przyszłym tygodniu)
    v_w := sefs_week_calc(l.project_id, coalesce(p_today, (timezone('Europe/Warsaw', now()))::date) + 7, p_today);
    if coalesce(v_w->>'ok', '') = 'true' then
      v_w := v_w || jsonb_build_object('status', 'WSTEPNY', 'final', false, 'no_load_date', true);
    end if;
  end if;
  v_w_ok := coalesce(v_w->>'ok', '') = 'true';

  foreach v_side in array array['COST', 'REVENUE'] loop
    if v_side = 'COST' then
      select load_id, invoiced_total_eur, fuel_status, fuel_ref_date, fuel_applied_mult, fuel_mult_sek, fuel_mult_pln,
             fuel_basis, extras_amount into x from load_cost where load_id = p_load;
    else
      select load_id, invoiced_total_eur, fuel_status, fuel_ref_date, fuel_applied_mult, fuel_mult_sek, fuel_mult_pln,
             fuel_basis, extras_amount into x from load_revenue where load_id = p_load;
    end if;
    if found and x.invoiced_total_eur is not null then
      v_out := v_out || jsonb_build_object(lower(v_side), 'INVOICED'); continue;
    end if;

    -- migawka: ostateczny mnożnik tego samego tygodnia załadunku nie jest przeliczany
    v_frozen := x.load_id is not null and x.fuel_status = 'OSTATECZNY' and x.fuel_ref_date is not null and v_fuel is not null
                and date_trunc('week', x.fuel_ref_date) = date_trunc('week', v_fuel);
    if v_frozen then
      v_mult := x.fuel_applied_mult; v_msek := x.fuel_mult_sek; v_mpln := x.fuel_mult_pln;
      v_status := 'OSTATECZNY'; v_basis := x.fuel_basis;
    elsif v_w_ok then
      v_mult := (v_w->>'applied_mult')::numeric; v_msek := (v_w->>'mult_sek')::numeric; v_mpln := (v_w->>'mult_pln')::numeric;
      v_status := v_w->>'status'; v_basis := v_w;
    else
      v_mult := null; v_msek := null; v_mpln := null; v_status := 'BRAK'; v_basis := v_w;
    end if;

    select rc.id into v_card from rate_cards rc
     where rc.project_id = l.project_id and rc.side = v_side
       and rc.valid_from <= coalesce(v_fuel, (timezone('Europe/Warsaw', now()))::date)
       and (rc.valid_until is null or rc.valid_until >= coalesce(v_fuel, (timezone('Europe/Warsaw', now()))::date))
     order by (v_side = 'COST' and rc.org_id = l.carrier_org_id) desc, rc.valid_from desc, rc.version desc
     limit 1;
    m := case when v_card is null then jsonb_build_object('matched', false, 'reason', 'NO_RATE_CARD')
              else rate_match_sys(v_card, p_load) end;

    if coalesce(m->>'matched', '') <> 'true' or (v_mult is null and not v_cancel) then
      -- bez stawki: tylko pola paliwa na istniejącym wierszu (opłaty uzgodnione)
      if x.load_id is not null then
        if v_side = 'COST' then
          update load_cost set fuel_ref_date = v_fuel, fuel_mult_sek = v_msek, fuel_mult_pln = v_mpln,
                 fuel_applied_mult = v_mult, fuel_status = v_status, fuel_basis = v_basis, rate_basis = m
           where load_id = p_load and invoiced_total_eur is null;
        else
          update load_revenue set fuel_ref_date = v_fuel, fuel_mult_sek = v_msek, fuel_mult_pln = v_mpln,
                 fuel_applied_mult = v_mult, fuel_status = v_status, fuel_basis = v_basis, rate_basis = m
           where load_id = p_load and invoiced_total_eur is null;
        end if;
      end if;
      v_out := v_out || jsonb_build_object(lower(v_side), coalesce(case when coalesce(m->>'matched', '') = 'true' then 'NO_FUEL_MULT' end, m->>'reason')); continue;
    end if;

    v_base := case when v_cancel then 0 else (m->>'base_rate')::numeric end;
    v_baf := case when v_cancel then 0 when v_mult is null then null else round(v_base * (v_mult - 1), 2) end;
    v_extras := coalesce(x.extras_amount, 0);
    v_total := case when v_baf is null then null else v_base + v_baf + v_extras end;

    if v_side = 'COST' then
      insert into load_cost (load_id, rate_card_id, currency, base_amount, baf_pct, baf_amount, extras_amount,
                             computed_total_eur, fuel_ref_date, fuel_mult_sek, fuel_mult_pln, fuel_applied_mult,
                             fuel_status, fuel_basis, rate_basis, computed_at)
      values (p_load, v_card, coalesce(m->>'currency', 'EUR'), v_base, case when v_cancel or v_mult is null then 0 else round((v_mult - 1) * 100, 2) end,
              v_baf, v_extras, case when coalesce(m->>'currency', 'EUR') = 'EUR' then v_total end,
              v_fuel, v_msek, v_mpln, v_mult, v_status, v_basis, m, now())
      on conflict (load_id) do update set
        rate_card_id = excluded.rate_card_id, currency = excluded.currency, base_amount = excluded.base_amount,
        baf_pct = excluded.baf_pct, baf_amount = excluded.baf_amount,
        computed_total_eur = excluded.computed_total_eur, fuel_ref_date = excluded.fuel_ref_date,
        fuel_mult_sek = excluded.fuel_mult_sek, fuel_mult_pln = excluded.fuel_mult_pln,
        fuel_applied_mult = excluded.fuel_applied_mult, fuel_status = excluded.fuel_status,
        fuel_basis = excluded.fuel_basis, rate_basis = excluded.rate_basis, computed_at = now()
      where load_cost.invoiced_total_eur is null;
    else
      insert into load_revenue (load_id, rate_card_id, currency, base_amount, baf_pct, baf_amount, extras_amount,
                                computed_total_eur, fuel_ref_date, fuel_mult_sek, fuel_mult_pln, fuel_applied_mult,
                                fuel_status, fuel_basis, rate_basis, computed_at)
      values (p_load, v_card, coalesce(m->>'currency', 'EUR'), v_base, case when v_cancel or v_mult is null then 0 else round((v_mult - 1) * 100, 2) end,
              v_baf, v_extras, case when coalesce(m->>'currency', 'EUR') = 'EUR' then v_total end,
              v_fuel, v_msek, v_mpln, v_mult, v_status, v_basis, m, now())
      on conflict (load_id) do update set
        rate_card_id = excluded.rate_card_id, currency = excluded.currency, base_amount = excluded.base_amount,
        baf_pct = excluded.baf_pct, baf_amount = excluded.baf_amount,
        computed_total_eur = excluded.computed_total_eur, fuel_ref_date = excluded.fuel_ref_date,
        fuel_mult_sek = excluded.fuel_mult_sek, fuel_mult_pln = excluded.fuel_mult_pln,
        fuel_applied_mult = excluded.fuel_applied_mult, fuel_status = excluded.fuel_status,
        fuel_basis = excluded.fuel_basis, rate_basis = excluded.rate_basis, computed_at = now()
      where load_revenue.invoiced_total_eur is null;
    end if;
    v_out := v_out || jsonb_build_object(lower(v_side), jsonb_build_object('base', v_base, 'mult', v_mult, 'baf', v_baf,
                                                   'total', v_total, 'status', v_status));
  end loop;
  return jsonb_build_object('ok', true, 'load_id', p_load, 'fuel_ref_date', v_fuel) || v_out;
end $$;
revoke all on function public.load_price_compute(uuid, date) from public, anon, authenticated;


-- „wstępny” w Cenach: status mnożnika w widokach rolowych (kolumna dopisana na końcu)
create or replace view v_load_price_carrier with (security_invoker = false, security_barrier = true) as
select l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no,
       c.currency, c.pricing_tier,
       c.base_amount, c.baf_pct, c.baf_amount, c.extras, c.extras_amount, c.total_amount,
       c.computed_total_eur, c.invoiced_total_eur,
       money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as effective_total_eur,
       c.fuel_ref_date, c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult,
       c.fx_table_no, c.fx_effective_date, c.fx_rate_pln, c.fx_provisional,
       c.fuel_status
from loads l join load_cost c on c.load_id = l.id
where is_hhl()
   or (current_org_kind() = 'CARRIER'
       and l.carrier_org_id = current_org_id()
       and current_app_role() = 'CARRIER_DISPATCH');

create or replace view v_load_price_client with (security_invoker = false, security_barrier = true) as
select l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no,
       r.currency, r.pricing_tier,
       r.base_amount, r.baf_pct, r.baf_amount, r.extras, r.extras_amount, r.total_amount,
       r.computed_total_eur, r.invoiced_total_eur,
       money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) as effective_total_eur,
       r.fuel_ref_date, r.fuel_mult_sek, r.fuel_mult_pln, r.fuel_applied_mult,
       r.fx_table_no, r.fx_effective_date, r.fx_rate_pln, r.fx_provisional,
       r.fuel_status
from loads l join load_revenue r on r.load_id = l.id
join projects p on p.id = l.project_id
where is_hhl()
   or (current_org_kind() = 'CLIENT' and p.client_org_id = current_org_id());

-- fx_write_fuel (rozładunek / zmiana daty) = ta sama wycena z migawką
create or replace function public.fx_write_fuel(p_load uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform load_price_compute(p_load);
end $$;
revoke all on function public.fx_write_fuel(uuid) from public, anon, authenticated;

create or replace function public.load_price_refresh_all(p_project uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select l.id from loads l where p_project is null or l.project_id = p_project loop
    perform load_price_compute(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.load_price_refresh_all(uuid) from public, anon, authenticated;

-- KR: zmiana jednego transportu zmienia konwój pozostałych KR z tą samą datą załadunku
create or replace function public.load_price_compute_group(p_load uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform load_price_compute(p_load);
  for r in
    select distinct l2.id from loads l
      join loads l2 on l2.project_id = l.project_id and l2.plan_load_date = l.plan_load_date and l2.id <> l.id
      join shipment_items si on si.load_id = l2.id and shipment_family(si.shipment_code) = 'KR'
     where l.id = p_load and l.plan_load_date is not null
       and exists (select 1 from shipment_items s0 where s0.load_id = p_load and shipment_family(s0.shipment_code) = 'KR')
  loop
    perform load_price_compute(r.id);
  end loop;
end $$;
revoke all on function public.load_price_compute_group(uuid) from public, anon, authenticated;

create or replace function public.trg_load_price_on_load() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform load_price_compute_group(new.id);
  exception when others then
    raise warning 'load_price_compute %: %', new.id, sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.trg_load_price_on_load() from public, anon, authenticated;
drop trigger if exists trg_loads_price on loads;
create trigger trg_loads_price
  after update of plan_load_date, actual_load_at, status, carrier_org_id on loads
  for each row execute function public.trg_load_price_on_load();

create or replace function public.trg_load_price_on_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.load_id is not null then
    begin
      perform load_price_compute_group(new.load_id);
    exception when others then
      raise warning 'load_price_compute %: %', new.load_id, sqlerrm;
    end;
  end if;
  return null;
end $$;
revoke all on function public.trg_load_price_on_item() from public, anon, authenticated;
drop trigger if exists trg_shipment_items_price on shipment_items;
create trigger trg_shipment_items_price
  after insert or update of load_id, shipment_code, length_m, width_m, height_m, unit_weight_t, total_weight_t, qty on shipment_items
  for each row execute function public.trg_load_price_on_item();

-- Ingest: data publikacji z automatu (Orlen effective date); bez niej — reguła triggera.
create or replace function public.fuel_se_pl_ingest(p_project uuid, p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v jsonb; v_id bigint; v_ins int := 0; v_skip int := 0;
  v_url text; v_note text; v_code text; v_period text; v_date date; v_val numeric; v_pub date;
begin
  if (fuel_se_pl_enabled()) is not true then
    raise exception 'Pobieranie SE/PL wyłączone (security_flags.FUEL_SE_PL_INGEST)';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then
    raise exception 'Nieznany projekt';
  end if;
  if (jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) between 1 and 20) is not true then
    raise exception 'Odczyty SE/PL: tablica 1–20 pozycji';
  end if;
  for v in select * from jsonb_array_elements(p_rows) loop
    v_code := v->>'index_code';
    if (v_code in ('SEK', 'PLN')) is not true then raise exception 'Kod spoza SEK/PLN: %', v_code; end if;
    v_period := v->>'period';
    if (v_period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') is not true then raise exception 'Okres musi być YYYY-MM-DD: %', v_period; end if;
    v_date := (v->>'reading_date')::date;
    if (v_date <= (timezone('Europe/Warsaw', now()))::date) is not true then raise exception 'Data odczytu nie może być z przyszłości'; end if;
    v_val := (v->>'value')::numeric;
    if (v_val > 0 and v_val < 100) is not true then raise exception 'Wartość poza zakresem (0–100): %', v_val; end if;
    v_url := nullif(trim(v->>'source_url'), '');
    if (v_url is not null and v_url ~ '^https://') is not true then raise exception 'source_url musi być https://'; end if;
    if v_code = 'SEK' and (v_url ~ '^https://www\.okq8\.se/') is not true then raise exception 'SEK: źródło musi być https://www.okq8.se/'; end if;
    if v_code = 'PLN' and (v_url ~ '^https://(www\.)?orlen\.pl/') is not true then raise exception 'PLN: źródło musi być https://www.orlen.pl/'; end if;
    v_pub := case when coalesce(v->>'published_on', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(v->>'published_on', 10)::date end;
    if v_pub is not null and v_pub > v_date then v_pub := v_date; end if;
    v_note := left(coalesce(nullif(trim(v->>'source_note'), ''), 'automat Watch Tower'), 500);
    if exists (select 1 from fuel_index_readings r
                where r.project_id = p_project and r.index_code = v_code and r.period = v_period and r.corrects_id is null) then
      v_skip := v_skip + 1; continue;
    end if;
    insert into fuel_index_readings (project_id, index_code, period, reading_date, value, source_url, source_note, published_on)
    values (p_project, v_code, v_period, v_date, v_val, v_url, v_note, v_pub)
    returning id into v_id;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values (null, 'FUEL_READING_ADD', 'fuel_index_readings', v_id::text, null,
            (select to_jsonb(r) - 'entered_by' from fuel_index_readings r where r.id = v_id));
    v_ins := v_ins + 1;
  end loop;
  return jsonb_build_object('inserted', v_ins, 'skipped', v_skip);
end $$;
revoke all on function public.fuel_se_pl_ingest(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fuel_se_pl_ingest(uuid, jsonb) to service_role;

update security_flags set note =
  'PALIWO-AUTO-B: codzienne pobieranie OKQ8 GoEasy Diesel, cena listowa firmowa (SEK/l wprost) i Orlen ONEkodiesel (PLN/l). Decyzja 05.10 (zał. 1 pkt 3, 0187).'
 where key = 'FUEL_SE_PL_INGEST';

-- Odświeżenie cen co 6 h (wstępny → ostateczny po zamknięciu tygodnia, nowe publikacje)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-load-price-refresh';
    perform cron.schedule('tower-load-price-refresh', '15 */6 * * *', 'select public.load_price_refresh_all()');
  end if;
exception when others then
  raise notice '0187 cron: %', sqlerrm;
end $$;

-- Przeliczenie wszystkich transportów (niezafakturowane strony)
select public.load_price_refresh_all();
