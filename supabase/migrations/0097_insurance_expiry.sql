-- =====================================================================
-- TOWER — Migracja 0097: SCOPE 6.6 (audyt C4) polisy przewoźnika z przypomnieniem o wygaśnięciu — część bazowa.
--   Tabela insurance_policies zostaje zamknięta dla ról API (RLS bez polityk, bez SELECT — jak permits, test 3.2f);
--   dostęp wyłącznie przez funkcje:
--   1. insurance_policy_save(...) — zapis polisy: HHL dla dowolnego przewoźnika, przewoźnik tylko dla własnej
--      organizacji; walidacja (numer, okres ważności, waluta EUR/PLN/SEK, suma ≥ 0, dokument = polisa tej
--      organizacji); tylko dopisywanie (nowa polisa = nowy wiersz); audit_log INSURANCE_SAVE.
--   2. insurance_policies_list() — HHL wszystkie, przewoźnik własne, KSH 0 wierszy; dni do wygaśnięcia.
--   3. detect_insurance_expiry(p_now, p_lead_days = 14) — tylko service_role: dla każdego przewoźnika z polisą
--      najpóźniejszy koniec ważności ≤ 14 dni → ryzyko INSURANCE (HIGH; po terminie CRITICAL) w każdym projekcie,
--      w którym przewoźnik ma nieanulowany i niedostarczony transport, oraz powiadomienie IN_APP dla przewoźnika
--      i HHL (INSURANCE_EXPIRY, odsiew dedup_key); nowa polisa poza oknem → ryzyko zamknięte automatycznie.
--   ZADANIA CYKLICZNEGO NIE TWORZYMY (polecenie właściciela 28.09 — bez nowych zadań pg_cron): harmonogram
--   (np. codziennie 06:10 Europe/Warsaw) = decyzja właściciela D-30. Formularz polisy w UI — brak w makiecie (D-30).
--   Idempotentna, bez zmian danych.
-- =====================================================================
revoke all on insurance_policies from anon, authenticated;

create or replace function insurance_policy_save(
  p_org uuid, p_policy_no text, p_valid_from date, p_valid_until date, p_insurer text default null,
  p_covers_oversize boolean default false, p_covers_sweden boolean default false,
  p_sum_insured numeric default null, p_currency text default 'EUR', p_document uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid := current_app_user_id();
begin
  if (v_user is not null) is not true then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  if (is_hhl() or (current_org_kind() = 'CARRIER' and p_org = current_org_id())) is not true then
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
  insert into insurance_policies (org_id, policy_no, insurer, sum_insured, currency, covers_oversize, covers_sweden,
                                  valid_from, valid_until, document_id)
  values (p_org, btrim(p_policy_no), nullif(btrim(coalesce(p_insurer, '')), ''), p_sum_insured, upper(coalesce(p_currency, 'EUR')),
          coalesce(p_covers_oversize, false), coalesce(p_covers_sweden, false), p_valid_from, p_valid_until, p_document)
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'INSURANCE_SAVE', 'insurance_policies', v_id::text,
          jsonb_build_object('org_id', p_org, 'policy_no', btrim(p_policy_no), 'valid_from', p_valid_from, 'valid_until', p_valid_until));
  return v_id;
end $$;
revoke all on function insurance_policy_save(uuid, text, date, date, text, boolean, boolean, numeric, text, uuid) from public, anon;
grant execute on function insurance_policy_save(uuid, text, date, date, text, boolean, boolean, numeric, text, uuid) to authenticated;

create or replace function insurance_policies_list()
returns table (id uuid, org_id uuid, org_name text, policy_no text, insurer text, sum_insured numeric, currency char(3),
               covers_oversize boolean, covers_sweden boolean, valid_from date, valid_until date, document_id uuid, days_left int)
language plpgsql stable security definer set search_path = public as $$
begin
  if (current_app_user_id() is not null) is not true then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  return query
    select p.id, p.org_id, o.name, p.policy_no, p.insurer, p.sum_insured, p.currency, p.covers_oversize, p.covers_sweden,
           p.valid_from, p.valid_until, p.document_id,
           (p.valid_until - (now() at time zone 'Europe/Warsaw')::date)::int
      from insurance_policies p join organizations o on o.id = p.org_id
     where is_hhl() or (current_org_kind() = 'CARRIER' and p.org_id = current_org_id())
     order by o.name, p.valid_until desc;
end $$;
revoke all on function insurance_policies_list() from public, anon;
grant execute on function insurance_policies_list() to authenticated;

create or replace function detect_insurance_expiry(p_now timestamptz default now(), p_lead_days int default 14) returns int
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
     where p.valid_from <= v_today + p_lead_days
     order by p.org_id, p.valid_until desc
  loop
    v_key := 'INS:' || c.org_id || ':';
    if (c.valid_until <= v_today + p_lead_days) is not true then
      update risk_signals set resolved_at = p_now where dedup_key like v_key || '%' and resolved_at is null;  -- nowa polisa
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
        update risk_signals set severity = 'CRITICAL' where id = v_rid;   -- po terminie: eskalacja
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
revoke all on function detect_insurance_expiry(timestamptz, int) from public, anon, authenticated;

do $g$
begin
  if (select bool_and(prosecdef) from pg_proc
       where proname in ('insurance_policy_save', 'insurance_policies_list', 'detect_insurance_expiry')) is not true then
    raise exception '0097: funkcje polis muszą być SECURITY DEFINER';
  end if;
  if (select bool_or(has_function_privilege(r, 'detect_insurance_expiry(timestamptz,int)', 'execute'))
        from unnest(array['anon', 'authenticated']) r) is not false then
    raise exception '0097: detect_insurance_expiry tylko dla service_role';
  end if;
  if (select bool_or(has_table_privilege(r, 'public.insurance_policies', 'select,insert,update,delete'))
        from unnest(array['anon', 'authenticated']) r) is not false then
    raise exception '0097: insurance_policies zamknięta dla ról API';
  end if;
  if to_regclass('cron.job') is not null then
    if exists (select 1 from cron.job where command ilike '%detect_insurance_expiry%') then
      raise exception '0097: zadanie cykliczne polis istnieje — harmonogram wyłącznie decyzją właściciela (D-30)';
    end if;
  end if;
end $g$;
