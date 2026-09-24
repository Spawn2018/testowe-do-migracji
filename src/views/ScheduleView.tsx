import { useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { filterLoads } from '../lib/selectors';
import { StatusPill, formatDelayPill } from '../components/ui/StatusPill';
import { canImportSchedule, canSeeCost, canSeeMargin, canSeeRevenue } from '../lib/permissions';
import { exportLoadsXlsx } from '../lib/xlsxExport';
import { t } from '../i18n/messages';
import {
  delayMinutesVsPlan,
  formatEtaBoden,
  formatLoadPl,
  formatUnloadSe,
} from '../lib/time';
import { dryRunFromXlsx, type ImportDiff } from '../lib/scheduleDryRun';
import { COLUMN_MAP_DEFAULT } from '../lib/scheduleParse';
import type { CorridorStage, DocCategory, Load } from '../types';
import {
  SCHED_COLS,
  loadSchedPrefs,
  saveSchedPrefs,
  type SchedColId,
  type SchedColPrefs,
} from '../lib/scheduleColumns';

type ImportStep = null | 'upload' | 'map' | 'diff' | 'done';
type Quick =
  | 'all'
  | 'active'
  | 'late'
  | 'nodocs'
  | 'delivered'
  | CorridorStage;

function fmtDim(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function orderNo(l: Load): string {
  return l.permit?.pozycja || `HHL/2026/${1240 + l.sequenceOrder}`;
}

function delayMinutes(l: Load): number | null {
  if (!l.delayed) return null;
  return delayMinutesVsPlan(l.etaBoden, l.plannedDeliverDate) ?? 95;
}

export function ScheduleView() {
  const loads = useTowerStore((s) => s.loads);
  const documents = useTowerStore((s) => s.documents);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
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
  const [quick, setQuick] = useState<Quick>('all');
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
  const verLine = ver
    ? `import z SharePoint KSH · wersja 7 z 21.09.2026 14:08`
    : 'import z SharePoint KSH · wersja 7 z 21.09.2026 14:08';

  const mapKeys = Object.entries(COLUMN_MAP_DEFAULT);

  function docFlag(loadId: string, cat: DocCategory, letter: string) {
    const d = documents.find((x) => x.loadId === loadId && x.category === cat);
    const ok = d?.status === 'UPLOADED';
    const miss = !d || d.status === 'MISSING' || d.status === 'EXPIRED' || d.status === 'MISMATCH';
    // Permit miss is red; other missing stay neutral like Claude
    const cls = ok ? 'ok' : cat === 'PERMIT_PL' && miss ? 'miss' : '';
    return (
      <span key={letter} className={`flag ${cls}`} title={cat}>
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
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const diff = await dryRunFromXlsx(buf, f.name, useTowerStore.getState().loads);
      setDryRun(diff);
      setStep('map');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      setStep('upload');
      pushToast('Nie udało się odczytać XLSX', 'CRITICAL');
    } finally {
      setParsing(false);
    }
  }

  const chips: { id: Quick; label: string }[] = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'active', label: 'W drodze' },
    { id: 'late', label: 'Opóźnione' },
    { id: 'nodocs', label: 'Bez dokumentów' },
    { id: 'delivered', label: 'Dostarczone' },
    { id: 'LOADING', label: 'Załadunek' },
    { id: 'TO_PORT', label: 'Droga PL' },
    { id: 'GDANSK', label: 'Gdańsk' },
    { id: 'FERRY', label: 'Prom' },
    { id: 'APPROACH', label: 'Nynäshamn' },
    { id: 'SE_ROAD', label: 'Droga SE' },
    { id: 'SITE', label: 'Boden' },
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
    let w = def.label.length * 8 + 24;
    for (const c of cells.slice(0, 40)) w = Math.max(w, Math.ceil(c.scrollWidth) + 16);
    if (th) w = Math.max(w, Math.ceil(th.scrollWidth) + 16);
    persistCols({ ...colPrefs, widths: { ...colPrefs.widths, [id]: Math.min(360, Math.max(0, w)) } });
  }


  return (
    <div className="panel section-card page-sections" data-page="schedule" style={{ margin: 12, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="panel-hd" style={{ flexWrap: 'wrap' }}>
        <h2>{t(locale, 'nav_sched')}</h2>
        <span className="sub">{verLine}</span>
        <div className="spacer" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
          {canImportSchedule(role) ? (
            <button type="button" className="chipbtn" onClick={() => setStep('upload')} disabled={parsing}>
              Wgraj aktualizację
            </button>
          ) : null}
          <button
            type="button"
            className="chipbtn"
            onClick={() => {
              saveSchedPrefs(colPrefs);
              setSavedFlash(true);
              window.setTimeout(() => setSavedFlash(false), 1600);
              pushToast('Widok kolumn zapisany', 'MEDIUM');
            }}
          >
            {savedFlash ? 'Zapisano' : 'Zapisz widok'}
          </button>
          <div className="sched-col-picker">
            <button type="button" className="chipbtn" aria-expanded={colMenu} onClick={() => setColMenu((v) => !v)}>
              Kolumny
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
                      {c.label}
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
                  const result = await exportLoadsXlsx(loads, `WATCH_TOWER_${role}_harmonogram.xlsx`);
                  pushToast(`Eksport XLSX · ${result.rows} wierszy · ${result.bytes} B`, 'MEDIUM');
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  pushToast(`Eksport XLSX nieudany: ${msg}`, 'CRITICAL');
                }
              })();
            }}
          >
            Eksport XLSX
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
            Wgraj aktualizację · {filename}
            {dryRun ? (
              <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 8 }}>
                {dryRun.accepted}/{dryRun.total} OK · ⚠{dryRun.warnings}
              </span>
            ) : null}
          </div>
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
                <span style={{ color: 'var(--ink-3)' }}>−{dryRun.removedIds.length}</span>
                {' · '}
                <span style={{ color: 'var(--red)' }}>⚠{dryRun.rejected}</span>
              </div>
              <button
                type="button"
                className="btn"
                disabled={dryRun.accepted === 0}
                title={
                  dryRun.accepted === 0
                    ? 'Brak poprawnych wierszy — commit zablokowany (baza nietknięta)'
                    : undefined
                }
                onClick={() => {
                  if (dryRun.accepted === 0) {
                    pushToast(
                      'Import odrzucony — brak poprawnych wierszy, baza nietknięta',
                      'CRITICAL',
                    );
                    return;
                  }
                  commitImport({
                    added: dryRun.added,
                    changed: dryRun.changed,
                    removedIds: dryRun.removedIds,
                    rejected: dryRun.rejected,
                    filename: dryRun.filename,
                    accepted: dryRun.accepted,
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
              <span style={{ color: 'var(--go)' }}>Import zatwierdzony</span>{' '}
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
              {c.label}
            </button>
          ))}
          <div className="spacer" />
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {list.length} / {loads.length}
          </span>
        </div>
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
                  let label = def.label;
                  if (id === 'cost' && role === 'SCX') label = 'Moja stawka';
                  if (id === 'rev' && role === 'KSH') label = 'Twoja cena';
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
                      title="Przeciągnij = kolejność · dwuklik = dopasuj szerokość"
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
              {list.map((l) => {
                const dmin = delayMinutes(l);
                return (
                  <tr
                    key={l.id}
                    data-load={l.id}
                    className={`${l.status === 'DELIVERED' ? 'done' : ''} ${hoverLoadId === l.id || selectedLoadId === l.id ? 'hl' : ''}`}
                    onMouseEnter={() => setHoverLoad(l.id)}
                    onMouseLeave={() => setHoverLoad(null)}
                    onClick={() => selectLoad(l.id)}
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
                              <span className="code">{l.code}</span>
                            </td>
                          );
                        case 'type':
                          return <td key={id} data-col={id}>{l.itemType}</td>;
                        case 'dims':
                          return (
                            <td
                              key={id}
                              data-col={id}
                              className={l.dims.lengthM > 16.5 || l.dims.widthM > 2.55 ? 'over' : undefined}
                              title={
                                l.dims.lengthM > 16.5 || l.dims.widthM > 2.55
                                  ? 'Ładunek ponadnormatywny'
                                  : undefined
                              }
                            >
                              {fmtDim(l.dims.lengthM)} × {fmtDim(l.dims.widthM)} × {fmtDim(l.dims.heightM)}
                            </td>
                          );
                        case 'weight':
                          return (
                            <td key={id} data-col={id} className="num">
                              {fmtDim(l.dims.weightT)} t
                            </td>
                          );
                        case 'load':
                          return <td key={id} data-col={id}>{formatLoadPl(l.plannedLoadDate)}</td>;
                        case 'deliver':
                          return <td key={id} data-col={id}>{formatUnloadSe(l.plannedDeliverDate)}</td>;
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
                                l.resources.driverName
                              ) : (
                                <span style={{ color: 'var(--red)' }}>— brak —</span>
                              )}
                            </td>
                          );
                        case 'phone':
                          return (
                            <td key={id} data-col={id}>
                              {l.resources.driverPhone ? (
                                <a href={`tel:${l.resources.driverPhone}`} className="mono" onClick={(e) => e.stopPropagation()}>
                                  {l.resources.driverPhone}
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        case 'plate':
                          return (
                            <td key={id} data-col={id}>
                              {l.resources.tractorPlate ? (
                                <span className="mono">{l.resources.tractorPlate}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        case 'eta':
                          return <td key={id} data-col={id}>{formatEtaBoden(l.etaBoden)}</td>;
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
                              {l.pricing.costTotal.toLocaleString('pl-PL')}
                            </td>
                          );
                        case 'rev':
                          return (
                            <td key={id} data-col={id} className={`num money${stick ? ' stick' : ''}`}>
                              {l.pricing.revTotal.toLocaleString('pl-PL')}
                            </td>
                          );
                        case 'margin':
                          return (
                            <td key={id} data-col={id} className={`num money stick ${l.pricing.marginPct < 0.18 ? 'neg' : ''}`}>
                              {l.pricing.margin.toLocaleString('pl-PL')}{' '}
                              <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 11.5, marginLeft: 5 }}>
                                {(l.pricing.marginPct * 100).toFixed(1).replace('.', ',')}%
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
        <div className="note">
          {showMargin
            ? 'Kwoty w PLN, po przeliczeniu kursem NBP tabela A z dnia poprzedzającego wykonanie usługi. Marża poniżej 18% jest oznaczona na czerwono.'
            : role === 'KSH'
              ? 'Widzisz swoją cenę. Stawki przewoźnika i marża spedytora nie są dostępne w tej roli — ograniczenie działa na poziomie bazy danych, nie interfejsu.'
              : 'Widzisz swoją stawkę. Cena płacona przez klienta i marża spedytora nie są dostępne w tej roli — ograniczenie działa na poziomie bazy danych, nie interfejsu.'}
        </div>
      </div>
    </div>
  );
}

