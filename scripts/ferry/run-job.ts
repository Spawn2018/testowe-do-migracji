/**
 * M12 — uruchomienie zadania integracji z Node na bazie testowej (ten sam kod co funkcja Edge:
 * supabase/functions/_shared/integrations). Klucz service role z .env.local — nigdy nie wypisywany.
 * Do czasu wdrożenia funkcji Edge (krok właściciela W-M12-1) to jest ręczna ścieżka HHL/operatora.
 *   npx tsx scripts/ferry/run-job.ts ferry-status        # komunikaty Polferries → sailings (co 15 min, nie częściej)
 *   npx tsx scripts/ferry/run-job.ts ferry-schedule      # rozkład cargo → sailings
 */
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { JOBS, runJob, type JobName } from '../../supabase/functions/_shared/integrations/jobs.ts';
import { supabaseStore } from '../../supabase/functions/_shared/integrations/store.ts';
// @ts-expect-error — moduł .mjs bez typów
import { loadEnvLocal } from '../auth/env.mjs';

const name = process.argv[2] as JobName;
if (!(name in JOBS)) { console.error(`Użycie: run-job.ts <${Object.keys(JOBS).join('|')}>`); process.exit(2); }
const env = loadEnvLocal() as Record<string, string>;
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }, realtime: { transport: WebSocket as unknown as never },
});
const res = await runJob(name, { store: supabaseStore(sb), fetch, env: { ...process.env, ...pick(env) }, now: () => new Date() });
console.log(JSON.stringify(res, null, 1));
process.exit(res.ok ? 0 : 1);

/** tylko klucze integracji (bez wypisywania) */
function pick(e: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const k of ['TRAFIKVERKET_API_KEY', 'TOMTOM_API_KEY', 'KPD_DATEX_URL', 'KPD_AUTH_HEADER']) if (e[k]) out[k] = e[k];
  return out;
}
