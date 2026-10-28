/**
 * wyglad/W-eta — przykład ekranu Kalibracja ETA (E15 pkt 7) w trybie demo. Dane zmyślone (G-09), liczone z transportów
 * dostarczonych w demo: te same kody i dni co w Harmonogramie. Jeden pomiar pominięty z powodem — jak dwa błędne pomiary
 * SG-03 na produkcji (audyt 17.10, sekcja 08 N6). Odcinki i obecne czasy jak `eta_segment_params`
 * na produkcji (0054, 0062, 0160); reguła wniosku jak `RAPORT_KALIBRACJI_ETA.md` (n ≥ 5, odchylenie > 10 %, mediana).
 */
import type { Load } from '../types';
import { etaDuration } from './etaDuration';
import { getNowIso } from './frozenNow';
import type { CalibObservation, CalibProposal, CalibSegment, CalibVersion, EtaCalibration } from './etaCalibSource';
import { isAfterDelivery } from './status';

/**
 * Na dostawę, od najwcześniejszej: błąd ETA 24/6/1 h przed (min; minus = przyjechał wcześniej, niż mówiło ETA),
 * Droga PL, odprawa, Droga SE, przerwy (min), odpoczynek. Auta jadą po Szwecji szybciej, niż zakłada obecna wersja
 * (Droga SE 17 h, przerwy 2 h), więc ETA 24 h przed przyjazdem jest za późne — błędy ujemne, ok. −2 h 20 min.
 */
const SAMPLES: ReadonlyArray<{ e: [number, number, number]; pl: number; port: number; se: number; brk: number; rest: string }> = [
  { e: [-150, -40, -8], pl: 395, port: 170, se: 905, brk: 95, rest: '11 h · Sundsvall' },
  { e: [-165, -55, -12], pl: 380, port: 165, se: 890, brk: 90, rest: '11 h · Umeå' },
  { e: [-120, -15, 6], pl: 410, port: 180, se: 880, brk: 120, rest: '9 h (skrócony) · Härnösand' },
  { e: [-130, -35, -4], pl: 385, port: 175, se: 930, brk: 85, rest: '11 h · Sundsvall' },
  { e: [-140, -45, -10], pl: 400, port: 160, se: 895, brk: 100, rest: '11 h · Örnsköldsvik' },
  { e: [-145, -30, 3], pl: 375, port: 185, se: 910, brk: 90, rest: '11 h · Umeå' },
];

export const CALIB_NEEDED = 5;
/** Odchylenie mediany, do którego wniosek brzmi „bez zmian” (RAPORT_KALIBRACJI_ETA.md). */
export const CALIB_SAME_PCT = 10;
/** Odcinki, które 24 h przed wjazdem na plac są jeszcze przed autem (jest już w Szwecji) — z nich liczy się błąd po zmianie. */
export const CALIB_AHEAD_AT_24H = ['SE_ROAD', 'SE_BREAKS'] as const;

const V1: CalibVersion = {
  id: 'cal-v1', no: 1, at: '2026-09-01T09:00:00+02:00', by: 'System // Watch Tower', current: true, status: 'applied',
  what: 'Czasy startowe: Droga PL 7 h 30 min, odprawa 3 h, Droga SE 17 h, przerwy 2 h',
};

const local = (ms: number) => `${new Date(ms + 2 * 3600e3).toISOString().slice(0, 16)}:00+02:00`;
const round5 = (x: number) => Math.round(x / 5) * 5;
const meanAbs = (xs: number[]) => Math.round(xs.reduce((a, x) => a + Math.abs(x), 0) / xs.length);

/**
 * O ile minut wcześniej wyjdzie ETA 24 h przed przyjazdem po zmianie czasów: suma (obecny − proponowany) odcinków,
 * które są jeszcze przed autem. Błąd = przyjazd − ETA, więc nowy błąd = stary błąd + przesunięcie.
 */
export function calibShiftAt24h(segments: readonly CalibSegment[]): number {
  return segments
    .filter((s) => s.verdict === 'propose' && s.medianMin != null && (CALIB_AHEAD_AT_24H as readonly string[]).includes(s.code))
    .reduce((a, s) => a + (s.currentMin - s.medianMin!), 0);
}
/** Kwantyl z interpolacją liniową (p10, mediana, p90 — jak `RAPORT_KALIBRACJI_ETA.md`). */
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
}

export function measured(code: string, name: string, currentMin: number, values: number[]): CalibSegment {
  const n = values.length;
  if (n < CALIB_NEEDED) return { code, name, currentMin, verdict: 'few', medianMin: null, spreadMin: null, devPct: null, n };
  const medianMin = round5(quantile(values, 0.5));
  /* rozrzut = większa z odległości p10 i p90 od mediany (tej samej, którą pokazuje ekran) */
  const spreadMin = round5(Math.max(medianMin - quantile(values, 0.1), quantile(values, 0.9) - medianMin));
  const devPct = Math.round(((medianMin - currentMin) / currentMin) * 100);
  return { code, name, currentMin, verdict: Math.abs(devPct) <= CALIB_SAME_PCT ? 'same' : 'propose', medianMin, spreadMin, devPct, n };
}
export const fixed = (code: string, name: string, currentMin: number, note: string): CalibSegment => (
  { code, name, currentMin, verdict: 'fixed', medianMin: null, spreadMin: null, devPct: null, n: 0, note }
);

