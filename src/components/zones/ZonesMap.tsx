/**
 * wyglad/P8-c — mapy strony Strefy (E34, img/e34-after). „all”: mapa trasy z miejscami stref i liczbą stref przy miejscu
 * (Śrem, Gdańsk i Gdynia, Nynäshamn, Karlskrona, Boden). „one”: karta strefy — koło teraz, poprzedni kształt z historii
 * (przerywany), szkic zmiany i ostatnie pozycje transportów przy strefie; w edycji kliknięcie mapy przenosi środek.
 * Kolory z tokenów motywu (odczyt zmiennych CSS). Podkład jak w edytorze stref (demo: zapasowy, produkcja: HERE).
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTowerStore } from '../../store/useTowerStore';
import { installFallback } from '../map/fallbackTiles';
import { plPlural } from '../../lib/plPlural';
import { groupOf, radiusText, routeOf, type ZoneRow } from '../../lib/p8cZones';
import type { NearPos } from '../../lib/p8cSource';
import { formatListDateTime } from '../../lib/format';
import { DEMO_ROAD_LINES } from '../../data/roadLinesDemo';
import { WATER_GDN_NYN, WATER_GDY_KAA } from '../../lib/map/draw';
import { p8ct } from '../../i18n/p8c';

type Circle = { lat: number; lng: number; radiusM: number };
/* stałe puste listy — nowa pusta tablica przy każdym renderze przerysowywałaby mapę */
const NO_ZONES: readonly ZoneRow[] = [];
const NO_NEAR: readonly NearPos[] = [];

/** Etykieta jako węzeł DOM z `textContent` (nazwy stref i kody transportów pochodzą z bazy — bez HTML). */
function textNode(parts: readonly { t: string; bold?: boolean }[]): HTMLElement {
  const el = document.createElement('span');
  for (const p of parts) {
    const x = document.createElement(p.bold ? 'b' : 'span');
    x.textContent = p.t;
    el.appendChild(x);
  }
  return el;
}

export interface ZonesMapProps {
  mode: 'all' | 'one';
  zones?: readonly ZoneRow[];
  zone?: Circle | null;
  prev?: Circle | null;
  draft?: Circle | null;
  near?: readonly NearPos[];
  onMove?: ((lat: number, lng: number) => void) | null;
  label: string;
}

const tok = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/** Miejsca na mapie trasy: zbiory stref przy jednym miejscu. */
function clusters(zones: readonly ZoneRow[]): { name: string; lat: number; lng: number; n: number; left: boolean; down: boolean }[] {
  const key = (z: ZoneRow) => {
    const g = groupOf(z);
    if (g === 'gdansk' || g === 'gdynia') return 'Gdańsk i Gdynia';
    if (g === 'se_ports') return routeOf(z) === 'STENA' ? 'Karlskrona' : 'Nynäshamn';
    if (g === 'srem') return 'Śrem';
    if (g === 'boden') return 'Boden';
    return z.name;
  };
  const m = new Map<string, ZoneRow[]>();
  for (const z of zones) m.set(key(z), [...(m.get(key(z)) ?? []), z]);
  return [...m].map(([name, zs]) => {
    /* środek miejsca: strefy bez buforów (bufor bywa przesunięty o kilka km) */
    const core = zs.filter((z) => z.radiusM < 10_000);
    const pts = core.length ? core : zs;
    return {
      name,
      lat: pts.reduce((s, z) => s + z.lat, 0) / pts.length,
      lng: pts.reduce((s, z) => s + z.lng, 0) / pts.length,
      n: zs.length,
      left: name === 'Karlskrona' || name === 'Nynäshamn',
      down: name === 'Śrem',
    };
  });
}

