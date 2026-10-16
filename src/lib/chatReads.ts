/**
 * wyglad/P6-e — „Przeczytali” (kto i kiedy) pod wiadomością Czatu (E17, E19 okno „Przeczytali”, decyzja 15.10 03:12;
 * D-20261016-0250-01 Cz5, Cz11). Czyste obliczenia widoku z `LoadMessage.reads` i `visibleTo` — bez zapytań.
 */
import type { LoadMessage, OrgKind } from '../types';
import { plPlural } from './plPlural';

const NAME_TO_ORG: Record<string, OrgKind> = { 'H&H LOGISTICS': 'HHL', 'SCANDINAVIAN EXPRESS': 'SCX', KSH: 'KSH', HHL: 'HHL', SCX: 'SCX' };

export const orgOfRead = (o: string | undefined): OrgKind | null => (o ? NAME_TO_ORG[o.trim().toUpperCase()] ?? null : null);

export interface ChatReader { userId: string; name: string; org: OrgKind | null; at: string; me: boolean }

export interface ChatReadView {
  /** firmy, do których poszła wiadomość („HHL, SCX, KSH” albo „tylko HHL i SCX”) */
  audience: OrgKind[];
  /** osoby, które otworzyły Czat z tą wiadomością — od najwcześniejszej; bez autora (Cz4) */
  readers: ChatReader[];
  /** firmy odbiorców (bez firmy autora), w których nikt jeszcze nie otworzył */
  pending: OrgKind[];
}

const ALL: OrgKind[] = ['HHL', 'SCX', 'KSH'];

export function chatReadView(m: Pick<LoadMessage, 'org' | 'visibleTo' | 'reads'>, meId: string | null): ChatReadView {
  const audience = m.visibleTo === 'HHL_SCX' ? ALL.filter((o) => o !== 'KSH') : ALL;
  const readers = (m.reads ?? [])
    .filter((r) => Number.isFinite(Date.parse(r.at)))
    .map((r) => ({ userId: r.userId, name: (r.name ?? '').trim() || '—', org: orgOfRead(r.org), at: r.at, me: !!meId && r.userId === meId }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const pending = audience.filter((o) => o !== m.org && !readers.some((r) => r.org === o));
  return { audience, readers, pending };
}

/** „1 osoba”, „2 osoby”, „5 osób” */
export function peopleText(n: number): string {
  return `${n} ${plPlural(n, 'osoba', 'osoby', 'osób')}`;
}

/** „HHL”, „HHL i SCX”, „HHL, SCX i KSH” */
export function joinOrgsPl(list: readonly string[], and = ' i '): string {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')}${and}${list[list.length - 1]}`;
}
