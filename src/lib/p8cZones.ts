/**
 * wyglad/P8-c — Strefy (E34, decyzje 08.10.2026, 12:14; img/e34-after). Model widoku: lista według trasy (Śrem, Gdańsk ·
 * Polferries → Nynäshamn, Gdynia · Stena → Karlskrona, porty w Szwecji, Boden), co uruchamia każda strefa, parametry
 * opisane zwykłymi słowami, historia zmian z powodem i podgląd wpływu zmiany na transporty w oknie śledzenia.
 * Rodzaje: 6, które działają (Punkt kontrolny i Postój znikają); kraj tylko Polska albo Szwecja.
 * Czyste funkcje widoku — bez zapytań i zapisów.
 */
import type { Geofence, GeofenceType, Load } from '../types';
import type { FerryOperator } from './ferryCatalog';

export type ZoneGroup = 'srem' | 'gdansk' | 'gdynia' | 'se_ports' | 'boden' | 'other';
export const ZONE_GROUPS: readonly ZoneGroup[] = ['srem', 'gdansk', 'gdynia', 'se_ports', 'boden', 'other'];
/** Trasa promowa strefy = armator z katalogu promów (BN9-a). */
export type ZoneRoute = FerryOperator;

/** 6 rodzajów, które działają (E34 „Porządek”). */
export const ZONE_KINDS: readonly GeofenceType[] = ['LOADING', 'PRE_ARRIVAL', 'PRE_PORT', 'PORT_OUT', 'PORT_IN', 'SITE'];

export interface ZoneRow extends Geofence {
  /** trasa promowa portu (E34 „Porty według rejsu”); null — strefa bez trasy albo nieznana */
  route?: ZoneRoute | null;
  /** ostatnie zdarzenie przy strefie: „SG-03 wyjazd 05.10” */
  last?: { code: string; kind: 'ENTER' | 'EXIT' | 'DWELL'; at: string } | null;
}

export interface ZoneChange {
  at: string;
  who: string;
  /** kształt przed zmianą (null — strefa utworzona) */
  before: { lat: number; lng: number; radiusM: number } | null;
  after: { lat: number; lng: number; radiusM: number };
  /** powiadomienia ustawione przy strefie (dziś; po E34 — tylko w „Kto co dostaje”) */
  notify?: string[] | null;
  /** powód zmiany (od E34 wymagany; dawne wpisy — brak) */
  reason: string | null;
  /** wyłączenie / włączenie strefy */
  active?: boolean | null;
}

const has = (s: string, ...w: string[]) => w.some((x) => s.toLocaleLowerCase('pl-PL').includes(x));

/** Trasa promowa: z danych, a bez niej z nazwy (Gdynia, Karlskrona, Stena → Stena; reszta portów — Polferries). */
export function routeOf(z: Pick<ZoneRow, 'name' | 'type' | 'route'>): ZoneRoute | null {
  if (z.route) return z.route;
  if (z.type !== 'PORT_OUT' && z.type !== 'PRE_PORT' && z.type !== 'PORT_IN') return null;
  return has(z.name, 'gdyni', 'karlskron', 'stena') ? 'STENA' : 'POLFERRIES';
}

/** Grupa listy według trasy (E34 „Mapa i lista według trasy”). */
export function groupOf(z: Pick<ZoneRow, 'name' | 'type' | 'route' | 'country' | 'lat'>): ZoneGroup {
  const se = z.country ? z.country === 'SE' : z.lat > 56;
  switch (z.type) {
    case 'LOADING': return 'srem';
    case 'SITE': return 'boden';
    case 'PRE_ARRIVAL': return se ? 'boden' : 'srem';
    case 'PORT_IN': return 'se_ports';
    case 'PORT_OUT':
    case 'PRE_PORT': return routeOf(z) === 'STENA' ? 'gdynia' : 'gdansk';
    default: return 'other';
  }
}

/** Kolejność w grupie: bufor przed miejscem, potem samo miejsce (img/e34-after). */
const KIND_ORDER: Partial<Record<GeofenceType, number>> = { PRE_ARRIVAL: 0, PRE_PORT: 0, LOADING: 1, PORT_OUT: 1, PORT_IN: 1, SITE: 1 };

export function groupZones<T extends ZoneRow>(zones: readonly T[]): { group: ZoneGroup; zones: T[] }[] {
  return ZONE_GROUPS.map((g) => ({
    group: g,
    zones: zones.filter((z) => groupOf(z) === g).sort((a, b) =>
      (KIND_ORDER[a.type] ?? 9) - (KIND_ORDER[b.type] ?? 9)
      || (g === 'se_ports' ? (routeOf(a) === 'STENA' ? 1 : 0) - (routeOf(b) === 'STENA' ? 1 : 0) : 0)
      || a.name.localeCompare(b.name, 'pl')),
  })).filter((x) => x.zones.length > 0);
}

