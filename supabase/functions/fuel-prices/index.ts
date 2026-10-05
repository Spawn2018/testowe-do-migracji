/**
 * PALIWO-AUTO-B — codzienne odczyty OKQ8 (GoEasy Diesel, cena listowa firmowa, SEK/l wprost; 0187) i Orlen
 * (ONEkodiesel, PLN/m³ netto → PLN/l) do fuel_index_readings. Przełącznik FUEL_SE_PL_INGEST.
 * Wywołanie: pg_cron → pg_net, klucz service role. User-Agent: Watch Tower.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
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

  try {
    const period = warsawToday();
    const { data: proj, error: pe } = await sb.from('projects').select('id').eq('code', 'STEGRA_BODEN').single();
    if (pe || !proj) throw new Error(`projects: ${pe?.message ?? 'brak projektu'}`);

    const orlenRes = await fetch(ORLEN_CURRENT_URL, { headers: { 'User-Agent': ORLEN_UA } });
    if (!orlenRes.ok) throw new Error(`Orlen: HTTP ${orlenRes.status}`);
    const orlenRows = (await orlenRes.json()) as OrlenRow[];
    const orlen = pickOnEkodiesel(orlenRows);
    if (!orlen) throw new Error('Orlen: brak ONEkodiesel');

    const okq8Res = await fetch(OKQ8_PRICES_URL, { headers: { 'User-Agent': OKQ8_UA } });
    if (!okq8Res.ok) throw new Error(`OKQ8: HTTP ${okq8Res.status}`);
    const okq8 = parseOkq8GoEasyDiesel(await okq8Res.text());

    const rows = [
      {
        index_code: 'PLN',
        period,
        reading_date: period,
        value: orlenM3ToLitre(orlen.value),
        source_url: ORLEN_SOURCE_PAGE,
        published_on: String(orlen.effectiveDate ?? '').slice(0, 10) || null,
        source_note: `ORLEN ONEkodiesel ${orlen.value} PLN/m³ netto (effective ${orlen.effectiveDate}); zapis ${orlenM3ToLitre(orlen.value)} PLN/l`,
      },
      {
        index_code: 'SEK',
        period,
        reading_date: period,
        value: okq8.valueSek,
        source_url: OKQ8_PRICES_URL,
        published_on: okq8.publishedOn,
        source_note: `OKQ8 GoEasy Diesel, cena listowa firmowa ${okq8.rawPriceText} (gäller fr.om ${okq8.publishedOn ?? period}, zmiana ${okq8.changeText ?? '?'}); wartość wprost`,
      },
    ];

    const { data, error } = await sb.rpc('fuel_se_pl_ingest', { p_project: proj.id, p_rows: rows });
    if (error) throw new Error(error.message);

    const { data: watch, error: we } = await sb.rpc('fuel_se_pl_missing_watch', {
      p_project: proj.id,
      p_day: period,
    });
    if (we) throw new Error(we.message);

    await log(true, { period, orlen: orlen.value, okq8: okq8.valueSek, ingest: data, watch });
    return Response.json({ ok: true, period, ingest: data, watch, orlen_m3: orlen.value, okq8_sek: okq8.valueSek });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(false, { error: msg });
    return new Response(msg, { status: 500 });
  }
});
