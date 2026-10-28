/**
 * wyglad/W-eta — dane ekranu Opcje › Zasady transportu › Kalibracja ETA (E15 pkt 7, decyzja właściciela 07.10 22:15;
 * 3A 17.10: kalibracja robiona normalnie; audyt 17.10 sekcja 08 N6).
 * Zasada: każda dostawa z GPS daje pomiar (błąd ETA 24 h, 6 h i 1 h przed przyjazdem, czasy odcinków, przerwy);
 * po 5 dostawach propozycja czasów odcinków z rozrzutem; zatwierdza Administrator HHL; bez zatwierdzenia nic się nie zmienia.
 * Odcinki = kody `eta_segment_params` (0051, 0054, 0062, 0160). Reguła wniosku jak w `RAPORT_KALIBRACJI_ETA.md`:
 * mniej niż 5 dostaw — za mało danych; odchylenie mediany ≤ 10 % — bez zmian; inaczej propozycja = mediana.
 * Demo: pomiary z transportów dostarczonych (`etaCalibDemo.ts`, dane zmyślone — G-09). Produkcja: `null`, dopóki wykonawca
 * nie podłączy danych w P4-u (`eta_segment_observations`, `eta_calibration_versions`, `apply_eta_calibration_version`;
 * D-20261017-1100-01 §3). Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import type { Load } from '../types';
import { demoCalibration, demoCalibrationApproveFor, demoCalibrationUndo } from './etaCalibDemo';
import type { CalibVersionStatus } from './etaCalibAuto';

/** Minuty: rzeczywisty przyjazd − ETA (dodatnie = przyjechał później niż ETA). `null` — brak ETA w tym punkcie. */
export type CalibErr = number | null;

export type CalibObservation = {
  id: string;
  loadId: string;
  code: string;
  /** Wjazd na plac (ISO). */
  arrivedAt: string;
  err24: CalibErr;
  err6: CalibErr;
  err1: CalibErr;
  /** Droga PL: wyjazd ze Śremu → wjazd do portu (min). */
  plMin: number | null;
  /** Odprawa w porcie przed promem: wjazd → wyjazd ze strefy portu (min). */
  portMin: number | null;
  /** Droga SE: zjazd z promu → wjazd na plac, sama jazda (min). */
  seMin: number | null;
  /** Przerwy w jeździe na odcinku SE (min). */
  breaksMin: number | null;
  /** Odpoczynek dobowy rozpoznany z GPS: „11 h · Sundsvall”. */
  rest: string | null;
  /** Pomiar pominięty w propozycji — powód zdaniem (np. omyłkowy status). */
  skipped: string | null;
};

/** Wniosek dla odcinka: propozycja / bez zmian (≤ 10 %) / za mało dostaw / bez kalibracji (rozkład armatora, przepisy). */
export type CalibVerdict = 'propose' | 'same' | 'few' | 'fixed';

export type CalibSegment = {
  /** Kod z `eta_segment_params`: PL_ROAD, PL_ROAD_GDY, PORT_CHECKIN, CROSSING_DEFAULT, SE_ROAD, SE_ROAD_KAA, SE_ROAD_KAA_INLAND (#619), SE_BREAKS, SE_DAILY_REST. */
  code: string;
  name: string;
  /** Czas w obowiązującej wersji (min). */
  currentMin: number;
  verdict: CalibVerdict;
  /** Mediana pomiarów (min) — przy „propose” nowy czas, przy „same” dla porównania. */
  medianMin: number | null;
  /** Rozrzut pomiarów ± min. */
  spreadMin: number | null;
  /** Odchylenie mediany od obecnego czasu, % (ze znakiem). */
  devPct: number | null;
  /** Liczba dostaw w pomiarze odcinka. */
  n: number;
  /** Przy „fixed”: skąd czas („z rozkładu armatora — bez kalibracji”). */
  note?: string | null;
};

export type CalibVersion = {
  id: string;
  no: number;
  at: string;
  by: string;
  what: string;
  /** Obowiązuje teraz. */
  current?: boolean;
  /** W-604 (0320): stan wersji — zastosowana, cofnięta, odrzucona, zastąpiona, oczekuje (auto / decyzja HHL). */
  status?: CalibVersionStatus;
  /** W-604: tę wersję można cofnąć (`eta_calibration_undo`) — najnowsza zastosowana i niecofnięta. */
  undoable?: boolean;
};

export type CalibProposal = {
  /** `eta_calibration_versions.id` z `applied = false`. */
  id: string;
  at: string;
  /** Średni błąd ETA 24 h przed przyjazdem na tych samych dostawach: z obecnymi czasami i z proponowanymi (min). */
  errorBeforeMin: number;
  errorAfterMin: number;
  /** W-604 F7 r1 Ś1: zmiana > 15 % — czeka na decyzję Administratora HHL w Ryzykach (`ETA_CALIBRATION_APPROVAL`). */
  awaitsDecision?: boolean;
};

export type EtaCalibration = {
  /** Ile dostaw potrzeba do propozycji (E15: 5). */
  needed: number;
  observations: CalibObservation[];
  segments: CalibSegment[];
  versions: CalibVersion[];
  /** Propozycja czeka na zatwierdzenie; `null` — za mało dostaw albo wszystkie odcinki bez zmian. */
  proposal: CalibProposal | null;
};

export type CalibApprove = (proposalId: string) => Promise<{ ok: boolean; version?: CalibVersion }>;
/** W-604: „Cofnij” wersję — `error` to gotowe zdanie po polsku (kod błędu bazy → słownik). */
export type CalibUndo = (versionId: string) => Promise<{ ok: boolean; error?: string | null }>;

export function etaCalibrationOf(loads: readonly Load[]): EtaCalibration | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoCalibration(loads);
  return null;
}

/** „Zatwierdź nowe czasy” — tylko Administrator HHL. `null` — zapis nie podłączony (przycisk niedostępny). */
export function etaCalibrationApproveOf(c: EtaCalibration): CalibApprove | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoCalibrationApproveFor(c);
  return null;
}

/** W-604: „Cofnij” — tylko Administrator HHL. Demo: cofnięcie w pamięci strony; produkcja: `LiveCalib` (`eta_calibration_undo`). */
export function etaCalibrationUndoOf(_c: EtaCalibration): CalibUndo | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoCalibrationUndo;
  return null;
}
