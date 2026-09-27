-- =====================================================================
-- TOWER — Migracja 0072: I-20 (SCOPE 2.6) ogólny dziennik audytu tabel biznesowych
--   Wyzwalacz AFTER INSERT/UPDATE/DELETE na loads, shipment_items, invoices, invoice_lines, rate_cards, rate_rules,
--   sefs_parameters → audit_log (action ROW_INSERT / ROW_UPDATE / ROW_DELETE, entity = tabela, entity_id = id,
--   user_id = aktywny app_users wywołującego albo null = system/cron).
--   UPDATE: tylko zmienione kolumny (stara i nowa wartość); bez wiersza, gdy zmieniły się wyłącznie kolumny techniczne
--   (updated_at, eta_*, delay_minutes — przeliczenie ETA co kilka minut).
--   Dane osobowe (loads.driver_name, driver_phone) nie trafiają do dziennika: wartość zastępuje „[dane osobowe]”
--   (dziennik jest trwały, a te pola mają retencję 90 dni — purge_personal_data).
--   Odczyt jak dotąd: wyłącznie HHL_ADMIN (polityka audit_read). Idempotentna.
-- =====================================================================
create or replace function audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; o jsonb; n jsonb; k text;
  v_skip constant text[] := array['updated_at', 'eta_site', 'eta_confidence_min', 'eta_basis', 'eta_computed_at', 'delay_minutes'];
  v_pii  constant text[] := array['driver_name', 'driver_phone'];
  v_id text; v_user uuid;
begin
  o := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    v_old := '{}'; v_new := '{}';
    for k in select key from jsonb_each(n) loop
      if (n -> k) is distinct from (o -> k) and (k = any(v_skip)) is not true then
        v_old := v_old || jsonb_build_object(k, o -> k);
        v_new := v_new || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if v_new = '{}'::jsonb then return null; end if;
  else
    v_old := o; v_new := n;
  end if;
  foreach k in array v_pii loop
    if v_old ? k and jsonb_typeof(v_old -> k) <> 'null' then v_old := jsonb_set(v_old, array[k], '"[dane osobowe]"'); end if;
    if v_new ? k and jsonb_typeof(v_new -> k) <> 'null' then v_new := jsonb_set(v_new, array[k], '"[dane osobowe]"'); end if;
  end loop;
  v_id := coalesce(coalesce(n, o) ->> 'id',
                   (coalesce(n, o) ->> 'invoice_id') || ':' || (coalesce(n, o) ->> 'load_id'));
  select id into v_user from app_users where auth_id = auth.uid() and active;
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_user, 'ROW_' || tg_op, tg_table_name, v_id, v_old, v_new);
  return null;
end $$;
revoke all on function audit_row_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['loads', 'shipment_items', 'invoices', 'invoice_lines', 'rate_cards', 'rate_rules', 'sefs_parameters'] loop
    execute format('drop trigger if exists trg_audit_row on %I', t);
    execute format('create trigger trg_audit_row after insert or update or delete on %I for each row execute function audit_row_change()', t);
  end loop;
end $$;
