-- =====================================================================
-- 0084 — I-27 (P1, przed R-3): brak zezwolenia blokuje „Gotowy” dla transportu klasy innej niż STANDARD.
--   Przełącznik: security_flags.PERMIT_REQUIRED_NON_STANDARD (domyślnie WYŁĄCZONY — produkcja nie ma
--   jeszcze zezwoleń w bazie). Włącza właściciel przed pierwszym prawdziwym transportem (PLAN D-21):
--   Opcje → „Wymóg zezwoleń” (HHL_ADMIN) albo admin_set_permit_requirement(true); wpis w audit_log.
--   Gdy włączony: transport, którego choć jedna pozycja ma klasę ≠ STANDARD (albo nie ma pozycji — klasa
--   nieznana), nie przejdzie z PLANNED / RESOURCES_PENDING / DOCS_PENDING do READY ani dalej bez
--   powiązanego zezwolenia PL i SE. Transport wyłącznie STANDARD przechodzi bez zezwolenia.
--   Niezgodne zezwolenie blokuje jak dotąd (0081), niezależnie od przełącznika.
--   Idempotentna.
-- =====================================================================
alter table security_flags drop constraint if exists security_flags_key_check;
alter table security_flags add constraint security_flags_key_check
  check (key in ('MFA_HHL_ADMIN', 'EXTERNAL_MESSAGING', 'PERMIT_REQUIRED_NON_STANDARD'));
insert into security_flags (key, enabled, note)
values ('PERMIT_REQUIRED_NON_STANDARD', false,
        'I-27: brak zezwolenia PL/SE blokuje Gotowy dla klas innych niż STANDARD — włączyć przed pierwszym prawdziwym transportem (D-21)')
on conflict (key) do nothing;

create or replace function permit_required_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from security_flags where key = 'PERMIT_REQUIRED_NON_STANDARD'), false)
$$;
revoke all on function permit_required_enabled() from public, anon, authenticated;

-- stan dla UI: HHL widzi (true/false), inni — odmowa
create or replace function permit_requirement_state() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if (is_hhl()) is not true then raise exception 'Stan wymogu zezwoleń widzi wyłącznie HHL' using errcode = '42501'; end if;
  return permit_required_enabled();
end $$;
revoke all on function permit_requirement_state() from public, anon;
grant execute on function permit_requirement_state() to authenticated;

create or replace function admin_set_permit_requirement(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_old boolean;
begin
  if (current_app_role() = 'HHL_ADMIN') is not true then
    raise exception 'Wymóg zezwoleń włącza wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_enabled is not null) is not true then raise exception 'Podaj true albo false' using errcode = '22023'; end if;
  select enabled into v_old from security_flags where key = 'PERMIT_REQUIRED_NON_STANDARD' for update;
  update security_flags set enabled = p_enabled, updated_at = now(), updated_by = current_app_user_id()
   where key = 'PERMIT_REQUIRED_NON_STANDARD';
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (current_app_user_id(), 'PERMIT_REQUIREMENT_SET', 'security_flags', 'PERMIT_REQUIRED_NON_STANDARD',
          jsonb_build_object('enabled', v_old), jsonb_build_object('enabled', p_enabled));
  return p_enabled;
end $$;
revoke all on function admin_set_permit_requirement(boolean) from public, anon;
grant execute on function admin_set_permit_requirement(boolean) to authenticated;

-- czy transport wymaga zezwolenia (klasa ≠ STANDARD albo brak pozycji)
create or replace function load_needs_permit(p_load uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from shipment_items si where si.load_id = p_load)
      or exists (select 1 from shipment_items si where si.load_id = p_load and si.cargo_class is distinct from 'STANDARD')
$$;
revoke all on function load_needs_permit(uuid) from public, anon, authenticated;

create or replace function trg_loads_permit_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bad text; v_missing text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'CANCELLED') then return new; end if;
  if old.status not in ('PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING') then return new; end if;
  select string_agg(distinct p.country || ' ' || p.permit_no || ': ' || array_to_string(f.breaches, ','), '; ')
    into v_bad
    from load_permits lp join permits p on p.id = lp.permit_id
    cross join lateral permit_fits(new.id, lp.permit_id) f
   where lp.load_id = new.id and f.ok is not true;
  if v_bad is not null then
    raise exception 'Zezwolenie niezgodne z zestawem — transport zablokowany (%)', v_bad using errcode = '23514';
  end if;
  -- I-27: brak zezwolenia (przełącznik)
  if permit_required_enabled() and load_needs_permit(new.id) then
    select string_agg(c, ', ' order by c) into v_missing
      from unnest(array['PL', 'SE']) c
     where not exists (select 1 from load_permits lp join permits p on p.id = lp.permit_id
                        where lp.load_id = new.id and p.country = c);
    if v_missing is not null then
      raise exception 'Brak zezwolenia (%) — transport ponadnormatywny nie może być „Gotowy”', v_missing using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function trg_loads_permit_gate() from public, anon, authenticated;
