-- TOWER — 0207: A1 (D-20261015-0300-01) — cena Orlen ONEkodiesel 06.10.2026 + przeliczenie opłaty t42.
-- Artefakt E3: publikacja 06.10, 6 919 PLN/m³ (6,919 PLN/l). Bez niej sefs_week_calc(14.10) ma 4 PLN → ×1,13.
-- Dane jednorazowe: kopia w R2 / D:\Watch Tower\dane\audyt-A przed nałożeniem na produkcję.

do $$
declare
  v_p uuid := 'cbb008cd-4c26-48a8-9743-02878b86ff10';
  c_url constant text := 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw';
  v_id bigint;
  v_n int := 0;
  v_w jsonb;
  r record;
begin
  if (exists (select 1 from projects where id = v_p)) is not true then
    raise notice '0207: brak projektu Stegra — pomijam';
    return;
  end if;

  -- Idempotencja: publikacja 06.10 już jest (nieskorygowana) → nie dokładaj drugiej.
  -- Alias fr (nie r) — unikamy kolizji z zmienną rekordu pętli poniżej.
  if exists (
    select 1 from fuel_index_readings fr
     where fr.project_id = v_p and fr.index_code = 'PLN' and fr.published_on = date '2026-10-06'
       and fr.corrects_id is null
       and not exists (select 1 from fuel_index_readings c where c.corrects_id = fr.id)
  ) then
    raise notice '0207: publikacja PLN 2026-10-06 już jest';
  else
    insert into fuel_index_readings (
      project_id, index_code, period, reading_date, value, source_url, source_note, published_on
    ) values (
      v_p, 'PLN', '2026-10-06', date '2026-10-06', 6.919,
      c_url,
      'Orlen ONEkodiesel 6.919 PLN/l (6919 PLN/m3; archiwum cennika hurtowego, publikacja 2026-10-06; A1 D-20261015-0300-01)',
      date '2026-10-06'
    ) returning id into v_id;
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (
      null, 'FUEL_READING_ADD', 'fuel_index_readings', v_id::text,
      jsonb_build_object(
        'index_code', 'PLN', 'period', '2026-10-06', 'value', 6.919,
        'published_on', '2026-10-06', 'source', '0207_audyt_a1'
      )
    );
  end if;

  v_w := public.sefs_week_calc(v_p, date '2026-10-14');
  if coalesce(v_w->>'ok', '') = 'true' then
    if (v_w->>'n_pln')::int < 5 then
      raise exception '0207: po wstawieniu oczekiwano n_pln>=5, jest %', v_w->>'n_pln';
    end if;
    if (v_w->>'applied_mult')::numeric is distinct from 1.12 then
      raise exception '0207: oczekiwano applied_mult=1.12, jest %', v_w->>'applied_mult';
    end if;
  end if;

  -- Przeliczenie COST+REVENUE transportów z załadunkiem 12–18.10 (zdejmij freeze OSTATECZNY).
  for r in
    select l.id
      from loads l
     where l.project_id = v_p
       and public.fuel_load_date(l.id) between date '2026-10-12' and date '2026-10-18'
  loop
    update load_cost
       set fuel_status = 'PROGNOZA'
     where load_id = r.id
       and fuel_status = 'OSTATECZNY'
       and invoiced_total_eur is null;
    update load_revenue
       set fuel_status = 'PROGNOZA'
     where load_id = r.id
       and fuel_status = 'OSTATECZNY'
       and invoiced_total_eur is null;
    perform public.load_price_compute(r.id);
    v_n := v_n + 1;
  end loop;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null, 'FUEL_RECALC_WEEK', 'loads', 't42-2026-10-12..18',
    jsonb_build_object('loads', v_n, 'source', '0207_audyt_a1', 'target_mult', 1.12)
  );
end $$;
