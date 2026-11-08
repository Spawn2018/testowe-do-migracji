-- DP-199 (decyzja 111): H-4 „odpoczynek po promie, zegar od zera” tylko gdy
-- przeprawa ≥ 9 h (D-9 = odpoczynek dobowy). Krótki prom bałtycki (TLL-HEL ~2 h)
-- przed/po promie — bez resetu zegara; kontynuacja stanu GPS + since_break_h=0
-- (prom ≥45 min = przerwa UE 561/2006 art. 7 — F7 #895).
-- Zmiana w compute_load_eta_core (0389 → rename 0398).

begin;

do $dp199$
declare
  v_def text;
  v_old text;
  v_new text;
  v_out text;
begin
  if to_regprocedure('public.compute_load_eta_core(uuid, timestamptz)') is null then
    raise exception 'DP-199 0442: brak compute_load_eta_core';
  end if;

  v_def := pg_get_functiondef('public.compute_load_eta_core(uuid, timestamptz)'::regprocedure);

  -- Idempotencja: już po DP-199.
  if position('DP-199 / F7 #895' in v_def) > 0
     or position('Krótki prom bałtycki (TLL-HEL ~2 h): driven/extended z GPS' in v_def) > 0 then
    return;
  end if;

  v_old := $o$
    -- H-4 po promie: zegar od zera (D-9 odpoczynek na promie)
    select * into sch from h4_schedule_remaining(h_road_eff, 0, 0, 0);
    v_drive_h := coalesce(v_drive_h, 0) + sch.drive_h;
    v_rest_h := coalesce(v_rest_h, 0) + sch.rest_h;
    v_break_h := coalesce(v_break_h, 0) + sch.break_h;
    v_eta := v_arr + make_interval(secs => (sch.total_h * 3600)::int);
    v_flags := array_append(v_flags, 'H-4 po promie — odpoczynek D-9, zegar od zera'::text);
$o$;

  v_new := $n$
    -- H-4 po promie: D-9 (zegar od zera) tylko gdy przeprawa ≥ 9 h (odpoczynek dobowy).
    -- Krótki prom bałtycki (TLL-HEL ~2 h): driven/extended z GPS, since_break_h=0
    -- (prom ≥45 min = przerwa UE 561/2006 art. 7 — DP-199 / F7 #895).
    -- Czas przeprawy: słownik (h_cross) albo okno rejsu v_arr−v_dep (gdy jest).
    if greatest(
         coalesce(h_cross, 0),
         coalesce(extract(epoch from (v_arr - v_dep)) / 3600.0, 0)
       ) >= 9 then
      select * into sch from h4_schedule_remaining(h_road_eff, 0, 0, 0);
      v_flags := array_append(v_flags, 'H-4 po promie — odpoczynek D-9, zegar od zera'::text);
    else
      select * into sch from h4_schedule_remaining(
        h_road_eff,
        coalesce(st.driven_today_h, 0),
        coalesce(st.extended_used, 0),
        0
      );
    end if;
    v_drive_h := coalesce(v_drive_h, 0) + sch.drive_h;
    v_rest_h := coalesce(v_rest_h, 0) + sch.rest_h;
    v_break_h := coalesce(v_break_h, 0) + sch.break_h;
    v_eta := v_arr + make_interval(secs => (sch.total_h * 3600)::int);
$n$;

  if position(v_old in v_def) = 0 then
    raise exception 'DP-199 0442: nie znaleziono bloku H-4 po promie w compute_load_eta_core';
  end if;

  v_out := replace(v_def, v_old, v_new);
  if position('DP-199 / F7 #895' in v_out) = 0 then
    raise exception 'DP-199 0442: podmiana H-4 nie weszła do definicji';
  end if;
  execute v_out;
end
$dp199$;

comment on function public.compute_load_eta_core(uuid, timestamptz) is
  'ETA rdzeń (0389+Z4); DP-199: H-4 reset po promie tylko gdy przeprawa≥9 h (nie TLL-HEL).';

commit;
