-- =====================================================================
-- TOWER — Migracja 0049: I-2A — systemowa poprawka strażników NULL
--
--   current_app_role() zwraca NULL dla konta nieaktywnego / bez wiersza app_users,
--   więc is_hhl() i can_see_margin() zwracały NULL, a strażnik „if not …” przy NULL
--   NIE rzucał wyjątku (również złożone warunki: issue_driver_token, revoke_driver_token,
--   report_position — „if not (is_hhl() or (current_org_kind()='CARRIER' and …))”).
--
--   Zasada od 0049: NULL zawsze oznacza odmowę.
--     • is_hhl(), can_see_margin() — ściśle true/false (coalesce … false);
--     • każdy strażnik plpgsql: „if (warunek_dostępu) is not true then raise”;
--       gałęzie nadające uprawnienia: „if (warunek) is true then”;
--     • guard_invoice_update: zalogowany bez aktywnego konta → odmowa;
--     • fx_rate_before, keep_alive, risk_audience_for (SECURITY DEFINER bez sprawdzenia roli):
--       zalogowany bez aktywnego konta → odmowa (anon i zadania systemowe bez zmian);
--     • pozostałe „if not …” / „not helper()” (p_dry_run, v_bad, advisory lock, title_key, mime,
--       loaded_confirmed w apply_geofence_status, permit_fits) przepisane
--       jawnie („is false” / „is not true”) — test statyczny tests/db/null-guard-static.mjs.
--   Ciała funkcji poza tymi liniami bez zmian (źródło: pg_get_functiondef po 0048).
--   Idempotentna i niedestrukcyjna: wyłącznie CREATE OR REPLACE FUNCTION, uprawnienia bez zmian.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_hhl()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$ select coalesce(current_app_role() in ('HHL_ADMIN','HHL_OPS'), false) $function$;

CREATE OR REPLACE FUNCTION public.can_see_margin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$ select coalesce(current_app_role() = 'HHL_ADMIN', false) $function$;

CREATE OR REPLACE FUNCTION public.cancel_load(p_load_id uuid, p_reason text)
 RETURNS load_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_old load_status;
begin
  if is_hhl() is not true then raise exception 'Anulować transport może wyłącznie HHL'; end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Anulowanie wymaga powodu';
  end if;
  select l.status into v_old from loads l where l.id = p_load_id for update;
  if not found then raise exception 'Nieznany transport'; end if;
  if v_old = 'CANCELLED' then return v_old; end if;
  perform set_config('tower.cancel_ctx', 'MANUAL', true);
  update loads set status = 'CANCELLED', updated_at = now() where id = p_load_id;
  perform set_config('tower.cancel_ctx', '', true);
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'LOAD_CANCEL_MANUAL', 'loads', p_load_id::text,
          jsonb_build_object('status', v_old), jsonb_build_object('status', 'CANCELLED', 'reason', btrim(p_reason)));
  return 'CANCELLED';
end $function$;

