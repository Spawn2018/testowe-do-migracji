/** Polferries GDN↔NYN — seed timetable + rolling generated sailings. No booking API. */
import raw from '../data/ferry-sailings.json';
import { getNow, getNowMs } from './frozenNow';
import { voyageWaveLabelForDay } from './voyageSea';

export type FerryVesselId = 'WAW' | 'NS';
export type FerrySailingStatus =
  | 'PLANNED'
  | 'BOARDING'
  | 'DEPARTED'
  | 'ARRIVED'
  | 'CANCELLED'
  | 'DELAYED';

export interface FerryVessel {
  id: FerryVesselId;
  name: string;
  short: string;
  mmsi: string;
  imo: string;
  seedPosition: { lng: number; lat: number };
}

export interface FerrySailing {
  id: string;
  vessel: FerryVesselId;
  depPort: 'GDN' | 'NYN';
  arrPort: 'GDN' | 'NYN';
  depLocal: string;
  arrLocal: string;
  status: FerrySailingStatus;
  source: 'seed' | 'hitl' | 'generated';
}

export const FERRY_VESSELS = raw.vessels as FerryVessel[];
export const FERRY_NOTE = (raw as { note?: string }).note ?? '';

const SEED = raw.sailings as FerrySailing[];

/** Typical Polferries pattern: evening GDN→NYN, afternoon NYN→GDN, ~18h sea. */
const PATTERN = {
  gdnHour: 18,
  nynHour: 17,
  seaHours: 18,
} as const;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Warsaw-local ISO without relying on host TZ. */
function warsawIso(y: number, m: number, d: number, hour: number, min = 0): string {
  // Approximate: CEST (+02) Mar–Oct, CET (+01) otherwise. Demo window is Sep 2026 → +02.
  const off = m >= 3 && m <= 10 ? '+02:00' : '+01:00';
  return `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(min)}:00${off}`;
}

function addHoursIso(iso: string, hours: number): string {
  const t = Date.parse(iso) + hours * 3600_000;
  const d = new Date(t);
  // format back in Europe/Warsaw
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (ty: string) => parts.find((p) => p.type === ty)?.value ?? '00';
  const month = Number(g('month'));
  const off = month >= 3 && month <= 10 ? '+02:00' : '+01:00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:00${off}`;
}