export default function ZonesMap({ mode, zones = NO_ZONES, zone, prev, draft, near = NO_NEAR, onMove, label }: ZonesMapProps) {
  const theme = useTowerStore((s) => s.theme);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);
  const tilesRef = useRef<L.Layer | null>(null);
  const onMoveRef = useRef(onMove);
  const fitKey = useRef('');
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  useEffect(() => {
    const el = box.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    map.setView([60, 18], 4);
    map.on('click', (e) => onMoveRef.current?.(e.latlng.lat, e.latlng.lng));
    /* P11 (e34): mapa wszystkich stref z trasą — droga (demo: stałe odcinki lądowe; produkcja: trasy HERE z serwera)
       i przerywane przeprawy promowe między miejscami, pod strefami */
    const route = L.layerGroup().addTo(map);
    routeRef.current = route;
    const roadStyle = { color: tok('--amber', '#C97E12'), weight: 3, opacity: 0.8, interactive: false };
    const drawRoads = (lines: readonly (readonly (readonly [number, number])[])[]) => {
      for (const line of lines) L.polyline(line.map(([lat, lng]) => L.latLng(lat, lng)), roadStyle).addTo(route);
    };
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') drawRoads(DEMO_ROAD_LINES.map((l) => l));
    else void import('../map/applyBasemap').then(({ loadRoadLines }) => loadRoadLines()).then((lines) => { if (routeRef.current === route) drawRoads(lines); }).catch(() => undefined);
    for (const lane of [WATER_GDN_NYN, WATER_GDY_KAA]) {
      L.polyline(lane.map(([lng, lat]) => L.latLng(lat, lng)), { color: tok('--sea', '#245C87'), weight: 2, opacity: 0.8, dashArray: '6 6', interactive: false }).addTo(route);
    }
    groupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = window.setTimeout(() => map.invalidateSize(), 200);
    return () => { window.clearTimeout(t); map.remove(); mapRef.current = null; groupRef.current = null; routeRef.current = null; tilesRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
      tilesRef.current = installFallback(map, tilesRef.current, theme);
      return;
    }
    let cancelled = false;
    let current: L.Layer | null = tilesRef.current;
    const run = () => {
      void import('../map/applyBasemap').then(({ applyBasemap }) => applyBasemap(map, current, theme, () => { if (!cancelled) run(); })).then((layer) => {
        if (cancelled) { if (map.hasLayer(layer)) map.removeLayer(layer); return; }
        current = layer;
        tilesRef.current = layer;
      });
    };
    run();
    return () => { cancelled = true; };
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const g = groupRef.current;
    if (!map || !g) return;
    g.clearLayers();
    const go = tok('--go', '#1B6E5D');
    const sea = tok('--sea', '#245C87');
    const amber = tok('--amber', '#C97E12');
    const plan = tok('--plan', '#6C7D8A');
    const red = tok('--red', '#B32639');
    const ink = tok('--ink', '#0E1A24');
    const bounds = L.latLngBounds([]);
    /* wąska mapa (telefon): etykiety pozycji nad i pod punktem — w prawo i w lewo nie mieszczą się; u dołu wyższy podpis
       źródła mapy (link 44 px), więc więcej miejsca przy dolnej krawędzi */
    const slim = (box.current?.clientWidth ?? 1000) < 520;
    const padEnd: [number, number] = [28, slim ? 96 : 28];
    const route = routeRef.current;
    if (route) { if (mode === 'all') { if (!map.hasLayer(route)) route.addTo(map); } else if (map.hasLayer(route)) map.removeLayer(route); }
    if (mode === 'all') {
      for (const z of zones) {
        if (z.radiusM >= 10_000) continue;
        L.circle([z.lat, z.lng], { radius: z.radiusM, color: z.active ? sea : plan, weight: 1, fillOpacity: 0.15, interactive: false }).addTo(g);
      }
      for (const c of clusters(zones)) {
        const word = plPlural(c.n, 'strefa', 'strefy', 'stref');
        L.circleMarker([c.lat, c.lng], { radius: 7, color: ink, weight: 2, fillColor: ink, fillOpacity: 1, interactive: false }).addTo(g);
        L.marker([c.lat, c.lng], {
          interactive: false,
          keyboard: false,
          /* Nynäshamn i Karlskrona po lewej (jak na obrazie), reszta po prawej — etykiety blisko siebie się nie nakładają */
          icon: L.divIcon({
            className: `zm-label${c.left ? ' is-left' : ''}`,
            html: textNode([{ t: c.name, bold: true }, { t: `${c.n} ${word}` }]),
            iconSize: undefined,
            /* Nynäshamn nad punktem, Karlskrona pod nim — przy małym przybliżeniu punkty są blisko siebie */
            iconAnchor: c.name === 'Nynäshamn' ? [118, 34] : c.name === 'Karlskrona' ? [118, 5] : c.down ? [-12, -6] : [-12, 14],
          }),
        }).addTo(g);
        bounds.extend([c.lat, c.lng]);
      }
      const k = `all:${zones.length}`;
      if (bounds.isValid() && fitKey.current !== k) { map.fitBounds(bounds, { paddingTopLeft: [30, 30], paddingBottomRight: padEnd, animate: false }); fitKey.current = k; }
      return;
    }
    if (prev) {
      const pc = L.circle([prev.lat, prev.lng], { radius: prev.radiusM, color: plan, weight: 2, dashArray: '6 6', fillOpacity: 0.04, interactive: false })
        .bindTooltip(p8ct('p8c_map_before', { r: radiusText(prev.radiusM) }), { permanent: true, direction: 'left', className: 'zm-tip' })
        .addTo(g);
      bounds.extend(pc.getBounds());
    }
    if (zone) {
      const c = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, color: go, weight: 3, fillColor: go, fillOpacity: 0.12, interactive: false }).addTo(g);
      const now = p8ct('p8c_map_now', { r: radiusText(zone.radiusM) });
      /* telefon: „teraz · 1 000 m” pod kołem, żeby nie wchodziło na etykiety pozycji przy granicy */
      if (slim) L.tooltip({ permanent: true, direction: 'bottom', className: 'zm-tip' }).setLatLng([zone.lat - zone.radiusM / 111_320, zone.lng]).setContent(now).addTo(g);
      else c.bindTooltip(now, { permanent: true, direction: 'top', className: 'zm-tip' });
      bounds.extend(c.getBounds());
    }
    if (draft) {
      const d = L.circle([draft.lat, draft.lng], { radius: draft.radiusM, color: amber, weight: 2, dashArray: '8 6', fillColor: amber, fillOpacity: 0.08, interactive: false }).addTo(g);
      L.circleMarker([draft.lat, draft.lng], { radius: 5, color: amber, weight: 2, fillColor: amber, fillOpacity: 1, interactive: false }).addTo(g);
      bounds.extend(d.getBounds());
    }
    near.forEach((p, i) => {
      /* pozycje blisko siebie: etykiety na przemian w prawo i w lewo (img/e34-after) */
      L.circleMarker([p.lat, p.lng], { radius: 7, color: tok('--surface', '#FFFFFF'), weight: 2, fillColor: p.label === 'postój' ? red : go, fillOpacity: 1, interactive: false })
        .bindTooltip(textNode([{ t: p8ct('p8c_pos', { code: p.code, label: p.label, at: formatListDateTime(p.at) }) }]), { permanent: true, direction: slim ? (i % 2 ? 'bottom' : 'top') : i % 2 ? 'left' : 'right', className: 'zm-tip' })
        .addTo(g);
      bounds.extend([p.lat, p.lng]);
    });
    const k = `one:${zone?.lat}:${zone?.lng}:${zone?.radiusM}:${prev?.lat ?? ''}:${draft ? 'd' : ''}:${near.length}`;
    if (bounds.isValid() && fitKey.current !== k) { map.fitBounds(bounds, { paddingTopLeft: [28, 28], paddingBottomRight: padEnd, maxZoom: 15, animate: false }); fitKey.current = k; }
  }, [mode, zones, zone, prev, draft, near, theme]);

  return <div ref={box} className={`zm zm-${mode}${onMove ? ' is-edit' : ''}`} role="region" aria-label={label} data-zones-map={mode} />;
}
