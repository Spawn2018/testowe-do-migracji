-- =====================================================================
-- TOWER — Migracja 0027: odpowiedź właściciela §6.1 — przyczyna systemowa luk EXECUTE
--
--   Postgres nadaje prawo wywołania każdej nowej funkcji roli PUBLIC (a Supabase dodatkowo
--   anon/authenticated w schemacie public). Trzeci raz ta sama klasa luki (0003 terminy,
--   0017 process_position, 0025 purge_personal_data) — łatanie po jednej nie wystarcza.
--   1. ALTER DEFAULT PRIVILEGES: nowe funkcje w public bez EXECUTE dla PUBLIC, anon, authenticated.
--   2. Istniejące funkcje spoza jawnej listy (tests/db/function-allowlist.txt, lustro poniżej):
--      REVOKE od PUBLIC, anon, authenticated. Funkcje rozszerzeń (PostGIS, citext…) pominięte.
--   3. service_role: jawne GRANT na wszystkie funkcje public (funkcje Edge), jak domyślnie w Supabase.
--   Idempotentna, niedestrukcyjna (tylko uprawnienia). Wyzwalacze nie wymagają EXECUTE wywołującego.
-- =====================================================================

alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare
  v_anon text[] := array['can_see_margin', 'current_app_role', 'current_app_user_id', 'current_org_id', 'current_org_kind', 'driver_get_instructions', 'driver_post_event', 'driver_post_position', 'is_hhl', 'keep_alive'];
  v_auth text[] := array['admin_invite_user', 'admin_revoke_invite', 'admin_set_user_active', 'admin_set_user_role', 'can_see_margin', 'cancel_load', 'create_document', 'current_app_role', 'current_app_user_id', 'current_org_id', 'current_org_kind', 'discard_document', 'doc_bucket', 'doc_safe_name', 'driver_get_instructions', 'driver_post_event', 'driver_post_position', 'fx_rate_before', 'import_cancel_loads', 'import_removal_check', 'invoice_week_local', 'is_hhl', 'issue_driver_token', 'keep_alive', 'loaded_confirmed', 'make_circle_fence', 'mark_invoice_paid', 'mark_notifications_read', 'money_effective_eur', 'money_least_tier', 'my_profile', 'my_sessions', 'permit_fits', 'register_invoice', 'report_position', 'revoke_driver_token', 'revoke_user_sessions', 'risk_audience_for', 'storage_upload_allowed', 'unmark_invoice_paid', 'upsert_geofence_circle'];
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public', f.sig);
    if f.proname = any(v_anon) then execute format('grant execute on function %s to anon', f.sig);
    else execute format('revoke execute on function %s from anon', f.sig); end if;
    if f.proname = any(v_auth) then execute format('grant execute on function %s to authenticated', f.sig);
    else execute format('revoke execute on function %s from authenticated', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;
end $$;
