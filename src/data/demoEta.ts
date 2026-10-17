/**
 * wyglad/W-demo (audyt 17.10, D-20261017-0730-01 §4; sekcje 08 N11, 15 N2, 01 N18): ETA w danych demo.
 * Transporty w oknie śledzenia (dzień demo 23.09.2026, zegar 16:32) dostają ETA Boden, pasmo ± minut i szczegóły
 * jak z serwera (`etaDetail`, E15): w trasie, odpoczynek w toku, czeka przed placem, cisza GPS. Bez tego blok ETA
 * w panelu pokazywał „ETA: –” i „Brak pozycji GPS”, choć Mapa miała pozycję, a kolumna „ETA Boden” była pusta.
 * Dane zmyślone (G-09). Tylko demo — produkcja bierze ETA z `eta_basis` (wykonawca, P4-u).
 */
import type { EtaDetail, Load } from '../types';

/** Ostatnie przeliczenie i ostatnia pozycja w demo — tuż przed zegarem demo 23.09.2026, 16:32. */
export const DEMO_ETA_AT = '2026-09-23T16:30:00+02:00';
const FIX = '2026-09-23T16:27:00+02:00';

type DemoEta = {
  etaBoden: string;
  etaConfidence: 'HIGH' | 'MED' | 'LOW';
  etaConfMin: number;
  detail: EtaDetail;
};

export const DEMO_ETA: Readonly<Record<string, DemoEta>> = {
  /* Droga SE, przed zamkniętym Högakustenbron (E49) — jazda z odpoczynkiem przed Boden */
  'T-17': {
    etaBoden: '2026-09-24T19:45:00+02:00', etaConfidence: 'MED', etaConfMin: 90,
    detail: { phase: 'DRIVE', lastFixAt: FIX, distanceKm: 562, driveMin: 520, restNeeded: true, restHours: 11 },
  },
  /* Droga SE — odpoczynek w toku (11 h), potem 6 h 50 min jazdy */
  'SS-08': {
    etaBoden: '2026-09-24T08:10:00+02:00', etaConfidence: 'HIGH', etaConfMin: 30,
    detail: {
      phase: 'REST', lastFixAt: FIX, distanceKm: 455, driveMin: 410,
      restFrom: '2026-09-23T14:05:00+02:00', restUntil: '2026-09-24T01:05:00+02:00', restHours: 11,
    },
  },
  /* Droga SE — dzień po promie, odpoczynek przed Boden */
  'SG-31': {
    etaBoden: '2026-09-25T10:30:00+02:00', etaConfidence: 'MED', etaConfMin: 90,
    detail: { phase: 'DRIVE', lastFixAt: FIX, distanceKm: 690, driveMin: 610, restNeeded: true, restHours: 11 },
  },
  /* Plac Boden — czeka na skraju placu przed oknem dostawy (26.09) */
  'T-18': {
    etaBoden: '2026-09-23T11:40:00+02:00', etaConfidence: 'HIGH', etaConfMin: 30,
    detail: { phase: 'WAIT_SITE', lastFixAt: FIX, waitSince: '2026-09-23T11:40:00+02:00' },
  },
  /* Opóźniony — dojedzie po oknie dostawy (28.09, 15:00) */
  'SG-35': {
    etaBoden: '2026-09-28T18:20:00+02:00', etaConfidence: 'LOW', etaConfMin: 150,
    detail: { phase: 'DRIVE', lastFixAt: FIX, distanceKm: 980, driveMin: 900, restNeeded: true, restHours: 11 },
  },
  /* Port PL — rejs odwołany, ETA z najbliższego rejsu, niska pewność */
  'SG-32': {
    etaBoden: '2026-09-26T14:00:00+02:00', etaConfidence: 'LOW', etaConfMin: 240,
    detail: { phase: 'DRIVE', lastFixAt: FIX },
  },
  /* Cisza GPS — ostatnia pozycja 12:58, ETA z niej, niska pewność */
  'SG-33': {
    etaBoden: '2026-09-25T09:00:00+02:00', etaConfidence: 'LOW', etaConfMin: 180,
    detail: { phase: 'DRIVE', lastFixAt: '2026-09-23T12:58:00+02:00', distanceKm: 610, driveMin: 540, restNeeded: true, restHours: 11 },
  },
};

/** ETA demo dla transportu z listy; pozostałe bez zmian. */
export function withDemoEta(load: Load): Load {
  const e = DEMO_ETA[load.code];
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
