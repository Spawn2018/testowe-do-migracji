/**
 * wyglad/P10b-d — przykłady demo pierwszego wejścia (G-09: osoby zmyślone, jak „Przykład” na makiecie E37).
 * Wywoływane wyłącznie z `firstEntrySource.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { AccountKind } from './cockpitE9';
import type { InviteInfo } from './firstEntrySource';

const COMPANY: Record<AccountKind, string> = {
  HHL_ADMIN: 'H&H Logistics', HHL_OPS: 'H&H Logistics', CLIENT_USER: 'KSH', CARRIER_DISPATCH: 'Scandinavian Express', CARRIER_USER: 'Scandinavian Express',
};
const ACCOUNT: Record<AccountKind, string> = {
  HHL_ADMIN: 'Administrator', HHL_OPS: 'Operacje', CLIENT_USER: 'Użytkownik', CARRIER_DISPATCH: 'Dyspozytor', CARRIER_USER: 'Użytkownik',
};

export function demoInvite(kind: AccountKind): InviteInfo {
  return { inviter: 'Anna Wiśniewska', inviterCompany: 'H&H Logistics', person: 'Piotr Zieliński', company: COMPANY[kind], account: ACCOUNT[kind] };
}
