/**
 * B-10c.1 — aktor w Historii / Statusie: „imię nazwisko // firma”.
 * Zdarzenia automatyczne: „System // Watch Tower”.
 */
import { getAuthProfile } from '../auth/profile';

const SYSTEM_ACTORS = new Set([
  'system',
  'import',
  'geofence-engine',
  'auto',
  'status_auto',
  'watch-tower',
  'watchtower',
]);

const ROLE_ORG: Record<string, string> = {
  HHL: 'HHL',
  KSH: 'KSH',
  SCX: 'SCX',
  DRIVER: 'kierowca',
  'driver-pwa': 'kierowca',
};

/** Etykieta aktora do wyświetlenia (Historia / Status). */
export function formatHistoryActor(actor: string | null | undefined): string {
  const raw = String(actor ?? '').trim();
  if (!raw || SYSTEM_ACTORS.has(raw.toLowerCase())) return 'System // Watch Tower';
  if (raw.includes('//')) {
    const [left, ...rest] = raw.split('//');
    return `${left.trim()} // ${rest.join('//').trim()}`;
  }
  const org = ROLE_ORG[raw];
  if (org) return `— // ${org}`;
  return raw;
}

/** Zapis nowego zdarzenia z zalogowanego profilu (lub System // Watch Tower). */
export function currentActorLabel(fallbackRole?: string): string {
  const p = getAuthProfile();
  if (p) {
    const name = (p.full_name ?? '').trim() || (p.email.split('@')[0] || '—');
    const firm = (p.org_name ?? '').trim() || p.org_code || '—';
    return `${name} // ${firm}`;
  }
  if (fallbackRole && ROLE_ORG[fallbackRole]) return `— // ${ROLE_ORG[fallbackRole]}`;
  if (fallbackRole) return formatHistoryActor(fallbackRole);
  return 'System // Watch Tower';
}
