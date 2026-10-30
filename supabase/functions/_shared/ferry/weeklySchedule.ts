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

const MONTH: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06',
  jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
};

export type YmdRange = { from: string; to: string };

/** Zakresy dat z nagłówków sezonowych (EN „Jan 6th 2026 - Dec 23rd 2026”, „01.09.2026–21.06.2027”).
 * F7 #668 r3: sortuj po pozycji w tekście (mieszane formaty EN / dd.mm.yyyy). */
export function parseSeasonRanges(raw: string): YmdRange[] {
  const text = stripTags(raw).replace(/\u00a0/g, ' ');
  const found: { from: string; to: string; pos: number }[] = [];
  const reEn =
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\s*[-–—]\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = reEn.exec(text)) != null) {
    const from = `${m[3]}-${MONTH[m[1]!.toLowerCase()]!}-${m[2]!.padStart(2, '0')}`;
    const to = `${m[6]}-${MONTH[m[4]!.toLowerCase()]!}-${m[5]!.padStart(2, '0')}`;
    found.push({ from, to, pos: m.index });
  }
  const reDot = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
  while ((m = reDot.exec(text)) != null) {
    found.push({
      from: `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`,
      to: `${m[6]}-${m[5]!.padStart(2, '0')}-${m[4]!.padStart(2, '0')}`,
      pos: m.index,
    });
  }
  found.sort((a, b) => a.pos - b.pos);
  return found.map(({ from, to }) => ({ from, to }));
}

/** F7 #668 r3: pusta lista = poza sezonem (false). „Bez sezonu” obsłuż jawnie u wołającego. */
export function ymdInRanges(ymd: string, ranges: YmdRange[]): boolean {
  if (ranges.length === 0) return false;
  return ranges.some((r) => ymd >= r.from && ymd <= r.to);
}
