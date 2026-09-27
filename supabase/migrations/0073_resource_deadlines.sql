-- =====================================================================
-- TOWER — Migracja 0073: I-21 (SCOPE 4.3) terminy uzupełnienia zasobów przed załadunkiem i eskalacja
--   resource_deadlines: rodzaj zasobu → ile godzin przed załadunkiem ma być uzupełniony (lead_h) i od kiedy alarm
--   krytyczny (critical_h). Wartości startowe = PROPOZYCJA 28.09, do potwierdzenia z SCX (II-3); zmienia HHL w bazie.
--     DRIVER  — imię i nazwisko + telefon kierowcy: 48 h / 12 h
--     VEHICLE — ciągnik + naczepa (tablice):        48 h / 12 h
--     DOCS    — transport w statusie DOCS_PENDING:    24 h /  6 h
--   detect_resource_deadlines(p_now): transporty PLANNED / RESOURCES_PENDING / DOCS_PENDING z przewoźnikiem;
--     brak zasobu w oknie lead_h → ryzyko RESOURCE_MISSING (HIGH; w oknie critical_h albo po terminie → CRITICAL,
--     eskalacja podnosi istniejące ryzyko), powiadomienie IN_APP dla przewoźnika (HIGH i CRITICAL) oraz HHL (CRITICAL);
--     uzupełniony zasób → ryzyko zamknięte automatycznie. pg_cron tower-zasoby co 15 min. Idempotentna.
-- =====================================================================
create table if not exists resource_deadlines (
  kind       text primary key check (kind in ('DRIVER', 'VEHICLE', 'DOCS')),
  lead_h     int  not null check (lead_h between 1 and 336),
  critical_h int  not null check (critical_h between 0 and 336),
  source     text not null,
  updated_at timestamptz not null default now(),
  check (critical_h < lead_h)
);
alter table resource_deadlines enable row level security;
revoke all on resource_deadlines from anon, authenticated;
grant select on resource_deadlines to authenticated;
drop policy if exists resource_deadlines_read on resource_deadlines;
create policy resource_deadlines_read on resource_deadlines for select to authenticated using (true);
insert into resource_deadlines (kind, lead_h, critical_h, source) values
  ('DRIVER', 48, 12, 'propozycja 28.09 — do potwierdzenia z SCX (II-3)'),
  ('VEHICLE', 48, 12, 'propozycja 28.09 — do potwierdzenia z SCX (II-3)'),
  ('DOCS', 24, 6, 'propozycja 28.09 — do potwierdzenia z SCX (II-3)')
on conflict (kind) do nothing;

create or replace function detect_resource_deadlines(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record; d record; v_missing boolean; v_sev risk_severity; v_key text; v_rid uuid; v_old risk_severity;
  n int := 0; v_code text;
begin
  for r in
    select l.*, coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) as due,
           coalesce(si.shipment_code, l.order_no, left(l.id::text, 8)) as code
      from loads l
      left join lateral (select shipment_code from shipment_items where load_id = l.id order by assembly_seq nulls last limit 1) si on true
     where l.carrier_org_id is not null
       and coalesce(l.plan_load_from, (l.plan_load_date::timestamp at time zone 'Europe/Warsaw')) is not null
  loop
    for d in select * from resource_deadlines loop
      v_key := 'RES:' || d.kind || ':' || r.id;
      v_missing := r.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') and case d.kind
        when 'DRIVER'  then coalesce(btrim(r.driver_name), '') = '' or coalesce(btrim(r.driver_phone), '') = ''
        when 'VEHICLE' then coalesce(btrim(r.tractor_plate), '') = '' or coalesce(btrim(r.trailer_plate), '') = ''
        else r.status = 'DOCS_PENDING' end;
      select id, severity into v_rid, v_old from risk_signals where dedup_key = v_key and resolved_at is null;
      if (v_missing and r.due <= p_now + make_interval(hours => d.lead_h)) is not true then
        if v_rid is not null and v_missing is not true then
          update risk_signals set resolved_at = p_now where id = v_rid;   -- uzupełnione albo transport dalej
        end if;
        continue;
      end if;
      v_sev := case when r.due <= p_now + make_interval(hours => d.critical_h) then 'CRITICAL' else 'HIGH' end;
      v_code := r.code;
      if v_rid is null then
        insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key)
        values (r.project_id, r.id, 'RESOURCE_MISSING', v_sev,
                v_code || ': ' || case d.kind when 'DRIVER' then 'brak danych kierowcy' when 'VEHICLE' then 'brak tablic ciągnika lub naczepy'
                                   else 'brak dokumentów' end || ' przed załadunkiem',
                'rk_res_' || lower(d.kind),
                jsonb_build_object('rule', 'RESOURCE_DEADLINE', 'resource', d.kind, 'owner', 'SCX', 'due', r.due,
                  'lead_h', d.lead_h, 'critical_h', d.critical_h, 'params', jsonb_build_object('code', v_code, 'h', d.lead_h),
                  'text_key', 'rk_res_' || lower(d.kind) || '_text', 'meta_key', 'risk_meta_carrier',
                  'next_action_key', 'rk_res_' || lower(d.kind) || '_next'),
                v_key);
        n := n + 1;
      elsif v_old = 'HIGH' and v_sev = 'CRITICAL' then
        update risk_signals set severity = 'CRITICAL' where id = v_rid;  -- eskalacja
        n := n + 1;
      else
        continue;
      end if;
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.id, 'RESOURCE_DEADLINE',
             jsonb_build_object('resource', d.kind, 'code', v_code, 'due', r.due, 'severity', v_sev, 'locale', u.locale),
             v_key || ':' || v_sev || ':' || u.id
        from app_users u
       where u.active and ((u.org_id = r.carrier_org_id and u.role in ('CARRIER_DISPATCH', 'CARRIER_USER'))
                           or (v_sev = 'CRITICAL' and u.role in ('HHL_ADMIN', 'HHL_OPS')))
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function detect_resource_deadlines(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-zasoby';
    perform cron.schedule('tower-zasoby', '7,22,37,52 * * * *', 'select public.detect_resource_deadlines()');
  end if;
end $$;
