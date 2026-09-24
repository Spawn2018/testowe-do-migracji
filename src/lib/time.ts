/**
 * D8 — timezone policy (control tower PL→SE corridor)
 *
 * Storage: ISO-8601 instants with explicit offset or `Z` (never zone-less local).
 * Display:
 *   - Ops tower UI (clocks, schedule defaults, invoices, ferry widget): Europe/Warsaw
 *   - Loading / awizacja load window / planned load (KSH Śrem): Europe/Warsaw
 *   - Unloading / ETA Boden / planned deliver (Stegra Boden): Europe/Stockholm
 *
 * Never use String.slice on ISO for human-facing times (Z vs +02:00 look different).
 * Calendar days `YYYY-MM-DD` are civil dates — do not `Date.parse` as UTC midnight.
 */
export const TZ_OPS = 'Europe/Warsaw';
export const TZ_LOAD_PL = 'Europe/Warsaw';
export const TZ_UNLOAD_SE = 'Europe/Stockholm';

export type CorridorZone = typeof TZ_OPS | typeof TZ_LOAD_PL | typeof TZ_UNLOAD_SE;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function partsInZone(
  at: Date,
  timeZone: string,
): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute'), s: g('second') };
}

/** Offset of `timeZone` at instant `at`, as `+02:00` / `Z`. */
export function zoneOffsetIso(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    hour: '2-digit',
  }).formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  if (name === 'GMT' || name === 'UTC') return 'Z';
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 'Z';
  return `${m[1]}${pad(Number(m[2]))}:${pad(Number(m[3] ?? '0'))}`;
}

export function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const raw = String(iso).trim();
  if (!raw) return null;
  // Pure calendar day — do not treat as UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Format calendar `YYYY-MM-DD` as `dd.MM.yyyy` without UTC shifting. */
export function formatCalendarDay(day: string | null | undefined): string {
  if (!day) return '—';
  const m = String(day).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(day);
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatInZone(
  iso: string | null | undefined,
  timeZone: CorridorZone,
  opts?: { dateStyle?: 'short' | 'medium'; withTime?: boolean },
): string {
  if (!iso) return '—';
  const raw = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatCalendarDay(raw);

  const d = parseInstant(raw);
  if (!d) {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return formatCalendarDay(raw);
    return raw;
  }
  const withTime = opts?.withTime !== false;
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit' as const, minute: '2-digit' as const }
      : {}),
  }).format(d);
}

/** Ops tower / schedule default — Europe/Warsaw. */
export function formatOpsDateTime(iso: string | null | undefined): string {
  return formatInZone(iso, TZ_OPS, { withTime: true });
}

export function formatOpsDate(iso: string | null | undefined): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return formatCalendarDay(iso);
  return formatInZone(iso, TZ_OPS, { withTime: false });
}

/** Loading / load window — Śrem PL. */
export function formatLoadPl(iso: string | null | undefined): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return formatCalendarDay(iso);
  return formatInZone(iso, TZ_LOAD_PL, { withTime: true });
}

/** Unload / ETA Boden — Stockholm. */
export function formatUnloadSe(iso: string | null | undefined): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return formatCalendarDay(iso);
  return formatInZone(iso, TZ_UNLOAD_SE, { withTime: true });
}

export function formatEtaBoden(iso: string | null | undefined): string {
  return formatUnloadSe(iso);
}

/** Compact `dd.MM HH:mm` in zone — replaces unsafe `.slice(5,16)`. */
export function formatCompactInZone(
  iso: string | null | undefined,
  timeZone: CorridorZone,
): string {
  if (!iso) return '—';
  const d = parseInstant(iso);
  if (!d) {
    if (/^\d{4}-\d{2}-\d{2}/.test(String(iso))) {
      const day = formatCalendarDay(iso);
      return day === '—' ? '—' : day.slice(0, 5); // dd.MM
    }
    return '—';
  }
  const p = partsInZone(d, timeZone);
  return `${pad(p.d)}.${pad(p.mo)} ${pad(p.h)}:${pad(p.mi)}`;
}

export function formatEtaBodenCompact(iso: string | null | undefined): string {
  return formatCompactInZone(iso, TZ_UNLOAD_SE);
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm) in a zone. */
export function isoToDatetimeLocalValue(
  iso: string | null | undefined,
  timeZone: CorridorZone = TZ_OPS,
): string {
  if (!iso) return '';
  const d = parseInstant(iso);
  if (!d) {
    const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    return m ? `${m[1]}T${m[2]}` : '';
  }
  const p = partsInZone(d, timeZone);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/**
 * Interpret `datetime-local` wall clock as `timeZone` and emit ISO with that offset.
 * Replaces hardcoded `+02:00` (wrong in winter / wrong for SE if ever diverges).
 */
export function wallLocalToIso(
  local: string | null | undefined,
  timeZone: CorridorZone,
): string | null {
  if (!local) return null;
  const v = String(local).trim();
  if (!v) return null;
  if (v.includes('+') || v.endsWith('Z')) return v;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] ?? '0');
  const desiredAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = desiredAsUtc;
  for (let i = 0; i < 4; i++) {
    const wall = partsInZone(new Date(utc), timeZone);
    const wallAsUtc = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s);
    utc += desiredAsUtc - wallAsUtc;
  }
  const offset = zoneOffsetIso(new Date(utc), timeZone);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${pad(s)}${offset === 'Z' ? 'Z' : offset}`;
}

/** Noon on a calendar day in zone → epoch ms (for delay math vs ETA). */
export function calendarDayNoonMs(day: string, timeZone: CorridorZone): number | null {
  const m = String(day).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const iso = wallLocalToIso(`${m[1]}-${m[2]}-${m[3]}T12:00:00`, timeZone);
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function delayMinutesVsPlan(
  etaIso: string | null | undefined,
  plannedDeliverDay: string | null | undefined,
): number | null {
  if (!etaIso || !plannedDeliverDay) return null;
  const eta = parseInstant(etaIso);
  const plan = calendarDayNoonMs(plannedDeliverDay, TZ_UNLOAD_SE);
  if (!eta || plan == null) return null;
  if (eta.getTime() <= plan) return null;
  return Math.max(1, Math.round((eta.getTime() - plan) / 60_000));
}
