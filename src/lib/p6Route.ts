/**
 * wyglad/P6 — „Sytuacja na trasie” (E7 pkt 4, img/e7-desk prawa kolumna, img/e7-phone „Na trasie”).
 * Moduł czysty: promy — wiersz na rejs do Szwecji z najnowszym pomiarem morza i liczbą transportów na pokładzie;
 * druga przeprawa (PLAN 8.4, E7-5) — przy odwołaniu albo sztormie na jednej przeprawie, tylko gdy na drugiej
 * nie ma ani odwołań, ani sztormu, do trzech najbliższych odejść z rozkładu; drogi — najpierw bardzo duży i duży wpływ.
 * Dane: produkcja — `sailings`, `marine_conditions`, `corridor_conditions` (to, co strona czyta już dziś); demo — `p6Demo.ts`.
 */
import type { Load, Sailing, SailingStatus } from '../types';
import type { MarineConditionRow } from './marineWeatherDb';
import {
  FERRY_OPERATORS, FERRY_ROUTES, LEGACY_OPERATORS, isOperatorOutboundRoute, portByCode, primaryRouteOf, routeEnds,
  type FerryCountry, type FerryOperator, type FerryPortCode,
} from './ferryCatalog';
import { crossingLine, effDeparture, nearestCrossingByOperator, nearestCrossingSailings } from './sailings';
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
  const e = routeEnds(r.route);
  return e ? { from: e.from, to: e.to } : LINE_PORTS[r.line];
}

/** Trasa wyjazdowa tego armatora (z katalogu). */
function isLineOutbound(line: CrossingLine, route: Sailing['route']): boolean {
  /* BN9-b: także Terminal A (TLLA-HEL: Viking Line, Eckerö) i kody tras z bazy */
  return isOperatorOutboundRoute(line, route);
}

export function ferryAlert(r: Pick<FerryRowView, 'status' | 'sea' | 'delayedIso'>): FerryAlert {
  if (r.status === 'ODWOLANY') return 'CANCELLED';
  if (r.sea?.risk === 'wysokie') return 'STORM';
  if (r.status === 'OPOZNIONY' || r.delayedIso) return 'DELAYED';
  if (r.sea?.risk === 'podwyższone') return 'ELEVATED';
  return 'OK';
}

export type AltProposal =
  | { kind: 'ALT'; from: CrossingLine; to: CrossingLine; reason: 'CANCELLED' | 'STORM'; vessel: string; sailings: Sailing[]; dest?: FerryCountry }
  | { kind: 'BOTH'; dest?: FerryCountry }
  | { kind: 'NODATA'; from: CrossingLine; to: CrossingLine; reason: 'CANCELLED' | 'STORM'; vessel: string; dest?: FerryCountry };

/** Kraj portu docelowego trasy wiersza (SE / FI) — z katalogu, Terminal A i kody z bazy jak trasa rodziny. */
function destCountryOf(r: Pick<FerryRowView, 'line' | 'route'>): FerryCountry | null {
  const to = rowPorts(r).to;
  return portByCode(to)?.country ?? null;
}

/**
 * PLAN 8.4 (E7-5, D-45, L-9): odwołanie albo sztorm na jednej przeprawie → najbliższe odejścia drugiej,
 * tylko gdy druga jest bez odwołań i sztormu. Oba zagrożone → bez propozycji. Brak rozkładu drugiej → „Brak danych”.
 * Polferries ⇄ Stena — bez zmian. BN9-b: przeprawy z Estonii — inny armator w ten sam kraj (Finlandia: Tallink,
 * Viking Line, Eckerö; Szwecja: Tallink ⇄ DFDS), pierwszy bez odwołań i sztormu, z najbliższym odejściem.
 */
export function altProposal(rows: readonly FerryRowView[], sailings: readonly Sailing[], nowMs: number): AltProposal | null {
  const isBad = (r: FerryRowView) => ferryAlert(r) === 'CANCELLED' || ferryAlert(r) === 'STORM';
  const bad = (line: CrossingLine) => rows.find((r) => r.line === line && isBad(r)) ?? null;
  const pol = bad('POLFERRIES');
  const sten = bad('STENA');
  if (pol && sten) return { kind: 'BOTH' };
  const hit = pol ?? sten;
  if (hit) {
    const from = hit.line;
    const to: CrossingLine = from === 'POLFERRIES' ? 'STENA' : 'POLFERRIES';
    const reason = ferryAlert(hit) === 'CANCELLED' ? 'CANCELLED' : 'STORM';
    const near = nearestCrossingSailings(sailings, nowMs);
    const list = to === 'STENA' ? near.stena : near.polferries;
    if (!list.length) return { kind: 'NODATA', from, to, reason, vessel: hit.vessel };
    return { kind: 'ALT', from, to, reason, vessel: hit.vessel, sailings: list };
  }
  /* BN9-b: przeprawy z Estonii */
  const bHit = rows.find((r) => !LEGACY_OPERATORS.includes(r.line) && isBad(r));
  if (!bHit) return null;
  const dest = destCountryOf(bHit);
  if (!dest) return null;
  const reason = ferryAlert(bHit) === 'CANCELLED' ? 'CANCELLED' : 'STORM';
  const near = nearestCrossingByOperator(sailings, nowMs);
  const toDest = (s: Sailing) => portByCode(routeEnds(s.route)?.to ?? null)?.country === dest;
  const cands = FERRY_OPERATORS.map((o) => o.code).filter((op) => op !== bHit.line && !LEGACY_OPERATORS.includes(op)
    && FERRY_ROUTES.some((r) => r.outbound && r.operators.includes(op) && portByCode(r.to)?.country === dest));
  if (!cands.length) return null;
  const okCands = cands.filter((op) => !rows.some((r) => r.line === op && isBad(r) && destCountryOf(r) === dest));
  if (!okCands.length) return { kind: 'BOTH', dest };
  for (const op of okCands) {
    const list = (near[op] ?? []).filter(toDest);
    if (list.length) return { kind: 'ALT', from: bHit.line, to: op, reason, vessel: bHit.vessel, sailings: list, dest };
  }
  return { kind: 'NODATA', from: bHit.line, to: okCands[0], reason, vessel: bHit.vessel, dest };
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
