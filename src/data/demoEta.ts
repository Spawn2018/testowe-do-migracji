/**
 * wyglad/W-demo (audyt 17.10, D-20261017-0730-01 §4; sekcje 08 N11, 15 N2, 01 N18): ETA w danych demo.
 * Transporty w oknie śledzenia (dzień demo 23.09.2026, zegar 16:32) dostają ETA Boden, pasmo ± minut i szczegóły
 * jak z serwera (`etaDetail`, E15): w trasie, odpoczynek w toku, czeka przed placem, cisza GPS, prom.
 * Zasada: ETA = ostatnia pozycja + jazda + odpoczynek (+ postój, rejs) — te same liczby co w szczegółach bloku ETA.
 * Przed wyjazdem (Załadunek) i po rozładunku — bez ETA („–”, E15). Dane zmyślone (G-09).
 * Tylko demo — produkcja bierze ETA z `eta_basis` (wykonawca, P4-u).
 */
import type { EtaDetail, Load, Risk } from '../types';
import { plPlural } from '../lib/plPlural';
import { etaDuration } from '../lib/etaDuration';

/** Ostatnie przeliczenie i ostatnia pozycja w demo — tuż przed zegarem demo 23.09.2026, 16:32. */
export const DEMO_ETA_AT = '2026-09-23T16:30:00+02:00';
const NOW_MS = Date.parse('2026-09-23T16:32:00+02:00');
const FIX = '2026-09-23T16:27:00+02:00';
const FIX_MS = Date.parse(FIX);
const MIN = 60_000;
const H = 60 * MIN;

/** ISO w czasie lokalnym (+02:00), jak dane z serwera. */
function local(ms: number): string {
  return `${new Date(ms + 2 * H).toISOString().slice(0, 16)}:00+02:00`;
}

type DemoEta = {
  etaBoden: string;
  etaConfidence: 'HIGH' | 'MED' | 'LOW';
  etaConfMin: number;
  detail: EtaDetail;
};

/** Jazda z ostatniej pozycji: ETA = pozycja + jazda + odpoczynek (+ postój). */
function drive(
  fixMs: number, km: number, driveMin: number, restHours: number | null, conf: DemoEta['etaConfidence'], band: number, holdUntilMs?: number,
): DemoEta {
  const start = holdUntilMs ?? fixMs;
  return {
    etaBoden: local(start + driveMin * MIN + (restHours ?? 0) * H),
    etaConfidence: conf,
    etaConfMin: band,
    detail: {
      phase: 'DRIVE', lastFixAt: local(fixMs), distanceKm: km, driveMin,
      restNeeded: restHours != null, ...(restHours != null ? { restHours } : {}),
    },
  };
}

/** Rejs dziś 18:00 z Gdańska → Nynäshamn jutro 12:00, dalej 1 050 km (15 h jazdy) i 11 h odpoczynku → 25.09, 14:00. */
const FERRY_IN = Date.parse('2026-09-24T12:00:00+02:00');
const AFTER_FERRY = FERRY_IN + 15 * H + 11 * H;

