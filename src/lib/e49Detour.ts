/**
 * wyglad/E49 — zamknięty most albo droga na dalszej trasie: sprawa SCX „Objazd czy postój?” (decyzja właściciela
 * 16.10.2026, 02:08, odpowiedź 3; dopisek D-20261016-0230-01 Z3) i linie wiatru / postoju / śliskości w szczegółach ETA
 * (Z1, Z4). Czyste funkcje widoku — bez zapytań i zapisów; dane liczy serwer (HERE Routing dla ciężarówki z wymiarami
 * zestawu, prognoza SMHI, komunikaty Trafikverket / HERE Traffic).
 */
import { formatPlNumber } from './format';
import { minText } from './e49Wx';

export { minText };

export type ClosureReason = 'WIND' | 'ACCIDENT' | 'WORKS' | 'OTHER';
export type ClosureSource = 'TRAFIKVERKET' | 'HERE';

/** Ryzyko jednej możliwości — zdanie z serwera; `warn` = trzeba wziąć pod uwagę, `ok` = sprawdzone, bez przeszkód. */
export type DetourRiskKind = 'PERMIT' | 'LIMITS' | 'BAN' | 'WORKS' | 'WIND' | 'HOURS' | 'FERRY' | 'WINDOW' | 'PILOT';
export interface DetourRisk { kind: DetourRiskKind; level: 'warn' | 'ok'; text: string }

export interface HoldOption {
  /** koniec postoju (koniec zamknięcia + 30 min); null = koniec nieznany */
  untilIso: string | null;
  etaIso: string;
  /** o ile minut później niż ETA bez zamknięcia */
  addMin: number;
  risks: DetourRisk[];
}

/** Punkt linii na mapie: [szerokość, długość] (WGS84), jak w `corridor_polylines`. */
export type LatLngPair = readonly [number, number];

export interface DetourOption {
  addKm: number;
  addMin: number;
  etaIso: string;
  /** którędy: „przez Kramfors i Sandöbron (droga 90)” */
  via: string;
  risks: DetourRisk[];
  /**
   * Geometria objazdu z HERE Routing v8 (ciężarówka z wymiarami i masą zestawu), od zjazdu z trasy do powrotu na trasę,
   * uproszczona do ok. 200 punktów. Brak / null — bez linii na mapie (E45, Z3 pkt 8).
   */
  line?: readonly LatLngPair[] | null;
}

/**
 * Linia objazdu na mapie (E45; D-20261016-0230-01 Z3 pkt 8): transport z decyzją SCX „Jedziemy objazdem”, dopóki
 * decyzja obowiązuje (zamknięcie nieodwołane, auto nie wróciło na trasę). Przerywana, w warstwie „Trasa”.
 */
export interface DetourLine {
  loadId: string;
  line: readonly LatLngPair[];
  via: string;
  addKm: number;
  addMin: number;
}

/** Podpis linii objazdu: „T-17 · objazd przez Kramfors i Sandöbron (droga 90): +31 km, +35 min · decyzja SCX”. */
export function detourLineTip(code: string, d: Pick<DetourLine, 'via' | 'addKm' | 'addMin'>, t: (k: 'e49_map_line', v: Record<string, string>) => string): string {
  return t('e49_map_line', { code, via: d.via, km: kmText(d.addKm), d: minText(d.addMin) });
}

/** Linia ma co najmniej 2 poprawne punkty (szer. −90…90, dł. −180…180). */
export function detourLineOk(line: readonly LatLngPair[] | null | undefined): line is readonly LatLngPair[] {
  if (!line || line.length < 2) return false;
  return line.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
}

/** HERE nie znalazł trasy dozwolonej dla zestawu (wymiary, masa). */
export interface NoDetour { none: true; why: string }

export interface DetourDecision { pick: 'HOLD' | 'DETOUR'; by: string; atIso: string; note: string | null }

export interface DetourCase {
  id: string;
  loadId: string;
  /** „Högakustenbron (E4)”, „DK 22 Malbork–Elbląg” */
  place: string;
  reason: ClosureReason;
  /** „porywy 31 m/s” — przy wietrze; null gdy komunikat nie podaje */
  reasonDetail: string | null;
  source: ClosureSource;
  /** godzina komunikatu */
  noticeIso: string;
  /** koniec zamknięcia z komunikatu; null = bez godziny końca */
  untilIso: string | null;
  /** do kiedy SCX ma zdecydować (auto dojedzie do zjazdu na objazd) */
  decideByIso: string;
  hold: HoldOption;
  detour: DetourOption | NoDetour;
  decision: DetourDecision | null;
}

export const hasDetour = (d: DetourOption | NoDetour): d is DetourOption => !('none' in d);

/** Która możliwość jest szybsza i o ile minut (null — tyle samo albo brak objazdu). */
export function fasterOf(c: Pick<DetourCase, 'hold' | 'detour'>): { pick: 'HOLD' | 'DETOUR'; byMin: number } | null {
  if (!hasDetour(c.detour)) return null;
  const diff = Math.round((Date.parse(c.hold.etaIso) - Date.parse(c.detour.etaIso)) / 60_000);
  if (Math.abs(diff) < 5) return null;
  return diff > 0 ? { pick: 'DETOUR', byMin: diff } : { pick: 'HOLD', byMin: -diff };
}


/** „+31 km”, „+1 234 km” — liczba jak w całej aplikacji (`formatPlNumber`, E21), spacja nierozdzielająca. */
export function kmText(km: number): string {
  return `+${formatPlNumber(Math.round(km))}\u00a0km`;
}

/** Ostrzeżenia pierwsze, potem sprawdzone bez przeszkód (kolejność z serwera w grupie zostaje). */
export function sortRisks(r: readonly DetourRisk[]): DetourRisk[] {
  return [...r.filter((x) => x.level === 'warn'), ...r.filter((x) => x.level === 'ok')];
}

/** Sprawa jest pilna, gdy do decyzji zostało ≤ 60 min albo termin minął. */
export function urgentOf(c: Pick<DetourCase, 'decideByIso'>, nowIso: string): boolean {
  return Date.parse(c.decideByIso) - Date.parse(nowIso) <= 60 * 60_000;
}


/**
 * audyt-C (C-02; E7 „jednakowe zgłoszenia łączą się”, E49 16.10 02:08): zamknięcie drogi przy transporcie, który ma
 * otwartą sprawę „Objazd czy postój?”, jest tą samą sprawą — ryzyko zamknięcia nie stoi w karcie drugi raz.
 * Zwraca ryzyka bez połączonych zamknięć i — dla każdej sprawy — identyfikatory połączonych ryzyk (link z dzwonka
 * i Kokpitu do ryzyka otwiera sprawę). Bez spraw (produkcja przed podłączeniem) — ryzyka bez zmian.
 */
export function mergeClosures<R extends { id: string; loadId?: string | null; causeCategory?: string }>(
  risks: readonly R[],
  cases: readonly Pick<DetourCase, 'id' | 'loadId'>[],
): { risks: R[]; mergedIds: Record<string, string[]> } {
  const byLoad = new Map(cases.map((c) => [c.loadId, c.id]));
  const mergedIds: Record<string, string[]> = {};
  const out: R[] = [];
  for (const r of risks) {
    const caseId = r.loadId && r.causeCategory === 'closure' ? byLoad.get(r.loadId) : undefined;
    if (caseId) (mergedIds[caseId] ??= []).push(r.id);
    else out.push(r);
  }
  return { risks: out, mergedIds };
}
