-- =====================================================================
-- TOWER — Migracja 0077: I-22 (SCOPE 3.2) szablony mapowania kolumn importu harmonogramu (HHL)
--   import_column_templates: projekt, nazwa, mapowanie pole → nagłówek pliku, podpis układu nagłówków (posortowane,
--   znormalizowane nagłówki) — ten sam układ pliku rozpoznawany przy następnym imporcie bez pytania.
--   Odczyt: HHL (RLS). Zapis wyłącznie import_template_save (HHL, walidacja pól, wpis w audit_log).
--   Idempotentna.
-- =====================================================================
create table if not exists import_column_templates (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  name             text not null check (length(btrim(name)) between 1 and 80),
  column_map       jsonb not null,
  header_signature text not null check (length(header_signature) between 1 and 4000),
  created_by       uuid references app_users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (project_id, header_signature)
);
alter table import_column_templates enable row level security;
revoke all on import_column_templates from anon, authenticated;
grant select on import_column_templates to authenticated;
drop policy if exists import_column_templates_read on import_column_templates;
create policy import_column_templates_read on import_column_templates for select to authenticated using (is_hhl());

create or replace function import_template_save(p_project uuid, p_name text, p_map jsonb, p_signature text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_id uuid; k text;
  v_allowed constant text[] := array['shipmentCode', 'itemType', 'dimensions', 'unitWeight', 'qty', 'totalWeight', 'loadDate',
    'loadTime', 'driverName', 'driverPhone', 'orderNo', 'deliveryDate', 'deliveryTime', 'assemblySeq'];
begin
  if (is_hhl()) is not true then
    raise exception 'Szablon mapowania zapisuje wyłącznie HHL' using errcode = '42501';
  end if;
  if (jsonb_typeof(p_map) = 'object') is not true then raise exception 'Mapowanie musi być obiektem pole → nagłówek'; end if;
  for k in select jsonb_object_keys(p_map) loop
    if (k = any(v_allowed)) is not true then raise exception 'Nieznane pole mapowania: %', k; end if;
    if (jsonb_typeof(p_map -> k) = 'string' and length(btrim(p_map ->> k)) between 1 and 200) is not true then
      raise exception 'Pole % bez nagłówka pliku', k;
    end if;
  end loop;
  if (p_map ? 'shipmentCode' and p_map ? 'qty') is not true then
    raise exception 'Mapowanie wymaga co najmniej pól: kod wysyłki i ilość';
  end if;
  if (length(btrim(coalesce(p_signature, ''))) > 0 and length(btrim(coalesce(p_name, ''))) > 0) is not true then
    raise exception 'Brak nazwy albo podpisu układu kolumn';
  end if;
  if (exists (select 1 from projects where id = p_project)) is not true then raise exception 'Nieznany projekt'; end if;
  select id into v_user from app_users where auth_id = auth.uid() and active;
  insert into import_column_templates (project_id, name, column_map, header_signature, created_by)
  values (p_project, btrim(p_name), p_map, p_signature, v_user)
  on conflict (project_id, header_signature) do update
    set name = excluded.name, column_map = excluded.column_map, updated_at = now(), created_by = excluded.created_by
  returning id into v_id;
  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_user, 'IMPORT_TEMPLATE_SAVE', 'import_column_templates', v_id::text,
          jsonb_build_object('name', btrim(p_name), 'column_map', p_map));
  return v_id;
end $$;
revoke all on function import_template_save(uuid, text, jsonb, text) from public, anon;
grant execute on function import_template_save(uuid, text, jsonb, text) to authenticated;
