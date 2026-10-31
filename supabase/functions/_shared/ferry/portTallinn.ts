/**
 * BN2 — Port of Tallinn: odjazdy / przyjazdy (ts.ee).
 *
 * Źródła (HTML, bez klucza): https://www.ts.ee/en/departures/ oraz /en/arrivals/
 * Tabele #passenger-lines-outbound / #passenger-lines-inbound. Godziny lokalne
 * Europe/Tallinn. Odwołanie: tekst cancelled / odwoł / tühistatud w wierszu.
 * User-Agent uczciwy; awaria struktury → SOURCE_DOWN:PORT_TALLINN.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';

export const PORT_TALLINN_DEPARTURES_URL = 'https://www.ts.ee/en/departures/';
export const PORT_TALLINN_ARRIVALS_URL = 'https://www.ts.ee/en/arrivals/';
export const PORT_TALLINN_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const PORT_TALLINN_ATTRIBUTION = 'Rozkład / ruch: Port of Tallinn (ts.ee)';

const SHIP: Record<string, string> = {
  'viking xprs': 'M/F Viking XPRS',
  finlandia: 'M/F Finlandia',
  'finbo cargo': 'M/F Finbo Cargo',
  megastar: 'M/F Megastar',
  mystar: 'M/F MyStar',
  'victoria i': 'M/F Victoria I',
  victoria: 'M/F Victoria I',
  'baltic queen': 'M/F Baltic Queen',
  'sirena seaways': 'M/F Sirena Seaways',
  sirena: 'M/F Sirena Seaways',
};

/** Typowy czas przeprawy (min) gdy strona podaje tylko jedną stronę (odjazd albo przyjazd). */
const CROSSING_MIN: Record<string, number> = {
  'TLL-HEL': 120, 'HEL-TLL': 120, 'TLLA-HEL': 120, 'HELA-TLL': 120,
  'MUU-VUO': 150, 'VUO-MUU': 150,
  'TLL-STO': 960, 'STO-TLL': 960,
  'PLD-KPS': 570, 'KPS-PLD': 570,
};

export interface PortTallinnEvent {
  kind: 'DEPARTURE' | 'ARRIVAL';
  route: FerryRoute;
  vessel: string;
  terminal: string;
  /** Planowana godzina zdarzenia (UTC). */
  atUtc: string;
  /** Druga strona rejsu (UTC) — szacunek z typowego czasu przeprawy. */
  otherUtc: string;
  cancelled: boolean;
  company: string;
  /** BN3: kolumna Lisainfo / Additional info (odwołanie, opóźnienie). */
  lisainfo: string | null;
}

