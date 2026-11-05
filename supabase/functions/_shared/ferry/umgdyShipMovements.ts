/**
 * BN3 / DP-222 — Urząd Morski w Gdyni: statki spodziewane / w porcie / wychodzące (HTML).
 * Zapasowe ETA/ATA/ETD:
 *   - Port Gdynia → Stena GDY↔KAA (BN3);
 *   - Gdańsk Nowy Port → Polferries GDN↔NYN (DP-222 #814: Digitraffic bez Zatoki,
 *     AISSTREAM rzadko daje parę geofence ≤20 min → ATD z AIS pada BEZ_PRZEJSCIA).
 *
 * https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/
 * User-Agent uczciwy; bez klucza.
 */
import { localToUtc } from './polferries.ts';
import { POLFERRIES, STENA_FERRIES } from './stenaAis.ts';

export const UMG_EXPECTED_URL =
  'https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/statki-spodziewane/';
export const UMG_IN_PORT_URL =
  'https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/statki-w-porcie/';
export const UMG_OUTGOING_URL =
  'https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/statki-wychodzace/';
export const UMG_UA = 'Watch Tower (https://tower.log-mar.pl; ferry backup UMG Gdynia/Gdansk)';
export const UMG_ATTRIBUTION = 'Ruch statków: Urząd Morski w Gdyni (umgdy.gov.pl)';

const STENA_BY_IMO = new Map(STENA_FERRIES.map((v) => [v.imo, v.name]));
const STENA_BY_NAME: Record<string, string> = {
  'stena spirit': 'M/F Stena Spirit',
  'stena estelle': 'M/F Stena Estelle',
  'stena ebba': 'M/F Stena Ebba',
};

const POL_BY_IMO = new Map(POLFERRIES.map((v) => [v.imo, v.name]));
const POL_BY_NAME: Record<string, string> = {
  wawel: 'M/F Wawel',
  'nova star': 'M/F Nova Star',
};

export type UmgKind = 'ETA' | 'ATA' | 'ETD';

export interface UmgShipRow {
  kind: UmgKind;
  callId: string;
  vessel: string;
  imo: number | null;
  /**
   * Czas zdarzenia w UTC.
   * DP-124: na liście „w porcie” UMG bywa pusta kolumna ATA — wtedy `null`
   * (obecność w porcie bez godziny; nie wolno zapisać jako actual_arrival).
   */
  atUtc: string | null;
  /**
   * Surowy tekst z ostatniej kolumny: nabrzeże (w porcie),
   * poprzedni port (spodziewane / wychodzące — na stronie „wychodzące” nagłówek to „Poprzedni port”).
   */
  note: string | null;
}

