-- #516 / D-20261024-0755-01 — po OK kopii zamykaj decyzje „Kopia zapasowa nieudana”
-- i ryzyka backup-stale; ciche domknięcie otwartych (prod 23.10).
-- Numer 0295: 0292=#528, 0293=#530, 0294=B5 (równolegle / w kolejce).

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

  update risk_signals
     set resolved_at = v_now
   where resolved_at is null
     and kind = 'JOB_FAILURE'
     and dedup_key like 'backup-stale:%';

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  return new;
end;
$$;

comment on function public.backup_ok_close_failures() is
  '#516: status→OK → RESOLVED decyzji BACKUP_FAILED + resolve ryzyka backup-stale (cicho).';

revoke all on function public.backup_ok_close_failures()
  from public, anon, authenticated;

drop trigger if exists trg_backup_ok_close_failures on public.backup_runs;
create trigger trg_backup_ok_close_failures
  after update of status on public.backup_runs
  for each row
  execute function public.backup_ok_close_failures();

-- Ciche domknięcie otwartych „Kopia zapasowa nieudana” (prod: 3 z 23.10; TEST: 0+).
do $quiet$
declare
  r record;
  v_prev text;
  v_now timestamptz := now();
  v_n int := 0;
  v_note text := 'Zamknięte migracją 0295 (#516) — kopia działa; bez powiadomień';
begin
  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  for r in
    select id
      from decisions
     where type_code = 'BACKUP_FAILED'
       and status in ('NEW', 'ASSIGNED', 'SNOOZED')
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
          'migration_quiet', true
        )
      );
      insert into audit_log (user_id, action, entity, entity_id, new_value)
      values (
        null,
        'DECISION_AUTO_CLOSED',
        'decisions',
        r.id::text,
        jsonb_build_object('reason', v_note, 'hotfix', '0295', 'migration_quiet', true)
      );
    end if;
  end loop;

  update risk_signals
     set resolved_at = v_now
   where resolved_at is null
     and kind = 'JOB_FAILURE'
     and dedup_key like 'backup-stale:%';

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
  raise notice '#516 / 0295: cicho zamknięto % decyzji BACKUP_FAILED', v_n;
end;
$quiet$;
