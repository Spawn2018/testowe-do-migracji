/** ANEKS 4 PR1 — Cloudflare Worker (plan darmowy): cron co 6 h → keep_alive(); błąd → e-mail. */
import { run, type KeepAliveEnv } from './core';

export default {
  async scheduled(_event: unknown, env: KeepAliveEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(run(env).then((r) => console.log(JSON.stringify(r))));
  },
  // ręczne sprawdzenie (np. test symulowanego błędu po wdrożeniu): GET /?check=1
  async fetch(req: Request, env: KeepAliveEnv) {
    if (new URL(req.url).searchParams.get('check') !== '1') return new Response('TOWER keep-alive', { status: 200 });
    const r = await run(env);
    return new Response(JSON.stringify(r), { status: r.ok ? 200 : 503, headers: { 'Content-Type': 'application/json' } });
  },
};
