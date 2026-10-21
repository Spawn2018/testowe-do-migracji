/**
 * PALIWO-AUTO-B — codzienne odczyty OKQ8 (GoEasy Diesel, cena listowa firmowa, SEK/l wprost; 0187) i Orlen
 * (ONEkodiesel, PLN/m³ netto → PLN/l) do fuel_index_readings. Przełącznik FUEL_SE_PL_INGEST.
 * D-1300: źródła osobno — błąd Orlen nie blokuje OKQ8 i odwrotnie (E3); 3 próby / 30 s;
 * ponowienia cron 07:15/09:15/13:15 PL pomijają źródło już zapisane tego dnia.
 * Wywołanie: pg_cron → pg_net, klucz service role. User-Agent: Watch Tower.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import {
  ORLEN_CURRENT_URL,
  ORLEN_SOURCE_PAGE,
  ORLEN_UA,
  orlenM3ToLitre,
  pickOnEkodiesel,
  type OrlenRow,
} from '../_shared/fuel/orlen.ts';
import { OKQ8_PRICES_URL, OKQ8_UA, parseOkq8GoEasyDiesel } from '../_shared/fuel/okq8.ts';

function warsawToday(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

type SourceRow = {
  index_code: string;
  period: string;
  reading_date: string;
  value: number;
  source_url: string;
  published_on: string | null;
  source_note: string;
};

type SourceResult = {
  ok: boolean;
  error?: string;
  value?: number;
  skipped?: string;
  ingest?: unknown;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 30_000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

async function hasReading(
  sb: SupabaseClient,
  projectId: string,
  indexCode: string,
  period: string,
): Promise<boolean> {
  const { data, error } = await sb
    .from('fuel_index_readings')
    .select('id')
    .eq('project_id', projectId)
    .eq('index_code', indexCode)
    .eq('period', period)
    .is('corrects_id', null)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data: enabled, error: fe } = await sb.rpc('fuel_se_pl_enabled');
  if (fe) return new Response(fe.message, { status: 500 });
  if (enabled !== true) {
    return Response.json({ ok: true, skipped: 'FUEL_SE_PL_INGEST wyłączone' });
  }

  const log = (ok: boolean, result: Record<string, unknown>) =>
    sb.from('integration_runs').insert({ job: 'fuel-prices', ok, result });

  const period = warsawToday();
  const { data: proj, error: pe } = await sb.from('projects').select('id').eq('code', 'STEGRA_BODEN').single();
  if (pe || !proj) {
    const msg = `projects: ${pe?.message ?? 'brak projektu'}`;
    await log(false, { error: msg, period });
    return new Response(msg, { status: 500 });
  }

  const sources: Record<string, SourceResult> = {};
  const ingest: Record<string, unknown> = {};

  // Orlen — osobny zapis; pomiń gdy odczyt dnia już jest (ponowienie 09:15 / 13:15).
  try {
    if (await hasReading(sb, proj.id, 'PLN', period)) {
      sources.orlen = { ok: true, skipped: 'already' };
    } else {
      const row = await withRetries(async () => {
        const orlenRes = await fetch(ORLEN_CURRENT_URL, { headers: { 'User-Agent': ORLEN_UA } });
        if (!orlenRes.ok) throw new Error(`Orlen: HTTP ${orlenRes.status}`);
        const orlenRows = (await orlenRes.json()) as OrlenRow[];
        const orlen = pickOnEkodiesel(orlenRows);
        if (!orlen) throw new Error('Orlen: brak ONEkodiesel');
        const r: SourceRow = {
          index_code: 'PLN',
          period,
          reading_date: period,
          value: orlenM3ToLitre(orlen.value),
          source_url: ORLEN_SOURCE_PAGE,
          published_on: String(orlen.effectiveDate ?? '').slice(0, 10) || null,
          source_note: `ORLEN ONEkodiesel ${orlen.value} PLN/m³ netto (effective ${orlen.effectiveDate}); zapis ${orlenM3ToLitre(orlen.value)} PLN/l`,
        };
        return { row, value: orlen.value };
      });
      const { data, error } = await sb.rpc('fuel_se_pl_ingest', {
        p_project: proj.id,
        p_rows: [row.row],
      });
      if (error) throw new Error(error.message);
      ingest.orlen = data;
      sources.orlen = { ok: true, value: row.value, ingest: data };
    }
  } catch (e) {
    sources.orlen = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // OKQ8 — osobny zapis
  try {
    if (await hasReading(sb, proj.id, 'SEK', period)) {
      sources.okq8 = { ok: true, skipped: 'already' };
    } else {
      const row = await withRetries(async () => {
        const okq8Res = await fetch(OKQ8_PRICES_URL, { headers: { 'User-Agent': OKQ8_UA } });
        if (!okq8Res.ok) throw new Error(`OKQ8: HTTP ${okq8Res.status}`);
        const okq8 = parseOkq8GoEasyDiesel(await okq8Res.text());
        const r: SourceRow = {
          index_code: 'SEK',
          period,
          reading_date: period,
          value: okq8.valueSek,
          source_url: OKQ8_PRICES_URL,
          published_on: okq8.publishedOn,
          source_note: `OKQ8 GoEasy Diesel, cena listowa firmowa ${okq8.rawPriceText} (gäller fr.om ${okq8.publishedOn ?? period}, zmiana ${okq8.changeText ?? '?'}); wartość wprost`,
        };
        return { row: r, value: okq8.valueSek };
      });
      const { data, error } = await sb.rpc('fuel_se_pl_ingest', {
        p_project: proj.id,
        p_rows: [row.row],
      });
      if (error) throw new Error(error.message);
      ingest.okq8 = data;
      sources.okq8 = { ok: true, value: row.value, ingest: data };
    }
  } catch (e) {
    sources.okq8 = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const { data: watchData, error: we } = await sb.rpc('fuel_se_pl_missing_watch', {
    p_project: proj.id,
    p_day: period,
  });
  if (we) {
    await log(false, { period, sources, ingest, error: we.message });
    return new Response(we.message, { status: 500 });
  }

  // F7: integration_runs.ok = false, gdy którekolwiek źródło padło (watchdog).
  const allOk = sources.orlen?.ok === true && sources.okq8?.ok === true;
  const anyOk = sources.orlen?.ok === true || sources.okq8?.ok === true;
  await log(allOk, { period, sources, ingest, watch: watchData });
  if (!anyOk) {
    return new Response(
      [sources.orlen?.error, sources.okq8?.error].filter(Boolean).join('; ') || 'oba źródła niedostępne',
      { status: 500 },
    );
  }
  return Response.json({
    ok: allOk,
    partial: !allOk,
    period,
    sources,
    ingest,
    watch: watchData,
    orlen_m3: sources.orlen?.value,
    okq8_sek: sources.okq8?.value,
  });
});
