-- 0063 — I-13 (właściciel 27.09.2026; obejmuje D-10): zakres wersji parametrów SEFS.
--   sefs_parameters.applies_to: COST (koszt — przewoźnik) | REVENUE (przychód — KSH) | BOTH (domyślnie).
--   Odczyt (RLS, tylko SELECT — zapis nadal wyłącznie RPC HHL):
--     HHL — wszystkie wersje;
--     przewoźnik — COST i BOTH, WYŁĄCZNIE agreed_with_carrier = true (D-10), tylko projekty, w których ma transport;
--     KSH — REVENUE i BOTH, tylko projekty, których jest klientem.
--   sefs_save_parameters przyjmuje p.applies_to (brak = BOTH; inna wartość = odmowa).
-- Idempotentna, niedestrukcyjna: ADD COLUMN IF NOT EXISTS (istniejące wersje = BOTH), CREATE OR REPLACE, DROP/CREATE POLICY.

alter table sefs_parameters add column if not exists applies_to text not null default 'BOTH';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sefs_parameters_applies_to_check') then
    alter table sefs_parameters add constraint sefs_parameters_applies_to_check check (applies_to in ('COST', 'REVENUE', 'BOTH'));
  end if;
end $$;

drop policy if exists sefs_parameters_read on sefs_parameters;
create policy sefs_parameters_read on sefs_parameters for select to authenticated using (
  is_hhl()
  or (current_org_kind() = 'CARRIER' and applies_to in ('COST', 'BOTH') and agreed_with_carrier
      and exists (select 1 from loads l where l.project_id = sefs_parameters.project_id and l.carrier_org_id = current_org_id()))
  or (current_org_kind() = 'CLIENT' and applies_to in ('REVENUE', 'BOTH')
      and exists (select 1 from projects p where p.id = sefs_parameters.project_id and p.client_org_id = current_org_id()))
);

create or replace function sefs_save_parameters(p_project uuid, p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_ver int; v_me uuid; v_applies text := coalesce(nullif(trim(p->>'applies_to'), ''), 'BOTH');
begin
  if (is_hhl()) is not true then
    raise exception 'Parametry SEFS zapisuje wyłącznie HHL';
  end if;
  if (sefs_tiers_valid(p->'tiers_sek') and sefs_tiers_valid(p->'tiers_pln')) is not true then
    raise exception 'Tablice mnożników: 1–200 progów {lte, mult}, lte rosnąco, mnożnik 0,5–2';
  end if;
  if (v_applies in ('COST', 'REVENUE', 'BOTH')) is not true then
    raise exception 'Zakres wersji: COST (koszt), REVENUE (przychód) albo BOTH';
  end if;
  select id into v_me from app_users where auth_id = auth.uid() and active;
  perform pg_advisory_xact_lock(hashtext('sefs_parameters:' || p_project::text));
  select coalesce(max(version), 0) + 1 into v_ver from sefs_parameters where project_id = p_project;
  insert into sefs_parameters (project_id, version, valid_from, base_sek, base_pln, index_sek, index_pln,
                               source_url_sek, source_url_pln, cycle, tiers_sek, tiers_pln,
                               agreed_with_carrier, agreement_ref, note, created_by, applies_to)
  values (p_project, v_ver, (p->>'valid_from')::date, (p->>'base_sek')::numeric, (p->>'base_pln')::numeric,
          p->>'index_sek', p->>'index_pln', p->>'source_url_sek', p->>'source_url_pln',
          coalesce(p->>'cycle', 'MONTHLY'), p->'tiers_sek', p->'tiers_pln',
          coalesce((p->>'agreed_with_carrier')::boolean, false), nullif(trim(p->>'agreement_ref'), ''),
          nullif(trim(p->>'note'), ''), v_me, v_applies);
  insert into audit_log (user_id, action, entity, entity_id, old_value, new_value)
  values (v_me, 'SEFS_PARAMS_VERSION', 'sefs_parameters', p_project::text || ':v' || v_ver,
          (select to_jsonb(x) - 'id' - 'created_at' - 'created_by' from sefs_parameters x
            where project_id = p_project and version = v_ver - 1),
          (select to_jsonb(x) - 'id' - 'created_at' - 'created_by' from sefs_parameters x
            where project_id = p_project and version = v_ver));
  return v_ver;
end $$;
revoke execute on function sefs_save_parameters(uuid, jsonb) from public, anon;
grant execute on function sefs_save_parameters(uuid, jsonb) to authenticated;
