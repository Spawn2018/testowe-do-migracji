/**
 * wyglad/E49 (decyzja właściciela 16.10.2026, 02:08; D-20261016-0230-01 Z1, Z3, Z4): sprawa SCX „Objazd czy postój?”
 * (szybsza możliwość, ryzyka ostrzeżenia pierwsze, pilność), linie wiatru / postoju / śliskości / objazdu w ETA
 * z `eta_basis.causes.weather`, produkcja bez danych demo, teksty bez „15 m/s”.
 */
import { describe, expect, it, vi } from 'vitest';
import { fasterOf, hasDetour, kmText, minText, sortRisks, urgentOf, type DetourCase } from '../src/lib/e49Detour';
import { etaWxFromCauses } from '../src/lib/e49Wx';
import { E49_WX_PL } from '../src/i18n/e49Wx';
import { etaDetailFromBasis } from '../src/lib/etaDetail';
import { E49_PL } from '../src/i18n/e49';
import { demoDetourCase } from '../src/lib/e49Demo';
import type { Load } from '../src/types';

const sp = (s: string) => s.replace(/ /g, ' ');
const NOW = '2026-10-16T10:00:00Z';
const load = (code: string, extra: Partial<Load> = {}) => ({
  id: `id-${code}`, code, itemType: 'Transformator · E4 closure', status: 'IN_TRANSIT_SE', etaBoden: '2026-10-17T06:00:00Z',
  dims: { lengthM: 16.2, widthM: 3.35, heightM: 4.25, weightT: 31.2 }, ...extra,
}) as unknown as Load;

describe('„Objazd czy postój?” — porównanie', () => {
  const c = demoDetourCase(load('T-17'), NOW);
  it('postój do końca zamknięcia + 30 min; objazd z km, czasem i trasą', () => {
    expect(Date.parse(c.hold.untilIso!) - Date.parse(c.untilIso!)).toBe(30 * 60_000);
    expect(hasDetour(c.detour)).toBe(true);
    if (!hasDetour(c.detour)) return;
    expect(c.detour.addKm).toBeGreaterThan(0);
    expect(c.detour.via).toContain('Kramfors');
  });
  it('szybsza możliwość i o ile', () => {
    const f = fasterOf(c)!;
    expect(f.pick).toBe('DETOUR');
    expect(f.byMin).toBe(c.hold.addMin - (hasDetour(c.detour) ? c.detour.addMin : 0));
    expect(fasterOf({ ...c, detour: { none: true, why: 'HERE: brak trasy dla 3,52 m' } })).toBeNull();
  });
  it('ryzyka: ostrzeżenia pierwsze; zezwolenie „Trasa” (KR) — ostrzeżenie, inne — dozwolone', () => {
    const kr = demoDetourCase(load('KR-01'), NOW);
    const permit = (x: DetourCase) => (hasDetour(x.detour) ? x.detour.risks.find((r) => r.kind === 'PERMIT') : undefined);
    expect(permit(kr)?.level).toBe('warn');
    expect(permit(c)?.level).toBe('ok');
    const sorted = sortRisks(hasDetour(c.detour) ? c.detour.risks : []);
    const firstOk = sorted.findIndex((r) => r.level === 'ok');
    expect(sorted.slice(firstOk).every((r) => r.level === 'ok')).toBe(true);
  });
  it('pilna, gdy do decyzji ≤ 60 min albo termin minął', () => {
    expect(urgentOf({ decideByIso: '2026-10-16T11:30:00Z' }, NOW)).toBe(false);
    expect(urgentOf({ decideByIso: '2026-10-16T10:50:00Z' }, NOW)).toBe(true);
    expect(urgentOf({ decideByIso: '2026-10-16T09:00:00Z' }, NOW)).toBe(true);
  });
  it('liczby po polsku w jednej linii', () => {
    expect(sp(minText(35))).toBe('35 min');
    expect(sp(minText(65))).toBe('1 h 05 min');
    expect(sp(minText(180))).toBe('3 h');
    expect(sp(kmText(1234))).toBe('+1 234 km');
  });
});

describe('ETA: wiatr, postój, śliskość, objazd z `causes.weather`', () => {
  const raw = [
    { kind: 'WIND', addMin: 14.4, where: 'E4 Skellefteå–Piteå', gustMs: 22, side: 'CROSS', atIso: NOW, source: 'SMHI' },
    { kind: 'WIND_HOLD', addMin: 390, where: 'E4 Umeå–Skellefteå', gustMs: 27, source: 'SMHI' },
    { kind: 'NOPE', addMin: 5, where: 'x' },
    { kind: 'SLIPPERY', addMin: 'x', where: 'E4' },
  ];
  it('tylko poprawne wpisy, największy wpływ pierwszy', () => {
    const wx = etaWxFromCauses(raw);
    expect(wx.map((w) => [w.kind, w.addMin])).toEqual([['WIND_HOLD', 390], ['WIND', 14]]);
    expect(etaWxFromCauses(null)).toEqual([]);
  });
  it('etaDetailFromBasis przenosi linie do `etaDetail.weather`', () => {
    const d = etaDetailFromBasis({ segment: 'SE_ROAD', causes: { weather: raw } } as never, 'IN_TRANSIT_SE');
    expect(d?.weather?.length).toBe(2);
  });
});

describe('teksty i źródło', () => {
  it('bez „sms:” / „mailto:” / „supabase” (I-2) i bez dawnego progu 15 m/s (D-84 = 20 m/s)', () => {
    const all = [E49_PL, E49_WX_PL].map((o) => Object.keys(o).join('\n') + Object.values(o).join('\n')).join('\n').toLowerCase();
    for (const bad of ['sms:', 'mailto:', 'supabase', '15 m/s']) expect(all).not.toContain(bad);
  });
  it('produkcja przed podłączeniem: brak spraw, zapis zablokowany, linie ETA z bazy', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const m = await import('../src/lib/e49Source');
      const l = load('T-17');
      expect(m.detourCasesOf('SCX', [l], NOW, new Set([l.id]))).toEqual([]);
      expect(m.detourDecideOf()).toBeNull();
      expect(m.etaWxOf(l, [l], NOW)).toEqual([]);
      expect(m.demoDetourLoadId([l], null)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('demo: sprawa przy transporcie w drodze przez Szwecję, który ma kartę; KSH bez spraw; po decyzji sprawa znika', async () => {
    const m = await import('../src/lib/e49Source');
    const a = load('SG-31', { itemType: 'Segment ramy · weather hold' });
    const b = load('T-17');
    const cards = new Set([a.id, b.id]);
    expect(m.detourCasesOf('KSH', [a, b], NOW, cards)).toEqual([]);
    const got = m.detourCasesOf('SCX', [a, b], NOW, cards);
    expect(got.map((c) => c.loadId)).toEqual([b.id]);
    await m.detourDecideOf()!(got[0]!.id, { pick: 'DETOUR', by: 'Jan Nowak // SCX', atIso: NOW, note: null });
    expect(m.detourCasesOf('SCX', [a, b], NOW, cards)).toEqual([]);
    expect(m.etaWxOf(b, [a, b], NOW).map((w) => w.kind)).toContain('DETOUR');
    expect(m.etaWxOf(a, [a, b], NOW).map((w) => w.kind)).toContain('WIND_HOLD');
  });
});
