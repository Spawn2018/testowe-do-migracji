-- DP-222 / #814 pkt 3: ETA na promie odświeża się przy nowym AIS (vessel_positions).
-- Dotąd refresh_load_eta tylko z load_events / positions / sailings / loads —
-- pierwszy STATUS_AUTO→FERRY zostawiał eta_site na zawsze (BS-03 @ 04.11 18:00Z).
select set_config('tower.audit_source', 'migracja 0413 (DP-222 vessel_positions → ETA)', true);

create or replace function public.trg_eta_after_vessel_position() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_load uuid;
begin
  for v_load in
    select l.id
      from public.loads l
      join public.sailings s on s.id = l.sailing_id
     where s.vessel_id = new.vessel_id
       and (l.status = 'FERRY') is true
  loop
    begin
      perform public.refresh_load_eta(v_load);
    exception when others then
      raise warning 'DP-222 refresh_load_eta(%): %', v_load, sqlerrm;
    end;
  end loop;
  return null;
end;
$$;

revoke all on function public.trg_eta_after_vessel_position() from public, anon, authenticated;
comment on function public.trg_eta_after_vessel_position() is
  'DP-222: po INSERT vessel_positions przelicz ETA transportów FERRY na tym statku.';

drop trigger if exists trg_vessel_positions_eta on public.vessel_positions;
create trigger trg_vessel_positions_eta
  after insert on public.vessel_positions
  for each row execute function public.trg_eta_after_vessel_position();
