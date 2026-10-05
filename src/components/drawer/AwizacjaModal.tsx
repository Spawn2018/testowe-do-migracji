/**
 * AWIZ-4 — okno awizacji „Dodaj” / „Edytuj” (PO_SPOTKANIU §4).
 * Nie przez zakładkę Ustalenia — osobny dialog nad panelem transportu.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { editableOrderSide } from '../../lib/orderNumbers';
import {
  awizacjaDuplicateWarning,
  FERRY_OPERATORS,
  hasAwizacja,
  reachableSailings,
  resourceSuggestions,
  type FerryOperatorId,
} from '../../lib/awizacjaState';
import { isPlausibleNational, toNationalPhone } from '../../lib/phoneNational';
import { effArrival, effDeparture, fmtLocal, sailingAssignDenied, sailingStatusLabel } from '../../lib/sailings';
import { getNowIso } from '../../lib/frozenNow';
import type { Load } from '../../types';

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

  const editing = hasAwizacja(load);
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
  const [bookingRef, setBookingRef] = useState(load.ferry.bookingRef ?? '');
  const [err, setErr] = useState<string | null>(null);

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

  const selected = sailingOptions.find((s) => s.id === sailingId) ?? curSailing;
  const vesselAuto = selected?.vessel ?? '—';

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
      const denied = assignSailing(load.id, sid, bookingRef.trim() || null);
      if (denied) {
        pushToast(t(locale, `sail_deny_${denied}`), 'HIGH', load.id);
        return;
      }
    }

    pushToast(t(locale, 'a6_ts_awiz_saved'), 'MEDIUM', load.id);
    onClose();
  };

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 52 }} aria-label={t(locale, 'a6_dr_close')} onClick={onClose} />
      <section
        className="panel awiz-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="awiz-title"
        data-awiz-modal
      >
        <header className="panel-hd">
          <h2 id="awiz-title" style={{ fontSize: 18 }}>
            {editing ? t(locale, 'awiz_edit') : t(locale, 'awiz_add')} · {load.code}
          </h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={onClose}>✕</button>
        </header>
        <div className="panel-bd awiz-modal-bd">
          {dupCode ? (
            <div className="banner amber" data-awiz-dup style={{ marginBottom: 12 }}>
              {t(locale, 'awiz_dup').replace('{code}', dupCode)}
            </div>
          ) : null}
          {err ? <div className="note" style={{ color: 'var(--red)', marginBottom: 10 }}>{err}</div> : null}

          <label className="form-field">
            <span>{t(locale, 'a6_dr_driver')}</span>
            <input className="input" list="awiz-drivers" value={driverName} onChange={(e) => setDriverName(e.target.value)} autoComplete="off" required />
            <datalist id="awiz-drivers">{driverHints.map((h) => <option key={h} value={h} />)}</datalist>
          </label>

          <label className="form-field">
            <span>{t(locale, 'a6_dr_phone')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="input" style={{ width: 72 }} value={phoneCountry === 'OTHER' ? 'PL' : phoneCountry} onChange={(e) => setPhoneCountry(e.target.value as 'PL' | 'SE')} aria-label={t(locale, 'awiz_phone_country')}>
                <option value="PL">PL</option>
                <option value="SE">SE</option>
              </select>
              <input className="input mono" style={{ flex: 1 }} type="tel" inputMode="numeric" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} onBlur={onPhoneBlur} placeholder="601234567" autoComplete="off" />
            </div>
            <small>{t(locale, 'awiz_phone_hint')}</small>
          </label>

          <label className="form-field">
            <span>{t(locale, 'a6_dr_tractor')}</span>
            <input className="input mono" list="awiz-tractors" value={tractorPlate} onChange={(e) => setTractorPlate(e.target.value)} autoComplete="off" required />
            <datalist id="awiz-tractors">{tractorHints.map((h) => <option key={h} value={h} />)}</datalist>
          </label>

          <label className="form-field">
            <span>{t(locale, 'a6_dr_trailer')}</span>
            <input className="input mono" list="awiz-trailers" value={trailerPlate} onChange={(e) => setTrailerPlate(e.target.value)} autoComplete="off" />
            <datalist id="awiz-trailers">{trailerHints.map((h) => <option key={h} value={h} />)}</datalist>
          </label>

          <label className="form-field" data-c-sep-swap style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={trailerSwap} onChange={(e) => setTrailerSwap(e.target.checked)} data-awiz-swap />
            <span>{t(locale, 'awiz_trailer_swap')}</span>
          </label>
          <small style={{ display: 'block', marginTop: -6, marginBottom: 8, color: 'var(--ink-3)' }}>{t(locale, 'awiz_trailer_swap_hint')}</small>

          {trailerSwap || driverDeliveryName || driverDeliveryPhone || tractorDeliveryPlate ? (
            <>
              <label className="form-field">
                <span>{t(locale, 'awiz_driver_delivery')}</span>
                <input className="input" value={driverDeliveryName} onChange={(e) => setDriverDeliveryName(e.target.value)} autoComplete="off" />
              </label>
              <label className="form-field">
                <span>{t(locale, 'awiz_phone_delivery')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="input" style={{ width: 72 }} value={deliveryPhoneCountry === 'OTHER' ? 'PL' : deliveryPhoneCountry} onChange={(e) => setDeliveryPhoneCountry(e.target.value as 'PL' | 'SE')}>
                    <option value="PL">PL</option>
                    <option value="SE">SE</option>
                  </select>
                  <input className="input mono" style={{ flex: 1 }} type="tel" inputMode="numeric" value={driverDeliveryPhone} onChange={(e) => setDriverDeliveryPhone(e.target.value)} placeholder="601234567" autoComplete="off" />
                </div>
              </label>
              <label className="form-field">
                <span>{t(locale, 'awiz_tractor_delivery')}</span>
                <input className="input mono" value={tractorDeliveryPlate} onChange={(e) => setTractorDeliveryPlate(e.target.value)} autoComplete="off" />
              </label>
            </>
          ) : null}

          <label className="form-field">
            <span>{t(locale, 'a6_dr_ord_scx')}</span>
            {orderSide === 'CARRIER' ? (
              <input className="input mono" value={carrierOrder} onChange={(e) => setCarrierOrder(e.target.value)} autoComplete="off" />
            ) : (
              <span className="mono">{load.carrierOrderNo || '—'}</span>
            )}
          </label>

          <label className="form-field">
            <span>{t(locale, 'a6_dr_ord_hhl')}</span>
            {orderSide === 'HHL' ? (
              <input className="input mono" value={hhlOrder} onChange={(e) => setHhlOrder(e.target.value)} autoComplete="off" />
            ) : (
              <span className="mono" data-hhl-ro>{load.hhlOrderNo || '—'}</span>
            )}
            {orderSide !== 'HHL' && load.hhlOrderNo ? <small>{t(locale, 'awiz_hhl_ro')}</small> : null}
          </label>

          <label className="form-field">
            <span>{t(locale, 'awiz_tracking')}</span>
            <input className="input" value={trackingRef} onChange={(e) => setTrackingRef(e.target.value)} placeholder={t(locale, 'awiz_tracking_ph')} autoComplete="off" />
          </label>

          <label className="form-field">
            <span>{t(locale, 'awiz_operator')}</span>
            <select className="input" value={operator} onChange={(e) => { setOperator(e.target.value as FerryOperatorId); setSailingId(''); }}>
              {FERRY_OPERATORS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>

          {sailingLock ? (
            <div className="note">{t(locale, `sail_deny_${sailingLock}`)}</div>
          ) : (
            <label className="form-field">
              <span>{t(locale, 'sail_label')}</span>
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

          <label className="form-field">
            <span>{t(locale, 'awiz_vessel')}</span>
            <span className="mono" data-awiz-vessel>{vesselAuto}</span>
            <small>{t(locale, 'awiz_vessel_auto')}</small>
          </label>

          <label className="form-field">
            <span>{t(locale, 'sail_booking')}</span>
            <input className="input mono" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} disabled={!!sailingLock} autoComplete="off" />
          </label>

          <div className="creator-actions">
            <button type="button" className="btn ghost" onClick={onClose}>{t(locale, 'a6_dr_close')}</button>
            <button type="button" className="btn" data-awiz-save onClick={save}>{t(locale, 'a6_dr_save')}</button>
          </div>
        </div>
      </section>
    </>
  );
}
