/**
 * BN2 — rozkład tygodniowy (dzień tygodnia + godzina lokalna) → lista dat.
 * Wspólne dla Viking / Eckerö / DFDS (HTML).
 */
import { localToUtc } from './polferries.ts';

const DOW_FULL = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Skróty EN jak w tabelach armatorów (Mon, Tue…, Every Day). */
export function parseDaySpec(raw: string): Set<number> | null {
  const s = raw
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
  if (!s) return null;
  if (/^every\s*day$|^daily$/.test(s)) {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }
  const out = new Set<number>();
  const parts = s.split(/[,&]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.match(
      /^(sun|mon|tue|wed|thu|fri|sat)(?:day)?\s*-\s*(sun|mon|tue|wed|thu|fri|sat)(?:day)?$/,
    );
    if (range) {
      const a = DOW_FULL.indexOf(range[1] as typeof DOW_FULL[number]);
      const b = DOW_FULL.indexOf(range[2] as typeof DOW_FULL[number]);
      if (a < 0 || b < 0) return null;
      let i = a;
      for (let n = 0; n < 7; n++) {
        out.add(i);
        if (i === b) break;
        i = (i + 1) % 7;
      }
      continue;
    }
    const one = part.match(/^(sun|mon|tue|wed|thu|fri|sat)(?:day)?$/);
    if (one) {
      out.add(DOW_FULL.indexOf(one[1] as typeof DOW_FULL[number]));
      continue;
    }
    return null;
  }
  return out.size ? out : null;
}

/** Dzień tygodnia w TZ (0=nd … 6=sb). */
export function weekdayInTz(ymd: string, tz: string): number {
  const noon = localToUtc(ymd, '12:00', 0, tz);
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(new Date(noon))
    .slice(0, 3)
    .toLowerCase();
  const idx = DOW_FULL.indexOf(name as typeof DOW_FULL[number]);
  return idx >= 0 ? idx : 0;
}

/** +n dni kalendarzowych do YYYY-MM-DD (bez strefy — data cywilna). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

export function dateRangeFromYmd(fromYmd: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(addDaysYmd(fromYmd, i));
  return out;
}

export function ymdInTz(now: Date, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** HH.MM / HH:MM → HH:MM; `nextDay` gdy `*` w tekście. */
export function parseLocalTime(raw: string): { hm: string; nextDay: boolean } | null {
  const t = raw.replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t === '—' || t === '-') return null;
  const nextDay = /\*/.test(t);
  const m = t.match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  return { hm: `${m[1]!.padStart(2, '0')}:${m[2]!}`, nextDay };
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
