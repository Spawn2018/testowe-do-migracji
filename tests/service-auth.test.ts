import { describe, expect, it, vi } from 'vitest';
import { isServiceRequest, jwtRole } from '../supabase/functions/_shared/serviceAuth';

const b64u = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (role: string) => `${b64u({ alg: 'HS256' })}.${b64u({ role, iss: 'supabase' })}.podpis`;
const req = (auth?: string) => new Request('https://x/functions/v1/f', { method: 'POST', headers: auth ? { Authorization: auth } : {} });
const env = { url: 'https://proj.supabase.co', service: 'klucz-z-env' };

describe('F-KLUCZ isServiceRequest', () => {
  it('odczytuje rolę z JWT', () => {
    expect(jwtRole(jwt('service_role'))).toBe('service_role');
    expect(jwtRole(jwt('anon'))).toBe('anon');
    expect(jwtRole('nie-jwt')).toBeNull();
  });
  it('klucz równy kluczowi z env — bez zapytania', async () => {
    const f = vi.fn();
    expect(await isServiceRequest(req('Bearer klucz-z-env'), env, f as unknown as typeof fetch)).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
  it('brak nagłówka, anon, zwykły token — odrzucone bez zapytania', async () => {
    const f = vi.fn();
    for (const a of [undefined, 'Bearer ', `Bearer ${jwt('anon')}`, `Bearer ${jwt('authenticated')}`, 'Basic abc']) {
      expect(await isServiceRequest(req(a), env, f as unknown as typeof fetch)).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it('JWT service_role: decyduje PostgREST (200 → tak, 401 → nie)', async () => {
    const ok = vi.fn(async () => new Response('[]', { status: 200 }));
    const bad = vi.fn(async () => new Response('', { status: 401 }));
    const t = jwt('service_role');
    expect(await isServiceRequest(req(`Bearer ${t}`), env, ok as unknown as typeof fetch)).toBe(true);
    expect(ok).toHaveBeenCalledWith('https://proj.supabase.co/rest/v1/system_heartbeat?select=id&limit=1', { headers: { apikey: t, Authorization: `Bearer ${t}` } });
    expect(await isServiceRequest(req(`Bearer ${t}`), env, bad as unknown as typeof fetch)).toBe(false);
  });
  it('błąd sieci → odrzucone', async () => {
    const boom = vi.fn(async () => { throw new Error('sieć'); });
    expect(await isServiceRequest(req(`Bearer ${jwt('service_role')}`), env, boom as unknown as typeof fetch)).toBe(false);
  });
});
