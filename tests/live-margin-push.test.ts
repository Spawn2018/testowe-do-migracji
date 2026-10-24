/**
 * #412 E16 + E11 na produkcji (baza 0288): próg marży z `margin_threshold_get` (tylko HHL) dla Finansów, Harmonogramu,
 * panelu Ceny i Opcji (zapis `margin_threshold_set`); liczba urządzeń push — Twoje i wszystkich osób (`push_devices_count`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { marginFromDb, prodMarginState, setMarginFromServer } from '../src/lib/p5Source';

describe('próg marży z bazy — mapowanie', () => {
  afterEach(() => setMarginFromServer(undefined));
  it('pct z bazy, null = wyłączony, zły kształt → undefined', () => {
    expect(marginFromDb({ pct: 4, changed: null })).toBe(4);
    expect(marginFromDb({ pct: '4.5' })).toBe(4.5);
    expect(marginFromDb({ pct: null })).toBeNull();
    for (const raw of [null, 'x', {}, { pct: 'abc' }, { pct: 120 }, { pct: -1 }]) expect(marginFromDb(raw)).toBeUndefined();
  });
  it('pamięć podręczna: undefined = nie wczytano (Opcje bez pola), null = wyłączony', () => {
    expect(prodMarginState()).toBeUndefined();
    setMarginFromServer(null);
    expect(prodMarginState()).toBeNull();
    setMarginFromServer(6);
    expect(prodMarginState()).toBe(6);
  });
});

describe('podłączenie', () => {
  const prov = readFileSync('src/data/supabaseProvider.ts', 'utf8');
  const p5b = readFileSync('src/lib/marginDb.ts', 'utf8');
  const p5 = readFileSync('src/lib/p5Source.ts', 'utf8');
  const who = readFileSync('src/auth/LiveWhoGets.tsx', 'utf8');
  const scr = readFileSync('src/components/options/WhoGetsScreen.tsx', 'utf8');
  it('próg wczytuje tylko HHL; KSH i SCX bez wywołania', () => {
    expect(prov).toContain("const marginP = isHhl ? sb.rpc('margin_threshold_get') : Promise.resolve(null);");
    expect(prov).toContain('if (!mq) setMarginFromServer(undefined);');
    expect(prov).toContain('else if (!mq.error) setMarginFromServer(marginFromDb(mq.data));');
    expect(readFileSync('src/data/supabaseBridge.ts', 'utf8')).toContain('setMarginFromServer(undefined); // #412 E16');
    expect(p5).toContain("demoMarginThreshold() : prodMargin ?? null");
  });
  it('zapis progu: margin_threshold_set(p_pct); wynik z bazy do pamięci', () => {
    expect(p5b).toContain("sb.rpc('margin_threshold_set', { p_pct: pct })");
    expect(p5b).toContain('if (v !== undefined) setMarginFromServer(v);');
  });
  it('urządzenia: push_devices_count (own/all), zapasowo własne z RLS', () => {
    expect(who).toContain("sb.rpc('push_devices_count')");
    expect(who).toContain("all: devicesAll");
    expect(scr).toContain("tp(locale, 'p3c_push_devices_all_n', { n: cards.push.all })");
  });
});
