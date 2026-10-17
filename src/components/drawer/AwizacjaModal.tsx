/**
 * AWIZ-4 — okno awizacji „Dodaj” / „Edytuj” (PO_SPOTKANIU §4). Osobny dialog nad panelem transportu.
 * wyglad/P7-a — wygląd według E32 (img/e32-after „okno Awizacja”): nagłówek z nazwą i dniem załadunku, „Brakuje: …” z terminem
 * (jedna definicja kompletnej awizacji), odcinek kierowcy (przy przepięciu — odcinek PL i SE), naczepa na całą trasę,
 * link śledzenia (jak dziś, E44), armator i rejs (statek w nazwie rejsu), numery zleceń (HHL tylko do odczytu dla SCX, E41), piloci przy „PL + SE”
 * (D-20261009-1233-01: numer rejestracyjny, imię i nazwisko; konwój KR — D-20261009-1309-01 R1).
 * Zapis jak dotąd (zasoby, numer zlecenia, rejs); piloci — przez `savePilotsOf` (w produkcji do podłączenia).
 */
import { READY_PREP } from '../../lib/readyGaps';
import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { editableOrderSide } from '../../lib/orderNumbers';
import {
  awizacjaDuplicateWarning,
  FERRY_OPERATORS,
  reachableSailings,
  resourceSuggestions,
  type FerryOperatorId,
} from '../../lib/awizacjaState';
import { isPlausibleNational, toNationalPhone } from '../../lib/phoneNational';
import { effArrival, effDeparture, fmtLocal, sailingAssignDenied, sailingStatusLabel } from '../../lib/sailings';
import { getNowIso } from '../../lib/frozenNow';
import { trackingLinkOf } from '../../lib/p4cSource';
import { TrackingLinkField } from './TrackingLinkField';
import { awizDeadline, awizMissing, convoyOf, dayShort, dmHm, NO_PILOTS, pilotsMissingCount, type Pilots } from '../../lib/p7Awiz';
import { canFixAwizOf, pilotsOf, savePilotsOf, symbolSpecOf } from '../../lib/p7Source';
import { transportLabel } from '../../lib/transportName';
import { pt, ptp } from '../../i18n/p7';
import type { Load } from '../../types';
import './p7.css';


type Props = {
  load: Load;
  onClose: () => void;
};

