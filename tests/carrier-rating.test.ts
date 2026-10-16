/**
 * wyglad/J4 — „Ocena przewoźników” w Kokpicie (E9; E11/E12 „ocena przewoźnika to raport, nie ustawienie → Kokpit”;
 * D-20261014-1420-01 R7 pkt 2). Obliczenia widoku, dane demo i podłączenie ekranów.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSeedLoads, ORGS } from '../src/data/seed';
import { deliveryDeadlineMs, demoCarrierRating, demoMyRatings, inRatingRange, lateText, pctText, rangeDays, unloadDayOf } from '../src/lib/carrierRating';
import type { Load } from '../src/types';

const NOW = '2026-10-16T06:10:00Z';

describe('J4 — okres i „na czas”', () => {
  it('4 tygodnie = 28 dni rozładunku do dziś (czas polski); „Całość” do dziś; „Własny okres” z pól (puste = bez granicy)', () => {
    expect(rangeDays('4w', NOW)).toEqual({ from: '2026-09-19', to: '2026-10-16' });
    expect(rangeDays('all', NOW)).toEqual({ from: null, to: '2026-10-16' });
    expect(rangeDays('custom', NOW, { from: '2026-10-01', to: '' })).toEqual({ from: '2026-10-01', to: null });
    expect(rangeDays('custom', NOW, { from: '', to: '' })).toEqual({ from: null, to: null });
  });

  it('F7: oceny SCX w okresie liczone po dniu rozładunku transportu, nie po dacie oceny', () => {
    const l = buildSeedLoads().find((x) => x.status === 'DELIVERED')!;
    const day = unloadDayOf(l)!;
    expect(inRatingRange(l, 'custom', NOW, { from: day, to: day })).toBe(true);
    expect(inRatingRange(l, 'custom', NOW, { from: '2099-01-01', to: '' })).toBe(false);
    expect(inRatingRange(undefined, 'custom', NOW, { from: '2026-01-01', to: '' })).toBe(false);
    expect(inRatingRange(undefined, 'custom', NOW, { from: '', to: '' })).toBe(true);
  });

  it('koniec okna dostawy z awizacji, a bez okna — koniec dnia dostawy w czasie polskim (lato i zima)', () => {
    const base = buildSeedLoads()[0];
    const win = { ...base, awizacja: { ...base.awizacja, unloadWindowEnd: '2026-10-15T14:00:00Z' } } as Load;
    expect(deliveryDeadlineMs(win)).toBe(Date.parse('2026-10-15T14:00:00Z'));
    const noWin = { ...base, plannedDeliverDate: '2026-10-15', awizacja: { ...base.awizacja, unloadWindowEnd: null } } as Load;
    expect(deliveryDeadlineMs(noWin)).toBe(Date.parse('2026-10-15T21:59:59Z'));
    const winter = { ...noWin, plannedDeliverDate: '2026-12-15' } as Load;
    expect(deliveryDeadlineMs(winter)).toBe(Date.parse('2026-12-15T22:59:59Z'));
  });

  it('teksty: procent ze spacją, spóźnienie w min / h / d', () => {
    expect(pctText(5, 6)).toBe('83 %');
    expect(pctText(0, 0)).toBe('—');
    expect(lateText(null)).toBe('—');
    expect(lateText(45)).toBe('45 min');
    expect(lateText(130)).toBe('2 h 10 min');
    expect(lateText(120)).toBe('2 h');
    expect(lateText(27 * 60)).toBe('1 d 3 h');
  });
});

describe('J4 — dane demo', () => {
  const loads = buildSeedLoads();

  it('HHL: wiersz na przewoźnika, z winy przewoźnika ≤ spóźnione, ocena 3–5; bez rozładunków z przyszłości', () => {
    const rows = demoCarrierRating(loads, ORGS, 'all', NOW);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.onTime + r.lateCarrier).toBeLessThanOrEqual(r.delivered);
      expect(r.avgScore).not.toBeNull();
      expect(r.avgScore!).toBeGreaterThanOrEqual(3);
      expect(r.avgScore!).toBeLessThanOrEqual(5);
      expect(r.ratings).toBe(r.delivered);
    }
    expect(rows[0].name).toBe('Scandinavian Express');
    /* demo: część transportów spóźniona (G-09) — kolumna spóźnień nie jest pusta */
    expect(rows[0].delivered - rows[0].onTime).toBeGreaterThan(0);
    expect(rows[0].avgLateMin).not.toBeNull();
    /* F7: tylko rozładowane do „teraz” — rozładunki demo z przyszłości nie wchodzą */
    const future = loads.filter((l) => ['DELIVERED', 'UNLOADING'].includes(l.status) && (unloadDayOf(l) ?? '') > '2026-10-16');
    expect(future.length).toBeGreaterThan(0);
    expect(rows.reduce((a, r) => a + r.delivered, 0)).toBeLessThanOrEqual(loads.length - future.length);
  });

  it('SCX: tylko swój wiersz i oceny swoich transportów, najnowsze pierwsze', () => {
    const rows = demoCarrierRating(loads, ORGS, 'all', NOW, 'org-scx');
    expect(rows.every((r) => r.carrierId === 'org-scx')).toBe(true);
    const mine = demoMyRatings(loads, 'org-scx', 'all', NOW);
    expect(mine.length).toBe(rows[0]?.delivered ?? 0);
    for (let i = 1; i < mine.length; i++) expect(Date.parse(mine[i - 1].ratedAt)).toBeGreaterThanOrEqual(Date.parse(mine[i].ratedAt));
    expect(mine.every((m) => Date.parse(m.ratedAt) <= Date.parse(NOW))).toBe(true);
  });

  it('„4 tygodnie” nie liczy więcej niż „Całość”', () => {
    const all = demoCarrierRating(loads, ORGS, 'all', NOW).reduce((a, r) => a + r.delivered, 0);
    const w4 = demoCarrierRating(loads, ORGS, '4w', NOW).reduce((a, r) => a + r.delivered, 0);
    expect(w4).toBeLessThanOrEqual(all);
  });
});

describe('J4 — miejsce w aplikacji', () => {
  it('Kokpit HHL i SCX (demo i produkcja), KSH bez; Opcje i Ustawienia bez oceny', () => {
    const dash = readFileSync('src/views/DashboardView.tsx', 'utf8');
    expect(dash).toContain("import('../auth/CarrierRatingLive')");
    expect(dash).toContain('<CarrierRatingDemo />');
    expect(dash).toContain("role === 'HHL' || role === 'SCX'");
    for (const f of ['src/views/OptionsView.tsx', 'src/views/SettingsView.tsx']) expect(readFileSync(f, 'utf8')).not.toContain('CarrierScorecard');
    const live = readFileSync('src/auth/CarrierRatingLive.tsx', 'utf8');
    expect(live).toContain("sb.rpc('carrier_scorecard'");
    expect(live).toContain("from('carrier_ratings')");
    expect(live).not.toContain("gte('rated_at'");
    expect(live).toContain('inRatingRange(');
  });
});
