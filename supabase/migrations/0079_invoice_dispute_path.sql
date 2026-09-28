-- =====================================================================
-- TOWER — Migracja 0079: III-7 (SCOPE 7.10) pełna ścieżka sporu i akceptacji faktury
--   Dotąd: odbiorca ustawia SPORNA z uzasadnieniem / ZGODNA / ZAAKCEPTOWANA (0003, 0049), bez historii
--   i bez odpowiedzi wystawcy. Teraz:
--   1. invoice_dispute_events — historia sporu: OPENED (odbiorca), REPLY / CORRECTION (wystawca, korekta
--      z dokumentem faktury), RESOLVED (odbiorca: ZGODNA / ZAAKCEPTOWANA), WITHDRAWN (powrót do weryfikacji).
--      Odczyt: strony faktury i HHL (jak invoices_read). Zapis wyłącznie wyzwalaczem i RPC.
--   2. Wyzwalacz po zmianie verification_status: wpis historii + powiadomienie drugiej strony
--      (INVOICE_DISPUTED / INVOICE_DISPUTE_RESOLVED, dedup_key).
--   3. invoice_dispute_reply(faktura, treść, dokument?) — tylko wystawca, tylko faktura SPORNA; powiadomienie
--      odbiorcy (INVOICE_DISPUTE_REPLY), audit_log.
--   4. mark_invoice_paid: faktura kosztowa (HHL = odbiorca) w sporze — zapłata wstrzymana do rozstrzygnięcia.
--   Idempotentna.
-- =====================================================================
create table if not exists invoice_dispute_events (
  id          bigint generated always as identity primary key,
  invoice_id  uuid not null references invoices(id) on delete cascade,
  kind        text not null check (kind in ('OPENED', 'REPLY', 'CORRECTION', 'RESOLVED', 'WITHDRAWN')),
  status_to   text,
  note        text check (note is null or length(note) <= 2000),
  document_id uuid references documents(id) on delete set null,
  actor_user  uuid references app_users(id),
  actor_org   uuid references organizations(id),
  created_at  timestamptz not null default now()
);
create index if not exists invoice_dispute_events_invoice_idx on invoice_dispute_events (invoice_id, created_at);
alter table invoice_dispute_events enable row level security;
revoke all on invoice_dispute_events from anon, authenticated;
grant select on invoice_dispute_events to authenticated;
drop policy if exists invoice_dispute_events_read on invoice_dispute_events;
create policy invoice_dispute_events_read on invoice_dispute_events for select to authenticated
  using (exists (select 1 from invoices i where i.id = invoice_dispute_events.invoice_id));   -- RLS invoices_read

