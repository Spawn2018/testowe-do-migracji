/**
 * wyglad/W-konta — rodzaj konta oglądającego w jednym miejscu.
 * Produkcja: rola z profilu (`getAuthProfile()?.role`) — bez zmian względem dotychczasowych wywołań.
 * Demo: `null` (konto domyślne firmy — jak dotąd) albo wybrany w menu konta drugi rodzaj konta tej samej firmy
 * (Operacje HHL, Użytkownik SCX), ale tylko gdy pasuje do firmy z „Podglądu”.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { getAuthProfile } from '../auth/profile';
import { demoAccountKind, type DemoAccountKind } from './demoAccount';
import type { RoleId } from '../types';

const DEMO_ORG: Record<DemoAccountKind, RoleId> = { HHL_OPS: 'HHL', CARRIER_USER: 'SCX' };

/** `role` — firma widoku (HHL / KSH / SCX, także z „Podglądu”). */
export function accountRole(role: RoleId): string | null {
  const p = getAuthProfile();
  if (p) return p.role;
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return null;
  const k = demoAccountKind();
  if (!k) return null;
  return DEMO_ORG[k] === role ? k : null;
}
