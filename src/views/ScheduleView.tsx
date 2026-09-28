import { PROD_BUILD } from '../lib/prodFacade';
import { delayPillMinutes } from '../lib/prodDash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { invoicedLoadIds } from '../lib/importRemoval';
import { MAP_FIELDS as MAP_FIELDS_UI, REQUIRED_FIELDS as REQUIRED_FIELDS_UI, type PartialColumnMap } from '../lib/importMapping';
import { useTowerStore } from '../store/useTowerStore';
import { filterLoads } from '../lib/selectors';
import { StatusPill, formatDelayPill } from '../components/ui/StatusPill';
import { canImportSchedule, canSeeCost, canSeeMargin, canSeeRevenue, visibleDriverPhone } from '../lib/permissions';
import { fmtNum, pctText, t, tp } from '../i18n/messages';
import { docCategoryLabel } from '../lib/enumLabels';
import {
  delayMinutesVsPlan,
  formatTableDay,
  formatTableInZone,
  refYearInOps,
  TZ_UNLOAD_SE,
} from '../lib/time';
import { getNow } from '../lib/frozenNow';
// D15: ExcelJS (~1 MB) tylko przy imporcie/eksporcie — dynamiczny import.
import type { ImportDiff } from '../lib/scheduleDryRun';
import { COLUMN_MAP_DEFAULT } from '../lib/importColumnMap';
import type { CorridorStage, DocCategory, Load, Locale } from '../types';
import {
  SCHED_COLS,
  loadSchedPrefs,
  saveSchedPrefs,
  type SchedColId,
  type SchedColPrefs,
} from '../lib/scheduleColumns';
import { formatAppMoney } from '../lib/money/demoFx';
import { SailingsPanel } from './SailingsPanel';
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import type { ServerImportDraft } from '../data/scheduleImportServer';
import { clickableRow } from '../lib/clickableRow';

/** I-1: import w produkcji przez import_schedule() w bazie (podgląd i zapis w jednej transakcji). */
const SERVER_IMPORT = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED;

type ImportStep = null | 'upload' | 'colmap' | 'map' | 'diff' | 'done';
type Quick =
  | 'all'
  | 'active'
  | 'late'
  | 'nodocs'
  | 'delivered'
  | CorridorStage;

/** A6-T3 — wymiary w języku interfejsu (PL bez zmian). */
function fmtDim(n: number, locale: Locale = 'pl'): string {
  return fmtNum(locale, n, 2);
}

function delayMinutes(l: Load): number | null {
  return delayPillMinutes(l, delayMinutesVsPlan(l.etaBoden, l.plannedDeliverDate, l.planDates?.deliveryTo), PROD_BUILD);
}

/** I-18: data wstępna vs potwierdzona przez KSH (tylko produkcja — w demo pola brak). */
function DateStatusMark({ s, locale }: { s: 'WSTEPNA' | 'POTWIERDZONA'; locale: Locale }) {
  return s === 'POTWIERDZONA'
    ? <span className="pill p-go" data-date-status="POTWIERDZONA" title={t(locale, 'i18_confirmed')} style={{ marginLeft: 4, padding: '0 4px' }}>✓</span>
    : <span className="pill" data-date-status="WSTEPNA" title={t(locale, 'i18_provisional')} style={{ marginLeft: 4, padding: '0 4px' }}>{t(locale, 'i18_prov_short')}</span>;
}

/** III-2: czas szkieletu jak w makiecie (go(): 260 ms) */
export const SKELETON_MS = 260;
const SKEL_W = [70, 120, 150, 60, 100, 100, 90, 130, 70, 100, 70, 80, 80, 90];

