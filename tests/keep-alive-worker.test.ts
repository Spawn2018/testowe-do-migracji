import { describe, expect, it, vi } from 'vitest';
import { run } from '../workers/keep-alive/src/core';

const env = { SUPABASE_URL: 'https://prod.supabase.co/', SUPABASE_ANON_KEY: 'anon', ALERT_EMAIL: 'admin@hhl', RESEND_API_KEY: 're', MAIL_FROM: 'TOWER <t@x>' };
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('ANEKS 4 PR1 — Worker podtrzymania', () => {
  it('świeży znacznik → ok, bez e-maila; wywołanie keep_alive przez API bazy', async () => {
    const f = vi.fn().mockResolvedValue(ok({ ok: true, beat_at: new Date().toISOString(), beats: 5 }));
    const r = await run(env, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, alerted: false });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe('https://prod.supabase.co/rest/v1/rpc/keep_alive');
  });

  it('symulowany błąd (HTTP 503 / projekt uśpiony) → e-mail „baza produkcyjna nie odpowiada”', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ message: 'paused' }, 503))
      .mockResolvedValueOnce(ok({ id: 'mail' }));
    const r = await run(env, f as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, alerted: true });
    const [url, init] = f.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const mail = JSON.parse(String(init.body));
    expect(mail.subject).toBe('Watch Tower: baza produkcyjna nie odpowiada');
    expect(mail.to).toEqual(['admin@hhl']);
  });

  it('błąd sieci i nieświeży znacznik → e-mail', async () => {
    const f1 = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValueOnce(ok({}));
    expect((await run(env, f1 as unknown as typeof fetch)).alerted).toBe(true);
    const old = new Date(Date.now() - 8 * 3600_000).toISOString();
    const f2 = vi.fn().mockResolvedValueOnce(ok({ ok: true, beat_at: old })).mockResolvedValueOnce(ok({}));
    const r2 = await run(env, f2 as unknown as typeof fetch);
    expect(r2.ok).toBe(false);
    expect(r2.detail).toContain('nieświeży');
  });
});

describe('odp. właściciela §3c — klucz service_role nigdy poza Supabase', () => {
  it('Worker, aplikacja (src) i konfiguracja hostingu nie odwołują się do service_role', async () => {
    const { readdirSync, readFileSync, statSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const files = [...walk('workers'), ...walk('src'), ...['vercel.json', 'wrangler.toml'].filter((f) => existsSync(f))];
    const hits = files.filter((f) => /service[_-]?role/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
    expect(readFileSync('workers/keep-alive/src/core.ts', 'utf8')).toContain('SUPABASE_ANON_KEY');
  });
});
