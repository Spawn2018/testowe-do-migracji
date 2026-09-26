-- =====================================================================
-- 0012 — M5: numery zleceń (W12) — brak numeru przed terminem → ryzyko + przypomnienie.
-- Idempotentna, niedestrukcyjna. Wymuszenie przejść statusu: 0003 enforce_order_numbers,
-- „każda strona swój numer”: 0008 guard_load_update — bez zmian.
--   HHL: numer obowiązkowy przed READY; przewoźnik: przed AT_LOADING (MECHANIZM_PIENIEDZY §8).
--   Termin = planowy załadunek; alarm od 48 h przed nim (parametr p_lead_h).
-- Przy okazji: notifications bez RLS od 0001 — włączone, odczyt wyłącznie własnych wierszy.
-- =====================================================================

-- 1. Powiadomienia: RLS (przypomnienia są adresowane do konkretnych użytkowników)
alter table notifications enable row level security;
drop policy if exists notifications_read_own on notifications;
create policy notifications_read_own on notifications for select to authenticated
  using (user_id = current_app_user_id());
revoke insert, update, delete, truncate on notifications from anon, authenticated;
revoke all on notifications from anon;
grant select on notifications to authenticated;

-- 2. Wykrywanie braków (cron co godzinę; zwraca liczbę nowych ryzyk)
create or replace function detect_missing_order_numbers(p_now timestamptz default now(), p_lead_h int default 48)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record; v_new int := 0; v_due timestamptz; v_key text; v_rows int;
begin
  for r in
    select l.id, l.project_id, l.carrier_org_id, l.status, l.hhl_order_no, l.carrier_order_no,
           coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           coalesce(si.shipment_code, l.order_no, left(l.id::text, 8)) as code
      from loads l
      left join lateral (select shipment_code from shipment_items where load_id = l.id order by assembly_seq nulls last limit 1) si on true
     where l.status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) <= p_now + make_interval(hours => p_lead_h)
  loop
    v_due := r.due;
    -- HHL: przed READY
    if r.status <> 'READY' and (r.hhl_order_no is null or btrim(r.hhl_order_no) = '') then
      v_key := 'ORDERNO:HHL:' || r.id;
      insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', case when v_due <= p_now then 'CRITICAL' else 'HIGH' end::risk_severity,
              r.code || ': brak numeru zlecenia HHL',
              jsonb_build_object('rule', 'ORDER_NO', 'side', 'HHL', 'owner', 'HHL', 'due', v_due,
                'text', 'Numer zlecenia HHL jest obowiązkowy przed statusem GOTOWY (W12).',
                'meta', 'Odpowiada: HHL', 'next_action', 'Wpisz numer zlecenia HHL w szufladzie transportu'),
              v_key)
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
      get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      if v_rows > 0 then
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'ORDER_NO_MISSING',
               jsonb_build_object('side', 'HHL', 'code', r.code, 'due', v_due, 'locale', u.locale),
               v_key || ':' || u.id || ':' || to_char(v_due, 'YYYYMMDD')
          from app_users u join organizations o on o.id = u.org_id
         where o.kind = 'FORWARDER' and u.active
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
    -- przewoźnik: przed AT_LOADING
    if r.carrier_org_id is not null and (r.carrier_order_no is null or btrim(r.carrier_order_no) = '') then
      v_key := 'ORDERNO:CARRIER:' || r.id;
      insert into risk_signals (project_id, load_id, kind, severity, title, detail, dedup_key)
      values (r.project_id, r.id, 'RESOURCE_MISSING', case when v_due <= p_now then 'CRITICAL' else 'HIGH' end::risk_severity,
              r.code || ': brak numeru zlecenia przewoźnika',
              jsonb_build_object('rule', 'ORDER_NO', 'side', 'CARRIER', 'owner', 'SCX', 'due', v_due,
                'text', 'Numer zlecenia przewoźnika jest obowiązkowy przed załadunkiem (W12).',
                'meta', 'Odpowiada: przewoźnik', 'next_action', 'Wpisz numer zlecenia przewoźnika w szufladzie transportu'),
              v_key)
      on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
      get diagnostics v_rows = row_count; v_new := v_new + v_rows;
      if v_rows > 0 then
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'ORDER_NO_MISSING',
               jsonb_build_object('side', 'CARRIER', 'code', r.code, 'due', v_due, 'locale', u.locale),
               v_key || ':' || u.id || ':' || to_char(v_due, 'YYYYMMDD')
          from app_users u
         where u.org_id = r.carrier_org_id and u.active
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
  end loop;
  return v_new;
end $$;

-- 3. Uzupełnienie numeru zamyka ryzyko
create or replace function trg_order_no_resolve() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.hhl_order_no is not null and btrim(new.hhl_order_no) <> '' and new.hhl_order_no is distinct from old.hhl_order_no then
    update risk_signals set resolved_at = now(), resolved_by = current_app_user_id()
     where dedup_key = 'ORDERNO:HHL:' || new.id and resolved_at is null;
  end if;
  if new.carrier_order_no is not null and btrim(new.carrier_order_no) <> '' and new.carrier_order_no is distinct from old.carrier_order_no then
    update risk_signals set resolved_at = now(), resolved_by = current_app_user_id()
     where dedup_key = 'ORDERNO:CARRIER:' || new.id and resolved_at is null;
  end if;
  return null;
end $$;

drop trigger if exists trg_loads_order_no_resolve on loads;
create trigger trg_loads_order_no_resolve
  after update of hhl_order_no, carrier_order_no on loads
  for each row execute function trg_order_no_resolve();

revoke all on function detect_missing_order_numbers(timestamptz, int) from public, anon, authenticated;
revoke all on function trg_order_no_resolve() from public, anon, authenticated;

-- 4. Harmonogram: co godzinę
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tower-numery-zlecen', '10 * * * *', 'select detect_missing_order_numbers()');
  else
    raise notice 'pg_cron niedostępny — tower-numery-zlecen do zaplanowania ręcznie (środowisko testowe)';
  end if;
end $cron$;
