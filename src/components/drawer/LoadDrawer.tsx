import { Fragment, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { StatusPill } from '../ui/StatusPill';
import { fmtNum, fmtNumKeepPl, fmtPct, t, tp } from '../../i18n/messages';
import { canEditResources, canSeeCost, canSeeMargin, canSeeRevenue, visibleDriverPhone } from '../../lib/permissions';
import { SITES } from '../../lib/status';
import { SEFS_SOURCES } from '../../lib/sefs';
import { isReadyBlocked, evaluateLoadCover } from '../../lib/permits';
import { downloadDocumentsZip } from '../../lib/zipDocs';
import { attachDocumentFile } from '../../lib/docFiles';
import { awizacjaChanges } from '../../lib/awizacjaPatch';
import { editableOrderSide } from '../../lib/orderNumbers';
import { DocPreview } from '../ui/DocPreview';
import { DocFileRow } from '../ui/DocFileRow';
import {
  TZ_LOAD_PL,
  TZ_UNLOAD_SE,
  formatEtaBoden,
  formatLoadPl,
  formatUnloadSe,
  isoToDatetimeLocalValue,
  wallLocalToIso,
} from '../../lib/time';
import { formatAppMoney } from '../../lib/money/demoFx';
import { formatDelayPill } from '../ui/StatusPill';
import { delayMinutesVsPlan } from '../../lib/time';
import {
  etaConfidenceLabel,
  eventTypeLabel,
  ferryStatusLabel,
  readyGateReasonLabel,
} from '../../lib/enumLabels';

import { TIER_PILL, type MoneySideV2 } from '../../lib/money/loadMoney';
import { autoStatusText, effArrival, effDeparture, fmtLocal, sailingAssignDenied, sailingStatusLabel, selectableSailings } from '../../lib/sailings';
import { getNowIso } from '../../lib/frozenNow';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { isServerId } from '../../data/registry';
import { DriverLinkPanel } from './DriverLinkPanel';
import type { Locale } from '../../types';

/** M8 — poziom, mnożnik paliwowy z datą i kurs strony wyceny. */
function MoneySideMeta({ side, locale, which }: { side: MoneySideV2; locale: Locale; which: 'cost' | 'rev' }) {
  return (
    <div data-money-side={which}>
      <div className="mrow">
        <span className="lbl">{t(locale, 'tier_label')}</span>
        <span><span className={`pill ${TIER_PILL[side.tier]}`} data-tier={side.tier}>{t(locale, `tier_${side.tier}`)}</span></span>
      </div>
      <div className="mrow">
        <span className="lbl">{t(locale, 'fuel_mult')}</span>
        <span className="mono" data-fuel-ref={side.fuel.refDate}>×{side.fuel.applied.toFixed(4)} · {t(locale, 'fuel_ref')} {side.fuel.refDate}</span>
      </div>
      <div className="mrow">
        <span className="lbl">{t(locale, 'fx_table')}</span>
        <span className="mono">
          {side.fx.tableNo} · {side.fx.mid.toFixed(4)} · {side.fx.date}
          {side.fx.provisional ? <> <span className="pill p-amber" data-fx-provisional>{t(locale, 'fx_provisional')}</span></> : null}
        </span>
      </div>
    </div>
  );
}

type Tab = 'overview' | 'timeline' | 'docs' | 'pricing' | 'chat';

/** A6-T3 — wymiary/masa w języku interfejsu (PL bez zmian: 16,50). */
function fmtDim(n: number, locale: Locale = 'pl'): string {
  return fmtNum(locale, n, 2);
}

/** M5 — numer zlecenia: pole edycji tylko dla strony, która go nadaje; pozostali widzą tekst. */
function OrderNoField({ value, editable, onSave }: { value?: string | null; editable: boolean; onSave: (v: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const locale = useTowerStore((s) => s.locale);
  if (!editable) {
    return value ? <span className="mono">{value}</span> : <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_dr_not_filled')}</span>;
  }
  return (
    <form
      style={{ display: 'flex', gap: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        if ((draft.trim() || null) !== (value ?? null)) onSave(draft.trim() || null);
      }}
    >
      <input className="input mono" style={{ width: '60%' }} value={draft} placeholder={t(locale, 'a6_dr_not_filled')} onChange={(e) => setDraft(e.target.value)} aria-label={t(locale, 'a6_dr_order_no')} />
      <button type="submit" className="btn ghost">{t(locale, 'a6_dr_save')}</button>
    </form>
  );
}

export function LoadDrawer() {
  const id = useTowerStore((s) => s.selectedLoadId);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const loads = useTowerStore((s) => s.loads);
  const events = useTowerStore((s) => s.events);
  const documents = useTowerStore((s) => s.documents);
  const messages = useTowerStore((s) => s.messages);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const role = useTowerStore((s) => s.role);
  const updateResources = useTowerStore((s) => s.updateResources);
  const updateAwizacja = useTowerStore((s) => s.updateAwizacja);
  const assignSailing = useTowerStore((s) => s.assignSailing);
  const sailings = useTowerStore((s) => s.sailings);
  const setLoadStatus = useTowerStore((s) => s.setLoadStatus);
  const assignScx = useTowerStore((s) => s.assignScx);
  const triggerGeofence = useTowerStore((s) => s.triggerGeofence);
  const geofences = useTowerStore((s) => s.geofences);
  const sendMessage = useTowerStore((s) => s.sendMessage);
  const setOrderNo = useTowerStore((s) => s.setOrderNo);
  const pushToast = useTowerStore((s) => s.pushToast);

  const [tab, setTab] = useState<Tab>('overview');
  const [chat, setChat] = useState('');
  const [previewDoc, setPreviewDoc] = useState<import('../../types').Document | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadCat, setUploadCat] = useState<import('../../types').Document['category'] | null>(null);

  const load = loads.find((l) => l.id === id);
  const loadEvents = useMemo(
    () => (load ? events.filter((e) => e.loadId === load.id).sort((a, b) => (a.at < b.at ? 1 : -1)) : []),
    [events, load],
  );
  const loadDocs = useMemo(
    () => (load ? documents.filter((d) => d.loadId === load.id) : []),
    [documents, load],
  );
  const loadMsgs = useMemo(
    () => (load ? messages.filter((m) => m.loadId === load.id) : []),
    [messages, load],
  );

  if (!load) return null;
  const driverPhone = visibleDriverPhone(role, load);

  const showCost = canSeeCost(role);
  const showRev = canSeeRevenue(role);
  const showMargin = canSeeMargin(role);
  const canEdit = canEditResources(role);
  const orderSide = editableOrderSide(role);
  /* AN2 — okna planowe zmienia wyłącznie HHL (plan z harmonogramu KSH); przewoźnik widzi je jako tekst */
  const planEditable = role === 'HHL';
  /* M10 — rejs z rozkładu; przewoźnik po wypłynięciu nie zmienia (lustro wyzwalacza 0008) */
  const nowIso = getNowIso();
  const curSailing = sailings.find((x) => x.id === load.sailingId);
  const sailingLock = sailingAssignDenied(role, load, curSailing, null, nowIso);
  const sailingOptions = selectableSailings(sailings, nowIso, load.sailingId);
  const sailingText = curSailing
    ? `${curSailing.vessel} · ${fmtLocal(effDeparture(curSailing))} → ${fmtLocal(effArrival(curSailing))}${curSailing.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(curSailing.status, locale)}` : ''}`
    : `${load.ferry.vessel ? `${load.ferry.vessel} · ` : ''}${t(locale, 'sail_unassigned')}`;
  const readyGate = isReadyBlocked(load, loadDocs);
  const permitBlock = readyGate.blocked;
  const coverInfo = evaluateLoadCover(load, loadDocs);
  const readyUiBlocked = permitBlock || !coverInfo.covered || load.docMissing || load.permitFits === false;
  const comboL = load.resources.setLengthM ?? load.dims.lengthM;
  const comboW = load.resources.setWidthM ?? load.dims.widthM;
  const comboH = load.resources.setHeightM ?? load.dims.heightM;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t(locale, 'tab_overview') },
    { id: 'timeline', label: t(locale, 'tab_timeline') },
    { id: 'docs', label: t(locale, 'tab_docs') },
    { id: 'pricing', label: t(locale, 'tab_pricing') },
    { id: 'chat', label: t(locale, 'tab_chat') },
  ];

  return (
    <>
      <button type="button" className="scrim" aria-label={t(locale, 'a6_dr_close')} onClick={() => selectLoad(null)} />
      <aside className="drawer" role="dialog" aria-label={load.code}>
        <div className="drawer-hd">
          <div className="r1">
            <span className="wb-code" data-content>{load.code}</span>
            <StatusPill status={load.status} stage={load.stage} />
            {load.delayed ? <span className="pill p-red">{formatDelayPill(delayMinutesVsPlan(load.etaBoden, load.plannedDeliverDate) ?? 95)}</span> : null}
            <div className="spacer" />
            <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={() => selectLoad(null)}>
              ✕
            </button>
          </div>
          <div className="wb-fields">
            <span>
              <b>{t(locale, 'a6_dr_order')}</b>
              <em>{load.permit?.pozycja || `HHL/2026/${1240 + load.sequenceOrder}`}</em>
            </span>
            <span>
              <b>{t(locale, 'a6_dr_sender')}</b>
              <em>{SITES.loading.name}</em>
            </span>
            <span>
              <b>{t(locale, 'a6_dr_consignee')}</b>
              <em>{t(locale, 'a6_dr_consignee_val')}</em>
            </span>
            <span>
              <b>{t(locale, 'a6_dr_week')}</b>
              <em>
                {tp(locale, 'a6_dr_week_val', { n: String((() => {
                  const d = new Date(load.plannedDeliverDate);
                  if (Number.isNaN(d.getTime())) return '—';
                  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                  const day = tmp.getUTCDay() || 7;
                  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
                  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
                  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                })()) })}
              </em>
            </span>
          </div>
          <div className="perf" />
        </div>

        <div className="dtabs">
          {tabs.map((x) => (
              <button key={x.id} type="button" onClick={() => setTab(x.id)} aria-selected={tab === x.id}>
                {x.label}
              </button>
            ))}
        </div>

        <div className="dbody">
          {tab === 'overview' && (
            <>
              <dl className="kv">
                <dt>{t(locale, 'a6_dr_type')}</dt>
                <dd>
                  <span data-content>{load.itemType}</span>{tp(locale, 'a6_dr_qty', { n: String(load.qty) })}
                </dd>
                <dt>{t(locale, 'a6_dr_dims')}</dt>
                <dd>
                  {fmtDim(load.dims.lengthM, locale)} × {fmtDim(load.dims.widthM, locale)} × {fmtDim(load.dims.heightM, locale)} m
                </dd>
                <dt>{t(locale, 'a6_dr_combo_dims')}</dt>
                <dd>
                  {comboL > 16.5 || comboW > 2.55 ? (
                    <span className="board" title={t(locale, 'a6_dr_oversize')} />
                  ) : null}
                  {fmtDim(comboL, locale)} × {fmtDim(comboW, locale)} × {fmtDim(comboH, locale)} m
                </dd>
                <dt>{t(locale, 'a6_dr_mass')}</dt>
                <dd>
                  {fmtDim(load.dims.weightT, locale)} t ({load.qty} ×{' '}
                  {fmtDim(load.dims.weightT / Math.max(1, load.qty), locale)} t)
                </dd>
                {/* M5 — trzy numery zleceń (W12): KSH z importu, HHL i przewoźnik — każda strona edytuje wyłącznie swój */}
                <dt>{t(locale, 'a6_dr_ord_ksh')}</dt>
                <dd className="mono" data-order="ksh">{load.orderNo || '—'}</dd>
                <dt>{t(locale, 'a6_dr_ord_hhl')}</dt>
                <dd data-order="hhl">
                  <OrderNoField key={`hhl-${load.id}`} value={load.hhlOrderNo} editable={orderSide === 'HHL'} onSave={(v) => setOrderNo(load.id, 'HHL', v)} />
                </dd>
                <dt>{t(locale, 'a6_dr_ord_scx')}</dt>
                <dd data-order="scx">
                  <OrderNoField key={`scx-${load.id}`} value={load.carrierOrderNo} editable={orderSide === 'CARRIER'} onSave={(v) => setOrderNo(load.id, 'CARRIER', v)} />
                </dd>
                <dt>{t(locale, 'a6_dr_assembly')}</dt>
                <dd>{tp(locale, 'a6_dr_assembly_pos', { n: String(load.sequenceOrder) })}</dd>
                <dt>{t(locale, 'a6_dr_load_place')}</dt>
                <dd>{SITES.loading.name}</dd>
                <dt>{t(locale, 'a6_dr_loading')}</dt>
                <dd className="cond">{formatLoadPl(load.plannedLoadDate)}</dd>
                <dt>{t(locale, 'a6_dr_delivery')}</dt>
                <dd className="cond">{formatUnloadSe(load.plannedDeliverDate)}</dd>
                <dt>{t(locale, 'eta')}</dt>
                <dd className="cond">
                  {formatEtaBoden(load.etaBoden)}{' '}
                  {load.delayed ? (
                    <span className="pill p-red">{formatDelayPill(delayMinutesVsPlan(load.etaBoden, load.plannedDeliverDate) ?? 95)}</span>
                  ) : (
                    <span className="pill p-go">{t(locale, 'a6_dr_in_window')}</span>
                  )}
                  {' '}
                  <span
                    className={`pill ${
                      load.etaConfidence === 'LOW'
                        ? 'p-red'
                        : load.etaConfidence === 'HIGH'
                          ? 'p-go'
                          : 'p-amber'
                    }`}
                  >
                    {etaConfidenceLabel(load.etaConfidence, locale)}
                  </span>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4, fontWeight: 400 }}>
                    {tp(locale, 'a6_dr_band', { a: fmtNumKeepPl(locale, load.etaEarliestHours, 1, load.etaEarliestHours.toFixed(1)), b: fmtNumKeepPl(locale, load.etaLatestHours, 1, load.etaLatestHours.toFixed(1)) })}
                    {load.etaReasons?.length ? ` · ${load.etaReasons.slice(0, 3).join(' · ')}` : ''}
                  </div>
                </dd>
                <dt>{t(locale, 'a6_dr_driver')}</dt>
                <dd>
                  {load.resources.driverName ? (
                    <span data-content>{load.resources.driverName}</span>
                  ) : (
                    <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_dr_not_filled')}</span>
                  )}
                </dd>
                <dt>{t(locale, 'a6_dr_phone')}</dt>
                <dd>
                  {driverPhone ? (
                    <a href={`tel:${driverPhone}`} className="mono" data-content>
                      {driverPhone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>{t(locale, 'a6_dr_tractor_trailer')}</dt>
                <dd>
                  {load.resources.tractorPlate ? (
                    <>
                      <span className="mono">{load.resources.tractorPlate}</span>
                      {' / '}
                      <span className="mono">{load.resources.trailerPlate ?? '—'}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>{t(locale, 'a6_dr_escort')}</dt>
                <dd>
                  {load.resources.escort
                    ? load.resources.escortPlate
                      ? tp(locale, 'a6_dr_escort_one_plate', { plate: load.resources.escortPlate })
                      : t(locale, 'a6_dr_escort_one')
                    : t(locale, 'a6_dr_escort_none')}
                </dd>
                <dt>{t(locale, 'a6_dr_ferry')}</dt>
                <dd>
                  {load.ferry.vessel
                    ? `${load.ferry.vessel}${load.ferry.bookingRef ? ` · ${load.ferry.bookingRef}` : ''}`
                    : t(locale, 'a6_dr_no_booking')}
                </dd>
              </dl>

              {readyUiBlocked ? (
                <div className="banner red" style={{ margin: '13px 0 0' }}>
                  <b>{t(locale, 'a6_dr_permit_missing_b')}</b> {tp(locale, 'a6_dr_permit_missing', { l: fmtDim(comboL, locale) })}
                </div>
              ) : (
                <div
                  className="banner"
                  style={{ margin: '13px 0 0', background: 'var(--go-bg)', borderLeftColor: 'var(--go)' }}
                >
                  <b>{t(locale, 'a6_dr_permit_ok_b')}</b> {tp(locale, 'a6_dr_permit_ok', { n: String(1400 + load.sequenceOrder) })}
                </div>
              )}
            </>
          )}

          {tab === 'timeline' && (
            <ul className="tl">
              {loadEvents.length === 0 ? (
                <li className="future">
                  <span className="mk" />
                  <div className="w">{t(locale, 'a6_dr_no_events')}</div>
                  <div className="ts">—</div>
                </li>
              ) : (
                loadEvents.map((e) => (
                  <li key={e.id}>
                    <span className="mk" />
                    <div className="w">
                      {e.type === 'STATUS_AUTO' ? (
                        <span data-tl-auto>
                          <span className="pill p-sea">{t(locale, 'tl_auto')}</span> {autoStatusText(e.payload) ?? ''}
                        </span>
                      ) : (
                        <>
                          {eventTypeLabel(e.type, locale)}
                          {e.note ? ` · ${e.note}` : ''}
                        </>
                      )}
                    </div>
                    <div className="ts">
                      {e.actor} · {e.at}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {tab === 'docs' && (
            <>
              {loadDocs.map((d) => (
                <DocFileRow
                  key={d.id}
                  doc={d}
                  onPreview={setPreviewDoc}
                  showUpload={canEdit && role !== 'KSH'}
                  onUploadClick={() => {
                    setUploadCat(d.category);
                    fileRef.current?.click();
                  }}
                />
              ))}
              <div style={{ marginTop: 13 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    void downloadDocumentsZip(loadDocs, `${load.code}_dokumenty.zip`).then((r) => {
                      useTowerStore.getState().pushToast(
                        tp(locale, 'a6_dr_zip_toast', { code: load.code, n: String(r.count) }),
                        'MEDIUM',
                        load.id,
                      );
                    });
                  }}
                >
                  {t(locale, 'a6_dr_zip_btn')}
                </button>
                {role !== 'KSH' ? (
                  <button
                    type="button"
                    className="btn"
                    style={{ marginLeft: 7 }}
                    onClick={() => {
                      const missing = loadDocs.find((d) => d.status === 'MISSING');
                      setUploadCat(missing?.category ?? 'CMR');
                      fileRef.current?.click();
                    }}
                  >
                    {t(locale, 'a6_dr_upload')}
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="sronly"
                  aria-label={t(locale, 'a6_dr_pick_file')}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    const cat = uploadCat ?? loadDocs.find((d) => d.status === 'MISSING')?.category ?? 'CMR';
                    // BK4: tryb Supabase → Storage; demo → pamięć sesji.
                    void attachDocumentFile(f, load.id, cat, { fallbackName: `${cat}_${load.code}.pdf` });
                  }}
                />
              </div>
            </>
          )}

          {tab === 'pricing' && (
            <>
              {load.pricing.moneyError ? (
                <div className="note" data-money-error style={{ margin: '0 0 12px', color: 'var(--red)' }}>
                  {t(locale, 'money_error')}: {load.pricing.moneyError}
                </div>
              ) : null}
              {showCost ? (
                <>
                  <h4 className="sec">{t(locale, 'cost')} — Scandinavian Express</h4>
                  <div className="mrow">
                    <span className="lbl">{t(locale, 'a6_dr_base_rate')}</span>
                    <span>{formatAppMoney(load.pricing.costBase, locale, currency)}</span>
                  </div>
                  <div className="mrow">
                    <span className="lbl">{t(locale, 'a6_dr_fuel')}</span>
                    <span>{formatAppMoney(load.pricing.costSefs, locale, currency)}</span>
                  </div>
                  <div className="mrow">
                    <span className="lbl">{t(locale, 'a6_dr_extras')}</span>
                    <span>{formatAppMoney(load.pricing.costExtras, locale, currency)}</span>
                  </div>
                  <div className="mrow total">
                    <span>{t(locale, 'a6_dr_total')}</span>
                    <span>{formatAppMoney(load.pricing.costTotal, locale, currency)}</span>
                  </div>
                  {load.pricing.money ? <MoneySideMeta side={load.pricing.money.cost} locale={locale} which="cost" /> : null}
                </>
              ) : (
                <div className="locked">{t(locale, 'no_price')}</div>
              )}
              {showRev ? (
                <>
                  <h4 className="sec" style={{ marginTop: 15 }}>
                    {t(locale, 'revenue')} — KSH
                  </h4>
                  <div className="mrow">
                    <span className="lbl">{t(locale, 'a6_dr_base_rate')}</span>
                    <span>{formatAppMoney(load.pricing.revBase, locale, currency)}</span>
                  </div>
                  <div className="mrow">
                    <span className="lbl">{t(locale, 'a6_dr_fuel')}</span>
                    <span>{formatAppMoney(load.pricing.revSefs, locale, currency)}</span>
                  </div>
                  <div className="mrow total">
                    <span>{t(locale, 'a6_dr_total')}</span>
                    <span>{formatAppMoney(load.pricing.revTotal, locale, currency)}</span>
                  </div>
                  {load.pricing.money ? <MoneySideMeta side={load.pricing.money.rev} locale={locale} which="rev" /> : null}
                </>
              ) : (
                <div className="locked" style={{ marginTop: 13 }}>
                  {t(locale, 'no_price')}
                </div>
              )}
              {showMargin ? (
                <div className="mrow total" style={{ marginTop: 15, borderTop: '2px solid var(--ink)' }}>
                  <span>{t(locale, 'margin')}</span>
                  <span style={{ color: load.pricing.marginPct < 0.18 ? 'var(--red)' : 'var(--go)' }}>
                    {formatAppMoney(load.pricing.margin, locale, currency)} · {locale === 'pl' ? `${(load.pricing.marginPct * 100).toFixed(1)}%` : fmtPct(locale, load.pricing.marginPct)}
                  </span>
                </div>
              ) : null}
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>
                <a href={SEFS_SOURCES.orlen} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                  ORLEN
                </a>
                {' · '}
                <a href={SEFS_SOURCES.okq8} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                  OKQ8
                </a>
              </div>
            </>
          )}

          {tab === 'chat' && (
            <>
              {!canEdit && (
                <>
                  <div className="note" style={{ margin: '0 0 12px' }}>
                    {t(locale, 'a6_dr_edit_note')}
                  </div>
                  <h4 className="sec">{t(locale, 'a6_dr_resources')}</h4>
                  <dl className="kv">
                    <dt>{t(locale, 'a6_dr_driver')}</dt>
                    <dd data-content>{load.resources.driverName ?? '—'}</dd>
                    <dt>{t(locale, 'a6_dr_phone')}</dt>
                    <dd>
                      {driverPhone ? (
                        <a href={`tel:${driverPhone}`} className="mono" data-content>
                          {driverPhone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                    <dt>{t(locale, 'a6_dr_tractor')}</dt>
                    <dd>
                      <span className="mono" data-content>{load.resources.tractorPlate ?? '—'}</span>
                    </dd>
                    <dt>{t(locale, 'a6_dr_trailer')}</dt>
                    <dd>
                      <span className="mono">{load.resources.trailerPlate ?? '—'}</span>
                    </dd>
                    <dt>{t(locale, 'a6_dr_escort')}</dt>
                    <dd>
                      {load.resources.escort
                        ? load.resources.escortPlate
                          ? tp(locale, 'a6_dr_escort_one_plate', { plate: load.resources.escortPlate })
                          : t(locale, 'a6_dr_escort_one')
                        : t(locale, 'a6_dr_escort_none')}
                    </dd>
                    <dt>{t(locale, 'a6_dr_combo')}</dt>
                    <dd>
                      {fmtDim(comboL, locale)} × {fmtDim(comboW, locale)} × {fmtDim(comboH, locale)} m
                    </dd>
                    <dt>{t(locale, 'a6_dr_combo_mass')}</dt>
                    <dd>{fmtDim(load.resources.setWeightT ?? load.dims.weightT, locale)} t</dd>
                  </dl>
                  <h4 className="sec" style={{ marginTop: 18 }}>
                    {t(locale, 'a6_dr_awi_ferry')}
                  </h4>
                  <dl className="kv">
                    <dt>{t(locale, 'a6_dr_load_window')}</dt>
                    <dd>
                      {formatLoadPl(load.awizacja.loadWindowStart)} – {formatLoadPl(load.awizacja.loadWindowEnd)}
                    </dd>
                    <dt>{t(locale, 'sail_label')}</dt>
                    <dd data-sailing-ro>{sailingText}</dd>
                    <dt>{t(locale, 'sail_booking')}</dt>
                    <dd>{load.ferry.bookingRef ?? '—'}</dd>
                    <dt>{t(locale, 'a6_dr_ferry_status')}</dt>
                    <dd>{ferryStatusLabel(load.ferry.status, locale)}</dd>
                    <dt>{t(locale, 'a6_dr_confirmed')}</dt>
                    <dd>{load.awizacja.confirmed ? t(locale, 'a6_dr_yes') : t(locale, 'a6_dr_no')}</dd>
                  </dl>
                </>
              )}
              {canEdit && (
                <>
                  <h4 className="sec" style={{ marginTop: 18 }}>
                    {t(locale, 'a6_dr_resources')}
                  </h4>
                  <form
                    key={`res-${load.id}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      updateResources(load.id, {
                        driverName: String(fd.get('driverName') || '') || null,
                        driverPhone: String(fd.get('driverPhone') || '') || null,
                        tractorPlate: String(fd.get('tractorPlate') || '') || null,
                        trailerPlate: String(fd.get('trailerPlate') || '') || null,
                        escort: fd.get('escort') === 'on',
                        escortPlate: String(fd.get('escortPlate') || '') || null,
                        setLengthM: Number(fd.get('setLengthM')) || null,
                        setWidthM: Number(fd.get('setWidthM')) || null,
                        setHeightM: Number(fd.get('setHeightM')) || null,
                        setWeightT: Number(fd.get('setWeightT')) || null,
                      });
                    }}
                  >
                    <dl className="kv">
                      {(
                        [
                          ['driverName', 'a6_dr_driver', load.resources.driverName],
                          ['driverPhone', 'a6_dr_phone', driverPhone],
                          ['tractorPlate', 'a6_dr_tractor', load.resources.tractorPlate],
                          ['trailerPlate', 'a6_dr_trailer', load.resources.trailerPlate],
                        ] as const
                      ).map(([name, label, val]) => (
                        <Fragment key={name}>
                          <dt>{t(locale, label)}</dt>
                          <dd>
                            <input name={name} className="input" style={{ width: '100%' }} defaultValue={val ?? ''} />
                          </dd>
                        </Fragment>
                      ))}
                      <dt>{t(locale, 'a6_dr_escort')}</dt>
                      <dd>
                        <label>
                          <input name="escort" type="checkbox" defaultChecked={load.resources.escort} /> {t(locale, 'a6_dr_escort_on')}
                        </label>
                        {' · '}
                        <input
                          name="escortPlate"
                          className="input"
                          placeholder={t(locale, 'a6_dr_escort_plate')}
                          style={{ width: '55%' }}
                          defaultValue={load.resources.escortPlate ?? ''}
                        />
                      </dd>
                      <dt>{t(locale, 'a6_dr_combo')}</dt>
                      <dd>
                        <input
                          name="setLengthM"
                          className="input"
                          style={{ width: '30%' }}
                          defaultValue={load.resources.setLengthM ?? ''}
                          placeholder="L"
                        />{' '}
                        <input
                          name="setWidthM"
                          className="input"
                          style={{ width: '30%' }}
                          defaultValue={load.resources.setWidthM ?? ''}
                          placeholder="W"
                        />{' '}
                        <input
                          name="setHeightM"
                          className="input"
                          style={{ width: '30%' }}
                          defaultValue={load.resources.setHeightM ?? ''}
                          placeholder="H"
                        />
                      </dd>
                      <dt>{t(locale, 'a6_dr_combo_mass')}</dt>
                      <dd>
                        <input
                          name="setWeightT"
                          className="input"
                          style={{ width: '40%' }}
                          defaultValue={load.resources.setWeightT ?? ''}
                          placeholder="t"
                        />
                      </dd>
                    </dl>
                    <button type="submit" className="btn ghost" style={{ marginTop: 8 }}>
                      {t(locale, 'a6_dr_save_res')}
                    </button>
                  </form>

                  <h4 className="sec" style={{ marginTop: 18 }}>
                    {t(locale, 'a6_dr_awi')}
                  </h4>
                  <form
                    key={`awi-${load.id}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      // BK5: tylko zmienione pola — niezmienione okna planowe nie idą do zapisu (AN2).
                      const awiPatch = awizacjaChanges(load.awizacja, planEditable ? {
                        loadWindowStart: wallLocalToIso(String(fd.get('loadWindowStart') || ''), TZ_LOAD_PL),
                        loadWindowEnd: wallLocalToIso(String(fd.get('loadWindowEnd') || ''), TZ_LOAD_PL),
                        unloadWindowStart: wallLocalToIso(String(fd.get('unloadWindowStart') || ''), TZ_UNLOAD_SE),
                        unloadWindowEnd: wallLocalToIso(String(fd.get('unloadWindowEnd') || ''), TZ_UNLOAD_SE),
                        confirmed: fd.get('confirmed') === 'on',
                      } : { ...load.awizacja, confirmed: fd.get('confirmed') === 'on' });
                      updateAwizacja(load.id, awiPatch);
                    }}
                  >
                    <dl className="kv">
                      <dt>{t(locale, 'a6_dr_load_window_range')}</dt>
                      {!planEditable ? (
                        <dd className="cond" data-plan-readonly title={t(locale, 'a6_dr_plan_ro')}>
                          {load.awizacja.loadWindowStart ? formatLoadPl(load.awizacja.loadWindowStart) : '—'}
                          {' – '}
                          {load.awizacja.loadWindowEnd ? formatLoadPl(load.awizacja.loadWindowEnd) : '—'}
                        </dd>
                      ) : (
                      <dd>
                        <input
                          name="loadWindowStart"
                          type="datetime-local"
                          className="input"
                          style={{ width: '48%' }}
                          defaultValue={isoToDatetimeLocalValue(load.awizacja.loadWindowStart, TZ_LOAD_PL)}
                          required
                        />{' '}
                        <input
                          name="loadWindowEnd"
                          type="datetime-local"
                          className="input"
                          style={{ width: '48%' }}
                          defaultValue={isoToDatetimeLocalValue(load.awizacja.loadWindowEnd, TZ_LOAD_PL)}
                          required
                        />
                      </dd>
                      )}
                      <dt>{t(locale, 'a6_dr_confirmed')}</dt>
                      <dd>
                        <label>
                          <input name="confirmed" type="checkbox" defaultChecked={load.awizacja.confirmed} /> {t(locale, 'a6_dr_yes')}
                        </label>
                      </dd>
                      {planEditable ? (
                        <>
                          <input type="hidden" name="unloadWindowStart" defaultValue={isoToDatetimeLocalValue(load.awizacja.unloadWindowStart, TZ_UNLOAD_SE)} />
                          <input type="hidden" name="unloadWindowEnd" defaultValue={isoToDatetimeLocalValue(load.awizacja.unloadWindowEnd, TZ_UNLOAD_SE)} />
                        </>
                      ) : null}
                    </dl>
                    <button type="submit" className="btn ghost" style={{ marginTop: 8 }}>
                      {t(locale, 'a6_dr_save_awi')}
                    </button>
                  </form>

                  {/* M10 — przypisanie rejsu (jedno źródło prawdy: rozkład); po wypłynięciu wyłącznie HHL */}
                  <h4 className="sec" style={{ marginTop: 18 }}>{t(locale, 'sail_label')}</h4>
                  {sailingLock ? (
                    <>
                      <dl className="kv">
                        <dt>{t(locale, 'sail_label')}</dt>
                        <dd data-sailing-locked>{sailingText}</dd>
                        <dt>{t(locale, 'sail_booking')}</dt>
                        <dd className="mono">{load.ferry.bookingRef ?? '—'}</dd>
                      </dl>
                      <div className="note" style={{ margin: '8px 0 0' }}>{t(locale, `sail_deny_${sailingLock}`)}</div>
                    </>
                  ) : (
                    <form
                      key={`sail-${load.id}-${load.sailingId ?? 'none'}`}
                      data-sailing-form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const sid = String(fd.get('sailingId') || '') || null;
                        const denied = assignSailing(load.id, sid, String(fd.get('bookingRef') || '') || null);
                        pushToast(denied ? t(locale, `sail_deny_${denied}`) : t(locale, 'sail_assigned'), denied ? 'HIGH' : 'MEDIUM', load.id);
                      }}
                    >
                      <dl className="kv">
                        <dt>{t(locale, 'sail_label')}</dt>
                        <dd>
                          <select name="sailingId" className="input" style={{ width: '100%' }} defaultValue={load.sailingId ?? ''}>
                            <option value="">{t(locale, 'sail_none')}</option>
                            {sailingOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.vessel} · {fmtLocal(effDeparture(o))} → {fmtLocal(effArrival(o))}{o.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(o.status, locale)}` : ''}
                              </option>
                            ))}
                          </select>
                        </dd>
                        <dt>{t(locale, 'sail_booking')}</dt>
                        <dd>
                          <input name="bookingRef" className="input" style={{ width: '100%' }} defaultValue={load.ferry.bookingRef ?? ''} />
                        </dd>
                      </dl>
                      <button type="submit" className="btn ghost" style={{ marginTop: 8 }} data-sailing-submit>
                        {t(locale, 'sail_assign')}
                      </button>
                    </form>
                  )}
                </>
              )}
              {import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED && canEdit && isServerId(load.id) && <DriverLinkPanel loadId={load.id} />}

              <div className="hr" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {role === 'HHL' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => assignScx(load.id, load.pricing.scxPozycja ?? 'cennik SCX')}
                  >
                    {t(locale, 'a6_dr_assign_scx')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={readyUiBlocked}
                  title={permitBlock ? readyGateReasonLabel(readyGate.reason, locale) : undefined}
                  onClick={() => {
                    if (readyUiBlocked) return;
                    setLoadStatus(load.id, 'READY', role, t(locale, 'a6_dr_ready_note'));
                  }}
                >
                  {t(locale, 'a6_dr_mark_ready')}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={readyUiBlocked}
                  title={permitBlock ? readyGateReasonLabel(readyGate.reason, locale) : undefined}
                  onClick={() => {
                    if (readyUiBlocked) return;
                    setLoadStatus(load.id, 'IN_TRANSIT_PL', role);
                  }}
                >
                  {t(locale, 'a6_dr_depart')}
                </button>
                {/* W2: zdarzenia stref tworzy wyłącznie system (process_position) — symulacja tylko w trybie demo */}
                {!SUPABASE_AUTH_ENABLED && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      const gf = geofences.find((g) => g.type === 'PRE_ARRIVAL') ?? geofences[0];
                      if (gf) triggerGeofence(load.id, gf.id);
                    }}
                  >
                    {t(locale, 'a6_dr_geo_event')}
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setLoadStatus(load.id, 'UNLOADING', role, t(locale, 'a6_dr_unloaded_note'))}
                >
                  {t(locale, 'a6_dr_mark_unloaded')}
                </button>
              </div>

              {loadMsgs.map((m) => (
                <div key={m.id} className={`msg${m.org === 'HHL' ? ' me' : ''}`}>
                  <div className="who">
                    {m.author} · {m.org} · {m.at}
                  </div>
                  <div>{m.text}</div>
                </div>
              ))}
              <form
                className="chatbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chat.trim()) return;
                  sendMessage(load.id, chat.trim());
                  setChat('');
                }}
              >
                <input value={chat} onChange={(e) => setChat(e.target.value)} placeholder={t(locale, 'a6_dr_chat_ph')} />
                <button type="submit" className="btn">
                  {t(locale, 'a6_dr_send')}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  );
}
