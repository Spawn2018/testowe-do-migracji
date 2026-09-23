import { useEffect, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { filterLoads } from '../lib/selectors';
import { StatusPill } from '../components/ui/StatusPill';
import { CorridorMap } from '../components/map/CorridorMap';
import { t } from '../i18n/messages';
import { fetchSituations } from '../lib/trafikverket';
import { subscribeAis, type AisMode } from '../lib/ais';

/** Claude maplayers — exactly 5. */
const LAYER_ORDER: { key: string; label: string }[] = [
  { key: 'vehicles', label: 'Pojazdy' },
  { key: 'geofence', label: 'Strefy' },
  { key: 'route', label: 'Trasa' },
  { key: 'seEvents', label: 'Ryzyka' },
  { key: 'trail', label: 'Ślad' },
];

type MapColId = 'code' | 'cargo' | 'driver' | 'plate' | 'status' | 'eta' | 'window';

const MAP_COLS: { id: MapColId; label: string; defaultWidth: number }[] = [
  { id: 'code', label: 'Kod', defaultWidth: 88 },
  { id: 'cargo', label: 'Ładunek', defaultWidth: 120 },
  { id: 'driver', label: 'Kierowca', defaultWidth: 120 },
  { id: 'plate', label: 'Rejestracja', defaultWidth: 100 },
  { id: 'status', label: 'Status', defaultWidth: 110 },
  { id: 'eta', label: 'ETA Boden', defaultWidth: 110 },
  { id: 'window', label: 'Okno', defaultWidth: 88 },
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

type TimingFilter = 'all' | 'ontime' | 'late';

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
  const setView = useTowerStore((s) => s.setView);
  const [tvMode, setTvMode] = useState<'live' | 'seed'>('seed');
  const [aisMode, setAisMode] = useState<AisMode>('seed');
  const [timing, setTiming] = useState<TimingFilter>('all');
  const [widths, setWidths] = useState<Record<MapColId, number>>(() => loadMapWidths());
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    let cancelled = false;
    fetchSituations().then((r) => {
      if (!cancelled) setTvMode(r.mode ?? (r.items?.[0]?.source === 'live' ? 'live' : 'seed'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeAis({
      onUpdate: (_pos, mode) => setAisMode(mode),
    });
  }, []);

  const baseList = useMemo(
    () => filterLoads(loads, role, stageFilter, search),
    [loads, role, stageFilter, search],
  );

  const list = useMemo(() => {
    if (timing === 'ontime') return baseList.filter((l) => !l.delayed);
    if (timing === 'late') return baseList.filter((l) => l.delayed);
    return baseList;
  }, [baseList, timing]);

  const inMotion = list.filter((l) => l.progress > 0 && l.progress < 1).length;
  const ontimeCount = baseList.filter((l) => !l.delayed).length;
  const lateCount = baseList.filter((l) => l.delayed).length;

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
          {inMotion || list.length} pojazdów w ruchu · pozycje co 5 min
        </span>
        <div className="spacer" />
        <button type="button" className="chipbtn" onClick={() => setView('geo')}>
          {t(locale, 'nav_geo')}
        </button>
      </header>

      <div className="mapsplit" style={{ flex: '1 1 auto', minHeight: 420 }}>
        <div className="mapbox" style={{ minHeight: 420 }}>
          <div className="maplayers">
            {LAYER_ORDER.map(({ key, label }) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={!!mapLayers[key]}
                  onChange={() => toggleLayer(key)}
                />{' '}
                {label}
              </label>
            ))}
          </div>
          <CorridorMap loads={list} />
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
              Wszystkie · {baseList.length}
            </button>
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'ontime'}
              onClick={() => setTiming(timing === 'ontime' ? 'all' : 'ontime')}
              title="Dostawy w wymaganym oknie dzień/godzina"
            >
              Terminowe · {ontimeCount}
            </button>
            <button
              type="button"
              className="chipbtn"
              aria-pressed={timing === 'late'}
              onClick={() => setTiming(timing === 'late' ? 'all' : 'late')}
              title="Dostawy po wymaganym oknie dzień/godzina"
            >
              Spóźnione · {lateCount}
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
                      {c.label}
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
                      Brak transportów dla wybranego filtra.
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
                      onClick={() => selectLoad(l.id)}
                    >
                      <td>
                        <span className="cell-clip">
                          <span className="code">{l.code}</span>
                        </span>
                      </td>
                      <td>
                        <span className="cell-clip">{l.itemType}</span>
                      </td>
                      <td>
                        <span className="cell-clip">{l.resources.driverName || '—'}</span>
                      </td>
                      <td>
                        <span className="cell-clip">{l.resources.tractorPlate || '—'}</span>
                      </td>
                      <td>
                        <span className="cell-clip">
                          <StatusPill status={l.status} stage={l.stage} />
                        </span>
                      </td>
                      <td>
                        <span className="cell-clip mono">{l.etaBoden?.slice(5, 16) ?? '—'}</span>
                      </td>
                      <td>
                        <span
                          className="cell-clip"
                          style={{ color: l.delayed ? 'var(--red)' : 'var(--ink-3)' }}
                        >
                          {l.delayed ? 'Spóźnione' : 'Terminowe'}
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
        Schemat korytarza, nie mapa nawigacyjna. Trasa lądowa w Szwecji odwzorowuje przebieg z
        zezwolenia, nie wynik routera. Trafikverket E4:{' '}
        <b>{tvMode === 'live' ? 'live' : 'seed'}</b>
        {' · '}
        AIS:{' '}
        <b>{aisMode === 'live' ? t(locale, 'map_ais_live') : 'seed'}</b>
        {' · '}
        GPS fleet tick co 1,5 s. Kolumny tabeli: przeciągnij krawędź nagłówka (jak Harmonogram).
      </div>
    </div>
  );
}
