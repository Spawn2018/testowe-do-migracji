/**
 * wyglad/P6-d — E37 „Komunikaty zdaniami” (raport audytu, E37 pkt 5; D-20261015-0300-01 P6 „Komunikaty”):
 * zamiast „Brak dostępu” zdanie, co się stało i co można zrobić.
 * - sprawa zamknięta: „Ta sprawa jest już zamknięta (wygasła 06.10).” + „Otwórz transport”;
 * - sprawa innej firmy: „Tę sprawę prowadzi SCX. Możesz ją tylko podejrzeć.”
 * Komunikat jedzie w tym samym polu co dziś (`accessMessage`, tekst): `closed|<RRRR-MM-DD>|<kod>` albo `firm|<HHL|KSH|SCX>`.
 * Inny tekst = „Brak dostępu” jak dotąd. Kiedy który komunikat — decyduje trasa i dane wykonawcy (dopisek P6-d).
 * Bez zapytań i zapisów.
 */
import type { OrgKind } from '../types';
import { formatListDateTime } from './format';

export type AccessNote =
  | { kind: 'denied' }
  | { kind: 'closed'; until: string | null; code: string | null }
  | { kind: 'firm'; org: OrgKind };

const ORGS: readonly OrgKind[] = ['HHL', 'KSH', 'SCX'];

/** Sprawa zamknięta (data wygaśnięcia albo zamknięcia, kod transportu do „Otwórz transport”). */
export function closedNote(until: string | null | undefined, code: string | null | undefined): string {
  return `closed|${(until ?? '').slice(0, 10)}|${code ?? ''}`;
}

/** Sprawę prowadzi inna firma — tylko podgląd. */
export function firmNote(org: OrgKind): string {
  return `firm|${org}`;
}

export function parseAccessNote(msg: string | null | undefined): AccessNote | null {
  if (!msg) return null;
  const [k, a = '', b = ''] = msg.split('|');
  if (k === 'closed') {
    return { kind: 'closed', until: /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : null, code: b.trim() || null };
  }
  if (k === 'firm' && (ORGS as readonly string[]).includes(a)) return { kind: 'firm', org: a as OrgKind };
  return { kind: 'denied' };
}

const TXT = {
  closed: 'Ta sprawa jest już zamknięta (wygasła {d}).',
  closedNoDate: 'Ta sprawa jest już zamknięta.',
  firm: 'Tę sprawę prowadzi {org}. Możesz ją tylko podejrzeć.',
  openLoad: 'Otwórz transport',
} as const;

/** Zdanie dla komunikatu; `null` — zostaje dzisiejsze „Brak dostępu”. */
export function accessNoteText(n: AccessNote): string | null {
  if (n.kind === 'closed') return n.until ? TXT.closed.replace('{d}', formatListDateTime(n.until)) : TXT.closedNoDate;
  if (n.kind === 'firm') return TXT.firm.replace('{org}', n.org);
  return null;
}

export const ACCESS_OPEN_LOAD = TXT.openLoad;
