-- 0107 — DEC-6: progi i terminy (ops_thresholds) — edycja przez HHL_ADMIN z historią.
--   Wartości domyślne z DECYZJE §6. Odczyt dla authenticated (HHL); zapis tylko RPC.
--   Idempotentna.

create table if not exists public.ops_thresholds (
  key         text primary key
              check (key in (
                'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
                'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
                'SILENT_MIN','OFFROUTE_KM'
              )),
  value_num   numeric not null,
  unit        text not null,
  label_pl    text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.app_users(id)
);

alter table public.ops_thresholds enable row level security;
revoke all on table public.ops_thresholds from anon;
revoke insert, update, delete, truncate on table public.ops_thresholds from authenticated;
grant select on table public.ops_thresholds to authenticated;

drop policy if exists ops_thresholds_read on public.ops_thresholds;
create policy ops_thresholds_read on public.ops_thresholds for select to authenticated using (
  exists (
    select 1 from app_users u
    where u.auth_id = auth.uid() and u.active
      and u.role in ('HHL_ADMIN','HHL_OPS')
  )
);

insert into public.ops_thresholds (key, value_num, unit, label_pl) values
  ('WAVE_M',       3.8,  'm',   'Fala znacząca'),
  ('GUST_KN',       40,  'kn',  'Porywy wiatru'),
  ('DELAY_MIN',     30,  'min', 'Próg opóźnienia'),
  ('LEAD_DAYS',      5,  'd',   'Wyprzedzenie dat KSH'),
  ('AWIZ_EARLY_H',  48,  'h',   'Awizacja — ostrzeżenie'),
  ('AWIZ_LATE_H',   12,  'h',   'Awizacja — krytyczne'),
  ('DOC_WARN_H',    24,  'h',   'Dokumenty — ostrzeżenie'),
  ('DOC_CRIT_H',     6,  'h',   'Dokumenty — krytyczne'),
  ('SILENT_MIN',    15,  'min', 'Brak pozycji GPS'),
  ('OFFROUTE_KM',    2,  'km',  'Zjazd z trasy')
on conflict (key) do nothing;

create or replace function public.admin_ops_threshold_set(p_key text, p_value numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_role text;
  v_old numeric;
begin
  select id, role::text into v_me, v_role from app_users where auth_id = auth.uid() and active;
  if (v_me is not null and v_role = 'HHL_ADMIN') is not true then
    raise exception 'Progi — wyłącznie administrator HHL' using errcode = '42501';
  end if;
  if (p_key in (
    'WAVE_M','GUST_KN','DELAY_MIN','LEAD_DAYS',
    'AWIZ_EARLY_H','AWIZ_LATE_H','DOC_WARN_H','DOC_CRIT_H',
    'SILENT_MIN','OFFROUTE_KM'
  )) is not true then
    raise exception 'Nieznany próg' using errcode = '22023';
  end if;
  if (p_value is not null and p_value > 0) is not true then
    raise exception 'Wartość progu musi być > 0' using errcode = '22023';
  end if;

  select value_num into v_old from ops_thresholds where key = p_key for update;
  if (v_old is not null) is not true then
    raise exception 'Brak wiersza progu' using errcode = 'P0002';
  end if;

  update ops_thresholds
     set value_num = p_value, updated_at = now(), updated_by = v_me
   where key = p_key;

  insert into audit_log (user_id, action, entity, entity_id, new_value)
  values (v_me, 'OPS_THRESHOLD_SET', 'ops_thresholds', p_key,
          jsonb_build_object('from', v_old, 'to', p_value));
end $$;

revoke all on function public.admin_ops_threshold_set(text, numeric) from public, anon;
grant execute on function public.admin_ops_threshold_set(text, numeric) to authenticated;
