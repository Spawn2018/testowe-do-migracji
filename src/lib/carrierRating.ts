/**
 * wyglad/J4 — „Ocena przewoźników” w Kokpicie (E9; tabela E11/E12 „ocena przewoźnika to raport, nie ustawienie →
 * Kokpit”; D-20261014-1420-01 R7 pkt 2). Obliczenia widoku i dane demo; produkcja czyta `carrier_scorecard`
 * i `carrier_ratings` (III-9, D-23) w `src/auth/CarrierRatingLive.tsx`.
 * „Na czas” = rozładunek do końca okna dostawy, a bez okna do końca dnia dostawy (III-9).
 */
import type { Load, Organization } from '../types';
import { unloadedAtOf } from './money/loadMoney';
import { TZ_OPS, zoneOffsetIso } from './time';

export interface CarrierRatingRow {
  carrierId: string;
  name: string;
  delivered: number;
  onTime: number;
  lateCarrier: number;
  avgLateMin: number | null;
  avgScore: number | null;
  ratings: number;
}

export interface MyRating {
  loadId: string;
  score: number;
  ratedAt: string;
}

/** Okres: całość projektu (domyślnie), ostatnie 4 tygodnie albo własny okres rozładunku (jak dotąd „Rozładunek od / do”). */
export type RatingRange = '4w' | 'all' | 'custom';

/** Własny okres — dni RRRR-MM-DD z pól daty (puste = bez granicy). */
export interface CustomRange { from: string; to: string }

const DAY = 24 * 60 * 60 * 1000;

/** Dzień w czasie polskim (RRRR-MM-DD). */
function warsawDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_OPS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Zakres dni rozładunku dla funkcji `carrier_scorecard` (p_from, p_to — RRRR-MM-DD albo null). */
export function rangeDays(range: RatingRange, nowIso: string, custom?: CustomRange | null): { from: string | null; to: string | null } {
  const now = Date.parse(nowIso);
  if (range === 'custom') return { from: custom?.from || null, to: custom?.to || null };
  if (range === 'all') return { from: null, to: warsawDay(now) };
  return { from: warsawDay(now - 27 * DAY), to: warsawDay(now) };
}

/** Dzień rozładunku transportu (czas polski) albo null — ten sam, po którym liczy `carrier_scorecard`. */
export function unloadDayOf(l: Load): string | null {
  const iso = unloadedAtOf(l);
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? warsawDay(t) : null;
}

/** Czy transport należy do okresu (po dniu rozładunku). */
export function inRatingRange(l: Load | undefined, range: RatingRange, nowIso: string, custom?: CustomRange | null): boolean {
  const r = rangeDays(range, nowIso, custom);
  if (!r.from && !r.to) return true;
  const d = l ? unloadDayOf(l) : null;
  return d != null && inRange(d, r);
}

