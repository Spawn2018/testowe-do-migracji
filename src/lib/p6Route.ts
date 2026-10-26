/**
 * wyglad/P6 — „Sytuacja na trasie” (E7 pkt 4, img/e7-desk prawa kolumna, img/e7-phone „Na trasie”).
 * Moduł czysty: promy — wiersz na rejs do Szwecji z najnowszym pomiarem morza i liczbą transportów na pokładzie;
 * druga przeprawa (PLAN 8.4, E7-5) — przy odwołaniu albo sztormie na jednej przeprawie, tylko gdy na drugiej
 * nie ma ani odwołań, ani sztormu, do trzech najbliższych odejść z rozkładu; drogi — najpierw bardzo duży i duży wpływ.
 * Dane: produkcja — `sailings`, `marine_conditions`, `corridor_conditions` (to, co strona czyta już dziś); demo — `p6Demo.ts`.
 */
import type { Load, Sailing, SailingStatus } from '../types';
import type { MarineConditionRow } from './marineWeatherDb';
import { FERRY_OPERATORS, outboundRoutesOf, primaryRouteOf, routeByCode, type FerryOperator, type FerryPortCode } from './ferryCatalog';
import { crossingLine, effDeparture, nearestCrossingSailings } from './sailings';
import { stageTileOf } from './stageTiles';

/** Armator przeprawy — z katalogu promów (BN9-a). */
export type CrossingLine = FerryOperator;
export type FerryAlert = 'CANCELLED' | 'STORM' | 'ELEVATED' | 'DELAYED' | 'OK';

export interface FerrySea {
  risk: 'niskie' | 'podwyższone' | 'wysokie';
  waveM: number | null;
  gustKn: number | null;
  thrWaveM: number | null;
  thrGustKn: number | null;
  at: string | null;
}

export interface FerryRowView {
  id: string;
  line: CrossingLine;
  vessel: string;
  depIso: string;
  /** odejście po opóźnieniu, gdy inne niż w rozkładzie */
  delayedIso: string | null;
  status: SailingStatus | null;
  sea: FerrySea | null;
  onBoard: number;
  /** BN9-a: trasa rejsu (porty wiersza); bez niej — pierwsza trasa wyjazdowa armatora (`LINE_PORTS`) */
  route?: Sailing['route'];
}

/** Porty pierwszej trasy wyjazdowej armatora (Polferries: GDN → NYN, Stena: GDY → KAA) — z katalogu promów. */
export const LINE_PORTS: Record<CrossingLine, { from: FerryPortCode; to: FerryPortCode }> = Object.fromEntries(
  FERRY_OPERATORS.map((o) => {
    const r = primaryRouteOf(o.code);
    return [o.code, { from: r.from, to: r.to }];
  }),
) as Record<CrossingLine, { from: FerryPortCode; to: FerryPortCode }>;
/** Pomiar morza tylko dla przepraw, które go mają (nowe trasy — bez pomiaru, „brak danych morskich”). */
const LINE_CORRIDOR: Partial<Record<CrossingLine, MarineConditionRow['corridor']>> = { POLFERRIES: 'BALTIC_GDN_NYN', STENA: 'BALTIC_GDY_KAA' };

const warsawDay = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

export function seaFromMarine(m: MarineConditionRow | null | undefined): FerrySea | null {
  if (!m) return null;
  return { risk: m.risk, waveM: m.maxWaveM, gustKn: m.maxGustKn, thrWaveM: m.waveThrM, thrGustKn: m.gustThrKn, at: m.observedAt };
}

/**
 * Promy do Szwecji: odejścia dziś (czas polski, od 3 h wstecz); na przeprawie bez rejsu dziś — najbliższy następny.
 * Dane startowe (demo) nie są rozkładem (`crossingLine` = null) — w demo wiersze daje `p6Demo.ts`.
 */
export function ferryRowsFromDb(
  sailings: readonly Sailing[],
  marine: readonly MarineConditionRow[],
  loads: readonly Pick<Load, 'sailingId' | 'status' | 'stage'>[],
  nowMs: number,
): FerryRowView[] {
  const today = warsawDay(nowMs);
  const out: FerryRowView[] = [];
  /* Polferries, Stena, potem nowi armatorzy z katalogu — każdy na swoich trasach wyjazdowych; bez rejsów nic nie dochodzi */
  for (const line of FERRY_OPERATORS.map((o) => o.code)) {
    const all = sailings
      .filter((s) => crossingLine(s) === line && isLineOutbound(line, s.route) && Date.parse(effDeparture(s)) >= nowMs - 3 * 3600_000)
      .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)));
    const todayRows = all.filter((s) => warsawDay(Date.parse(effDeparture(s))) === today);
    const pick = todayRows.length ? todayRows : all.slice(0, 1);
    const corridor = LINE_CORRIDOR[line];
    const sea = corridor ? seaFromMarine(marine.find((m) => m.corridor === corridor)) : null;
    for (const s of pick) {
      out.push({
        id: s.id, line, route: s.route, vessel: s.vessel, depIso: s.departureAt,
        delayedIso: s.delayedDepartureAt && s.delayedDepartureAt !== s.departureAt ? s.delayedDepartureAt : null,
        status: s.status, sea,
        /* U-100: „na pokładzie” = transporty tego rejsu w etapie Prom (nie same rezerwacje) — jak demo i Mapa */
        onBoard: loads.filter((l) => l.sailingId === s.id && stageTileOf(l) === 'FERRY').length,
      });
    }
  }
  return out.sort((a, b) => Date.parse(a.depIso) - Date.parse(b.depIso));
}