function dayKeyWarsaw(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function vesselForDay(dayIndex: number): FerryVesselId {
  return dayIndex % 2 === 0 ? 'WAW' : 'NS';
}

/** Rolling ±14 days around `now`, both directions. Seed rows win on same id. */
export function buildSchedule(now = getNow()): FerrySailing[] {
  const byId = new Map<string, FerrySailing>();
  for (const s of SEED) byId.set(s.id, { ...s });

  const center = Date.parse(dayKeyWarsaw(now.getTime()) + 'T12:00:00+02:00');
  for (let i = -14; i <= 21; i++) {
    const dayMs = center + i * 86400_000;
    const key = dayKeyWarsaw(dayMs);
    const [y, m, d] = key.split('-').map(Number);
    const dayIndex = Math.floor(dayMs / 86400_000);
    const vessel = vesselForDay(dayIndex);

    const outId = `gen-${key}-GDN`;
    if (!byId.has(outId) && !SEED.some((s) => s.depLocal.slice(0, 10) === key && s.depPort === 'GDN')) {
      const depLocal = warsawIso(y, m, d, PATTERN.gdnHour);
      byId.set(outId, {
        id: outId,
        vessel,
        depPort: 'GDN',
        arrPort: 'NYN',
        depLocal,
        arrLocal: addHoursIso(depLocal, PATTERN.seaHours),
        status: 'PLANNED',
        source: 'generated',
      });
    }

    const retId = `gen-${key}-NYN`;
    if (!byId.has(retId) && !SEED.some((s) => s.depLocal.slice(0, 10) === key && s.depPort === 'NYN')) {
      const depLocal = warsawIso(y, m, d, PATTERN.nynHour);
      byId.set(retId, {
        id: retId,
        vessel: vessel === 'WAW' ? 'NS' : 'WAW',
        depPort: 'NYN',
        arrPort: 'GDN',
        depLocal,
        arrLocal: addHoursIso(depLocal, PATTERN.seaHours),
        status: 'PLANNED',
        source: 'generated',
      });
    }
  }

  return [...byId.values()].sort((a, b) => Date.parse(a.depLocal) - Date.parse(b.depLocal));
}

export const FERRY_SAILINGS = SEED;

export function vesselById(id: FerryVesselId): FerryVessel {
  return FERRY_VESSELS.find((v) => v.id === id) ?? FERRY_VESSELS[0];
}

export function sailingForDate(isoDay = '2026-09-23'): FerrySailing | undefined {
  const day = isoDay.slice(0, 10);
  return buildSchedule(new Date(day + 'T12:00:00+02:00')).find(
    (s) => s.depLocal.slice(0, 10) === day && s.depPort === 'GDN',
  );
}

function effectiveStatus(s: FerrySailing, nowMs: number): FerrySailingStatus {
  if (s.status === 'CANCELLED') return 'CANCELLED';
  const dep = Date.parse(s.depLocal);
  const arr = Date.parse(s.arrLocal);
  if (Number.isNaN(dep) || Number.isNaN(arr)) return s.status;
  if (nowMs >= arr) return 'ARRIVED';
  if (nowMs >= dep) return 'DEPARTED';
  if (dep - nowMs <= 90 * 60_000) return 'BOARDING';
  return s.status === 'DELAYED' ? 'DELAYED' : 'PLANNED';
}

/** Next departing (or currently boarding) sailing from live clock. */
export function nextLiveSailing(now = getNow()): FerrySailing {
  const nowMs = now.getTime();
  const all = buildSchedule(now).map((s) => ({ ...s, status: effectiveStatus(s, nowMs) }));

  const boarding = all.find((s) => s.status === 'BOARDING');
  if (boarding) return boarding;

  const underway = all.find((s) => s.status === 'DEPARTED');
  // Prefer next departure if underway arrives soon / already past midpoint
  const upcoming = all
    .filter((s) => s.status === 'PLANNED' || s.status === 'DELAYED' || s.status === 'BOARDING')
    .filter((s) => Date.parse(s.depLocal) >= nowMs - 5 * 60_000)
    .sort((a, b) => Date.parse(a.depLocal) - Date.parse(b.depLocal));

  if (upcoming[0]) return upcoming[0];
  if (underway) return underway;
  return all[all.length - 1];
}

/** @deprecated use nextLiveSailing — kept for RisksView call sites */
export function activeOrNextSailing(now = getNow()): FerrySailing {
  return nextLiveSailing(now);
}

export function ferryLabel(s: FerrySailing): string {
  const v = vesselById(s.vessel);
  const dep = s.depLocal.slice(11, 16);
  return `${v.name} · dep ${dep} ${s.depPort}→${s.arrPort}`;
}

export function ferryWidgetLabel(s: FerrySailing): { cd: string; line: string; wave: string } {
  const v = vesselById(s.vessel);
  const now = getNowMs();
  const depMs = Date.parse(s.depLocal);
  const mins = Math.max(0, Math.round((depMs - now) / 60_000));
  const cd = `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
  const parts = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(depMs));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const when = `${g('day')}.${g('month')} ${g('hour')}:${g('minute')}`;
  const dir = s.depPort === 'GDN' ? 'GDN→NYN' : 'NYN→GDN';
  return {
    cd,
    line: `${v.short || v.name} · ${when} · ${dir}`,
    wave: voyageWaveLabelForDay(s.depLocal.slice(0, 10)),
  };
}

/** Heading for map arrow: SE-bound (GDN→NYN) ≈ NE, return ≈ SW. */
export function ferryHeadingDeg(s: FerrySailing): number {
  return s.depPort === 'GDN' ? 20 : 200;
}

/** Truck arrow: up = toward Boden (delivery), down = toward KSH Śrem (loading). */
export function truckArrowDir(status: string): 'up' | 'down' {
  if (
    status === 'PLANNED' ||
    status === 'RESOURCES_PENDING' ||
    status === 'READY' ||
    status === 'LOADING' ||
    status === 'DOC_MISSING'
  ) {
    return 'down';
  }
  return 'up';
}