/** Koniec okna dostawy: okno z awizacji, a bez okna — koniec dnia dostawy w czasie polskim. */
export function deliveryDeadlineMs(l: Load): number | null {
  const w = l.awizacja?.unloadWindowEnd;
  if (w) {
    const t = Date.parse(w);
    if (Number.isFinite(t)) return t;
  }
  const day = String(l.plannedDeliverDate ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const off = zoneOffsetIso(new Date(`${day}T12:00:00Z`), TZ_OPS);
  const t = Date.parse(`${day}T23:59:59${off}`);
  return Number.isFinite(t) ? t : null;
}

function inRange(dayIso: string, r: { from: string | null; to: string | null }): boolean {
  return (!r.from || dayIso >= r.from) && (!r.to || dayIso <= r.to);
}

function demoHash(loadId: string): number {
  let h = 0;
  for (const ch of loadId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Ocena demo 3–5 (stała dla transportu) — dane wymyślone (G-09). */
function demoScore(loadId: string): number {
  return [5, 4, 5, 3, 4][demoHash(loadId) % 5];
}

/** Demo: spóźnienie z winy przewoźnika (co drugie spóźnione), reszta — inna przyczyna (np. prom, pogoda) (G-09). */
function demoCarrierFault(loadId: string): boolean {
  return demoHash(loadId) % 2 === 0;
}

/** Spóźnienie demo dla transportu bez prawdziwej godziny rozładunku: co czwarty 75 min, co siódmy 26 h (G-09). */
function demoLateMs(loadId: string): number {
  const h = demoHash(loadId);
  if (h % 7 === 0) return 26 * 60 * 60 * 1000;
  if (h % 4 === 0) return 75 * 60 * 1000;
  return 0;
}

const isDone = (l: Load) => l.status === 'DELIVERED' || l.status === 'UNLOADING' || l.status === 'READY_TO_INVOICE' || l.status === 'INVOICED';

interface DoneLoad { load: Load; at: number; lateMin: number }


/** Rozładowane w okresie — tylko do „teraz” (bez dat z przyszłości). */
function doneLoads(loads: Load[], range: RatingRange, nowIso: string, custom?: CustomRange | null): DoneLoad[] {
  const r = rangeDays(range, nowIso, custom);
  const now = Date.parse(nowIso);
  const out: DoneLoad[] = [];
  for (const l of loads) {
    if (!isDone(l)) continue;
    const atIso = unloadedAtOf(l);
    const at = atIso ? Date.parse(atIso) + (l.unloadedAt ? 0 : demoLateMs(l.id)) : NaN;
    if (!Number.isFinite(at) || at > now || !inRange(warsawDay(at), r)) continue;
    const dl = deliveryDeadlineMs(l);
    out.push({ load: l, at, lateMin: dl == null ? 0 : Math.max(0, Math.round((at - dl) / 60000)) });
  }
  return out;
}

/** Wiersze demo: jeden na przewoźnika z transportami rozładowanymi w okresie. */
export function demoCarrierRating(loads: Load[], orgs: Organization[], range: RatingRange, nowIso: string, onlyCarrierId?: string | null, custom?: CustomRange | null): CarrierRatingRow[] {
  const by = new Map<string, DoneLoad[]>();
  for (const d of doneLoads(loads, range, nowIso, custom)) {
    const id = d.load.carrierId;
    if (onlyCarrierId && id !== onlyCarrierId) continue;
    by.set(id, [...(by.get(id) ?? []), d]);
  }
  const rows: CarrierRatingRow[] = [];
  for (const [carrierId, list] of by) {
    const late = list.filter((d) => d.lateMin > 0);
    const byCarrier = late.filter((d) => demoCarrierFault(d.load.id));
    const scores = list.map((d) => demoScore(d.load.id));
    rows.push({
      carrierId,
      name: orgs.find((o) => o.id === carrierId)?.name ?? carrierId,
      delivered: list.length,
      onTime: list.length - late.length,
      lateCarrier: byCarrier.length,
      avgLateMin: late.length ? Math.round(late.reduce((a, d) => a + d.lateMin, 0) / late.length) : null,
      avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
      ratings: scores.length,
    });
  }
  return rows.sort((a, b) => b.delivered - a.delivered || a.name.localeCompare(b.name, 'pl'));
}

/** Oceny transportów przewoźnika (demo), najnowsze pierwsze. */
export function demoMyRatings(loads: Load[], carrierId: string, range: RatingRange, nowIso: string, custom?: CustomRange | null): MyRating[] {
  const now = Date.parse(nowIso);
  return doneLoads(loads, range, nowIso, custom)
    .filter((d) => d.load.carrierId === carrierId)
    .sort((a, b) => b.at - a.at)
    .map((d) => ({ loadId: d.load.id, score: demoScore(d.load.id), ratedAt: new Date(Math.min(d.at + 2 * 60 * 60 * 1000, now)).toISOString() }));
}

/** „83 %” albo „—”. */
export function pctText(a: number, b: number): string {
  return b > 0 ? `${Math.round((100 * a) / b)} %` : '—';
}

/** „45 min”, „2 h 10 min”, „1 d 3 h” albo „—”. */
export function lateText(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(min / (24 * 60));
  const h = Math.floor((min % (24 * 60)) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}
