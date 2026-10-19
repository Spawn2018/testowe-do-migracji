/**
 * wyglad/E49 — dane demo: zamknięty Högakustenbron (E4) przy transporcie w drodze przez Szwecję i linie wiatru w ETA.
 * Liczby to przykład do wyglądu (G-09); w produkcji liczy serwer (D-20261016-0230-01 Z1, Z3, Z4).
 * Decyzja SCX zapisuje się w pamięci strony.
 */
import type { Load } from '../types';
import type { DetourCase, DetourDecision, DetourLine, LatLngPair } from './e49Detour';
import type { EtaWx } from './e49Wx';
import { timeOnly } from './statusAxis';

const H = 3_600_000;
const iso = (ms: number) => new Date(Math.round(ms / 60_000) * 60_000).toISOString();

type St = { decided: Record<string, DetourDecision>; subs: Set<() => void> };
const g = globalThis as unknown as { __e49Demo?: St };
const st = (): St => (g.__e49Demo ??= { decided: {}, subs: new Set() });

/**
 * Objazd demo (G-09, przykład do wyglądu, punkty przybliżone): od zjazdu z E4 przy Utansjö zachodnim brzegiem
 * Ångermanälven do Kramfors, przez Sandöbron i wschodnim brzegiem z powrotem na E4 za mostem (Hornön).
 * W produkcji geometria z HERE Routing.
 */
export const DEMO_DETOUR_LINE: readonly LatLngPair[] = [
  [62.76, 17.925], [62.778, 17.915], [62.795, 17.893], [62.81, 17.872], [62.83, 17.85], [62.858, 17.83],
  [62.885, 17.805], [62.91, 17.785], [62.931, 17.777], [62.915, 17.82], [62.898, 17.855], [62.884, 17.885],
  [62.872, 17.92], [62.856, 17.945], [62.84, 17.962], [62.828, 17.978],
];

const permitTrasa = (l: Load) => /^KR/i.test(l.code);

/**
 * Transporty demo z przykładami E49 — po kodzie (audyt-C C-12: `itemType` to już tylko symbol rodzaju, bez opisów
 * „closure” / „weather hold”): zamknięty most przy T-17, postój przez wiatr przy SG-31.
 */
export const demoClosureLoad = (l: Pick<Load, 'code'>): boolean => l.code === 'T-17';
const demoWindHoldLoad = (l: Pick<Load, 'code'>): boolean => l.code === 'SG-31';
const dims = (l: Load) => {
  const f = (n: number) => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `${f(l.dims.lengthM)} × ${f(l.dims.widthM)} × ${f(l.dims.heightM)} m`;
};

/** Jedna sprawa: most zamknięty przez wiatr, koniec za 5 h; objazd przez Kramfors i Sandöbron (droga 90). */
export function demoDetourCase(load: Load, nowIso: string): DetourCase {
  const now = Date.parse(nowIso);
  const base = load.etaBoden ? Date.parse(load.etaBoden) : now + 14 * H;
  const until = now + 5 * H;
  const holdEnd = until + 0.5 * H;
  const decideBy = now + 1.6 * H;
  /* postój: auto stoi od dojazdu do zjazdu do końca zamknięcia + 30 min */
  const holdAdd = Math.round((holdEnd - decideBy) / 60_000);
  const detourAdd = 35;
  return {
    id: `detour:${load.id}`,
    loadId: load.id,
    place: 'Högakustenbron (E4)',
    reason: 'WIND',
    reasonDetail: 'porywy 31 m/s',
    source: 'TRAFIKVERKET',
    noticeIso: iso(now - 0.4 * H),
    untilIso: iso(until),
    decideByIso: iso(decideBy),
    hold: {
      untilIso: iso(holdEnd),
      etaIso: iso(base + holdAdd * 60_000),
      addMin: holdAdd,
      risks: [
        { kind: 'HOURS', level: 'warn', text: 'czas pracy kierowcy: postój zastępuje przerwę; odpoczynek dobowy wypada o 1 h 10 min później, w Umeå zamiast w Skellefteå' },
        { kind: 'WINDOW', level: 'ok', text: 'okno dostawy KSH: ETA mieści się w dniu dostawy z planu' },
        { kind: 'WIND', level: 'warn', text: `koniec zamknięcia zależy od wiatru: prognoza SMHI dla mostu spada poniżej 20 m/s ok. ${timeOnly(iso(until - 0.5 * H))} — Trafikverket może przedłużyć zamknięcie` },
      ],
    },
    detour: {
      addKm: 31,
      addMin: detourAdd,
      etaIso: iso(base + detourAdd * 60_000),
      via: 'przez Kramfors i Sandöbron (droga 90)',
      line: DEMO_DETOUR_LINE,
      risks: [
        permitTrasa(load)
          ? { kind: 'PERMIT', level: 'warn', text: 'zezwolenie „Trasa”: objazd poza trasą w zezwoleniu SE — potrzebna zgoda Trafikverket przed wjazdem na objazd' }
          : { kind: 'PERMIT', level: 'ok', text: 'zezwolenie: transport bez zezwolenia na konkretną trasę — objazd dozwolony' },
        { kind: 'WIND', level: 'warn', text: `wiatr na objeździe: Sandöbron, porywy 23 m/s z boku (prognoza SMHI ${timeOnly(iso(decideBy + 0.5 * H))}) — +15% na moście; przy 25 m/s Trafikverket może zamknąć i ten most` },
        { kind: 'WORKS', level: 'warn', text: 'roboty: droga 90 w Kramfors — ruch wahadłowy, do ok. 10 min' },
        { kind: 'LIMITS', level: 'ok', text: `ograniczenia dla zestawu ${dims(load)}, ${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(load.dims.weightT)} t ładunku: brak na objeździe (HERE)` },
        { kind: 'HOURS', level: 'ok', text: 'czas pracy kierowcy: +35 min jazdy mieści się w dziennym limicie' },
        { kind: 'BAN', level: 'ok', text: 'zakazy czasowe na objeździe w godzinach przejazdu: brak' },
      ],
    },
    decision: st().decided[`detour:${load.id}`] ?? null,
  };
}

