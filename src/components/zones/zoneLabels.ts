/**
 * DP-74 (Pakiet DP-A): etykiety miejsc na mapie wszystkich stref (`ZonesMap` mode="all") — kierunek względem punktu
 * i kadr obejmujący punkty razem z etykietami.
 */
import L from 'leaflet';

/**
 * DP-74: położenie etykiety miejsca względem punktu. Nynäshamn w prawo (nad morzem — w lewo zasłaniała Sztokholm),
 * Karlskrona w lewo nad punktem (wcześniej w lewo pod punktem — zasłaniała Kopenhagę; w prawo wchodziłaby na etykiety
 * Nynäshamn i Gdańska), Boden w lewo (najbardziej na wschód — w prawo była ucinana), Śrem w prawo pod punktem.
 */
export type LabelPlace = 'right' | 'left-up' | 'right-down' | 'left';
export const LABEL_PLACE: Readonly<Record<string, LabelPlace>> = {
  Nynäshamn: 'right', Karlskrona: 'left-up', 'Gdańsk i Gdynia': 'right', Śrem: 'right-down', Boden: 'left',
};
/** Zapasowy rozmiar etykiety (px), gdy przeglądarka jej jeszcze nie zmierzyła (jsdom, ukryta mapa). */
export const LABEL_BOX = { w: 112, h: 38 } as const;
/** Odstęp etykiety od punktu (px). */
const GAP = 12;
/** Lewy górny róg etykiety względem punktu (px) — `iconAnchor` to wartość przeciwna. */
export function labelOffset(place: LabelPlace, w: number, h: number): [number, number] {
  if (place === 'left') return [-GAP - w, -h / 2];
  if (place === 'left-up') return [-GAP - w, -h - 4];
  if (place === 'right-down') return [GAP, 2];
  return [GAP, -h / 2];
}

/**
 * DP-74: kadr mapy wszystkich stref z etykietami — największe przybliżenie (krok `zoomSnap`, nie większe niż z samych
 * punktów), przy którym punkty i etykiety mieszczą się w mapie z marginesem; środek kadru = środek punktów z etykietami.
 */
export function fitWithLabels(
  map: L.Map,
  items: readonly { lat: number; lng: number; place: LabelPlace; w: number; h: number }[],
  pad: { top: number; left: number; bottom: number; right: number },
): void {
  const size = map.getSize();
  const roomW = size.x - pad.left - pad.right;
  const roomH = size.y - pad.top - pad.bottom;
  if (!items.length || roomW <= 0 || roomH <= 0) return;
  const pts = L.latLngBounds(items.map((i) => [i.lat, i.lng] as L.LatLngTuple));
  /* krok jak w Leaflet (`_limitZoom`): `zoomSnap`, a bez transformacji 3D — cały poziom */
  const step = (L.Browser.any3d ? map.options.zoomSnap : 1) || 1;
  let z = Math.floor(Math.min(map.getBoundsZoom(pts, false, L.point(pad.left + pad.right, pad.top + pad.bottom)), 12) / step) * step;
  const extent = (zoom: number) => {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const i of items) {
      const p = map.project([i.lat, i.lng], zoom);
      const [dx, dy] = labelOffset(i.place, i.w, i.h);
      x0 = Math.min(x0, p.x - 8, p.x + dx); x1 = Math.max(x1, p.x + 8, p.x + dx + i.w);
      y0 = Math.min(y0, p.y - 8, p.y + dy); y1 = Math.max(y1, p.y + 8, p.y + dy + i.h);
    }
    return { x0, y0, x1, y1 };
  };
  let e = extent(z);
  for (let k = 0; k < 40 && (e.x1 - e.x0 > roomW || e.y1 - e.y0 > roomH) && z > map.getMinZoom(); k++) {
    z -= step;
    e = extent(z);
  }
  /* środek obszaru z marginesami w punkcie środka zawartości (punkty + etykiety) */
  const cx = (e.x0 + e.x1) / 2 + (pad.right - pad.left) / 2;
  const cy = (e.y0 + e.y1) / 2 + (pad.bottom - pad.top) / 2;
  map.setView(map.unproject([cx, cy], z), z, { animate: false });
}
