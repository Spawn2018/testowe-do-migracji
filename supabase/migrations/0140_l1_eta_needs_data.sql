-- =====================================================================
-- TOWER — Migracja 0140: L-1 — ETA po terminie tylko przy danych
--
-- Decyzja ETA_AFTER_LATEST nie otwiera się z samego planu.
-- Potrzebna jest pozycja GPS albo awizacja (status od READY wzwyż,
-- ta sama lista co import harmonogramu). Brak obu → bez decyzji.
-- Zamknięcie już otwartej decyzji zostaje (event_key).
-- =====================================================================

create or replace function public.trg_l1_risk_opens_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_key text;
  v_has_data boolean;
begin
  v_type := l1_decision_type(new.kind::text, coalesce(new.detail, '{}'::jsonb) || jsonb_build_object('title_key', new.title_key));
  if v_type is null then
    return new;
  end if;
  if v_type = 'ETA_AFTER_LATEST' then
    v_has_data := new.load_id is not null
      and (
        exists (select 1 from positions p where p.load_id = new.load_id)
        or exists (
          select 1 from loads l
           where l.id = new.load_id
             and l.status in (
               'READY','AT_LOADING','IN_TRANSIT_PL','AT_PORT_GDANSK',
               'FERRY','AT_PORT_NYNASHAMN','IN_TRANSIT_SE','AT_SITE'
             )
        )
      );
    if (v_has_data) is not true then
      return new;
    end if;
  end if;
  v_key := coalesce(nullif(btrim(new.dedup_key), ''), 'risk:' || new.id::text);
  perform decision_open_from_event(
    new.project_id, v_type, v_key, new.title, new.detail, new.load_id, new.id
  );
  return new;
end $$;
revoke all on function public.trg_l1_risk_opens_decision() from public, anon, authenticated;

comment on function public.trg_l1_risk_opens_decision() is
  'L-1: ryzyko z typem otwiera jedną decyzję. ETA_AFTER_LATEST wymaga pozycji albo awizacji.';
