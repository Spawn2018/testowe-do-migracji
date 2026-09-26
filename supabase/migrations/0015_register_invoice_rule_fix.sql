-- =====================================================================
-- 0015 — M6 poprawka: register_invoice bez zmiennej typu record dla reguły kursu.
--   Transport bez migawki kursu i bez rozładunku (reguła nieustalona) dawał błąd
--   „record v_rule is not assigned yet”. Reguła = trzy skalary (tabela, kurs, data).
--   Idempotentna (create or replace), niedestrukcyjna; logika kontroli bez zmian.
-- =====================================================================

create or replace function register_invoice(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
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
    if not is_hhl() then raise exception 'Fakturę przychodową rejestruje HHL (wystawca)' using errcode = '42501'; end if;
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
end $$;

revoke all on function register_invoice(jsonb) from public, anon;
grant execute on function register_invoice(jsonb) to authenticated;