/** „800 m”, „1 000 m”, „50 km” (liczby po polsku, E34 „Porządek”); spacje nierozdzielające — liczba nie łamie się w wierszu. */
export function radiusText(m: number): string {
  if (m >= 10_000) return `${Math.round(m / 1000)}\u00a0km`;
  return `${String(Math.round(m)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0m`;
}

/** Odległość w metrach (wzór haversine). */
export function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Odległość od granicy koła: ujemna — w strefie, dodatnia — poza nią. */
export function edgeM(p: { lat: number; lng: number }, c: { lat: number; lng: number; radiusM: number }): number {
  return distM(p, c) - c.radiusM;
}

export type ImpactRow<T> = { item: T; beforeM: number; afterM: number; change: 'none' | 'enter' | 'exit' };

/**
 * Podgląd wpływu zmiany (E34 „Historia zmian”, pytanie 1 B): najnowsza pozycja każdego transportu względem koła przed
 * i po zmianie. Jak silnik stref (0002): wjazd — pozycja w kole; wyjazd — dopiero dalej niż margines granicy
 * (`hysteresisM`) od koła. Przejście = zapis wjazdu albo wyjazdu z dopiskiem „zmiana strefy”, bez SMS.
 */
export function impactOf<T extends { code: string; lat: number; lng: number; at?: string }>(
  positions: readonly T[],
  before: { lat: number; lng: number; radiusM: number },
  after: { lat: number; lng: number; radiusM: number },
  hysteresisM = 0,
  nearM = 5_000,
): ImpactRow<T>[] {
  const latest = new Map<string, T>();
  for (const p of positions) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || (p.lat === 0 && p.lng === 0)) continue;
    const cur = latest.get(p.code);
    if (!cur || (p.at ?? '') > (cur.at ?? '')) latest.set(p.code, p);
  }
  return [...latest.values()]
    .map((p) => {
      const b = edgeM(p, before);
      const a = edgeM(p, after);
      const wasIn = b <= 0;
      const change: ImpactRow<T>['change'] = !wasIn && a <= 0 ? 'enter' : wasIn && a > hysteresisM ? 'exit' : 'none';
      return { item: p, beforeM: Math.round(b), afterM: Math.round(a), change };
    })
    .filter((x) => x.change !== 'none' || Math.min(Math.abs(x.beforeM), Math.abs(x.afterM)) <= nearM)
    .sort((x, y) => Math.abs(x.afterM) - Math.abs(y.afterM));
}

/**
 * Środek strefy z pola: „65,80539 21,75914”, „65.80539, 21.75914”, „65.80539,21.75914”, „65,81273 N · 21,78898 E”.
 * Szerokość 50–70, długość 10–30 (trasa Śrem – Boden); null — nie da się odczytać.
 */
export function parseCenter(raw: string): { lat: number; lng: number } | null {
  let t = raw.replace(/[NEne°·]/g, ' ').trim();
  let parts: string[];
  if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(t)) parts = t.split(/\s*,\s*/);
  else {
    t = t.replace(/;/g, ' ');
    parts = t.split(/\s+|,\s+/).filter(Boolean);
  }
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map((x) => Number(x.replace(',', '.')));
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return lat >= 50 && lat <= 70 && lng >= 10 && lng <= 30 ? { lat, lng } : null;
}

/** Liczba z pola: „1 000”, „1 000 m”, „10 min”, „2,5” → liczba; puste albo niepoprawne — null. */
export function parseNum(raw: string): number | null {
  const t = raw.replace(/\s+/g, '').replace(/(m|min|km)$/i, '').replace(',', '.');
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** Liczba transportów, których ostatnia pozycja jest w strefie teraz. */
export function insideNow(loads: readonly Pick<Load, 'lat' | 'lng'>[], z: Pick<Geofence, 'lat' | 'lng' | 'radiusM'>): number {
  return loads.filter((l) => (l.lat !== 0 || l.lng !== 0) && edgeM(l, z) <= 0).length;
}

/** Przesunięcie środka i zmiana promienia jednym zdaniem: „środek przesunięty o 726 m · promień 1 500 → 1 000 m”. */
export function changeParts(c: ZoneChange): { moved: number | null; radius: [number, number] | null } {
  if (!c.before) return { moved: null, radius: null };
  const moved = Math.round(distM(c.before, c.after));
  const radius: [number, number] | null = c.before.radiusM !== c.after.radiusM ? [c.before.radiusM, c.after.radiusM] : null;
  return { moved: moved >= 5 ? moved : null, radius };
}
