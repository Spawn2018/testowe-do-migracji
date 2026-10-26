import { PROD_BUILD } from '../lib/prodFacade';
import { LiveMark } from '../components/shell/LiveMark';
import { delayPillMinutes } from '../lib/prodDash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoicedLoadIds } from '../lib/importRemoval';
import { MAP_FIELDS_CREATOR as MAP_FIELDS_UI, REQUIRED_FIELDS as REQUIRED_FIELDS_UI, type PartialColumnMap } from '../lib/importMapping';
import { useTowerStore } from '../store/useTowerStore';
import { filterLoads } from '../lib/selectors';
import { canImportSchedule, filterLoadsForRole } from '../lib/permissions';
import { hasKey, t, tp } from '../i18n/messages';
import {
  delayMinutesVsPlan,
  fmtDateTime,
} from '../lib/time';
import { getNowIso } from '../lib/frozenNow';
// D15: ExcelJS (~1 MB) tylko przy imporcie/eksporcie — dynamiczny import.
import type { ImportDiff } from '../lib/scheduleDryRun';
import { COLUMN_MAP_DEFAULT } from '../lib/importColumnMap';
import type { Load } from '../types';
/* wyglad/P7-c (E38 1A, E30, E20): układ pliku KSH, „Widok skrócony”, filtry tygodniem i stanem, karty na telefonie */
import {
  exportName, FILE_COLS, fileColsFor, inRange, loadSchedLayout, QUICKS, quickMatch, saveSchedLayout, shortExtrasFor, todayPl, weekPicks,
  DEFAULT_LAYOUT, SHORT_EXTRAS, type Quick, type SchedLayout,
} from '../lib/schedLayout';
import { FileTable, SchedCards, ShortTable, type SchedRowCtx } from '../components/schedule/SchedTables';
import { s7, s7p } from '../i18n/sched7';
import { cmrAfterDelivery, docStatusRows } from '../lib/docRequirements';
import { useDocReqCache } from '../lib/docReqCache';
import { firmDocRows, firmPermitLoad } from '../lib/permitKind';
import { docRequirementsStart, marginThresholdOf, permitsOf } from '../lib/p5Source';
import '../components/schedule/sched7.css';
import { SailingsPanel } from './SailingsPanel';
import { sv, svp } from '../i18n/sail7';
import { sailTime } from '../lib/sailView';
import { effDeparture } from '../lib/sailings';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import type { ServerImportDraft } from '../data/scheduleImportServer';
import { accountRole } from '../lib/accountRole';
import { importSkipText, standardSkipMessage } from '../lib/standardSkipMessage';
import { plPlural } from '../lib/plPlural';
import { StageBar, StageChip } from '../components/shell/StageBar';
import { useIsPhone } from '../lib/useIsPhone';
import { kshSyncLine, kshSyncOf } from '../lib/kshSyncView';
import { KshPreviewPanel } from '../components/schedule/KshPreviewPanel';

/** I-1: import w produkcji przez import_schedule() w bazie (podgląd i zapis w jednej transakcji). */
const SERVER_IMPORT = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED;

type ImportStep = null | 'upload' | 'colmap' | 'map' | 'diff' | 'done';

/** Demo: ostatnia wersja pliku KSH (ta sama linia co w produkcji z `schedule_imports`). */
const DEMO_FILE_VER = { v: '7', at: '2026-09-21T14:08:00+02:00' } as const;

/** III-2: krótki szkielet tabeli po wejściu w widok (używane też w testach). */
export const SKELETON_MS = 260;

function delayMinutes(l: Load): number | null {
  return delayPillMinutes(l, delayMinutesVsPlan(l.etaBoden, l.plannedDeliverDate, l.planDates?.deliveryTo ?? l.awizacja?.unloadWindowEnd), PROD_BUILD);
}

/** Zamyka okienko po Escape i kliknięciu obok (Kolumny, Więcej). */
function useDismiss(open: boolean, close: () => void, ref: { current: HTMLElement | null }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [open, close, ref]);
}

