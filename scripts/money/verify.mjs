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
const m6 = { inv: [], docs: [], paths: [], notes: [] };
const cleanup = async () => {
  // M6: własne faktury TEST (kaskada: pozycje, dokumenty faktury), powiadomienia, pliki PDF
  if (m6.inv.length) await admin.from('invoices').delete().in('id', m6.inv);
  if (m6.notes.length) await admin.from('notifications').delete().in('id', [...new Set(m6.notes)]);
  for (const inv of m6.inv) await admin.from('notifications').delete().contains('payload', { invoice_id: inv });
  for (const [b, pth] of m6.paths) await admin.storage.from(b).remove([pth]);
  if (m6.docs.length) await admin.from('documents').delete().in('id', m6.docs);
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

  // ---------- M4: ustawienia użytkownika (user_preferences, RLS: własny wiersz) ----------
  for (const org of ['HHL', 'KSH', 'SCX']) {
    const uid = await sb[org].rpc('current_app_user_id');
    const had = (await sb[org].from('user_preferences').select('user_id,display_currency,theme').maybeSingle()).data;
    const up = await sb[org].from('user_preferences').upsert({ user_id: uid.data, display_currency: 'PLN', theme: 'light' }, { onConflict: 'user_id' }).select('display_currency,theme');
    check(`M4 ${org}: zapis własnych ustawień (PLN, light; bez języka — B9)`, !up.error && up.data?.[0]?.display_currency === 'PLN' && up.data?.[0]?.theme === 'light', up.error?.message);
    const cnt = await sb[org].from('user_preferences').select('user_id');
    check(`M4 ${org}: widzi wyłącznie własny wiersz`, !cnt.error && cnt.data.length === 1);
    const sek = await sb[org].from('user_preferences').update({ display_currency: 'SEK' }).eq('user_id', uid.data).select('user_id');
    check(`M4 ${org}: SEK odrzucony (tylko EUR/PLN)`, Boolean(sek.error));
    if (had) await sb[org].from('user_preferences').update({ display_currency: had.display_currency, theme: had.theme }).eq('user_id', uid.data);
    else await admin.from('user_preferences').delete().eq('user_id', uid.data);
  }
  const foreign = await sb.KSH.from('user_preferences').upsert({ user_id: (await sb.SCX.rpc('current_app_user_id')).data, display_currency: 'PLN' }, { onConflict: 'user_id' }).select('user_id');
  check('M4 KSH: nie zapisze ustawień innego użytkownika', Boolean(foreign.error));
  // ---------- M5: numery zleceń (W12) — wymuszenie z bazy, każda strona swój, powiadomienia z RLS ----------
  {
    const orig = (await admin.from('loads').select('hhl_order_no,carrier_order_no,status').eq('id', A.id).single()).data;
    const e1 = await sb.HHL.from('loads').update({ hhl_order_no: null, status: 'READY' }).eq('id', A.id).select('id');
    check('M5 GOTOWY bez numeru HHL → błąd bazy (komunikat mapowany w aplikacji)', /bez numeru zlecenia HHL/.test(e1.error?.message ?? ''), e1.error?.message ?? 'brak błędu');
    const e2 = await sb.HHL.from('loads').update({ carrier_order_no: 'TEST-M5-X' }).eq('id', A.id).select('id');
    check('M5 HHL nie zmieni numeru przewoźnika (W12)', /wpisuje wy\S*cznie przewo/.test(e2.error?.message ?? ''), e2.error?.message ?? 'brak błędu');
    const e3 = await sb.SCX.from('loads').update({ hhl_order_no: 'TEST-M5-X' }).eq('id', A.id).select('id');
    check('M5 przewoźnik nie zmieni numeru HHL', /hhl_order_no/.test(e3.error?.message ?? ''), e3.error?.message ?? 'brak błędu');
    const e4 = await sb.SCX.from('loads').update({ plan_load_from: '2026-10-01T06:00:00Z' }).eq('id', A.id).select('id');
    check('M5/AN2 przewoźnik nie zmieni okna planowego', /plan_load_from/.test(e4.error?.message ?? ''), e4.error?.message ?? 'brak błędu');
    const s1 = await sb.SCX.from('loads').update({ carrier_order_no: 'TEST-M5-SCX' }).eq('id', A.id).select('carrier_order_no');
    check('M5 przewoźnik wpisuje swój numer', !s1.error && s1.data?.[0]?.carrier_order_no === 'TEST-M5-SCX', s1.error?.message);
    const s2 = await sb.HHL.from('loads').update({ hhl_order_no: 'TEST-M5-HHL' }).eq('id', A.id).select('hhl_order_no');
    check('M5 HHL wpisuje swój numer', !s2.error && s2.data?.[0]?.hhl_order_no === 'TEST-M5-HHL', s2.error?.message);
    await sb.SCX.from('loads').update({ carrier_order_no: orig?.carrier_order_no ?? null }).eq('id', A.id);
    await sb.HHL.from('loads').update({ hhl_order_no: orig?.hhl_order_no ?? null }).eq('id', A.id);
    const back = (await admin.from('loads').select('hhl_order_no,carrier_order_no,status').eq('id', A.id).single()).data;
    check('M5 przywrócono numery fixture', JSON.stringify(back) === JSON.stringify(orig), JSON.stringify(back));
    const d = await sb.HHL.rpc('detect_missing_order_numbers');
    check('M5 wykrywanie braków niedostępne dla użytkownika (tylko cron)', Boolean(d.error));
    const na = await anon.from('notifications').select('id');
    check('M5 anon nie czyta powiadomień', Boolean(na.error) || na.data.length === 0);
    const ni = await sb.SCX.from('notifications').insert({ channel: 'IN_APP', recipient: 'x', template: 'X' }).select('id');
    check('M5 zalogowany nie wstawi powiadomienia', Boolean(ni.error));
    const uidK = (await sb.KSH.rpc('current_app_user_id')).data;
    const nk = await sb.KSH.from('notifications').select('user_id');
    check('M5 KSH widzi wyłącznie własne powiadomienia', !nk.error && nk.data.every((r) => r.user_id === uidK), nk.error?.message);
  }
  // ---------- 0013: luki RLS od 0001 ----------
  for (const t of ['geofence_states', 'load_permits', 'schedule_imports', 'workflow_runs']) {
    const r = await anon.from(t).select('*').limit(1);
    check(`RLS 0013: anon nie czyta ${t}`, Boolean(r.error), r.error ? '' : `rows=${r.data?.length}`);
  }
  const si = await sb.SCX.from('schedule_imports').select('id');
  check('RLS 0013: SCX nie widzi historii importów', !si.error && si.data.length === 0, si.error?.message);
  // ---------- M6: faktury v2 (register_invoice, strony, weryfikacja, płatność) — własne wiersze TEST, sprzątane ----------
  {
    const pdf = new Blob([new TextEncoder().encode('%PDF-1.4\n%TEST-M6\n')], { type: 'application/pdf' });
    const upPdf = async (org) => {
      const c = await sb[org].rpc('create_document', { p_load_id: null, p_category: 'INVOICE', p_file_name: `TEST-M6-${org}.pdf`, p_mime: 'application/pdf', p_size: pdf.size, p_project_id: A.project_id });
      const row = Array.isArray(c.data) ? c.data[0] : c.data;
      if (c.error || !row) return { error: c.error?.message ?? 'brak' };
      m6.docs.push(row.id); m6.paths.push([row.bucket, row.object_path]);
      const objectPath = String(row.object_path).replace(/\.\.\//g, '');
      if (objectPath !== row.object_path || objectPath.includes('..')) return { error: 'Niedozwolona ścieżka pliku' };
      const u = await sb[org].storage.from(row.bucket).upload(objectPath, pdf, { contentType: 'application/pdf' });
      return { id: row.id, error: u.error?.message };
    };
    const reg = (org, p) => sb[org].rpc('register_invoice', { p });
    const hdr = (dir, num, doc) => ({ direction: dir, currency: 'EUR', invoice_number: num, issue_date: '2026-09-20', week_key: '2026-W38', net_total: 2000, vat_total: 0, gross_total: 2000, document_id: doc, lines: [{ load_id: A.id, invoiced_net: 2000 }] });
    const d1 = await upPdf('SCX');
    check('M6 SCX: PDF faktury w Storage (dokument bez transportu)', !d1.error, d1.error);
    const r1 = await reg('SCX', hdr('KOSZT', `TEST-M6-K-${Date.now()}`, d1.id));
    if (r1.data) m6.inv.push(r1.data);
    check('M6 SCX rejestruje fakturę kosztową (RPC)', !r1.error && Boolean(r1.data), r1.error?.message);
    const nopdf = await reg('SCX', { ...hdr('KOSZT', 'TEST-M6-NOPDF', null) });
    check('M6 bez PDF → odrzucona', /PDF/.test(nopdf.error?.message ?? ''), nopdf.error?.message);
    const vatless = await reg('SCX', { ...hdr('KOSZT', 'TEST-M6-NOVAT', d1.id), vat_total: null });
    check('M6 bez VAT z dokumentu → odrzucona (system nie liczy VAT)', /VAT/.test(vatless.error?.message ?? ''), vatless.error?.message);
    const hhlCost = await reg('HHL', hdr('KOSZT', 'TEST-M6-HHLK', d1.id));
    check('M6 HHL nie rejestruje kosztowej (wystawca = przewoźnik)', Boolean(hhlCost.error));
    if (r1.data) {
      const id = r1.data;
      const v = await Promise.all(['HHL', 'SCX', 'KSH'].map((o) => sb[o].from('invoices').select('id,due_date,verification_status,invoice_lines(flags,expected_amount)').eq('id', id)));
      check('M6 kosztowa: widzą HHL i SCX, KSH nie', v[0].data?.length === 1 && v[1].data?.length === 1 && v[2].data?.length === 0, JSON.stringify(v.map((x) => x.data?.length)));
      check('M6 termin 35 dni od wystawienia (relacja HHL←SCX)', v[0].data?.[0]?.due_date === '2026-10-25', v[0].data?.[0]?.due_date);
      check('M6 kontrole pozycji liczone w bazie (flagi, oczekiwana kwota)', Array.isArray(v[0].data?.[0]?.invoice_lines?.[0]?.flags) && Number(v[0].data?.[0]?.invoice_lines?.[0]?.expected_amount) === 2000, JSON.stringify(v[0].data?.[0]?.invoice_lines));
      const dbl = await reg('SCX', hdr('KOSZT', 'TEST-M6-K-DBL', d1.id));
      check('M6 podwójne fakturowanie → zrozumiały błąd', /podw\S*jne fakturowanie/i.test(dbl.error?.message ?? ''), dbl.error?.message);
      const z1 = await sb.HHL.from('v_load_financials_hhl').select('cost_computed_eur,cost_invoiced_eur,cost_tier').eq('load_id', A.id);
      check('M6 Z1: kwota z faktury obok wyliczenia, poziom FAKTURA', Number(z1.data?.[0]?.cost_computed_eur) === 2000 && Number(z1.data?.[0]?.cost_invoiced_eur) === 2000 && z1.data?.[0]?.cost_tier === 'FAKTURA', JSON.stringify(z1.data));
      const sv = await sb.SCX.from('invoices').update({ verification_status: 'ZAAKCEPTOWANA' }).eq('id', id).select('id');
      check('M6 wystawca nie weryfikuje własnej (Q14)', Boolean(sv.error) || (sv.data ?? []).length === 0, sv.error?.message);
      const sp = await sb.SCX.rpc('mark_invoice_paid', { p_invoice: id, p_paid_at: '2026-09-25' });
      check('M6 SCX nie oznaczy „Opłacona”', Boolean(sp.error));
      const hn = await sb.HHL.from('invoices').update({ verification_status: 'SPORNA' }).eq('id', id).select('id');
      check('M6 SPORNA bez uzasadnienia → odrzucona', Boolean(hn.error), hn.error ? '' : 'zapisano');
      const hs = await sb.HHL.from('invoices').update({ verification_status: 'SPORNA', dispute_note: 'TEST-M6 stawka', decided_at: new Date().toISOString() }).eq('id', id).select('verification_status');
      check('M6 HHL (odbiorca) SPORNA z uzasadnieniem', !hs.error && hs.data?.[0]?.verification_status === 'SPORNA', hs.error?.message);
      const ha = await sb.HHL.from('invoices').update({ verification_status: 'ZAAKCEPTOWANA' }).eq('id', id).select('verification_status');
      check('M6 HHL ZAAKCEPTOWANA', !ha.error && ha.data?.[0]?.verification_status === 'ZAAKCEPTOWANA', ha.error?.message);
      const hp = await sb.HHL.rpc('mark_invoice_paid', { p_invoice: id, p_paid_at: '2026-09-25' });
      const ps = await sb.SCX.from('invoices').select('payment_status,paid_at').eq('id', id);
      check('M6 HHL „Opłacona” z datą — SCX widzi status', !hp.error && ps.data?.[0]?.payment_status === 'OPLACONA' && ps.data?.[0]?.paid_at === '2026-09-25', hp.error?.message ?? JSON.stringify(ps.data));
      const un0 = await sb.HHL.rpc('unmark_invoice_paid', { p_invoice: id, p_reason: '' });
      check('M6 cofnięcie bez powodu → odrzucone', Boolean(un0.error));
      const un = await sb.HHL.rpc('unmark_invoice_paid', { p_invoice: id, p_reason: 'TEST-M6 cofnięcie' });
      check('M6 cofnięcie z powodem', !un.error, un.error?.message);
    }
    // przychodowa HHL → KSH
    const d2 = await upPdf('HHL');
    const r2 = await reg('HHL', { ...hdr('PRZYCHOD', `TEST-M6-P-${Date.now()}`, d2.id), net_total: 2500, gross_total: 2500, lines: [{ load_id: A.id, invoiced_net: 2500 }] });
    if (r2.data) m6.inv.push(r2.data);
    check('M6 HHL rejestruje fakturę przychodową', !r2.error && Boolean(r2.data), r2.error?.message);
    const scxRev = await reg('SCX', hdr('PRZYCHOD', 'TEST-M6-SCXP', d1.id));
    check('M6 SCX nie rejestruje przychodowej', Boolean(scxRev.error));
    if (r2.data) {
      const id = r2.data;
      const v = await Promise.all(['HHL', 'SCX', 'KSH'].map((o) => sb[o].from('invoices').select('id,due_date').eq('id', id)));
      check('M6 przychodowa: widzą HHL i KSH, SCX nie', v[0].data?.length === 1 && v[1].data?.length === 0 && v[2].data?.length === 1, JSON.stringify(v.map((x) => x.data?.length)));
      check('M6 termin 30 dni (relacja KSH←HHL)', v[0].data?.[0]?.due_date === '2026-10-20', v[0].data?.[0]?.due_date);
      const uidK = (await sb.KSH.rpc('current_app_user_id')).data;
      const nk = await admin.from('notifications').select('id,template').eq('user_id', uidK).contains('payload', { invoice_id: id });
      m6.notes.push(...(nk.data ?? []).map((n) => n.id));
      check('M6 Q13: KSH dostaje powiadomienie o nowej fakturze HHL', (nk.data ?? []).length > 0, nk.error?.message);
      const kd = await sb.KSH.from('invoice_documents').select('role').eq('invoice_id', id);
      check('M6 KSH widzi dokumenty faktury wyłącznie PDF/CMR/POD', !kd.error && kd.data.length > 0 && kd.data.every((r) => ['FAKTURA_PDF', 'CMR', 'POD'].includes(r.role)), kd.error?.message ?? JSON.stringify(kd.data));
      const kv = await sb.KSH.from('invoices').update({ verification_status: 'ZGODNA', decided_at: new Date().toISOString() }).eq('id', id).select('verification_status');
      check('M6 KSH (odbiorca) weryfikuje fakturę HHL', !kv.error && kv.data?.[0]?.verification_status === 'ZGODNA', kv.error?.message);
      const kp = await sb.KSH.rpc('mark_invoice_paid', { p_invoice: id, p_paid_at: '2026-09-25' });
      check('M6 KSH nie oznaczy „Opłacona”', Boolean(kp.error));
    }
  }
  // ---------- M7: przypomnienia (send_payment_reminders) — tylko płatnik i wierzyciel, opłacona → cisza ----------
  {
    if (m6.inv.length) await admin.from('invoices').delete().in('id', m6.inv); // faktury M6 zwalniają transport fixture
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const plus = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const due = plus(today, 3);
    const pdf = new Blob([new TextEncoder().encode('%PDF-1.4\n%TEST-M7\n')], { type: 'application/pdf' });
    const c = await sb.SCX.rpc('create_document', { p_load_id: null, p_category: 'INVOICE', p_file_name: 'TEST-M7.pdf', p_mime: 'application/pdf', p_size: pdf.size, p_project_id: A.project_id });
    const row = Array.isArray(c.data) ? c.data[0] : c.data;
    if (row) { m6.docs.push(row.id); m6.paths.push([row.bucket, row.object_path]); await sb.SCX.storage.from(row.bucket).upload(row.object_path, pdf, { contentType: 'application/pdf' }); }
    const r = await sb.SCX.rpc('register_invoice', { p: { direction: 'KOSZT', currency: 'PLN', invoice_number: `TEST-M7-${Date.now()}`, issue_date: today, week_key: '2026-W38', net_total: 100, vat_total: 23, gross_total: 123, due_date: due, document_id: row?.id, lines: [{ load_id: A.id, invoiced_net: 100, fx_table_no: '185/A/NBP/2026', fx_mid: 4.3588, fx_effective_date: '2026-09-23' }] } });
    const id = r.data;
    if (id) m6.inv.push(id);
    check('M7 fixture: faktura TEST z terminem z dokumentu (dziś + 3)', !r.error && Boolean(id), r.error?.message);
    const deny = await sb.HHL.rpc('send_payment_reminders', { p_today: today });
    check('M7 użytkownik nie uruchomi przypomnień (zadanie systemowe)', Boolean(deny.error));
    if (id) {
      const run = await admin.rpc('send_payment_reminders', { p_today: today });
      check('M7 zadanie systemowe (service role) — przypomnienia −3 utworzone', !run.error && Number(run.data) >= 2, run.error?.message ?? String(run.data));
      const rows = (await admin.from('notifications').select('id,user_id,channel,status,payload').eq('template', 'PAYMENT_REMINDER').contains('payload', { invoice_id: id })).data ?? [];
      m6.notes.push(...rows.map((x) => x.id));
      const users = (await admin.from('app_users').select('id,org_id,organizations(kind)')).data ?? [];
      const kindOf = (uid) => users.find((u) => u.id === uid)?.organizations?.kind;
      check('M7 odbiorcy wyłącznie płatnik (HHL) i wierzyciel (SCX)', rows.length > 0 && rows.every((x) => ['FORWARDER', 'CARRIER'].includes(kindOf(x.user_id))) && rows.some((x) => x.payload.party === 'PAYER') && rows.some((x) => x.payload.party === 'PAYEE'), JSON.stringify(rows.map((x) => [kindOf(x.user_id), x.payload.party, x.channel])));
      check('M7 dwa kanały: IN_APP i EMAIL (kolejka PENDING), kwota w walucie faktury', rows.some((x) => x.channel === 'IN_APP') && rows.some((x) => x.channel === 'EMAIL' && x.status === 'PENDING') && rows.every((x) => x.payload.currency === 'PLN' && Number(x.payload.gross) === 123 && x.payload.offset === -3));
      const ks = await sb.KSH.from('notifications').select('id').eq('template', 'PAYMENT_REMINDER').contains('payload', { invoice_id: id });
      check('M7 KSH nie dostaje przypomnień o fakturze SCX', !ks.error && ks.data.length === 0, ks.error?.message);
      const ss = await sb.SCX.from('notifications').select('id').eq('template', 'PAYMENT_REMINDER').eq('channel', 'IN_APP').contains('payload', { invoice_id: id });
      check('M7 SCX (wierzyciel) widzi przypomnienie w centrum powiadomień', !ss.error && ss.data.length === 1, ss.error?.message);
      const rd = await sb.SCX.rpc('mark_notifications_read', { p_ids: ss.data?.map((x) => x.id) ?? [] });
      check('M7 SCX oznacza przeczytane własne powiadomienie', !rd.error && rd.data === 1, rd.error?.message);
      const again = await admin.rpc('send_payment_reminders', { p_today: today });
      const cnt2 = (await admin.from('notifications').select('id').eq('template', 'PAYMENT_REMINDER').contains('payload', { invoice_id: id })).data?.length;
      check('M7 ponowne uruchomienie tego dnia — bez duplikatów', !again.error && cnt2 === rows.length, `${cnt2} vs ${rows.length}`);
      await sb.HHL.rpc('mark_invoice_paid', { p_invoice: id, p_paid_at: today });
      const em = (await admin.from('notifications').select('status').eq('template', 'PAYMENT_REMINDER').eq('channel', 'EMAIL').contains('payload', { invoice_id: id })).data ?? [];
      check('M7 opłacona → niewysłane e-maile anulowane (cisza)', em.length > 0 && em.every((x) => x.status === 'CANCELLED'), JSON.stringify(em));
      await admin.rpc('send_payment_reminders', { p_today: due });
      const after = (await admin.from('notifications').select('id').eq('template', 'PAYMENT_REMINDER').contains('payload', { invoice_id: id })).data ?? [];
      m6.notes.push(...after.map((x) => x.id));
      check('M7 opłacona → w dniu terminu przypomnienie nie wychodzi', after.length === rows.length, `${after.length} vs ${rows.length}`);
    }
  }
  // ---------- M9: pozycje z aplikacji kierowcy (report_position), process_position zamknięty, strefy ----------
  {
    const now = new Date().toISOString();
    const pp = { p_load_id: A.id, p_lat: 52.07391, p_lon: 17.0246, p_ts: now };
    const a1 = await anon.rpc('process_position', pp);
    check('M9 anon nie wywoła process_position (usterka domyślnego EXECUTE zamknięta)', Boolean(a1.error), a1.error ? '' : 'wywołanie przeszło');
    const a2 = await sb.SCX.rpc('process_position', pp);
    check('M9 zalogowany nie wywoła process_position wprost', Boolean(a2.error), a2.error ? '' : 'wywołanie przeszło');
    const a3 = await anon.rpc('report_position', pp);
    check('M9 anon nie wywoła report_position', Boolean(a3.error));
    const k = await sb.KSH.rpc('report_position', pp);
    check('M9 KSH nie zgłosi pozycji transportu', Boolean(k.error) && /przewoźnik/.test(k.error.message), k.error?.message);
    const fut = await sb.SCX.rpc('report_position', { ...pp, p_ts: new Date(Date.now() + 3600e3).toISOString() });
    check('M9 czas pozycji z przyszłości odrzucony', Boolean(fut.error) && /przyszłości/.test(fut.error.message), fut.error?.message);
    const weak = await sb.SCX.rpc('report_position', { ...pp, p_accuracy: 400 });
    check('M9 słaby fix (400 m) — przyjęty bez zapisu i bez stref', !weak.error && Array.isArray(weak.data) && weak.data.length === 0, weak.error?.message);
    const ev = await sb.KSH.from('load_events').insert({ load_id: A.id, event_type: 'MILESTONE_LOADED', occurred_at: now });
    check('M9 KSH nie zapisze MILESTONE_LOADED', Boolean(ev.error), ev.error ? '' : 'zapis przeszedł');
    const gf = (await admin.from('geofences').select('name,kind')).data ?? [];
    check('M9 strefa załadunku KSH Śrem (LOADING) w danych', gf.some((g) => g.kind === 'LOADING' && g.name === 'KSH Śrem · Grunwaldzka 27C'), JSON.stringify(gf.map((g) => g.kind)));
  }
  //@@NEXT@@
} finally {
  await cleanup();
  const left = [(await admin.from('load_cost').select('load_id').eq('load_id', A.id)).data?.length ?? 0, (await admin.from('load_revenue').select('load_id').eq('load_id', A.id)).data?.length ?? 0];
  check('sprzątanie: brak własnych resztek load_cost/load_revenue na TEST-BK3-A', left[0] === 0 && left[1] === 0, JSON.stringify(left));
  const leftInv = m6.inv.length ? ((await admin.from('invoices').select('id').in('id', m6.inv)).data?.length ?? 0) : 0;
  check('sprzątanie M6: brak faktur TEST', leftInv === 0, String(leftInv));
}
console.log(`\nEtap 4 money verify: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