export function AwizacjaModal({ load, onClose }: Props) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const sailings = useTowerStore((s) => s.sailings);
  const updateResources = useTowerStore((s) => s.updateResources);
  const setOrderNo = useTowerStore((s) => s.setOrderNo);
  const assignSailing = useTowerStore((s) => s.assignSailing);
  const pushToast = useTowerStore((s) => s.pushToast);

  const orderSide = editableOrderSide(role);
  const nowIso = getNowIso();
  const curSailing = sailings.find((x) => x.id === load.sailingId);
  const sailingLock = sailingAssignDenied(role, load, curSailing, null, nowIso);

  const [driverName, setDriverName] = useState(load.resources.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(load.resources.driverPhone ?? '');
  const [phoneCountry, setPhoneCountry] = useState<'PL' | 'SE' | 'OTHER'>(load.resources.driverPhoneCountry ?? 'PL');
  const [tractorPlate, setTractorPlate] = useState(load.resources.tractorPlate ?? '');
  const [trailerPlate, setTrailerPlate] = useState(load.resources.trailerPlate ?? '');
  const [trailerSwap, setTrailerSwap] = useState(!!load.resources.trailerSwap);
  const [driverDeliveryName, setDriverDeliveryName] = useState(load.resources.driverDeliveryName ?? '');
  const [driverDeliveryPhone, setDriverDeliveryPhone] = useState(load.resources.driverDeliveryPhone ?? '');
  const [deliveryPhoneCountry, setDeliveryPhoneCountry] = useState<'PL' | 'SE' | 'OTHER'>(load.resources.driverDeliveryPhoneCountry ?? 'PL');
  const [tractorDeliveryPlate, setTractorDeliveryPlate] = useState(load.resources.tractorDeliveryPlate ?? '');
  const [carrierOrder, setCarrierOrder] = useState(load.carrierOrderNo ?? '');
  const [hhlOrder, setHhlOrder] = useState(load.hhlOrderNo ?? '');
  const [trackingRef, setTrackingRef] = useState(load.resources.trackingRef ?? '');
  const [operator, setOperator] = useState<FerryOperatorId>('POLFERRIES');
  const [sailingId, setSailingId] = useState(load.sailingId ?? '');
  const [err, setErr] = useState<string | null>(null);
  /* piloci (D-20261009-1233-01) — tylko przy „PL + SE” w tabeli właściciela i gdy zapis jest podłączony */
  const spec = symbolSpecOf(load);
  const savePilots = savePilotsOf();
  const pilotsOn = !!spec?.pilots && !!savePilots;
  const [pil, setPil] = useState<Pilots>(() => {
    const p = pilotsOf(load) ?? NO_PILOTS;
    return { pl: { ...p.pl }, se: { ...p.se } };
  });
  /* konwój KR (D-20261009-1309-01 R1): KR z tą samą datą załadunku — ci sami piloci */
  const convoy = useMemo(() => convoyOf(load, loads, (l) => symbolSpecOf(l)?.symbol === 'KR'), [load, loads]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const sailingOptions = useMemo(
    () => reachableSailings(sailings, load, nowIso, operator),
    [sailings, load, nowIso, operator],
  );

  const dupCode = awizacjaDuplicateWarning(loads, load.id, { driverName, tractorPlate });

  const driverHints = resourceSuggestions(loads, 'driverName');
  const tractorHints = resourceSuggestions(loads, 'tractorPlate');
  const trailerHints = resourceSuggestions(loads, 'trailerPlate');

  const onPhoneBlur = () => {
    const n = toNationalPhone(driverPhone, phoneCountry);
    setDriverPhone(n.national);
    setPhoneCountry(n.country === 'OTHER' ? phoneCountry : n.country);
  };

  const save = () => {
    setErr(null);
    const name = driverName.trim();
    const plate = tractorPlate.trim().toUpperCase();
    if (!name) {
      setErr(t(locale, 'awiz_err_driver'));
      return;
    }
    if (!plate) {
      setErr(t(locale, 'awiz_err_tractor'));
      return;
    }
    onPhoneBlur();
    const phone = toNationalPhone(driverPhone, phoneCountry);
    if (phone.national && !isPlausibleNational(phone.national)) {
      setErr(t(locale, 'awiz_err_phone'));
      return;
    }

    const phone2 = toNationalPhone(driverDeliveryPhone, deliveryPhoneCountry);
    if (phone2.national && !isPlausibleNational(phone2.national)) {
      setErr(t(locale, 'awiz_err_phone'));
      return;
    }
    updateResources(load.id, {
      driverName: name,
      driverPhone: phone.national || null,
      driverPhoneCountry: phone.country === 'SE' ? 'SE' : 'PL',
      tractorPlate: plate,
      trailerPlate: trailerPlate.trim().toUpperCase() || null,
      trailerSwap,
      driverDeliveryName: driverDeliveryName.trim() || null,
      driverDeliveryPhone: phone2.national || null,
      driverDeliveryPhoneCountry: phone2.country === 'SE' ? 'SE' : 'PL',
      tractorDeliveryPlate: tractorDeliveryPlate.trim().toUpperCase() || null,
      trackingRef: trackingRef.trim() || null,
    });

    if (pilotsOn && savePilots) savePilots(convoy.length ? convoy.map((l) => l.code) : [load.code], pil);

    if (orderSide === 'CARRIER') {
      const v = carrierOrder.trim() || null;
      if (v !== (load.carrierOrderNo ?? null)) setOrderNo(load.id, 'CARRIER', v);
    }
    if (orderSide === 'HHL') {
      const v = hhlOrder.trim() || null;
      if (v !== (load.hhlOrderNo ?? null)) setOrderNo(load.id, 'HHL', v);
    }

    if (!sailingLock) {
      const sid = sailingId || null;
      const denied = assignSailing(load.id, sid, null); // B-10b: bez nr rezerwacji promu
      if (denied) {
        pushToast(t(locale, `sail_deny_${denied}`), 'HIGH', load.id);
        return;
      }
    }

    pushToast(t(locale, 'a6_ts_awiz_saved'), 'MEDIUM', load.id);
    onClose();
  };

  /* „Brakuje: …” z bieżących pól okna — ta sama definicja co w Przeglądzie (E32 pkt 6) */
  const missing = awizMissing(
    { driverName, driverPhone, tractorPlate, trailerPlate, trailerSwap, driverDeliveryName, driverDeliveryPhone, tractorDeliveryPlate },
    pilotsOn,
    pilotsOn ? pil : null,
  );
  const deadline = awizDeadline(load.plannedLoadDate, nowIso, load.planDates?.loadFrom ?? null);
  /* E6: odcinek SE tylko przy przepięciu naczepy */
  const twoSeg = trailerSwap;
  /* E32 pkt 6: SCX robi, HHL Administrator poprawia (canFixAwizOf), HHL Operacje i KSH tylko oglądają */
  const readOnly = role === 'KSH' || (role === 'HHL' && !canFixAwizOf(role));
  const missText = missing.map((m) => pt(locale, `p7_miss_${m}`)).join(', ');
  const pilotsMiss = pilotsMissingCount(missing);
  const setPilot = (side: 'pl' | 'se', key: 'plate' | 'name', v: string) => setPil((x) => ({ ...x, [side]: { ...x[side], [key]: v } }));

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 52 }} aria-label={t(locale, 'a6_dr_close')} onClick={onClose} />
      <section
        className="panel awiz-modal am"
        role="dialog"
        aria-modal="true"
        aria-labelledby="awiz-title"
        data-awiz-modal
      >
        <header className="panel-hd am-hd">
          <h2 id="awiz-title" className="am-title">
            {(() => {
              /* E41: nazwa transportu według firmy („SG-15 brak nr SCX” — brak na czerwono) */
              const label = transportLabel(load, role, 'panel');
              const m = / (brak nr (?:HHL|SCX))$/.exec(label);
              return m ? <>{ptp(locale, 'p7_m_title', { code: label.slice(0, m.index) })}<span className="am-miss"> {m[1]}</span></> : ptp(locale, 'p7_m_title', { code: label });
            })()}
            <span className="am-sub">{` ${ptp(locale, 'p7_m_load', { day: dayShort(load.plannedLoadDate) })}`}</span>
          </h2>
          <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={onClose}>✕</button>
        </header>
        <div className="panel-bd awiz-modal-bd am-bd">
          {missing.length ? (
            <div className="am-alert" data-awiz-missing={missing.length}>
              <b>{ptp(locale, 'p7_m_missing', { what: missText })}</b>
              {deadline ? ` ${ptp(locale, `${deadline.phase === 'urgent' ? 'p7_m_urgent' : 'p7_m_warn'}${deadline.byHour ? '_h' : ''}`, { at: dmHm(deadline.urgentAt), warn: dmHm(deadline.warnAt) })}` : null}
            </div>
          ) : (
            <div className="am-alert ok" data-awiz-missing={0}><b>{pt(locale, 'p7_m_complete')}</b>
              {/* F7 runda 2 (A9): rejs jest brakiem do „Gotowy” — uzupełnia się tutaj */}
              {!sailingId && READY_PREP.includes(load.status) ? <span data-awiz-nosail>{` ${pt(locale, 'p7_m_complete_nosail')}`}</span> : null}
            </div>
          )}
          {dupCode ? (
            <div className="banner amber" data-awiz-dup>
              {t(locale, 'awiz_dup').replace('{code}', dupCode)}
            </div>
          ) : null}
          {err ? <div className="am-err" role="alert">{err}</div> : null}

          {readOnly ? <p className="am-note" data-awiz-ro>{pt(locale, 'p7_m_ro')}</p> : null}
          <fieldset className="am-all" disabled={readOnly}>
          <fieldset className="am-box" data-awiz-seg={twoSeg ? 'PL' : 'one'}>
            <legend className="am-lg">{pt(locale, twoSeg ? 'p7_m_seg_pl' : 'p7_m_seg_one')}</legend>
            <label className="form-field am-f">
              <span>{pt(locale, 'p7_m_name')}</span>
              <input className={`input${driverName.trim() ? '' : ' am-need'}`} list="awiz-drivers" value={driverName} onChange={(e) => setDriverName(e.target.value)} autoComplete="off" required />
              <datalist id="awiz-drivers">{driverHints.map((h) => <option key={h} value={h} />)}</datalist>
            </label>
            <div className="am-2">
              <label className="form-field am-f">
                <span>{pt(locale, 'p7_m_phone')}</span>
                <div className="am-tel">
                  <select className="input" value={phoneCountry === 'OTHER' ? 'PL' : phoneCountry} onChange={(e) => setPhoneCountry(e.target.value as 'PL' | 'SE')} aria-label={t(locale, 'awiz_phone_country')}>
                    <option value="PL">PL</option>
                    <option value="SE">SE</option>
                  </select>
                  <input className={`input mono${driverPhone.trim() ? '' : ' am-need'}`} type="tel" inputMode="numeric" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} onBlur={onPhoneBlur} placeholder="601234567" autoComplete="off" />
                </div>
              </label>
              <label className="form-field am-f">
                <span>{pt(locale, 'p7_m_tractor')}</span>
                <input className={`input mono${tractorPlate.trim() ? '' : ' am-need'}`} list="awiz-tractors" value={tractorPlate} onChange={(e) => setTractorPlate(e.target.value)} autoComplete="off" required />
                <datalist id="awiz-tractors">{tractorHints.map((h) => <option key={h} value={h} />)}</datalist>
              </label>
            </div>
          </fieldset>

          <label className="form-field am-f">
            <span>{pt(locale, 'p7_m_trailer')}</span>
            <input className={`input mono${trailerPlate.trim() ? '' : ' am-need'}`} list="awiz-trailers" value={trailerPlate} onChange={(e) => setTrailerPlate(e.target.value)} autoComplete="off" />
            <datalist id="awiz-trailers">{trailerHints.map((h) => <option key={h} value={h} />)}</datalist>
          </label>

          <label className="am-check" data-c-sep-swap>
            <input type="checkbox" checked={trailerSwap} onChange={(e) => setTrailerSwap(e.target.checked)} data-awiz-swap />
            <span>{pt(locale, 'p7_m_swap')}</span>
            <small>{` — ${pt(locale, 'p7_m_swap_hint')}`}</small>
          </label>

          {twoSeg ? (
            <fieldset className="am-box" data-awiz-seg="SE">
              <legend className="am-lg">{pt(locale, 'p7_m_seg_se')}</legend>
              <label className="form-field am-f">
                <span>{pt(locale, 'p7_m_name')}</span>
                <input className={`input${driverDeliveryName.trim() ? '' : ' am-need'}`} value={driverDeliveryName} onChange={(e) => setDriverDeliveryName(e.target.value)} autoComplete="off" />
              </label>
              <div className="am-2">
                <label className="form-field am-f">
                  <span>{pt(locale, 'p7_m_phone')}</span>
                  <div className="am-tel">
                    <select className="input" value={deliveryPhoneCountry === 'OTHER' ? 'PL' : deliveryPhoneCountry} onChange={(e) => setDeliveryPhoneCountry(e.target.value as 'PL' | 'SE')} aria-label={t(locale, 'awiz_phone_country')}>
                      <option value="PL">PL</option>
                      <option value="SE">SE</option>
                    </select>
                    <input className={`input mono${driverDeliveryPhone.trim() ? '' : ' am-need'}`} type="tel" inputMode="numeric" value={driverDeliveryPhone} onChange={(e) => setDriverDeliveryPhone(e.target.value)} placeholder="701234567" autoComplete="off" />
                  </div>
                </label>
                <label className="form-field am-f">
                  <span>{pt(locale, 'p7_m_tractor')}</span>
                  <input className={`input mono${tractorDeliveryPlate.trim() ? '' : ' am-need'}`} value={tractorDeliveryPlate} onChange={(e) => setTractorDeliveryPlate(e.target.value)} autoComplete="off" />
                </label>
              </div>
            </fieldset>
          ) : null}

          {/* wyglad/P4-c (E44): pole „Link śledzenia” — zapisany link RIO bez klucza, wynik zapytania testowego, ostrzeżenia */}
          <TrackingLinkField
            upper
            value={trackingRef}
            onChange={setTrackingRef}
            savedRef={load.resources.trackingRef}
            info={trackingLinkOf(load, loads, nowIso)}
            load={load}
            locale={locale}
            nowIso={nowIso}
            onOpenRio={import.meta.env.VITE_AUTH_MODE !== 'supabase'
              ? () => pushToast(t(locale, 'p4c_tl_open_demo'), 'LOW', load.id)
              : async () => {
                try {
                  const { getSupabase } = await import('../../auth/client');
                  const sb = await getSupabase();
                  const { data, error } = await sb.rpc('rio_tracking_open', { p_load_id: load.id });
                  if (error || !data) {
                    pushToast(error?.message ?? t(locale, 'p4c_tl_open_fail'), 'HIGH', load.id);
                    return;
                  }
                  window.open(String(data), '_blank', 'noopener,noreferrer');
                } catch (e) {
                  pushToast(e instanceof Error ? e.message : t(locale, 'p4c_tl_open_fail'), 'HIGH', load.id);
                }
              }}
          />

          <div className="am-2">
            <label className="form-field am-f">
              <span>{pt(locale, 'p7_m_operator')}</span>
              <select className="input" value={operator} onChange={(e) => { setOperator(e.target.value as FerryOperatorId); setSailingId(''); }}>
                {FERRY_OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            {sailingLock ? (
              <div className="note am-lock" data-sailing-locked>{t(locale, `sail_deny_${sailingLock}`)}</div>
            ) : (
              <label className="form-field am-f">
                <span>{pt(locale, 'p7_m_sailing')}</span>
                <select className="input" value={sailingId} onChange={(e) => setSailingId(e.target.value)} data-awiz-sailing>
                  <option value="">{t(locale, 'sail_none')}</option>
                  {sailingOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.vessel} · {fmtLocal(effDeparture(o))} → {fmtLocal(effArrival(o))}
                      {o.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(o.status, locale)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {role !== 'KSH' ? (
            <div className="am-2">
              <label className="form-field am-f">
                <span>{pt(locale, 'p7_m_scx_no')}</span>
                {orderSide === 'CARRIER' ? (
                  <input className={`input mono${carrierOrder.trim() ? '' : ' am-need'}`} value={carrierOrder} onChange={(e) => setCarrierOrder(e.target.value)} autoComplete="off" />
                ) : (
                  <span className="am-ro mono">{load.carrierOrderNo || '—'}</span>
                )}
              </label>
              <label className="form-field am-f">
                <span>{pt(locale, 'p7_m_hhl_no')}</span>
                {orderSide === 'HHL' ? (
                  <input className="input mono" value={hhlOrder} onChange={(e) => setHhlOrder(e.target.value)} autoComplete="off" data-awiz-hhl-order />
                ) : (
                  <span className="am-ro mono" data-hhl-ro>{load.hhlOrderNo || pt(locale, 'p7_m_hhl_ro')}</span>
                )}
              </label>
            </div>
          ) : null}

          {pilotsOn && spec ? (
            <section className="am-pilots" data-awiz-pilots aria-labelledby="awiz-pilots-h">
              <div className="am-pilots-hd">
                <h3 id="awiz-pilots-h" className="am-pilots-t">{pt(locale, 'p7_m_pilots_h')}</h3>
                {pilotsMiss ? <span className="po-pill amber">{pilotsMiss === 1 ? pt(locale, 'p7_m_pilots_missing_1') : ptp(locale, 'p7_m_pilots_missing', { n: pilotsMiss })}</span> : null}
              </div>
              <p className="am-lead">
                {ptp(locale, 'p7_m_pilots_lead', {
                  kind: spec.kind,
                  set: `${spec.set.l.toLocaleString('pl-PL')} × ${spec.set.w.toLocaleString('pl-PL')} × ${spec.set.h.toLocaleString('pl-PL')} m`,
                  day: dayShort(load.plannedLoadDate),
                })}
              </p>
              {convoy.length ? (
                <p className="am-convoy" data-awiz-convoy={convoy.length}>
                  {ptp(locale, 'p7_m_convoy', { day: dayShort(load.plannedLoadDate), codes: convoy.map((l) => transportLabel(l, role)).join(', ') })}
                </p>
              ) : null}
              {(['pl', 'se'] as const).map((side) => (
                <fieldset key={side} className="am-box" data-awiz-pilot={side}>
                  <legend className="am-lg">{pt(locale, side === 'pl' ? 'p7_m_pilot_pl' : 'p7_m_pilot_se')}</legend>
                  <div className="am-2">
                    <label className="form-field am-f">
                      <span>{pt(locale, 'p7_m_plate')}</span>
                      <input className={`input mono${(pil[side].plate ?? '').trim() ? '' : ' am-need'}`} value={pil[side].plate ?? ''} onChange={(e) => setPilot(side, 'plate', e.target.value)} autoComplete="off" />
                    </label>
                    <label className="form-field am-f">
                      <span>{pt(locale, 'p7_m_pilot_name')}</span>
                      <input className={`input${(pil[side].name ?? '').trim() ? '' : ' am-need'}`} value={pil[side].name ?? ''} onChange={(e) => setPilot(side, 'name', e.target.value)} autoComplete="off" />
                    </label>
                  </div>
                </fieldset>
              ))}
              <p className="am-note">{pt(locale, 'p7_m_pilots_note')}</p>
            </section>
          ) : null}

          </fieldset>

          <div className="am-foot">
            <p className="am-note">{pt(locale, 'p7_m_foot')}</p>
            <div className="am-btns">
              <button type="button" className="btn ghost" onClick={onClose}>{pt(locale, readOnly ? 'p7_m_close' : 'p7_m_cancel')}</button>
              {readOnly ? null : <button type="button" className="btn" data-awiz-save onClick={save}>{pt(locale, 'p7_m_save')}</button>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
