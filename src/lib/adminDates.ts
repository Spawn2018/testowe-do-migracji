/**
 * Decyzja właściciela 19.10.2026, 00:01 (D-20261019-0005-01): Administrator HHL zmienia każdą datę i godzinę w systemie,
 * w każdym miejscu, bez ograniczeń — także wstecz przed import, wcześniej niż poprzedni status i po załadunku.
 * KSH, SCX i Operacje HHL — zasady bez zmian (G-20, E25). Bazę dostosowuje wykonawca (§2 dopisku).
 */
import type { RoleId } from '../types';
import { accountRole } from './accountRole';
import { viewedKind } from './cockpitE9';

export function hhlAdminDates(role: RoleId): boolean {
  return role === 'HHL' && viewedKind(role, accountRole(role)) === 'HHL_ADMIN';
}
