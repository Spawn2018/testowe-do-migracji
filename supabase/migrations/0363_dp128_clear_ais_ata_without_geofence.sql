-- DP-128 (F7 #702): ręczna korekta ATA Viking XPRS HELA-TLL 01.11 —
-- actual_arrival_at z AIS bez przejścia przez geofence (pierwszy sygnał już w TLLA).
-- Status DOPLYNAL zostaje (rejs dopłynął; ATA niepewne — jak DOPLYNAL bez ATA).
-- Idempotentne: tylko gdy ATA = znany fałszywy znacznik AIS.

begin;

do $dp128$
declare
  v_id uuid := 'dd177080-621e-4322-8399-23b827a33e1b';
  v_ata timestamptz;
  v_status text;
  v_prev text;
begin
  select s.actual_arrival_at, s.status::text
    into v_ata, v_status
    from public.sailings s
   where s.id = v_id
     and s.route = 'HELA-TLL';

  if v_ata is null then
    return;
  end if;

  -- Tylko ten konkretny fałszywy znacznik AIS (ms); inna ATA = nie tykać.
  if v_ata is distinct from timestamptz '2026-11-01 12:18:52.731+00' then
    return;
  end if;

  v_prev := current_setting('tower.bulk_quiet', true);
  perform set_config('tower.bulk_quiet', 'on', true);

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'DP128_CLEAR_AIS_ATA',
    'sailings',
    v_id::text,
    jsonb_build_object(
      'route', 'HELA-TLL',
      'vessel', 'M/F Viking XPRS',
      'cleared_actual_arrival_at', v_ata,
      'status_before', v_status,
      'status_after', 'DOPLYNAL',
      'reason', 'AIS ATA bez przejścia geofence (DP-128)'
    )
  );

  update public.sailings
     set actual_arrival_at = null,
         status = 'DOPLYNAL',
         updated_at = now()
   where id = v_id
     and actual_arrival_at = timestamptz '2026-11-01 12:18:52.731+00';

  perform set_config('tower.bulk_quiet', coalesce(v_prev, ''), true);
end
$dp128$;

commit;