export function ScheduleView() {
  /* M10 — rozkład rejsów jako druga zakładka harmonogramu (seg) */
  const [schedTab, setSchedTab] = useState<'loads' | 'sailings'>('loads');
  const loads = useTowerStore((s) => s.loads);
  const documents = useTowerStore((s) => s.documents);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const refYear = refYearInOps(getNow());
  const search = useTowerStore((s) => s.search);
  const setSearch = useTowerStore((s) => s.setSearch);
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
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [confirmedRows, setConfirmedRows] = useState<NonNullable<ServerImportDraft['preview']['confirmed']>>([]);
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
  /* III-2 (SCOPE 0.9, makieta go()): krótki szkielet tabeli po wejściu w widok — wiersze w rytmie tabeli, nigdy spinner */
  const [skeleton, setSkeleton] = useState(true);
  useEffect(() => { const id = window.setTimeout(() => setSkeleton(false), SKELETON_MS); return () => window.clearTimeout(id); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [colPrefs, setColPrefs] = useState<SchedColPrefs>(() => loadSchedPrefs());
  const [colMenu, setColMenu] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dragCol = useRef<SchedColId | null>(null);


  // Harmonogram has own filters — never apply CorridorSpine stageFilter
  const base = useMemo(
    () => filterLoads(loads, role, null, search),
    [loads, role, search],
  );

  const list = useMemo(() => {
    return base.filter((l) => {
      if (quick === 'active') {
        return ['IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'LOADING'].includes(
          l.status,
        );
      }
      if (quick === 'late') return l.delayed || l.status === 'DELAYED';
      if (quick === 'nodocs') return l.docMissing || l.status === 'DOC_MISSING';
      if (quick === 'delivered') return l.status === 'DELIVERED' || l.stage === 'DELIVERED';
      if (
        quick === 'LOADING' ||
        quick === 'TO_PORT' ||
        quick === 'GDANSK' ||
        quick === 'FERRY' ||
        quick === 'APPROACH' ||
        quick === 'SE_ROAD' ||
        quick === 'SITE'
      ) {
        return l.stage === quick;
      }
      return true;
    });
  }, [base, quick]);

  const showCost = canSeeCost(role);
  const showRev = canSeeRevenue(role);
  const showMargin = canSeeMargin(role);
  const ver = scheduleVersions[0];
  const verLine = SERVER_IMPORT
    ? ver
      ? tp(locale, 'i1_ver_line', { v: ver.by.replace(/^v/, ''), at: formatTableInZone(ver.at, 'Europe/Warsaw', refYear), file: ver.filename })
      : t(locale, 'i1_ver_none')
    : t(locale, 'a6_sch_ver_line');

  const mapKeys = activeMap ? Object.entries(activeMap) : Object.entries(COLUMN_MAP_DEFAULT);

  function docFlag(loadId: string, cat: DocCategory, letter: string) {
    const d = documents.find((x) => x.loadId === loadId && x.category === cat);
    const ok = d?.status === 'UPLOADED';
    const miss = !d || d.status === 'MISSING' || d.status === 'EXPIRED' || d.status === 'MISMATCH';
    // Permit miss is red; other missing stay neutral like Claude
    const cls = ok ? 'ok' : cat === 'PERMIT_PL' && miss ? 'miss' : '';
    return (
      <span key={letter} className={`flag ${cls}`} title={docCategoryLabel(cat, locale)}>
        {letter}
      </span>
    );
  }

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
    setOverwriteConfirmed(false);
    setConfirmedRows([]);
    setParsing(true);
    serverDraft.current = null;
    setServerNote(null);
    setActiveMap(null);
    try {
      const buf = await f.arrayBuffer();
      const { readXlsxHeaders } = await import('../lib/xlsxRead');
      const mapping = await import('../lib/importMapping');
      const headers = await readXlsxHeaders(buf);
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
      setParseError(e instanceof Error ? e.message : String(e));
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
      setConfirmedRows(draft.preview.confirmed ?? []);
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

  const chips: { id: Quick; labelKey: string }[] = [
    { id: 'all', labelKey: 'sched_all' },
    { id: 'active', labelKey: 'kpi_on_road' },
    { id: 'late', labelKey: 'sched_late' },
    { id: 'nodocs', labelKey: 'sched_nodocs' },
    { id: 'delivered', labelKey: 'stage_DELIVERED' },
    { id: 'LOADING', labelKey: 's_loading' },
    { id: 'TO_PORT', labelKey: 'stage_TO_PORT' },
    { id: 'GDANSK', labelKey: 'stage_GDANSK' },
    { id: 'FERRY', labelKey: 'stage_FERRY' },
    { id: 'APPROACH', labelKey: 'stage_APPROACH' },
    { id: 'SE_ROAD', labelKey: 'stage_SE_ROAD' },
    { id: 'SITE', labelKey: 'stage_SITE' },
  ];

  const visibleCols = colPrefs.order.filter((id) => {
    if (colPrefs.hidden.includes(id)) return false;
    const def = SCHED_COLS.find((c) => c.id === id)!;
    if (def.role === 'cost' && !showCost) return false;
    if (def.role === 'rev' && !showRev) return false;
    if (def.role === 'margin' && !showMargin) return false;
    return true;
  });

  function persistCols(next: SchedColPrefs) {
    setColPrefs(next);
    saveSchedPrefs(next);
  }

  function autoFitCol(id: SchedColId) {
    const def = SCHED_COLS.find((c) => c.id === id);
    if (!def) return;
    // measure longest text in column approximately via DOM
    const th = document.querySelector(`th[data-col="${id}"]`) as HTMLElement | null;
    const cells = Array.from(document.querySelectorAll(`td[data-col="${id}"]`)) as HTMLElement[];
    let w = t(locale, def.labelKey).length * 8 + 24;
    for (const c of cells.slice(0, 40)) w = Math.max(w, Math.ceil(c.scrollWidth) + 16);
    if (th) w = Math.max(w, Math.ceil(th.scrollWidth) + 16);
    persistCols({ ...colPrefs, widths: { ...colPrefs.widths, [id]: Math.min(360, Math.max(0, w)) } });
  }


  const schedTabs = (
    <div className="seg" role="group" aria-label={t(locale, 'nav_sched')} data-sched-tabs>
      {(['loads', 'sailings'] as const).map((k) => (
        <button key={k} type="button" data-sched-tab={k} aria-pressed={schedTab === k} onClick={() => setSchedTab(k)}>
          {t(locale, k === 'loads' ? 'sched_tab_loads' : 'sched_tab_sailings')}
        </button>
      ))}
    </div>
  );
  if (schedTab === 'sailings') {
    return (
      <div className="panel section-card page-sections" data-page="schedule" style={{ margin: 12 }}>
        <div className="panel-hd" style={{ flexWrap: 'wrap' }}>
          <h2>{t(locale, 'nav_sched')}</h2>
          <span className="sub">{t(locale, 'sail_sub')}</span>
          <div className="spacer" />
          {schedTabs}
        </div>
        <SailingsPanel />
      </div>
    );
  }

  return (
    <div className="panel section-card page-sections" data-page="schedule" style={{ margin: 12, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="panel-hd" style={{ flexWrap: 'wrap' }}>
        <h2>{t(locale, 'nav_sched')}</h2>
        <span className="sub">{verLine}</span>
        <div className="spacer" />
        {schedTabs}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
          {canImportSchedule(role) ? (
            <button type="button" className="chipbtn" onClick={() => setStep('upload')} disabled={parsing}>
              {t(locale, 'sched_upload')}
            </button>
          ) : null}
          <button
            type="button"
            className="chipbtn"
            onClick={() => {
              saveSchedPrefs(colPrefs);
              setSavedFlash(true);
              window.setTimeout(() => setSavedFlash(false), 1600);
              pushToast(t(locale, 'a6_sch_view_saved'), 'MEDIUM');
            }}
          >
            {savedFlash ? t(locale, 'a6_sch_saved') : t(locale, 'a6_sch_save_view')}
          </button>
          <div className="sched-col-picker">
            <button type="button" className="chipbtn" aria-expanded={colMenu} onClick={() => setColMenu((v) => !v)}>
              {t(locale, 'a6_sch_columns')}
            </button>
            {colMenu ? (
              <div className="sched-col-menu" role="menu">
                {SCHED_COLS.map((c) => {
                  if (c.role === 'cost' && !showCost) return null;
                  if (c.role === 'rev' && !showRev) return null;
                  if (c.role === 'margin' && !showMargin) return null;
                  const on = !colPrefs.hidden.includes(c.id);
                  return (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const hidden = on
                            ? [...colPrefs.hidden, c.id]
                            : colPrefs.hidden.filter((x) => x !== c.id);
                          persistCols({ ...colPrefs, hidden });
                        }}
                      />
                      {t(locale, c.labelKey)}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="chipbtn"
            data-action="export-xlsx"
            onClick={() => {
              void (async () => {
                try {
                  const { exportLoadsXlsx } = await import('../lib/xlsxExport');
                  const result = await exportLoadsXlsx(loads, role, `WATCH_TOWER_${role}_harmonogram.xlsx`);
                  pushToast(tp(locale, 'a6_sch_export_ok', { rows: String(result.rows), bytes: String(result.bytes) }), 'MEDIUM');
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  pushToast(tp(locale, 'a6_sch_export_fail', { msg }), 'CRITICAL');
                }
              })();
            }}
          >
            {t(locale, 'a6_sch_export')}
          </button>
          <button
            type="button"
            className="chipbtn"
            data-action="export-pdf"
            onClick={() => {
              void (async () => {
                try {
                  const { exportLoadsPdf } = await import('../lib/pdfExport');
                  const result = await exportLoadsPdf(loads, `WATCH_TOWER_${role}_harmonogram.pdf`, `TOWER — harmonogram (${loads.length})`);
                  pushToast(tp(locale, 'i24_sch_pdf_ok', { rows: String(result.rows), bytes: String(result.bytes) }), 'MEDIUM');
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  pushToast(tp(locale, 'i24_sch_pdf_fail', { msg }), 'CRITICAL');
                }
              })();
            }}
          >
            {t(locale, 'i24_sch_pdf')}
          </button>
        </div>
      </div>

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
                {dryRun.accepted}/{dryRun.total} OK · ⚠{dryRun.warnings}
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
              <ul style={{ fontSize: 12, columns: 2, color: 'var(--ink-3)', margin: '0 0 8px' }}>
                {mapKeys.map(([k, v]) => (
                  <li key={k}>
                    <span style={{ color: 'var(--ink)' }}>{v}</span> → {k}
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
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--go)' }}>+{dryRun.added.length}</span>
                {' · '}
                <span style={{ color: 'var(--amber)' }}>~{dryRun.changed.length}</span>
                {' · '}
                <span style={{ color: 'var(--ink-3)' }} data-import-removed-count>−{allowRemovals ? dryRun.removalCandidates.length : 0}</span>
                {' · '}
                <span style={{ color: 'var(--red)' }}>⚠{dryRun.rejected}</span>
              </div>
              {dryRun.removalCandidates.length > 0 ? (
                <div data-import-removals style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <label className="switchline">
                    <input
                      type="checkbox"
                      checked={allowRemovals}
                      data-import-allow-removals
                      onChange={(e) => setAllowRemovals(e.target.checked)}
                    />
                    <span>{t(locale, 'd26_allow').replace('{n}', String(dryRun.removalCandidates.length))}</span>
                  </label>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginTop: 4 }} data-import-removal-codes>
                    {dryRun.removalCandidates.map((c) => c.code).join(', ')}
                  </div>
                  <div style={{ color: allowRemovals ? 'var(--red)' : 'var(--ink-3)', marginTop: 4 }}>
                    {t(locale, allowRemovals ? 'd26_on' : 'd26_off')}
                  </div>
                </div>
              ) : null}
              {SERVER_IMPORT && confirmedRows.length > 0 ? (
                <div data-import-confirmed style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <div style={{ color: 'var(--amber)' }}>
                    {t(locale, 'i18_imp_warn').replace('{n}', String(confirmedRows.length))}
                  </div>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginTop: 4 }} data-import-confirmed-codes>
                    {confirmedRows
                      .map((c) => `${c.code}: ${c.before.load_date ?? '—'} → ${c.after.load_date ?? '—'} / ${c.before.delivery_date ?? '—'} → ${c.after.delivery_date ?? '—'}`)
                      .join(' · ')}
                  </div>
                  <label className="switchline" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={overwriteConfirmed}
                      data-import-overwrite-confirmed
                      onChange={(e) => setOverwriteConfirmed(e.target.checked)}
                    />
                    <span>{t(locale, 'i18_imp_consent')}</span>
                  </label>
                </div>
              ) : null}
              {dryRun.removalBlocked.length > 0 ? (
                <div data-import-blocked style={{ fontSize: 12, margin: '0 0 8px' }}>
                  <div style={{ color: 'var(--amber)' }}>
                    {t(locale, 'an3_blocked').replace('{n}', String(dryRun.removalBlocked.length))}
                  </div>
                  <div className="mono" style={{ color: 'var(--ink-3)', marginTop: 4 }} data-import-blocked-codes>
                    {dryRun.removalBlocked
                      .map((c) => `${c.code} (${t(locale, c.reason === 'INVOICED' ? 'an3_why_invoiced' : c.reason === 'CANCELLED' ? 'i1_why_cancelled' : 'an3_why_status')})`)
                      .join(' · ')}
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
                          overwriteConfirmed ? (draft.preview.confirmed ?? []).map((c) => c.code) : [],
                        );
                        setServerNote(
                          res.version == null
                            ? t(locale, 'i1_nochange')
                            : tp(locale, 'i1_saved', { v: String(res.version), a: String(res.added.length), c: String(res.changed.length), x: String(res.cancelled.length), ms: String(res.ms) }) +
                              (res.critical.length ? ' · ' + tp(locale, 'i1_crit', { codes: res.critical.map((k) => k.code).join(', ') }) : ''),
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
        <div className="filters">
          <input
            type="search"
            placeholder={t(locale, 'search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="kbdhint">
            <kbd>/</kbd>
          </span>
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chipbtn"
              aria-pressed={quick === c.id}
              onClick={() => setQuick(c.id)}
            >
              {t(locale, c.labelKey)}
            </button>
          ))}
          <div className="spacer" />
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {list.length} / {loads.length}
          </span>
        </div>
        {!skeleton && list.length === 0 ? (
          <div className="empty" data-sched-empty>
            <b>{t(locale, 'iii2_empty_title')}</b>
            <p>
              {chips.some((c) => c.id === quick && /^[A-Z_]+$/.test(c.id))
                ? t(locale, 'iii2_empty_stage').replace('{stage}', t(locale, chips.find((c) => c.id === quick)!.labelKey))
                : t(locale, 'iii2_empty_any')}{' '}
              {t(locale, 'iii2_empty_hint')}
            </p>
            <button type="button" className="btn ghost" data-sched-clear onClick={() => { setSearch(''); setQuick('all'); }}>
              {t(locale, 'iii2_empty_clear')}
            </button>
          </div>
        ) : (
        <div className="tablewrap" style={{ flex: 1 }}>
          <table className="sched-table" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              {visibleCols.map((id) => (
                <col key={id} style={{ width: colPrefs.widths[id] ?? 100 }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {visibleCols.map((id) => {
                  const def = SCHED_COLS.find((c) => c.id === id)!;
                  let label = t(locale, def.labelKey);
                  if (id === 'cost' && role === 'SCX') label = t(locale, 'a6_sch_my_rate');
                  if (id === 'rev' && role === 'KSH') label = t(locale, 'a6_sch_your_price');
                  const stick =
                    id === 'margin' ||
                    (id === 'cost' && !showRev && !showMargin) ||
                    (id === 'rev' && !showMargin) ||
                    (id === 'docs' && !showCost && !showRev && !showMargin);
                  return (
                    <th
                      key={id}
                      data-col={id}
                      draggable
                      className={`${id === 'weight' || id === 'cost' || id === 'rev' || id === 'margin' ? 'num' : ''}${stick ? ' stick' : ''}`}
                      onDragStart={() => {
                        dragCol.current = id;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragCol.current;
                        if (!from || from === id) return;
                        const order = [...colPrefs.order];
                        const fi = order.indexOf(from);
                        const ti = order.indexOf(id);
                        if (fi < 0 || ti < 0) return;
                        order.splice(fi, 1);
                        order.splice(ti, 0, from);
                        persistCols({ ...colPrefs, order });
                        dragCol.current = null;
                      }}
                      onDoubleClick={() => autoFitCol(id)}
                      title={t(locale, 'a6_sch_drag')}
                    >
                      {label}
                      <span
                        className="col-resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startW = colPrefs.widths[id] ?? def.defaultWidth;
                          const onMove = (ev: MouseEvent) => {
                            const w = Math.min(420, Math.max(0, startW + (ev.clientX - startX)));
                            setColPrefs((prev) => ({ ...prev, widths: { ...prev.widths, [id]: w } }));
                          };
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                            setColPrefs((prev) => {
                              saveSchedPrefs(prev);
                              return prev;
                            });
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {skeleton ? Array.from({ length: 12 }, (_, r) => (
                <tr key={`skel-${r}`} className="skel" data-sched-skel>
                  {visibleCols.map((id, i) => <td key={id}><i style={{ width: SKEL_W[i % SKEL_W.length] - (i % 3) * 8 }} /></td>)}
                </tr>
              )) : list.map((l) => {
                const dmin = delayMinutes(l);
                return (
                  <tr
                    key={l.id}
                    data-load={l.id}
                    className={`${l.status === 'DELIVERED' ? 'done' : ''} ${hoverLoadId === l.id || selectedLoadId === l.id ? 'hl' : ''}`}
                    onMouseEnter={() => setHoverLoad(l.id)}
                    onMouseLeave={() => setHoverLoad(null)}
                    {...clickableRow(() => selectLoad(l.id))}
                  >
                    {visibleCols.map((id) => {
                      const stick =
                        id === 'margin' ||
                        (id === 'cost' && !showRev && !showMargin) ||
                        (id === 'rev' && !showMargin);
                      switch (id) {
                        case 'code':
                          return (
                            <td key={id} data-col={id}>
                              <span className="code" data-content>{l.code}</span>
                            </td>
                          );
                        case 'ord_ksh':
                        case 'ord_hhl':
                        case 'ord_scx': {
                          const v = id === 'ord_ksh' ? l.orderNo : id === 'ord_hhl' ? l.hhlOrderNo : l.carrierOrderNo;
                          return (
                            <td key={id} data-col={id}>
                              {v ? <span className="mono">{v}</span> : id === 'ord_ksh' ? '—' : <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_sch_none')}</span>}
                            </td>
                          );
                        }
                        case 'type':
                          return <td key={id} data-col={id} data-content>{l.itemType}</td>;
                        case 'dims':
                          if (l.dims.cargoClass === 'STANDARD') {
                            return (
                              <td key={id} data-col={id} data-cargo="STANDARD" title={t(locale, 'i2_std_title')}>
                                {t(locale, 'i2_std')}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={id}
                              data-col={id}
                              className={l.dims.lengthM > 16.5 || l.dims.widthM > 2.55 ? 'over' : undefined}
                              title={
                                l.dims.lengthM > 16.5 || l.dims.widthM > 2.55
                                  ? t(locale, 'a6_sch_oversize')
                                  : undefined
                              }
                            >
                              {fmtDim(l.dims.lengthM, locale)} × {fmtDim(l.dims.widthM, locale)} × {fmtDim(l.dims.heightM, locale)}
                            </td>
                          );
                        case 'weight':
                          return (
                            <td key={id} data-col={id} className="num">
                              {fmtDim(l.dims.weightT, locale)} t
                            </td>
                          );
                        case 'load':
                          return <td key={id} data-col={id}>{formatTableDay(l.plannedLoadDate, refYear)}{l.planDates ? <DateStatusMark s={l.planDates.status} locale={locale} /> : null}</td>;
                        case 'deliver':
                          return <td key={id} data-col={id}>{formatTableDay(l.plannedDeliverDate, refYear)}{l.planDates ? <DateStatusMark s={l.planDates.status} locale={locale} /> : null}</td>;
                        case 'status':
                          return (
                            <td key={id} data-col={id}>
                              <StatusPill status={l.status} stage={l.stage} />
                              {dmin != null ? (
                                <span className="pill p-red" style={{ marginLeft: 4 }}>
                                  {formatDelayPill(dmin)}
                                </span>
                              ) : null}
                            </td>
                          );
                        case 'driver':
                          return (
                            <td key={id} data-col={id}>
                              {l.resources.driverName ? (
                                <span data-content>{l.resources.driverName}</span>
                              ) : (
                                <span style={{ color: 'var(--red)' }}>{t(locale, 'a6_sch_none')}</span>
                              )}
                            </td>
                          );
                        case 'phone': {
                          const phone = visibleDriverPhone(role, l);
                          return (
                            <td key={id} data-col={id}>
                              {phone ? (
                                <a href={`tel:${phone}`} className="mono" data-content onClick={(e) => e.stopPropagation()}>
                                  {phone}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        }
                        case 'plate':
                          return (
                            <td key={id} data-col={id}>
                              {l.resources.tractorPlate ? (
                                <span className="mono" data-content>{l.resources.tractorPlate}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        case 'eta':
                          return <td key={id} data-col={id}>{formatTableInZone(l.etaBoden, TZ_UNLOAD_SE, refYear)}</td>;
                        case 'docs':
                          return (
                            <td key={id} data-col={id}>
                              <span className="flagrow">
                                {docFlag(l.id, 'PERMIT_PL', 'Z')}
                                {docFlag(l.id, 'CMR', 'C')}
                                {docFlag(l.id, 'POD', 'P')}
                                {docFlag(l.id, 'LASHING_PHOTOS', 'M')}
                              </span>
                            </td>
                          );
                        case 'cost':
                          return (
                            <td key={id} data-col={id} className={`num money${stick ? ' stick' : ''}`}>
                              {formatAppMoney(l.pricing.costTotal, locale, currency)}
                            </td>
                          );
                        case 'rev':
                          return (
                            <td key={id} data-col={id} className={`num money${stick ? ' stick' : ''}`}>
                              {formatAppMoney(l.pricing.revTotal, locale, currency)}
                            </td>
                          );
                        case 'margin':
                          return (
                            <td key={id} data-col={id} className={`num money stick ${l.pricing.marginPct < 0.18 ? 'neg' : ''}`}>
                              {formatAppMoney(l.pricing.margin, locale, currency)}{' '}
                              <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 11.5, marginLeft: 5 }}>
                                {pctText(locale, l.pricing.marginPct, 1, `${(l.pricing.marginPct * 100).toFixed(1).replace('.', ',')}%`)}
                              </span>
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        <div className="note">
          {showMargin
            ? t(locale, 'sched_money_note').replace('{cur}', currency)
            : role === 'KSH'
              ? t(locale, 'sched_role_ksh')
              : t(locale, 'sched_role_scx')}
        </div>
      </div>
    </div>
  );
}