-- powiadomienie wszystkich aktywnych użytkowników organizacji (IN_APP, bez duplikatów)
create or replace function invoice_dispute_notify(p_org uuid, p_template text, p_inv invoices, p_event bigint, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (channel, recipient, user_id, template, payload, dedup_key)
  select 'IN_APP', coalesce(u.email::text, u.id::text), u.id, p_template,
         jsonb_build_object('invoice_id', p_inv.id, 'number', p_inv.invoice_number, 'note', left(coalesce(p_note, ''), 300),
                            'status', p_inv.verification_status, 'locale', u.locale),
         p_template || ':' || p_event || ':' || u.id
    from app_users u where u.org_id = p_org and u.active
  on conflict (dedup_key) where dedup_key is not null do nothing;
end $$;
revoke all on function invoice_dispute_notify(uuid, text, invoices, bigint, text) from public, anon, authenticated;

create or replace function invoices_dispute_track() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_kind text; v_ev bigint; v_user uuid := current_app_user_id(); v_org uuid := current_org_id();
begin
  if new.verification_status is not distinct from old.verification_status then return new; end if;
  v_kind := case
    when new.verification_status = 'SPORNA' then 'OPENED'
    when old.verification_status = 'SPORNA' and new.verification_status in ('ZGODNA', 'ZAAKCEPTOWANA') then 'RESOLVED'
    when old.verification_status = 'SPORNA' then 'WITHDRAWN'
    else null end;
  if v_kind is null then return new; end if;
  insert into invoice_dispute_events (invoice_id, kind, status_to, note, actor_user, actor_org)
  values (new.id, v_kind, new.verification_status, case when v_kind = 'OPENED' then new.dispute_note end, v_user, v_org)
  returning id into v_ev;
  if new.issuer_org_id is not null then
    perform invoice_dispute_notify(new.issuer_org_id,
      case v_kind when 'OPENED' then 'INVOICE_DISPUTED' else 'INVOICE_DISPUTE_RESOLVED' end,
      new, v_ev, case when v_kind = 'OPENED' then new.dispute_note end);
  end if;
  return new;
end $$;
revoke all on function invoices_dispute_track() from public, anon, authenticated;
drop trigger if exists trg_invoices_dispute_track on invoices;
create trigger trg_invoices_dispute_track after update of verification_status on invoices
  for each row execute function invoices_dispute_track();

create or replace function invoice_dispute_reply(p_invoice uuid, p_note text, p_document uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare inv invoices%rowtype; v_user uuid := current_app_user_id(); v_org uuid := current_org_id(); v_ev bigint; v_kind text;
begin
  if v_user is null or v_org is null then raise exception 'Brak aktywnego konta' using errcode = '42501'; end if;
  select * into inv from invoices where id = p_invoice;
  if (inv.id is not null and inv.issuer_org_id = v_org) is not true then
    raise exception 'Na spór odpowiada wyłącznie wystawca faktury' using errcode = '42501';
  end if;
  if inv.verification_status is distinct from 'SPORNA' then
    raise exception 'Faktura nie jest w sporze' using errcode = '22023';
  end if;
  if (length(btrim(coalesce(p_note, ''))) between 1 and 2000) is not true then
    raise exception 'Odpowiedź wymaga treści (1–2000 znaków)' using errcode = '22023';
  end if;
  if p_document is not null and (exists (select 1 from documents d where d.id = p_document and d.category = 'INVOICE'
        and d.project_id = inv.project_id and d.uploaded_by in (select id from app_users where org_id = v_org))) is not true then
    raise exception 'Korekta: dokument faktury wystawcy z tego projektu' using errcode = '22023';
  end if;
  v_kind := case when p_document is null then 'REPLY' else 'CORRECTION' end;
  insert into invoice_dispute_events (invoice_id, kind, status_to, note, document_id, actor_user, actor_org)
  values (inv.id, v_kind, inv.verification_status, btrim(p_note), p_document, v_user, v_org)
  returning id into v_ev;
  if inv.recipient_org_id is not null then
    perform invoice_dispute_notify(inv.recipient_org_id, 'INVOICE_DISPUTE_REPLY', inv, v_ev, btrim(p_note));
  end if;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'INVOICE_DISPUTE_' || v_kind, 'invoices', inv.id::text,
          jsonb_build_object('event', v_ev, 'note', btrim(p_note), 'document_id', p_document));
  return v_ev;
end $$;
revoke all on function invoice_dispute_reply(uuid, text, uuid) from public, anon;
grant execute on function invoice_dispute_reply(uuid, text, uuid) to authenticated;

create or replace function mark_invoice_paid(p_invoice uuid, p_paid_at date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if is_hhl() is not true then
    raise exception 'Status „Opłacona" może ustawić wyłącznie HHL';
  end if;
  -- III-7: faktura kosztowa (HHL płaci) w sporze — zapłata wstrzymana do rozstrzygnięcia
  if exists (select 1 from invoices i where i.id = p_invoice and i.verification_status = 'SPORNA'
               and i.recipient_org_id = current_org_id()) then
    raise exception 'Faktura w sporze — zapłata wstrzymana do rozstrzygnięcia' using errcode = '22023';
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
