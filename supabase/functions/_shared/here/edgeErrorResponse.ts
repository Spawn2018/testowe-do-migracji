/**
 * DP-57 / F7 #849 — odpowiedź Edge `here-roads` bez wycieku sekretów do przeglądarki.
 * Deno w catch często wstawia pełny URL (z `apiKey=…`) do `Error.message`.
 */
import { corsHeaders } from '../cors.ts';
import { maskHereApiKey } from '../e49/detourHere.ts';

export type HereRoadsPublicReason = 'slownik' | 'blad';

/** Stały kod dla klienta — nigdy surowy `e.message`. */
export function publicReasonFromCatch(e: unknown): HereRoadsPublicReason {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('here_road_legs') ? 'slownik' : 'blad';
}

export function edgeErrorPayload(e: unknown): { ok: false; reason: HereRoadsPublicReason } {
  return { ok: false, reason: publicReasonFromCatch(e) };
}

/** Log funkcji: szczegół po `apiKey=…` → `apiKey=***`. */
export function logEdgeError(e: unknown, event = 'here-roads'): void {
  const raw = e instanceof Error ? e.message : String(e);
  console.error(JSON.stringify({ event, err: maskHereApiKey(raw).slice(0, 500) }));
}

export function edgeErrorResponse(e: unknown, status = 502): Response {
  logEdgeError(e);
  return Response.json(edgeErrorPayload(e), { status, headers: corsHeaders() });
}
