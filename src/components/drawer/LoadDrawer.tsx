import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { CorridorMap } from '../map/LazyCorridorMap';
import { StatusPill } from '../ui/StatusPill';
import { fmtNum, t, tp } from '../../i18n/messages';
import {
  canChangeLoadStatus,
  visibleDriverPhone,
} from '../../lib/permissions';
import { getAuthProfile } from '../../auth/profile';
import { SITES } from '../../lib/status';
import { isReadyBlocked, evaluateLoadCover } from '../../lib/permits';
import { hasAwizacja } from '../../lib/awizacjaState';
import { editableOrderSide } from '../../lib/orderNumbers';
import { transportLabel } from '../../lib/transportName';
import { DocPreview } from '../ui/DocPreview';
import { PlanDatesPanel } from './PlanDatesPanel';
import { formatTowerPair } from '../../lib/cSep';
import { KshDatesModal } from './KshDatesModal';
import { StatusAxisTab } from './StatusAxisTab';
import { TrackingBar } from './TrackingBar';
import { DeliveredCheckCard } from './DeliveredCheckCard';
import { deliveredCheckOf, readyGapsOf, trackingLinkOf } from '../../lib/p4cSource';
import { lazyRetry } from '../../lib/lazyRetry';
import { EtaBlock } from './EtaBlock';
import { useEtaWx } from '../../lib/e49WxSource';
import { buildStatusAxis } from '../../lib/statusAxis';
import { trackingPhase } from '../../lib/stageTiles';
import { useIsPhone } from '../../lib/useIsPhone';
import { getNow } from '../../lib/frozenNow';
import { RouteCheckPanel } from './RouteCheckPanel';
import { CorridorObstaclesPanel } from './CorridorObstaclesPanel';
import {
  TZ_LOAD_PL,
  TZ_UNLOAD_SE,
  formatLoadPl,
  formatSchedTableDay,
  delayMinutesVsPlan,
} from '../../lib/time';
import { formatDelayPill, StatusMarkers } from '../ui/StatusPill';
import { AgreedFeeForm } from './AgreedFeeForm';
import { effArrival, effDeparture, fmtLocal, sailingStatusLabel } from '../../lib/sailings';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { isServerId } from '../../data/registry';
import { chatMeOf, chatMessagesOf, chatReadsOn, chatUnread, historyEventsOf } from '../../lib/p6bSource';
import { ht, htn } from '../../i18n/p6b';
import { OptionsHowTo } from '../settings/OptionsHowTo';
import type { Load, Locale } from '../../types';
import { PROD_BUILD, shows } from '../../lib/prodFacade';
import { delayPillMinutes, permitBannerState } from '../../lib/prodDash';
/* SCOPE 6.4 — formularz zezwoleń: tylko build Supabase, chunk leniwy (paczka demo bez niego) */
const PermitForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../../auth/PermitForm')) : null;
/* III-4 — pojazdy pilotujące z bazy (load_escorts): tylko build Supabase; demo zostaje przy polu „Pilot” formularza zasobów */
/* wyglad/P4-c: okna awizacji i „Zmień status” poza pierwszym wczytaniem (budżet 400 kB gzip, scripts/bundle-size.mjs) */
const AwizacjaModal = lazy(lazyRetry(() => import('./AwizacjaModal').then((m) => ({ default: m.AwizacjaModal }))));
const StatusChangeModal = lazy(lazyRetry(() => import('./StatusChangeModal').then((m) => ({ default: m.StatusChangeModal }))));
const PanelDocs = lazy(lazyRetry(() => import('./PanelDocs').then((m) => ({ default: m.PanelDocs }))));
const PanelPrices = lazy(lazyRetry(() => import('./PanelPrices').then((m) => ({ default: m.PanelPrices }))));
/* wyglad/P6-b: „Historia” i „Czat” (E17) poza pierwszym wczytaniem */
const PanelHistory = lazy(lazyRetry(() => import('./PanelHistory').then((m) => ({ default: m.PanelHistory }))));
const PanelChat = lazy(lazyRetry(() => import('./PanelChat').then((m) => ({ default: m.PanelChat }))));
const CarrierRating = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../../auth/CarrierRating')) : null;
const EscortPanel = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('../../auth/EscortPanel')) : null;

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
  const bills = useTowerStore((s) => s.bills);
  const messages = useTowerStore((s) => s.messages);
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const sailings = useTowerStore((s) => s.sailings);
  const geofences = useTowerStore((s) => s.geofences);
  const sendMessage = useTowerStore((s) => s.sendMessage);
  const pushToast = useTowerStore((s) => s.pushToast);
  const setOrderNo = useTowerStore((s) => s.setOrderNo);
  const drawerTab = useTowerStore((s) => s.drawerTab);
  const setDrawerTab = useTowerStore((s) => s.setDrawerTab);
  const setLoadStatus = useTowerStore((s) => s.setLoadStatus);

  const [tab, setTab] = useState<Tab>('overview');
  /* E17: wiadomości widziane w zakładce „Czat” w tej sesji (liczba nieprzeczytanych; odczyt w bazie zapisuje wykonawca) */
  const [chatSeen, setChatSeen] = useState<Record<string, readonly string[]>>({});
  const [previewDoc, setPreviewDoc] = useState<import('../../types').Document | null>(null);
  const [awizOpen, setAwizOpen] = useState(false);
  const [kshDatesOpen, setKshDatesOpen] = useState(false);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  /* wyglad/P4-b: telefon (oś i blok ETA) i „teraz” zaokrąglone do minuty (pasek śledzenia E27) */
  const phone = useIsPhone();
  /* odświeżenie co minutę: „ostatnia pozycja X min temu”, faza okna śledzenia */
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMinuteTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const nowIso = useMemo(() => new Date(nowMin * 60_000).toISOString(), [nowMin]);

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
  /* wyglad/P6-c (E17): oś statusów z tych samych zdarzeń co Historia — demo z przykładami P6-b, produkcja bez zmian */
  const axisEvents = useMemo(() => (load ? historyEventsOf(load, loadEvents, nowIso) : loadEvents), [load, loadEvents, nowIso]);
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
  const chatMsgs = useMemo(() => (load ? chatMessagesOf(load, loadMsgs, nowIso) : []), [load, loadMsgs, nowIso]);



  /* E27 (wyglad/P4-b): poza oknem śledzenia (przed 03:00 w dniu załadunku i po „Dostarczone”) panel nie pokazuje kropki pojazdu */
  const drawerMapLoads = useMemo(() => (load && trackingPhase(load, nowIso) === 'on' ? [load] : []), [load, nowIso]);
  /* wyglad/P4-c (L14): sprawa zamknięta „Nie” w trybie demo — karta znika bez zmiany statusu */
  const [dcClosed, setDcClosed] = useState<string | null>(null);
  /* wyglad/E49: linie wiatru / postoju / śliskości / objazdu w ETA (produkcja: `etaDetail.weather`; demo dociągane) */
  const etaWx = useEtaWx(load, loads, nowIso);

  if (!load) return null;

  /* AUD-03 (KSH — PANEL ZLECENIA): KSH widzi ten sam panel co pozostali; jedyny przycisk zmian = „Edytuj” (daty i godziny). */
  const driverPhone = visibleDriverPhone(role, load);

  const canStatus = canChangeLoadStatus(role, getAuthProfile()?.role ?? null);
  /** B-10: awizację uzupełnia SCX; HHL (nie admin) nie dodaje. */
  const canAwiz = role === 'SCX';
  const orderSide = editableOrderSide(role);
  /* M10 — rejs z rozkładu */
  const curSailing = sailings.find((x) => x.id === load.sailingId);
  const readyGate = isReadyBlocked(load, loadDocs);
  const permitBlock = readyGate.blocked;
  const coverInfo = evaluateLoadCover(load, loadDocs);
  const readyUiBlocked = permitBlock || !coverInfo.covered || load.docMissing || load.permitFits === false;
  const delayMin = delayPillMinutes(load, delayMinutesVsPlan(load.etaBoden, load.plannedDeliverDate, load.planDates?.deliveryTo), PROD_BUILD);
  const delayPillText = delayMin === null ? t(locale, 'i2_delay_pill') : formatDelayPill(delayMin);
  const permitState = !shows('permitNumber') ? permitBannerState(load, loadDocs) : null;
  const comboL = load.resources.setLengthM ?? load.dims.lengthM;

  /* E25: oś statusów raz na render — data dostawy i wjazd na plac do bloku ETA */
  const statusAxis = buildStatusAxis(load, axisEvents);
  /* wyglad/P4-c: link śledzenia z serwera (E44), braki do „Gotowy” (L6, L9, L29), sprawa „czy dostarczono?” (L14) */
  const trackingLink = trackingLinkOf(load, loads, nowIso);
  const readyGaps = readyGapsOf(load, loadDocs);
  const dcRaw = deliveredCheckOf(load, loads, geofences, nowIso, role, loadEvents);
  const deliveredCheck = dcRaw && dcRaw.id !== dcClosed ? dcRaw : null;
  const deliveredCard = deliveredCheck ? (
    <DeliveredCheckCard
      check={deliveredCheck}
      locale={locale}
      onYes={import.meta.env.VITE_AUTH_MODE !== 'supabase'
        ? () => setLoadStatus(load.id, 'DELIVERED', role, tp(locale, 'p4c_dc_note_yes', { n: deliveredCheck.minutes }), deliveredCheck.exitAt)
        : undefined}
      onNo={import.meta.env.VITE_AUTH_MODE !== 'supabase'
        ? () => {
          setDcClosed(deliveredCheck.id);
          useTowerStore.getState().appendEvent({ loadId: load.id, type: 'NOTE', at: nowIso, actor: role, note: tp(locale, 'p4c_dc_note_no', { n: deliveredCheck.minutes }) });
          pushToast(t(locale, 'p4c_dc_no_done'), 'LOW', load.id);
          /* fokus nie ginie razem z kartą */
          window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.drawer [data-action="change-status"]')?.focus());
        }
        : undefined}
    />
  ) : null;

  const chatUnreadN = chatReadsOn() ? chatUnread(chatMsgs, role, chatMeOf(role), new Set(chatSeen[load.id] ?? [])) : 0;
  /* wejście do „Czatu” i wyjście z niego: to, co było na ekranie, jest przeczytane (tylko w tej sesji) */
  const switchTab = (next: Tab) => {
    if (tab === 'chat' || next === 'chat') setChatSeen((s) => ({ ...s, [load.id]: chatMsgs.map((m) => m.id) }));
    setTab(next);
  };

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
      <aside className="drawer" role="dialog" aria-label={transportLabel(load, role, 'panel')}>
        <div className="drawer-hd">
          <div className="r1">
            {/* wyglad/P5 (E8): nazwa i znaczniki zawijają się, „✕” zostaje w rogu przy 360 px (HHL: kod · numer zlecenia) */}
            <div className="r1-l">
              <span className="wb-code" data-content>{transportLabel(load, role, 'panel')}</span>
              <StatusPill status={load.status} stage={load.stage} />
              {load.delayed ? <span className="pill p-red">{delayPillText}</span> : null}
            </div>
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

        {/* E27 pkt 5 (E1-2): pasek śledzenia nad zakładkami */}
        <TrackingBar load={load} events={loadEvents} label={transportLabel(load, role, 'plain')} locale={locale} nowIso={nowIso} trackingLink={trackingLink} />

        {/* wyglad/P5-c (E10, axe): zakładki jako lista zakładek — `aria-selected` dozwolone tylko przy roli „tab” */}
        <div className="dtabs" role="tablist" aria-label={transportLabel(load, role, 'plain')}>
          {tabs.map((x, i) => {
            /* E17: liczba nieprzeczytanych na zakładce „Czat” */
            const n = x.id === 'chat' && tab !== 'chat' ? chatUnreadN : 0;
            return (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`dtab-${x.id}`}
                aria-controls="dpanel"
                tabIndex={tab === x.id ? 0 : -1}
                onClick={() => switchTab(x.id)}
                onKeyDown={(e) => {
                  /* wzór listy zakładek: ← → przełączają, Home / End — pierwsza i ostatnia */
                  const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
                  if (j == null) return;
                  e.preventDefault();
                  const next = tabs[(j + tabs.length) % tabs.length];
                  switchTab(next.id);
                  window.setTimeout(() => document.getElementById(`dtab-${next.id}`)?.focus(), 0);
                }}
                aria-selected={tab === x.id} aria-label={n ? `${x.label}, ${htn(locale, 'p6b_chat_unread', n)}` : undefined}>
                {x.label}
                {n ? <span className="dt-n" aria-hidden="true" data-chat-unread={n}>{n}</span> : null}
              </button>
            );
          })}
        </div>

        <div className={`dbody${tab === 'chat' ? ' is-chat' : ''}`} role="tabpanel" id="dpanel" aria-labelledby={`dtab-${tab}`} tabIndex={0}>
          {tab === 'overview' && (
            <>
              {/* wyglad/P4-c (L14): otwarta sprawa „czy dostarczono?” — odpowiedź w zakładce Status */}
              {deliveredCheck ? (
                <button type="button" className="dcc-jump" data-dc-jump onClick={() => setTab('timeline')}>
                  <b>{tp(locale, 'p4c_dc_title', { n: deliveredCheck.minutes })}</b>
                  <span>{t(locale, deliveredCheck.canDecide ? 'p4c_dc_jump' : 'p4c_dc_jump_view')} ›</span>
                </button>
              ) : null}
              <div data-load-map style={{ position: 'relative', height: 220, marginBottom: 8 }}>
                <CorridorMap loads={drawerMapLoads} embedded slot="drawer" />
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
              {/* E15 pkt 8 (img/e15-after): blok ETA nad listą pól */}
              <EtaBlock
                load={load}
                locale={locale}
                phone={phone}
                nowIso={nowIso}
                deliveredAt={statusAxis.deliveredAt}
                siteSince={statusAxis.current === 'APPROACHING_SITE' ? statusAxis.currentSince : null}
                delayMin={delayMin}
                wx={etaWx}
              />
              <div data-eta-howto className="etab-howto">
                <OptionsHowTo locale={locale} k="a6_dr_eta_howto" summaryKey="a6_sch_howto_btn" />
              </div>
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
                <dt>{t(locale, 'a6_dr_mass')}</dt>
                <dd>
                  {fmtDim(load.dims.weightT, locale)} t ({load.qty} ×{' '}
                  {fmtDim(load.dims.weightT / Math.max(1, load.qty), locale)} t)
                </dd>
                {/* E41 (P2): KSH bez pól numerów. SCX widzi numer HHL tylko do odczytu. */}
                {role !== 'KSH' ? (
                  <>
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
                  </>
                ) : null}
                <dt>{t(locale, 'a6_dr_load_place')}</dt>
                <dd>{SITES.loading.name}</dd>
                <dt>{t(locale, 'a6_dr_loading')}</dt>
                <dd className="cond" data-load-when>{formatSchedTableDay(load.plannedLoadDate, load.awizacja.loadWindowStart, TZ_LOAD_PL)}</dd>
                <dt>{t(locale, 'a6_dr_delivery')}</dt>
                <dd className="cond" data-deliver-when>{formatSchedTableDay(load.plannedDeliverDate, load.awizacja.unloadWindowStart, TZ_UNLOAD_SE)}</dd>
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
                {/* wyglad/P6-b: przy liście pilotów z bazy (SCX, KSH) bez drugiego, starszego wiersza „Pilot” */}
                {load.resources.escort && !(EscortPanel && isServerId(load.id) && (role === 'SCX' || role === 'KSH')) ? (
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
                {/* wyglad/P6-b (E17 → E32): to, co KSH widział w „Ustaleniach” — przypłynięcie i stan rejsu — jest tu dla wszystkich */}
                <dd data-ferry-row>
                  {curSailing
                    ? `${load.ferry.vessel ?? curSailing.vessel} · ${fmtLocal(effDeparture(curSailing))} → ${fmtLocal(effArrival(curSailing))}${curSailing.status !== 'ZAPLANOWANY' ? ` · ${sailingStatusLabel(curSailing.status, locale)}` : ''}`
                    : load.ferry.vessel ?? t(locale, 'a6_dr_no_booking')}
                </dd>
                <dt>{t(locale, 'a6_dr_awi')}</dt>
                <dd data-awiz-state={!hasAwizacja(load) ? 'none' : load.awizacja.confirmed ? 'confirmed' : 'open'}>
                  {!hasAwizacja(load)
                    ? <span style={{ color: 'var(--red)' }}>{ht(locale, 'p6b_awi_none')}</span>
                    : `${load.awizacja.loadWindowStart ? `${formatLoadPl(load.awizacja.loadWindowStart)} – ${formatLoadPl(load.awizacja.loadWindowEnd)} · ` : ''}${ht(locale, load.awizacja.confirmed ? 'p6b_awi_ok' : 'p6b_awi_open')}`}
                </dd>
              </dl>

              {/* AWIZ-4 — Dodaj / Edytuj poza Ustalenia */}
              {role === 'KSH' && (
                <div className="awiz-row" data-ksh-actions>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t(locale, 'b_ksh_dates_row')}</span>
                  <button type="button" className="btn" data-ksh-edit onClick={() => setKshDatesOpen(true)}>
                    {t(locale, 'b_ksh_edit')}
                  </button>
                </div>
              )}
              {canAwiz && (
                <div className="awiz-row" data-awiz-actions>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t(locale, 'a6_dr_awi')}</span>
                  <button type="button" className="btn" data-awiz-open onClick={() => setAwizOpen(true)}>
                    {hasAwizacja(load) ? t(locale, 'awiz_edit') : t(locale, 'awiz_add')}
                  </button>
                </div>
              )}
              {/* wyglad/P6-b (E17, E32): pojazdy pilotujące z „Ustaleń” do Przeglądu (te same firmy co dotąd: SCX i KSH); do awizacji SCX w P7 (09.10) */}
              {EscortPanel && isServerId(load.id) && (role === 'SCX' || role === 'KSH') && <Suspense fallback={null}><EscortPanel key={load.id} loadId={load.id} /></Suspense>}

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
                    <b>{t(locale, 'a6_dr_permit_missing_b')}</b> {tp(locale, load.resources.setLengthM != null ? 'a6_dr_permit_missing' : 'a6_dr_permit_missing_cargo', { l: fmtDim(comboL, locale) })}
                  </div>
                )
              ) : readyUiBlocked ? (
                <div className="banner red" style={{ margin: '13px 0 0' }}>
                  <b>{t(locale, 'a6_dr_permit_missing_b')}</b> {tp(locale, load.resources.setLengthM != null ? 'a6_dr_permit_missing' : 'a6_dr_permit_missing_cargo', { l: fmtDim(comboL, locale) })}
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
            <StatusAxisTab
              load={load}
              events={axisEvents}
              geofences={geofences}
              locale={locale}
              phone={phone}
              canStatus={canStatus}
              onChange={() => setStatusChangeOpen(true)}
              readyGaps={readyGaps}
              top={deliveredCard}
              marks={<StatusMarkers load={load} delayMin={load.delayed ? delayMin : null} />}
              role={role}
              documents={documents}
              bills={bills}
            />
          )}

          {/* wyglad/P6-b (E17 pkt 2): Historia „było → jest” po dniach, z filtrami — poza pierwszym wczytaniem */}
          {tab === 'history' && (
            <Suspense fallback={null}>
              <PanelHistory key={load.id} load={load} role={role} locale={locale} phone={phone} events={loadEvents} geofences={geofences} nowIso={nowIso} />
            </Suspense>
          )}

          {/* wyglad/P5 (E31 pkt 5, E33): zakładki „Dokumenty” i „Ceny” poza pierwszym wczytaniem (budżet 400 kB gzip) */}
          {tab === 'docs' && (
            <Suspense fallback={null}>
              <PanelDocs
                load={load}
                role={role}
                locale={locale}
                phone={phone}
                nowMs={nowMin * 60_000}
                docs={loadDocs}
                insAuto={insAuto}
                onPreview={setPreviewDoc}
                permitForm={PermitForm && isServerId(load.id) ? <Suspense fallback={null}><PermitForm key={load.id} loadId={load.id} /></Suspense> : null}
              />
            </Suspense>
          )}

          {tab === 'pricing' && (
            <Suspense fallback={null}>
              <PanelPrices
                load={load}
                role={role}
                locale={locale}
                phone={phone}
                nowIso={nowIso}
                legacyFees={isServerId(load.id) ? <AgreedFeeForm loadId={load.id} locale={locale} role={role} /> : null}
              />
            </Suspense>
          )}

          {/* wyglad/P6-b (E17, decyzje 20:57): „Czat” — sama rozmowa. Link dla kierowcy, „Przypisz SCX” (automat, E9),
              symulacja strefy, kopie zasobów i awizacji (Przegląd, E32) oraz wymiary zestawu u SCX (D-83) — usunięte. */}
          {tab === 'chat' && (
            <Suspense fallback={null}>
              <PanelChat
                key={load.id}
                loadId={load.id}
                role={role}
                locale={locale}
                phone={phone}
                messages={chatMsgs}
                onSend={(text, vis) => sendMessage(load.id, text, vis)}
              />
            </Suspense>
          )}
        </div>
      </aside>
      <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      {awizOpen ? <Suspense fallback={null}><AwizacjaModal load={load} onClose={() => setAwizOpen(false)} /></Suspense> : null}
      {kshDatesOpen && role === 'KSH' ? <KshDatesModal load={load} onClose={() => setKshDatesOpen(false)} /> : null}
      {statusChangeOpen && canStatus ? (
        <Suspense fallback={null}>
          <StatusChangeModal
            loadId={load.id}
            code={load.code}
            current={load.status}
            onClose={() => setStatusChangeOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