CREATE OR REPLACE FUNCTION public.import_cancel_loads(p_load_ids uuid[], p_reason text DEFAULT 'Usunięty z harmonogramu (import)'::text)
 RETURNS TABLE(load_id uuid, order_no text, status load_status, verdict text, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_user uuid;
begin
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  select id into v_user from app_users where auth_id = auth.uid();
  for r in select * from import_removal_check(p_load_ids) loop
    if r.verdict = 'CANCEL' then
      perform set_config('tower.cancel_ctx', 'IMPORT', true);
      update loads set status = 'CANCELLED', updated_at = now() where id = r.load_id;
      perform set_config('tower.cancel_ctx', '', true);
      insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
      values (v_user, 'LOAD_CANCEL_IMPORT', 'loads', r.load_id::text,
              jsonb_build_object('status', r.status),
              jsonb_build_object('status', 'CANCELLED', 'reason', p_reason));
      load_id := r.load_id; order_no := r.order_no; status := 'CANCELLED'; verdict := 'CANCELLED'; reason := p_reason;
    else
      load_id := r.load_id; order_no := r.order_no; status := r.status; verdict := r.verdict; reason := r.reason;
    end if;
    return next;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.import_removal_check(p_load_ids uuid[])
 RETURNS TABLE(load_id uuid, order_no text, status load_status, verdict text, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  return query
    select l.id, l.order_no, l.status,
           case when l.status = 'CANCELLED' then 'ALREADY'
                when exists (select 1 from invoice_lines il where il.load_id = l.id) then 'BLOCKED_INVOICED'
                when l.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then 'BLOCKED_STATUS'
                else 'CANCEL' end,
           case when l.status = 'CANCELLED' then 'Już anulowany'
                when exists (select 1 from invoice_lines il where il.load_id = l.id) then 'Transport jest na fakturze'
                when l.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY')
                  then 'Transport od wjazdu na załadunek — anuluje wyłącznie HHL ręcznie, z powodem'
                else 'Zostanie anulowany (wiersz zostaje)' end
      from loads l
     where l.id = any (p_load_ids);
end $function$;

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice uuid, p_paid_at date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if is_hhl() is not true then
    raise exception 'Status „Opłacona" może ustawić wyłącznie HHL';
  end if;
  update invoices set payment_status = 'OPLACONA', paid_at = p_paid_at,
         paid_marked_by = (select id from app_users where auth_id = auth.uid()),
         paid_marked_at = now()
   where id = p_invoice;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values ((select id from app_users where auth_id = auth.uid()),
          'INVOICE_MARK_PAID', 'invoices', p_invoice::text,
          jsonb_build_object('paid_at', p_paid_at));
end $function$;

CREATE OR REPLACE FUNCTION public.unmark_invoice_paid(p_invoice uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if is_hhl() is not true then raise exception 'Cofnięcie płatności — wyłącznie HHL'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Wymagany powód cofnięcia'; end if;
  update invoices set payment_status = 'NIEOPLACONA', paid_at = null,
         paid_marked_by = null, paid_marked_at = null
   where id = p_invoice;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values ((select id from app_users where auth_id = auth.uid()),
          'INVOICE_UNMARK_PAID', 'invoices', p_invoice::text,
          jsonb_build_object('reason', p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.register_invoice(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org uuid := current_org_id();
  v_kind text := current_org_kind();
  v_dir text := p->>'direction';
  v_cur text := upper(coalesce(p->>'currency', ''));
  v_week text := p->>'week_key';
  v_issue date := (p->>'issue_date')::date;
  v_doc uuid := nullif(p->>'document_id', '')::uuid;
  v_project uuid; v_issuer uuid; v_recipient uuid; v_carrier uuid;
  v_term int; v_due date; v_id uuid; v_uid uuid := current_app_user_id();
  ln jsonb; v_load record; v_flags text[]; v_rule_no text; v_rule_mid numeric; v_rule_date date; v_exp numeric; v_net numeric;
  v_fx_mid numeric; v_fx_no text; v_fx_date date; v_eur numeric; v_n int := 0;
  v_missing uuid[]; v_hdr text[] := '{}';
begin
  if v_org is null then raise exception 'Brak konta organizacji' using errcode = '42501'; end if;
  if v_dir not in ('KOSZT','PRZYCHOD') then raise exception 'Kierunek faktury: KOSZT albo PRZYCHOD'; end if;
  if v_cur not in ('EUR','PLN') then raise exception 'Waluta faktury: EUR albo PLN (wybór wystawcy)'; end if;
  if coalesce(btrim(p->>'invoice_number'), '') = '' then raise exception 'Numer faktury jest wymagany'; end if;
  if v_issue is null then raise exception 'Data wystawienia jest wymagana'; end if;
  if v_week !~ '^\d{4}-W\d{2}$' then raise exception 'Tydzień faktury w formacie RRRR-Www'; end if;
  if (p->>'net_total') is null or (p->>'vat_total') is null or (p->>'gross_total') is null then
    raise exception 'Netto, VAT i brutto przepisz z dokumentu (system nie liczy VAT)';
  end if;
  if v_doc is null then raise exception 'Plik PDF faktury jest wymagany'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]'::jsonb)) = 0 then raise exception 'Faktura bez pozycji'; end if;

  -- strony (W7): KOSZT = przewoźnik → HHL; PRZYCHOD = HHL → klient projektu
  select l.project_id into v_project from loads l where l.id = ((p->'lines'->0)->>'load_id')::uuid;
  if v_project is null then raise exception 'Transport pozycji nie istnieje'; end if;
  if v_dir = 'KOSZT' then
    if v_kind <> 'CARRIER' then raise exception 'Fakturę kosztową rejestruje przewoźnik (wystawca)' using errcode = '42501'; end if;
    v_issuer := v_org; v_carrier := v_org;
    select id into v_recipient from organizations where kind = 'FORWARDER' order by code limit 1;
  else
    if is_hhl() is not true then raise exception 'Fakturę przychodową rejestruje HHL (wystawca)' using errcode = '42501'; end if;
    v_issuer := v_org;
    select client_org_id into v_recipient from projects where id = v_project;
  end if;
  if v_recipient is null then raise exception 'Brak odbiorcy faktury'; end if;
  if not exists (select 1 from documents d where d.id = v_doc and d.category = 'INVOICE'
                  and (d.uploaded_by = v_uid or is_hhl())) then
    raise exception 'Plik PDF faktury: nieznany dokument albo nie Twój';
  end if;

  -- termin: z dokumentu > relacja (payment_terms) > 30 dni (KSH) / 35 dni (HHL wobec SCX)
  select t.term_days into v_term from payment_terms t
   where t.project_id = v_project and t.payer_org_id = v_recipient and t.payee_org_id = v_issuer
     and t.valid_from <= v_issue order by t.valid_from desc limit 1;
  v_term := coalesce(v_term, case v_dir when 'PRZYCHOD' then 30 else 35 end);
  v_due := coalesce(nullif(p->>'due_date', '')::date, v_issue + v_term);

  insert into invoices (project_id, carrier_org_id, period_start, period_end, currency, direction,
                        issuer_org_id, recipient_org_id, invoice_number, issue_date, receipt_date, week_key,
                        net_total, vat_total, gross_total, invoiced_amount, due_date, due_date_from_document,
                        document_id, status, submitted_by, submitted_at)
  values (v_project, v_carrier, to_date(v_week, 'IYYY-"W"IW'), to_date(v_week, 'IYYY-"W"IW') + 6, v_cur, v_dir,
          v_issuer, v_recipient, btrim(p->>'invoice_number'), v_issue, nullif(p->>'receipt_date', '')::date, v_week,
          (p->>'net_total')::numeric, (p->>'vat_total')::numeric, (p->>'gross_total')::numeric, (p->>'net_total')::numeric,
          v_due, nullif(p->>'due_date', '') is not null, v_doc, 'SUBMITTED', v_uid, now())
  returning id into v_id;

  for ln in select * from jsonb_array_elements(p->'lines') loop
    select l.id, l.project_id, l.carrier_org_id, l.actual_delivery_at, l.hhl_order_no, l.carrier_order_no,
           (case v_dir when 'KOSZT' then c.computed_total_eur else r.computed_total_eur end) as computed_eur,
           (case v_dir when 'KOSZT' then c.fx_table_no else r.fx_table_no end) as snap_no,
           (case v_dir when 'KOSZT' then c.fx_rate_pln else r.fx_rate_pln end) as snap_mid,
           (case v_dir when 'KOSZT' then c.fx_effective_date else r.fx_effective_date end) as snap_date
      into v_load
      from loads l left join load_cost c on c.load_id = l.id left join load_revenue r on r.load_id = l.id
     where l.id = (ln->>'load_id')::uuid;
    if v_load.id is null or v_load.project_id <> v_project then raise exception 'Pozycja: transport spoza projektu faktury'; end if;
    if v_dir = 'KOSZT' and v_load.carrier_org_id is distinct from v_issuer then
      raise exception 'Pozycja: transport innego przewoźnika' using errcode = '42501';
    end if;
    v_flags := '{}';
    v_net := (ln->>'invoiced_net')::numeric;
    v_fx_no := nullif(ln->>'fx_table_no', ''); v_fx_mid := nullif(ln->>'fx_mid', '')::numeric;
    v_fx_date := nullif(ln->>'fx_effective_date', '')::date;
    if v_load.actual_delivery_at is null then
      v_flags := array_append(v_flags, 'NIEZREALIZOWANY');
    elsif invoice_week_local(v_load.actual_delivery_at) <> v_week then
      v_flags := array_append(v_flags, 'ZLY_TYDZIEN');
    end if;
    -- reguła kursu: migawka przy rozładunku, inaczej W3 z fx_rates
    v_rule_no := null; v_rule_mid := null; v_rule_date := null;
    if v_load.snap_no is not null then
      v_rule_no := v_load.snap_no; v_rule_mid := v_load.snap_mid; v_rule_date := v_load.snap_date;
    elsif v_load.actual_delivery_at is not null then
      begin
        select f.table_no, f.rate_pln, f.rate_date into v_rule_no, v_rule_mid, v_rule_date
          from fx_rate_before((v_load.actual_delivery_at at time zone 'Europe/Warsaw')::date) f;
      exception when others then v_rule_no := null; v_rule_mid := null; v_rule_date := null;
      end;
    end if;
    if v_cur = 'PLN' and v_fx_mid is null then v_flags := array_append(v_flags, 'BRAK_KURSU'); end if;
    if v_fx_mid is not null and v_rule_no is not null then
      if v_fx_no is distinct from v_rule_no then v_flags := array_append(v_flags, 'TABELA_NBP'); end if;
      if abs(v_fx_mid - v_rule_mid) > 0.00005 then v_flags := array_append(v_flags, 'KURS_NBP'); end if;
      if v_fx_date is distinct from v_rule_date then v_flags := array_append(v_flags, 'DATA_KURSU'); end if;
    end if;
    -- kwota wobec wyliczenia (tolerancja: > 1 i > 0,2 %)
    v_exp := null;
    if v_load.computed_eur is not null then
      v_exp := case v_cur when 'EUR' then round(v_load.computed_eur, 2)
               else case when v_rule_mid is not null then round(v_load.computed_eur * v_rule_mid, 2) end end;
      if v_exp is not null and abs(v_net - v_exp) > 1 and (v_exp = 0 or abs(v_net - v_exp) / v_exp > 0.002) then
        v_flags := array_append(v_flags, 'KWOTA');
      end if;
    end if;
    -- flagi, których baza nie liczy (opłata paliwowa podana osobno) — z kontroli aplikacji
    if coalesce((ln->'flags') ? 'OPLATA_PALIWOWA', false) then v_flags := array_append(v_flags, 'OPLATA_PALIWOWA'); end if;

    begin
      insert into invoice_lines (invoice_id, load_id, direction, expected_amount, invoiced_amount, invoiced_net,
                                 invoiced_fuel, fx_table_no, fx_mid, fx_effective_date, flags)
      values (v_id, v_load.id, v_dir, v_exp, v_net, v_net, nullif(ln->>'invoiced_fuel', '')::numeric,
              v_fx_no, v_fx_mid, v_fx_date, v_flags);
    exception when unique_violation then
      raise exception 'Transport jest już na innej fakturze tego kierunku — podwójne fakturowanie zablokowane';
    end;

    -- Z1: kwota z faktury obok wyliczenia (wyliczenie bez zmian)
    v_eur := case v_cur when 'EUR' then v_net else case when v_fx_mid > 0 then round(v_net / v_fx_mid, 2) end end;
    if v_eur is not null then
      if v_dir = 'KOSZT' then
        update load_cost set invoiced_total_eur = v_eur, pricing_tier = 'FAKTURA' where load_id = v_load.id;
      else
        update load_revenue set invoiced_total_eur = v_eur, pricing_tier = 'FAKTURA' where load_id = v_load.id;
      end if;
    end if;

    -- dokumenty potwierdzające transport (Q8): CMR i POD pozycji
    insert into invoice_documents (invoice_id, document_id, role)
    select v_id, d.id, d.category::text from documents d
     where d.load_id = v_load.id and d.category in ('CMR','POD')
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;

  insert into invoice_documents (invoice_id, document_id, role) values (v_id, v_doc, 'FAKTURA_PDF')
  on conflict do nothing;

  -- BRAK_NA_FAKTURZE: transporty zrealizowane w tym tygodniu, których nie ma na żadnej fakturze tego kierunku
  select coalesce(array_agg(l.id), '{}') into v_missing from loads l
   where l.project_id = v_project and l.actual_delivery_at is not null
     and invoice_week_local(l.actual_delivery_at) = v_week
     and (v_dir = 'PRZYCHOD' or l.carrier_org_id = v_issuer)
     and not exists (select 1 from invoice_lines x where x.load_id = l.id and x.direction = v_dir);
  if cardinality(v_missing) > 0 then v_hdr := array_append(v_hdr, 'BRAK_NA_FAKTURZE'); end if;
  update invoices set check_flags = v_hdr, missing_load_ids = v_missing where id = v_id;

  -- Q13: KSH dostaje powiadomienie o nowej fakturze HHL
  if v_dir = 'PRZYCHOD' then
    insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
    select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, 'INVOICE_NEW',
           jsonb_build_object('invoice_id', v_id, 'number', btrim(p->>'invoice_number'), 'week', v_week,
                              'currency', v_cur, 'gross', (p->>'gross_total')::numeric, 'due', v_due, 'locale', u.locale),
           'INVOICE_NEW:' || v_id || ':' || u.id
      from app_users u where u.org_id = v_recipient and u.active
    on conflict (dedup_key) where dedup_key is not null do nothing;
  end if;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_uid, 'INVOICE_REGISTER', 'invoices', v_id::text,
          jsonb_build_object('direction', v_dir, 'number', btrim(p->>'invoice_number'), 'lines', v_n, 'currency', v_cur));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.issue_driver_token(p_load_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_load loads%rowtype; v_token text; v_user uuid;
begin
  select * into v_load from loads where id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id())) is not true then
    raise exception 'Token kierowcy wydaje wyłącznie przewoźnik transportu albo HHL';
  end if;
  if v_load.status = 'CANCELLED' then raise exception 'Transport anulowany — token niedostępny'; end if;
  if v_load.actual_delivery_at is not null and v_load.actual_delivery_at + interval '24 hours' <= now() then
    raise exception 'Ponad 24 h po rozładunku — token niedostępny';
  end if;
  select id into v_user from app_users where auth_id = auth.uid();
  update driver_tokens set revoked_at = now(), revoked_by = v_user
   where load_id = p_load_id and revoked_at is null;             -- nowy unieważnia poprzedni
  v_token := 'wt_' || encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex');
  insert into driver_tokens (load_id, token_hash, issued_by, expires_at)
  values (p_load_id, driver_token_hash(v_token), v_user,
          least(now() + interval '14 days',
                coalesce(v_load.actual_delivery_at + interval '24 hours', now() + interval '14 days')));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'DRIVER_TOKEN_ISSUE', 'loads', p_load_id::text, jsonb_build_object('revoked_previous', true));
  return v_token;
end $function$;

CREATE OR REPLACE FUNCTION public.report_position(p_load_id uuid, p_lat double precision, p_lon double precision, p_ts timestamp with time zone, p_accuracy numeric DEFAULT NULL::numeric, p_speed numeric DEFAULT NULL::numeric, p_heading numeric DEFAULT NULL::numeric)
 RETURNS TABLE(event_type text, geofence_id uuid, geofence_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_carrier uuid;
begin
  select l.carrier_org_id into v_carrier from loads l where l.id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if (is_hhl() or (current_org_kind() = 'CARRIER' and v_carrier = current_org_id())) is not true then
    raise exception 'Pozycję transportu zgłasza wyłącznie jego przewoźnik albo HHL';
  end if;
  if p_lat is null or p_lon is null or abs(p_lat) > 90 or abs(p_lon) > 180 then
    raise exception 'Niepoprawne współrzędne';
  end if;
  if p_ts is null or p_ts > now() + interval '5 minutes' then
    raise exception 'Czas pozycji z przyszłości';
  end if;
  -- słaby fix (sieć komórkowa, wnętrze budynku) nie może otwierać ani zamykać stref
  if p_accuracy is not null and p_accuracy > 250 then return; end if;
  return query
    select r.event_type, r.geofence_id, r.geofence_name
      from process_position(p_load_id, p_lat, p_lon, p_ts, 'DRIVER_PWA'::position_source,
                            p_speed, p_heading, null,
                            jsonb_build_object('accuracy_m', p_accuracy, 'via', 'report_position')) r;
end $function$;

CREATE OR REPLACE FUNCTION public.revoke_driver_token(p_load_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_carrier uuid; n int; v_user uuid;
begin
  select carrier_org_id into v_carrier from loads where id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if (is_hhl() or (current_org_kind() = 'CARRIER' and v_carrier = current_org_id())) is not true then
    raise exception 'Token kierowcy odwołuje wyłącznie przewoźnik transportu albo HHL';
  end if;
  select id into v_user from app_users where auth_id = auth.uid();
  update driver_tokens set revoked_at = now(), revoked_by = v_user
   where load_id = p_load_id and revoked_at is null;
  get diagnostics n = row_count;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'DRIVER_TOKEN_REVOKE', 'loads', p_load_id::text, jsonb_build_object('revoked', n));
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.import_schedule(p_project uuid, p_rows jsonb, p_cancel_codes text[] DEFAULT '{}'::text[], p_file jsonb DEFAULT '{}'::jsonb, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t0          timestamptz := clock_timestamp();
  v_user      uuid;
  v_carrier   uuid;
  v_carrier_n text;
  v_import    uuid;
  v_version   int;
  v_n         int;
  r           record;
  c           record;
  v_load      uuid;
  v_fields    text[];
  v_crit      text[];
  v_added     jsonb := '[]';
  v_changed   jsonb := '[]';
  v_unchanged int := 0;
  v_cands     jsonb := '[]';
  v_blocked   jsonb := '[]';
  v_cancelled jsonb := '[]';
  v_critical  jsonb := '[]';
  v_fnames    text[] := array['item_type','length_m','width_m','height_m','unit_weight_t','qty','total_weight_t',
                              'load_date','load_time','delivery_date','delivery_time','order_no','assembly_seq'];
begin
  -- is_hhl() zwraca NULL dla konta nieaktywnego / bez wiersza app_users — NULL nie może przepuścić
  if is_hhl() is not true then raise exception 'Import harmonogramu wyłącznie HHL'; end if;
  if not exists (select 1 from projects where id = p_project) then raise exception 'Nieznany projekt'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Wiersze importu: oczekiwana tablica'; end if;
  perform pg_advisory_xact_lock(hashtext('import_schedule:' || p_project::text));
  select id into v_user from app_users where auth_id = auth.uid();

  -- przewoźnik nowych transportów: jedyny przewoźnik w systemie (inaczej HHL przypisuje ręcznie)
  select case when count(*) = 1 then min(id::text)::uuid end, case when count(*) = 1 then min(name) end
    into v_carrier, v_carrier_n from organizations where kind = 'CARRIER';

  -- walidacja wejścia (druga linia za parserem w przeglądarce): błąd = cała transakcja wycofana
  create temp table if not exists _imp (code text primary key, row jsonb not null) on commit drop;
  truncate _imp;
  for r in select value as v, ordinality as i from jsonb_array_elements(p_rows) with ordinality loop
    if coalesce(btrim(r.v->>'code'), '') = '' then raise exception 'Wiersz %: brak kodu „Wysyłka”', r.i; end if;
    begin
      c := null;
      select schedule_row_canon(r.v) as canon into c;
    exception when others then
      raise exception 'Wiersz % (%): nieprawidłowa wartość — %', r.i, r.v->>'code', sqlerrm;
    end;
    if (c.canon->>'length_m')::numeric <= 0 or (c.canon->>'width_m')::numeric <= 0 or (c.canon->>'height_m')::numeric <= 0 then
      raise exception 'Wiersz % (%): wymiary muszą być dodatnie', r.i, r.v->>'code';
    end if;
    if (c.canon->>'qty')::int <= 0 then raise exception 'Wiersz % (%): ilość musi być dodatnia', r.i, r.v->>'code'; end if;
    if (c.canon->>'delivery_date')::date < (c.canon->>'load_date')::date then
      raise exception 'Wiersz % (%): data dostawy przed datą załadunku', r.i, r.v->>'code';
    end if;
    begin
      insert into _imp values (btrim(r.v->>'code'), c.canon);
    exception when unique_violation then
      raise exception 'Kod % występuje w pliku więcej niż raz', btrim(r.v->>'code');
    end;
  end loop;

  -- wersja (tylko przy zapisie; nadawana dopiero, gdy są zmiany)
  if p_dry_run is false then
    select coalesce(max(version), 0) + 1 into v_version from schedule_imports where project_id = p_project;
  end if;

  -- nowe i zmienione
  for r in
    select i.code, i.row as inc, si.id as item_id, si.load_id, l.status, l.carrier_org_id,
           (l.plan_load_from is not null or l.plan_load_to is not null
            or l.plan_delivery_from is not null or l.plan_delivery_to is not null
            or l.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE')) as awizowany,
           coalesce(si.schedule_row, case when si.id is not null then jsonb_build_object(
             'item_type', si.item_type, 'length_m', round(si.length_m, 2), 'width_m', round(si.width_m, 2),
             'height_m', round(si.height_m, 2), 'unit_weight_t', round(si.unit_weight_t, 3), 'qty', si.qty,
             'total_weight_t', round(si.total_weight_t, 3), 'load_date', l.plan_load_date, 'load_time', null,
             'delivery_date', l.plan_delivery_date, 'delivery_time', null, 'order_no', l.order_no,
             'assembly_seq', si.assembly_seq) end) as prev
      from _imp i
      left join shipment_items si on si.project_id = p_project and si.shipment_code = i.code
      left join loads l on l.id = si.load_id
     order by i.code
  loop
    if r.item_id is null or r.load_id is null then
      v_added := v_added || jsonb_build_object('code', r.code);
      if p_dry_run is false then
        if v_import is null then
          insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
          values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                  coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
          returning id into v_import;
        end if;
        insert into loads (project_id, order_no, carrier_org_id, status, plan_load_date, plan_delivery_date)
        values (p_project, r.inc->>'order_no', v_carrier, 'PLANNED',
                (r.inc->>'load_date')::date, (r.inc->>'delivery_date')::date)
        returning id into v_load;
        if r.item_id is null then
          insert into shipment_items (project_id, load_id, shipment_code, item_type, length_m, width_m, height_m,
                                      unit_weight_t, qty, total_weight_t, assembly_seq, schedule_row,
                                      first_seen_import, last_seen_import)
          values (p_project, v_load, r.code, r.inc->>'item_type', (r.inc->>'length_m')::numeric, (r.inc->>'width_m')::numeric,
                  (r.inc->>'height_m')::numeric, (r.inc->>'unit_weight_t')::numeric, (r.inc->>'qty')::int,
                  (r.inc->>'total_weight_t')::numeric, (r.inc->>'assembly_seq')::int, r.inc, v_import, v_import);
        else
          update shipment_items set load_id = v_load, schedule_row = r.inc, last_seen_import = v_import, updated_at = now()
           where id = r.item_id;
        end if;
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
        values (v_load, 'SCHEDULE_IMPORTED', now(), v_user,
                jsonb_build_object('action', 'ADDED', 'code', r.code, 'version', v_version, 'file', p_file->>'name'));
      end if;
      continue;
    end if;

    select coalesce(array_agg(f order by f), '{}') into v_fields
      from unnest(v_fnames) f where (r.inc -> f) is distinct from (r.prev -> f);
    if cardinality(v_fields) = 0 then v_unchanged := v_unchanged + 1; continue; end if;

    if r.status = 'CANCELLED' then
      v_blocked := v_blocked || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'reason', 'CANCELLED',
                     'message', 'Transport anulowany — przywrócenie wyłącznie ręcznie przez HHL');
      continue;
    end if;

    v_crit := case when r.awizowany then
      array(select f from unnest(v_fields) f where f in ('load_date','load_time','delivery_date','delivery_time')) else '{}' end;
    v_changed := v_changed || jsonb_build_object('code', r.code, 'load_id', r.load_id, 'fields', to_jsonb(v_fields),
                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f),
                   'critical', cardinality(v_crit) > 0);
    if cardinality(v_crit) > 0 then v_critical := v_critical || jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit)); end if;

    if p_dry_run is false then
      if v_import is null then
        insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
        values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
        returning id into v_import;
      end if;
      update shipment_items set
        item_type = r.inc->>'item_type', length_m = (r.inc->>'length_m')::numeric, width_m = (r.inc->>'width_m')::numeric,
        height_m = (r.inc->>'height_m')::numeric, unit_weight_t = (r.inc->>'unit_weight_t')::numeric,
        qty = (r.inc->>'qty')::int, total_weight_t = (r.inc->>'total_weight_t')::numeric,
        assembly_seq = (r.inc->>'assembly_seq')::int, schedule_row = r.inc, last_seen_import = v_import, updated_at = now()
       where id = r.item_id;
      if 'load_date' = any (v_fields) or 'delivery_date' = any (v_fields) or 'order_no' = any (v_fields) then
        update loads set plan_load_date = (r.inc->>'load_date')::date, plan_delivery_date = (r.inc->>'delivery_date')::date,
                         order_no = r.inc->>'order_no', updated_at = now()
         where id = r.load_id;
      end if;
      insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
      values (r.load_id, 'SCHEDULE_IMPORTED', now(), v_user,
              jsonb_build_object('action', 'CHANGED', 'code', r.code, 'version', v_version, 'fields', to_jsonb(v_fields),
                                 'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_fields) f),
                                 'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_fields) f)));
      if cardinality(v_crit) > 0 then
        insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
        values (r.load_id, 'SCHEDULE_DATE_CRITICAL', now(), v_user,
                jsonb_build_object('code', r.code, 'version', v_version, 'fields', to_jsonb(v_crit),
                                   'before', (select jsonb_object_agg(f, r.prev -> f) from unnest(v_crit) f),
                                   'after',  (select jsonb_object_agg(f, r.inc -> f) from unnest(v_crit) f)));
        insert into notifications (channel, recipient, user_id, load_id, template, payload, dedup_key)
        select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, r.load_id, 'SCHEDULE_DATE_CRITICAL',
               jsonb_build_object('code', r.code, 'fields', to_jsonb(v_crit),
                                  'load_date', r.inc->>'load_date', 'delivery_date', r.inc->>'delivery_date',
                                  'locale', u.locale),
               'SCHED_CRIT:' || r.load_id || ':' || v_version || ':' || u.id
          from app_users u join organizations o on o.id = u.org_id
         where u.active and (o.kind = 'FORWARDER' or (r.carrier_org_id is not null and u.org_id = r.carrier_org_id))
        on conflict (dedup_key) where dedup_key is not null do nothing;
      end if;
    end if;
  end loop;

  -- nieobecne w pliku: kandydaci do anulowania (tylko gdy plik ma przyjęte wiersze)
  if jsonb_array_length(p_rows) > 0 then
    for c in
      select si.shipment_code as code, l.id as load_id, l.status,
             exists (select 1 from invoice_lines il where il.load_id = l.id) as invoiced
        from shipment_items si join loads l on l.id = si.load_id
       where si.project_id = p_project and l.status <> 'CANCELLED'
         and not exists (select 1 from _imp i where i.code = si.shipment_code)
       order by si.shipment_code
    loop
      if c.invoiced then
        v_blocked := v_blocked || jsonb_build_object('code', c.code, 'load_id', c.load_id, 'reason', 'INVOICED',
                       'message', 'Transport jest na fakturze');
      elsif c.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        v_blocked := v_blocked || jsonb_build_object('code', c.code, 'load_id', c.load_id, 'reason', 'STATUS',
                       'message', 'Transport od wjazdu na załadunek — anuluje wyłącznie HHL ręcznie, z powodem');
      else
        v_cands := v_cands || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        if p_dry_run is false and c.code = any (coalesce(p_cancel_codes, '{}')) then
          if v_import is null then
            insert into schedule_imports (project_id, version, source, file_path, file_hash, file_name, column_map, stats, imported_by)
            values (p_project, v_version, 'UPLOAD', p_file->>'path', p_file->>'hash', p_file->>'name',
                    coalesce(p_file->'column_map', '{}'::jsonb), '{}'::jsonb, v_user)
            returning id into v_import;
          end if;
          perform set_config('tower.cancel_ctx', 'IMPORT', true);
          update loads set status = 'CANCELLED', updated_at = now() where id = c.load_id;
          perform set_config('tower.cancel_ctx', '', true);
          insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
          values (v_user, 'LOAD_CANCEL_IMPORT', 'loads', c.load_id::text, jsonb_build_object('status', c.status),
                  jsonb_build_object('status', 'CANCELLED', 'reason', 'Usunięty z harmonogramu (' || coalesce(p_file->>'name', 'import') || ')',
                                     'version', v_version));
          insert into load_events (load_id, event_type, occurred_at, actor_id, payload)
          values (c.load_id, 'STATUS_CANCELLED', now(), v_user,
                  jsonb_build_object('code', c.code, 'version', v_version, 'reason', 'Usunięty z harmonogramu', 'file', p_file->>'name'));
          v_cancelled := v_cancelled || jsonb_build_object('code', c.code, 'load_id', c.load_id);
        end if;
      end if;
    end loop;
  end if;

  if v_import is not null then
    update schedule_imports set stats = jsonb_build_object(
        'added', jsonb_array_length(v_added), 'changed', jsonb_array_length(v_changed),
        'unchanged', v_unchanged, 'cancelled', jsonb_array_length(v_cancelled),
        'blocked', jsonb_array_length(v_blocked), 'critical', jsonb_array_length(v_critical),
        'rows', jsonb_array_length(p_rows), 'rejected', coalesce((p_file->>'rejected')::int, 0))
     where id = v_import;
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'version', case when v_import is not null then v_version end,
    'import_id', v_import,
    'rows', jsonb_array_length(p_rows),
    'added', v_added, 'changed', v_changed, 'unchanged', v_unchanged,
    'cancel_candidates', v_cands, 'blocked', v_blocked, 'cancelled', v_cancelled, 'critical', v_critical,
    'carrier', v_carrier_n,
    'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_invite_user(p_email text, p_org_code text, p_role user_role, p_full_name text DEFAULT NULL::text, p_locale text DEFAULT 'pl'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_org organizations%rowtype; v_id uuid; v_me uuid; v_user app_users%rowtype;
        v_signed boolean; v_reinvite boolean := false;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Zapraszać może wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Nieprawidłowy adres e-mail';
  end if;
  select * into v_org from organizations where code = upper(p_org_code);
  if not found then raise exception 'Nieznana organizacja: %', p_org_code; end if;
  if role_matches_org(p_role, v_org.kind) is not true then
    raise exception 'Rola % nie pasuje do organizacji %', p_role, v_org.code;
  end if;
  if coalesce(p_locale,'pl') not in ('pl','en','sv') then raise exception 'Nieznany język'; end if;
  select * into v_user from app_users where email = lower(p_email)::citext;
  if found then
    v_signed := true;
    if to_regclass('auth.users') is not null then
      execute 'select last_sign_in_at is not null from auth.users where id = $1' into v_signed using v_user.auth_id;
    end if;
    if coalesce(v_signed, false) then
      raise exception 'Użytkownik już istnieje — zmień rolę zamiast zapraszać';
    end if;
    v_reinvite := true;
  end if;
  select id into v_me from app_users where auth_id = auth.uid();
  insert into user_invites (email, org_id, role, full_name, locale, invited_by)
  values (lower(p_email), v_org.id, p_role, p_full_name, coalesce(p_locale,'pl'), v_me)
  on conflict (email) do update
     set org_id = excluded.org_id, role = excluded.role, full_name = excluded.full_name,
         locale = excluded.locale, invited_by = excluded.invited_by, created_at = now()
   where user_invites.accepted_at is null
  returning id into v_id;
  if v_id is null then raise exception 'Zaproszenie już przyjęte'; end if;
  if v_reinvite then
    update app_users set active = true, org_id = v_org.id, role = p_role,
           full_name = coalesce(p_full_name, full_name), locale = coalesce(p_locale, locale)
     where id = v_user.id;
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, case when v_reinvite then 'USER_REINVITED' else 'USER_INVITED' end, 'user_invites', v_id::text,
          jsonb_build_object('org', v_org.code, 'role', p_role));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user uuid, p_role user_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_old user_role; v_kind org_kind; v_auth uuid;
begin
  if current_app_role() is distinct from 'HHL_ADMIN' then
    raise exception 'Role nadaje wyłącznie administrator HHL' using errcode = '42501';
  end if;
  select u.role, o.kind, u.auth_id into v_old, v_kind, v_auth
    from app_users u join organizations o on o.id = u.org_id where u.id = p_user;
  if not found then raise exception 'Nieznany użytkownik'; end if;
  if v_auth = auth.uid() and p_role <> 'HHL_ADMIN' then
    raise exception 'Nie możesz odebrać sobie roli administratora';
  end if;
  if role_matches_org(p_role, v_kind) is not true then
    raise exception 'Rola % nie pasuje do organizacji użytkownika', p_role;
  end if;
  update app_users set role = p_role where id = p_user;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values ((select id from app_users where auth_id = auth.uid()), 'USER_ROLE_SET',
          'app_users', p_user::text, jsonb_build_object('role', v_old),
          jsonb_build_object('role', p_role));
end $function$;

CREATE OR REPLACE FUNCTION public.backup_run_begin(p_stale interval DEFAULT '00:30:00'::interval)
 RETURNS TABLE(run_id bigint, run_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_other bigint;
begin
  if pg_try_advisory_xact_lock(hashtext('tower-backup-export')) is not true then
    insert into backup_runs (status, finished_at, error)
    values ('SKIPPED', now(), 'równoległy start — blokada zajęta przez inny przebieg')
    returning id into v_id;
    return query select v_id, 'SKIPPED'::text;
    return;
  end if;
  update backup_runs
     set status = 'ERROR', finished_at = now(),
         error = coalesce(error || ' · ', '') || 'przerwany: brak zakończenia w ' || p_stale::text
   where status = 'RUNNING' and started_at < now() - p_stale;
  select id into v_other from backup_runs where status = 'RUNNING' order by started_at desc limit 1;
  if v_other is not null then
    insert into backup_runs (status, finished_at, error)
    values ('SKIPPED', now(), 'trwa przebieg id=' || v_other)
    returning id into v_id;
    return query select v_id, 'SKIPPED'::text;
    return;
  end if;
  insert into backup_runs (status) values ('RUNNING') returning id into v_id;
  return query select v_id, 'RUNNING'::text;
end $function$;

CREATE OR REPLACE FUNCTION public.job_watchdog(p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  w record; v_last timestamptz; v_bad boolean; v_new int; v_out jsonb := '[]'::jsonb;
  v_key text; v_title text; v_detail jsonb; v_proj record; v_mail text; v_from text; v_to text; v_url text;
begin
  for w in select * from (values
      ('ferry-ais',   interval '30 minutes', timestamptz '2026-09-26 16:30+02', false, 'AIS promów (ferry-ais)'),
      ('usage-check', interval '26 hours',   timestamptz '2026-09-27 06:00+02', false, 'kontrola limitów (usage-check)'),
      ('send-notifications', interval '30 minutes', timestamptz '2026-09-26 17:00+02', false, 'wysyłka powiadomień e-mail (send-notifications)'),
      ('backup',      interval '26 hours',   null::timestamptz,                 true,  'kopia zapasowa (backup-export)')
    ) as t(job, win, armed_from, arm_on_first_success, label)
  loop
    v_last := job_last_success(w.job);
    if w.arm_on_first_success and v_last is null then
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'NIEUZBROJONY (brak pierwszej udanej kopii)');
      continue;
    end if;
    if w.armed_from is not null and p_now < w.armed_from + w.win and v_last is null then
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OKRES_STARTOWY');
      continue;
    end if;
    v_bad := v_last is null or v_last < p_now - w.win;
    if v_bad is false then
      update risk_signals set resolved_at = p_now where kind = 'JOB_FAILURE' and resolved_at is null
         and detail->>'job' = w.job;
      v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'OK', 'ostatni_sukces', v_last);
      continue;
    end if;
    v_title := 'Zadanie systemowe bez udanego przebiegu: ' || w.label;
    v_detail := jsonb_build_object('job', w.job, 'okno', w.win::text, 'ostatni_sukces', v_last,
      'text', 'Brak udanego przebiegu od ' || coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), 'początku')
              || ' (okno ' || w.win::text || ')',
      'next_action', 'Sprawdź integration_runs / backup_runs i net._http_response (kod odpowiedzi funkcji Edge)',
      'params', jsonb_build_object('label', w.label, 'label_key', 'job_label_' || replace(w.job, '-', '_'),
        'since', coalesce(to_char(v_last at time zone 'Europe/Warsaw', 'DD.MM.YYYY HH24:MI'), ''), 'window', w.win::text),
      'text_key', case when v_last is null then 'rk_job_failure_text_never' else 'rk_job_failure_text' end,
      'next_action_key', 'rk_job_failure_next');
    v_new := 0;
    for v_proj in select id from projects loop
      v_key := 'job:' || w.job || ':' || v_proj.id;
      if not exists (select 1 from risk_signals where dedup_key = v_key and resolved_at is null) then
        insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key, detected_at)
        values (v_proj.id, 'JOB_FAILURE', 'HIGH', v_title, 'rk_job_failure', v_detail, v_key, p_now);
        v_new := v_new + 1;
      end if;
    end loop;
    v_mail := 'BEZ_ZMIAN';
    if v_new > 0 then
      v_mail := 'BRAK_SEKRETOW';
      if to_regclass('vault.decrypted_secrets') is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
        execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                          max(decrypted_secret) filter (where name = 'mail_from'),
                          max(decrypted_secret) filter (where name = 'alert_email_to')
                     from vault.decrypted_secrets$q$ into v_url, v_from, v_to;
        if v_url is not null and v_from is not null and v_to is not null then
          execute $q$select net.http_post(url := 'https://api.resend.com/emails',
                     headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
                     body := jsonb_build_object('from', $2, 'to', to_jsonb(string_to_array($3, ',')),
                                                'subject', '[Watch Tower] ALARM: ' || $4,
                                                'text', $4 || E'\n' || ($5->>'text') || E'\nCo zrobić: ' || ($5->>'next_action')))$q$
            using v_url, v_from, v_to, v_title, v_detail;
          v_mail := 'WYSLANY_DO_KOLEJKI';
        end if;
      end if;
    end if;
    v_out := v_out || jsonb_build_object('job', w.job, 'stan', 'ALARM', 'ostatni_sukces', v_last, 'nowe_ryzyka', v_new, 'email', v_mail);
  end loop;
  return v_out;
