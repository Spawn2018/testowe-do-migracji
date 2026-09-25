// Etap 4: weryfikacja pieniędzy na hostowanym Supabase — trzy konta testowe (RLS/widoki).
// Sesje: generate_link (bez wysyłki e-maili) → /auth/v1/verify. Service role WYŁĄCZNIE do
// przygotowania i sprzątania własnych wierszy testowych (load_cost/load_revenue na TEST-BK3-A).
// Użycie: node scripts/money/verify.mjs   (exit 1 przy jakiejkolwiek porażce)
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { loadEnvLocal, need, TEST_ACCOUNTS } from '../auth/env.mjs';

const env = loadEnvLocal();
need(env, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', ...TEST_ACCOUNTS.map((a) => a.key)]);
const base = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const ANON = env.VITE_SUPABASE_ANON_KEY, SR = env.SUPABASE_SERVICE_ROLE_KEY;
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `  (${extra})` : ''}`); };
const opts = (token) => ({ auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket }, ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}) });

async function session(email) {
  const h = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
  const g = await fetch(`${base}/auth/v1/admin/generate_link`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', email }) });
  const gb = await g.json();
  const token_hash = gb.hashed_token ?? gb.properties?.hashed_token;
  const v = await fetch(`${base}/auth/v1/verify`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash }) });
  const vb = await v.json();
  if (!vb.access_token) throw new Error(`verify HTTP ${v.status}`);
  return vb.access_token;
}

const sb = {};
for (const a of TEST_ACCOUNTS) sb[a.org] = createClient(base, ANON, opts(await session(env[a.key].toLowerCase())));
const admin = createClient(base, SR, opts());
const anon = createClient(base, ANON, opts());

const { data: loads } = await sb.HHL.from('loads').select('id,order_no,project_id,shipment_items(shipment_code)');
const code = (l) => l.shipment_items?.[0]?.shipment_code ?? l.order_no;
const A = loads?.find((l) => code(l) === 'TEST-BK3-A');
check('fixture TEST-BK3-A widoczny dla HHL', Boolean(A));

const created = { cost: false, rev: false };
const cleanup = async () => {
  if (created.cost) await admin.from('load_cost').delete().eq('load_id', A.id);
  if (created.rev) await admin.from('load_revenue').delete().eq('load_id', A.id);
};

try {
  // ---------- M2: widoki v2 ----------
  const hasCost = (await admin.from('load_cost').select('load_id').eq('load_id', A.id)).data?.length;
  const hasRev = (await admin.from('load_revenue').select('load_id').eq('load_id', A.id)).data?.length;
  const snap = { pricing_tier: 'REALIZACJA', fuel_ref_date: '2026-09-24', fuel_mult_sek: 1.02, fuel_mult_pln: 1.01, fuel_applied_mult: 1.01, fx_table_no: '185/A/NBP/2026', fx_effective_date: '2026-09-23', fx_rate_pln: 4.3588 };
  if (!hasCost) { const r = await admin.from('load_cost').insert({ load_id: A.id, base_amount: 1900, computed_total_eur: 2000, ...snap }); created.cost = !r.error; }
  if (!hasRev) { const r = await admin.from('load_revenue').insert({ load_id: A.id, base_amount: 2400, computed_total_eur: 2500, ...snap }); created.rev = !r.error; }
  check('M2 fixture: koszt i przychód TEST-BK3-A (własne wiersze testowe)', created.cost && created.rev, 'wiersze już istniały — nie ruszam cudzych');

  const q = (org, view, cols) => sb[org].from(view).select(cols).eq('load_id', A.id);
  const h = await q('HHL', 'v_load_financials_hhl', 'margin_eur,pricing_tier,cost_computed_eur,cost_fx_table_no,fuel_ref_date');
  check('M2 HHL: widok marży działa (bez permission denied)', !h.error, h.error?.message);
  check('M2 HHL: marża EUR = 500, poziom REALIZACJA, migawki', Number(h.data?.[0]?.margin_eur) === 500 && h.data?.[0]?.pricing_tier === 'REALIZACJA' && h.data?.[0]?.cost_fx_table_no === '185/A/NBP/2026' && h.data?.[0]?.fuel_ref_date === '2026-09-24');
  const sc = await q('SCX', 'v_load_price_carrier', 'effective_total_eur,fx_table_no');
  check('M2 SCX: widzi koszt swojego transportu (2000 EUR)', !sc.error && Number(sc.data?.[0]?.effective_total_eur) === 2000, sc.error?.message);
  const sr = await q('SCX', 'v_load_price_client', 'effective_total_eur');
  check('M2 SCX: przychód niewidoczny (0 wierszy)', !sr.error && sr.data.length === 0);
  const sm = await q('SCX', 'v_load_financials_hhl', 'margin_eur');
  check('M2 SCX: marża niewidoczna (0 wierszy)', !sm.error && sm.data.length === 0);
  const kr = await q('KSH', 'v_load_price_client', 'effective_total_eur');
  check('M2 KSH: widzi przychód swojego projektu (2500 EUR)', !kr.error && Number(kr.data?.[0]?.effective_total_eur) === 2500, kr.error?.message);
  const kc = await q('KSH', 'v_load_price_carrier', 'effective_total_eur');
  check('M2 KSH: koszt niewidoczny (0 wierszy)', !kc.error && kc.data.length === 0);
  const km = await q('KSH', 'v_load_financials_hhl', 'margin_eur');
  check('M2 KSH: marża niewidoczna (0 wierszy)', !km.error && km.data.length === 0);
  const kt = await sb.KSH.from('load_cost').select('load_id');
  check('M2 KSH: tabela load_cost nadal zamknięta', Boolean(kt.error));
  const an = await anon.from('v_load_price_client').select('load_id');
  check('M2 anon: widok niedostępny', Boolean(an.error) || (an.data ?? []).length === 0);
  // Z1 w bazie
  if (created.cost) {
    await admin.from('load_cost').update({ invoiced_total_eur: 2100 }).eq('load_id', A.id);
    const z = await admin.from('load_cost').update({ computed_total_eur: 2222 }).eq('load_id', A.id).select('load_id');
    check('M2 Z1: wyliczenie po zafakturowaniu niezmienne (wyzwalacz)', Boolean(z.error) && /Z1/.test(z.error.message));
    const hz = await q('HHL', 'v_load_financials_hhl', 'cost_computed_eur,cost_invoiced_eur,margin_eur,cost_tier');
    const r0 = hz.data?.[0] ?? {};
    check('M2 Z1: obie wartości zostają, marża z fakturowanej', Number(r0.cost_computed_eur) === 2000 && Number(r0.cost_invoiced_eur) === 2100 && Number(r0.margin_eur) === 400 && r0.cost_tier === 'FAKTURA');
  }

  // ---------- M3: kurs NBP (fx_rates, reguła W3, migawka przy rozładunku) ----------
  const fr = await sb.KSH.rpc('fx_rate_before', { p_local_date: '2025-12-29' });
  check('M3 KSH: fx_rate_before(29.12.2025) = 248/A z 23.12 (tabele z API NBP w bazie)', !fr.error && fr.data?.[0]?.table_no === '248/A/NBP/2025' && fr.data?.[0]?.rate_date === '2025-12-23', fr.error?.message);
  const fn = await sb.KSH.rpc('fx_rate_before', { p_local_date: '2020-01-01' });
  check('M3: brak tabeli → błąd, nie zgadywanie', Boolean(fn.error) && /Brak tabeli/.test(fn.error.message));
  const fs = await sb.KSH.rpc('fx_sync_nbp', {});
  check('M3 KSH: pobieranie kursów niedostępne dla użytkownika', Boolean(fs.error));
  const fi = await sb.SCX.from('fx_rates').insert({ currency: 'EUR', rate_date: '2020-01-01', rate_pln: 9.99 });
  check('M3 SCX: zapis do fx_rates odrzucony', Boolean(fi.error));
  const latest = await sb.SCX.from('fx_rates').select('table_no,rate_date').order('rate_date', { ascending: false }).limit(1);
  check('M3: fx_rates czytelne i świeże (tabela z ostatnich 7 dni)', !latest.error && (Date.now() - Date.parse(latest.data?.[0]?.rate_date ?? '2000-01-01')) < 7 * 86400e3, latest.data?.[0]?.rate_date);
  if (created.cost && created.rev) {
    await admin.from('load_cost').update({ invoiced_total_eur: null }).eq('load_id', A.id).then(() => null, () => null);
    const prev = (await admin.from('loads').select('actual_delivery_at,plan_delivery_from').eq('id', A.id).single()).data ?? {};
    const before = prev.actual_delivery_at ?? null;
    // świeży wiersz kosztu (bez faktury) do migawki: usuń i wstaw ponownie własny wiersz testowy
    await admin.from('load_cost').delete().eq('load_id', A.id);
    await admin.from('load_cost').insert({ load_id: A.id, base_amount: 1900, computed_total_eur: 2000 });
    const u = await admin.from('loads').update({ actual_delivery_at: '2025-12-29T23:30:00Z' }).eq('id', A.id).select('id');
    const hv = await q('HHL', 'v_load_financials_hhl', 'cost_fx_table_no,rev_fx_table_no,fuel_ref_date,pricing_tier');
    const v0 = hv.data?.[0] ?? {};
    check('M3 migawka przy rozładunku (pułapka UTC → 249/A, dzień lokalny 30.12, obie strony)', !u.error && v0.cost_fx_table_no === '249/A/NBP/2025' && v0.rev_fx_table_no === '249/A/NBP/2025' && v0.fuel_ref_date === '2025-12-30', u.error?.message ?? JSON.stringify(v0));
    await admin.from('loads').update({ plan_delivery_from: '2026-10-09T08:00:00Z' }).eq('id', A.id);
    const hv2 = await q('HHL', 'v_load_financials_hhl', 'cost_fx_table_no');
    check('M3 migawka niezmienna po zmianie planu', hv2.data?.[0]?.cost_fx_table_no === '249/A/NBP/2025');
    const r = await admin.from('loads').update({ actual_delivery_at: before, plan_delivery_from: prev.plan_delivery_from ?? null }).eq('id', A.id).select('id');
    check('M3 przywrócono actual_delivery_at i plan_delivery_from fixture', !r.error, r.error?.message);
  }
  //@@NEXT@@
} finally {
  await cleanup();
  const left = [(await admin.from('load_cost').select('load_id').eq('load_id', A.id)).data?.length ?? 0, (await admin.from('load_revenue').select('load_id').eq('load_id', A.id)).data?.length ?? 0];
  check('sprzątanie: brak własnych resztek load_cost/load_revenue na TEST-BK3-A', left[0] === 0 && left[1] === 0, JSON.stringify(left));
}
console.log(`\nEtap 4 money verify: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