export const DEMO_ETA: Readonly<Record<string, DemoEta>> = {
  /* Droga SE, przed zamkniętym Högakustenbron (E49): postój do 22:02, potem 8 h 40 min jazdy, 11 h odpoczynku,
     wiatr +14 min i śliskość +9 min (linie w bloku ETA) */
  'T-17': (() => {
    const e = drive(FIX_MS, 562, 520, 11, 'MED', 90, Date.parse('2026-09-23T22:02:00+02:00'));
    return { ...e, etaBoden: local(Date.parse(e.etaBoden) + 23 * MIN) };
  })(),
  /* Droga SE — odpoczynek w toku (11 h od 14:05), potem 6 h 50 min jazdy */
  'SS-08': {
    etaBoden: local(Date.parse('2026-09-24T01:05:00+02:00') + 410 * MIN), etaConfidence: 'HIGH', etaConfMin: 30,
    detail: {
      phase: 'REST', lastFixAt: FIX, distanceKm: 455, driveMin: 410,
      restFrom: '2026-09-23T14:05:00+02:00', restUntil: '2026-09-24T01:05:00+02:00', restHours: 11,
    },
  },
  /* Droga SE — dzień po promie; siła wyższa (oblodzenie) dolicza swoje godziny osobno */
  'SG-31': drive(FIX_MS, 690, 610, 11, 'MED', 90),
  /* Plac Boden — czeka na skraju placu od 11:40, przed oknem dostawy (25.09) */
  'T-18': {
    etaBoden: '2026-09-23T11:40:00+02:00', etaConfidence: 'HIGH', etaConfMin: 30,
    detail: { phase: 'WAIT_SITE', lastFixAt: FIX, waitSince: '2026-09-23T11:40:00+02:00' },
  },
  /* Opóźniony — okno dostawy minęło dziś o 15:00, do placu 560 km: dojedzie jutro przed południem */
  'SG-35': drive(FIX_MS, 560, 500, 11, 'LOW', 150),
  /* Port PL — rejs 24.09 odwołany, najbliższy 25.09 18:00 → Nynäshamn 26.09 12:00, potem jazda i odpoczynek */
  'SG-32': {
    etaBoden: local(Date.parse('2026-09-26T12:00:00+02:00') + 15 * H + 11 * H), etaConfidence: 'LOW', etaConfMin: 240,
    detail: { phase: 'DRIVE', lastFixAt: FIX, distanceKm: 1050, driveMin: 900, restNeeded: true, restHours: 11 },
  },
  /* Port SE (Nynäshamn) — kontrola graniczna i kolejka: siła wyższa dolicza +3 h osobno; do placu 1 050 km */
  'SG-14': drive(FIX_MS, 1050, 900, 11, 'LOW', 180),
  /* Cisza GPS — ostatnia pozycja 13:18 (194 min), ETA z niej */
  'SG-33': drive(NOW_MS - 194 * MIN, 610, 540, 11, 'LOW', 180),
};

/** Opóźnione bez siły wyższej: ile po końcu okna dostawy (dziś) — tytuł sprawy „Prognoza przyjazdu poza oknem o …” z tej liczby. */
const DELAY_MIN: Readonly<Record<string, number>> = { 'SG-10': 95, 'SS-01': 135, 'SG-21': 175, 'SS-07': 120 };

/**
 * Pozostałe transporty w trasie (daty z dnia demo, seed.ts N6):
 * - Droga PL (załadunek dziś): rejs jutro 18:00, potem Szwecja;
 * - port PL i prom: rejs dziś 18:00 (prom: wpłynięcie z AIS jutro 12:00);
 * - Droga SE: 520 km, 7 h 30 min jazdy i 11 h odpoczynku;
 * - brak GPS: z ostatniej pozycji (zegar − `silentMinutes`);
 * - opóźnione: dziś wieczorem, po oknie dostawy (`DELAY_MIN`);
 * - Plac Boden: czeka przed placem od 15:10.
 */
function genericEta(load: Load): DemoEta | null {
  switch (load.status) {
    case 'IN_TRANSIT_PL':
      return { ...drive(FIX_MS, 1380, 1200, 11, 'MED', 120), etaBoden: local(AFTER_FERRY + 24 * H) };
    case 'AT_PORT':
      return { ...drive(FIX_MS, 1050, 900, 11, 'MED', 120), etaBoden: local(AFTER_FERRY) };
    case 'ON_FERRY':
      return { etaBoden: local(AFTER_FERRY), etaConfidence: 'MED', etaConfMin: 90, detail: { phase: 'FERRY', ferryEtaAt: local(FERRY_IN), lastFixAt: FIX } };
    case 'IN_TRANSIT_SE':
      return drive(FIX_MS, 520, 450, 11, 'HIGH', 45);
    case 'SILENT':
      return drive(NOW_MS - (load.silentMinutes ?? 95) * MIN, 600, 520, 11, 'LOW', 180);
    case 'DELAYED': {
      const end = Date.parse(load.awizacja?.unloadWindowEnd ?? `${load.plannedDeliverDate}T15:00:00Z`);
      const eta = Math.max(end + (DELAY_MIN[load.code] ?? 95) * MIN, FIX_MS + 30 * MIN);
      const driveMin = Math.round((eta - FIX_MS) / MIN);
      return drive(FIX_MS, Math.round(driveMin * 1.15), driveMin, null, 'LOW', 150);
    }
    case 'APPROACHING_SITE':
      return { etaBoden: '2026-09-23T15:10:00+02:00', etaConfidence: 'HIGH', etaConfMin: 15, detail: { phase: 'WAIT_SITE', lastFixAt: FIX, waitSince: '2026-09-23T15:10:00+02:00' } };
    default:
      return null;
  }
}