export async function demoDetourDecide(id: string, d: DetourDecision): Promise<{ ok: boolean }> {
  st().decided[id] = d;
  for (const f of st().subs) f();
  return { ok: true };
}

/** Linie objazdu demo: transporty z decyzją „Jedziemy objazdem” zapisaną w pamięci strony. */
export function demoDetourLines(loads: readonly Load[], nowIso: string): DetourLine[] {
  const out: DetourLine[] = [];
  for (const l of loads) {
    if (st().decided[`detour:${l.id}`]?.pick !== 'DETOUR') continue;
    const c = demoDetourCase(l, nowIso);
    if ('none' in c.detour || !c.detour.line) continue;
    out.push({ loadId: l.id, line: c.detour.line, via: c.detour.via, addKm: c.detour.addKm, addMin: c.detour.addMin });
  }
  return out;
}

/** Zmiana decyzji demo → mapa rysuje linie od nowa. */
export function subscribeDemoDetours(f: () => void): () => void {
  st().subs.add(f);
  return () => { st().subs.delete(f); };
}

/** Linie w szczegółach ETA (przykład): wiatr z boku na wybrzeżu, śliskość i — przy sprawie — postój albo objazd. */
export function demoEtaWx(load: Load, nowIso: string, detourLoadId: string | null): EtaWx[] {
  const now = Date.parse(nowIso);
  if (load.status !== 'IN_TRANSIT_SE' && load.status !== 'AT_PORT_SE') return [];
  const out: EtaWx[] = [
    { kind: 'WIND', addMin: 14, where: 'E4 Skellefteå–Piteå', gustMs: 22, side: 'CROSS', atIso: iso(now + 6 * H), source: 'SMHI' },
    { kind: 'SLIPPERY', addMin: 9, where: 'E4 Hudiksvall (do 25 km)', source: 'TRAFIKVERKET' },
  ];
  if (load.id === detourLoadId) {
    const d = st().decided[`detour:${load.id}`];
    if (d?.pick === 'DETOUR') out.unshift({ kind: 'DETOUR', addMin: 35, where: 'przez Kramfors i Sandöbron', source: 'SCX' });
    else out.unshift({ kind: 'CLOSURE_HOLD', addMin: Math.round(3.9 * 60), where: 'Högakustenbron (E4)', untilIso: iso(now + 5.5 * H), source: 'TRAFIKVERKET' });
  } else if (demoWindHoldLoad(load)) {
    out.unshift({ kind: 'WIND_HOLD', addMin: 6 * 60 + 30, where: 'E4 Umeå–Skellefteå', gustMs: 27, fromIso: iso(now + 2 * H), untilIso: iso(now + 8.5 * H), source: 'SMHI' });
  }
  return out;
}
