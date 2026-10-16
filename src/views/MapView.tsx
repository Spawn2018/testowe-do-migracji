import { useEffect, useMemo, useState } from 'react';
import { LiveMark } from '../components/shell/LiveMark';
import { useTowerStore } from '../store/useTowerStore';
import { filterLoads } from '../lib/selectors';
import { CorridorMap } from '../components/map/LazyCorridorMap';
import { t, tp } from '../i18n/messages';
import { p9m, p9mp } from '../i18n/p9c';
import { PROD_BUILD } from '../lib/prodFacade';
import { latestReadAt, subscribeFerryPositions, type AisMode } from '../lib/ais';
import { clickableRow } from '../lib/clickableRow';
import { StageBar, StageChip } from '../components/shell/StageBar';
import { nextTrackingStarts } from '../lib/stageTiles';
import { filterLoadsForRole } from '../lib/permissions';
import { getNow } from '../lib/frozenNow';
import { formatTableDay, refYearInOps } from '../lib/time';
import { useIsPhone } from '../lib/useIsPhone';
import { headCounts, hm, mapRow, rowMatches, type MapRow } from '../lib/p9cMap';
import type { Load } from '../types';

/**
 * wyglad/P9-c — strona Mapa według E29 (zdecydowane 08.10 12:14, pyt. 1 A; L20, L22) i E45 pkt 2
 * (makieta `raport/img/e29-after`, `makiety_html/E29`).
 *
 * Mapa i tabela = te same transporty w oknie śledzenia (od 03:00 w dniu załadunku do „Dostarczone”); kafelek paska E28
 * zmienia zakres. Nagłówek bez deklaracji częstotliwości (L20) — godzina ostatniej pozycji jest w tabeli.
 * Telefon: „Warstwy ▾” → arkusz z warstwami i legendą; lista jako karty; dotknięcie znacznika → arkusz transportu.
 */

/** E29 pkt 3 (E45 pkt 2): 5 warstw w tej kolejności, domyślnie pierwsze dwie. */
const LAYER_ORDER: { key: string; labelKey: string; longKey?: string }[] = [
  { key: 'vehicles', labelKey: 'p9c_l_vehicles' },
  { key: 'route', labelKey: 'p9c_l_route' },
  { key: 'geofence', labelKey: 'p9c_l_zones' },
  { key: 'seEvents', labelKey: 'p9c_l_road' },
  { key: 'trail', labelKey: 'p9c_l_trail', longKey: 'p9c_l_trail_long' },
];

/* E29 pkt 5 (L22): Opóźnione (po wyjeździe) · Brak GPS (cisza 30 min w ruchu) · Bez pozycji (w oknie bez sygnału) */
type TimingFilter = 'all' | 'late' | 'nogps' | 'nopos';