end $function$;

CREATE OR REPLACE FUNCTION public.risk_signals_title_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.detail := coalesce(new.detail, '{}'::jsonb);
  if new.detail ? 'title_key' then
    new.title_key := coalesce(nullif(new.title_key, ''), nullif(new.detail->>'title_key', ''));
    new.detail := new.detail - 'title_key';
  end if;
  if new.title_key is null or new.title_key = '' then
    raise warning 'risk_signals bez title_key (%, %)', new.kind, new.title;
    new.title_key := 'rk_generic';
    new.detail := new.detail || jsonb_build_object('params',
      coalesce(new.detail->'params', '{}'::jsonb) || jsonb_build_object('title', new.title));
  end if;
  if (new.detail ? 'params') is not true then
    new.detail := new.detail || jsonb_build_object('params', '{}'::jsonb);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.create_document(p_load_id uuid, p_category doc_category, p_file_name text, p_mime text, p_size bigint, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, bucket text, object_path text, storage_path text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_bucket text := doc_bucket(p_category);
  v_limit  bigint := case when p_mime = 'application/pdf' then 10485760
                          when v_bucket = 'zdjecia' then 15728640 else 20971520 end;  -- PR7: PDF ≤ 10 MB
  v_ok_mime boolean := case v_bucket
    when 'faktury' then p_mime = 'application/pdf'
    when 'zdjecia' then p_mime in ('image/jpeg','image/png','image/webp','image/heic','image/heif')
    else p_mime in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') end;
  v_project uuid := p_project_id;
  v_id uuid; v_path text;
begin
  if v_ok_mime is not true then
    raise exception 'Nieobsługiwany typ pliku: %', coalesce(p_mime, '—') using errcode = '22023';
  end if;
  if p_size is null or p_size <= 0 or p_size > v_limit then
    raise exception 'Plik za duży albo pusty (limit % MB)', v_limit / 1048576 using errcode = '22023';
  end if;
  if p_load_id is not null then
    select l.project_id into v_project from loads l where l.id = p_load_id;   -- RLS: tylko widoczne
    if v_project is null then
      raise exception 'Transport niewidoczny dla konta' using errcode = '42501';
    end if;
  end if;
  if v_project is null then raise exception 'Brak projektu dokumentu' using errcode = '22023'; end if;

  insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes)
  values (v_project, p_load_id, p_category, '-', p_file_name, p_mime, p_size)
  returning documents.id, documents.storage_path into v_id, v_path;

  return query select v_id, v_bucket, substr(v_path, length(v_bucket) + 2), v_path;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_load_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_changed  text[];
  v_bad      text[];
  v_ctx      text;
  v_carrier  text[] := array[
    'tractor_plate','trailer_plate','trailer_type','driver_name','driver_phone',
    'escort_vehicles','telematics_vehicle_id','telematics_provider',
    'ferry_booking_ref','sailing_id','carrier_order_no',
    'combo_length_m','combo_width_m','combo_height_m','combo_weight_t',
    'actual_load_at','actual_delivery_at','status','updated_at'];
  -- Okna planowe (plan_load_*, plan_delivery_*) — decyzja właściciela
  -- 24.09.2026: przewoźnik ich NIE zmienia. Plan pochodzi z harmonogramu KSH.
