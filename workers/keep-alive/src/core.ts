/**
 * ANEKS 4 PR1 — logika Workera podtrzymania (testowana w tests/keep-alive-worker.test.ts).
 * Wywołuje keep_alive() w bazie produkcyjnej przez API bazy (klucz publiczny anon) i sprawdza
 * odpowiedź; błąd → e-mail do administratora HHL przez Resend.
 */
export interface KeepAliveEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALERT_EMAIL: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
}

export interface BeatResult { ok: boolean; detail: string }

export async function beat(env: KeepAliveEnv, fetchImpl: typeof fetch = fetch): Promise<BeatResult> {
  try {
    const res = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/keep_alive`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_source: 'cf-worker' }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; beat_at?: string } | null;
    if (!res.ok || body?.ok !== true || !body.beat_at) return { ok: false, detail: `HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 300)}` };
    const ageMs = Date.now() - Date.parse(body.beat_at);
    if (!(ageMs < 7 * 3600_000)) return { ok: false, detail: `znacznik nieświeży: ${body.beat_at}` };
    return { ok: true, detail: body.beat_at };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function alert(env: KeepAliveEnv, detail: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.ALERT_EMAIL],
      subject: 'Watch Tower: baza produkcyjna nie odpowiada',
      text: `Podtrzymanie (Cloudflare Worker, co 6 h) nie zapisało znacznika w bazie produkcyjnej.\n\nSzczegóły: ${detail}\n\nSprawdź panel Supabase — uśpiony projekt przywraca się jednym kliknięciem (Restore project).`,
    }),
  });
  return res.ok;
}

export async function run(env: KeepAliveEnv, fetchImpl: typeof fetch = fetch): Promise<BeatResult & { alerted: boolean }> {
  const r = await beat(env, fetchImpl);
  if (r.ok) return { ...r, alerted: false };
  const alerted = await alert(env, r.detail, fetchImpl).catch(() => false);
  return { ...r, alerted };
}