function Legend({ locale }: { locale: Parameters<typeof p9m>[0] }) {
  return (
    <div className="mapsheet-legend" data-sheet-legend>
      <span><i className="mk-dot is-load" />{p9m(locale, 'p9c_lg_load')}</span>
      <span><i className="mk-dot is-road" />{p9m(locale, 'p9c_lg_road_short')}</span>
      <span><i className="mk-dot is-site" />{p9m(locale, 'p9c_lg_site')}</span>
      <span><i className="mk-dot is-late" />{p9m(locale, 'p9c_lg_late')}</span>
      <span><i className="mk-dot is-nogps" />{p9m(locale, 'p9c_lg_nogps')}</span>
      <span><i className="mk-dot is-ship" />{p9m(locale, 'p9c_lg_ship_short')}</span>
    </div>
  );
}

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
  const sailings = useTowerStore((s) => s.sailings);
  const phone = useIsPhone();
  const [aisMode, setAisMode] = useState<AisMode>(PROD_BUILD ? 'none' : 'seed');
  const [aisReadAt, setAisReadAt] = useState<string | null>(null);
  const [timing, setTiming] = useState<TimingFilter>('all');
  const [layersOpen, setLayersOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeFerryPositions({
      prod: PROD_BUILD,
      onUpdate: (pos, mode) => { setAisMode(mode); setAisReadAt(mode === 'db' ? latestReadAt(pos) : null); },
    });
  }, []);

  /* Escape zamyka arkusze telefonu */
  useEffect(() => {
    if (!layersOpen && !sheetId) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setLayersOpen(false); setSheetId(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layersOpen, sheetId]);

  /* „Teraz” zaokrąglone do minuty: listy i znaczniki nie przeliczają się przy każdym najechaniu. */
  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const nowIso = useMemo(() => new Date(nowMin * 60_000).toISOString(), [nowMin]);

  /* Rola i kafelek E28; wyszukiwanie po kodzie, nazwie (E41), numerach zleceń i tablicach (pkt 5) */
  const roleStage = useMemo(() => filterLoads(loads, role, stageFilter, ''), [loads, role, stageFilter]);

  /* Pozycje z bazy (produkcja): ten sam zestaw co mapa; demo bez zapytań */
  const [fixIds, setFixIds] = useState<ReadonlySet<string>>(() => new Set());
  const fixKey = useMemo(() => roleStage.map((l) => l.id).join(','), [roleStage]);
  useEffect(() => {
    /* warunek wprost na zmiennej środowiska — paczka demo nie dostaje kodu pobierania pozycji (test I-2) */
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return undefined;
    let cancelled = false;
    const ids = fixKey ? fixKey.split(',') : [];
    const run = () => {
      void import('../lib/vehiclePositions').then(({ fetchLatestVehicleFixes }) => fetchLatestVehicleFixes(ids)).then(
        (rows) => { if (!cancelled) setFixIds(new Set(rows.map((r) => r.loadId))); },
        () => { if (!cancelled) setFixIds(new Set()); },
      );
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [fixKey]);

  const rows = useMemo(() => {
    const ctx = {
      role, nowIso, prod: PROD_BUILD, hasFix: (id: string) => fixIds.has(id),
      sailingOf: (sid: string | null | undefined) => (sid ? sailings.find((s) => s.id === sid) : undefined),
      tx: (k: string, p?: Record<string, string | number>) => (p ? p9mp(locale, k, p) : p9m(locale, k)),
    };
    return roleStage.map((l) => ({ load: l, row: mapRow(l, ctx) }));
  }, [roleStage, role, nowIso, fixIds, sailings, locale]);

  /* pkt 1 (pyt. 1 A): bez kafelka — tylko okno śledzenia; z kafelkiem — cały etap */
  const scoped = useMemo(
    () => rows.filter(({ load, row }) => (stageFilter ? true : row.inWindow) && rowMatches(load, row.label, search)),
    [rows, stageFilter, search],
  );
  const list = useMemo(() => {
    if (timing === 'late') return scoped.filter(({ row }) => row.late);
    if (timing === 'nogps') return scoped.filter(({ row }) => row.nogps);
    if (timing === 'nopos') return scoped.filter(({ row }) => row.nopos);
    return scoped;
  }, [scoped, timing]);
  /* mapa = te same transporty; znacznik tylko z pozycją (produkcja: z bazy; demo: transporty w trasie) */
  const mapLoads: Load[] = useMemo(
    () => list.filter(({ row }) => row.inWindow && (PROD_BUILD || row.pos.kind !== 'none')).map(({ load }) => load),
    [list],
  );
  const head = headCounts(rows.filter(({ load, row }) => row.inWindow && rowMatches(load, row.label, '')).map(({ row }) => row));
  const nextStarts = useMemo(() => nextTrackingStarts(filterLoadsForRole(loads, role), nowIso, 3), [loads, role, nowIso]);
  const refYear = refYearInOps(getNow());
  const filtersOn = !!stageFilter || !!search.trim() || timing !== 'all';
  const shownWithPos = list.filter(({ row }) => row.inWindow && row.pos.kind !== 'none').length;
  const mapEmpty = shownWithPos === 0;

  /* liczby przy chipach = to, co pokaże kliknięcie (E28 pkt 6) */
  const lateCount = scoped.filter(({ row }) => row.late).length;
  const nogpsCount = scoped.filter(({ row }) => row.nogps).length;
  const noposCount = scoped.filter(({ row }) => row.nopos).length;

  const sheet = sheetId ? rows.find(({ load }) => load.id === sheetId) ?? null : null;
  const aisAt = aisMode === 'db' && aisReadAt ? hm(aisReadAt) : '';

  const layerBoxes = (long: boolean) => LAYER_ORDER.map(({ key, labelKey, longKey }) => (
    <label key={key} data-layer={key}>
      <input type="checkbox" checked={!!mapLayers[key]} onChange={() => toggleLayer(key)} />{' '}
      {p9m(locale, long && longKey ? longKey : labelKey)}
    </label>
  ));

  return (
    <div
      className="panel section-card page-sections"
      data-page="map"
      style={{ margin: 12, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 140px)' }}
    >
      <header className="panel-hd">
        <h2>{t(locale, 'nav_map')}</h2>
        <span className="sub" data-map-head>
          {phone
            ? p9mp(locale, 'p9c_head_short', { n: head.n, k: head.noPos })
            : <>
              {p9mp(locale, 'p9c_head', { n: head.n, m: head.withPos, k: head.noPos })}
              <span className="map-head-hint">{p9m(locale, 'p9c_head_hint')}</span>
            </>}
        </span>
        <LiveMark />
        <div className="spacer" />
        {/* E29 pkt 2 / E34: „Strefy” tylko HHL — tylko HHL ma tę stronę w menu */}
        {role === 'HHL' ? (
          <button type="button" className="chipbtn" data-map-zones onClick={() => setView('geo')}>
            {t(locale, 'nav_geo')}
          </button>
        ) : null}
      </header>

      <div className="mapsplit" data-b7="fixed-map">
        <div className="mapbox">
          {phone ? (
            <button type="button" className="map-layers-btn" data-map-layers-btn aria-expanded={layersOpen} onClick={() => setLayersOpen(true)}>
              {p9m(locale, 'p9c_layers')} ▾
            </button>
          ) : (
            <div className="maplayers" role="group" aria-label={p9m(locale, 'p9c_layers')}>
              {layerBoxes(false)}
            </div>
          )}
          <div className="mapstage">
            <CorridorMap loads={mapLoads} onMarker={phone ? (id) => setSheetId(id) : undefined} />
            {mapEmpty ? (
              /* E27 / E29: nikogo z pozycją — mapa bez znaczników z informacją na środku */
              <div className="map-empty" data-map-empty>
                <b>{p9m(locale, filtersOn ? 'p9c_empty_f' : 'p9c_empty')}</b>
                <span>{p9m(locale, filtersOn ? 'p9c_empty_sub_f' : 'p9c_empty_sub')}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mlist" style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
          <StageBar variant="page" />
          <div className="filters" style={{ borderBottom: '1px solid var(--rule)' }} data-map-filters>
            <input
              className="map-search"
              placeholder={p9m(locale, 'p9c_search')}
              aria-label={p9m(locale, 'p9c_search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <StageChip />
            {/* z filtrem etapu „W oknie” zastępuje chip etapu (liczby niżej = ten etap) */}
            {stageFilter ? null : (
              <button type="button" className="chipbtn" data-timing="all" aria-pressed={timing === 'all'} onClick={() => setTiming('all')}>
                {p9mp(locale, 'p9c_f_window', { n: scoped.length })}
              </button>
            )}
            <button type="button" className="chipbtn" data-timing="late" aria-pressed={timing === 'late'} onClick={() => setTiming(timing === 'late' ? 'all' : 'late')} title={t(locale, 'a6_map_late_title')}>
              {p9mp(locale, 'p9c_f_late', { n: lateCount })}
            </button>
            <button type="button" className="chipbtn" data-timing="nogps" aria-pressed={timing === 'nogps'} onClick={() => setTiming(timing === 'nogps' ? 'all' : 'nogps')} title={t(locale, 'a6_map_nogps_title')}>
              {p9mp(locale, 'p9c_f_nogps', { n: nogpsCount })}
            </button>
            {phone && noposCount === 0 && timing !== 'nopos' ? null : (
              <button type="button" className="chipbtn" data-timing="nopos" aria-pressed={timing === 'nopos'} onClick={() => setTiming(timing === 'nopos' ? 'all' : 'nopos')}>
                {p9mp(locale, 'p9c_f_nopos', { n: noposCount })}
              </button>
            )}
          </div>

          {phone ? (
            /* E29 pkt 9: lista jako karty */
            <div className="mcards map-cards" data-map-cards>
              {list.length === 0 ? <div className="muted map-cards-empty">{p9m(locale, 'p9c_list_empty')}</div> : list.map(({ load, row }) => (
                <MapCard key={load.id} row={row} locale={locale} onOpen={() => selectLoad(load.id)} />
              ))}
            </div>
          ) : (
            <div className="tablewrap">
              <table className="map-loads-table map-e29" data-map-table>
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '28%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{p9m(locale, 'p9c_c_transport')}</th>
                    <th>{p9m(locale, 'p9c_c_stage')}</th>
                    <th>{p9m(locale, 'p9c_c_pos')}</th>
                    <th>{p9m(locale, 'p9c_c_eta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 13, color: 'var(--ink-3)' }}>{p9m(locale, 'p9c_list_empty')}</td>
                    </tr>
                  ) : list.map(({ load, row }) => (
                    <tr
                      key={load.id}
                      data-load={load.id}
                      className={selectedLoadId === load.id || hoverLoadId === load.id ? 'is-active' : undefined}
                      onMouseEnter={() => setHoverLoad(load.id)}
                      onMouseLeave={() => setHoverLoad(null)}
                      {...clickableRow(() => selectLoad(load.id))}
                    >
                      <td data-map-name>
                        {/* E41: kod pogrubiony, numer zlecenia pod spodem (bez łamania w środku numeru) */}
                        <b className="code" data-content>{row.label.split(' · ')[0]}</b>
                        {row.label.includes(' · ') ? <span className="map-cell-sub mono">{row.label.split(' · ').slice(1).join(' · ')}</span> : null}
                      </td>
                      <td>
                        <span data-map-stage={row.tile ?? ''}>{t(locale, row.stageKey)}</span>
                        {row.stageSub ? <span className="map-cell-sub">{row.stageSub}</span> : null}
                      </td>
                      <td data-map-pos={row.pos.kind}>
                        <span className={row.pos.alarm ? 'map-alarm' : undefined}>{row.pos.text}</span>
                        {row.pos.sub ? <span className="map-cell-sub">{row.pos.sub}</span> : null}
                      </td>
                      <td data-map-eta>
                        <span className="mono">{row.eta.main}</span>
                        {row.eta.sub ? <span className={`map-cell-sub${row.eta.late ? ' map-alarm' : ''}`}>{row.eta.sub}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                      {g.loads.map((l) => mapRowLabel(rows, l)).join(', ')}
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

      {/* E29 pkt 8: tylko źródła i godzina odczytu statków */}
      <div className="note" data-map-note>
        {p9m(locale, 'p9c_note')}{aisAt ? p9mp(locale, 'p9c_note_ais_at', { t: aisAt }) : ''}.
      </div>

      {phone && layersOpen ? (
        <div className="scrim mapsheet-back" data-map-layers-sheet onClick={() => setLayersOpen(false)}>
          <div className="mapsheet" role="dialog" aria-label={p9m(locale, 'p9c_layers')} onClick={(e) => e.stopPropagation()}>
            <div className="mapsheet-hd">
              <b>{p9m(locale, 'p9c_layers')}</b>
              <button type="button" className="iconbtn" aria-label={p9m(locale, 'p9c_layers_close')} onClick={() => setLayersOpen(false)}>✕</button>
            </div>
            <div className="mapsheet-layers">{layerBoxes(true)}</div>
            <Legend locale={locale} />
          </div>
        </div>
      ) : null}

      {phone && sheet ? (
        <div className="scrim mapsheet-back" data-map-load-sheet onClick={() => setSheetId(null)}>
          <div className="mapsheet" role="dialog" aria-label={sheet.row.label} onClick={(e) => e.stopPropagation()}>
            <div className="mapsheet-hd">
              <b className="mapsheet-code">{sheet.row.label}</b>
              <span className="mtag">{t(locale, sheet.row.stageKey).toLocaleUpperCase('pl')}</span>
              {sheet.row.late ? <span className="mtag red">{p9m(locale, 'p9c_lg_late').toLocaleUpperCase('pl')}</span> : null}
              <span className="spacer" />
              <button type="button" className="iconbtn" aria-label={p9m(locale, 'p9c_sheet_close')} onClick={() => setSheetId(null)}>✕</button>
            </div>
            <div className="mapsheet-line">
              <span>{p9mp(locale, 'p9c_sheet_eta', { eta: sheet.row.eta.main })}</span>
              {sheet.row.eta.sub ? <span className={sheet.row.eta.late ? 'map-alarm' : 'muted'}> · {sheet.row.eta.sub}</span> : null}
            </div>
            <div className="mapsheet-line muted">
              {sheet.row.pos.kind === 'fix' || sheet.row.pos.kind === 'ship'
                ? p9mp(locale, 'p9c_sheet_last', { t: sheet.row.pos.text, seg: sheet.row.seg })
                : [sheet.row.pos.text, sheet.row.pos.sub].filter(Boolean).join(' · ')}
            </div>
            <button type="button" className="btn" data-sheet-open onClick={() => { const id = sheet.load.id; setSheetId(null); selectLoad(id); }}>
              {p9m(locale, 'p9c_sheet_open')}
            </button>
            <button
              type="button"
              className="btn ghost"
              data-sheet-trail
              onClick={() => {
                const id = sheet.load.id;
                if (!mapLayers.trail) toggleLayer('trail');
                setSheetId(null);
                selectLoad(id);
              }}
            >
              {p9m(locale, 'p9c_sheet_trail')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mapRowLabel(rows: readonly { load: Load; row: MapRow }[], l: Load): string {
  return rows.find((r) => r.load.id === l.id)?.row.label ?? l.code;
}

/** E29 pkt 9 (makieta telefonu): kod, oznaczenie, etap · pozycja · ETA. */
function MapCard({ row, locale, onOpen }: { row: MapRow; locale: Parameters<typeof p9m>[0]; onOpen: () => void }) {
  const tag = row.nogps ? row.pos.text : row.late && row.delayMin ? p9mp(locale, 'p9c_tip_late', { d: durShort(row.delayMin) }) : row.nopos ? row.pos.text : null;
  const parts = [t(locale, row.stageKey)];
  if (row.pos.kind === 'fix' || row.pos.kind === 'ship') parts.push(`${p9m(locale, 'p9c_c_pos').toLowerCase()} ${row.pos.text}`);
  if (row.eta.main && row.eta.main !== '–') parts.push(`ETA ${row.eta.main}${row.nogps ? ` ${p9m(locale, 'p9c_eta_from_last')}` : ''}`);
  return (
    <button type="button" className="mcard map-card" data-load={row.id} onClick={onOpen}>
      <span className="mcard-hd">
        <b>{row.label}</b>
        {tag ? <span className="mtag red" data-map-card-tag>{tag.toLocaleUpperCase('pl')}</span> : null}
      </span>
      <span className="mcard-sub">{parts.join(' · ')}</span>
      {row.nopos && row.pos.sub ? <span className="mcard-sub">{row.pos.sub}</span> : null}
    </button>
  );
}

function durShort(m: number): string {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h ? `${h} h${mm ? ` ${mm}` : ''}` : `${mm} min`;
}