export function demoCalibration(loads: readonly Load[]): EtaCalibration {
  const done = loads
    .filter((l) => isAfterDelivery(l.status) && l.unloadedAt)
    .sort((a, b) => Date.parse(a.unloadedAt!) - Date.parse(b.unloadedAt!));
  const used: Array<(typeof SAMPLES)[number]> = [];
  const observations: CalibObservation[] = done.map((l, i) => {
    const arrivedAt = local(Date.parse(l.unloadedAt!) - 90 * 60_000);
    const base = { id: `cal-${l.id}`, loadId: l.id, code: l.code, arrivedAt };
    /* drugi pomiar pominięty: bez pozycji na odcinku SE nie da się zmierzyć ani jazdy, ani błędu ETA */
    if (i === 1) {
      return {
        ...base, err24: null, err6: null, err1: null, plMin: null, portMin: null, seMin: null, breaksMin: null, rest: null,
        skipped: 'brak GPS na odcinku SE (lokalizator milczał 9 h)',
      };
    }
    const s = SAMPLES[(i > 1 ? i - 1 : i) % SAMPLES.length];
    used.push(s);
    return { ...base, err24: s.e[0], err6: s.e[1], err1: s.e[2], plMin: s.pl, portMin: s.port, seMin: s.se, breaksMin: s.brk, rest: s.rest, skipped: null };
  });

  const segments: CalibSegment[] = [
    measured('PL_ROAD', 'Droga PL: Śrem → terminal Gdańsk', 450, used.map((s) => s.pl)),
    measured('PL_ROAD_GDY', 'Droga PL: Śrem → terminal Gdynia', 492, []),
    measured('PORT_CHECKIN', 'Odprawa w porcie przed promem', 180, used.map((s) => s.port)),
    fixed('CROSSING_DEFAULT', 'Rejs Gdańsk → Nynäshamn', 1080, 'Czas z rozkładu armatora (18 h, gdy rejsu nie ma w rozkładzie) — bez kalibracji.'),
    measured('SE_ROAD', 'Droga SE: Nynäshamn → plac w Boden', 1020, used.map((s) => s.se)),
    measured('SE_ROAD_KAA', 'Droga SE: Karlskrona → plac w Boden', 1290, []),
    measured('SE_BREAKS', 'Przerwy w jeździe na odcinku SE', 120, used.map((s) => s.brk)),
    fixed('SE_DAILY_REST', 'Odpoczynek dobowy kierowcy', 660, '11 h (9 h skrócony) — przepisy UE, bez kalibracji.'),
  ];

  const counted = observations.filter((o) => !o.skipped);
  const proposal: CalibProposal | null = counted.length >= CALIB_NEEDED && segments.some((s) => s.verdict === 'propose')
    ? {
      id: 'cal-p2',
      at: counted[counted.length - 1].arrivedAt,
      errorBeforeMin: meanAbs(counted.map((o) => o.err24 ?? 0)),
      errorAfterMin: meanAbs(counted.map((o) => (o.err24 ?? 0) + calibShiftAt24h(segments))),
    }
    : null;
  return { needed: CALIB_NEEDED, observations, segments, versions: [V1], proposal };
}

const SHORT: Record<string, string> = {
  PL_ROAD: 'Droga PL', PL_ROAD_GDY: 'Droga PL (Gdynia)', PORT_CHECKIN: 'odprawa', SE_ROAD: 'Droga SE', SE_ROAD_KAA: 'Droga SE (Karlskrona)', SE_BREAKS: 'przerwy',
};

/** Treść wersji po zatwierdzeniu — z tych samych median co tabela (demo i test). */
export function calibVersionText(c: EtaCalibration): string {
  const p = c.proposal;
  const day = p ? `${p.at.slice(8, 10)}.${p.at.slice(5, 7)}.${p.at.slice(0, 4)}` : '';
  const parts = c.segments.filter((s) => s.verdict === 'propose' && s.medianMin != null)
    .map((s) => `${SHORT[s.code] ?? s.name} ${etaDuration(s.medianMin!)}`);
  return `Propozycja z ${day}: ${parts.join(', ')}`;
}

/** Demo: zatwierdzenie dopisuje wersję 2 w pamięci strony (produkcja: `apply_eta_calibration_version`, P4-u). */
export function demoCalibrationApproveFor(c: EtaCalibration) {
  return async (proposalId: string): Promise<{ ok: boolean; version?: CalibVersion }> => {
    if (!c.proposal || proposalId !== c.proposal.id) return { ok: false };
    return {
      ok: true,
      version: { id: 'cal-v2', no: 2, at: getNowIso(), by: 'Konto pokazowe // H&H Logistics', current: true, what: calibVersionText(c), status: 'applied', undoable: true },
    };
  };
}

/**
 * W-604 — demo: „Cofnij” w pamięci strony (produkcja: `eta_calibration_undo`). Ekran oznacza wersję jako cofniętą
 * i wraca do poprzedniej; czasy startowe (wersja 1) nie mają czego przywrócić.
 */
export async function demoCalibrationUndo(versionId: string): Promise<{ ok: boolean; error?: string | null }> {
  if (versionId === V1.id) return { ok: false, error: 'Wersji startowej nie da się cofnąć — nie ma wcześniejszych czasów.' };
  return { ok: true };
}
