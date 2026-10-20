/**
 * wyglad/P4 — pasek etapów według E28 (decyzja 07.10 20:57) i przypisanie statusów według E25 (decyzja 17:46).
 *
 * 10 kafelków: Przygotowanie · Załadunek · Droga PL · Port PL · Prom · Port SE · Droga SE · Plac Boden · Dostarczone · Rozliczenie.
 * Każdy status trafia do dokładnie jednego kafelka (według statusu, nie etapu paska z `status.ts`, który przypisywał źle — E28 „Fakty”).
 * Anulowane są poza paskiem. Moduł czysty: bez zapisu i bez zapytań.
 *
 * Statusy aplikacji na `main` + kody z E25, które dokłada wykonawca w P4 (READY_TO_INVOICE, INVOICED) i port SE (AT_PORT_SE),
 * są przyjmowane jako tekst — pasek liczy je poprawnie od chwili, gdy dane je podadzą.
 */
import type { CorridorStage, Load } from '../types';
import { trackingNoLink } from './trackerLink';

export type StageTile =
  | 'PREP' | 'LOADING' | 'ROAD_PL' | 'PORT_PL' | 'FERRY' | 'PORT_SE' | 'ROAD_SE' | 'SITE' | 'DELIVERED' | 'SETTLE';

export const STAGE_TILES: readonly StageTile[] = [
  'PREP', 'LOADING', 'ROAD_PL', 'PORT_PL', 'FERRY', 'PORT_SE', 'ROAD_SE', 'SITE', 'DELIVERED', 'SETTLE',
];

/** Grupy nad kafelkami (E25): Przygotowanie (1) · W trasie, śledzenie (7) · Po dostawie (2). */
export const STAGE_GROUPS: readonly { key: 'prep' | 'route' | 'after'; tiles: readonly StageTile[] }[] = [
  { key: 'prep', tiles: ['PREP'] },
  { key: 'route', tiles: ['LOADING', 'ROAD_PL', 'PORT_PL', 'FERRY', 'PORT_SE', 'ROAD_SE', 'SITE'] },
  { key: 'after', tiles: ['DELIVERED', 'SETTLE'] },
];

/** Kolor paska nad kafelkiem (makieta E28: pre, sea, site, acc). */
export const TILE_TONE: Partial<Record<StageTile, 'pre' | 'sea' | 'site' | 'acc'>> = {
  PREP: 'pre', FERRY: 'sea', SITE: 'site', DELIVERED: 'site', SETTLE: 'acc',
};

const BY_STATUS: Record<string, StageTile | null> = {
  PLANNED: 'PREP', RESOURCES_PENDING: 'PREP', DOC_MISSING: 'PREP', DOCS_PENDING: 'PREP', READY: 'PREP',
  LOADING: 'LOADING', AT_LOADING: 'LOADING',
  IN_TRANSIT_PL: 'ROAD_PL',
  AT_PORT: 'PORT_PL', AT_PORT_GDANSK: 'PORT_PL', AT_PORT_PL: 'PORT_PL',
  ON_FERRY: 'FERRY', FERRY: 'FERRY',
  AT_PORT_SE: 'PORT_SE', AT_PORT_NYNASHAMN: 'PORT_SE',
  IN_TRANSIT_SE: 'ROAD_SE',
  APPROACHING_SITE: 'SITE', AT_SITE: 'SITE',
  UNLOADING: 'DELIVERED', UNLOADED: 'DELIVERED', DELIVERED: 'DELIVERED',
  READY_TO_INVOICE: 'SETTLE', INVOICED: 'SETTLE',
  CANCELLED: null,
};

/* DELAYED i SILENT to w E25 oznaczenia, nie statusy — w danych pokazowych bierzemy kafelek z etapu */
const BY_STAGE: Record<CorridorStage, StageTile> = {
  PLAN: 'PREP', LOADING: 'LOADING', TO_PORT: 'ROAD_PL', GDANSK: 'PORT_PL', FERRY: 'FERRY',
  APPROACH: 'PORT_SE', SE_ROAD: 'ROAD_SE', SITE: 'SITE', DELIVERED: 'DELIVERED',
};

/** Kafelek transportu; null = poza paskiem (Anulowany). */
export function stageTileOf(l: Pick<Load, 'status' | 'stage'>): StageTile | null {
  const s = String(l.status);
  if (s in BY_STATUS) return BY_STATUS[s];
  return BY_STAGE[l.stage] ?? 'PREP';
}

