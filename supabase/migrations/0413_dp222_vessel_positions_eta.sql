-- DP-222 / #814 pkt 3: ETA na promie odświeża się przy nowym AIS (vessel_positions).
-- Dotąd refresh_load_eta tylko z load_events / positions / sailings / loads —
-- pierwszy STATUS_AUTO→FERRY zostawiał eta_site na zawsze (BS-03 @ 04.11 18:00Z).
-- F7 #819 B1: FOR EACH STATEMENT + NEW TABLE (wsady AIS) + throttle 5 min + rejs w toku.
select set_config('tower.audit_source', 'migracja 0413 (DP-222 vessel_positions → ETA)', true);

create or replace function public.trg_eta_after_vessel_position() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_vessel uuid;
  v_load uuid;
begin
  for v_vessel in
    select distinct vessel_id from new_rows where vessel_id is not null
  loop
    for v_load in
      select l.id
        from public.loads l
        join public.sailings s on s.id = l.sailing_id
       where s.vessel_id = v_vessel
         and (l.status = 'FERRY') is true
         and s.actual_arrival_at is null
         and (l.eta_computed_at is null
              or l.eta_computed_at < now() - interval '5 minutes')
    loop
      begin
        perform public.refresh_load_eta(v_load);
      exception when others then
        raise warning 'DP-222 refresh_load_eta(%): %', v_load, sqlerrm;
      end;
    end loop;
  end loop;
  return null;
end;
$$;

revoke all on function public.trg_eta_after_vessel_position() from public, anon, authenticated;
comment on function public.trg_eta_after_vessel_position() is
  'DP-222: po INSERT vessel_positions (STATEMENT) przelicz ETA FERRY na statkach z wsadu; max 1/5 min; tylko rejs bez ATA.';

drop trigger if exists trg_vessel_positions_eta on public.vessel_positions;
create trigger trg_vessel_positions_eta
  after insert on public.vessel_positions
  referencing new table as new_rows
  for each statement
  execute function public.trg_eta_after_vessel_position();
