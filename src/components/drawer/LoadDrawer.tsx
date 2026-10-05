import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { CorridorMap } from '../map/LazyCorridorMap';
import { StatusPill } from '../ui/StatusPill';
import { fmtNum, fmtNumKeepPl, fmtPct, t, tp } from '../../i18n/messages';
import { canEditResources, canSeeCost, canSeeMargin, canSeeRevenue, visibleDriverPhone } from '../../lib/permissions';
import { SITES } from '../../lib/status';
import { SEFS_SOURCES } from '../../lib/sefs';
import { isReadyBlocked, evaluateLoadCover } from '../../lib/permits';
import { downloadDocumentsZip } from '../../lib/zipDocs';
import { attachDocumentFile } from '../../lib/docFiles';
import { awizacjaChanges } from '../../lib/awizacjaPatch';
import { hasAwizacja } from '../../lib/awizacjaState';
import { editableOrderSide } from '../../lib/orderNumbers';
import { DocPreview } from '../ui/DocPreview';
import { DocFileRow } from '../ui/DocFileRow';
import { PlanDatesPanel } from './PlanDatesPanel';
import { formatTowerPair } from '../../lib/cSep';
import { formatHistoryActor } from '../../lib/historyActor';
import { AwizacjaModal } from './AwizacjaModal';
import { RouteCheckPanel } from './RouteCheckPanel';
import { CorridorObstaclesPanel } from './CorridorObstaclesPanel';
import { RouteProfilePanel } from './RouteProfilePanel';
import {
  TZ_LOAD_PL,
  TZ_UNLOAD_SE,
  formatEtaBoden,
  formatLoadPl,
  formatUnloadSe,
  formatOpsDateTime,
  formatSchedTableDay,
  isoToDatetimeLocalValue,
  wallLocalToIso,
} from '../../lib/time';
import { formatAppMoney } from '../../lib/money/demoFx';
import { formatDelayPill } from '../ui/StatusPill';
import { delayMinutesVsPlan } from '../../lib/time';
import { AgreedFeeForm } from './AgreedFeeForm';
import {
  etaConfidenceLabel,
  eventTypeLabel,
  ferryStatusLabel,
  readyGateReasonLabel,
} from '../../lib/enumLabels';

import { TIER_PILL, type MoneySideV2 } from '../../lib/money/loadMoney';
import { autoStatusText, effArrival, effDeparture, fmtLocal, sailingStatusLabel } from '../../lib/sailings';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { isServerId } from '../../data/registry';
import { DriverLinkPanel } from './DriverLinkPanel';
import type { Load, Locale } from '../../types';
import { PROD_BUILD, shows } from '../../lib/prodFacade';
import { delayPillMinutes, permitBannerState } from '../../lib/prodDash';
/* SCOPE 6.4 — formularz zezwoleń: tylko build Supabase, chunk leniwy (paczka demo bez niego) */
const PermitForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../../auth/PermitForm')) : null;
/* III-4 — pojazdy pilotujące z bazy (load_escorts): tylko build Supabase; demo zostaje przy polu „Pilot” formularza zasobów */
const CarrierRating = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../../auth/CarrierRating')) : null;
const EscortPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../../auth/EscortPanel')) : null;

