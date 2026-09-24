-- =====================================================================
-- TOWER — Migracja 0003: faktury trzech stron, numery zleceń,
--                        ustawienia użytkownika, terminy płatności
--
-- DECYZJE WŁAŚCICIELA 24.09.2026 (MECHANIZM_PIENIEDZY.md, wersja 2):
--  - faktury wystawiane w systemach zewnętrznych HHL i SCX, rejestrowane
--    tu z plikiem; waluta faktury EUR albo PLN — wybiera wystawca
--  - faktura SCX (koszt) widoczna dla SCX i HHL; KSH NIGDY
--  - faktura HHL (przychód) widoczna dla HHL i KSH; SCX NIGDY
--  - HHL widzi wszystkie faktury
--  - status „Opłacona" ustawia wyłącznie HHL
--  - numery zleceń HHL i SCX obowiązkowe, widoczne w harmonogramie
--  - waluta wyświetlania: ustawienie każdego użytkownika, domyślnie EUR
--
-- Rozdzielenie widoczności faktur egzekwuje BAZA. Ukrycie w interfejsie
-- nie jest zabezpieczeniem — patrz test API w tests/visual.spec.ts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NUMERY ZLECEŃ — trzy, rozdzielnie
-- ---------------------------------------------------------------------
comment on column loads.order_no is
  'Numer zlecenia KSH — z importu harmonogramu (kolumna „Nr zlecenia")';

alter table loads add column hhl_order_no     text;   -- wpisuje HHL, obowiązkowy
alter table loads add column carrier_order_no text;   -- wpisuje SCX, obowiązkowy

create unique index loads_hhl_order_no_uq
  on loads (project_id, hhl_order_no) where hhl_order_no is not null;
create unique index loads_carrier_order_no_uq
  on loads (carrier_org_id, carrier_order_no) where carrier_order_no is not null;

-- Obowiązkowość wymuszona przy przejściu statusu, nie przy utworzeniu:
-- transport powstaje z importu harmonogramu, zanim ktokolwiek nada numer.
create or replace function enforce_order_numbers() returns trigger
language plpgsql as $$
begin
  if new.status in ('READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY',
                    'AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED') then
    if new.hhl_order_no is null or btrim(new.hhl_order_no) = '' then
      raise exception 'Transport % bez numeru zlecenia HHL nie może przejść do statusu %', new.id, new.status;
    end if;
  end if;
  if new.status in ('AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK','FERRY',
                    'AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE','UNLOADED','DELIVERED') then
    if new.carrier_order_no is null or btrim(new.carrier_order_no) = '' then
      raise exception 'Transport % bez numeru zlecenia przewoźnika nie może przejść do statusu %', new.id, new.status;
    end if;
  end if;
  return new;
end $$;

create trigger trg_loads_order_numbers
  before insert or update of status, hhl_order_no, carrier_order_no on loads
  for each row execute function enforce_order_numbers();

-- HHL nadaje swój numer; przewoźnik swój. Przywileje kolumnowe:
grant update (carrier_order_no) on loads to authenticated;   -- polityka loads_update_carrier ogranicza wiersze
-- hhl_order_no: wyłącznie HHL, przez politykę loads_write_hhl

-- ---------------------------------------------------------------------
-- 2. REALIZACJA = ROZŁADUNEK
-- ---------------------------------------------------------------------
comment on column loads.actual_delivery_at is
  'Zakończenie rozładunku = realizacja usługi. Steruje datą opłaty paliwowej, '
  'dniem kursu NBP (dzień roboczy przed nim) i tygodniem faktury (lokalnie).';

-- ---------------------------------------------------------------------
-- 3. FAKTURY — przebudowa na model trzech stron
-- ---------------------------------------------------------------------
alter table invoices add column direction text
  check (direction in ('KOSZT','PRZYCHOD'));
alter table invoices add column issuer_org_id    uuid references organizations(id);
alter table invoices add column recipient_org_id uuid references organizations(id);
alter table invoices add column invoice_number   text;
alter table invoices add column issue_date       date;
alter table invoices add column receipt_date     date;          -- gdy termin liczony od doręczenia
alter table invoices add column week_key         text;          -- ISO, np. 2026-W39, liczony LOKALNIE
alter table invoices add column net_total        numeric(14,2); -- dopasowanie i marża
alter table invoices add column vat_total        numeric(14,2); -- przepisane z dokumentu, nie liczone
alter table invoices add column gross_total      numeric(14,2); -- płatność
alter table invoices add column due_date         date;
alter table invoices add column due_date_from_document boolean not null default false;
alter table invoices add column verification_status text not null default 'DO_WERYFIKACJI'
  check (verification_status in ('DO_WERYFIKACJI','ZGODNA','SPORNA','ZAAKCEPTOWANA'));
alter table invoices add column payment_status text not null default 'NIEOPLACONA'
  check (payment_status in ('NIEOPLACONA','PO_TERMINIE','OPLACONA'));
