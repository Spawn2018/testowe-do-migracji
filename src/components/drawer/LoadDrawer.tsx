import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { CorridorMap } from '../map/LazyCorridorMap';
import { StatusPill } from '../ui/StatusPill';
import { t, tp } from '../../i18n/messages';
import { canChangeLoadStatus } from '../../lib/permissions';
import { transportLabel } from '../../lib/transportName';
import { DocPreview } from '../ui/DocPreview';
import { KshDatesModal } from './KshDatesModal';
import { StatusAxisTab } from './StatusAxisTab';
import { TrackingBar } from './TrackingBar';
import { DeliveredCheckCard } from './DeliveredCheckCard';
import { deliveredCheckOf, readyGapsOf, trackingLinkOf } from '../../lib/p4cSource';
import { deliveredCheckResolve } from '../../lib/deliveredCheckResolve';
import { lazyRetry } from '../../lib/lazyRetry';
import { useEtaWx } from '../../lib/e49WxSource';
import { buildStatusAxis } from '../../lib/statusAxis';
import { trackingPhase } from '../../lib/stageTiles';
import { useIsPhone } from '../../lib/useIsPhone';
import { getNow } from '../../lib/frozenNow';
import { delayMinutesVsPlan } from '../../lib/time';
import { formatDelayPill, StatusMarkers } from '../ui/StatusPill';
import { AgreedFeeForm } from './AgreedFeeForm';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { isServerId } from '../../data/registry';
import { chatMeOf, chatMessagesOf, chatReadsOn, chatUnread, historyEventsOf } from '../../lib/p6bSource';
import { htn } from '../../i18n/p6b';
import { pt } from '../../i18n/p7';
import { dayShort, isoWeek } from '../../lib/p7Awiz';
import { PROD_BUILD } from '../../lib/prodFacade';
import { delayPillMinutes } from '../../lib/prodDash';
import { accountRole } from '../../lib/accountRole';
/* SCOPE 6.4 — formularz zezwoleń: tylko build Supabase, chunk leniwy (paczka demo bez niego) */
const PermitForm = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../../auth/PermitForm'))) : null;
/* wyglad/P4-c: okna awizacji i „Zmień status” poza pierwszym wczytaniem (budżet 400 kB gzip, scripts/bundle-size.mjs) */
const AwizacjaModal = lazy(lazyRetry(() => import('./AwizacjaModal').then((m) => ({ default: m.AwizacjaModal }))));
const StatusChangeModal = lazy(lazyRetry(() => import('./StatusChangeModal').then((m) => ({ default: m.StatusChangeModal }))));
const PanelDocs = lazy(lazyRetry(() => import('./PanelDocs').then((m) => ({ default: m.PanelDocs }))));
const PanelPrices = lazy(lazyRetry(() => import('./PanelPrices').then((m) => ({ default: m.PanelPrices }))));
/* wyglad/P6-b: „Historia” i „Czat” (E17) poza pierwszym wczytaniem */
const PanelHistory = lazy(lazyRetry(() => import('./PanelHistory').then((m) => ({ default: m.PanelHistory }))));
const PanelChat = lazy(lazyRetry(() => import('./PanelChat').then((m) => ({ default: m.PanelChat }))));
/* wyglad/P7-a: „Przegląd” (E32) poza pierwszym wczytaniem */
const PanelOverview = lazy(lazyRetry(() => import('./PanelOverview').then((m) => ({ default: m.PanelOverview }))));
const CarrierRating = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('../../auth/CarrierRating'))) : null;
/* III-4 — pojazdy pilotujące z bazy (load_escorts): tylko build Supabase; w Przeglądzie do czasu pilotów w awizacji (P7) */
/* E32 (zmiana 09.10): stara lista pilotów (EscortPanel) nie pokazuje się — piloci tylko w awizacji przy „PL + SE” (D-20261015-0130-01 P3) */

