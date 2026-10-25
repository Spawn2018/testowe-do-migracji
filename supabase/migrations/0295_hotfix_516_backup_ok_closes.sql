-- #516 / D-20261024-0755-01 — po OK kopii zamykaj decyzje „Kopia zapasowa nieudana”
-- i ryzyka backup-stale; ciche domknięcie otwartych (prod 23.10).
-- Numer 0295: 0292=#528, 0293=#530; B5 ≥0299 (nie 0294).
-- F7 #533: zamykaj tylko decyzje z backup_run_id < id przebiegu OK;
-- RISK_AUTO_CLOSED przy resolve backup-stale; komentarz backup_runs.files.

create or replace function public.backup_ok_close_failures()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_prev text;
  v_note text;
  v_now timestamptz := now();
  v_risk_id uuid;
begin
  if new.status is distinct from 'OK' then
    return new;
  end if;
  if old.status is not distinct from 'OK' then
    return new;
  end if;

  v_note := 'Kopia OK (przebieg id=' || new.id::text || ') — zamknięte automatycznie (#516)';
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select id
      from decisions
     where type_code = 'BACKUP_FAILED'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and (detail->>'backup_run_id') ~ '^[0-9]+$'
       and (detail->>'backup_run_id')::bigint < new.id
     for update
  loop
    update decisions
       set status = 'RESOLVED',
           resolution_code = 'AUTO_CLOSED',
           resolution_note = v_note,
           resolved_at = v_now,
           updated_at = v_now
     where id = r.id
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    if found then
      insert into decision_events (decision_id, actor_id, action, payload)
      values (
        r.id,
        null,
        'RESOLVE',
        jsonb_build_object(
          'option', 'AUTO_CLOSED',
          'effect', 'AUTO_CLOSED',
          'hotfix', '0295',
          'ok_run_id', new.id,
          'reason', v_note
        )
      );
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null,
        'DECISION_AUTO_CLOSED',
        'decisions',
        r.id::text,
        jsonb_build_object(
          'reason', v_note,
          'hotfix', '0295',
          'ok_run_id', new.id
        )
      );
    end if;
  end loop;

  for v_risk_id in
    select id
      from risk_signals
     where resolved_at is null
       and kind = 'JOB_FAILURE'
       and dedup_key like 'backup-stale:%'
  loop
    update risk_signals
       set resolved_at = v_now
     where id = v_risk_id
       and resolved_at is null;
    if found then
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null,
        'RISK_AUTO_CLOSED',
        'risk_signals',
        v_risk_id::text,
        jsonb_build_object(
          'reason', 'backup OK — backup-stale',
          'hotfix', '0295',
          'ok_run_id', new.id
        )
      );
    end if;
  end loop;

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  return new;
end;
$$;

comment on function public.backup_ok_close_failures() is
  '#516: status→OK → RESOLVED decyzji BACKUP_FAILED (run_id < OK) + resolve ryzyka backup-stale (cicho).';

revoke all on function public.backup_ok_close_failures()
  from public, anon, authenticated;

drop trigger if exists trg_backup_ok_close_failures on public.backup_runs;
create trigger trg_backup_ok_close_failures
  after update of status on public.backup_runs
  for each row
  execute function public.backup_ok_close_failures();

-- Licznik files = dokumenty/obiekty z kubełków + liczba części tabel w parts (Edge backup-export).
comment on column public.backup_runs.files is
  '#516: liczba plików w manifeście (dokumenty + obiekty) + liczba części tabel (parts); nie tylko documents.length.';

-- Ciche domknięcie otwartych „Kopia zapasowa nieudana” tylko gdy istnieje przebieg OK
-- nowszy niż backup_run_id decyzji (F7: nie zamykaj alarmu bieżącej awarii bez udanej kopii).
do $quiet$
declare
  r record;
  v_prev text;
  v_now timestamptz := now();
  v_n int := 0;
  v_max_ok bigint;
  v_note text := 'Zamknięte migracją 0295 (#516) — kopia działa; bez powiadomień';
  v_risk_id uuid;
begin
  select max(id) into v_max_ok from backup_runs where status = 'OK';
  if v_max_ok is null then
    raise notice '#516 / 0295: brak przebiegu OK — pomijam ciche zamknięcie';
    return;
  end if;

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select id
      from decisions
     where type_code = 'BACKUP_FAILED'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED')
       and (detail->>'backup_run_id') ~ '^[0-9]+$'
       and (detail->>'backup_run_id')::bigint < v_max_ok
  loop
    update decisions
       set status = 'RESOLVED',
           resolution_code = 'AUTO_CLOSED',
           resolution_note = v_note,
           resolved_at = v_now,
           updated_at = v_now
     where id = r.id
       and status in ('NEW', 'ASSIGNED', 'SNOOZED');
    if found then
      v_n := v_n + 1;
      insert into decision_events (decision_id, actor_id, action, payload)
      values (
        r.id,
        null,
        'RESOLVE',
        jsonb_build_object(
          'option', 'AUTO_CLOSED',
          'effect', 'AUTO_CLOSED',
          'hotfix', '0295',
          'migration_quiet', true,
          'max_ok_run_id', v_max_ok
        )
      );
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null,
        'DECISION_AUTO_CLOSED',
        'decisions',
        r.id::text,
        jsonb_build_object(
          'reason', v_note,
          'hotfix', '0295',
          'migration_quiet', true,
          'max_ok_run_id', v_max_ok
        )
      );
    end if;
  end loop;

  for v_risk_id in
    select id
      from risk_signals
     where resolved_at is null
       and kind = 'JOB_FAILURE'
       and dedup_key like 'backup-stale:%'
  loop
    update risk_signals
       set resolved_at = v_now
     where id = v_risk_id
       and resolved_at is null;
    if found then
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null,
        'RISK_AUTO_CLOSED',
        'risk_signals',
        v_risk_id::text,
        jsonb_build_object(
          'reason', 'migracja 0295 — backup-stale',
          'hotfix', '0295',
          'migration_quiet', true
        )
      );
    end if;
  end loop;

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  raise notice '#516 / 0295: cicho zamknięto % decyzji BACKUP_FAILED (max_ok=%)', v_n, v_max_ok;
end;
$quiet$;
