/**
 * TOWER — parser strony „Komunikaty odnośnie kursowania promów" Polferries.
 *
 * Źródło: https://polferries.pl/faq/komunikaty-kursowania-promow.html
 *  - strona generowana po stronie serwera, bez publicznego API
 *  - robots.txt (sprawdzony 25.09.2026) blokuje wyłącznie /core/ i /manager/
 *  - brak zgody armatora na piśmie — patrz docs/handover/ZRODLA_DANYCH.md
 *  - operator od 30.03.2026 działa w ramach POLSCA Baltic Ferries
 *
 * ZASADY:
 *  1. Czysta funkcja parsująca. Pobieranie osobno, NIE częściej niż co 15 minut,
 *     z identyfikującym nagłówkiem User-Agent
 *  2. Wyłącznie trasy Gdańsk → Nynäshamn i Nynäshamn → Gdańsk
 *  3. Status nieznany → NIEZNANY i ostrzeżenie. NIGDY nie zgadujemy odwołania
 *     ani opóźnienia — na dzień budowy strona pokazywała tylko „Planowo",
 *     więc oznaczenia innych statusów nie są znane
 *  4. Zmiana struktury strony → ostrzeżenie, nigdy cicha pusta lista
 *  5. Godziny na stronie są lokalne; Gdańsk i Nynäshamn mają tę samą strefę
 */

export type FerryRoute = 'GDN-NYN' | 'NYN-GDN';
export type FerryStatus = 'ZAPLANOWANY' | 'OPOZNIONY' | 'ODWOLANY' | 'NIEZNANY';

export interface ParsedSailing {
  route: FerryRoute;
  vessel: string;                 // 'M/F Wawel', 'M/F Nova Star'
  date: string;                   // data odejścia, lokalnie, YYYY-MM-DD
  plannedDepartureUtc: string;
  plannedArrivalUtc: string;
  expectedDepartureUtc: string;   // z treści komunikatu; = planowana, gdy bez zmian
  expectedArrivalUtc: string;
  status: FerryStatus;
  rawStatusClass: string;
  rawBadge: string;
}

export interface ParseResult { sailings: ParsedSailing[]; warnings: string[] }

const TZ = 'Europe/Warsaw';
const ROUTES: Record<string, FerryRoute> = {
  'gdańsk - nynäshamn': 'GDN-NYN',
  'nynäshamn - gdańsk': 'NYN-GDN',
};

/* ---------- czas lokalny → UTC, bez bibliotek, poprawnie przy zmianie czasu ---------- */

function tzOffsetMinutes(utcMs: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs) / 60000;
}

export function localToUtc(date: string, time: string, dayOffset = 0, tz = TZ): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d + dayOffset, hh, mm);
  let utc = naive - tzOffsetMinutes(naive, tz) * 60000;
  utc = naive - tzOffsetMinutes(utc, tz) * 60000;   // druga iteracja — przełom czasu letniego
  return new Date(utc).toISOString();
}

/* ---------- odczyt bloku godzin: [odejście, przesunięcie dni, przyjście] ---------- */

function readTimes(block: string): { dep: string; arr: string; offset: number } | null {
  const hours = [...block.matchAll(/--time--hour">\s*(\d{1,2}:\d{2})\s*</g)].map((m) => m[1]);
  if (hours.length < 2) return null;
  const off = block.match(/--day-offset">\s*\+(\d+)/);
  return { dep: hours[0], arr: hours[1], offset: off ? Number(off[1]) : 0 };
}

function mapStatus(cls: string, badge: string, timesChanged: boolean): FerryStatus | null {
  const t = `${cls} ${badge}`.toLowerCase();
  if (/odwoł|anul|cancel/.test(t)) return 'ODWOLANY';
  if (/opóźn|opozn|delay|late/.test(t)) return 'OPOZNIONY';
  if ((cls === 'scheduled' || /^planowo$/i.test(badge.trim()))) return timesChanged ? 'OPOZNIONY' : 'ZAPLANOWANY';
  return null;
}

/* ---------- parser ---------- */

export function parsePolferriesStatus(html: string): ParseResult {
  const warnings: string[] = [];
  const sailings: ParsedSailing[] = [];

  const headers = [...html.matchAll(/class="[^"]*\bnavy-header\b[^"]*"[^>]*>\s*([^<]+?)\s*</g)]
    .map((m) => ({ text: m[1].replace(/\s+/g, ' ').trim(), at: m.index! }));
  if (headers.length === 0) {
    warnings.push('Struktura strony zmieniona: brak nagłówków tras (navy-header). Parser wymaga aktualizacji.');
    return { sailings, warnings };
  }

  headers.forEach((h, i) => {
    const route = ROUTES[h.text.toLowerCase()];
    if (!route) return;
    const section = html.slice(h.at, headers[i + 1]?.at ?? html.length);
    const starts = [...section.matchAll(/class="polferries--rejs--schedule-item polferries--rejs--status--([a-z0-9-]+)"/g)];
    if (starts.length === 0) {
      warnings.push(`Trasa ${route}: brak rejsów na stronie — możliwa zmiana struktury albo brak kursów.`);
      return;
    }
    starts.forEach((s, j) => {
      const item = section.slice(s.index!, starts[j + 1]?.index ?? section.length);
      const head = item.match(/--header--date">\s*(\d{4}-\d{2}-\d{2})\s+([^<]+?)\s*</);
      const badge = (item.match(/status-badge">\s*([^<]*?)\s*</)?.[1] ?? '').trim();
      const bodyAt = item.indexOf('--schedule-item--body');
      const planned = readTimes(bodyAt > 0 ? item.slice(0, bodyAt) : item);
      const expected = bodyAt > 0 ? readTimes(item.slice(bodyAt)) : null;
      if (!head || !planned) {
        warnings.push(`Trasa ${route}: nieczytelny wpis rejsu nr ${j + 1} — pominięty.`);
        return;
      }
      const exp = expected ?? planned;
      const changed = exp.dep !== planned.dep || exp.arr !== planned.arr || exp.offset !== planned.offset;
      const status = mapStatus(s[1], badge, changed);
      if (!status) {
        warnings.push(`Nieznany status rejsu ${head[1]} ${head[2]}: klasa „${s[1]}", odznaka „${badge}". Bez automatycznej zmiany — do weryfikacji przez HHL.`);
      }
      sailings.push({
        route, vessel: head[2].trim(), date: head[1],
        plannedDepartureUtc:  localToUtc(head[1], planned.dep),
        plannedArrivalUtc:    localToUtc(head[1], planned.arr, planned.offset),
        expectedDepartureUtc: localToUtc(head[1], exp.dep),
        expectedArrivalUtc:   localToUtc(head[1], exp.arr, exp.offset),
        status: status ?? 'NIEZNANY',
        rawStatusClass: s[1], rawBadge: badge,
      });
    });
  });

  if (!sailings.some((s) => s.route === 'GDN-NYN')) {
    warnings.push('Brak rejsów Gdańsk → Nynäshamn w odczycie. Sprawdź stronę ręcznie.');
  }
  return { sailings, warnings };
}

/** Pobranie strony — wywoływać z harmonogramu, nie częściej niż co 15 minut. */
export async function fetchPolferriesStatus(userAgent: string): Promise<ParseResult> {
  const res = await fetch('https://polferries.pl/faq/komunikaty-kursowania-promow.html', {
    headers: { 'User-Agent': userAgent, Accept: 'text/html' },
  });
  if (!res.ok) return { sailings: [], warnings: [`Polferries HTTP ${res.status}`] };
  return parsePolferriesStatus(await res.text());
}
