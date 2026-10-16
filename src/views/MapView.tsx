import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveMark } from '../components/shell/LiveMark';
import { useTowerStore } from '../store/useTowerStore';
import { filterLoads } from '../lib/selectors';
import { StatusPill } from '../components/ui/StatusPill';
import { CorridorMap } from '../components/map/LazyCorridorMap';
import { t, tp } from '../i18n/messages';
import { fetchSituations } from '../lib/trafikverket';
import { trafikverketShortLabel } from '../lib/demoLabel';
import { PROD_BUILD, shows } from '../lib/prodFacade';
import { formatEtaBodenCompact } from '../lib/time';
import { latestReadAt, subscribeFerryPositions, type AisMode } from '../lib/ais';
import { formatOpsDateTime } from '../lib/time';
import { clickableRow } from '../lib/clickableRow';
import { vehiclesInMotion } from '../lib/format';
import { transportLabel } from '../lib/transportName';
import { StageBar, StageChip } from '../components/shell/StageBar';
import { StatusMarkers } from '../components/ui/StatusPill';
import { isOnRoute, nextTrackingStarts, statusMarkers, trackingWindowPrep } from '../lib/stageTiles';
import { delayPillMinutes } from '../lib/prodDash';
import { delayMinutesVsPlan } from '../lib/time';
import { filterLoadsForRole } from '../lib/permissions';
import { getNow } from '../lib/frozenNow';
import { formatTableDay, refYearInOps } from '../lib/time';
import type { Load } from '../types';

/** Claude maplayers — exactly 5. Labels via i18n. */
const LAYER_ORDER: { key: string; labelKey: string }[] = [
  { key: 'vehicles', labelKey: 'map_layer_vehicles' },
  { key: 'geofence', labelKey: 'nav_geo' },
  { key: 'route', labelKey: 'map_layer_route' },
  { key: 'seEvents', labelKey: 'nav_risk' },
  { key: 'trail', labelKey: 'map_trail' },
];

type MapColId = 'code' | 'cargo' | 'driver' | 'plate' | 'status' | 'eta' | 'window';

const MAP_COLS: { id: MapColId; labelKey: string; defaultWidth: number }[] = [
  { id: 'code', labelKey: 'map_col_code', defaultWidth: 88 },
  { id: 'cargo', labelKey: 'map_cargo', defaultWidth: 120 },
  { id: 'driver', labelKey: 'driver', defaultWidth: 120 },
  { id: 'plate', labelKey: 'plate', defaultWidth: 100 },
  { id: 'status', labelKey: 'status', defaultWidth: 110 },
  { id: 'eta', labelKey: 'eta', defaultWidth: 110 },
  { id: 'window', labelKey: 'map_col_window', defaultWidth: 88 },
];

const MAP_COLS_KEY = 'watch-tower-map-cols-v1';