/** Porty wiersza promu: z trasy rejsu, a bez niej z `LINE_PORTS`. */
export function rowPorts(r: Pick<FerryRowView, 'line' | 'route'>): { from: FerryPortCode; to: FerryPortCode } {
  const route = routeByCode(r.route);
  return route ? { from: route.from, to: route.to } : LINE_PORTS[r.line];
}

/** Trasa wyjazdowa tego armatora (z katalogu). */
function isLineOutbound(line: CrossingLine, route: Sailing['route']): boolean {
  return outboundRoutesOf(line).includes(route);
}

export function ferryAlert(r: Pick<FerryRowView, 'status' | 'sea' | 'delayedIso'>): FerryAlert {
  if (r.status === 'ODWOLANY') return 'CANCELLED';
  if (r.sea?.risk === 'wysokie') return 'STORM';
  if (r.status === 'OPOZNIONY' || r.delayedIso) return 'DELAYED';
  if (r.sea?.risk === 'podwyższone') return 'ELEVATED';
  return 'OK';
}

export type AltProposal =
  | { kind: 'ALT'; from: CrossingLine; to: CrossingLine; reason: 'CANCELLED' | 'STORM'; vessel: string; sailings: Sailing[] }
  | { kind: 'BOTH' }
  | { kind: 'NODATA'; from: CrossingLine; to: CrossingLine; reason: 'CANCELLED' | 'STORM'; vessel: string };

/**
 * PLAN 8.4 (E7-5, D-45, L-9): odwołanie albo sztorm na jednej przeprawie → najbliższe odejścia drugiej,
 * tylko gdy druga jest bez odwołań i sztormu. Oba zagrożone → bez propozycji. Brak rozkładu drugiej → „Brak danych”.
 */
export function altProposal(rows: readonly FerryRowView[], sailings: readonly Sailing[], nowMs: number): AltProposal | null {
  const bad = (line: CrossingLine) => rows.find((r) => r.line === line && (ferryAlert(r) === 'CANCELLED' || ferryAlert(r) === 'STORM')) ?? null;
  const pol = bad('POLFERRIES');
  const sten = bad('STENA');
  if (pol && sten) return { kind: 'BOTH' };
  const hit = pol ?? sten;
  if (!hit) return null;
  const from = hit.line;
  const to: CrossingLine = from === 'POLFERRIES' ? 'STENA' : 'POLFERRIES';
  const reason = ferryAlert(hit) === 'CANCELLED' ? 'CANCELLED' : 'STORM';
  const near = nearestCrossingSailings(sailings, nowMs);
  const list = to === 'STENA' ? near.stena : near.polferries;
  if (!list.length) return { kind: 'NODATA', from, to, reason, vessel: hit.vessel };
  return { kind: 'ALT', from, to, reason, vessel: hit.vessel, sailings: list };
}

/* ---------- drogi ---------- */

export type RoadImpact = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface RoadRowView {
  id: string;
  road: string;
  title: string;
  impact: RoadImpact;
  /** „07.10, 15:28 – 16:45” albo „od 12.10” — gotowy tekst, gdy źródło go podaje */
  when: string | null;
  /** opis po polsku z tekstu Trafikverket (gdy jest) */
  note: string | null;
  /** oryginał po szwedzku, gdy tytuł przetłumaczony */
  original: string | null;
  /** B9: tłumaczenie opisu jeszcze nie dotarło — „Tłumaczenie w toku” */
  pending?: boolean;
}

const IMPACT_RANK: Record<RoadImpact, number> = { VERY_HIGH: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
export const impactOf = (severity: string): RoadImpact =>
  severity === 'CRITICAL' ? 'VERY_HIGH' : severity === 'HIGH' ? 'HIGH' : severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';

export function sortRoads(rows: readonly RoadRowView[]): RoadRowView[] {
  return [...rows].sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || a.road.localeCompare(b.road) || a.id.localeCompare(b.id));
}

/** „E4: 34 · E22: 6” — liczba sytuacji na drogę. */
export function roadCounts(rows: readonly RoadRowView[]): string {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.road, (by.get(r.road) ?? 0) + 1);
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pl', { numeric: true })).map(([k, n]) => `${k}: ${n}`).join(' · ');
}

/** Produkcja: sytuacje z `corridor_conditions` (tytuł już po polsku, oryginał zostaje do podglądu). */
export function roadRowsFromCorridor(sit: readonly { id: string; severity: string; title: string; road: string; original: string | null; note: string | null; pending?: boolean }[]): RoadRowView[] {
  return sortRoads(sit.map((s) => ({
    id: s.id, road: s.road || 'E4', title: s.title, impact: impactOf(s.severity), when: null, note: s.note, original: s.original,
    pending: s.pending === true,
  })));
}
