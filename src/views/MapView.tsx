import { useEffect, useMemo, useRef, useState } from 'react';
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

type TimingFilter = 'all' | 'ontime' | 'late' | 'nogps' | 'risk';

export function MapView() {
  const loads = useTowerStore((s) => s.loads);
  const role = useTowerStore((s) => s.role);
  const stageFilter = useTowerStore((s) => s.stageFilter);
  const risks = useTowerStore((s) => s.risks);
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
  const [gpsWithFix, setGpsWithFix] = useState(0);
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

  const riskLoadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of risks) {
      if (r.loadId) ids.add(r.loadId);
    }
    return ids;
  }, [risks]);

  const list = useMemo(() => {
    if (timing === 'ontime') return baseList.filter((l) => !l.delayed);
    if (timing === 'late') return baseList.filter((l) => l.delayed);
    if (timing === 'nogps') {
      return baseList.filter(
        (l) => l.status === 'SILENT' || (l.silentMinutes != null && l.silentMinutes >= 30),
      );
    }
    if (timing === 'risk') return baseList.filter((l) => riskLoadIds.has(l.id));
    return baseList;
  }, [baseList, timing, riskLoadIds]);

  /* E: licznik „N pojazdów” = tylko pojazdy z prawdziwą pozycją GPS (prod); demo = progress w ruchu. */
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
      setGpsWithFix(list.filter((l) => l.progress > 0 && l.progress < 1).length);
      return undefined;
    }
    let cancelled = false;
    const ids = list.map((l) => l.id);
    const run = () => {
      void import('../lib/vehiclePositions').then(({ fetchLatestVehicleFixes }) => fetchLatestVehicleFixes(ids)).then(
        (rows) => {
          if (cancelled) return;
          const want = new Set(ids);
          setGpsWithFix(rows.filter((r) => want.has(r.loadId)).length);
        },
        () => { if (!cancelled) setGpsWithFix(0); },
      );
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [list]);


  const ontimeCount = baseList.filter((l) => !l.delayed).length;
  const lateCount = baseList.filter((l) => l.delayed).length;
  const nogpsCount = baseList.filter(
    (l) => l.status === 'SILENT' || (l.silentMinutes != null && l.silentMinutes >= 30),
  ).length;
  const riskCount = baseList.filter((l) => riskLoadIds.has(l.id)).length;

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
          {vehiclesInMotion(gpsWithFix)} · {t(locale, 'map_pos_every')}
        </span>
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
            <CorridorMap loads={list} />
          </div>
        </div>

        <div className="mlist" style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
          <div className="filters" style={{ borderBottom: '1px solid var(--rule)' }}>
            <input
              style={{ flex: 1, minWidth: 100 }}
              placeholder={t(locale, 'search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'all'}
              onClick={() => setTiming('all')}
            >
              {tp(locale, 'a6_map_all', { n: String(baseList.length) })}
            </button>
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'ontime'}
              onClick={() => setTiming(timing === 'ontime' ? 'all' : 'ontime')}
              title={t(locale, 'a6_map_ontime_title')}
            >
              {tp(locale, 'a6_map_ontime', { n: String(ontimeCount) })}
            </button>
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'late'}
              onClick={() => setTiming(timing === 'late' ? 'all' : 'late')}
              title={t(locale, 'a6_map_late_title')}
            >
              {t(locale, 'map_late')} · {lateCount}
            </button>
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'nogps'}
              onClick={() => setTiming(timing === 'nogps' ? 'all' : 'nogps')}
              title={t(locale, 'a6_map_nogps_title')}
            >
              {tp(locale, 'a6_map_nogps', { n: String(nogpsCount) })}
            </button>
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'risk'}
              onClick={() => setTiming(timing === 'risk' ? 'all' : 'risk')}
              title={t(locale, 'a6_map_risk_title')}
            >
              {tp(locale, 'a6_map_risk', { n: String(riskCount) })}
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