begin
  -- ANEKS 3 §2.1: anulowanie wyłącznie przez import (warunki) albo ręcznie przez HHL z powodem
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    v_ctx := coalesce(current_setting('tower.cancel_ctx', true), '');
    if v_ctx = 'IMPORT' then
      if exists (select 1 from invoice_lines where load_id = old.id) then
        raise exception 'Import nie anuluje transportu na fakturze (%)', coalesce(old.order_no, left(old.id::text, 8));
      end if;
      if old.status not in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY') then
        raise exception 'Import nie anuluje transportu w statusie % — od AT_LOADING wyłącznie HHL ręcznie, z powodem', old.status;
      end if;
    elsif v_ctx = 'MANUAL' then
      null;  -- cancel_load(): HHL + powód + wpis w audit_log
    elsif auth.uid() is not null then
      raise exception 'Anulować transport może wyłącznie HHL — przez cancel_load() z powodem albo import harmonogramu';
    end if;
  end if;

  -- Realizacja = rozładunek: status UNLOADED bez daty rozładunku jest niemożliwy
  if new.status = 'UNLOADED' and new.actual_delivery_at is null then
    raise exception 'Status UNLOADED wymaga daty rozładunku — to data realizacji usługi';
  end if;

  -- Data rozładunku steruje kursem NBP, opłatą paliwową i tygodniem faktury.
  -- Każda zmiana w dzienniku audytu; po zafakturowaniu — wyłącznie HHL.
  if new.actual_delivery_at is distinct from old.actual_delivery_at then
    if auth.uid() is not null and is_hhl() is not true
       and exists (select 1 from invoice_lines where load_id = old.id) then
      raise exception 'Data rozładunku transportu na fakturze jest zamrożona — zmiana wyłącznie przez HHL';
    end if;
    insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
    values ((select id from app_users where auth_id = auth.uid()),
            'LOAD_DELIVERY_DATE_CHANGE', 'loads', old.id::text,
            jsonb_build_object('actual_delivery_at', old.actual_delivery_at),
            jsonb_build_object('actual_delivery_at', new.actual_delivery_at));
  end if;

  if auth.uid() is null then return new; end if;   -- zadania systemowe, automat statusów

  select coalesce(array_agg(n.key), '{}') into v_changed
    from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from (to_jsonb(old) -> n.key);

  if is_hhl() is true then
    -- W12: każda strona wpisuje SWÓJ numer zlecenia
    if new.carrier_order_no is distinct from old.carrier_order_no then
      raise exception 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik';
    end if;
    return new;
  end if;

  if (current_org_kind() = 'CARRIER' and old.carrier_org_id = current_org_id()) is true then
    select coalesce(array_agg(c), '{}') into v_bad from unnest(v_changed) c where c <> all (v_carrier);
    if cardinality(v_bad) > 0 then
      raise exception 'Przewoźnik nie może zmieniać: %', array_to_string(v_bad, ', ');
    end if;
    if new.status is distinct from old.status then
      if new.status = 'CANCELLED' then
        raise exception 'Anulować transport może wyłącznie HHL';
      end if;
      if old.status <> 'CANCELLED' and new.status < old.status then
        raise exception 'Status nie może się cofnąć: % → %', old.status, new.status;
      end if;
    end if;
    if new.sailing_id is distinct from old.sailing_id and old.status >= 'FERRY' then
      raise exception 'Zmiana rejsu po wypłynięciu — wyłącznie HHL';
    end if;
    return new;
  end if;

  raise exception 'Brak uprawnień do zmiany transportu';
