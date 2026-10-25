/**
 * #559 — ręczny wpis pozycji przez dyspozytora (auta bez telematyki, np. link udostępniania Google).
 * Parsuje wyłącznie tekst wklejony przez człowieka: współrzędne albo adres z Map Google.
 * Nie otwiera i nie pobiera żadnych stron.
 */
export interface ManualPos { lat: number; lon: number }

const NUM = '(-?\\d{1,3}(?:[.,]\\d+)?)';
const PAIR = new RegExp(`^\\s*${NUM}\\s*[,;\\s]\\s*${NUM}\\s*$`);
const AT = new RegExp(`@${NUM.replace('[.,]', '\\.')},${NUM.replace('[.,]', '\\.')}`);
const Q = /[?&](?:q|query|ll|destination)=(-?\d{1,3}(?:\.\d+)?)(?:,|%2C)(-?\d{1,3}(?:\.\d+)?)/i;
const BANG = /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/;

const num = (s: string): number => Number(s.replace(',', '.'));

function valid(lat: number, lon: number): ManualPos | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}

/** „54.4047, 18.6772”, „54,4047 18,6772” (przecinek dziesiętny tylko ze spacją jako separatorem), adres z @lat,lng / ?q=lat,lng / !3d…!4d… */
export function parseManualPosition(input: string): ManualPos | null {
  const s = (input ?? '').trim();
  if (!s || s.length > 2000) return null;
  /* Adres z Map: najpierw dokładna pozycja znacznika (!3d!4d), potem ?q=, na końcu środek widoku @ */
  for (const re of [BANG, Q, AT]) {
    const m = s.match(re);
    if (m) return valid(Number(m[1]), Number(m[2]));
  }
  /* przecinek dziesiętny: „54,4047 18,6772” — rozdziel po spacji */
  const sp = s.split(/\s+/);
  if (sp.length === 2 && /^-?\d{1,3},\d+$/.test(sp[0]) && /^-?\d{1,3},\d+$/.test(sp[1])) return valid(num(sp[0]), num(sp[1]));
  const m = s.match(PAIR);
  if (m && !(m[1].includes(',') || m[2].includes(','))) return valid(Number(m[1]), Number(m[2]));
  return null;
}

/** Czas pozycji: teraz albo cofnięty o N minut (0–1440). */
export function manualPositionTs(minutesAgo: number, now: Date = new Date()): string {
  const m = Math.min(1440, Math.max(0, Math.round(Number.isFinite(minutesAgo) ? minutesAgo : 0)));
  return new Date(now.getTime() - m * 60_000).toISOString();
}
