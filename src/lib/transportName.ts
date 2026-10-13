/**
 * E41 (P2) — jedyna funkcja nazwy transportu.
 * HHL: „SG-03 · 0005/09/S/2026”, SCX: kod · numer SCX, KSH: sam kod.
 * Brak numeru w harmonogramie i nagłówku panelu: „SG-07 brak nr HHL” / „brak nr SCX”.
 * Separator nazwy to „ · ” (U+00B7). Tytuł sprawy po nazwie oddziela „ — ”.
 */
export type TransportParty = 'HHL' | 'SCX' | 'KSH';
export type TransportPlace = 'plain' | 'schedule' | 'panel';

export interface TransportNameInput {
  code: string;
  hhlOrderNo?: string | null;
  carrierOrderNo?: string | null;
}

const SEP = ' \u00B7 ';

function filled(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

export function transportLabel(
  load: TransportNameInput,
  party: TransportParty,
  place: TransportPlace = 'plain',
): string {
  const code = (load.code ?? '').trim();
  if (party === 'KSH') return code;
  const num = party === 'HHL' ? filled(load.hhlOrderNo) : filled(load.carrierOrderNo);
  if (num) return `${code}${SEP}${num}`;
  if (place === 'schedule' || place === 'panel') {
    return party === 'HHL' ? `${code} brak nr HHL` : `${code} brak nr SCX`;
  }
  return code;
}

/** SMS do Śremu i Boden: sam kod, bez „·” (E41 pkt 5, E42). */
export function transportSmsCode(load: Pick<TransportNameInput, 'code'>): string {
  return (load.code ?? '').trim();
}

/** Zdejmuje z tytułu stary przedrostek (kod, numer, 8 znaków), żeby nie dublować nazwy. */
export function stripTransportPrefix(text: string, code?: string | null): string {
  let t = (text ?? '').trim();
  t = t.replace(/^[0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\s*[:·—–-]\s*/i, '');
  t = t.replace(/^\d{4,6}\/\d{4}\/[A-Za-z0-9/]+\s*[:·—–-]\s*/, '');
  if (code) {
    const bare = code.trim();
    if (bare) {
      const esc = bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(`^${esc}(?:\\s*\u00B7\\s*\\S+)?\\s*[:·—–-]\\s*`), '');
    }
  }
  return t.trim();
}

/** „nazwa — co się stało” (E41). */
export function transportCaseTitle(load: TransportNameInput, party: TransportParty, what: string): string {
  const name = transportLabel(load, party, 'plain');
  const rest = stripTransportPrefix(what, load.code);
  return rest ? `${name} — ${rest}` : name;
}

/** Wyszukiwanie: HHL kod + oba numery, SCX kod + swój i HHL, KSH tylko kod. Nigdy numer z pliku KSH. */
export function transportSearchBlob(
  load: TransportNameInput & { orderNo?: string | null },
  party: TransportParty,
): string {
  const parts = [load.code];
  if (party === 'HHL' || party === 'SCX') {
    const hhl = filled(load.hhlOrderNo);
    const scx = filled(load.carrierOrderNo);
    if (hhl) parts.push(hhl);
    if (scx) parts.push(scx);
  }
  return parts.join(' ').toLowerCase();
}