end $function$;

CREATE OR REPLACE FUNCTION public.guard_invoice_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  org uuid := current_org_id();
  issuer_changed boolean :=
       new.invoice_number is distinct from old.invoice_number
    or new.issue_date     is distinct from old.issue_date
    or new.receipt_date   is distinct from old.receipt_date
    or new.week_key       is distinct from old.week_key
    or new.currency       is distinct from old.currency
    or new.net_total      is distinct from old.net_total
    or new.vat_total      is distinct from old.vat_total
    or new.gross_total    is distinct from old.gross_total
    or new.due_date       is distinct from old.due_date
    or new.document_id    is distinct from old.document_id
    or new.issuer_org_id  is distinct from old.issuer_org_id
    or new.recipient_org_id is distinct from old.recipient_org_id
    or new.direction      is distinct from old.direction;
  verifier_changed boolean :=
       new.verification_status is distinct from old.verification_status
    or new.dispute_note        is distinct from old.dispute_note;
begin
  -- Q7: spór zawsze z uzasadnieniem — niezależnie od tego, kto go zgłasza
  if new.verification_status = 'SPORNA'
     and (new.dispute_note is null or btrim(new.dispute_note) = '') then
    raise exception 'Status SPORNA wymaga uzasadnienia';
  end if;
  if auth.uid() is null then return new; end if;          -- zadania systemowe
  -- 0049: zalogowany bez aktywnego konta (nieaktywny / bez app_users) — odmowa, NULL nie przepuszcza
  if org is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  if is_hhl() is true then
    -- Q14: HHL jako WYSTAWCA faktury dla KSH nie zmienia statusu weryfikacji
    -- ustawionego przez klienta. Spór klienta rozstrzyga rozmowa, nie przycisk
    -- po stronie wystawcy. Fakturę kosztową (od SCX) HHL weryfikuje normalnie.
    if org = old.issuer_org_id and verifier_changed then
      raise exception 'Wystawca nie weryfikuje własnej faktury — spór klienta rozstrzyga rozmowa, nie przycisk wystawcy';
    end if;
    return new;
  end if;
  if org = old.recipient_org_id and issuer_changed then
    raise exception 'Odbiorca faktury może ją weryfikować, nie zmieniać jej treści';
  end if;
  if org = old.issuer_org_id and verifier_changed then
    raise exception 'Wystawca nie weryfikuje własnej faktury';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.fx_rate_before(p_local_date date, p_currency character DEFAULT 'EUR'::bpchar)
 RETURNS TABLE(table_no text, rate_date date, rate_pln numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 0049: zalogowany bez aktywnego konta (nieaktywny / bez app_users) — odmowa; anon i zadania systemowe bez zmian
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  return query
    select f.table_no, f.rate_date, f.rate_pln from fx_rates f
    where f.currency = p_currency and f.rate_date < p_local_date
      and f.rate_date >= p_local_date - 14
    order by f.rate_date desc limit 1;
  if not found then
    raise exception 'Brak tabeli A NBP przed % (przedział [dzień − 14, dzień − 1]) — nie zgaduj kursu', p_local_date;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.keep_alive(p_source text DEFAULT 'worker'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare h system_heartbeat%rowtype;
begin
  -- 0049: zalogowany bez aktywnego konta (nieaktywny / bez app_users) — odmowa; anon i zadania systemowe bez zmian
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  update system_heartbeat
     set beat_at = now(), source = left(coalesce(p_source, 'worker'), 40), beats = beats + 1
   where id = 1 and beat_at <= now() - interval '60 seconds';
  select * into h from system_heartbeat where id = 1;
  return jsonb_build_object('ok', true, 'beat_at', h.beat_at, 'beats', h.beats, 'db_now', now());
end $function$;

CREATE OR REPLACE FUNCTION public.risk_audience_for(p_kind text, p_detail jsonb)
 RETURNS risk_audience
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_dir text; v_inv text;
begin
  -- 0049: zalogowany bez aktywnego konta (nieaktywny / bez app_users) — odmowa; anon i zadania systemowe bez zmian
  if auth.uid() is not null and current_app_user_id() is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if p_kind in ('FERRY', 'ROAD_SE', 'ROAD_PL', 'WEATHER', 'ETA_BREACH') then
    return 'WSZYSCY';
  end if;
  if p_kind = 'RESOURCE_MISSING' and coalesce(p_detail->>'rule', '') = 'ORDER_NO'
     and coalesce(p_detail->>'side', '') = 'HHL' then
    return 'HHL';                       -- §2.4: numer HHL — sprawa wyłącznie HHL
  end if;
  if p_kind in ('SILENT_VEHICLE', 'AUTO_STATUS', 'LOADING_UNCONFIRMED', 'RESOURCE_MISSING',
                'DOC_MISSING', 'PERMIT', 'INSURANCE') then
    return 'HHL_PRZEWOZNIK';
  end if;
  if p_kind = 'SEQUENCE' then
    return 'HHL_KLIENT';
  end if;
  if p_kind = 'INVOICE_MISMATCH' then
    v_dir := upper(coalesce(p_detail->>'direction', ''));
    v_inv := p_detail->>'invoice_id';
    if v_dir = '' and v_inv ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select i.direction::text into v_dir from invoices i where i.id = v_inv::uuid;
    end if;
    return case coalesce(v_dir, '')
             when 'KOSZT' then 'HHL_PRZEWOZNIK'
             when 'PRZYCHOD' then 'HHL_KLIENT'
             else 'HHL' end;
  end if;
  return 'HHL';                         -- zamknięte drzwi: rodzaj nieprzypisany widzi tylko HHL
end $function$;

CREATE OR REPLACE FUNCTION public.apply_geofence_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind    geofence_kind;
  v_gid     uuid;
  v_country char(2);
  v_status  load_status;
  v_detail  jsonb;
begin
  select status into v_status from loads where id = new.load_id;
  if v_status in ('CANCELLED','UNLOADED','DELIVERED') then return null; end if;
  begin
    v_gid := (new.payload->>'geofence_id')::uuid;
  exception when others then
    return null;
  end;
  select g.kind, g.country into v_kind, v_country from geofences g where g.id = v_gid;
  if v_kind is null then return null; end if;
  v_detail := jsonb_build_object('geofence_id', new.payload->>'geofence_id',
                                 'geofence_kind', v_kind, 'zdarzenie', new.event_type);

  if new.event_type = 'GEOFENCE_ENTER' then

    if v_kind = 'LOADING' then
      if v_status = 'READY' then
        perform auto_set_status(new.load_id, v_status, 'AT_LOADING', 'wjazd w strefę załadunku', new.occurred_at, v_detail);
      elsif v_status in ('PLANNED','RESOURCES_PENDING','DOCS_PENDING') then
        perform raise_risk(new.load_id, 'AUTO_STATUS', 'HIGH',
          format('Pojazd w strefie załadunku, a transport niegotowy (status %s)', v_status),
          v_detail || jsonb_build_object('title_key', 'rk_loading_not_ready', 'params', jsonb_build_object('status', v_status)),
          'LOADING_NOT_READY:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_OUT' and v_status in ('READY','AT_LOADING','IN_TRANSIT_PL') then
      if auto_set_status(new.load_id, v_status, 'AT_PORT_GDANSK', 'wjazd w strefę portu Gdańsk', new.occurred_at, v_detail)
         and loaded_confirmed(new.load_id) is not true then
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'MEDIUM',
          'Pojazd w porcie Gdańsk bez potwierdzenia załadunku',
          v_detail || jsonb_build_object('title_key', 'rk_port_no_loaded', 'params', '{}'::jsonb), 'PORT_NO_LOADED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'FERRY' then
      perform auto_set_status(new.load_id, v_status, 'AT_PORT_NYNASHAMN', 'wjazd w strefę portu Nynäshamn', new.occurred_at, v_detail);

    elsif v_kind = 'SITE' and v_status in ('FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE') then
      perform auto_set_status(new.load_id, v_status, 'AT_SITE', 'wjazd na plac budowy', new.occurred_at, v_detail);

    -- Awaryjnie: GPS zgubił wyjazd z portu SE albo cały pobyt w porcie
    -- (sygnał wraca dopiero na lądzie). Auto na drogach SE nie może być na promie.
    elsif v_kind in ('CHECKPOINT','PRE_ARRIVAL') and v_country = 'SE'
          and v_status in ('FERRY','AT_PORT_NYNASHAMN') then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE',
        'pozycja na trasie SE — wyjazd z portu niezarejestrowany', new.occurred_at, v_detail);
    end if;

  elsif new.event_type = 'GEOFENCE_EXIT' then

    if v_kind = 'LOADING' and v_status = 'AT_LOADING' then
      if loaded_confirmed(new.load_id) then
        perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_PL', 'wyjazd ze strefy załadunku', new.occurred_at, v_detail);
      else
        perform raise_risk(new.load_id, 'LOADING_UNCONFIRMED', 'HIGH',
          'Pojazd opuścił strefę załadunku bez potwierdzenia załadunku — status bez zmian',
          v_detail || jsonb_build_object('title_key', 'rk_left_loading_unconfirmed', 'params', '{}'::jsonb), 'LEFT_LOADING_UNCONFIRMED:' || new.load_id);
      end if;

    elsif v_kind = 'PORT_IN' and v_status = 'AT_PORT_NYNASHAMN' then
      perform auto_set_status(new.load_id, v_status, 'IN_TRANSIT_SE', 'wyjazd ze strefy portu Nynäshamn', new.occurred_at, v_detail);
    end if;
    -- Wyjazd ze strefy portu Gdańsk po przełączeniu na PROM (statek
    -- odpływa) celowo niczego nie zmienia.
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.permit_fits(p_load_id uuid, p_permit_id uuid)
 RETURNS TABLE(ok boolean, breaches text[])
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select
    coalesce(bool_and(t.pass), false) as ok,
    array_remove(array_agg(case when t.pass is not true then t.label end), null) as breaches
  from loads l
  join permits p on p.id = p_permit_id
  cross join lateral (values
    ('LENGTH',  coalesce(l.combo_length_m,0) <= coalesce(p.max_length_m, 9999)),
    ('WIDTH',   coalesce(l.combo_width_m ,0) <= coalesce(p.max_width_m , 9999)),
    ('HEIGHT',  coalesce(l.combo_height_m,0) <= coalesce(p.max_height_m, 9999)),
    ('WEIGHT',  coalesce(l.combo_weight_t,0) <= coalesce(p.max_weight_t, 9999)),
    ('VALIDITY',coalesce(l.plan_load_date, current_date) between p.valid_from and p.valid_until)
  ) as t(label, pass)
  where l.id = p_load_id;
$function$;
