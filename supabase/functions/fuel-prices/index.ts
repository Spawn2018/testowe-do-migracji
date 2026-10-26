/**
 * PALIWO-AUTO-B — codzienne odczyty OKQ8 (GoEasy Diesel, cena listowa firmowa, SEK/l wprost; 0187) i Orlen
 * (ONEkodiesel, PLN/m³ netto → PLN/l) do fuel_index_readings. Przełącznik FUEL_SE_PL_INGEST.
 * D-1300 / F7-2 / #563: źródła osobno; 3 próby / 20 s; cron co godzinę, funkcja o 7/9/13/17/23 Europe/Warsaw;
 * przy każdym przebiegu pobiera cenę także gdy dzień ma już odczyt — decyzja insert/skip w fuel_se_pl_ingest.
 * Wywołanie: pg_cron → pg_net, klucz service role. User-Agent: Watch Tower.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import {
  ORLEN_CURRENT_URL,
  ORLEN_UA,
  pickOnEkodiesel,
  type OrlenRow,
} from '../_shared/fuel/orlen.ts';
import { OKQ8_PRICES_URL, OKQ8_UA, parseOkq8GoEasyDiesel } from '../_shared/fuel/okq8.ts';
import {
  isFuelPriceHour,
  orlenIngestPayload,
  periodForPublishedOn,
  warsawHour,
  type FuelSourceRow,
} from '../_shared/fuel/ingest.ts';

function warsawToday(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

type SourceResult = {
  ok: boolean;
  error?: string;
  value?: number;
  skipped?: string;
  ingest?: unknown;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetries<T>(fn: () => Promise<T>, attempts = 3, delayMs = 20_000): Promise<T> {
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

  // #563: cron co godzinę; poza 7/9/13/17/23 PL — cicho, bez ok=false.
  const hour = warsawHour();
  if (!isFuelPriceHour(hour)) {
    return Response.json({ ok: true, skipped: 'hour', hour });
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

  // Orlen — zawsze pobierz; insert/skip w fuel_se_pl_ingest (#563).
  try {
    const fetched = await withRetries(async () => {
      const orlenRes = await fetch(ORLEN_CURRENT_URL, { headers: { 'User-Agent': ORLEN_UA } });
      if (!orlenRes.ok) throw new Error(`Orlen: HTTP ${orlenRes.status}`);
      const orlenRows = (await orlenRes.json()) as OrlenRow[];
      const orlen = pickOnEkodiesel(orlenRows);
      if (!orlen) throw new Error('Orlen: brak ONEkodiesel');
      return orlenIngestPayload(period, orlen);
    });
    const { data, error } = await sb.rpc('fuel_se_pl_ingest', {
      p_project: proj.id,
      p_rows: [fetched.row],
    });
    if (error) throw new Error(error.message);
    ingest.orlen = data;
    const skipped = typeof data?.skipped === 'number' && data.skipped > 0 && data.inserted === 0;
    sources.orlen = {
      ok: true,
      value: fetched.value,
      ingest: data,
      ...(skipped ? { skipped: 'unchanged' } : {}),
    };
  } catch (e) {
    sources.orlen = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // OKQ8 — zawsze pobierz
  try {
    const fetched = await withRetries(async () => {
      const okq8Res = await fetch(OKQ8_PRICES_URL, { headers: { 'User-Agent': OKQ8_UA } });
      if (!okq8Res.ok) throw new Error(`OKQ8: HTTP ${okq8Res.status}`);
      const okq8 = parseOkq8GoEasyDiesel(await okq8Res.text());
      const effPeriod = periodForPublishedOn(period, okq8.publishedOn);
      const r: FuelSourceRow = {
        index_code: 'SEK',
        period: effPeriod,
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
      p_rows: [fetched.row],
    });
    if (error) throw new Error(error.message);
    ingest.okq8 = data;
    const skipped = typeof data?.skipped === 'number' && data.skipped > 0 && data.inserted === 0;
    sources.okq8 = {
      ok: true,
      value: fetched.value,
      ingest: data,
      ...(skipped ? { skipped: 'unchanged' } : {}),
    };
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
