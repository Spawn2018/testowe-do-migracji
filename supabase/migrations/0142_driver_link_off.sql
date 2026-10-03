-- =====================================================================
-- TOWER — Migracja 0142: stary link kierowcy wyłączony (D-38)
--
-- Decyzja właściciela 2026-10-03 21:02 (czas warszawski):
-- aplikacja kierowcy jest ukryta. Na produkcji nie przyjmujemy pozycji
-- ze starego linku. Wszystkie aktywne tokeny są odwołane.
-- Wejście na link (instrukcje, pozycja, zdarzenie) kończy się odmową
-- „Link kierowcy jest nieaktywny”.
-- Ponowne włączenie tylko decyzją właściciela:
--   update security_flags set enabled = true where key = 'DRIVER_LINK_ACCEPT';
-- Brak przełącznika w aplikacji.
-- =====================================================================

alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in (
    'MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD', 'FUEL_WOB_INGEST',
    'SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER', 'DRIVER_LINK_ACCEPT'
  ));

insert into security_flags (key, enabled, note)
values (
  'DRIVER_LINK_ACCEPT', false,
  'D-38: stary link kierowcy. false = odmowa pozycji i wejścia. Włączenie tylko decyzją właściciela.'
)
on conflict (key) do update
  set enabled = false,
      note = excluded.note,
      updated_at = now();

create or replace function driver_token_load(p_token text, p_cost int default 1) returns uuid
language plpgsql security definer set search_path = public as $$
declare t driver_tokens%rowtype; v_status load_status; v_delivered timestamptz;
begin
  if coalesce((select enabled from security_flags where key = 'DRIVER_LINK_ACCEPT'), false) is not true then
    raise exception 'Link kierowcy jest nieaktywny';
  end if;
  select * into t from driver_tokens where token_hash = driver_token_hash(p_token) for update;
  if not found then raise exception 'Token kierowcy nieważny'; end if;
  if t.revoked_at is not null then raise exception 'Token kierowcy odwołany'; end if;
  if t.expires_at <= now() then raise exception 'Token kierowcy wygasł'; end if;
  select status, actual_delivery_at into v_status, v_delivered from loads where id = t.load_id;
  if v_status = 'CANCELLED' then raise exception 'Token kierowcy nieważny — transport anulowany'; end if;
  if v_delivered is not null and v_delivered + interval '24 hours' <= now() then
    raise exception 'Token kierowcy wygasł — ponad 24 h po rozładunku';
  end if;
  if p_cost > 0 then
    if t.window_start <= now() - interval '1 hour' then
      update driver_tokens set window_start = now(), window_count = p_cost, last_used_at = now() where id = t.id;
    elsif t.window_count + p_cost > 120 then
      raise exception 'Limit zapytań tokenu kierowcy: 120 na godzinę';
    else
      update driver_tokens set window_count = window_count + p_cost, last_used_at = now() where id = t.id;
    end if;
  end if;
  return t.load_id;
end $$;
revoke all on function driver_token_load(text, int) from public, anon, authenticated;

create or replace function public.issue_driver_token(p_load_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_load loads%rowtype; v_token text; v_user uuid;
begin
  select * into v_load from loads where id = p_load_id;
  if not found then raise exception 'Nieznany transport'; end if;
  if (is_hhl() or (current_org_kind() = 'CARRIER' and v_load.carrier_org_id = current_org_id())) is not true then
    raise exception 'Token kierowcy wydaje wyłącznie przewoźnik transportu albo HHL';
  end if;
  if coalesce((select enabled from security_flags where key = 'DRIVER_LINK_ACCEPT'), false) is not true then
    raise exception 'Link kierowcy jest nieaktywny';
  end if;
  if v_load.status = 'CANCELLED' then raise exception 'Transport anulowany — token niedostępny'; end if;
  if v_load.actual_delivery_at is not null and v_load.actual_delivery_at + interval '24 hours' <= now() then
    raise exception 'Ponad 24 h po rozładunku — token niedostępny';
  end if;
  select id into v_user from app_users where auth_id = auth.uid();
  update driver_tokens set revoked_at = now(), revoked_by = v_user
   where load_id = p_load_id and revoked_at is null;
  v_token := 'wt_' || encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex');
  insert into driver_tokens (load_id, token_hash, issued_by, expires_at)
  values (p_load_id, driver_token_hash(v_token), v_user,
          least(now() + interval '14 days',
                coalesce(v_load.actual_delivery_at + interval '24 hours', now() + interval '14 days')));
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'DRIVER_TOKEN_ISSUE', 'loads', p_load_id::text, jsonb_build_object('revoked_previous', true));
  return v_token;
end $$;
revoke all on function public.issue_driver_token(uuid) from public, anon;
grant execute on function public.issue_driver_token(uuid) to authenticated;

update driver_tokens
   set revoked_at = now()
 where revoked_at is null;
