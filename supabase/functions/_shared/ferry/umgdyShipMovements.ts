/**
 * BN3 — Urząd Morski w Gdyni: statki spodziewane / w porcie / wychodzące (HTML).
 * Zapasowe ETA/ATA/ETD dla Gdynia–Karlskrona (Stena Spirit / Estelle / Ebba).
 *
 * https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/
 * Tylko sekcja „Port Gdynia” (Gdańsk pomijany). User-Agent uczciwy; bez klucza.
 */
import { localToUtc } from './polferries.ts';
import { STENA_FERRIES } from './stenaAis.ts';

export const UMG_EXPECTED_URL =
  'https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/statki-spodziewane/';
export const UMG_IN_PORT_URL =
  'https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/statki-w-porcie/';
export const UMG_OUTGOING_URL =
  'https://www.umgdy.gov.pl/bezpieczenstwo-morskie/ruch-statkow/statki-wychodzace/';
export const UMG_UA = 'Watch Tower (https://tower.log-mar.pl; ferry backup Stena Gdynia)';
export const UMG_ATTRIBUTION = 'Ruch statków: Urząd Morski w Gdyni (umgdy.gov.pl)';

const STENA_BY_IMO = new Map(STENA_FERRIES.map((v) => [v.imo, v.name]));
const STENA_BY_NAME: Record<string, string> = {
  'stena spirit': 'M/F Stena Spirit',
  'stena estelle': 'M/F Stena Estelle',
  'stena ebba': 'M/F Stena Ebba',
};

export type UmgKind = 'ETA' | 'ATA' | 'ETD';

export interface UmgShipRow {
  kind: UmgKind;
  callId: string;
  vessel: string;
  imo: number | null;
  /** Czas zdarzenia w UTC. */
  atUtc: string;
  /**
   * Surowy tekst z ostatniej kolumny: nabrzeże (w porcie),
   * poprzedni port (spodziewane / wychodzące — na stronie „wychodzące” nagłówek to „Poprzedni port”).
   */
  note: string | null;
}

export interface UmgParseResult {
  rows: UmgShipRow[];
  warnings: string[];
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Wycinek HTML sekcji Port Gdynia (do następnego h2 albo końca). */
export function extractPortGdyniaHtml(html: string): string | null {
  const m = html.match(/<h2[^>]*>\s*Port\s+Gdynia\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  return m ? m[1]! : null;
}

/** ISO z offsetem albo „DD.MM.RRRR HH:MM:SS” (Europe/Warsaw). */
export function parseUmgLocalTime(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
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

export function isKarlskronaNote(note: string | null | undefined): boolean {
  return /karlskrona|karlskron/i.test(note ?? '');
}

/**
 * Parser desktopowej tabeli `table-striped` w sekcji Port Gdynia.
 * Kolumny: Call ID | Nazwa | IMO | Agent | czas | port/nabrzeże.
 */
export function parseUmgdyGdyniaHtml(html: string, kind: UmgKind): UmgParseResult {
  const warnings: string[] = [];
  const rows: UmgShipRow[] = [];
  const section = extractPortGdyniaHtml(html);
  if (!section) {
    warnings.push('Struktura UMG zmieniona: brak sekcji Port Gdynia.');
    return { rows, warnings };
  }
  const table = section.match(
    /<table[^>]*class="[^"]*table-striped[^"]*"[^>]*>[\s\S]*?<\/table>/i,
  );
  if (!table) {
    warnings.push('Struktura UMG zmieniona: brak tabeli desktopowej Port Gdynia.');
    return { rows, warnings };
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
    const vessel = mapStenaVessel(cells[1]!, cells[2] ?? '');
    if (!vessel) continue;
    const atUtc = parseUmgLocalTime(cells[4]!);
    if (!atUtc) {
      warnings.push(`UMG ${kind}: nieczytelny czas „${cells[4]}” (${vessel}).`);
      continue;
    }
    const imoN = Number((cells[2] ?? '').replace(/\D/g, ''));
    rows.push({
      kind,
      callId: cells[0]!,
      vessel,
      imo: Number.isFinite(imoN) && imoN > 0 ? imoN : null,
      atUtc,
      note: cells[5]?.trim() || null,
    });
  }
  if (!hasHeader) {
    warnings.push('Struktura UMG zmieniona: brak nagłówków kolumn Port Gdynia.');
  }
  if (dataRows === 0) {
    warnings.push('UMG Port Gdynia: pusta tabela (brak wierszy).');
  }
  return { rows, warnings };
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