function loadMapWidths(): Record<MapColId, number> {
  const base = Object.fromEntries(MAP_COLS.map((c) => [c.id, c.defaultWidth])) as Record<MapColId, number>;
  try {
    const raw = localStorage.getItem(MAP_COLS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<MapColId, number>>;
    for (const c of MAP_COLS) {
      const w = parsed[c.id];
      if (typeof w === 'number' && w >= 0) base[c.id] = w;
    }
  } catch {
    /* ignore */
  }
  return base;
}

/* wyglad/P4 (E27, img/e27-after): W trasie · Opóźnione · Brak GPS */
type TimingFilter = 'all' | 'late' | 'nogps';
const isLate = (l: Load) => l.delayed || l.status === 'DELAYED';
/* „Brak GPS” jak oznaczenie obok statusu (L7): tylko w trasie, po 30 min ciszy */
const isNoGps = (l: Load) => statusMarkers(l, { hasDelayMinutes: true }).includes('nogps');

export function MapView() {
  const loads = useTowerStore((s) => s.loads);
  const role = useTowerStore((s) => s.role);
  const stageFilter = useTowerStore((s) => s.stageFilter);
  const search = useTowerStore((s) => s.search);
  const setSearch = useTowerStore((s) => s.setSearch);
  const hoverLoadId = useTowerStore((s) => s.hoverLoadId);
  const setHoverLoad = useTowerStore((s) => s.setHoverLoad);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const mapLayers = useTowerStore((s) => s.mapLayers);
  const toggleLayer = useTowerStore((s) => s.toggleLayer);
  const locale = useTowerStore((s) => s.locale);
  const showDemoMarks = useTowerStore((s) => s.showDemoMarks);
  const setView = useTowerStore((s) => s.setView);
  const [tvMode, setTvMode] = useState<'live' | 'seed'>('seed');
  const [tvFromDb, setTvFromDb] = useState(false);
  const [aisMode, setAisMode] = useState<AisMode>(PROD_BUILD ? 'none' : 'seed');
  const [aisReadAt, setAisReadAt] = useState<string | null>(null);
  const [timing, setTiming] = useState<TimingFilter>('all');
  const [widths, setWidths] = useState<Record<MapColId, number>>(() => loadMapWidths());
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
      let cancelled = false;
      void import('../lib/corridorConditionsDb').then((mod) => mod.fetchCorridorCondition()).then((row) => {
        if (!cancelled) setTvFromDb(row != null);
      });
      return () => {
        cancelled = true;
      };
    }
    if (!shows('roadSituationsSe')) return;
    let cancelled = false;
    fetchSituations().then((r) => {
      if (!cancelled) setTvMode(r.mode ?? (r.items?.[0]?.source === 'live' ? 'live' : 'seed'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeFerryPositions({
      prod: PROD_BUILD,
      onUpdate: (pos, mode) => { setAisMode(mode); setAisReadAt(mode === 'db' ? latestReadAt(pos) : null); },
    });
  }, []);

  const baseList = useMemo(
    () => filterLoads(loads, role, stageFilter, search),
    [loads, role, stageFilter, search],
  );

  /* E27 / E28: na mapie i w „W trasie” tylko transporty w trasie (Załadunek … Plac Boden — ta sama suma co grupa paska i Kokpit, E9);
     z filtrem etapu tabela pokazuje ten etap (np. 92 w przygotowaniu), a mapa — tylko te z nich, które są w trasie („W trasie: 0”).
     „Teraz” zaokrąglone do minuty: listy i znaczniki nie przeliczają się przy każdym najechaniu (bez dodatkowych zapytań). */
  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const nowIso = useMemo(() => new Date(nowMin * 60_000).toISOString(), [nowMin]);
  const tableBase = useMemo(() => (stageFilter ? baseList : baseList.filter(isOnRoute)), [baseList, stageFilter]);
  const list = useMemo(() => {
    if (timing === 'late') return tableBase.filter(isLate);
    if (timing === 'nogps') return tableBase.filter(isNoGps);
    return tableBase;
  }, [tableBase, timing]);
  const onMap = useMemo(() => list.filter(isOnRoute), [list]);
  /* E27: na produkcji znacznik dostaje też transport w przygotowaniu po 03:00 w dniu załadunku, gdy baza ma jego pozycję GPS
     (CorridorMap rysuje na produkcji tylko pozycje z bazy). Tabela i „W trasie · N” zostają przy transportach w trasie.
     Demo nie ma GPS — tam bez zmian (obraz E28: „Przygotowanie” → „W trasie: 0”). Lista ma klucz z numerów, żeby nie pytać bazy co minutę od nowa. */
  const windowPrepKey = PROD_BUILD && timing === 'all' ? trackingWindowPrep(baseList, nowIso).map((l) => l.id).join(',') : '';
  const mapLoads = useMemo(() => {
    if (!windowPrepKey) return onMap;
    const ids = new Set(windowPrepKey.split(','));
    return [...onMap, ...baseList.filter((l) => ids.has(l.id))];
  }, [onMap, baseList, windowPrepKey]);
  const nextStarts = useMemo(() => nextTrackingStarts(filterLoadsForRole(loads, role), nowIso, 3), [loads, role, nowIso]);
  const refYear = refYearInOps(getNow());
  const filtersOn = !!stageFilter || !!search.trim() || timing !== 'all';

  /* E: licznik „N pojazdów” = tylko pojazdy w trasie z prawdziwą pozycją GPS (prod; to samo zapytanie co mapa, te same numery); demo = progress w ruchu. */
  const [fixIds, setFixIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    /* warunek wprost na zmiennej środowiska — paczka demo nie dostaje kodu pobierania pozycji (test I-2) */
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return undefined;
    let cancelled = false;
    const ids = mapLoads.map((l) => l.id);
    const run = () => {
      void import('../lib/vehiclePositions').then(({ fetchLatestVehicleFixes }) => fetchLatestVehicleFixes(ids)).then(
        (rows) => { if (!cancelled) setFixIds(new Set(rows.map((r) => r.loadId))); },
        () => { if (!cancelled) setFixIds(new Set()); },
      );
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [mapLoads]);
  const gpsWithFix = PROD_BUILD
    ? onMap.filter((l) => fixIds.has(l.id)).length
    : onMap.filter((l) => l.progress > 0 && l.progress < 1).length;
  /* pusto na mapie = nikt w trasie i żaden transport z okna śledzenia nie ma pozycji */
  const mapEmpty = onMap.length === 0 && !mapLoads.some((l) => fixIds.has(l.id));


  /* liczby przy chipach = to, co pokaże kliknięcie (E28 pkt 6) */
  const lateCount = tableBase.filter(isLate).length;
  const nogpsCount = tableBase.filter(isNoGps).length;

  const startResize = (id: MapColId, clientX: number) => {
    const startW = widthsRef.current[id] ?? 80;
    const startX = clientX;
    const onMove = (ev: MouseEvent) => {
      // Allow narrowing until cell text is fully clipped (min 0), like Harmonogram.
      const w = Math.min(420, Math.max(0, startW + (ev.clientX - startX)));
      setWidths((prev) => ({ ...prev, [id]: w }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try {
        localStorage.setItem(MAP_COLS_KEY, JSON.stringify(widthsRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      className="panel section-card page-sections"
      data-page="map"
      style={{ margin: 12, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 140px)' }}
    >
      <header className="panel-hd">
        <h2>{t(locale, 'nav_map')}</h2>
        <span className="sub">
          {vehiclesInMotion(gpsWithFix)}
          {/* telefon: bez opisu częstotliwości — mapa ma się zmieścić w całości po otwarciu (B-7a) */}
          <span className="map-sub-cadence"> · {t(locale, 'p4_map_sub')}</span>
        </span>
        <LiveMark />
        <div className="spacer" />
        <button type="button" className="chipbtn" onClick={() => setView('geo')}>
          {t(locale, 'nav_geo')}
        </button>
      </header>

      <div className="mapsplit" data-b7="fixed-map">
        <div className="mapbox">
          <div className="maplayers" role="group" aria-label={t(locale, 'nav_map')}>
            {LAYER_ORDER.map(({ key, labelKey }) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={!!mapLayers[key]}
                  onChange={() => toggleLayer(key)}
                />{' '}
                {t(locale, labelKey)}
              </label>
            ))}
          </div>
          <div className="mapstage">
            <CorridorMap loads={mapLoads} />
            {mapEmpty ? (
              /* E27: nikogo w oknie śledzenia — mapa bez znaczników z informacją na środku */
              <div className="map-empty" data-map-empty>
                <b>{t(locale, 'p4_map_empty')}</b>
                <span>{t(locale, filtersOn ? 'p4_map_empty_sub_f' : 'p4_map_empty_sub')}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mlist" style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
          <StageBar variant="page" />
          <div className="filters" style={{ borderBottom: '1px solid var(--rule)' }} data-map-filters>
            <input
              style={{ flex: 1, minWidth: 100 }}
              placeholder={t(locale, 'search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <StageChip />
            {/* z filtrem etapu „W trasie” zastępuje chip etapu (liczby niżej = ten etap) */}
            {stageFilter ? null : (
              <button
                type="button"
                className="chipbtn"
                data-timing="all"
                aria-pressed={timing === 'all'}
                onClick={() => setTiming('all')}
              >
                {tp(locale, 'p4_map_on', { n: tableBase.length })}
              </button>
            )}
            <button
              type="button"
              className="chipbtn"
              data-timing="late"
              aria-pressed={timing === 'late'}
              onClick={() => setTiming(timing === 'late' ? 'all' : 'late')}
              title={t(locale, 'a6_map_late_title')}
            >
              {tp(locale, 'p4_map_late', { n: lateCount })}
            </button>
            <button
              type="button"
              className="chipbtn"
              data-timing="nogps"
              aria-pressed={timing === 'nogps'}
              onClick={() => setTiming(timing === 'nogps' ? 'all' : 'nogps')}
              title={t(locale, 'a6_map_nogps_title')}
            >
              {tp(locale, 'p4_map_nogps', { n: nogpsCount })}
            </button>
          </div>

          <div className="tablewrap" style={{ overflowX: 'auto' }}>
            <table className="map-loads-table">
              <colgroup>
                {MAP_COLS.map((c) => (
                  <col key={c.id} style={{ width: widths[c.id] }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {MAP_COLS.map((c) => (
                    <th key={c.id} style={{ width: widths[c.id] }}>
                      {t(locale, c.labelKey)}
                      <span
                        className="col-resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startResize(c.id, e.clientX);
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={MAP_COLS.length} style={{ padding: 13, color: 'var(--ink-3)' }}>
                      {t(locale, 'map_empty')}
                    </td>
                  </tr>
                ) : (
                  list.map((l) => (
                    <tr
                      key={l.id}
                      data-load={l.id}
                      className={selectedLoadId === l.id || hoverLoadId === l.id ? 'is-active' : undefined}
                      onMouseEnter={() => setHoverLoad(l.id)}
                      onMouseLeave={() => setHoverLoad(null)}
                      {...clickableRow(() => selectLoad(l.id))}
                    >
                      <td>
                        <span className="cell-clip">
                          <span className="code" data-content>{transportLabel(l, role)}</span>
                        </span>
                      </td>
                      <td>
                        <span className="cell-clip" data-content><span data-content>{l.itemType}</span></span>
                      </td>
                      <td>
                        <span className="cell-clip" data-content>{l.resources.driverName || '—'}</span>
                      </td>
                      <td>
                        <span className="cell-clip" data-content>{l.resources.tractorPlate || '—'}</span>
                      </td>
                      <td>
                        <span className="cell-clip">
                          <StatusPill status={l.status} stage={l.stage} />
                          <StatusMarkers load={l} delayMin={delayPillMinutes(l, delayMinutesVsPlan(l.etaBoden, l.plannedDeliverDate, l.planDates?.deliveryTo), PROD_BUILD)} />
                        </span>
                      </td>
                      <td>
                        <span className="cell-clip mono">{formatEtaBodenCompact(l.etaBoden)}</span>
                      </td>
                      <td>
                        <span
                          className="cell-clip"
                          style={{ color: l.delayed ? 'var(--red)' : 'var(--ink-3)' }}
                        >
                          {l.delayed ? t(locale, 'map_late') : t(locale, 'map_on_time')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* E27: najbliższe włączenia śledzenia (03:00 w dniu załadunku), z naczepą albo „brak naczepy” */}
          <div className="map-next" data-map-next>
            <div className="map-next-hd">{t(locale, 'p4_map_next')}</div>
            {nextStarts.length === 0 ? (
              <div className="map-next-row"><span className="muted">{t(locale, 'p4_map_next_none')}</span></div>
            ) : (
              nextStarts.map((g, gi) => {
                const noTrailer = g.loads.some((l) => !(l.resources.trailerPlate ?? '').trim());
                const plates = [...new Set(g.loads.map((l) => (l.resources.trailerPlate ?? '').trim()).filter(Boolean))];
                return (
                  <div key={g.day} className="map-next-row" data-next-day={g.day}>
                    <span>
                      <b>{tp(locale, 'p4_map_next_at', { day: formatTableDay(g.day, refYear) })}</b>
                      {' · '}
                      {g.loads.map((l) => transportLabel(l, role)).join(', ')}
                    </span>
                    {noTrailer ? (
                      <span className="map-next-warn">{t(locale, gi === 0 ? 'p4_map_no_trailer_todo' : 'p4_map_no_trailer')}</span>
                    ) : (
                      <span className="muted" data-content>{plates.join(', ')}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="note">
        {t(locale, 'map_note')} {t(locale, 'a6_map_tv')}{' '}
        <b>{PROD_BUILD ? (tvFromDb ? 'Trafikverket · E4' : t(locale, 'i2_no_source')) : shows('roadSituationsSe') ? trafikverketShortLabel(tvMode, showDemoMarks, locale) : t(locale, 'i2_no_source')}</b>
        {' · '}
        {t(locale, 'a6_map_ais')}{' '}
        <b data-ais={aisMode}>{aisMode === 'live' ? t(locale, 'map_ais_live') : aisMode === 'db' ? t(locale, 'i2_ais_db').replace('{d}', formatOpsDateTime(aisReadAt)) : shows('aisSeedPositions') ? t(locale, 'a6_demo_seed') : t(locale, 'i2_no_source')}</b>
        {aisMode === 'db' ? <> ({t(locale, 'i2_ais_attr')})</> : null}
        {PROD_BUILD ? null : (
          <>
            {' · '}
            {t(locale, 'map_gps_note')}
          </>
        )}</div>
    </div>
  );
}
