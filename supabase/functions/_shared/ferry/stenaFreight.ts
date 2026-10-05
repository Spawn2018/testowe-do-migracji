/**
 * FERRY-STATUS — żywy rozkład Stena Line Freight (Gdynia ↔ Karlskrona).
 * Strona https://stenalinefreight.com/timetable/GDKA ładuje HTML przez
 * POST admin-ajax.php (action=timetable, routeCode=GDKA). Bez klucza.
 * Token „security” z ajax_object na tej samej stronie, świeży przed odczytem.
 * Godziny: odejście w strefie portu wyjścia, przyjazd w strefie portu wejścia.
 * Zapasem zostaje JSON AEM (stenalinetravel) — ten moduł jest źródłem głównym.
 */
import { localToUtc, type FerryStatus } from './polferries.ts';
import { type StenaSailing } from './stena.ts';

export const STENA_FREIGHT_PAGE = 'https://stenalinefreight.com/timetable/GDKA';
export const STENA_FREIGHT_AJAX = 'https://stenalinefreight.com/wp/wp-admin/admin-ajax.php';
export const STENA_FREIGHT_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';

const VESSEL: Record<string, string> = {
  'stena ebba': 'M/F Stena Ebba',
  'stena spirit': 'M/F Stena Spirit',
  'stena estelle': 'M/F Stena Estelle',
};

export interface FreightFetchPlan {
  from: string;
  to: string;
  routeCode: 'GDKA';
}

/** Dziś i 6 kolejnych dni (kalendarz UTC — wystarcza do okna zapytania). */
export function freightWindow(now: Date): FreightFetchPlan {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(d.getTime() + 6 * 864e5);
  return { from: d.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), routeCode: 'GDKA' };
}