export function countByTile(loads: readonly Pick<Load, 'status' | 'stage'>[]): Record<StageTile, number> {
  const out = Object.fromEntries(STAGE_TILES.map((k) => [k, 0])) as Record<StageTile, number>;
  for (const l of loads) {
    const k = stageTileOf(l);
    if (k) out[k] += 1;
  }
  return out;
}

const ROUTE: ReadonlySet<StageTile> = new Set(STAGE_GROUPS[1].tiles);
export const isOnRoute = (l: Pick<Load, 'status' | 'stage'>) => {
  const k = stageTileOf(l);
  return k != null && ROUTE.has(k);
};

/* ---------- E27: okno śledzenia (od 03:00 w dniu załadunku z planu KSH do „Dostarczone”) ---------- */

const TZ = 'Europe/Warsaw';
function warsawDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
function warsawHour(iso: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
}

export type TrackingPhase = 'before' | 'on' | 'after';

/**
 * Faza śledzenia transportu w chwili `nowIso` (E27): przed oknem (przygotowanie, przed 03:00 dnia załadunku),
 * w oknie (w trasie albo dzień załadunku od 03:00), po oknie (Dostarczone i rozliczenie, Anulowany).
 * Pozycje i przypisanie liczy baza (wykonawca); tu tylko to, co pokazać na mapie i w panelu.
 */
export function trackingPhase(l: Pick<Load, 'status' | 'stage' | 'plannedLoadDate'>, nowIso: string): TrackingPhase {
  const k = stageTileOf(l);
  if (k == null || k === 'DELIVERED' || k === 'SETTLE') return 'after';
  if (k !== 'PREP') return 'on';
  const day = (l.plannedLoadDate ?? '').slice(0, 10);
  if (!day) return 'before';
  const today = warsawDay(nowIso);
  if (day < today) return 'on';
  if (day === today && warsawHour(nowIso) >= 3) return 'on';
  return 'before';
}

/**
 * E27 (Mapa): transporty jeszcze w przygotowaniu, którym okno śledzenia już się zaczęło (od 03:00 w dniu załadunku).
 * Na produkcji dostają znacznik, gdy baza ma ich pozycję GPS; do liczby „W trasie” się nie wliczają (E28: suma grupy „W trasie”).
 */
export function trackingWindowPrep<T extends Pick<Load, 'status' | 'stage' | 'plannedLoadDate'>>(
  loads: readonly T[],
  nowIso: string,
): T[] {
  return loads.filter((l) => stageTileOf(l) === 'PREP' && trackingPhase(l, nowIso) === 'on');
}

/** Najbliższe włączenia śledzenia (E27, Mapa): dni załadunku po dzisiejszym 03:00, z transportami i naczepą. */
export function nextTrackingStarts(
  loads: readonly Load[],
  nowIso: string,
  max = 3,
): { day: string; loads: Load[] }[] {
  const groups = new Map<string, Load[]>();
  for (const l of loads) {
    if (trackingPhase(l, nowIso) !== 'before') continue;
    /* bez linku śledzenie się nie włączy (decyzja 20.10 20:01) */
    if (trackingNoLink(l, l.trackingLink)) continue;
    const day = (l.plannedLoadDate ?? '').slice(0, 10);
    if (!day) continue;
    groups.set(day, [...(groups.get(day) ?? []), l]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, max)
    .map(([day, ls]) => ({ day, loads: ls.sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true })) }));
}

/* ---------- L7: oznaczenia obok statusu (Opóźniony, Brak GPS, Brak dokumentów) ---------- */

export type StatusMarker = 'late' | 'nogps' | 'nodocs';

/**
 * Oznaczenia obok statusu (E25, L7): „Brak dokumentów” to status 3 tylko w przygotowaniu — po starcie przewozu oznaczenie;
 * „Brak GPS” po 30 min ciszy w ruchu (E15); „Opóźniony” — gdy aplikacja nie ma liczby minut opóźnienia (inaczej pokazuje „+2h05”).
 */
export function statusMarkers(
  l: Pick<Load, 'status' | 'stage' | 'delayed' | 'docMissing' | 'silentMinutes'>,
  opts: { hasDelayMinutes: boolean },
): StatusMarker[] {
  const k = stageTileOf(l);
  if (k == null) return [];
  const out: StatusMarker[] = [];
  const onRoute = isOnRoute(l);
  if ((l.delayed || l.status === 'DELAYED') && !opts.hasDelayMinutes && k !== 'SETTLE') out.push('late');
  if (onRoute && (l.status === 'SILENT' || (l.silentMinutes != null && l.silentMinutes >= 30))) out.push('nogps');
  if (k !== 'PREP' && l.docMissing) out.push('nodocs');
  return out;
}
