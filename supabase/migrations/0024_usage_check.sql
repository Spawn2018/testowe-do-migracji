-- =====================================================================
-- TOWER — Migracja 0024: ANEKS 4 PR4 — codzienna kontrola limitów planu darmowego
--
--   usage_history: historia pomiarów (trend, nie tylko stan) — DB_BYTES, STORAGE_BYTES,
--     EDGE_INVOCATIONS, EGRESS_BYTES; procent liczony w bazie.
--   usage_measure(): zajętość bazy (pg_database_size) i plików (storage.objects.metadata.size),
--     wywołania funkcji Edge w bieżącym miesiącu wg integration_runs (przybliżenie).
--   record_usage(metric, used, quota): zapis + próg: ≥ 70% → ryzyko USAGE_LIMIT (MEDIUM) dla HHL;
--     ≥ 85% → ryzyko HIGH i e-mail (flaga email = true tylko przy pierwszym przekroczeniu 85%,
--     bez codziennego powtarzania); poniżej 70% → otwarte ryzyko tej metryki zamykane.
--   Wyłącznie service_role (funkcja Edge usage-check). HHL czyta historię.
--   Idempotentna, niedestrukcyjna.
-- =====================================================================

alter type risk_kind add value if not exists 'USAGE_LIMIT';

create table if not exists usage_history (
  id          bigserial primary key,
  measured_at timestamptz not null default now(),
  metric      text not null check (metric in ('DB_BYTES', 'STORAGE_BYTES', 'EDGE_INVOCATIONS', 'EGRESS_BYTES')),
  used        bigint not null check (used >= 0),
  quota       bigint not null check (quota > 0),
  pct         numeric(7,2) generated always as (round(used * 100.0 / quota, 2)) stored,
  level       text not null check (level in ('OK', 'WARN', 'HIGH'))
);
create index if not exists usage_history_metric_idx on usage_history (metric, measured_at desc);
alter table usage_history enable row level security;
revoke all on usage_history from anon, authenticated;
grant select on usage_history to authenticated;
drop policy if exists usage_history_read_hhl on usage_history;
create policy usage_history_read_hhl on usage_history for select to authenticated using (is_hhl());

create or replace function usage_metric_label(p_metric text) returns text language sql immutable as $$
  select case p_metric
    when 'DB_BYTES' then 'baza danych'
    when 'STORAGE_BYTES' then 'pliki'
    when 'EDGE_INVOCATIONS' then 'wywołania funkcji Edge (miesiąc)'
    when 'EGRESS_BYTES' then 'transfer (miesiąc)'
    else p_metric end
$$;

create or replace function usage_measure() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_storage bigint := 0; v_edge bigint := 0;
begin
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(sum((metadata->>''size'')::bigint), 0) from storage.objects' into v_storage;
  end if;
  select count(*) into v_edge from integration_runs where ran_at >= date_trunc('month', now());
  return jsonb_build_object('db_bytes', pg_database_size(current_database()),
                            'storage_bytes', v_storage, 'edge_invocations_approx', v_edge);
end $$;

create or replace function record_usage(p_metric text, p_used bigint, p_quota bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pct numeric; v_level text; v_sev risk_severity; v_prev_high boolean; v_email boolean := false;
  v_title text; v_proj record; v_key text; v_detail jsonb;
begin
  if p_quota is null or p_quota <= 0 then raise exception 'record_usage: limit musi być dodatni'; end if;
  v_pct := round(p_used * 100.0 / p_quota, 2);
  v_level := case when v_pct >= 85 then 'HIGH' when v_pct >= 70 then 'WARN' else 'OK' end;
  insert into usage_history (metric, used, quota, level) values (p_metric, p_used, p_quota, v_level);

  select exists (select 1 from risk_signals where kind = 'USAGE_LIMIT' and resolved_at is null
                  and severity = 'HIGH' and detail->>'metric' = p_metric) into v_prev_high;

  if v_level = 'OK' then
    update risk_signals set resolved_at = now()
     where kind = 'USAGE_LIMIT' and resolved_at is null and detail->>'metric' = p_metric;
    return jsonb_build_object('metric', p_metric, 'pct', v_pct, 'level', v_level, 'email', false);
  end if;

  v_sev := case v_level when 'HIGH' then 'HIGH' else 'MEDIUM' end::risk_severity;
  v_title := 'Limit planu darmowego: ' || usage_metric_label(p_metric) || ' ' ||
             replace(to_char(v_pct, 'FM990.0'), '.', ',') || '%' ||
             case v_level when 'HIGH' then ' — przekroczone 85%' else ' — przekroczone 70%' end;
  v_detail := jsonb_build_object('metric', p_metric, 'used', p_used, 'quota', p_quota, 'pct', v_pct,
    'text', 'Zajęte ' || p_used || ' z ' || p_quota || ' (' || usage_metric_label(p_metric) || ')',
    'next_action', case p_metric when 'STORAGE_BYTES' then 'Uruchom archiwizację plików (ANEKS 4 PR7) albo podnieś plan'
                                 else 'Sprawdź zużycie w panelu Supabase i trend w usage_history' end);
  for v_proj in select id from projects loop
    v_key := 'usage:' || p_metric || ':' || v_proj.id;
    update risk_signals set severity = v_sev, title = v_title,
           detail = v_detail,
           detected_at = case when severity <> v_sev then now() else detected_at end
     where dedup_key = v_key and resolved_at is null;
    if not found then
      insert into risk_signals (project_id, kind, severity, title, detail, dedup_key)
      values (v_proj.id, 'USAGE_LIMIT', v_sev, v_title, v_detail, v_key);
    end if;
  end loop;
  v_email := v_level = 'HIGH' and not v_prev_high;
  return jsonb_build_object('metric', p_metric, 'pct', v_pct, 'level', v_level, 'email', v_email, 'title', v_title);
end $$;

revoke all on function usage_measure() from public, anon, authenticated;
revoke all on function record_usage(text, bigint, bigint) from public, anon, authenticated;
grant execute on function usage_measure() to service_role;
grant execute on function record_usage(text, bigint, bigint) to service_role;
