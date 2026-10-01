-- =====================================================================
-- TOWER — Migracja 0125: D-30 polisy — zatwierdzanie HHL + cron dzienny
--
--   1. Kolumna approval_status (PENDING / APPROVED / REJECTED):
--      przewoźnik zapisuje → PENDING; HHL zapisuje → APPROVED;
--      HHL zatwierdza / odrzuca przez insurance_policy_approve.
--   2. detect_insurance_expiry liczy wyłącznie polisy APPROVED.
--   3. Zadanie pg_cron tower-polisy: codziennie 04:10 UTC (≈06:10 Europe/Warsaw CEST).
--   Idempotentna.
-- =====================================================================

alter table public.insurance_policies
  add column if not exists approval_status text not null default 'PENDING'
    check (approval_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists submitted_by uuid references public.app_users(id),
  add column if not exists approved_by uuid references public.app_users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists reject_reason text;

comment on column public.insurance_policies.approval_status is
  'D-30: PENDING (wpis przewoźnika), APPROVED (HHL), REJECTED (HHL z powodem)';

-- HHL mógł już zapisać polisy przed 0125 — uznajemy je za zatwierdzone
update public.insurance_policies
   set approval_status = 'APPROVED',
       approved_at = coalesce(approved_at, now())
 where approval_status = 'PENDING'
   and approved_by is null
   and submitted_by is null;

create or replace function public.insurance_policy_save(
  p_org uuid, p_policy_no text, p_valid_from date, p_valid_until date, p_insurer text default null,
  p_covers_oversize boolean default false, p_covers_sweden boolean default false,
  p_sum_insured numeric default null, p_currency text default 'EUR', p_document uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_user uuid := current_app_user_id();
  v_hhl boolean := is_hhl();
  v_status text;
begin
  if (v_user is not null) is not true then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  if (v_hhl or (current_org_kind() = 'CARRIER' and p_org = current_org_id())) is not true then
    raise exception 'Polisę zapisuje HHL albo przewoźnik dla własnej organizacji' using errcode = '42501';
  end if;
  if (exists (select 1 from organizations where id = p_org and kind = 'CARRIER')) is not true then
    raise exception 'Polisa dotyczy wyłącznie przewoźnika' using errcode = '22023';
  end if;
  if (length(btrim(coalesce(p_policy_no, ''))) between 1 and 80) is not true then
    raise exception 'Brak numeru polisy' using errcode = '22023';
  end if;
  if (p_valid_from <= p_valid_until) is not true then raise exception 'Nieprawidłowy okres ważności polisy' using errcode = '22023'; end if;
  if (upper(coalesce(p_currency, 'EUR')) in ('EUR', 'PLN', 'SEK')) is not true then
    raise exception 'Waluta polisy: EUR, PLN albo SEK' using errcode = '22023';
  end if;
  if (coalesce(p_sum_insured, 0) >= 0) is not true then raise exception 'Suma ubezpieczenia nie może być ujemna' using errcode = '22023'; end if;
  if p_document is not null and (exists (select 1 from documents d where d.id = p_document and d.category = 'INSURANCE'
                                          and d.load_id is null and d.uploaded_by in (select id from app_users where org_id = p_org
                                                                                      or role in ('HHL_ADMIN', 'HHL_OPS')))) is not true then
    raise exception 'Dokument nie jest polisą tej organizacji' using errcode = '22023';
  end if;
  -- D-30: przewoźnik → PENDING (HHL zatwierdza); HHL → od razu APPROVED
  v_status := case when v_hhl then 'APPROVED' else 'PENDING' end;
  insert into insurance_policies (
    org_id, policy_no, insurer, sum_insured, currency, covers_oversize, covers_sweden,
    valid_from, valid_until, document_id, approval_status, submitted_by,
    approved_by, approved_at
  ) values (
    p_org, btrim(p_policy_no), nullif(btrim(coalesce(p_insurer, '')), ''), p_sum_insured,
    upper(coalesce(p_currency, 'EUR')), coalesce(p_covers_oversize, false), coalesce(p_covers_sweden, false),
    p_valid_from, p_valid_until, p_document, v_status, v_user,
    case when v_hhl then v_user else null end,
    case when v_hhl then now() else null end
  )
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'INSURANCE_SAVE', 'insurance_policies', v_id::text,
          jsonb_build_object('org_id', p_org, 'policy_no', btrim(p_policy_no),
                             'valid_from', p_valid_from, 'valid_until', p_valid_until,
                             'approval_status', v_status));
  return v_id;
end $$;
revoke all on function public.insurance_policy_save(uuid, text, date, date, text, boolean, boolean, numeric, text, uuid) from public, anon;
grant execute on function public.insurance_policy_save(uuid, text, date, date, text, boolean, boolean, numeric, text, uuid) to authenticated;

drop function if exists public.insurance_policies_list();
create or replace function public.insurance_policies_list()
returns table (
  id uuid, org_id uuid, org_name text, policy_no text, insurer text, sum_insured numeric, currency char(3),
  covers_oversize boolean, covers_sweden boolean, valid_from date, valid_until date, document_id uuid,
  days_left int, approval_status text, submitted_by uuid, approved_by uuid, approved_at timestamptz, reject_reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if (current_app_user_id() is not null) is not true then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  return query
    select p.id, p.org_id, o.name, p.policy_no, p.insurer, p.sum_insured, p.currency, p.covers_oversize, p.covers_sweden,
           p.valid_from, p.valid_until, p.document_id,
           (p.valid_until - (now() at time zone 'Europe/Warsaw')::date)::int,
           p.approval_status, p.submitted_by, p.approved_by, p.approved_at, p.reject_reason
      from insurance_policies p join organizations o on o.id = p.org_id
     where is_hhl() or (current_org_kind() = 'CARRIER' and p.org_id = current_org_id())
     order by o.name, p.valid_until desc;
end $$;
revoke all on function public.insurance_policies_list() from public, anon;
grant execute on function public.insurance_policies_list() to authenticated;

create or replace function public.insurance_policy_approve(
  p_id uuid, p_approve boolean, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := current_app_user_id();
  v_row insurance_policies%rowtype;
begin
  if (v_user is not null and is_hhl()) is not true then
    raise exception 'Zatwierdzenie polisy tylko dla HHL' using errcode = '42501';
  end if;
  if (p_id is not null and p_approve is not null) is not true then
    raise exception 'Brak identyfikatora polisy albo decyzji' using errcode = '22023';
  end if;
  select * into v_row from insurance_policies where id = p_id;
  if (v_row.id is not null) is not true then
    raise exception 'Nie znaleziono polisy' using errcode = 'P0002';
  end if;
  if (v_row.approval_status = 'PENDING') is not true then
    raise exception 'Polisa nie czeka na zatwierdzenie' using errcode = '22023';
  end if;
  if p_approve is true then
    update insurance_policies
       set approval_status = 'APPROVED', approved_by = v_user, approved_at = now(), reject_reason = null
     where id = p_id;
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (v_user, 'INSURANCE_APPROVE', 'insurance_policies', p_id::text,
            jsonb_build_object('policy_no', v_row.policy_no, 'org_id', v_row.org_id));
  else
    if (length(btrim(coalesce(p_reason, ''))) between 1 and 500) is not true then
      raise exception 'Odrzucenie wymaga uzasadnienia' using errcode = '22023';
    end if;
    update insurance_policies
       set approval_status = 'REJECTED', approved_by = v_user, approved_at = now(),
           reject_reason = btrim(p_reason)
     where id = p_id;
    insert into audit_log (user_id, action, entity, entity_id, new_value)
    values (v_user, 'INSURANCE_REJECT', 'insurance_policies', p_id::text,
            jsonb_build_object('policy_no', v_row.policy_no, 'org_id', v_row.org_id, 'reason', btrim(p_reason)));
  end if;
end $$;
revoke all on function public.insurance_policy_approve(uuid, boolean, text) from public, anon;
grant execute on function public.insurance_policy_approve(uuid, boolean, text) to authenticated;

create or replace function public.detect_insurance_expiry(p_now timestamptz default now(), p_lead_days int default 14) returns int
language plpgsql security definer set search_path = public as $$
declare
  c record; pr record; v_today date; v_sev risk_severity; v_key text; v_rid uuid; v_old risk_severity; n int := 0; v_new boolean;
begin
  if (p_now is not null and p_lead_days between 1 and 90) is not true then
    raise exception 'detect_insurance_expiry: p_now wymagane, okno 1–90 dni';
  end if;
  v_today := (p_now at time zone 'Europe/Warsaw')::date;
  for c in
    select distinct on (p.org_id) p.org_id, o.name as org_name, p.policy_no, p.insurer, p.valid_until
      from insurance_policies p join organizations o on o.id = p.org_id
     where p.approval_status = 'APPROVED'
       and p.valid_from <= v_today + p_lead_days
     order by p.org_id, p.valid_until desc
  loop
    v_key := 'INS:' || c.org_id || ':';
    if (c.valid_until <= v_today + p_lead_days) is not true then
      update risk_signals set resolved_at = p_now where dedup_key like v_key || '%' and resolved_at is null;
      continue;
    end if;
    update risk_signals set resolved_at = p_now
     where dedup_key like v_key || '%' and dedup_key not like v_key || c.valid_until || ':%' and resolved_at is null;
    v_sev := case when c.valid_until < v_today then 'CRITICAL' else 'HIGH' end;
    v_new := false;
    for pr in
      select distinct l.project_id from loads l
       where l.carrier_org_id = c.org_id and l.status not in ('CANCELLED', 'DELIVERED')
    loop
      select id, severity into v_rid, v_old from risk_signals
       where dedup_key = v_key || c.valid_until || ':' || pr.project_id and resolved_at is null;
      if v_rid is null then
        insert into risk_signals (project_id, load_id, kind, severity, title, title_key, detail, dedup_key, valid_until)
        values (pr.project_id, null, 'INSURANCE', v_sev,
                'Polisa ' || c.policy_no || ' (' || c.org_name || ') wygasa ' || to_char(c.valid_until, 'DD.MM.YYYY'),
                'rk_insurance_expiry',
                jsonb_build_object('rule', 'INSURANCE_EXPIRY', 'carrier_org_id', c.org_id, 'owner', 'SCX',
                  'valid_until', c.valid_until, 'lead_days', p_lead_days,
                  'params', jsonb_build_object('carrier', c.org_name, 'policy', c.policy_no, 'date', to_char(c.valid_until, 'DD.MM.YYYY'),
                                               'days', p_lead_days),
                  'text_key', 'rk_insurance_expiry_text', 'meta_key', 'risk_meta_carrier', 'next_action_key', 'rk_insurance_expiry_next'),
                v_key || c.valid_until || ':' || pr.project_id,
                (c.valid_until + 1)::timestamp at time zone 'Europe/Warsaw')
        on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing;
        n := n + 1; v_new := true;
      elsif v_old <> 'CRITICAL' and v_sev = 'CRITICAL' then
        update risk_signals set severity = 'CRITICAL' where id = v_rid;
        n := n + 1; v_new := true;
      end if;
    end loop;
    if v_new then
      insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
      select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, null, 'INSURANCE_EXPIRY',
             jsonb_build_object('carrier', c.org_name, 'policy_no', c.policy_no, 'insurer', c.insurer, 'due', c.valid_until,
                                'days_left', c.valid_until - v_today, 'severity', v_sev, 'locale', u.locale),
             v_key || c.valid_until || ':' || v_sev || ':' || u.id
        from app_users u
       where u.active and ((u.org_id = c.org_id and u.role in ('CARRIER_DISPATCH', 'CARRIER_USER'))
                           or u.role in ('HHL_ADMIN', 'HHL_OPS'))
      on conflict (dedup_key) where dedup_key is not null do nothing;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.detect_insurance_expiry(timestamptz, int) from public, anon, authenticated;

do $g$
begin
  if (select bool_and(prosecdef) from pg_proc
       where proname in ('insurance_policy_save', 'insurance_policies_list', 'detect_insurance_expiry', 'insurance_policy_approve')) is not true then
    raise exception '0125: funkcje polis muszą być SECURITY DEFINER';
  end if;
  if (select bool_or(has_function_privilege(r, 'detect_insurance_expiry(timestamptz,int)', 'execute'))
        from unnest(array['anon', 'authenticated']) r) is not false then
    raise exception '0125: detect_insurance_expiry tylko dla service_role';
  end if;
  if (select bool_or(has_table_privilege(r, 'public.insurance_policies', 'select,insert,update,delete'))
        from unnest(array['anon', 'authenticated']) r) is not false then
    raise exception '0125: insurance_policies zamknięta dla ról API';
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-polisy';
    perform cron.schedule('tower-polisy', '10 4 * * *', 'select public.detect_insurance_expiry()');
  else
    raise notice 'pg_cron niedostępny — tower-polisy do zaplanowania ręcznie';
  end if;
end $g$;
