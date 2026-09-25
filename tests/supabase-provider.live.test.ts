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

  it('anon (bez sesji) nie czyta transportów', async () => {
    const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.from('loads').select('id');
    expect(data ?? []).toEqual([]);
  });
});
