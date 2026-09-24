/**
 * D4 — single voyage (rejs) source of truth.
 *
 * Timetable + vessel identity: `ferry-sailings.json` via `ferry.ts` `buildSchedule`.
 * Sea demo (wave/wind): `voyageSea.ts` keyed by GDN day — NOT a parallel vessel table.
 * Loads on a voyage: `ferry.departureAt` day match, else vessel + ferry-adjacent stage.
 */
import type { Load } from '../types';
import {
  buildSchedule,
  nextLiveSailing,
  vesselById,
  type FerrySailing,
} from './ferry';
import { getNow } from './frozenNow';
import {
  formatWaveM,
  formatWindMs,
  seaForDay,
  seaRiskPillClass,
  type SeaRiskLabel,
  type VoyageSea,
} from './voyageSea';

export type { SeaRiskLabel, VoyageSea };
export { seaForDay, formatWaveM, formatWindMs, seaRiskPillClass } from './voyageSea';

const FERRY_ADJACENT_STAGES = new Set(['TO_PORT', 'GDANSK', 'FERRY']);
const FERRY_ADJACENT_STATUSES = new Set(['IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY']);

export function sailingDayKey(s: Pick<FerrySailing, 'depLocal'> | string): string {
  const iso = typeof s === 'string' ? s : s.depLocal;
  return iso.slice(0, 10);
}

/** PL short day `24.09` from ISO date/datetime. */
export function formatVoyageDayLabel(iso: string): string {
  const day = iso.slice(0, 10);
  const [, m, d] = day.split('-');
  return `${d}.${m}`;
}

export function seaForSailing(s: FerrySailing): VoyageSea {
  return seaForDay(sailingDayKey(s));
}

/** Upcoming GDN→NYN sailings (schedule SoT), default next 4 from `now`. */
export function upcomingGdnSailings(now = getNow(), count = 4): FerrySailing[] {
  const nowMs = now.getTime() - 3 * 3600_000;
  return buildSchedule(now)
    .filter((s) => s.depPort === 'GDN' && Date.parse(s.depLocal) >= nowMs)
    .sort((a, b) => Date.parse(a.depLocal) - Date.parse(b.depLocal))
    .slice(0, count);
}

/**
 * Ops focus voyage: first upcoming GDN sailing with elevated sea risk,
 * else next GDN departure (not hardcoded 24.09 vs 25.09).
 */
export function focusVoyage(now = getNow()): FerrySailing {
  const upcoming = upcomingGdnSailings(now, 8);
  const threatened = upcoming.find((s) => {
    const r = seaForSailing(s).risk;
    return r === 'podwyższone' || r === 'wysokie';
  });
  if (threatened) return threatened;
  if (upcoming[0]) return upcoming[0];
  const live = nextLiveSailing(now);
  if (live.depPort === 'GDN') return live;
  const gdn = buildSchedule(now)
    .filter((s) => s.depPort === 'GDN')
    .sort((a, b) => Date.parse(a.depLocal) - Date.parse(b.depLocal));
  return gdn.find((s) => Date.parse(s.depLocal) >= now.getTime()) ?? gdn[gdn.length - 1] ?? live;
}

export interface VoyageTableRow {
  dayLabel: string;
  vesselName: string;
  wave: string;
  wind: string;
  pillClass: string;
  riskLabel: SeaRiskLabel;
  sailing: FerrySailing;
  focused: boolean;
}

export function voyageSeaTableRows(now = getNow(), focus = focusVoyage(now)): VoyageTableRow[] {
  return upcomingGdnSailings(now, 4).map((s) => {
    const sea = seaForSailing(s);
    const v = vesselById(s.vessel);
    return {
      dayLabel: formatVoyageDayLabel(s.depLocal),
      vesselName: v.name.startsWith('M/F') ? v.name : `M/F ${v.name}`,
      wave: formatWaveM(sea.waveM),
      wind: formatWindMs(sea.windMs),
      pillClass: seaRiskPillClass(sea.risk),
      riskLabel: sea.risk,
      sailing: s,
      focused: s.id === focus.id,
    };
  });
}

function vesselMatchesLoad(loadVessel: string | null | undefined, sailing: FerrySailing): boolean {
  if (!loadVessel) return false;
  const v = vesselById(sailing.vessel);
  const norm = loadVessel.toLowerCase();
  return (
    norm === v.name.toLowerCase() ||
    norm === v.short.toLowerCase() ||
    norm.includes(v.short.toLowerCase()) ||
    v.name.toLowerCase().includes(norm)
  );
}

/**
 * Loads pinned to a voyage: prefer `ferry.departureAt` calendar day;
 * fallback vessel match on ferry-adjacent corridor stages (many seeds omit dep).
 */
export function loadsOnVoyage(loads: readonly Load[], sailing: FerrySailing): Load[] {
  const day = sailingDayKey(sailing);
  const byDay = loads.filter((l) => l.ferry?.departureAt?.slice(0, 10) === day);
  if (byDay.length > 0) return byDay;

  return loads.filter((l) => {
    const dep = l.ferry?.departureAt?.slice(0, 10);
    // Explicit other-day booking must not fall into this voyage via vessel match.
    if (dep && dep !== day) return false;
    if (!vesselMatchesLoad(l.ferry?.vessel, sailing)) return false;
    return FERRY_ADJACENT_STAGES.has(l.stage) || FERRY_ADJACENT_STATUSES.has(l.status);
  });
}

export function voyageWaveWidgetLabel(sailing: FerrySailing): string {
  return `fala ${formatWaveM(seaForSailing(sailing).waveM)}`;
}

/** HHL cockpit banner — same focus voyage as Risks „Prom i Bałtyk”. */
export function cockpitFerryBanner(
  loads: readonly Load[],
  now = getNow(),
): { title: string; body: string; voyage: FerrySailing; loadCount: number } {
  const voyage = focusVoyage(now);
  const sea = seaForSailing(voyage);
  const day = formatVoyageDayLabel(voyage.depLocal);
  const vessel = vesselById(voyage.vessel);
  const onVoyage = loadsOnVoyage(loads, voyage);
  const n = onVoyage.length;
  const transporty =
    n === 1 ? '1 transport przypięty' : n < 5 ? `${n} transporty przypięte` : `${n} transportów przypiętych`;
  return {
    title: `Rejs ${day} zagrożony.`,
    body: `Prognoza fali ${formatWaveM(sea.waveM)} i porywy ${formatWindMs(sea.windMs)} w oknie odejścia (${vessel.name}). ${transporty} do tego rejsu. Panel alternatyw w zakładce Ryzyka.`,
    voyage,
    loadCount: n,
  };
}