type Tab = 'overview' | 'timeline' | 'history' | 'docs' | 'pricing' | 'chat';

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
  const risks = useTowerStore((s) => s.risks);
  const sendMessage = useTowerStore((s) => s.sendMessage);
  const pushToast = useTowerStore((s) => s.pushToast);
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
  /* wyglad/P4-c (L14): sprawa zamknięta „Nie” — karta znika; A2: produkcja przez delivered_check_resolve */
  const [dcClosed, setDcClosed] = useState<string | null>(null);
  const [dcBusy, setDcBusy] = useState(false);
  /* wyglad/E49: linie wiatru / postoju / śliskości / objazdu w ETA (produkcja: `etaDetail.weather`; demo dociągane) */
  const etaWx = useEtaWx(load, loads, nowIso);

  if (!load) return null;

  const canStatus = canChangeLoadStatus(role, accountRole(role));
  const delayMin = delayPillMinutes(load, delayMinutesVsPlan(load.etaBoden, load.plannedDeliverDate, load.planDates?.deliveryTo ?? load.awizacja?.unloadWindowEnd), PROD_BUILD);
  const delayPillText = delayMin === null ? t(locale, 'i2_delay_pill') : formatDelayPill(delayMin);

  /* E25: oś statusów raz na render — data dostawy i wjazd na plac do bloku ETA */
  const statusAxis = buildStatusAxis(load, axisEvents);
  /* wyglad/P4-c: link śledzenia z serwera (E44), braki do „Gotowy” (L6, L9, L29), sprawa „czy dostarczono?” (L14) */
  const trackingLink = trackingLinkOf(load, loads, nowIso);
  const readyGaps = readyGapsOf(load, loadDocs, documents);
  const dcRaw = deliveredCheckOf(load, loads, geofences, nowIso, role, loadEvents);
  const deliveredCheck = dcRaw && dcRaw.id !== dcClosed ? dcRaw : null;
  const onDcYes = deliveredCheck
    ? () => {
      if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
        setLoadStatus(load.id, 'DELIVERED', role, tp(locale, 'p4c_dc_note_yes', { n: deliveredCheck.minutes }), deliveredCheck.exitAt);
        return;
      }
      setDcBusy(true);
      void deliveredCheckResolve(load.id, true, null).then(async (r) => {
        setDcBusy(false);
        if (!r.ok) { pushToast(r.error ?? t(locale, 'p4c_dc_no_done'), 'HIGH', load.id); return; }
        setDcClosed(deliveredCheck.id);
        const { refreshFromServer } = await import('../../data/supabaseBridge');
        await refreshFromServer({ keepSelection: true });
      });
    }
    : undefined;
  const onDcNo = deliveredCheck
    ? () => {
      if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
        setDcClosed(deliveredCheck.id);
        useTowerStore.getState().appendEvent({ loadId: load.id, type: 'NOTE', at: nowIso, actor: role, note: tp(locale, 'p4c_dc_note_no', { n: deliveredCheck.minutes }) });
        pushToast(t(locale, 'p4c_dc_no_done'), 'LOW', load.id);
        window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.drawer [data-action="change-status"]')?.focus());
        return;
      }
      setDcBusy(true);
      void deliveredCheckResolve(load.id, false, null).then(async (r) => {
        setDcBusy(false);
        if (!r.ok) { pushToast(r.error ?? t(locale, 'p4c_dc_no_done'), 'HIGH', load.id); return; }
        setDcClosed(deliveredCheck.id);
        pushToast(t(locale, 'p4c_dc_no_done'), 'LOW', load.id);
        const { refreshFromServer } = await import('../../data/supabaseBridge');
        await refreshFromServer({ keepSelection: true });
        window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.drawer [data-action="change-status"]')?.focus());
      });
    }
    : undefined;
  const deliveredCard = deliveredCheck ? (
    <DeliveredCheckCard
      check={deliveredCheck}
      locale={locale}
      busy={dcBusy}
      onYes={onDcYes}
      onNo={onDcNo}
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
            {/* wyglad/P7-a (E17, E32 telefon): panel na cały ekran ze strzałką wstecz */}
            {phone ? (
              <button type="button" className="iconbtn wb-back" aria-label={pt(locale, 'p7_back')} onClick={() => selectLoad(null)}>
                ←
              </button>
            ) : null}
            {/* wyglad/P5 (E8): nazwa i znaczniki zawijają się, „✕” zostaje w rogu przy 360 px (HHL: kod · numer zlecenia) */}
            <div className="r1-l">
              {(() => {
                /* E41, E32: „SG-15 brak nr HHL” — brak numeru na czerwono */
                const label = transportLabel(load, role, 'panel');
                const m = / (brak nr (?:HHL|SCX))$/.exec(label);
                return m
                  ? <span className="wb-code" data-content>{label.slice(0, m.index)} <span className="wb-miss">{m[1]}</span></span>
                  : <span className="wb-code" data-content>{label}</span>;
              })()}
              <StatusPill status={load.status} stage={load.stage} />
              {load.delayed ? <span className="pill p-red">{delayPillText}</span> : null}
            </div>
            {!phone ? (
              <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={() => selectLoad(null)}>
                ✕
              </button>
            ) : null}
          </div>
          {/* E32: odbiorca, załadunek i dostawa z dniem tygodnia i tygodniem; na telefonie — w „Planie” Przeglądu */}
          {!phone ? (
            <div className="wb-fields">
              <span>
                <b>{t(locale, 'a6_dr_consignee')}</b>
                <em>{t(locale, 'a6_dr_consignee_val')}</em>
              </span>
              <span>
                <b>{t(locale, 'a6_dr_loading')}</b>
                <em data-hd-load>{dayShort(load.plannedLoadDate)}{isoWeek(load.plannedLoadDate) != null ? ` · ${tp(locale, 'a6_dr_week_val', { n: isoWeek(load.plannedLoadDate)! })}` : ''}</em>
              </span>
              <span>
                <b>{t(locale, 'a6_dr_delivery')}</b>
                <em data-hd-deliver>{dayShort(load.plannedDeliverDate)}{isoWeek(load.plannedDeliverDate) != null ? ` · ${tp(locale, 'a6_dr_week_val', { n: isoWeek(load.plannedDeliverDate)! })}` : ''}</em>
              </span>
            </div>
          ) : null}
          <div className="perf" />
        </div>

        {/* E27 pkt 5 (E1-2): pasek śledzenia nad zakładkami */}
        <TrackingBar load={load} events={loadEvents} locale={locale} nowIso={nowIso} trackingLink={trackingLink} />

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
              {/* wyglad/P7-a (E32): Przegląd poza pierwszym wczytaniem (budżet 400 kB gzip) */}
              <Suspense fallback={null}>
                <PanelOverview
                  key={load.id}
                  load={load}
                  loads={loads}
                  role={role}
                  locale={locale}
                  phone={phone}
                  nowIso={nowIso}
                  events={loadEvents}
                  docs={loadDocs}
                  risks={risks}
                  sailings={sailings}
                  insAuto={insAuto}
                  deliveredAt={statusAxis.deliveredAt}
                  siteSince={statusAxis.current === 'APPROACHING_SITE' ? statusAxis.currentSince : null}
                  delayMin={delayMin}
                  wx={etaWx}
                  mapNode={<CorridorMap loads={drawerMapLoads} embedded slot="drawer" />}
                  ratingNode={CarrierRating && (role === 'HHL' || role === 'SCX') && isServerId(load.id) ? <Suspense fallback={null}><CarrierRating key={load.id} loadId={load.id} /></Suspense> : null}
                  onAwiz={() => setAwizOpen(true)}
                  onKshDates={() => setKshDatesOpen(true)}
                  onTab={(x) => switchTab(x)}
                  onPdf={() => {
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
                />
              </Suspense>
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
            code={transportLabel(load, role, 'plain')}
            current={load.status}
            onClose={() => setStatusChangeOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
