/**
 * #685-b / decyzja 63b — podgląd i zapis rozkładu Viking Cargo z pliku HTML.
 * HHL_ADMIN + 2FA (RPC assert). Parser: parseVikingTimetableHtml. Zapis: applyVikingFileSchedule
 * (nie applySailings). Historia: viking_schedule_import_record. Ekran: BN9-c1 (koordynator).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsJson, corsPreflight } from '../_shared/cors.ts';
import { parseVikingTimetableHtml } from '../_shared/ferry/vikingline.ts';
import {
  applyVikingFileSchedule,
  previewVikingFileSailings,
  type VikingFileImportDeps,
} from '../_shared/ferry/vikingFileImport.ts';
import { supabaseStore } from '../_shared/integrations/store.ts';

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
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anon || !service) {
    return corsJson({ ok: false, error: 'service' }, 500);
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return corsJson({ ok: false, error: 'Brak autoryzacji' }, 401);
  }

  let body: { html?: string; file_name?: string; commit?: boolean; from_ymd?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return corsJson({ ok: false, error: 'Nieczytelne ciało żądania' }, 400);
  }
  const html = typeof body.html === 'string' ? body.html : '';
  const fileName = (body.file_name ?? 'viking-cargo.html').trim() || 'viking-cargo.html';
  const commit = body.commit === true;
  if (!html.trim()) {
    return corsJson({ ok: false, error: 'Pusty plik HTML' }, 400);
  }

  const userSb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr || !userData.user) {
    return corsJson({ ok: false, error: 'Brak sesji' }, 401);
  }

  const { data: actorId, error: mfaErr } = await userSb.rpc('viking_schedule_import_assert');
  if (mfaErr) {
    const msg = /2FA|Administrator/i.test(mfaErr.message)
      ? 'Tylko Administrator HHL z 2FA'
      : mfaErr.message;
    return corsJson({ ok: false, error: msg }, 403);
  }

  const fromYmd = body.from_ymd ?? new Date().toISOString().slice(0, 10);
  const days = typeof body.days === 'number' && body.days > 0 ? Math.min(body.days, 90) : 60;
  const parsed = parseVikingTimetableHtml(html, { fromYmd, days });
  const preview = previewVikingFileSailings(parsed.sailings);
  const fileHash = await sha256Hex(html);

  if (!commit) {
    return corsJson({
      ok: true,
      preview: true,
      actor_id: actorId,
      file_name: fileName,
      file_hash: fileHash,
      sailing_count: preview.sailingCount,
      from_at: preview.fromAt,
      to_at: preview.toAt,
      horizon_days: preview.horizonDays,
      warnings: parsed.warnings,
    });
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const store = supabaseStore(admin);
  const deps: VikingFileImportDeps = {
    store,
    now: () => new Date(),
  };
  const sinceIso = new Date(Date.now() - 6 * 3600_000).toISOString();
  const stats = await applyVikingFileSchedule(deps, parsed.sailings, { sinceIso });

  const { data: importId, error: recErr } = await userSb.rpc('viking_schedule_import_record', {
    p_file_name: fileName,
    p_file_hash: fileHash,
    p_sailing_count: stats.sailingCount,
    p_from_at: stats.fromAt,
    p_to_at: stats.toAt,
    p_stats: {
      inserted: stats.inserted,
      updated: stats.updated,
      removed: stats.removed,
      taken_over: stats.takenOver,
      manual_kept: stats.manualKept,
      risks: stats.risks,
      horizon_days: stats.horizonDays,
      source_down_closed: stats.sourceDownClosed,
      warnings: [...parsed.warnings, ...stats.warnings].slice(0, 40),
    },
  });
  if (recErr) {
    return corsJson({ ok: false, error: recErr.message, apply: stats }, 500);
  }

  return corsJson({
    ok: true,
    preview: false,
    import_id: importId,
    actor_id: actorId,
    file_name: fileName,
    file_hash: fileHash,
    sailing_count: stats.sailingCount,
    from_at: stats.fromAt,
    to_at: stats.toAt,
    horizon_days: stats.horizonDays,
    source_down_closed: stats.sourceDownClosed,
    inserted: stats.inserted,
    updated: stats.updated,
    removed: stats.removed,
    taken_over: stats.takenOver,
    manual_kept: stats.manualKept,
    risks: stats.risks,
    warnings: [...parsed.warnings, ...stats.warnings],
  });
});