export function freightSecurityToken(html: string): string | null {
  const m = html.match(/"security"\s*:\s*"([A-Za-z0-9]+)"/);
  return m?.[1] ?? null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function routeOfHeading(h: string): 'GDY-KAA' | 'KAA-GDY' | null {
  const t = h.toLowerCase();
  const g = t.indexOf('gdynia');
  const k = t.indexOf('karlskrona');
  if (g < 0 || k < 0) return null;
  return g < k ? 'GDY-KAA' : 'KAA-GDY';
}

function mapVessel(name: string): string | null {
  return VESSEL[name.trim().toLowerCase()] ?? null;
}

function mapRawStatus(raw: string, late: boolean): FerryStatus {
  const t = raw.trim().toLowerCase();
  if (/cancel|inställ|odwoł|odwol|anul/.test(t)) return 'ODWOLANY';
  if (/delay|opóźn|opozn|late/.test(t) || late) return 'OPOZNIONY';
  return 'ZAPLANOWANY';
}

function clock(cell: string): { planned: string | null; actual: string | null } {
  const strike = cell.match(/strikethrough">\s*(\d{1,2}:\d{2})/i);
  const hi = cell.match(/highlight">(?:&nbsp;|\s)*(\d{1,2}:\d{2})/i);
  const plain = stripTags(cell).match(/\d{1,2}:\d{2}/);
  const planned = strike?.[1] ?? (hi ? null : plain?.[0] ?? null);
  const actual = hi?.[1] ?? null;
  return { planned: planned ?? actual, actual: actual ?? planned };
}

function padTime(t: string): string {
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

function toUtc(date: string, time: string, dayOffset: number, tz: string): string {
  return localToUtc(date, padTime(time), dayOffset, tz);
}

/**
 * HTML z data.content (albo cała odpowiedź JSON { data: { content } }).
 * Zmiana układu → ostrzeżenie i pusta lista, nigdy cichy sukces.
 */
export function parseStenaFreightTimetable(input: string): { sailings: StenaSailing[]; warnings: string[] } {
  const warnings: string[] = [];
  let html = input;
  const trimmed = input.trim();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { success?: boolean; data?: { content?: string } };
      if (json.success === false || typeof json.data?.content !== 'string') {
        warnings.push('Struktura rozkładu Stena Freight zmieniona: brak data.content. Parser wymaga aktualizacji.');
        return { sailings: [], warnings };
      }
      html = json.data.content;
    } catch {
      warnings.push('Stena Freight: nieczytelny JSON odpowiedzi.');
      return { sailings: [], warnings };
    }
  }
  if (!/<h3/i.test(html) || !/Rtable-cell/i.test(html)) {
    warnings.push('Struktura rozkładu Stena Freight zmieniona: brak tabeli rejsów. Parser wymaga aktualizacji.');
    return { sailings: [], warnings };
  }
  const sailings: StenaSailing[] = [];
  const chunks = html.split(/<h3[^>]*>/i).slice(1);
  if (chunks.length < 2) {
    warnings.push('Struktura rozkładu Stena Freight zmieniona: oczekiwano obu kierunków.');
  }
  for (const chunk of chunks) {
    const headEnd = chunk.indexOf('</h3>');
    const heading = stripTags(headEnd >= 0 ? chunk.slice(0, headEnd) : chunk.slice(0, 80));
    const route = routeOfHeading(heading);
    if (!route) {
      warnings.push(`Stena Freight: nieznany nagłówek „${heading}”.`);
      continue;
    }
    const body = headEnd >= 0 ? chunk.slice(headEnd) : chunk;
    const depTz = route === 'GDY-KAA' ? 'Europe/Warsaw' : 'Europe/Stockholm';
    const arrTz = route === 'GDY-KAA' ? 'Europe/Stockholm' : 'Europe/Warsaw';
    const parts = body.split(/<span class="date"[^>]*>/i).slice(1);
    for (const part of parts) {
      const dm = part.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dm) continue;
      const date = dm[1];
      const cells = [...part.matchAll(/<div class="[^"]*Rtable-cell[^"]*">([\s\S]*?)<\/div>/gi)].map((m) => m[1]);
      if (cells.length % 4 !== 0) {
        warnings.push(`Stena Freight ${route} ${date}: liczba kolumn nie dzieli się na rejsy (${cells.length}).`);
      }
      for (let i = 0; i + 3 < cells.length; i += 4) {
        const depCell = clock(cells[i]);
        const arrCell = clock(cells[i + 1]);
        const vesselName = stripTags(cells[i + 2]);
        const rawStatus = stripTags(cells[i + 3]);
        const vessel = mapVessel(vesselName);
        if (!depCell.planned || !arrCell.planned) {
          warnings.push(`Stena Freight ${route} ${date}: brak godzin (${vesselName}).`);
          continue;
        }
        if (!vessel) {
          warnings.push(`Stena Freight ${route}: nieznany statek „${vesselName}”.`);
          continue;
        }
        const depMin = Number(padTime(depCell.planned).slice(0, 2)) * 60 + Number(padTime(depCell.planned).slice(3));
        const arrMin = Number(padTime(arrCell.planned).slice(0, 2)) * 60 + Number(padTime(arrCell.planned).slice(3));
        const arrOffset = arrMin <= depMin ? 1 : 0;
        let departureUtc: string;
        let arrivalUtc: string;
        let expectedDepartureUtc: string;
        let expectedArrivalUtc: string;
        try {
          departureUtc = toUtc(date, depCell.planned, 0, depTz);
          arrivalUtc = toUtc(date, arrCell.planned, arrOffset, arrTz);
          expectedDepartureUtc = toUtc(date, depCell.actual ?? depCell.planned, 0, depTz);
          const actArr = arrCell.actual ?? arrCell.planned;
          const actArrMin = Number(padTime(actArr).slice(0, 2)) * 60 + Number(padTime(actArr).slice(3));
          const expDepMin = Number(padTime(depCell.actual ?? depCell.planned).slice(0, 2)) * 60
            + Number(padTime(depCell.actual ?? depCell.planned).slice(3));
          expectedArrivalUtc = toUtc(date, actArr, actArrMin <= expDepMin ? 1 : 0, arrTz);
        } catch {
          warnings.push(`Stena Freight ${route}: nieparsowalne godziny ${date}.`);
          continue;
        }
        const late = Date.parse(expectedDepartureUtc) > Date.parse(departureUtc) + 60_000;
        const status = mapRawStatus(rawStatus, late);
        sailings.push({
          route,
          vessel,
          date,
          ferryCode: '',
          departureUtc,
          arrivalUtc,
          expectedDepartureUtc,
          expectedArrivalUtc,
          status,
          rawStatus: rawStatus || (late ? 'Delayed' : 'On time'),
        });
      }
    }
  }
  if (sailings.length === 0 && warnings.length === 0) {
    warnings.push('Stena Freight: pusta tabela rejsów.');
  }
  return { sailings, warnings };
}