/** M8 — poziom, mnożnik paliwowy z datą i kurs strony wyceny. */
function MoneySideMeta({ side, locale, which, showFx }: { side: MoneySideV2; locale: Locale; which: 'cost' | 'rev'; showFx: boolean }) {
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
      {showFx ? (
        <div className="mrow" data-fx-row>
          <span className="lbl">{t(locale, 'fx_table')}</span>
          <span className="mono">
            {side.fx.tableNo} · {side.fx.mid.toFixed(4)} · {side.fx.date}
            {side.fx.provisional ? <> <span className="pill p-amber" data-fx-provisional>{t(locale, 'fx_provisional')}</span></> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

type Tab = 'overview' | 'timeline' | 'history' | 'docs' | 'pricing' | 'chat';

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
  const sailings = useTowerStore((s) => s.sailings);
  const setLoadStatus = useTowerStore((s) => s.setLoadStatus);
  const assignScx = useTowerStore((s) => s.assignScx);
  const triggerGeofence = useTowerStore((s) => s.triggerGeofence);
  const geofences = useTowerStore((s) => s.geofences);
  const sendMessage = useTowerStore((s) => s.sendMessage);
  const pushToast = useTowerStore((s) => s.pushToast);
  const setOrderNo = useTowerStore((s) => s.setOrderNo);
  const drawerTab = useTowerStore((s) => s.drawerTab);
  const setDrawerTab = useTowerStore((s) => s.setDrawerTab);

  const [tab, setTab] = useState<Tab>('overview');
  const [chat, setChat] = useState('');
  const [previewDoc, setPreviewDoc] = useState<import('../../types').Document | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadCat, setUploadCat] = useState<import('../../types').Document['category'] | null>(null);
  const [awizOpen, setAwizOpen] = useState(false);

  useEffect(() => {
    const allowed: Tab[] = ['overview', 'timeline', 'history', 'docs', 'pricing', 'chat'];
    if (drawerTab && (allowed as string[]).includes(drawerTab)) {
      setTab(drawerTab as Tab);
      if (drawerTab === 'overview') setAwizOpen(true);
      setDrawerTab(null);
    }
  }, [drawerTab, setDrawerTab]);

  const load = loads.find((l) => l.id === id);
  const loadEvents = useMemo(
    () => (load ? events.filter((e) => e.loadId === load.id).sort((a, b) => (a.at < b.at ? 1 : -1)) : []),
    [events, load],
  );
  const loadDocs = useMemo(
    () => (load ? documents.filter((d) => d.loadId === load.id) : []),
    [documents, load],
  );
  const [insAuto, setInsAuto] = useState<{ covered: boolean; policyNo: string | null; validUntil: string | null } | null>(null);
  useEffect(() => {
    if (!load || import.meta.env.VITE_AUTH_MODE !== 'supabase') { setInsAuto(null); return; }
    let alive = true;
    void import('../../data/insuranceCoverServer')
      .then((m) => m.loadInsuranceCoverOne(load.id))
      .then((row) => {
        if (!alive) return;
        if (!row) { setInsAuto(null); return; }
        setInsAuto({ covered: row.covered, policyNo: row.policyNo, validUntil: row.validUntil });
      })
      .catch(() => { if (alive) setInsAuto(null); });
    return () => { alive = false; };
  }, [load]);
  const loadMsgs = useMemo(
    () => (load ? messages.filter((m) => m.loadId === load.id) : []),
    [messages, load],
  );



  if (!load) return null;

  /* B-K.1 — KSH: boczne menu tylko „Edytuj” (nie pełna szuflada HHL). */
  if (role === 'KSH') {
    return (
      <KshSideMenu
        load={load}
        locale={locale}
        onClose={() => selectLoad(null)}
      />
    );
  }

  const driverPhone = visibleDriverPhone(role, load);

  const showCost = canSeeCost(role);
  const showRev = canSeeRevenue(role);
  const showMargin = canSeeMargin(role);
  const canEdit = canEditResources(role);
  /** B-10: awizację uzupełnia SCX; HHL (nie admin) nie dodaje. */
  const canAwiz = role === 'SCX';
  const orderSide = editableOrderSide(role);
  /* AN2 — okna planowe zmienia wyłącznie HHL (plan z harmonogramu KSH); przewoźnik widzi je jako tekst */
  const planEditable = role === 'HHL';
  /* M10 — rejs z rozkładu */
  const curSailing = sailings.find((x) => x.id === load.sailingId);
  const sailingText = curSailing
    ? `${curSailing.vessel} · ${fmtLocal(effDeparture(curSailing))} → ${fmtLocal(effArrival(curSailing))}${curSailing.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(curSailing.status, locale)}` : ''}`
    : `${load.ferry.vessel ? `${load.ferry.vessel} · ` : ''}${t(locale, 'sail_unassigned')}`;
  const readyGate = isReadyBlocked(load, loadDocs);
  const permitBlock = readyGate.blocked;
  const coverInfo = evaluateLoadCover(load, loadDocs);
  const readyUiBlocked = permitBlock || !coverInfo.covered || load.docMissing || load.permitFits === false;
  const delayMin = delayPillMinutes(load, delayMinutesVsPlan(load.etaBoden, load.plannedDeliverDate, load.planDates?.deliveryTo), PROD_BUILD);
  const delayPillText = delayMin === null ? t(locale, 'i2_delay_pill') : formatDelayPill(delayMin);
  const permitState = !shows('permitNumber') ? permitBannerState(load, loadDocs) : null;
  const comboL = load.resources.setLengthM ?? load.dims.lengthM;
  const comboW = load.resources.setWidthM ?? load.dims.widthM;
  const comboH = load.resources.setHeightM ?? load.dims.heightM;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t(locale, 'tab_overview') },
    { id: 'timeline', label: t(locale, 'tab_timeline') },
    { id: 'docs', label: t(locale, 'tab_docs') },
    { id: 'pricing', label: t(locale, 'tab_pricing') },
    { id: 'chat', label: t(locale, 'tab_chat') },
    { id: 'history', label: t(locale, 'tab_history') },
  ];

  return (
    <>
      <button type="button" className="scrim" aria-label={t(locale, 'a6_dr_close')} onClick={() => selectLoad(null)} />
      <aside className="drawer" role="dialog" aria-label={load.code}>
        <div className="drawer-hd">
          <div className="r1">
            <span className="wb-code" data-content>{load.code}</span>
            <StatusPill status={load.status} stage={load.stage} />
            {load.delayed ? <span className="pill p-red">{delayPillText}</span> : null}
            <div className="spacer" />
            <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={() => selectLoad(null)}>
              ✕
            </button>
          </div>
          <div className="wb-fields">
            <span>
              <b>{t(locale, 'a6_dr_consignee')}</b>
              <em>{t(locale, 'a6_dr_consignee_val')}</em>
            </span>
            <span>
              <b>{t(locale, 'a6_dr_week_load')}</b>
              <em>
                {tp(locale, 'a6_dr_week_val', { n: String((() => {
                  const d = new Date(load.plannedLoadDate);
                  if (Number.isNaN(d.getTime())) return '—';
                  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                  const day = tmp.getUTCDay() || 7;
                  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
                  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
                  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                })()) })}
              </em>
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
              <div data-load-map style={{ position: 'relative', height: 220, marginBottom: 8 }}>
                <CorridorMap loads={[load]} embedded />
              </div>
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn ghost"
                  data-action="export-load-pdf-map"
                  onClick={() => {
                    void (async () => {
                      try {
                        const { exportLoadPdfWithMap } = await import('../../lib/pdfExport');
                        const r = await exportLoadPdfWithMap(load, locale);
                        pushToast(
                          r.mapAttached
                            ? tp(locale, 'h7_pdf_ok_map', { code: load.code })
                            : tp(locale, 'h7_pdf_ok_no_map', { code: load.code, reason: r.mapSkipReason ?? '' }),
                          'MEDIUM',
                        );
                      } catch (e) {
                        pushToast(tp(locale, 'h7_pdf_fail', { msg: e instanceof Error ? e.message : String(e) }), 'CRITICAL');
                      }
                    })();
                  }}
                >
                  {t(locale, 'h7_pdf_btn')}
                </button>
              </div>
              {load.planDates ? <PlanDatesPanel load={load} /> : null}
              <dl className="kv">
                <dt>{t(locale, 'a6_dr_type')}</dt>
                <dd>
                  <span data-content>{load.itemType}</span>{tp(locale, 'a6_dr_qty', { n: String(load.qty) })}
                </dd>
                <dt>{t(locale, 'a6_dr_dims')}</dt>
                <dd>
                  {load.dims.cargoClass === 'STANDARD' ? (
                    <span data-cargo="none">—</span>
                  ) : (
                    <>{fmtDim(load.dims.lengthM, locale)} × {fmtDim(load.dims.widthM, locale)} × {fmtDim(load.dims.heightM, locale)} m</>
                  )}
                </dd>
                <dt>{t(locale, 'h1_title')}</dt>
                <dd data-route-check>
                  <RouteCheckPanel loadId={load.id} locale={locale} />
                </dd>
                <dt>{t(locale, 'h3_title')}</dt>
                <dd data-corridor>
                  <CorridorObstaclesPanel loadId={load.id} locale={locale} />
                </dd>
                <dt>{t(locale, 'h8_title')}</dt>
                <dd data-route-profile>
                  <RouteProfilePanel loadId={load.id} locale={locale} />
                </dd>
                <dt>{t(locale, 'a6_dr_mass')}</dt>
                <dd>
                  {fmtDim(load.dims.weightT, locale)} t ({load.qty} ×{' '}
                  {fmtDim(load.dims.weightT / Math.max(1, load.qty), locale)} t)
                </dd>
                {/* M5 — trzy numery zleceń (W12): KSH z importu, HHL i przewoźnik — każda strona edytuje wyłącznie swój */}
                <dt>{t(locale, 'a6_dr_ord_hhl')}</dt>
                <dd data-order="hhl">
                  {orderSide === 'HHL' ? (
                    <div className="awiz-row" style={{ margin: 0 }}>
                      {load.hhlOrderNo ? <span className="mono">{load.hhlOrderNo}</span> : <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_dr_not_filled')}</span>}
                      <button type="button" className="btn" data-hhl-order-btn onClick={() => setAwizOpen(true)}>
                        {load.hhlOrderNo ? t(locale, 'awiz_hhl_edit') : t(locale, 'awiz_hhl_add')}
                      </button>
                    </div>
                  ) : (
                    <OrderNoField key={`hhl-${load.id}`} value={load.hhlOrderNo} editable={false} onSave={() => undefined} />
                  )}
                </dd>
                <dt>{t(locale, 'a6_dr_ord_scx')}</dt>
                <dd data-order="scx">
                  <OrderNoField key={`scx-${load.id}`} value={load.carrierOrderNo} editable={orderSide === 'CARRIER'} onSave={(v) => setOrderNo(load.id, 'CARRIER', v)} />
                </dd>
                <dt>{t(locale, 'a6_dr_load_place')}</dt>
                <dd>{SITES.loading.name}</dd>
                <dt>{t(locale, 'a6_dr_loading')}</dt>
                <dd className="cond" data-load-when>{formatSchedTableDay(load.plannedLoadDate, load.awizacja.loadWindowStart, TZ_LOAD_PL)}</dd>
                <dt>{t(locale, 'a6_dr_delivery')}</dt>
                <dd className="cond" data-deliver-when>{formatSchedTableDay(load.plannedDeliverDate, load.awizacja.unloadWindowStart, TZ_UNLOAD_SE)}</dd>
                <dt>{t(locale, 'eta')}</dt>
                <dd className="cond" data-eta={load.etaPreLoad ? 'pre-load' : 'value'}>
                  {load.etaPreLoad ? (
                    <span>{t(locale, 'eta_dash')}</span>
                  ) : load.etaBoden ? formatEtaBoden(load.etaBoden) : (
                    <span>{t(locale, 'eta_dash')} <span className="note">{load.etaReasons[0] || t(locale, 'eta_no_gps')}</span></span>
                  )}{' '}
                  {!load.etaPreLoad && load.etaBoden && load.delayed ? (
                    <span className="pill p-red">{delayPillText}</span>
                  ) : !load.etaPreLoad && load.etaBoden ? (
                    <span className="pill p-go">{t(locale, 'a6_dr_in_window')}</span>
                  ) : null}
                  {' '}
                  {!load.etaPreLoad && <>
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
                    {load.etaConfMin !== undefined && load.etaConfMin !== null
                      ? (
                        <span data-eta="db">
                          {tp(
                            locale,
                            (load.etaMethod ?? '').includes('OSM') ? 'i2_eta_band_osm' : 'i2_eta_band_db',
                            { m: String(load.etaConfMin) },
                          )}
                          {(load.etaMethod ?? '').includes('OSM')
                            ? ` · ${t(locale, 'i2_eta_osm_attr')}`
                            : ''}
                        </span>
                      )
                      : tp(locale, 'a6_dr_band', { a: fmtNumKeepPl(locale, load.etaEarliestHours, 1, load.etaEarliestHours.toFixed(1)), b: fmtNumKeepPl(locale, load.etaLatestHours, 1, load.etaLatestHours.toFixed(1)) })}
                    {load.etaReasons?.length ? ` · ${load.etaReasons.slice(0, 3).join(' · ')}` : ''}
                  </div>
                  </>}
                </dd>
                <dt>{t(locale, 'a6_dr_driver')}</dt>
                <dd>
                  {load.resources.driverName || load.resources.driverDeliveryName ? (
                    <span data-content>{formatTowerPair(load.resources.driverName, load.resources.driverDeliveryName, !!load.resources.trailerSwap)}</span>
                  ) : (
                    <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_dr_not_filled')}</span>
                  )}
                </dd>
                <dt>{t(locale, 'a6_dr_phone')}</dt>
                <dd>
                  {driverPhone ? (
                    <a
                      href={`tel:${(load.resources.driverPhone || load.resources.driverDeliveryPhone || '').replace(/\s+/g, '')}`}
                      className="mono"
                      data-content
                      data-phone-pair
                    >
                      {formatTowerPair(
                        load.resources.driverPhone,
                        load.resources.driverDeliveryPhone,
                        !!load.resources.trailerSwap,
                      )}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>{t(locale, 'a6_dr_tractor_trailer')}</dt>
                <dd data-tractor-pair>
                  {load.resources.tractorPlate || load.resources.tractorDeliveryPlate ? (
                    <>
                      <span className="mono">{formatTowerPair(load.resources.tractorPlate, load.resources.tractorDeliveryPlate, !!load.resources.trailerSwap)}</span>
                      {' · '}
                      <span className="mono">{load.resources.trailerPlate ?? '—'}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
                {load.resources.escort ? (
                  <>
                    <dt>{t(locale, 'a6_dr_escort')}</dt>
                    <dd data-escort="required">
                      {load.resources.escortPlate
                        ? tp(locale, 'a6_dr_escort_one_plate', { plate: load.resources.escortPlate })
                        : t(locale, 'a6_dr_escort_one')}
                    </dd>
                  </>
                ) : null}
                <dt>{t(locale, 'a6_dr_ferry')}</dt>
                <dd>
                  {load.ferry.vessel
                    ? (curSailing
                      ? `${load.ferry.vessel} · ${fmtLocal(effDeparture(curSailing))}`
                      : load.ferry.vessel)
                    : t(locale, 'a6_dr_no_booking')}
                </dd>
              </dl>

              {/* AWIZ-4 — Dodaj / Edytuj poza Ustalenia */}
              {canAwiz && (
                <div className="awiz-row" data-awiz-actions>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t(locale, 'a6_dr_awi')}</span>
                  <button type="button" className="btn" data-awiz-open onClick={() => setAwizOpen(true)}>
                    {hasAwizacja(load) ? t(locale, 'awiz_edit') : t(locale, 'awiz_add')}
                  </button>
                </div>
              )}

              {load.permitFits === false ? (
                <div className="banner red" data-permit="mismatch" style={{ margin: '13px 0 0' }}>
                  <b>{t(locale, 'v65_permit_mismatch_b')}</b> {t(locale, 'v65_permit_mismatch')}
                </div>
              ) : permitState ? (
                permitState.kind === 'not_required' ? (
                  <div className="banner" data-permit="not_required" style={{ margin: '13px 0 0' }}>{t(locale, 'i2_permit_not_required')}</div>
                ) : permitState.kind === 'uploaded_unchecked' ? (
                  <div className="banner amber" data-permit="uploaded_unchecked" style={{ margin: '13px 0 0' }}>
                    <b>{t(locale, 'i2_permit_uploaded_b')}</b> {tp(locale, 'i2_permit_uploaded', { f: permitState.fileName })}
                  </div>
                ) : (
                  <div className="banner red" data-permit="missing" style={{ margin: '13px 0 0' }}>
                    <b>{t(locale, 'a6_dr_permit_missing_b')}</b> {tp(locale, 'a6_dr_permit_missing', { l: fmtDim(comboL, locale) })}
                  </div>
                )
              ) : readyUiBlocked ? (
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
              {/* I-18: status dat planu — na zakładce przeglądu (widoczny dla trzech ról bez przełączania) */}
              {/* DATY-67: „Potwierdź daty” usunięte — daty z pliku KSH */}
              {CarrierRating && (role === 'HHL' || role === 'SCX') && isServerId(load.id) && <Suspense fallback={null}><CarrierRating key={load.id} loadId={load.id} /></Suspense>}
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
                      {formatHistoryActor(e.actor)} — {formatOpsDateTime(e.at)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {tab === 'history' && (
            <ul className="tl" data-history>
              {loadEvents.length === 0 ? (
                <li className="future">
                  <span className="mk" />
                  <div className="w">{t(locale, 'a6_dr_no_events')}</div>
                  <div className="ts">—</div>
                </li>
              ) : (
                loadEvents.map((e) => (
                  <li key={`h-${e.id}`}>
                    <span className="mk" />
                    <div className="w" style={{ fontWeight: 700 }}>
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
                      {formatHistoryActor(e.actor)} — {formatOpsDateTime(e.at)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {tab === 'docs' && (
            <>
              <div className="note" data-ins-auto style={{ margin: '0 0 10px' }}>
                {insAuto?.covered && insAuto.policyNo
                  ? tp(locale, 'b32_ins_auto', { no: insAuto.policyNo, until: insAuto.validUntil ?? '—' })
                  : t(locale, 'b32_ins_missing')}
              </div>
              {loadDocs.map((d) => (
                <DocFileRow
                  key={d.id}
                  doc={d}
                  onPreview={setPreviewDoc}
                  showUpload={canEdit}
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
                {true ? (
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
              {PermitForm && isServerId(load.id) && <Suspense fallback={null}><PermitForm key={load.id} loadId={load.id} /></Suspense>}
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
                  {load.pricing.money ? <MoneySideMeta side={load.pricing.money.cost} locale={locale} which="cost" showFx={role === 'HHL' || currency !== 'EUR'} /> : null}
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
                  <div className="mrow">
                    <span className="lbl">{t(locale, 'a6_dr_extras')}</span>
                    <span>{formatAppMoney(load.pricing.revExtras, locale, currency)}</span>
                  </div>
                  <div className="mrow total">
                    <span>{t(locale, 'a6_dr_total')}</span>
                    <span>{formatAppMoney(load.pricing.revTotal, locale, currency)}</span>
                  </div>
                  {load.pricing.money ? <MoneySideMeta side={load.pricing.money.rev} locale={locale} which="rev" showFx={role === 'HHL' || currency !== 'EUR'} /> : null}
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
              {isServerId(load.id) && (role === 'HHL' || role === 'SCX') ? <AgreedFeeForm loadId={load.id} locale={locale} role={role} /> : null}
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
                        <a
                          href={`tel:${(load.resources.driverPhone || load.resources.driverDeliveryPhone || '').replace(/\s+/g, '')}`}
                          className="mono"
                          data-content
                          data-phone-pair
                        >
                          {formatTowerPair(
                            load.resources.driverPhone,
                            load.resources.driverDeliveryPhone,
                            !!load.resources.trailerSwap,
                          )}
                        </a>
                      ) : (
                        '—'
                      )}
                    </dd>
                    <dt>{t(locale, 'a6_dr_tractor')}</dt>
                    <dd>
                      <span className="mono" data-content>{formatTowerPair(load.resources.tractorPlate, load.resources.tractorDeliveryPlate, !!load.resources.trailerSwap)}</span>
                    </dd>
                    <dt>{t(locale, 'a6_dr_trailer')}</dt>
                    <dd>
                      <span className="mono">{load.resources.trailerPlate ?? '—'}</span>
                    </dd>
                    {!(EscortPanel && isServerId(load.id)) && load.resources.escort && (<>
                    <dt>{t(locale, 'a6_dr_escort')}</dt>
                    <dd data-escort="required">
                      {load.resources.escortPlate
                        ? tp(locale, 'a6_dr_escort_one_plate', { plate: load.resources.escortPlate })
                        : t(locale, 'a6_dr_escort_one')}
                    </dd>
                    </>)}
                    <dt>{t(locale, 'a6_dr_combo')}</dt>
                    <dd>
                      {fmtDim(comboL, locale)} × {fmtDim(comboW, locale)} × {fmtDim(comboH, locale)} m
                    </dd>
                    <dt>{t(locale, 'a6_dr_combo_mass')}</dt>
                    <dd>{fmtDim(load.resources.setWeightT ?? load.dims.weightT, locale)} t</dd>
                  </dl>
                  {EscortPanel && isServerId(load.id) && <Suspense fallback={null}><EscortPanel key={load.id} loadId={load.id} /></Suspense>}
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
                    <dt>{t(locale, 'a6_dr_ferry_status')}</dt>
                    <dd>{ferryStatusLabel(load.ferry.status, locale)}</dd>
                    <dt>{t(locale, 'a6_dr_confirmed')}</dt>
                    <dd>{load.awizacja.confirmed ? t(locale, 'a6_dr_yes') : t(locale, 'a6_dr_no')}</dd>
                  </dl>
                </>
              )}
              {canAwiz && (
                <>
                  <div className="note" style={{ margin: '0 0 12px' }} data-awiz-chat-note>
                    {t(locale, 'awiz_chat_note')}
                  </div>
                  <div className="awiz-row" style={{ margin: '0 0 14px' }}>
                    <button type="button" className="btn" onClick={() => setAwizOpen(true)}>
                      {hasAwizacja(load) ? t(locale, 'awiz_edit') : t(locale, 'awiz_add')}
                    </button>
                  </div>
                  <h4 className="sec">{t(locale, 'a6_dr_combo_dims')}</h4>
                  <form
                    key={`combo-${load.id}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      updateResources(load.id, {
                        ...(EscortPanel && isServerId(load.id) ? {} : {
                          escort: fd.get('escort') === 'on',
                          escortPlate: String(fd.get('escortPlate') || '') || null,
                        }),
                        setLengthM: Number(fd.get('setLengthM')) || null,
                        setWidthM: Number(fd.get('setWidthM')) || null,
                        setHeightM: Number(fd.get('setHeightM')) || null,
                        setWeightT: Number(fd.get('setWeightT')) || null,
                      });
                    }}
                  >
                    <dl className="kv">
                      {!(EscortPanel && isServerId(load.id)) && (<>
                      <dt>{t(locale, 'a6_dr_escort')}</dt>
                      <dd>
                        <label>
                          <input name="escort" type="checkbox" defaultChecked={load.resources.escort} /> {t(locale, 'a6_dr_escort_on')}
                        </label>
                        {' · '}
                        <input name="escortPlate" className="input" placeholder={t(locale, 'a6_dr_escort_plate')} style={{ width: '55%' }} defaultValue={load.resources.escortPlate ?? ''} />
                      </dd>
                      </>)}
                      <dt>{t(locale, 'a6_dr_combo')}</dt>
                      <dd>
                        <input name="setLengthM" className="input" style={{ width: '30%' }} defaultValue={load.resources.setLengthM ?? ''} placeholder="L" />{' '}
                        <input name="setWidthM" className="input" style={{ width: '30%' }} defaultValue={load.resources.setWidthM ?? ''} placeholder="W" />{' '}
                        <input name="setHeightM" className="input" style={{ width: '30%' }} defaultValue={load.resources.setHeightM ?? ''} placeholder="H" />
                      </dd>
                      <dt>{t(locale, 'a6_dr_combo_mass')}</dt>
                      <dd>
                        <input name="setWeightT" className="input" style={{ width: '40%' }} defaultValue={load.resources.setWeightT ?? ''} placeholder="t" />
                      </dd>
                    </dl>
                    <button type="submit" className="btn ghost" style={{ marginTop: 8 }}>{t(locale, 'a6_dr_save_res')}</button>
                  </form>
                  {EscortPanel && isServerId(load.id) && <Suspense fallback={null}><EscortPanel key={load.id} loadId={load.id} /></Suspense>}

                  {planEditable && (
                    <>
                      <h4 className="sec" style={{ marginTop: 18 }}>{t(locale, 'a6_dr_awi')}</h4>
                      <form
                        key={`awi-${load.id}`}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const awiPatch = awizacjaChanges(load.awizacja, {
                            loadWindowStart: wallLocalToIso(String(fd.get('loadWindowStart') || ''), TZ_LOAD_PL),
                            loadWindowEnd: wallLocalToIso(String(fd.get('loadWindowEnd') || ''), TZ_LOAD_PL),
                            unloadWindowStart: wallLocalToIso(String(fd.get('unloadWindowStart') || ''), TZ_UNLOAD_SE),
                            unloadWindowEnd: wallLocalToIso(String(fd.get('unloadWindowEnd') || ''), TZ_UNLOAD_SE),
                            confirmed: fd.get('confirmed') === 'on',
                          });
                          updateAwizacja(load.id, awiPatch);
                        }}
                      >
                        <dl className="kv">
                          <dt>{t(locale, 'a6_dr_load_window_range')}</dt>
                          <dd>
                            <input name="loadWindowStart" type="datetime-local" className="input" style={{ width: '48%' }} defaultValue={isoToDatetimeLocalValue(load.awizacja.loadWindowStart, TZ_LOAD_PL)} required />{' '}
                            <input name="loadWindowEnd" type="datetime-local" className="input" style={{ width: '48%' }} defaultValue={isoToDatetimeLocalValue(load.awizacja.loadWindowEnd, TZ_LOAD_PL)} required />
                          </dd>
                          <dt>{t(locale, 'a6_dr_confirmed')}</dt>
                          <dd>
                            <label>
                              <input name="confirmed" type="checkbox" defaultChecked={load.awizacja.confirmed} /> {t(locale, 'a6_dr_yes')}
                            </label>
                          </dd>
                          <input type="hidden" name="unloadWindowStart" defaultValue={isoToDatetimeLocalValue(load.awizacja.unloadWindowStart, TZ_UNLOAD_SE)} />
                          <input type="hidden" name="unloadWindowEnd" defaultValue={isoToDatetimeLocalValue(load.awizacja.unloadWindowEnd, TZ_UNLOAD_SE)} />
                        </dl>
                        <button type="submit" className="btn ghost" style={{ marginTop: 8 }}>{t(locale, 'a6_dr_save_awi')}</button>
                      </form>
                    </>
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
                  data-action="mark-ready"
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
                    {m.author} // {m.org} — {formatOpsDateTime(m.at)}
                  </div>
                  <div>{m.text}</div>
                  {m.reads && m.reads.length > 0 ? (
                    <details style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-3)' }}>
                      <summary>{locale === 'sv' ? 'läst' : locale === 'en' ? 'read' : 'odczytano'} ({m.reads.length})</summary>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                        {m.reads.map((r) => (
                          <li key={r.userId + r.at}>{r.name}{r.org ? ` // ${r.org}` : ''} — {formatOpsDateTime(r.at)}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
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
      {awizOpen ? <AwizacjaModal load={load} onClose={() => setAwizOpen(false)} /> : null}
    </>
  );
}

/** B-K.1 / B-K.2 — wąskie boczne menu KSH: tylko Edytuj → daty/godziny. */
function KshSideMenu({
  load,
  locale,
  onClose,
}: {
  load: Load;
  locale: Locale;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(false);
  }, [load.id]);

  return (
    <>
      <button type="button" className="scrim on" aria-label="close" onClick={onClose} />
      <aside className="drawer" data-drawer-root data-ksh-side-menu role="dialog" aria-modal="true">
        <div className="drawer-hd">
          <div>
            <div className="t">{load.code}</div>
            <div className="s">{t(locale, 'b_ksh_edit')}</div>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <div className="dbody">
          {!editing ? (
            <button
              type="button"
              className="btn"
              data-ksh-edit
              onClick={() => setEditing(true)}
              style={{ width: '100%' }}
            >
              {t(locale, 'b_ksh_edit')}
            </button>
          ) : load.planDates ? (
            <PlanDatesPanel load={load} forceEditing onCloseEdit={() => setEditing(false)} />
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              Brak danych planDates dla tego załadunku.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

