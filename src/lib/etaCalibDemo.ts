/**
 * wyglad/W-eta — przykład ekranu Kalibracja ETA (E15 pkt 7) w trybie demo. Dane zmyślone (G-09), liczone z transportów
 * dostarczonych w demo: te same kody i dni co w Harmonogramie. Jeden pomiar pominięty — jak dwa błędne pomiary SG-03
 * na produkcji (status ustawiony omyłkowo; audyt 17.10, sekcja 08 N6). Odcinki i obecne czasy jak `eta_segment_params`
 * na produkcji (0054, 0062, 0160); reguła wniosku jak `RAPORT_KALIBRACJI_ETA.md` (n ≥ 5, odchylenie > 10 %, mediana).
 */
import type { Load } from '../types';
import { etaDuration } from './etaDuration';
import type { CalibObservation, CalibProposal, CalibSegment, CalibVersion, EtaCalibration } from './etaCalibSource';

/** Na dostawę, od najwcześniejszej: błąd ETA 24/6/1 h przed (min), Droga PL, odprawa, Droga SE, przerwy (min), odpoczynek. */
const SAMPLES: ReadonlyArray<{ e: [number, number, number]; pl: number; port: number; se: number; brk: number; rest: string }> = [
  { e: [95, 40, 12], pl: 395, port: 170, se: 905, brk: 95, rest: '11 h · Sundsvall' },
  { e: [70, -25, 8], pl: 380, port: 165, se: 890, brk: 90, rest: '11 h · Umeå' },
  { e: [-50, 20, -6], pl: 410, port: 180, se: 880, brk: 120, rest: '9 h (skrócony) · Härnösand' },
  { e: [130, 55, 18], pl: 385, port: 175, se: 930, brk: 85, rest: '11 h · Sundsvall' },
  { e: [60, -15, 4], pl: 400, port: 160, se: 895, brk: 100, rest: '11 h · Örnsköldsvik' },
  { e: [45, 10, -3], pl: 375, port: 185, se: 910, brk: 90, rest: '11 h · Umeå' },
];

export const CALIB_NEEDED = 5;
/** Odchylenie mediany, do którego wniosek brzmi „bez zmian” (RAPORT_KALIBRACJI_ETA.md). */
export const CALIB_SAME_PCT = 10;
/** Średni błąd 24 h przed na tych samych dostawach po zmianie czasów (szacunek demo). */
const ERROR_AFTER_MIN = 30;

const V1: CalibVersion = {
  id: 'cal-v1', no: 1, at: '2026-09-01T09:00:00+02:00', by: 'System // Watch Tower', current: true,
  what: 'Czasy startowe: Droga PL 7 h 30 min, odprawa 3 h, Droga SE 17 h, przerwy 2 h',
};

const local = (ms: number) => `${new Date(ms + 2 * 3600e3).toISOString().slice(0, 16)}:00+02:00`;
const round5 = (x: number) => Math.round(x / 5) * 5;
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function measured(code: string, name: string, currentMin: number, values: number[]): CalibSegment {
  const n = values.length;
  if (n < CALIB_NEEDED) return { code, name, currentMin, verdict: 'few', medianMin: null, spreadMin: null, devPct: null, n };
  const med = median(values);
  const spreadMin = round5(Math.max(med - Math.min(...values), Math.max(...values) - med));
  const medianMin = round5(med);
  const devPct = Math.round(((medianMin - currentMin) / currentMin) * 100);
  return { code, name, currentMin, verdict: Math.abs(devPct) <= CALIB_SAME_PCT ? 'same' : 'propose', medianMin, spreadMin, devPct, n };
}
const fixed = (code: string, name: string, currentMin: number, note: string): CalibSegment => (
  { code, name, currentMin, verdict: 'fixed', medianMin: null, spreadMin: null, devPct: null, n: 0, note }
);

export function demoCalibration(loads: readonly Load[]): EtaCalibration {
  const done = loads
    .filter((l) => l.status === 'DELIVERED' && l.unloadedAt)
    .sort((a, b) => Date.parse(a.unloadedAt!) - Date.parse(b.unloadedAt!));
  const used: Array<(typeof SAMPLES)[number]> = [];
  const observations: CalibObservation[] = done.map((l, i) => {
    const arrivedAt = local(Date.parse(l.unloadedAt!) - 90 * 60_000);
    const base = { id: `cal-${l.id}`, loadId: l.id, code: l.code, arrivedAt };
    /* drugi pomiar pominięty: rozładunek wpisany ręcznie dwa dni później — błąd nie mówi nic o ETA */
    if (i === 1) {
      return {
        ...base, err24: 2890, err6: 2835, err1: 2790, plMin: null, seMin: null, breaksMin: null, rest: null,
        skipped: 'status „Dostarczone” wpisany ręcznie 2 dni po wjeździe',
      };
    }
    const s = SAMPLES[(i > 1 ? i - 1 : i) % SAMPLES.length];
    used.push(s);
    return { ...base, err24: s.e[0], err6: s.e[1], err1: s.e[2], plMin: s.pl, seMin: s.se, breaksMin: s.brk, rest: s.rest, skipped: null };
  });

  const segments: CalibSegment[] = [
    measured('PL_ROAD', 'Droga PL: Śrem → terminal Gdańsk', 450, used.map((s) => s.pl)),
    measured('PL_ROAD_GDY', 'Droga PL: Śrem → terminal Gdynia', 492, []),
    measured('PORT_CHECKIN', 'Odprawa w porcie przed promem', 180, used.map((s) => s.port)),
    fixed('CROSSING_DEFAULT', 'Rejs Gdańsk → Nynäshamn', 1080, 'z rozkładu armatora; 18 h tylko bez rejsu w rozkładzie — bez kalibracji'),
    measured('SE_ROAD', 'Droga SE: Nynäshamn → plac w Boden', 1020, used.map((s) => s.se)),
    measured('SE_ROAD_KAA', 'Droga SE: Karlskrona → plac w Boden', 1290, []),
    measured('SE_BREAKS', 'Przerwy w jeździe na odcinku SE', 120, used.map((s) => s.brk)),
    fixed('SE_DAILY_REST', 'Odpoczynek dobowy kierowcy', 660, '11 h (9 h skrócony) — przepisy UE, bez kalibracji'),
  ];

  const counted = observations.filter((o) => !o.skipped);
  const errs = counted.map((o) => Math.abs(o.err24 ?? 0));
  const proposal: CalibProposal | null = counted.length >= CALIB_NEEDED && segments.some((s) => s.verdict === 'propose')
    ? {
      id: 'cal-p2',
      at: counted[counted.length - 1].arrivedAt,
      errorBeforeMin: Math.round(errs.reduce((a, b) => a + b, 0) / errs.length),
      errorAfterMin: ERROR_AFTER_MIN,
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
      version: { id: 'cal-v2', no: 2, at: '2026-09-23T16:32:00+02:00', by: 'Konto pokazowe // H&H Logistics', current: true, what: calibVersionText(c) },
    };
  };
}
