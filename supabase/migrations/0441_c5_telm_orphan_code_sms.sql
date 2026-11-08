-- C5 (D-20261015-0300-01): telm_scan_orphan_trailer_alerts
-- kod transportu w tytule / params = load_sms_code; bez fallbacku order_no / UUID.
-- Baza = 0329 (jedyna definicja); zmiana wyłącznie źródła kodu. Po 0440.

begin;

create or replace function public.telm_scan_orphan_trailer_alerts(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_code text;
  v_n int := 0;
  v_last timestamptz;
  v_tok text[];
begin
  -- Zamknij otwarte, gdy jest świeża pozycja.
  update risk_signals rs
     set resolved_at = p_now
   where rs.kind = 'EMTRACK_ORPHAN'
     and rs.resolved_at is null
     and exists (
       select 1 from positions p
        where p.load_id = rs.load_id and p.ts > p_now - interval '2 hours'
     );

  for r in
    select l.id, l.trailer_plate, l.telematics_vehicle_id, l.tracking_opened_at, l.plan_load_date,
           public.load_sms_code(l.id) as code
      from loads l
     where l.telematics_vehicle_id ~* 'emtrack\.eu'
       and coalesce(l.trailer_plate, '') <> ''
       and public.load_in_tracking_window(l.id, p_now)
  loop
    select max(p.ts) into v_last from positions p where p.load_id = r.id;
    if v_last is not null and v_last > p_now - interval '2 hours' then
      continue;
    end if;
    -- P4-perf: najpierw plate = any(tokeny); raw textId tylko gdy pierwszy nic nie znalazł.
    v_tok := public.telm_plate_tokens(r.trailer_plate);
    if (
      (cardinality(v_tok) > 0 and exists (
        select 1 from telematics_orphan_positions o
         where o.ts > p_now - interval '24 hours' and o.plate = any (v_tok)
      ))
      or exists (
        select 1 from telematics_orphan_positions o
         where o.ts > p_now - interval '24 hours'
           and public.telm_trailer_tokens_match(
             r.trailer_plate,
             coalesce(o.raw->>'textId', o.raw->>'text_id', '')
           )
      )
    ) is not true then
      continue;
    end if;
    v_code := coalesce(nullif(btrim(r.code), ''), 'transport');
    perform public.raise_risk(
      r.id,
      'EMTRACK_ORPHAN'::risk_kind,
      'MEDIUM'::risk_severity,
      format('Pozycje naczepy nie trafiają do transportu %s — sprawdź nr naczepy', v_code),
      jsonb_build_object(
        'title_key', 'rk_emtrack_orphan',
        'reason', 'EMTRACK_ORPHAN_MISMATCH',
        'last_pos', v_last,
        'code', v_code,
        'params', jsonb_build_object('code', v_code)
      ),
      'EMTRACK_ORPHAN:' || r.id::text
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

comment on function public.telm_scan_orphan_trailer_alerts(timestamptz) is
  '#622 F7 + C5 0441: EMTRACK_ORPHAN HHL; kod = load_sms_code; plate=any(tokeny) przed raw.';

revoke all on function public.telm_scan_orphan_trailer_alerts(timestamptz)
  from public, anon, authenticated;
grant execute on function public.telm_scan_orphan_trailer_alerts(timestamptz) to service_role;

commit;