export interface UmgParseResult {
  rows: UmgShipRow[];
  warnings: string[];
  /** DP-124 / F7 #796: puste komórki czasu (wszystkie rodzaje) — bez ostrzeżenia. */
  emptyTime: number;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Wycinek HTML sekcji Port Gdynia (do następnego h2 albo końca). */
export function extractPortGdyniaHtml(html: string): string | null {
  const m = html.match(/<h2[^>]*>\s*Port\s+Gdynia\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  return m ? m[1]! : null;
}

/**
 * DP-222: terminal Polferries Westerplatte = sekcja „Gdańsk Nowy Port”
 * (nie „Port Gdańsk” / Port Północny).
 */
export function extractGdanskNowyPortHtml(html: string): string | null {
  const m = html.match(
    /<h2[^>]*>\s*Gda[nń]sk\s+Nowy\s+Port\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i,
  );
  return m ? m[1]! : null;
}

/** DP-124: pusta / placeholder godzina UMG (nie ATA/ETD/ETA). */
export function isUmgTimeEmpty(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim();
  return !t || /^(?:[-–—.…]|n\/?a|brak)$/i.test(t);
}

/** DP-124: brak godziny — pusta komórka albo sama data DD.MM.RRRR. */
export function isUmgTimeAbsent(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim();
  return isUmgTimeEmpty(t) || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(t);
}

/** ISO z offsetem albo „DD.MM.RRRR HH:MM:SS” (Europe/Warsaw). */
export function parseUmgLocalTime(raw: string): string | null {
  const t = raw.trim();
  if (isUmgTimeEmpty(t)) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  /* Samo DD.MM.RRRR bez godziny = pusta godzina (DP-124), nie północ. */
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(t)) return null;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const dd = m[1]!.padStart(2, '0');
  const mm = m[2]!.padStart(2, '0');
  const yyyy = m[3]!;
  const hh = m[4]!.padStart(2, '0');
  const mi = m[5]!.padStart(2, '0');
  return localToUtc(`${yyyy}-${mm}-${dd}`, `${hh}:${mi}`, 0, 'Europe/Warsaw');
}

function mapStenaVessel(name: string, imoRaw: string): string | null {
  const imo = Number(imoRaw.replace(/\D/g, ''));
  if (Number.isFinite(imo) && STENA_BY_IMO.has(imo)) return STENA_BY_IMO.get(imo)!;
  const n = name.trim().toLowerCase().replace(/^m\/?s\s+/i, '').replace(/^m\/f\s+/i, '');
  return STENA_BY_NAME[n] ?? null;
}

export function mapPolferriesVessel(name: string, imoRaw: string): string | null {
  const imo = Number(imoRaw.replace(/\D/g, ''));
  if (Number.isFinite(imo) && POL_BY_IMO.has(imo)) return POL_BY_IMO.get(imo)!;
  const n = name.trim().toLowerCase().replace(/^m\/?s\s+/i, '').replace(/^m\/f\s+/i, '');
  return POL_BY_NAME[n] ?? null;
}

export function isKarlskronaNote(note: string | null | undefined): boolean {
  return /karlskrona|karlskron/i.test(note ?? '');
}

/** DP-222: linia GDN↔NYN — note „Poprzedni port” / kierunek Nynäshamn. */
export function isNynashamnNote(note: string | null | undefined): boolean {
  return /nyn[aä]shamn|nynashamn/i.test(note ?? '');
}

type VesselMapper = (name: string, imoRaw: string) => string | null;

function parseUmgSectionTable(
  section: string,
  kind: UmgKind,
  mapVessel: VesselMapper,
  sectionLabel: string,
): UmgParseResult {
  const warnings: string[] = [];
  const rows: UmgShipRow[] = [];
  let emptyTime = 0;
  const table = section.match(
    /<table[^>]*class="[^"]*table-striped[^"]*"[^>]*>[\s\S]*?<\/table>/i,
  );
  if (!table) {
    warnings.push(`Struktura UMG zmieniona: brak tabeli desktopowej ${sectionLabel}.`);
    return { rows, warnings, emptyTime };
  }
  /* F7 #695 r1 B3: <tr class=…> też; brak nagłówków / pusta tabela = awaria struktury. */
  const trs = [...table[0]!.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let dataRows = 0;
  let hasHeader = false;
  for (const tr of trs) {
    const cells = [...tr[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => stripTags(c[1]!));
    if (cells.length < 5) continue;
    if (/^call\s*id$/i.test(cells[0]!) || /nazwa\s*statku/i.test(cells[1] ?? '')) {
      hasHeader = true;
      continue;
    }
    dataRows += 1;
    const vessel = mapVessel(cells[1]!, cells[2] ?? '');
    if (!vessel) continue;
    const timeRaw = cells[4] ?? '';
    const atUtc = parseUmgLocalTime(timeRaw);
    const imoN = Number((cells[2] ?? '').replace(/\D/g, ''));
    const imo = Number.isFinite(imoN) && imoN > 0 ? imoN : null;
    const note = cells[5]?.trim() || null;
    /* DP-124 / F7 #796: pusty czas — bez ostrzeżenia (licznik); ATA = obecność w porcie. */
    if (!atUtc) {
      if (isUmgTimeAbsent(timeRaw)) {
        emptyTime += 1;
        if (kind === 'ATA') {
          rows.push({ kind, callId: cells[0]!, vessel, imo, atUtc: null, note });
        }
        continue;
      }
      warnings.push(`UMG ${kind}: nieczytelny czas „${timeRaw}” (${vessel}).`);
      continue;
    }
    rows.push({
      kind,
      callId: cells[0]!,
      vessel,
      imo,
      atUtc,
      note,
    });
  }
  if (!hasHeader) {
    warnings.push(`Struktura UMG zmieniona: brak nagłówków kolumn ${sectionLabel}.`);
  }
  if (dataRows === 0) {
    warnings.push(`UMG ${sectionLabel}: pusta tabela (brak wierszy).`);
  }
  return { rows, warnings, emptyTime };
}

/**
 * Parser desktopowej tabeli `table-striped` w sekcji Port Gdynia.
 * Kolumny: Call ID | Nazwa | IMO | Agent | czas | port/nabrzeże.
 */
export function parseUmgdyGdyniaHtml(html: string, kind: UmgKind): UmgParseResult {
  const section = extractPortGdyniaHtml(html);
  if (!section) {
    return {
      rows: [],
      warnings: ['Struktura UMG zmieniona: brak sekcji Port Gdynia.'],
      emptyTime: 0,
    };
  }
  return parseUmgSectionTable(section, kind, mapStenaVessel, 'Port Gdynia');
}

/** DP-222: Polferries w sekcji Gdańsk Nowy Port (ten sam układ kolumn). */
export function parseUmgdyGdanskNowyHtml(html: string, kind: UmgKind): UmgParseResult {
  const section = extractGdanskNowyPortHtml(html);
  if (!section) {
    return {
      rows: [],
      warnings: ['Struktura UMG zmieniona: brak sekcji Gdańsk Nowy Port.'],
      emptyTime: 0,
    };
  }
  return parseUmgSectionTable(section, kind, mapPolferriesVessel, 'Gdańsk Nowy Port');
}

/**
 * ETA/ETD: tylko gdy note wskazuje Karlskronę (linia GDY↔KAA).
 * ATA w porcie Gdynia: wszystkie Stena (nabrzeże ≠ poprzedni port).
 */
export function stenaUmgCandidates(rows: readonly UmgShipRow[]): UmgShipRow[] {
  return rows.filter((r) => {
    if (r.kind === 'ATA') return true;
    return isKarlskronaNote(r.note);
  });
}

/**
 * DP-222: ETA/ETD tylko z Nynäshamn (linia GDN↔NYN).
 * ATA w Nowym Porcie: wszystkie Polferries.
 */
export function polferriesUmgCandidates(rows: readonly UmgShipRow[]): UmgShipRow[] {
  return rows.filter((r) => {
    if (r.kind === 'ATA') return true;
    return isNynashamnNote(r.note);
  });
}