alter table invoices add column paid_at          date;
alter table invoices add column paid_marked_by   uuid references app_users(id);
alter table invoices add column paid_marked_at   timestamptz;

comment on column invoices.currency is 'Waluta faktury: EUR albo PLN — wybór wystawcy';
comment on column invoices.vat_total is 'Przepisany z dokumentu. System nie liczy VAT.';

-- Stary model zakładał tylko fakturę przewoźnika; carrier_org_id zostaje dla zgodności.
alter table invoices alter column carrier_org_id drop not null;

-- Unikalność numeru faktury u wystawcy
create unique index invoices_issuer_number_uq
  on invoices (issuer_org_id, invoice_number) where invoice_number is not null;

-- Kurs PER POZYCJA: faktura tygodniowa obejmuje różne dni rozładunku,
-- a reguła wiąże kurs z dniem rozładunku danego transportu.
alter table invoice_lines add column invoiced_net      numeric(12,2);
alter table invoice_lines add column invoiced_fuel     numeric(12,2);
alter table invoice_lines add column fx_table_no       text;
alter table invoice_lines add column fx_mid            numeric(10,6);
alter table invoice_lines add column fx_effective_date date;
alter table invoice_lines add column flags             text[] not null default '{}';

-- Transport może być na fakturze kosztowej i przychodowej, ale na każdej
-- tylko raz — podwójne fakturowanie blokuje baza.
alter table invoice_lines add column direction text check (direction in ('KOSZT','PRZYCHOD'));
create unique index invoice_lines_once_per_direction
  on invoice_lines (load_id, direction) where direction is not null;

