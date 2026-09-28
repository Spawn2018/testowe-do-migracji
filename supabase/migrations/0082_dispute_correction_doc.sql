-- =====================================================================
-- 0082 — III-7 (luka UI): korekta faktury z załączonym dokumentem.
--   Do 0081 `invoice_dispute_reply(…, p_document)` zapisywał zdarzenie CORRECTION, ale dokument korekty
--   (kategoria INVOICE) widział wyłącznie autor — odbiorca faktury nie mógł go otworzyć (docs_scope / Storage).
--   1. invoice_documents.role: nowa rola KOREKTA; KSH widzi ją w module faktur (to korekta faktury HHL → KSH).
--   2. invoice_dispute_reply: dokument korekty musi być świeży (≤ 24 h), wgrany przez tę samą osobę,
--      niepowiązany z żadną fakturą; po zapisie łączony z fakturą jako KOREKTA → widoczny dla stron faktury.
--   Idempotentna.
-- =====================================================================
alter table invoice_documents drop constraint if exists invoice_documents_role_check;
alter table invoice_documents add constraint invoice_documents_role_check
  check (role in ('FAKTURA_PDF', 'CMR', 'POD', 'KOREKTA'));

drop policy if exists invoice_documents_ksh_scope on invoice_documents;
create policy invoice_documents_ksh_scope on invoice_documents as restrictive
  for select to authenticated using (
    current_org_kind() <> 'CLIENT' or role in ('FAKTURA_PDF', 'CMR', 'POD', 'KOREKTA')
  );

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
  if p_document is not null and (exists (
        select 1 from documents d
         where d.id = p_document and d.category = 'INVOICE' and d.load_id is null
           and d.project_id = inv.project_id and d.uploaded_by = v_user
           and d.uploaded_at > now() - interval '24 hours'
           and not exists (select 1 from invoice_documents x where x.document_id = d.id)
           and not exists (select 1 from invoices i where i.document_id = d.id))) is not true then
    raise exception 'Korekta: świeży plik faktury wgrany przez Ciebie w tym projekcie, niepowiązany z inną fakturą'
      using errcode = '22023';
  end if;
  v_kind := case when p_document is null then 'REPLY' else 'CORRECTION' end;
  insert into invoice_dispute_events (invoice_id, kind, status_to, note, document_id, actor_user, actor_org)
  values (inv.id, v_kind, inv.verification_status, btrim(p_note), p_document, v_user, v_org)
  returning id into v_ev;
  if p_document is not null then
    insert into invoice_documents (invoice_id, document_id, role) values (inv.id, p_document, 'KOREKTA')
    on conflict do nothing;
  end if;
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
