-- TOWER — dane startowe projektu Stegra Boden (produkcja).
-- Decyzje właściciela 24.09.2026: termin od WYSTAWIENIA faktury;
-- KSH płaci HHL w 30 dni, HHL płaci SCX w 35 dni.
-- Kraj SCX nie jest ustalony — pole zostaje z wartością domyślną do potwierdzenia.
insert into organizations (code, name, kind, default_invoice_currency) values
  ('HHL', 'H&H Logistics',        'FORWARDER', 'EUR'),
  ('KSH', 'KSH',                  'CLIENT',    'EUR'),
  ('SCX', 'Scandinavian Express', 'CARRIER',   'EUR')
on conflict (code) do nothing;

insert into projects (code, name, client_org_id)
select 'STEGRA_BODEN', 'Stegra Boden', id from organizations where code = 'KSH'
on conflict (code) do nothing;

-- faktury HHL → KSH: płaci KSH, 30 dni od wystawienia
insert into payment_terms (project_id, payer_org_id, payee_org_id, term_days, basis)
select p.id, payer.id, payee.id, 30, 'WYSTAWIENIE'
  from projects p, organizations payer, organizations payee
 where p.code = 'STEGRA_BODEN' and payer.code = 'KSH' and payee.code = 'HHL'
on conflict do nothing;

-- faktury SCX → HHL: płaci HHL, 35 dni od wystawienia
insert into payment_terms (project_id, payer_org_id, payee_org_id, term_days, basis)
select p.id, payer.id, payee.id, 35, 'WYSTAWIENIE'
  from projects p, organizations payer, organizations payee
 where p.code = 'STEGRA_BODEN' and payer.code = 'HHL' and payee.code = 'SCX'
on conflict do nothing;