export function ScheduleView() {
  /* M10 — rozkład rejsów jako druga zakładka harmonogramu (seg) */
  /* wyglad/W-cele-przejsc (d): wiersz promu z „Sytuacji na trasie” otwiera Rejsy */
  const [schedTab, setSchedTab] = useState<'loads' | 'sailings'>(() => (useTowerStore.getState().sailingFocus ? 'sailings' : 'loads'));
  const sailingFocus = useTowerStore((s) => s.sailingFocus);
  useEffect(() => { if (sailingFocus) setSchedTab('sailings'); }, [sailingFocus]);
  const loads = useTowerStore((s) => s.loads);
  const documents = useTowerStore((s) => s.documents);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const search = useTowerStore((s) => s.search);
  const setSearch = useTowerStore((s) => s.setSearch);
  /* E41 (08.10): KSH szuka tylko po kodzie — podpowiedź bez „nr zlecenia” (filtr: `transportSearchBlob`) */
  const searchKey = role === 'KSH' ? 's7_search_ksh' : 's7_search';
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const hoverLoadId = useTowerStore((s) => s.hoverLoadId);
  const setHoverLoad = useTowerStore((s) => s.setHoverLoad);
  const scheduleVersions = useTowerStore((s) => s.scheduleVersions);
  const commitImport = useTowerStore((s) => s.commitImport);
  const pushToast = useTowerStore((s) => s.pushToast);

  const [step, setStep] = useState<ImportStep>(null);
  const [filename, setFilename] = useState('KSH_HARMONOGRAM.xlsx');
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<ImportDiff | null>(null);
  /* D26 — usunięcia wyłącznie za wyraźną zgodą (domyślnie odznaczone, reset przy każdym pliku) */
  const [allowRemovals, setAllowRemovals] = useState(false);
  /* #426: import bez powiadomień — tylko Administrator HHL (baza sprawdza to samo). */
  const [quietImport, setQuietImport] = useState(false);
  const canQuietImport = SERVER_IMPORT && accountRole(role) === 'HHL_ADMIN';
  const [dateChangeRows, setDateChangeRows] = useState<NonNullable<ServerImportDraft['preview']['confirmed']>>([]);
  const serverDraft = useRef<ServerImportDraft | null>(null);
  const [serverNote, setServerNote] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  /* I-22 — kreator mapowania kolumn (plik w innym układzie niż domyślny KSH) */
  const [colHeaders, setColHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<PartialColumnMap>({});
  const [activeMap, setActiveMap] = useState<PartialColumnMap | null>(null);
  const [tplName, setTplName] = useState('');
  const pendingBuf = useRef<ArrayBuffer | null>(null);
  const [quick, setQuick] = useState<Quick>('all');
  /* wyglad/P4 (E8, E28): telefon — działania pod „⋯”, daty i reszta filtrów pod „Filtry ▾” */
  const phone = useIsPhone();
  const [actionsOpen, setActionsOpen] = useState(false);
  /* „⋯” zamyka się po działaniu, Escape i dotknięciu obok.
     Escape łapany w fazie przechwytywania i zatrzymany: zamyka tylko menu, filtr etapu i otwarty transport zostają (skrót globalny w App).
     Dotknięcie obok tylko zamyka menu — nie klika tego, co pod spodem. */
  const morePopRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!actionsOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setActionsOpen(false);
      moreBtnRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const el = morePopRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setActionsOpen(false);
      /* jedno kliknięcie po tym dotknięciu nie dochodzi do elementu pod spodem (np. wiersza transportu) */
      const stop = (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', stop, true), 800);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [actionsOpen]);
  /* III-2 (SCOPE 0.9, makieta go()): krótki szkielet tabeli po wejściu w widok — wiersze w rytmie tabeli, nigdy spinner */
  const [skeleton, setSkeleton] = useState(true);
  useEffect(() => { const id = window.setTimeout(() => setSkeleton(false), SKELETON_MS); return () => window.clearTimeout(id); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  /* E30 pkt 2: układ kolumn na koncie (dziś w tej przeglądarce — D-20261016-1020-01), bez „Zapisz widok” */
  const [layout, setLayoutState] = useState<SchedLayout>(() => loadSchedLayout());
  const setLayout = (next: SchedLayout) => { setLayoutState(next); saveSchedLayout(next); };
  const [colsOpen, setColsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const closeCols = useCallback(() => setColsOpen(false), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useDismiss(colsOpen, closeCols, colsRef);
  useDismiss(moreOpen, closeMore, moreRef);
  /* E30 pkt 3: tydzień załadunku i dostawy (pon–nd, jak E39) albo własny zakres */
  const [loadPick, setLoadPick] = useState('all');
  const [delivPick, setDelivPick] = useState('all');
  /* E30 pkt 7: kliknięcie kodów w Rejsach filtruje Harmonogram do transportów tego rejsu */
  const [sailPick, setSailPick] = useState<string | null>(null);
  const sailings = useTowerStore((s) => s.sailings);


  // B-9 C: ten sam filtr kafelka (stageFilter) działa też w Harmonogramie
  const stageFilter = useTowerStore((s) => s.stageFilter);
  /* kafelek paska pokazuje transporty — z zakładki „Rejsy” wracamy do „Transporty”, żeby filtr był widoczny */
  const [prevStage, setPrevStage] = useState(stageFilter);
  if (stageFilter !== prevStage) {
    setPrevStage(stageFilter);
    if (stageFilter) setSchedTab('loads');
  }
  const [loadFrom, setLoadFrom] = useState('');
  const [loadTo, setLoadTo] = useState('');
  const [delivFrom, setDelivFrom] = useState('');
  const [delivTo, setDelivTo] = useState('');
  const base = useMemo(
    () => filterLoads(loads, role, stageFilter, search),
    [loads, role, stageFilter, search],
  );

  const nowIso = getNowIso();
  const picks = useMemo(() => weekPicks(nowIso), [nowIso]);
  const rangeOf = (pick: string, from: string, to: string) => (pick === 'all' ? null
    : pick === 'range' ? (from || to ? { from, to } : null)
      : picks.find((p) => p.id === pick) ?? null);
  const loadRange = rangeOf(loadPick, loadFrom, loadTo);
  const delivRange = rangeOf(delivPick, delivFrom, delivTo);
  const pre = useMemo(
    () => base.filter((l) => inRange(l.plannedLoadDate, loadRange) && inRange(l.plannedDeliverDate, delivRange) && (!sailPick || l.sailingId === sailPick)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, loadRange?.from, loadRange?.to, delivRange?.from, delivRange?.to, sailPick],
  );
  /* E30 pkt 3: liczba przy każdym filtrze stanu = wiersze po kliknięciu (po pozostałych filtrach) */
  const counts = useMemo(() => Object.fromEntries(QUICKS.map((q) => [q, pre.filter((l) => quickMatch(l, q)).length])) as Record<Exclude<Quick, 'all'>, number>, [pre]);
  const list = useMemo(() => pre.filter((l) => quickMatch(l, quick)), [pre, quick]);
  const ver = scheduleVersions[0];
  const skippedNote = ver?.skippedStandard
    ? ` · pominięto ${ver.skippedStandard} ${plPlural(ver.skippedStandard, 'wiersz', 'wiersze', 'wierszy')} typu STANDARD`
    : '';
  /* E30 pkt 8 (audyt-B B-09): „Plik KSH: wersja 7 z 21.09.2026, 14:08” — bez „SharePoint” (dostępu jeszcze nie ma, E38);
     produkcja: ta sama postać z ostatniego importu (schedule_imports), nazwa pliku w podpowiedzi */
  const verLine = (SERVER_IMPORT
    ? ver
      ? tp(locale, 'i1_ver_line', { v: ver.by.replace(/^v/, ''), at: fmtDateTime(ver.at) })
      : t(locale, 'i1_ver_none')
    : tp(locale, 'i1_ver_line', { v: DEMO_FILE_VER.v, at: fmtDateTime(DEMO_FILE_VER.at) })) + skippedNote;
  const verTitle0 = SERVER_IMPORT && ver?.filename ? ver.filename : undefined;
  /* wyglad/P7-e (W13 zasada 15, D-20261016-1230-01 pkt 5.6): gdy wykonawca poda stan synchronizacji — „Plik KSH (SharePoint): zsynchronizowano …” */
  const kshSync = useTowerStore((s) => kshSyncOf(s));
  const syncLine = kshSync ? kshSyncLine(kshSync, getNowIso()) : null;
  const fileLine = syncLine ? syncLine.text : verLine;
  const verTitle = syncLine ? syncLine.title : verTitle0;
  /* W-567 (decyzja 23B): lista zmian z pliku KSH — tylko produkcja (demo nie ma stanu synchronizacji), Administrator/Operacje HHL,
     dopóki import z pliku jest wyłączony; panel sam znika, gdy baza nie ma `ksh_sync_preview_get` albo zwraca null */
  const viewerKind = accountRole(role);
  const showKshPreview = SERVER_IMPORT && !!kshSync && kshSync.importEnabled !== true
    && role === 'HHL' && (viewerKind === 'HHL_ADMIN' || viewerKind === 'HHL_OPS');

  const mapKeys = activeMap ? Object.entries(activeMap) : Object.entries(COLUMN_MAP_DEFAULT);

  async function acceptFile(f: File | undefined) {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name) && !/\.xls$/i.test(f.name)) {
      pushToast('Akceptowane: .xlsx', 'HIGH');
      return;
    }
    setFilename(f.name);
    setParseError(null);
    setDryRun(null);
    setAllowRemovals(false);
    setQuietImport(false);
    setDateChangeRows([]);
    setParsing(true);
    serverDraft.current = null;
    setServerNote(null);
    setActiveMap(null);
    let fileRead = false;
    try {
      const buf = await f.arrayBuffer();
      const { readXlsxHeaders } = await import('../lib/xlsxRead');
      const mapping = await import('../lib/importMapping');
      const headers = await readXlsxHeaders(buf);
      fileRead = true;
      if (!mapping.defaultLayoutFits(headers)) {
        const templates = SERVER_IMPORT
          ? await (await import('../data/scheduleImportServer')).loadTemplates()
          : mapping.demoTemplates();
        const sug = mapping.suggestMap(headers, templates);
        if (sug.template && mapping.missingRequired(sug.map).length === 0) {
          pushToast(tp(locale, 'i22_tpl_used', { name: sug.template.name }), 'MEDIUM');
          await runDryRun(buf, f.name, sug.map);
          return;
        }
        pendingBuf.current = buf;
        setColHeaders(headers);
        setColMap(sug.map);
        setTplName(f.name.replace(/\.xlsx?$/i, ''));
        setStep('colmap');
        return;
      }
      await runDryRun(buf, f.name, null);
    } catch (e) {
      if (SERVER_IMPORT && !fileRead) {
        const { reportUnreadableKshFile } = await import('../data/scheduleImportServer');
        await reportUnreadableKshFile(f.name);
      }
      /* E21: błąd biblioteki odczytu (np. „Can't find end of central directory”) nie trafia na ekran — zdanie po polsku */
      setParseError(fileRead ? (e instanceof Error ? e.message : String(e)) : s7(locale, 's7_xlsx_unreadable'));
      setStep('upload');
      pushToast(t(locale, 'a6_sch_xlsx_fail'), 'CRITICAL');
    } finally {
      setParsing(false);
    }
  }

  /** Podgląd importu (serwer albo demo) z mapowaniem kolumn; null = układ domyślny KSH. */
  async function runDryRun(buf: ArrayBuffer, name: string, map: PartialColumnMap | null) {
    setActiveMap(map);
    if (SERVER_IMPORT) {
      const { serverDryRun } = await import('../data/scheduleImportServer');
      const draft = await serverDryRun(buf, name, map ?? undefined);
      serverDraft.current = draft;
      setDateChangeRows(draft.preview.confirmed ?? []);
      setServerNote(tp(locale, 'i1_preview', { ms: String(draft.preview.ms), carrier: draft.preview.carrier ?? '—', same: String(draft.preview.unchanged) }));
      setDryRun(draft.diff);
      setStep('map');
      return;
    }
    const { dryRunFromXlsx } = await import('../lib/scheduleDryRun');
    const { toFullMap } = await import('../lib/importMapping');
    const st = useTowerStore.getState();
    const diff = await dryRunFromXlsx(buf, name, st.loads, map ? toFullMap(map) : undefined, invoicedLoadIds(st.bills, st.invoices));
    setDryRun(diff);
    setStep('map');
  }

  /** I-22: zapis szablonu mapowania i podgląd importu. */
  async function saveTemplateAndRun() {
    const buf = pendingBuf.current;
    if (!buf) return;
    setParsing(true);
    try {
      const mapping = await import('../lib/importMapping');
      const tpl = { name: tplName.trim() || filename, column_map: colMap, header_signature: mapping.headerSignature(colHeaders) };
      if (SERVER_IMPORT) await (await import('../data/scheduleImportServer')).saveTemplate(tpl);
      else mapping.demoSaveTemplate(tpl);
      pushToast(tp(locale, 'i22_tpl_saved', { name: tpl.name }), 'MEDIUM');
      await runDryRun(buf, filename, colMap);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setParseError(msg);
      pushToast(tp(locale, 'i22_tpl_fail', { msg }), 'CRITICAL');
    } finally {
      setParsing(false);
    }
  }

  /* wyglad/P7-c (E28 pkt 2, E30 pkt 3): filtry stanu z liczbami — Opóźnione, Bez dokumentów, Bez kierowcy, Bez ciągnika, Anulowane */
  const chipBtn = (q: Exclude<Quick, 'all'>) => (
    <button key={q} type="button" className="chipbtn s7-chip" data-quick={q} aria-pressed={quick === q} onClick={() => setQuick(quick === q ? 'all' : q)}>
      {s7(locale, `s7_q_${q}`)} · <em className="chip-n">{counts[q]}</em>
    </button>
  );
  const fileCols = fileColsFor(role, layout.fileHidden);
  const extrasAllowed = shortExtrasFor(role);
  const extras = layout.shortExtras.filter((x) => extrasAllowed.includes(x));
  const activeFilters = (quick !== 'all' ? 1 : 0) + (loadPick !== 'all' ? 1 : 0) + (delivPick !== 'all' ? 1 : 0) + (sailPick ? 1 : 0);
  const clearFilters = () => { setQuick('all'); setLoadPick('all'); setDelivPick('all'); setLoadFrom(''); setLoadTo(''); setDelivFrom(''); setDelivTo(''); setSailPick(null); };
  const pickedSailing = sailPick ? sailings.find((x) => x.id === sailPick) ?? null : null;
  const sailChip = pickedSailing ? (
    <button type="button" className="chipbtn s7-chip" aria-pressed="true" data-sail-filter={pickedSailing.id} title={sv(locale, 'sv_filter_clear')} onClick={() => setSailPick(null)}>
      {svp(locale, 'sv_filter', { vessel: pickedSailing.vessel, t: sailTime(effDeparture(pickedSailing)) })} ✕
    </button>
  ) : null;

  /* E31: stan dokumentów jak na stronie Dokumenty i w panelu (baza po wejściu na Dokumenty; demo — reguły startowe) */
  /* D-20261020-1118-01: stan z bazy przy wejściu na Harmonogram (nie dopiero po stronie Dokumenty) */
  /* odświeżenie także po zmianie statusów (np. „Dostarczone” — CMR zaczyna się liczyć) */
  const docCache = useDocReqCache(`${documents.length}|${list.map((l) => l.status).join(',')}`);
  const reqs = docCache?.reqs ?? docRequirementsStart();
  const nowMs = Date.parse(nowIso);
  const docByLoad = useMemo(() => {
    /* CMR liczy się dopiero po „Dostarczone” (decyzja właściciela 18.10, 17:28) — „brak CMR” nie przy transportach w drodze */
    const st = new Map(list.map((l) => [l.id, l.status]));
    const rows = cmrAfterDelivery(docCache ? docCache.status : PROD_BUILD ? [] : docStatusRows(list, documents, reqs, nowMs), (id) => st.get(id));
    const m = new Map<string, typeof rows>();
    for (const r of rows) { const a = m.get(r.loadId) ?? []; a.push(r); m.set(r.loadId, a); }
    /* D-20261020-1118-01: przy zezwoleniu firmowym bez wierszy „zezwolenie PL / SE” (jak w panelu) */
    /* F7 #355 B1: zezwolenie firmowe ważne w dniu załadunku = dokument transportu w porządku (bez „–” przed dostawą) */
    const permits = permitsOf(list);
    for (const l of list) {
      if (!firmPermitLoad(l)) continue;
      m.set(l.id, firmDocRows(m.get(l.id) ?? [], l, permits));
    }
    return m;
  }, [docCache, list, documents, reqs, nowMs]);
  const marginMin = marginThresholdOf();
  const ctx: SchedRowCtx = {
    locale, role, currency, marginMin, reqs,
    docRows: (id) => docByLoad.get(id) ?? [],
    delayOf: delayMinutes,
    hoverLoadId, selectedLoadId, setHover: setHoverLoad, onOpen: selectLoad,
  };

  const schedTabs = (
    <div className="seg" role="group" aria-label={t(locale, 'nav_sched')} data-sched-tabs>
      {(['loads', 'sailings'] as const).map((k) => (
        <button key={k} type="button" data-sched-tab={k} aria-pressed={schedTab === k} onClick={() => setSchedTab(k)}>
          {k === 'loads' && phone ? tp(locale, 'p4_tab_loads', { n: filterLoadsForRole(loads, role).length }) : t(locale, k === 'loads' ? 'sched_tab_loads' : 'sched_tab_sailings')}
        </button>
      ))}
    </div>
  );
  if (schedTab === 'sailings') {
    return (
      <div className="panel section-card page-sections" data-page="schedule" style={{ margin: 12 }}>
        <div className="panel-hd" style={{ flexWrap: 'wrap' }}>
          <h2>{t(locale, 'nav_sched')}</h2>
          <span className="sub sv-route">{sv(locale, 'sv_sub')}</span>
          <LiveMark />
          <div className="spacer" />
          {schedTabs}
        </div>
        <SailingsPanel phone={phone} onShowLoads={(id) => { setSailPick(id); setSchedTab('loads'); }} />
      </div>
    );
  }

  /* E30 pkt 4: eksport tego, co widać — wiersze po filtrach; nazwa pliku z firmą, tygodniem i datą */
  const weekLabel = loadRange && loadPick !== 'range' ? picks.find((p) => p.id === loadPick)?.label ?? null : null;
  const doExport = (kind: 'xlsx' | 'pdf') => {
    void (async () => {
      const name = exportName(role, weekLabel, todayPl(nowIso), kind);
      try {
        if (kind === 'xlsx') {
          const { exportLoadsXlsx } = await import('../lib/xlsxExport');
          const result = await exportLoadsXlsx(list, role, name);
          pushToast(tp(locale, 'a6_sch_export_ok', { rows: String(result.rows), bytes: String(result.bytes) }), 'MEDIUM');
        } else {
          const { exportLoadsPdf } = await import('../lib/pdfExport');
          const result = await exportLoadsPdf(list, name, tp(locale, 'i24_pdf_title', { n: String(list.length) }), locale);
          pushToast(tp(locale, 'i24_sch_pdf_ok', { rows: String(result.rows), bytes: String(result.bytes) }), 'MEDIUM');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pushToast(tp(locale, kind === 'xlsx' ? 'a6_sch_export_fail' : 'i24_sch_pdf_fail', { msg }), 'CRITICAL');
      }
    })();
  };
  /* „Więcej ▾” (E30 pkt 2, 4, 6): eksport, wgranie pliku KSH (zapas, tylko HHL), przywrócenie kolumn */
  const moreItems = (
    <>
      <button type="button" role="menuitem" data-action="export-xlsx" onClick={() => { setMoreOpen(false); setActionsOpen(false); doExport('xlsx'); }}>{s7(locale, 's7_m_xlsx')}</button>
      <button type="button" role="menuitem" data-action="export-pdf" onClick={() => { setMoreOpen(false); setActionsOpen(false); doExport('pdf'); }}>{s7(locale, 's7_m_pdf')}</button>
      {canImportSchedule(role) ? (
        <button type="button" role="menuitem" data-action="upload" disabled={parsing} onClick={() => { setMoreOpen(false); setActionsOpen(false); setStep('upload'); }}>{s7(locale, 's7_m_upload')}</button>
      ) : null}
      <button type="button" role="menuitem" data-action="reset-cols" onClick={() => { setMoreOpen(false); setActionsOpen(false); setLayout({ ...DEFAULT_LAYOUT, view: layout.view }); }}>{s7(locale, 's7_m_reset')}</button>
    </>
  );
  const colsMenu = (
    <div className="s7-pop s7-cols" role="menu" data-sched-cols-menu>
      {layout.view === 'file' ? (
        <>
          <b className="s7-pop-h">{s7(locale, 's7_cols_file')}</b>
          {FILE_COLS.filter((c) => !c.fixed && !(role === 'KSH' && (c.id === 'ordScx' || c.id === 'ordHhl'))).map((c) => {
            const on = !layout.fileHidden.includes(c.id);
            const label = c.id === 'loadDay' || c.id === 'loadTime' ? `${s7(locale, c.key)} (${s7(locale, 's7_c_load_date').toLocaleLowerCase('pl')})`
              : c.id === 'delivDay' || c.id === 'delivTime' ? `${s7(locale, c.key)} (${s7(locale, 's7_c_deliv_date').toLocaleLowerCase('pl')})`
                : s7(locale, c.id === 'money' ? 's7_c_money' : c.key);
            return (
              <label key={c.id} data-col-toggle={c.id}>
                <input type="checkbox" checked={on} onChange={() => setLayout({ ...layout, fileHidden: on ? [...layout.fileHidden, c.id] : layout.fileHidden.filter((x) => x !== c.id) })} />
                {label}
              </label>
            );
          })}
        </>
      ) : (
        <>
          <b className="s7-pop-h">{s7(locale, 's7_cols_extra')}</b>
          {SHORT_EXTRAS.filter((x) => extrasAllowed.includes(x.id)).map((x) => {
            const on = layout.shortExtras.includes(x.id);
            return (
              <label key={x.id} data-col-toggle={x.id}>
                <input type="checkbox" checked={on} onChange={() => setLayout({ ...layout, shortExtras: on ? layout.shortExtras.filter((y) => y !== x.id) : [...layout.shortExtras, x.id] })} />
                {s7(locale, x.key)}
              </label>
            );
          })}
        </>
      )}
    </div>
  );

  return (
    <div className="panel section-card page-sections" data-page="schedule" style={{ margin: 12, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="panel-hd s7-hd" style={{ flexWrap: 'wrap' }}>
        <h2>{t(locale, 'nav_sched')}</h2>
        <span className={`sub${syncLine?.tone === 'down' ? ' s7-sync-down' : ''}`} data-sched-file data-ksh-sync={syncLine?.tone} title={verTitle}>{fileLine}</span>
        <LiveMark />
        <div className="spacer" />
        {schedTabs}
        {phone ? null : (
          <div className="sched-actions s7-actions">
            <div className="s7-pop-wrap" ref={colsRef}>
              <button type="button" className="chipbtn" aria-expanded={colsOpen} data-sched-cols onClick={() => setColsOpen((v) => !v)}>{s7(locale, 's7_cols')}</button>
              {colsOpen ? colsMenu : null}
            </div>
            <button type="button" className="chipbtn" aria-pressed={layout.view === 'short'} aria-label={s7(locale, 's7_short_aria')} data-sched-short
              onClick={() => setLayout({ ...layout, view: layout.view === 'short' ? 'file' : 'short' })}>{s7(locale, 's7_short')}</button>
            <div className="s7-pop-wrap" ref={moreRef}>
              <button type="button" className="chipbtn" aria-expanded={moreOpen} aria-haspopup="menu" data-sched-more onClick={() => setMoreOpen((v) => !v)}>{s7(locale, 's7_more')} ▾</button>
              {moreOpen ? <div className="s7-pop s7-more" role="menu" data-sched-more-menu>{moreItems}</div> : null}
            </div>
          </div>
        )}
      </div>
      {showKshPreview && schedTab === 'loads' ? <KshPreviewPanel /> : null}

      {canImportSchedule(role) && step === 'upload' && (
        <div
          className="note"
          style={{
            margin: '0 12px 0',
            borderStyle: 'dashed',
            cursor: 'pointer',
            background: dragOver ? 'var(--amber-bg)' : undefined,
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void acceptFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !parsing && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !parsing && fileRef.current?.click()}
        >
          {parsing ? 'Odczyt XLSX…' : t(locale, 'import_drop')} · {filename}
          {parseError ? <div style={{ color: 'var(--red)', marginTop: 4 }}>{parseError}</div> : null}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={(e) => void acceptFile(e.target.files?.[0])}
          />
        </div>
      )}

      {canImportSchedule(role) && step && step !== 'upload' && (
        <div className="note" style={{ margin: '0 12px' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {t(locale, 'sched_upload')} · {filename}
            {dryRun ? (
              <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 8 }}>
                {tp(locale, 'p7_imp_head', { ok: dryRun.accepted, total: dryRun.total })}
                {dryRun.warnings ? ` · ${tp(locale, 'p7_imp_warn', { n: dryRun.warnings })}` : ''}
              </span>
            ) : null}
          </div>
          {serverNote ? <div data-import-server style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>{serverNote}</div> : null}
          {step === 'colmap' && (
            <div data-import-colmap>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>{t(locale, 'i22_intro')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, max-content) 1fr', gap: '4px 10px', fontSize: 12, marginBottom: 8 }}>
                {MAP_FIELDS_UI.map((f) => (
                  <label key={f} style={{ display: 'contents' }}>
                    <span data-content style={{ color: 'var(--ink)' }}>
                      {COLUMN_MAP_DEFAULT[f]}{REQUIRED_FIELDS_UI.includes(f) ? ' *' : ''}
                    </span>
                    <select
                      data-colmap-field={f}
                      value={colMap[f] ?? ''}
                      onChange={(e) => setColMap((m) => ({ ...m, [f]: e.target.value || undefined }))}
                    >
                      <option value="">{t(locale, 'i22_none')}</option>
                      {colHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {t(locale, 'i22_name')}{' '}
                <input data-colmap-name value={tplName} maxLength={80} onChange={(e) => setTplName(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn"
                data-action="colmap-save"
                disabled={parsing || REQUIRED_FIELDS_UI.some((f) => !colMap[f])}
                onClick={() => void saveTemplateAndRun()}
              >
                {t(locale, 'i22_save')}
              </button>{' '}
              <button type="button" className="chipbtn" onClick={() => setStep('upload')} disabled={parsing}>
                {t(locale, 'i22_back')}
              </button>
            </div>
          )}
          {step === 'map' && (
            <>
              <ul style={{ fontSize: 12, columns: phone ? 1 : 2, color: 'var(--ink-3)', margin: '0 0 8px' }}>
                {mapKeys.map(([k, v]) => (
                  <li key={k}>
                    <span style={{ color: 'var(--ink)' }}>{v}</span>{hasKey(locale, `p7_imp_f_${k}`) ? ` → ${t(locale, `p7_imp_f_${k}`)}` : null}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn" disabled={!dryRun} onClick={() => setStep('diff')}>
                {t(locale, 'dry_run')}
              </button>{' '}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setStep(null);
                  setDryRun(null);
                }}
              >
                {t(locale, 'cancel')}
              </button>
            </>
          )}
          {step === 'diff' && dryRun && (
            <>
              {/* wyglad/W-naprawy-2 · A6 + E21: podsumowanie słowami zamiast znaków „+ ~ − ⚠” */}
              <div style={{ fontSize: 13, marginBottom: 6 }} data-import-sum>
                <span style={{ color: dryRun.added.length ? 'var(--go)' : 'var(--ink-3)' }}>{t(locale, 'p7_imp_new')}: {dryRun.added.length}</span>
                {' · '}
                <span style={{ color: dryRun.changed.length ? 'var(--amber-ink)' : 'var(--ink-3)' }}>{t(locale, 'p7_imp_changed')}: {dryRun.changed.length}</span>
                {' · '}
                <span style={{ color: 'var(--ink-3)' }}>{t(locale, 'p7_imp_removed')}: <b data-import-removed-count>{allowRemovals ? dryRun.removalCandidates.length : 0}</b></span>
                {' · '}
                <span style={{ color: dryRun.rejected ? 'var(--red)' : 'var(--ink-3)' }}>{t(locale, 'p7_imp_rejected')}: {dryRun.rejected}</span>
              </div>
              {importSkipText({ carrier: dryRun.skippedCarrier, empty: dryRun.skippedEmpty, standard: dryRun.skippedStandard }) ? (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }} data-import-skipped>
                  {importSkipText({ carrier: dryRun.skippedCarrier, empty: dryRun.skippedEmpty, standard: dryRun.skippedStandard })}
                </div>
              ) : null}
              {dryRun.datesToCheck ? (
                <div style={{ fontSize: 12, color: 'var(--amber-ink)', marginBottom: 6 }} data-import-dates-check>
                  {tp(locale, 'p7_imp_dates_check', { n: dryRun.datesToCheck })}
                </div>
              ) : null}
              {dryRun.removalCandidates.length > 0 ? (
                <div data-import-removals style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <label className="switchline">
                    <input
                      type="checkbox"
                      checked={allowRemovals}
                      data-import-allow-removals
                      onChange={(e) => setAllowRemovals(e.target.checked)}
                    />
                    <span>{tp(locale, 'd26_allow', { n: dryRun.removalCandidates.length })}</span>
                  </label>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginTop: 4 }} data-import-removal-codes>
                    {dryRun.removalCandidates.map((c) => c.code).join(', ')}
                  </div>
                  <div style={{ color: allowRemovals ? 'var(--red)' : 'var(--ink-3)', marginTop: 4 }}>
                    {t(locale, allowRemovals ? 'd26_on' : 'd26_off')}
                  </div>
                </div>
              ) : null}
              {SERVER_IMPORT && dateChangeRows.length > 0 ? (
                <div data-import-date-changes style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <div style={{ color: 'var(--amber-ink)' }}>
                    {t(locale, 'i18_imp_dates').replace('{n}', String(dateChangeRows.length))}
                  </div>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginTop: 4 }} data-import-date-change-codes>
                    {dateChangeRows
                      .map((c) => `${c.code}: ${c.before.load_date ?? '—'} → ${c.after.load_date ?? '—'} / ${c.before.delivery_date ?? '—'} → ${c.after.delivery_date ?? '—'}`)
                      .join(' · ')}
                  </div>
                  <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>{t(locale, 'i18_imp_dates_note')}</div>
                </div>
              ) : null}
              {dryRun.removalBlocked.length > 0 ? (
                <div data-import-blocked style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <div style={{ color: 'var(--amber-ink)' }}>
                    {t(locale, 'an3_blocked').replace('{n}', String(dryRun.removalBlocked.length))}
                  </div>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginTop: 4 }} data-import-blocked-codes>
                    {dryRun.removalBlocked
                      .map((c) => `${c.code} (${t(locale, c.reason === 'INVOICED' ? 'an3_why_invoiced' : c.reason === 'CANCELLED' ? 'i1_why_cancelled' : 'an3_why_status')})`)
                      .join(' · ')}
                  </div>
                </div>
              ) : null}
              {canQuietImport ? (
                <div data-import-quiet style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <label className="switchline">
                    <input
                      type="checkbox"
                      checked={quietImport}
                      data-import-quiet-toggle
                      onChange={(e) => setQuietImport(e.target.checked)}
                    />
                    <span>{t(locale, 'i426_quiet')}</span>
                  </label>
                  <div style={{ color: quietImport ? 'var(--amber-ink)' : 'var(--ink-3)', marginTop: 4 }}>
                    {t(locale, quietImport ? 'i426_quiet_on' : 'i426_quiet_off')}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="btn"
                disabled={dryRun.accepted === 0 || committing}
                title={
                  dryRun.accepted === 0
                    ? t(locale, 'a6_sch_no_rows_title')
                    : undefined
                }
                onClick={() => {
                  if (dryRun.accepted === 0) {
                    pushToast(
                      t(locale, 'a6_sch_no_rows_toast'),
                      'CRITICAL',
                    );
                    return;
                  }
                  if (SERVER_IMPORT) {
                    const draft = serverDraft.current;
                    if (!draft || committing) return;
                    setCommitting(true);
                    void (async () => {
                      try {
                        const { serverCommit } = await import('../data/scheduleImportServer');
                        const res = await serverCommit(
                          draft,
                          allowRemovals ? dryRun.removalCandidates.map((c) => c.code) : [],
                          [],
                          canQuietImport && quietImport,
                        );
                        const note = standardSkipMessage(draft.meta.accepted, draft.meta.skippedStandard, { carrier: dryRun.skippedCarrier, empty: dryRun.skippedEmpty });
                        setServerNote(
                          res.version == null
                            ? t(locale, 'i1_nochange') + ' · ' + note
                            : note + ' · ' + tp(locale, 'i1_saved', { v: String(res.version), a: String(res.added.length), c: String(res.changed.length), x: String(res.cancelled.length), ms: String(res.ms) }) +
                              (res.critical.length ? ' · ' + tp(locale, canQuietImport && quietImport ? 'i426_crit_quiet' : 'i1_crit', { codes: res.critical.map((k) => k.code).join(', ') }) : '') +
                              (canQuietImport && quietImport ? ' · ' + t(locale, 'i426_saved_quiet') : ''),
                        );
                        const { refreshFromServer } = await import('../data/supabaseBridge');
                        await refreshFromServer();
                        setStep('done');
                      } catch (e) {
                        pushToast(tp(locale, 'i1_err', { msg: e instanceof Error ? e.message : String(e) }), 'CRITICAL');
                      } finally {
                        setCommitting(false);
                      }
                    })();
                    return;
                  }
                  commitImport({
                    added: dryRun.added,
                    changed: dryRun.changed,
                    removedIds: allowRemovals ? dryRun.removalCandidates.map((c) => c.id) : [],
                    rejected: dryRun.rejected,
                    filename: dryRun.filename,
                    accepted: dryRun.accepted,
                    allowRemovals,
                    skippedStandard: dryRun.skippedStandard,
                  });
                  setStep('done');
                }}
              >
                {t(locale, 'commit')}
              </button>{' '}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setStep(null);
                  setDryRun(null);
                }}
              >
                {t(locale, 'cancel')}
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <span style={{ color: 'var(--go)' }}>{t(locale, 'a6_sch_import_ok')}</span>{' '}
              {dryRun ? (
                <span data-import-standard style={{ color: 'var(--ink)' }}>{standardSkipMessage(dryRun.accepted, dryRun.skippedStandard, { carrier: dryRun.skippedCarrier, empty: dryRun.skippedEmpty })}</span>
              ) : null}{' '}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setStep(null);
                  setDryRun(null);
                }}
              >
                {t(locale, 'close')}
              </button>
            </>
          )}
        </div>
      )}

      <div className="panel-bd flush" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {phone ? (
          <>
            {/* telefon (E30 pkt 8, E28): pasek etapów w bok, „Szukaj” i „Filtry · n” (arkusz), „⋯” — Więcej */}
            <StageBar variant="page" />
            <div className="filters sched-ph-search" data-sched-filters>
              <input type="search" placeholder={s7(locale, 's7_search_ph')} aria-label={s7(locale, searchKey)} value={search} onChange={(e) => setSearch(e.target.value)} />
              <button type="button" className="chipbtn s7-fbtn" aria-expanded={sheetOpen} data-sched-more-filters onClick={() => setSheetOpen(true)}>
                {activeFilters ? s7p(locale, 's7_filters_n', { n: activeFilters }) : s7(locale, 's7_filters')}
              </button>
              <div className="sched-more-wrap" ref={morePopRef}>
                <button ref={moreBtnRef} type="button" className="chipbtn sched-more" aria-expanded={actionsOpen} aria-label={t(locale, 'p4_actions_more')} title={t(locale, 'p4_actions_more')} onClick={() => setActionsOpen((v) => !v)}>⋯</button>
                {actionsOpen ? <div className="sched-actions sched-actions-pop s7-more" role="menu">{moreItems}</div> : null}
              </div>
            </div>
            {stageFilter || sailChip ? <div className="filters s7-stage-row">{stageFilter ? <StageChip /> : null}{sailChip}</div> : null}
            {sheetOpen ? (
              <div className="s7-sheet-back" onClick={() => setSheetOpen(false)}>
                <div className="s7-sheet" role="dialog" aria-modal="true" aria-label={s7(locale, 's7_filters')} data-sched-sheet onClick={(e) => e.stopPropagation()}>
                  <div className="s7-sheet-hd"><b>{s7(locale, 's7_filters')}</b><button type="button" className="chipbtn" aria-label={s7(locale, 's7_sheet_close')} onClick={() => setSheetOpen(false)}>✕</button></div>
                  <div className="s7-sheet-bd">
                    <span className="s7-sheet-l">{s7(locale, 's7_sheet_load')}</span>
                    <div className="s7-chips" data-sheet-load>
                      {[{ id: 'all', label: s7(locale, 's7_f_all') }, ...picks, { id: 'range', label: s7(locale, 's7_f_range') }].map((p) => (
                        <button key={p.id} type="button" className="chipbtn s7-chip" aria-pressed={loadPick === p.id} data-pick={p.id} onClick={() => setLoadPick(p.id)}>{p.label}</button>
                      ))}
                    </div>
                    {loadPick === 'range' ? (
                      <div className="s7-range">
                        <label>{s7(locale, 's7_f_from')}<input type="date" value={loadFrom} onChange={(e) => setLoadFrom(e.target.value)} /></label>
                        <label>{s7(locale, 's7_f_to')}<input type="date" value={loadTo} onChange={(e) => setLoadTo(e.target.value)} /></label>
                      </div>
                    ) : null}
                    <span className="s7-sheet-l">{s7(locale, 's7_sheet_deliv')}</span>
                    <div className="s7-chips" data-sheet-deliv>
                      {[{ id: 'all', label: s7(locale, 's7_f_all') }, ...picks, { id: 'range', label: s7(locale, 's7_f_range') }].map((p) => (
                        <button key={p.id} type="button" className="chipbtn s7-chip" aria-pressed={delivPick === p.id} data-pick={p.id} onClick={() => setDelivPick(p.id)}>{p.label}</button>
                      ))}
                    </div>
                    {delivPick === 'range' ? (
                      <div className="s7-range">
                        <label>{s7(locale, 's7_f_from')}<input type="date" value={delivFrom} onChange={(e) => setDelivFrom(e.target.value)} /></label>
                        <label>{s7(locale, 's7_f_to')}<input type="date" value={delivTo} onChange={(e) => setDelivTo(e.target.value)} /></label>
                      </div>
                    ) : null}
                    <span className="s7-sheet-l">{s7(locale, 's7_sheet_state')}</span>
                    <div className="s7-chips" data-sheet-state>{QUICKS.map(chipBtn)}</div>
                  </div>
                  <div className="s7-sheet-ft">
                    <button type="button" className="btn ghost" data-sheet-clear onClick={clearFilters}>{s7(locale, 's7_sheet_clear')}</button>
                    <button type="button" className="btn" data-sheet-show onClick={() => setSheetOpen(false)}>{s7p(locale, 's7_sheet_show', { n: list.length })}</button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="filters s7-filters" data-sched-filters>
            <input type="search" className="s7-search" placeholder={s7(locale, searchKey)} aria-label={s7(locale, searchKey)} value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="s7-sel" data-week="load">
              <span>{s7(locale, 's7_f_load')}:</span>
              <select value={loadPick} onChange={(e) => setLoadPick(e.target.value)}>
                <option value="all">{s7(locale, 's7_f_all')}</option>
                {picks.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="range">{s7(locale, 's7_f_range')}</option>
              </select>
            </label>
            {loadPick === 'range' ? (
              <span className="s7-range">
                <input type="date" aria-label={`${s7(locale, 's7_f_load')} ${s7(locale, 's7_f_from')}`} value={loadFrom} onChange={(e) => setLoadFrom(e.target.value)} />
                <input type="date" aria-label={`${s7(locale, 's7_f_load')} ${s7(locale, 's7_f_to')}`} value={loadTo} onChange={(e) => setLoadTo(e.target.value)} />
              </span>
            ) : null}
            <label className="s7-sel" data-week="deliv">
              <span>{s7(locale, 's7_f_deliv')}:</span>
              <select value={delivPick} onChange={(e) => setDelivPick(e.target.value)}>
                <option value="all">{s7(locale, 's7_f_all')}</option>
                {picks.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="range">{s7(locale, 's7_f_range')}</option>
              </select>
            </label>
            {delivPick === 'range' ? (
              <span className="s7-range">
                <input type="date" aria-label={`${s7(locale, 's7_f_deliv')} ${s7(locale, 's7_f_from')}`} value={delivFrom} onChange={(e) => setDelivFrom(e.target.value)} />
                <input type="date" aria-label={`${s7(locale, 's7_f_deliv')} ${s7(locale, 's7_f_to')}`} value={delivTo} onChange={(e) => setDelivTo(e.target.value)} />
              </span>
            ) : null}
            <StageChip />
            {sailChip}
            {QUICKS.map(chipBtn)}
            <div className="spacer" />
            <span className="sched-count">{tp(locale, 'p4_count', { n: list.length, total: loads.length })}</span>
          </div>
        )}
        {!skeleton && list.length === 0 ? (
          <div className="empty" data-sched-empty>
            <b>{t(locale, 'iii2_empty_title')}</b>
            <p>
              {/* „Na etapie … nie ma” tylko gdy pusty jest sam etap; gdy wiersze etapu odsiał inny filtr — tekst ogólny */}
              {stageFilter && base.length === 0 && !search.trim()
                ? t(locale, 'iii2_empty_stage').replace('{stage}', t(locale, `p4_tile_${stageFilter}`))
                : t(locale, 'iii2_empty_any')}{' '}
              {t(locale, 'iii2_empty_hint')}
            </p>
            <button type="button" className="btn ghost" data-sched-clear onClick={() => { setSearch(''); clearFilters(); useTowerStore.getState().navigateTo({ stage: null }); }}>
              {t(locale, 'iii2_empty_clear')}
            </button>
          </div>
        ) : (
          <>
            {layout.view === 'short'
              ? <ShortTable extras={extras} list={list} ctx={ctx} skeleton={skeleton} />
              : <FileTable cols={fileCols} list={list} ctx={ctx} skeleton={skeleton} />}
            <SchedCards list={list} ctx={ctx} />
          </>
        )}
        <div className="note s7-note">
          {layout.view === 'short' ? s7(locale, 's7_short_note') : s7(locale, 's7_scroll_note')}
        </div>
      </div>
    </div>
  );
}