-- Dokumenty faktury: plik PDF faktury + dokumenty potwierdzające transport.
create table invoice_documents (
  invoice_id  uuid not null references invoices(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  role        text not null check (role in ('FAKTURA_PDF','CMR','POD')),
  primary key (invoice_id, document_id)
);

-- ---------------------------------------------------------------------
-- 4. WIDOCZNOŚĆ FAKTUR — stronami są wystawca i odbiorca; HHL widzi wszystko
-- ---------------------------------------------------------------------
drop policy if exists invoices_read     on invoices;
drop policy if exists invoices_carrier  on invoices;
drop policy if exists invoices_hhl      on invoices;

create policy invoices_read on invoices for select to authenticated using (
  is_hhl()
  or issuer_org_id    = current_org_id()
  or recipient_org_id = current_org_id()
);

-- Rejestruje wystawca (SCX swoje, HHL swoje); HHL może zarejestrować każdą
create policy invoices_insert on invoices for insert to authenticated with check (
  is_hhl() or issuer_org_id = current_org_id()
);

-- Wystawca poprawia swoją fakturę, dopóki nie jest zaakceptowana
create policy invoices_update_issuer on invoices for update to authenticated
  using (issuer_org_id = current_org_id() and verification_status <> 'ZAAKCEPTOWANA')
  with check (issuer_org_id = current_org_id());

-- Odbiorca weryfikuje: KSH fakturę HHL, HHL fakturę SCX
create policy invoices_update_recipient on invoices for update to authenticated
  using (recipient_org_id = current_org_id())
  with check (recipient_org_id = current_org_id());

create policy invoices_update_hhl on invoices for update to authenticated
  using (is_hhl()) with check (is_hhl());

-- Przywileje kolumnowe: KAŻDY może zmieniać tylko swoje pola.
revoke update on invoices from authenticated;
grant update (invoice_number, issue_date, receipt_date, week_key, currency,
              net_total, vat_total, gross_total, due_date, due_date_from_document,
              document_id)
  on invoices to authenticated;                         -- pola wystawcy
grant update (verification_status, dispute_note, decided_by, decided_at)
  on invoices to authenticated;                         -- pola odbiorcy
-- Pola płatności: wyłącznie HHL — przez funkcję niżej, bez bezpośredniego UPDATE
create or replace function mark_invoice_paid(p_invoice uuid, p_paid_at date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hhl() then
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
end $$;

create or replace function unmark_invoice_paid(p_invoice uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_hhl() then raise exception 'Cofnięcie płatności — wyłącznie HHL'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Wymagany powód cofnięcia'; end if;
  update invoices set payment_status = 'NIEOPLACONA', paid_at = null,
         paid_marked_by = null, paid_marked_at = null
   where id = p_invoice;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values ((select id from app_users where auth_id = auth.uid()),
          'INVOICE_UNMARK_PAID', 'invoices', p_invoice::text,
          jsonb_build_object('reason', p_reason));
end $$;

grant execute on function mark_invoice_paid(uuid, date)   to authenticated;
grant execute on function unmark_invoice_paid(uuid, text) to authenticated;

-- Przywileje kolumnowe NIE odróżniają wystawcy od odbiorcy — obaj są
-- rolą `authenticated`. Bez tego wyzwalacza KSH, weryfikując fakturę HHL,
-- mógłby zmienić jej kwotę. Wyzwalacz sprawdza, KTO zmienia CO.
create or replace function guard_invoice_update() returns trigger
language plpgsql security definer set search_path = public as $$
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
  if is_hhl() then
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
end $$;

create trigger trg_invoices_guard
  before update on invoices
  for each row execute function guard_invoice_update();

-- Pozycje i dokumenty dziedziczą widoczność faktury
drop policy if exists invoice_lines_read on invoice_lines;
alter table invoice_documents enable row level security;

create policy invoice_lines_read on invoice_lines for select to authenticated using (
  exists (select 1 from invoices i where i.id = invoice_lines.invoice_id)
);
create policy invoice_documents_read on invoice_documents for select to authenticated using (
  exists (select 1 from invoices i where i.id = invoice_documents.invoice_id)
);

-- KSH w module faktur widzi WYŁĄCZNIE: PDF faktury HHL, CMR, POD.
-- Żadnych zdjęć, zezwoleń, polis ani innych dokumentów.
create policy invoice_documents_ksh_scope on invoice_documents as restrictive
  for select to authenticated using (
    current_org_kind() <> 'CLIENT' or role in ('FAKTURA_PDF','CMR','POD')
  );

-- Dziennik audytu: 0001 odebrało rolom API wszystkie prawa, żeby nikt nie
-- pisał bezpośrednio. Odebrało też odczyt — przez co polityka `audit_read`
-- dla administratora HHL nie mogła zadziałać. Przywracamy WYŁĄCZNIE odczyt;
-- zapis nadal tylko przez funkcje SECURITY DEFINER.
grant select on audit_log to authenticated;

-- ---------------------------------------------------------------------
-- 5. TERMINY PŁATNOŚCI PER RELACJA
-- ---------------------------------------------------------------------
create table payment_terms (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id),
  payer_org_id   uuid not null references organizations(id),
  payee_org_id   uuid not null references organizations(id),
  term_days      int  not null check (term_days between 0 and 180),
  basis          text not null default 'WYSTAWIENIE'
                 check (basis in ('WYSTAWIENIE','DORECZENIE')),
  reminder_cadence int[] not null default '{-3,0,1,7,14}',
  valid_from     date not null default current_date,
  unique (project_id, payer_org_id, payee_org_id, valid_from)
);
alter table payment_terms enable row level security;
create policy payment_terms_read on payment_terms for select to authenticated using (
  is_hhl() or payer_org_id = current_org_id() or payee_org_id = current_org_id()
);
create policy payment_terms_write on payment_terms for all to authenticated
  using (current_app_role() = 'HHL_ADMIN') with check (current_app_role() = 'HHL_ADMIN');

-- Aktualizacja stanu płatności — ZADANIE SYSTEMOWE, nie funkcja użytkownika.
-- Uruchamiane codziennie przez harmonogram z uprawnieniami systemowymi.
-- Użytkownicy NIE mogą jej wywołać: z parametrem daty ktoś mógłby podać
-- datę z przyszłości i oznaczyć wszystkie faktury jako przeterminowane.
-- Działa w obie strony: gdy termin zostanie przesunięty z dokumentu,
-- faktura wraca z PO_TERMINIE do NIEOPLACONA.
create or replace function refresh_payment_status(p_today date default current_date)
returns int language plpgsql as $$
declare n1 int; n2 int;
begin
  update invoices set payment_status = 'PO_TERMINIE'
   where payment_status = 'NIEOPLACONA' and due_date is not null and due_date < p_today;
  get diagnostics n1 = row_count;
  update invoices set payment_status = 'NIEOPLACONA'
   where payment_status = 'PO_TERMINIE' and (due_date is null or due_date >= p_today);
  get diagnostics n2 = row_count;
  return n1 + n2;
end $$;

revoke execute on function refresh_payment_status(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. USTAWIENIA UŻYTKOWNIKA — każdy ustawia swoje
-- ---------------------------------------------------------------------
create table user_preferences (
  user_id          uuid primary key references app_users(id) on delete cascade,
  display_currency char(3) not null default 'EUR' check (display_currency in ('EUR','PLN')),
  locale           char(2) not null default 'pl'  check (locale in ('pl','en','sv')),
  theme            text    check (theme in ('light','dark')),   -- null = domyślny dla roli
  updated_at       timestamptz not null default now()
);
alter table user_preferences enable row level security;
create policy user_prefs_own on user_preferences for all to authenticated
  using (user_id = (select id from app_users where auth_id = auth.uid()))
  with check (user_id = (select id from app_users where auth_id = auth.uid()));

-- Domyślna waluta faktury wystawcy (wybór per faktura przy rejestracji)
alter table organizations add column default_invoice_currency char(3)
  not null default 'EUR' check (default_invoice_currency in ('EUR','PLN'));