/** Etapy w oknie śledzenia z ETA (bez Załadunku — „–” przed wyjazdem, E15). */
const WITH_ETA = new Set<Load['status']>(['IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'IN_TRANSIT_SE', 'DELAYED', 'SILENT', 'APPROACHING_SITE']);

/** ETA demo: transport z listy albo ETA z etapu dla pozostałych w trasie; reszta bez zmian (także po zmianie statusu w demo). */
export function withDemoEta(load: Load): Load {
  /* Załadunek: pozycja jest (plac KSH w Śremie), ETA „–” przed wyjazdem (E15) — bez „Brak pozycji GPS” */
  if (load.status === 'LOADING') {
    return { ...load, etaBoden: null, etaConfMin: null, etaDetail: { phase: 'DRIVE', lastFixAt: FIX, distanceKm: 1380 }, etaReasons: [], etaUpdatedAt: DEMO_ETA_AT };
  }
  if (!WITH_ETA.has(load.status)) return load;
  const e = DEMO_ETA[load.code] ?? genericEta(load);
  if (!e) return load;
  return {
    ...load,
    etaBoden: e.etaBoden,
    etaConfidence: e.etaConfidence,
    etaConfMin: e.etaConfMin,
    etaDetail: e.detail,
    etaReasons: [],
    etaMethod: 'GPS · HERE',
    etaUpdatedAt: DEMO_ETA_AT,
  };
}

const hm = (min: number) => etaDuration(min); /* D-071 */

/**
 * Teksty spraw demo z tych samych liczb co transport (audyt 17.10, F7): „poza oknem o …” = ETA − koniec okna,
 * „Brak pozycji od …” = `silentMinutes`, „załadunek za …” = do początku okna załadunku od zegara demo.
 */
export function alignDemoRisks(risks: readonly Risk[], loads: readonly Load[]): Risk[] {
  const byId = new Map(loads.map((l) => [l.id, l]));
  return risks.map((r) => {
    const l = r.loadId ? byId.get(r.loadId) : undefined;
    if (!l) return r;
    if (r.id.startsWith('risk-eta-') && l.etaBoden) {
      const end = Date.parse(l.awizacja?.unloadWindowEnd ?? `${l.plannedDeliverDate}T15:00:00Z`);
      const late = Math.round((Date.parse(l.etaBoden) - end) / MIN);
      return late > 0
        ? { ...r, title: `Prognoza przyjazdu poza oknem o ${hm(late)}`, titleKey: 'rk_seed_eta', titleParams: { d: hm(late) } }
        : r;
    }
    if (r.id === 'risk-silent' && l.silentMinutes) {
      /* stały szablon „od 2 h 14 min” — bez klucza tekst idzie wprost (`riskText`) */
      return { ...r, title: `Brak pozycji od ${hm(l.silentMinutes)}`, titleKey: undefined, titleParams: undefined };
    }
    if (r.id.startsWith('risk-permit-')) {
      const start = Date.parse(l.awizacja?.loadWindowStart ?? `${l.plannedLoadDate}T06:00:00Z`);
      const h = Math.max(1, Math.round((start - NOW_MS) / H));
      const when = h < 48 ? `${h}\u00a0h` : `${Math.round(h / 24)}\u00a0${plPlural(Math.round(h / 24), 'dzień', 'dni', 'dni')}`;
      return {
        ...r, title: `Brak zezwolenia — załadunek za ${when}`, detail: `Do załadunku ${when}, brak zezwolenia obejmującego wymiary zestawu`,
        ...(h < 48 ? { titleKey: 'rk_seed_permit', titleParams: { h } } : { titleKey: undefined, titleParams: undefined }),
      };
    }
    return r;
  });
}
