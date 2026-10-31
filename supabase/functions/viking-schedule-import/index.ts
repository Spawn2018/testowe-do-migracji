/**
 * #685-b / decyzja 63b — podgląd/zapis rozkładu Viking Cargo z pliku HTML.
 * Parser: parseVikingTimetableHtml. Zapis: RPC viking_schedule_import (HHL_ADMIN+2FA;
 * nie applySailings). Ekran BN9-c1 — koordynator.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsJson, corsPreflight } from '../_shared/cors.ts';
import { parseVikingTimetableHtml } from '../_shared/ferry/vikingline.ts';

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') {
    return new Response('method', { status: 405, headers: corsHeaders() });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !anon) {
    return corsJson({ ok: false, error: 'service' }, 500);
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return corsJson({ ok: false, error: 'Brak autoryzacji' }, 401);
  }

  let body: {
    html?: string;
    file_name?: string;
    project_id?: string;
    commit?: boolean;
    from_ymd?: string;
    days?: number;
  };
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, error: 'Nieczytelne ciało żądania' }, 400);
  }

  const html = typeof body.html === 'string' ? body.html : '';
  const fileName = (body.file_name ?? 'viking-cargo.html').trim() || 'viking-cargo.html';
  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const commit = body.commit === true;
  if (!html.trim()) {
    return corsJson({ ok: false, error: 'Pusty plik HTML' }, 400);
  }
  if (!projectId) {
    return corsJson({ ok: false, error: 'Brak project_id' }, 400);
  }

  const userSb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr || !userData.user) {
    return corsJson({ ok: false, error: 'Brak sesji' }, 401);
  }

  const fromYmd = body.from_ymd ?? new Date().toISOString().slice(0, 10);
  const days = typeof body.days === 'number' && body.days > 0 ? Math.min(body.days, 90) : 60;
  const parsed = parseVikingTimetableHtml(html, { fromYmd, days });
  const fileHash = await sha256Hex(html);
  const sailings = parsed.sailings.map((s) => ({
    route: s.route,
    vessel: s.vessel,
    departure_at: s.departureUtc,
    arrival_at: s.arrivalUtc,
  }));

  const { data, error } = await userSb.rpc('viking_schedule_import', {
    p_project: projectId,
    p_sailings: sailings,
    p_file: {
      name: fileName,
      hash: fileHash,
      size: new TextEncoder().encode(html).length,
    },
    p_dry_run: !commit,
  });

  if (error) {
    const msg = /2FA|Administrator/i.test(error.message)
      ? 'Tylko Administrator HHL z 2FA'
      : error.message;
    const status = /42501|2FA|Administrator|autoryz/i.test(error.message) ? 403 : 400;
    return corsJson({ ok: false, error: msg, warnings: parsed.warnings }, status);
  }

  return corsJson({
    ok: true,
    warnings: parsed.warnings,
    result: data,
  });
});
