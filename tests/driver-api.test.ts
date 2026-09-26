import { describe, expect, it, vi } from 'vitest';
import { createDriverApi, isServerDriverToken, MILESTONE_EVENT, uploadDriverFile } from '../src/data/driverApi';

const TOKEN = 'wt_' + 'ab'.repeat(32);

describe('ANEKS 3 §2.3 — aplikacja kierowcy na tokenie (API bazy, bez Edge dla pozycji)', () => {
  it('rozpoznaje wyłącznie token z bazy (wt_ + 64 hex); tokeny demo nie pasują', () => {
    expect(isServerDriverToken(TOKEN)).toBe(true);
    expect(isServerDriverToken('demo-active')).toBe(false);
    expect(isServerDriverToken('wt_abc')).toBe(false);
    expect(isServerDriverToken(TOKEN.toUpperCase())).toBe(false);
  });

  it('pozycja → driver_post_position(token, transport, …) z nazwami parametrów bazy', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const api = createDriverApi({ rpc });
    await api.position(TOKEN, 'L', { lat: 54.1, lng: 18.2, at: '2026-09-26T10:00:00Z', accuracy: 12, speedKmh: 60, heading: 90 });
    expect(rpc).toHaveBeenCalledWith('driver_post_position', {
      p_token: TOKEN, p_load_id: 'L', p_lat: 54.1, p_lon: 18.2, p_ts: '2026-09-26T10:00:00Z',
      p_accuracy: 12, p_speed: 60, p_heading: 90,
    });
  });

  it('przyciski etapów → zamknięta lista zdarzeń bazy', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'x', error: null });
    const api = createDriverApi({ rpc });
    await api.milestone(TOKEN, 'L', 'UNLOADED', '2026-09-26T10:00:00Z');
    expect(rpc).toHaveBeenCalledWith('driver_post_event', expect.objectContaining({ p_event_type: 'MILESTONE_UNLOADED', p_load_id: 'L' }));
    expect(Object.values(MILESTONE_EVENT).sort()).toEqual(['DRIVER_ON_FERRY', 'DRIVER_PROBLEM', 'MILESTONE_LOADED', 'MILESTONE_UNLOADED']);
  });

  it('błąd bazy (np. token odwołany) przechodzi do interfejsu', async () => {
    const api = createDriverApi({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'Token kierowcy odwołany' } }) });
    await expect(api.instructions(TOKEN)).rejects.toThrow('Token kierowcy odwołany');
  });

  it('zdjęcie → funkcja Edge driver-photo (multipart: token, transport, kategoria, plik)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'doc-1' }), { status: 200 }));
    const out = await uploadDriverFile('https://x.supabase.co/', 'anon', TOKEN, 'L', 'CMR', new Blob(['a'], { type: 'image/jpeg' }), 'a.jpg', fetchImpl as unknown as typeof fetch);
    expect(out.id).toBe('doc-1');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x.supabase.co/functions/v1/driver-photo');
    const form = init.body as FormData;
    expect(form.get('token')).toBe(TOKEN);
    expect(form.get('load_id')).toBe('L');
    expect(form.get('category')).toBe('CMR');
    const bad = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Token kierowcy wygasł' }), { status: 403 }));
    await expect(uploadDriverFile('https://x', 'anon', TOKEN, 'L', 'POD', new Blob(['a']), 'a.pdf', bad as unknown as typeof fetch)).rejects.toThrow('wygasł');
  });
});
