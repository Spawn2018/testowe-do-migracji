/**
 * wyglad/W-faktura-edycja — edycja faktury (decyzja właściciela 20.10.2026 01:13, D-20261020-0115-01).
 * Lustro zasad bazy (`update_invoice`, `guard_invoice_update`):
 * - SCX → HHL: do akceptacji przez HHL zmienia SCX (wystawca) i Administrator HHL; po akceptacji tylko Administrator HHL;
 * - HHL → KSH: do akceptacji przez KSH zmienia HHL (wystawca); po akceptacji tylko Administrator HHL;
 * - KSH nie zmienia żadnej faktury (tylko akceptuje albo zgłasza spór); Operacje HHL nie zmieniają faktury SCX.
 * „Edycja” = wszystkie dane faktury: numer, daty, termin, waluta, netto (VAT i brutto liczy system), PDF i pozycje.
 * Na produkcji przycisk jest dopiero po wdrożeniu `update_invoice` (`INVOICE_EDIT` w `serverRules.ts`).
 */
import { serverRuleOn } from './serverRules';
import type { Bill, BillVerification, RoleId } from '../types';

export const invoiceEditOn = (): boolean => serverRuleOn('INVOICE_EDIT');

const PROD = import.meta.env.VITE_AUTH_MODE === 'supabase';

/** Administrator HHL: konto `HHL_ADMIN`; w demo widok HHL bez wybranego konta „Operacje HHL”. */
export function isHhlAdmin(viewRole: RoleId, account: string | null, prod: boolean = PROD): boolean {
  if (viewRole !== 'HHL') return false;
  return account === 'HHL_ADMIN' || (!prod && account === null);
}

export type BillEditState = 'edit' | 'locked-accepted' | 'none';

/** Czy oglądający może zmienić treść faktury (i dlaczego nie). */
export function billEditState(
  viewRole: RoleId,
  account: string | null,
  b: Pick<Bill, 'issuer' | 'verification'>,
  prod: boolean = PROD,
): BillEditState {
  if (viewRole === 'KSH') return 'none';
  if (isHhlAdmin(viewRole, account, prod)) return 'edit';
  if (b.issuer !== viewRole) return 'none';
  return b.verification === 'ZAAKCEPTOWANA' ? 'locked-accepted' : 'edit';
}

/**
 * Weryfikacja po zmianie: poprawka Administratora HHL po akceptacji zostawia „Zaakceptowana”
 * (druga strona dostaje powiadomienie); każda inna zmiana wraca do „Do weryfikacji” — odbiorca sprawdza ponownie.
 */
export function verificationAfterEdit(prev: BillVerification, byAdmin: boolean): BillVerification {
  return prev === 'ZAAKCEPTOWANA' && byAdmin ? 'ZAAKCEPTOWANA' : 'DO_WERYFIKACJI';
}

/** Kto dostaje powiadomienie o zmianie: przy poprawce po akceptacji — strona inna niż HHL; inaczej odbiorca. */
export function editNotifyTarget(b: Pick<Bill, 'issuer' | 'recipient' | 'verification'>, byAdmin: boolean): RoleId {
  if (b.verification === 'ZAAKCEPTOWANA' && byAdmin) return b.issuer === 'HHL' ? b.recipient : b.issuer;
  return b.recipient;
}