export interface PortTallinnParseResult {
  events: PortTallinnEvent[];
  warnings: string[];
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function mapShip(raw: string): string | null {
  const n = raw.trim().toLowerCase().replace(/^m\/?s\s+/i, '').replace(/^m\/f\s+/i, '');
  return SHIP[n] ?? null;
}

function terminalLetter(raw: string, dataTerminal: string): string {
  const t = `${raw} ${dataTerminal}`.toUpperCase();
  if (/\bHHLA\b|MUUGA/.test(t)) return 'HHLA';
  if (/\bPALDISKI\b|PLD/.test(t)) return 'PLD';
  const m = t.match(/\bTERMINAL\s*([AD])\b/) ?? t.match(/\b([AD])\b/);
  return m ? m[1]! : (dataTerminal || '?').toUpperCase();
}

function routeFor(
  kind: 'DEPARTURE' | 'ARRIVAL',
  fromRaw: string,
  toRaw: string,
  terminal: string,
): FerryRoute | null {
  const from = fromRaw.toLowerCase();
  const to = toRaw.toLowerCase();
  const hel = (s: string) => /helsinki|helsingi|helsingfors/.test(s);
  const tll = (s: string) => /tallinn|tallinna|vanasadam/.test(s);
  const muu = (s: string) => /muuga/.test(s);
  const vuo = (s: string) => /vuosaari/.test(s);
  const sto = (s: string) => /stockholm|sztokholm|värta|varta/.test(s);
  const pld = (s: string) => /paldiski/.test(s);
  const kps = (s: string) => /kapellsk/.test(s);
  const termA = terminal === 'A';

  if (kind === 'DEPARTURE') {
    if ((tll(from) || from === '') && hel(to)) return termA ? 'TLLA-HEL' : 'TLL-HEL';
    if (hel(from) && tll(to)) return termA ? 'HELA-TLL' : 'HEL-TLL';
    if (muu(from) && vuo(to)) return 'MUU-VUO';
    if (vuo(from) && muu(to)) return 'VUO-MUU';
    if (tll(from) && sto(to)) return 'TLL-STO';
    if (sto(from) && tll(to)) return 'STO-TLL';
    if (pld(from) && kps(to)) return 'PLD-KPS';
    if (kps(from) && pld(to)) return 'KPS-PLD';
    // Strona outbound: „Departing from Tallinn/Muuga”, destination Helsinki/…
    if (hel(to) && (tll(from) || muu(from) || from.includes('tallinn') || terminal === 'A' || terminal === 'D' || terminal === 'HHLA')) {
      if (muu(from) || terminal === 'HHLA') return 'MUU-VUO';
      return termA ? 'TLLA-HEL' : 'TLL-HEL';
    }
    if (sto(to)) return 'TLL-STO';
    if (kps(to) || /kapell/.test(to)) return 'PLD-KPS';
    if (vuo(to)) return 'MUU-VUO';
  } else {
    // Przyjazd do Tallinna / Muuga — „Departing from” = port wyjścia, Destination = Tallinn
    if (hel(from) && (tll(to) || to === '')) return termA ? 'HELA-TLL' : 'HEL-TLL';
    if (vuo(from) && (muu(to) || to === '')) return 'VUO-MUU';
    if (sto(from) && (tll(to) || to === '')) return 'STO-TLL';
    if (kps(from) && (pld(to) || to === '')) return 'KPS-PLD';
    if (hel(from)) return termA ? 'HELA-TLL' : 'HEL-TLL';
    if (vuo(from)) return 'VUO-MUU';
    if (sto(from)) return 'STO-TLL';
  }
  return null;
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function parseTable(
  html: string,
  tableId: string,
  kind: 'DEPARTURE' | 'ARRIVAL',
  dateYmd: string,
  warnings: string[],
): PortTallinnEvent[] {
  const tableRe = new RegExp(`<table[^>]*\\bid="${tableId}"[^>]*>([\\s\\S]*?)</table>`, 'i');
  const tm = html.match(tableRe);
  if (!tm) {
    warnings.push(`Port of Tallinn: brak tabeli ${tableId} — struktura zmieniona.`);
    return [];
  }
  const rows = [...tm[1]!.matchAll(/<tr\s+([^>]*)>([\s\S]*?)<\/tr>/gi)];
  const events: PortTallinnEvent[] = [];
  let dataRows = 0;
  for (const row of rows) {
    const attrs = row[1] ?? '';
    const body = row[2] ?? '';
    if (!/data-terminal=/i.test(attrs)) continue;
    dataRows += 1;
    const dataTerminal = (attrs.match(/data-terminal="([^"]*)"/i)?.[1] ?? '').trim();
    const tds = [...body.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (tds.length < 5) {
      warnings.push(`Port of Tallinn (${kind}): nieczytelny wiersz.`);
      continue;
    }
    const cellVal = (i: number): string => {
      const td = tds[i];
      if (!td) return '';
      const sort = (td[1] ?? '').match(/data-sort_value="([^"]*)"/i)?.[1];
      if (sort != null && sort.trim() !== '') return sort.trim();
      return stripTags(td[2] ?? '');
    };
    const timeRaw = cellVal(0);
    const timeM = timeRaw.match(/(\d{1,2}):(\d{2})/);
    if (!timeM) {
      warnings.push(`Port of Tallinn (${kind}): brak godziny „${timeRaw}”.`);
      continue;
    }
    const hhmm = `${timeM[1]!.padStart(2, '0')}:${timeM[2]}`;
    const vessel = mapShip(cellVal(1));
    if (!vessel) continue; // inne statki — pomijamy bez awarii
    const fromRaw = cellVal(2);
    const toRaw = cellVal(3);
    const terminal = terminalLetter(cellVal(4), dataTerminal);
    const company = cellVal(5);
    // BN3: Lisainfo (kolumna Additional info) — jawna treść odwołania / opóźnienia.
    const lisainfoRaw = tds.length >= 7 ? stripTags(tds[6]?.[2] ?? '') : '';
    const lisainfo = lisainfoRaw && !/^Lisainfo$/i.test(lisainfoRaw) && !/^Additional info$/i.test(lisainfoRaw)
      ? lisainfoRaw.slice(0, 400)
      : null;
    const cancelBlob = `${body} ${lisainfo ?? ''}`;
    const cancelled = /cancelled|canceled|odwo[lł]|tühistatud|tühistamine/i.test(cancelBlob);
    const route = routeFor(kind, fromRaw, toRaw, terminal);
    if (!route) {
      warnings.push(`Port of Tallinn: nieznana trasa ${fromRaw}→${toRaw} (${vessel}).`);
      continue;
    }
    const atUtc = localToUtc(dateYmd, hhmm, 0, 'Europe/Tallinn');
    const cross = CROSSING_MIN[route] ?? 120;
    const otherUtc = kind === 'DEPARTURE'
      ? addMinutesIso(atUtc, cross)
      : addMinutesIso(atUtc, -cross);
    events.push({
      kind, route, vessel, terminal, atUtc, otherUtc, cancelled, company, lisainfo,
    });
  }
  if (dataRows === 0) {
    warnings.push(`Port of Tallinn: tabela ${tableId} bez wierszy danych.`);
  }
  return events;
}

/**
 * Parser HTML Port of Tallinn. `dateYmd` = dzień lokalny tablicy (zwykle dziś w Europe/Tallinn).
 */
export function parsePortTallinnHtml(
  html: string,
  dateYmd: string,
): PortTallinnParseResult {
  const warnings: string[] = [];
  if (!html || typeof html !== 'string' || html.length < 40) {
    warnings.push('Struktura Port of Tallinn zmieniona: pusta odpowiedź HTML.');
    return { events: [], warnings };
  }
  const events = [
    ...parseTable(html, 'passenger-lines-outbound', 'DEPARTURE', dateYmd, warnings),
    ...parseTable(html, 'passenger-lines-inbound', 'ARRIVAL', dateYmd, warnings),
  ];
  const structFail = warnings.some((w) => /brak tabeli|pusta odpowiedź/i.test(w));
  if (structFail && events.length === 0) {
    return { events, warnings };
  }
  return { events, warnings };
}

/** @deprecated F7 #660 r2: Port of Tallinn nie tworzy rozkładu (CROSSING_MIN = zmyślony czas). Zostaje dla testów parsera. */
export function portTallinnToSailings(events: PortTallinnEvent[]): Array<{
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
  company: string;
}> {
  const out: Array<{
    route: FerryRoute; vessel: string; departureUtc: string; arrivalUtc: string; company: string;
  }> = [];
  for (const e of events) {
    if (e.cancelled) continue;
    if (e.kind === 'DEPARTURE') {
      out.push({
        route: e.route, vessel: e.vessel, company: e.company,
        departureUtc: e.atUtc, arrivalUtc: e.otherUtc,
      });
    } else {
      out.push({
        route: e.route, vessel: e.vessel, company: e.company,
        departureUtc: e.otherUtc, arrivalUtc: e.atUtc,
      });
    }
  }
  return out;
}
