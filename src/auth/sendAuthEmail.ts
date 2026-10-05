/**
 * Wysyłka linków Auth BEZ code_challenge PKCE — zaproszenie / reset muszą działać
 * w innej przeglądarce niż ta, która wywołała żądanie (admin zaprasza → zaproszony).
 * Klient aplikacji nadal ma flowType: 'pkce' (hasło / ta sama przeglądarka).
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

async function authPost(path: string, body: Record<string, unknown>, redirectTo?: string): Promise<{ error?: string }> {
  const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}${path}${q}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.ok) return {};
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json() as { msg?: string; error_description?: string; error?: string };
    msg = j.msg || j.error_description || j.error || msg;
  } catch { /* ignore */ }
  return { error: msg };
}

/** Magic/OTP invite (create user) — bez PKCE challenge. */
export function sendInviteMagicLink(email: string, redirectTo: string) {
  return authPost('/auth/v1/otp', {
    email,
    create_user: true,
    data: {},
    gotrue_meta_security: {},
  }, redirectTo);
}

/** Reset hasła — bez PKCE challenge (e-mail często otwierany na innym urządzeniu). */
export function sendRecoveryLink(email: string, redirectTo: string) {
  return authPost('/auth/v1/recover', {
    email,
    gotrue_meta_security: {},
  }, redirectTo);
}
