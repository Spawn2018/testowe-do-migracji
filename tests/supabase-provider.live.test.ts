/**
 * BK3 — SupabaseProvider na hostowanym Supabase. Uruchamiany WYŁĄCZNIE przy
 * SUPABASE_LIVE=1 (sekrety z .env.local; bez wysyłki e-maili — magic link przez
 * auth.admin.generate_link). Service role służy tylko do przygotowania fixture
 * po stronie serwera (node); provider działa na sesji użytkownika + RLS.
 * Fixture: transporty `TEST-BK3-A` (przewoźnik SCX) i `TEST-BK3-B` (bez przewoźnika),
 * tworzone idempotentnie; zdarzenia są append-only (0001), więc zostają.
 *   SUPABASE_LIVE=1 npx vitest run tests/supabase-provider.live.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient as createClientRaw, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { createSupabaseProvider } from '../src/data/supabaseProvider';
import { friendlyDbError, orderGateMessage } from '../src/lib/orderNumbers';

const LIVE = process.env.SUPABASE_LIVE === '1';
// Node < 22 nie ma natywnego WebSocket — realtime nieużywany, ale klient go inicjuje.
const createClient = (url: string, key: string, o: Record<string, unknown> = {}) =>
  createClientRaw(url, key, { ...o, realtime: { transport: WebSocket as unknown as never } });
type Org = 'HHL' | 'KSH' | 'SCX';
const ENV_KEY: Record<Org, string> = { HHL: 'TEST_USER_HHL_EMAIL', KSH: 'TEST_USER_KSH_EMAIL', SCX: 'TEST_USER_SCX_EMAIL' };

describe.runIf(LIVE)('BK3 SupabaseProvider (live, RLS)', () => {
  let env: Record<string, string>;
  let admin: SupabaseClient;
  const users = {} as Record<Org, SupabaseClient>;
  const P = {} as Record<Org, ReturnType<typeof createSupabaseProvider>>;
  let loadA = '';
  let loadB = '';
  const tag = `bk3-${Date.now()}`;

  beforeAll(async () => {
    const { loadEnvLocal } = await import('../scripts/auth/env.mjs');
    env = loadEnvLocal();
    admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: orgs } = await admin.from('organizations').select('id,code');
    const org = Object.fromEntries((orgs ?? []).map((o) => [o.code, o.id]));
    const { data: proj } = await admin.from('projects').select('id').eq('code', 'STEGRA_BODEN').single();
    async function fixture(code: string, carrier: string | null, hhlNo: string | null) {
      const found = await admin.from('loads').select('id').eq('order_no', code).maybeSingle();
      let id = found.data?.id as string | undefined;
      if (!id) {
        const ins = await admin.from('loads').insert({ project_id: proj!.id, order_no: code, carrier_org_id: carrier, hhl_order_no: hhlNo, status: 'PLANNED', plan_load_date: '2026-10-05', plan_delivery_date: '2026-10-09' }).select('id').single();
        if (ins.error) throw new Error(ins.error.message);
        id = ins.data.id as string;
        const it = await admin.from('shipment_items').insert({ project_id: proj!.id, load_id: id, shipment_code: code, item_type: 'TEST', length_m: 12, width_m: 3, height_m: 3, qty: 1, total_weight_t: 10, assembly_seq: 9000 });
        if (it.error) throw new Error(it.error.message);
      } else {
        await admin.from('loads').update({ status: 'PLANNED', driver_name: null, carrier_org_id: carrier, hhl_order_no: hhlNo }).eq('id', id);
      }
      return id;
    }
    loadA = await fixture('TEST-BK3-A', org.SCX, 'TEST-BK3-A-HHL');
    loadB = await fixture('TEST-BK3-B', null, null);
    for (const o of ['HHL', 'KSH', 'SCX'] as Org[]) {
      const g = await admin.auth.admin.generateLink({ type: 'magiclink', email: env[ENV_KEY[o]].toLowerCase() });
      if (g.error) throw new Error(g.error.message);
      const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const v = await c.auth.verifyOtp({ token_hash: g.data.properties.hashed_token, type: 'magiclink' });
      if (v.error) throw new Error(v.error.message);
      users[o] = c;
      P[o] = createSupabaseProvider(c);
    }
  }, 60_000);

  it('snapshot: HHL i KSH widzą oba transporty, SCX tylko swój (RLS loads_read)', async () => {
    const [h, k, s] = await Promise.all([P.HHL.loadSnapshot(), P.KSH.loadSnapshot(), P.SCX.loadSnapshot()]);
    const ids = (x: typeof h) => new Set(x.loads.map((l) => l.id));
    expect(ids(h).has(loadA) && ids(h).has(loadB)).toBe(true);
    expect(ids(k).has(loadA) && ids(k).has(loadB)).toBe(true);
    expect(ids(s).has(loadA)).toBe(true);
    expect(ids(s).has(loadB)).toBe(false);
    const a = s.loads.find((l) => l.id === loadA)!;
    expect(a).toMatchObject({ code: 'TEST-BK3-A', status: 'PLANNED', carrierId: 'org-scx', plannedLoadDate: '2026-10-05' });
    expect(a.pricing.costTotal).toBe(0);
    expect(h.invoices).toEqual([]);
  });

  it('SCX: zasoby + status swojego transportu przez provider; cudzy odrzucony', async () => {
    await P.SCX.apply({ type: 'load.resources', loadId: loadA, patch: { driverName: `Test ${tag}` } });
    await P.SCX.apply({ type: 'load.status', loadId: loadA, status: 'READY' });
    await expect(P.SCX.apply({ type: 'load.resources', loadId: loadB, patch: { driverName: 'x' } })).rejects.toThrow();
    const h = await P.HHL.loadSnapshot();
    const a = h.loads.find((l) => l.id === loadA)!;
    expect(a.resources.driverName).toBe(`Test ${tag}`);
    expect(a.status).toBe('READY');
    expect(a.hhlOrderNo).toBe('TEST-BK3-A-HHL');
  });

  it('reguła serwera (0003): READY bez numeru zlecenia HHL odrzucone — błąd trafia do UI', async () => {
    await expect(P.HHL.apply({ type: 'load.status', loadId: loadB, status: 'READY' })).rejects.toThrow(/numeru zlecenia HHL/);
  });

  it('M5: numery zleceń przez provider — każda strona swój; błąd bazy → komunikat zrozumiały', async () => {
    const err = await P.HHL.apply({ type: 'load.status', loadId: loadB, status: 'READY' }).catch((e: Error) => e.message);
    expect(friendlyDbError(String(err), 'pl')).toBe(orderGateMessage('NO_HHL_ORDER', 'pl'));
    const cross = await P.HHL.apply({ type: 'load.orderNo', loadId: loadA, side: 'CARRIER', value: 'TEST-X' }).catch((e: Error) => e.message);
    expect(friendlyDbError(String(cross), 'pl')).toMatch(/wpisuje wyłącznie przewoźnik/);
    const cross2 = await P.SCX.apply({ type: 'load.orderNo', loadId: loadA, side: 'HHL', value: 'TEST-X' }).catch((e: Error) => e.message);
    expect(friendlyDbError(String(cross2), 'pl')).toMatch(/Numer zlecenia HHL wpisuje wyłącznie HHL/);
    await P.SCX.apply({ type: 'load.orderNo', loadId: loadA, side: 'CARRIER', value: 'TEST-BK3-A-SCX' });
    const snap = await P.HHL.loadSnapshot();
    expect(snap.loads.find((l) => l.id === loadA)?.carrierOrderNo).toBe('TEST-BK3-A-SCX');
    await P.SCX.apply({ type: 'load.orderNo', loadId: loadA, side: 'CARRIER', value: null });
  });

  it('KSH nie zmienia statusu (brak polityki update dla klienta)', async () => {
    await expect(P.KSH.apply({ type: 'load.status', loadId: loadA, status: 'DELIVERED' })).rejects.toThrow();
  });

  it('zdarzenia: SCX dla swojego transportu OK, dla niewidocznego odrzucone; aktor ustawiony przez serwer', async () => {
    const r = await P.SCX.apply({ type: 'event.append', event: { loadId: loadA, type: 'NOTE', at: new Date().toISOString(), actor: 'SCX', note: tag } });
    expect(r && r.id).toBeTruthy();
    await expect(P.SCX.apply({ type: 'event.append', event: { loadId: loadB, type: 'NOTE', at: new Date().toISOString(), actor: 'SCX' } })).rejects.toThrow();
    const h = await P.HHL.loadSnapshot();
    expect(h.events.some((e) => e.loadId === loadA && e.note === tag && e.actor === 'SCX')).toBe(true);
    const { data } = await admin.from('load_events').select('actor_id').eq('id', Number(r!.id)).single();
    expect(data?.actor_id).toBeTruthy();
  });

  it('wiadomości: autor/firma ustawiane przez serwer (bez podszywania)', async () => {
    const r = await P.KSH.apply({ type: 'message.send', loadId: loadA, text: `msg ${tag}` });
    const s = await P.SCX.loadSnapshot();
    const m = s.messages.find((x) => x.text === `msg ${tag}`);
    expect(m?.org).toBe('KSH');
    await admin.from('load_messages').delete().eq('id', Number(r!.id));
  });

  it('strefy: HHL_ADMIN zapisuje okrąg (widok v_geofences_circle), KSH odrzucony', async () => {
    const g = { id: 'gf-local-test', name: `TEST ${tag}`, type: 'CHECKPOINT' as const, shape: 'circle' as const, lat: 60.674, lng: 17.141, radiusM: 1500, hysteresisM: 300, dwellMin: 0, samplesRequired: 1, notifyHhl: true, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' as const };
    const r = await P.HHL.apply({ type: 'geofence.save', geofence: g });
    const id = (r as { id: string }).id;
    try {
      const s = await P.SCX.loadSnapshot();
      const got = s.geofences.find((x) => x.id === id)!;
      expect(got).toBeTruthy();
      expect(Math.abs(got.radiusM - 1500) / 1500).toBeLessThan(0.02);
      expect(Math.abs(got.lat - 60.674)).toBeLessThan(0.01);
      expect(got).toMatchObject({ notifyHhl: true, notifyKsh: false, notifyScx: true, trigger: 'ENTER' });
      await P.HHL.apply({ type: 'geofence.save', geofence: { ...got, active: false } });
      expect((await P.HHL.loadSnapshot()).geofences.find((x) => x.id === id)?.active).toBe(false);
      await expect(P.KSH.apply({ type: 'geofence.save', geofence: g })).rejects.toThrow();
    } finally {
      await admin.from('geofences').delete().eq('id', id);
    }
  });

  it('M4: ustawienia użytkownika przez provider (user_preferences) — zapis i odczyt własnych', async () => {
    const before = await P.KSH.loadPreferences!();
    try {
      await P.KSH.apply({ type: 'prefs.save', prefs: { displayCurrency: 'PLN' } });
      await P.KSH.apply({ type: 'prefs.save', prefs: { locale: 'sv', theme: 'dark' } });
      expect(await P.KSH.loadPreferences!()).toEqual({ displayCurrency: 'PLN', locale: 'sv', theme: 'dark' });
      const scx = await P.SCX.loadPreferences!();
      expect(scx?.locale).not.toBe('sv'); // cudze ustawienia niewidoczne
    } finally {
      if (before) await P.KSH.apply({ type: 'prefs.save', prefs: before });
      else {
        const { data: u } = await admin.from('app_users').select('id').ilike('email', env.TEST_USER_KSH_EMAIL).single();
        await admin.from('user_preferences').delete().eq('user_id', u!.id);
      }
    }
  });

  it('M6: faktury przez provider — SCX rejestruje → HHL weryfikuje i oznacza „Opłacona”; HHL → KSH weryfikuje', async () => {
    const pdf = new Blob([new TextEncoder().encode('%PDF-1.4\n%TEST-M6-LIVE\n')], { type: 'application/pdf' });
    const base = (direction: 'KOSZT' | 'PRZYCHOD', number: string, net: number) => ({
      id: 'local', direction, issuer: direction === 'KOSZT' ? 'SCX' : 'HHL', recipient: direction === 'KOSZT' ? 'HHL' : 'KSH',
      number, issueDate: '2026-09-20', weekKey: '2026-W38', currency: 'EUR', net, vat: 0, gross: net,
      dueDate: '', dueFromDocument: false, verification: 'DO_WERYFIKACJI', payment: 'NIEOPLACONA', pdfName: `${number}.pdf`,
      lines: [{ loadId: loadA, invoicedNet: net, flags: [] }], headerFlags: [], missingLoadIds: [], createdAt: '',
    } as const);
    const made: string[] = [];
    try {
      const k = await P.SCX.apply({ type: 'bill.register', bill: { ...base('KOSZT', `TEST-M6-L-K-${tag}`, 2000), lines: [{ loadId: loadA, invoicedNet: 2000, flags: [] }] }, file: pdf });
      const kid = (k as { id: string }).id;
      made.push(kid);
      const hs = await P.HHL.loadSnapshot();
      const kb = hs.bills.find((b) => b.id === kid)!;
      expect(kb.issuer).toBe('SCX');
      expect(kb.pdfStoragePath).toBeTruthy();
      expect((await P.KSH.loadSnapshot()).bills.find((b) => b.id === kid)).toBeUndefined();
      await expect(P.SCX.apply({ type: 'bill.verify', billId: kid, verification: 'ZAAKCEPTOWANA', note: null })).rejects.toThrow();
      await expect(P.SCX.apply({ type: 'bill.paid', billId: kid, paidAt: '2026-09-25' })).rejects.toThrow();
      await P.HHL.apply({ type: 'bill.verify', billId: kid, verification: 'ZAAKCEPTOWANA', note: null });
      await P.HHL.apply({ type: 'bill.paid', billId: kid, paidAt: '2026-09-25' });
      const sb = (await P.SCX.loadSnapshot()).bills.find((b) => b.id === kid)!;
      expect(sb.verification).toBe('ZAAKCEPTOWANA');
      expect(sb.payment).toBe('OPLACONA');
      const p = await P.HHL.apply({ type: 'bill.register', bill: base('PRZYCHOD', `TEST-M6-L-P-${tag}`, 2500), file: pdf });
      const pid = (p as { id: string }).id;
      made.push(pid);
      expect((await P.SCX.loadSnapshot()).bills.find((b) => b.id === pid)).toBeUndefined();
      await expect(P.KSH.apply({ type: 'bill.verify', billId: pid, verification: 'SPORNA', note: null })).rejects.toThrow();
      await P.KSH.apply({ type: 'bill.verify', billId: pid, verification: 'SPORNA', note: 'TEST-M6 stawka' });
      const kb2 = (await P.KSH.loadSnapshot()).bills.find((b) => b.id === pid)!;
      expect(kb2.verification).toBe('SPORNA');
      expect(kb2.disputeNote).toBe('TEST-M6 stawka');
      expect(kb2.dueDate).toBe('2026-10-20');
    } finally {
      const { data: docs } = await admin.from('invoices').select('document_id').in('id', made);
      await admin.from('invoices').delete().in('id', made);
      for (const m of made) await admin.from('notifications').delete().contains('payload', { invoice_id: m });
      const ids = (docs ?? []).map((d) => d.document_id).filter(Boolean) as string[];
      const { data: rows } = await admin.from('documents').select('id,storage_path').in('id', ids);
      for (const r of rows ?? []) { const i = r.storage_path.indexOf('/'); await admin.storage.from(r.storage_path.slice(0, i)).remove([r.storage_path.slice(i + 1)]); }
      await admin.from('documents').delete().in('id', ids);
      // Z1 z rejestracji: poziom FAKTURA na wierszach testowych — wiersze usuwa fixture M2 (verify.mjs); tu tylko kwota
      await admin.from('load_cost').update({ invoiced_total_eur: null }).eq('load_id', loadA);
      await admin.from('load_revenue').update({ invoiced_total_eur: null }).eq('load_id', loadA);
    }
  }, 60_000);

  it('M7: przypomnienie o płatności w centrum powiadomień (płatnik i wierzyciel, nie KSH); przeczytane zapisywane', async () => {
    const pdf = new Blob([new TextEncoder().encode('%PDF-1.4\n%TEST-M7-LIVE\n')], { type: 'application/pdf' });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const x = new Date(`${today}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 3);
    const due = x.toISOString().slice(0, 10);
    const number = `TEST-M7-L-${tag}`;
    let id = '';
    try {
      const r = await P.SCX.apply({ type: 'bill.register', file: pdf, bill: {
        id: 'local', direction: 'KOSZT', issuer: 'SCX', recipient: 'HHL', number, issueDate: today, weekKey: '2026-W38', currency: 'EUR',
        net: 10, vat: 0, gross: 10, dueDate: due, dueFromDocument: true, verification: 'DO_WERYFIKACJI', payment: 'NIEOPLACONA',
        pdfName: `${number}.pdf`, lines: [{ loadId: loadA, invoicedNet: 10, flags: [] }], headerFlags: [], missingLoadIds: [], createdAt: '',
      } });
      id = (r as { id: string }).id;
      const run = await admin.rpc('send_payment_reminders', { p_today: today });
      expect(run.error).toBeNull();
      const mine = (await P.SCX.loadSnapshot()).notifications.filter((n) => n.href?.entityId === id);
      expect(mine).toHaveLength(1);
      expect(mine[0].id).toMatch(/^srv-\d+$/);
      expect(mine[0].title).toContain(number);
      expect(mine[0].read).toBe(false);
      expect((await P.HHL.loadSnapshot()).notifications.filter((n) => n.href?.entityId === id)).toHaveLength(1);
      expect((await P.KSH.loadSnapshot()).notifications.filter((n) => n.href?.entityId === id)).toHaveLength(0);
      await P.SCX.apply({ type: 'notifications.read', ids: [Number(mine[0].id.slice(4))] });
      expect((await P.SCX.loadSnapshot()).notifications.find((n) => n.id === mine[0].id)?.read).toBe(true);
    } finally {
      if (id) {
        const { data: inv } = await admin.from('invoices').select('document_id').eq('id', id).single();
        await admin.from('invoices').delete().eq('id', id);
        await admin.from('notifications').delete().contains('payload', { invoice_id: id });
        const { data: doc } = await admin.from('documents').select('id,storage_path').eq('id', inv?.document_id ?? '').maybeSingle();
        if (doc) { const i = doc.storage_path.indexOf('/'); await admin.storage.from(doc.storage_path.slice(0, i)).remove([doc.storage_path.slice(i + 1)]); await admin.from('documents').delete().eq('id', doc.id); }
        await admin.from('load_cost').update({ invoiced_total_eur: null }).eq('load_id', loadA);
      }
    }
  }, 60_000);

  it('M10: ścieżka TEST-M10 port Gdańsk → PROM → plac (scripts/ferry/path-scenario.sql) widoczna na 3 kontach; rejs po odejściu zablokowany dla SCX', async () => {
    const snaps = { HHL: await P.HHL.loadSnapshot(), KSH: await P.KSH.loadSnapshot(), SCX: await P.SCX.loadSnapshot() };
    let loadId = '';
    for (const o of ['HHL', 'KSH', 'SCX'] as Org[]) {
      const s = snaps[o];
      const l = s.loads.find((x) => x.code === 'TEST-M10');
      expect(l, `${o} widzi TEST-M10 (uruchom path-scenario.sql)`).toBeTruthy();
      expect(l!.status).toBe('APPROACHING_SITE');
      const sail = s.sailings.find((x) => x.id === l!.sailingId);
      expect(sail?.vessel).toContain('Wawel');
      const auto = s.events.filter((e) => e.loadId === l!.id && e.type === 'STATUS_AUTO');
      // PRE_ARRIVAL (SE) i SITE przy tym samym fiksie mają ten sam occurred_at — kolejność wg ścieżki statusów.
      const RANK = ['AT_PORT_GDANSK', 'FERRY', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE'];
      const to = (e: (typeof auto)[number]) => String((e.payload as Record<string, unknown>).to);
      auto.sort((a, b) => a.at.localeCompare(b.at) || RANK.indexOf(to(a)) - RANK.indexOf(to(b)));
      expect(auto.map((e) => (e.payload as Record<string, unknown>).to)).toEqual(['AT_PORT_GDANSK', 'FERRY', 'AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE']);
      expect(auto.every((e) => typeof (e.payload as Record<string, unknown>).powod === 'string')).toBe(true);
      loadId = l!.id;
    }
    const err = await P.SCX.apply({ type: 'load.sailing', loadId, sailingId: null, bookingRef: null }).then(() => '', (e: Error) => e.message);
    expect(friendlyDbError(err)).toBe('Rejs po wypłynięciu może zmienić wyłącznie HHL.');
  });

  it('anon (bez sesji) nie czyta transportów', async () => {
    const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.from('loads').select('id');
    expect(data ?? []).toEqual([]);
  });
});
