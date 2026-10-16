/**
 * wyglad/W-dane (D-20261016-2130-01): wygląd bez czekania na dane wykonawcy.
 * 1. „Inne pliki” z „+ Dodaj” i rodzaj „Inne” (E31 pkt 5; D-20261014-2005-01 S4 pkt 7) — demo: wiele plików bez wersji;
 *    produkcja: wyłączone do podłączenia `OTHER`.
 * 2. Linia objazdu po decyzji SCX „Jedziemy objazdem” (E45; D-20261016-0230-01 Z3 pkt 8).
 * 3. Przeprawy z HERE (E45 pkt 1, L56) — sprawdzenie geometrii z `map_display_state.ferries`, inaczej stałe tory.
 */
import { describe, expect, it, vi } from 'vitest';
import { acceptedFerries, checkFerries, ferryLineOk, ferrySummary } from '../src/lib/map/ferryLines';
import { detourLineOk, detourLineTip, type LatLngPair } from '../src/lib/e49Detour';
import { e49t, E49_PL } from '../src/i18n/e49';
import { demoDetourCase, demoDetourDecide, demoDetourLines, DEMO_DETOUR_LINE } from '../src/lib/e49Demo';
import { kindOptions } from '../src/lib/p5Docs';
import { ft } from '../src/i18n/p5';
import { useTowerStore } from '../src/store/useTowerStore';
import type { Load } from '../src/types';

const NOW = '2026-10-16T10:00:00Z';
const load = (code: string) => ({
  id: `id-${code}`, code, itemType: 'T', status: 'IN_TRANSIT_SE', etaBoden: '2026-10-17T06:00:00Z',
  dims: { lengthM: 18.19, widthM: 2.45, heightM: 3.75, weightT: 24 },
}) as unknown as Load;

/** Linia między dwoma punktami z lekkim łukiem na wschód (jak tor promu), `n` punktów. */
function lane(a: LatLngPair, b: LatLngPair, n = 40, bow = 0.6): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * bow]);
  }
  return out;
}
const GDN: LatLngPair = [54.41, 18.68];
const NYN: LatLngPair = [58.89, 17.96];
const GDY: LatLngPair = [54.53, 18.55];
const KAA: LatLngPair = [56.14, 15.63];

describe('przeprawy z HERE (E45 pkt 1, L56)', () => {
  it('odcinek między właściwymi portami — przyjęty, w obu kierunkach', () => {
    expect(ferryLineOk('FERRY-GDN-NYN', lane(GDN, NYN))).toBe(true);
    expect(ferryLineOk('FERRY-GDN-NYN', lane(NYN, GDN))).toBe(true);
    expect(ferryLineOk('FERRY-GDY-KAA', lane(GDY, KAA, 30, 0.3))).toBe(true);
  });
  it('zły port, za mało punktów, dziura albo zbyt długi objazd morzem — odrzucony', () => {
    expect(ferryLineOk('FERRY-GDY-KAA', lane(GDN, NYN))).toBe(false);
    expect(ferryLineOk('FERRY-GDN-NYN', lane(GDN, NYN, 4))).toBe(false);
    const gap = lane(GDN, NYN);
    expect(ferryLineOk('FERRY-GDN-NYN', [...gap.slice(0, 5), ...gap.slice(-5)])).toBe(false);
    expect(ferryLineOk('FERRY-GDN-NYN', lane(GDN, NYN, 80, 9))).toBe(false);
  });
  it('Gdynia nie uchodzi za Gdańsk (porty do 10 km); długie proste na otwartym morzu (krok do 150 km) — przyjęte', () => {
    expect(ferryLineOk('FERRY-GDN-NYN', lane(GDY, NYN))).toBe(false);
    expect(ferryLineOk('FERRY-GDN-NYN', lane(GDN, NYN, 6, 0.6))).toBe(true);
  });
  it('powód odrzucenia w skrócie dla TEST (L56)', () => {
    const r = checkFerries([{ leg: 'FERRY-GDY-KAA', points: lane(GDN, NYN) }, { leg: 'FERRY-GDN-NYN', points: lane(GDN, NYN) }]);
    expect(ferrySummary(r)).toBe('FERRY-GDN-NYN: HERE · FERRY-GDY-KAA: tor — końce dalej niż 10 km od portów');
    expect(ferrySummary(checkFerries([]))).toBe('FERRY-GDN-NYN: tor · FERRY-GDY-KAA: tor');
  });
  it('z odczytu bazy: nieznany odcinek pominięty, jeden odcinek na przeprawę, punkty spoza zakresu odrzucone', () => {
    const rows = [
      { leg: 'FERRY-GDN-NYN', points: lane(GDN, NYN) },
      { leg: 'FERRY-GDN-NYN', points: lane(NYN, GDN) },
      { leg: 'PL-GDN', points: lane(GDN, NYN) },
      { leg: 'FERRY-GDY-KAA', points: [[999, 1], [1, 2]] },
      null,
    ];
    const out = acceptedFerries(rows);
    expect(out.map((f) => f.leg)).toEqual(['FERRY-GDN-NYN']);
    expect(out[0].line[0]).toEqual(GDN);
    expect(acceptedFerries(undefined)).toEqual([]);
    expect(acceptedFerries({})).toEqual([]);
  });
});

describe('linia objazdu (E45; Z3 pkt 8)', () => {
  it('przykład ma poprawną geometrię i jest w możliwości „objazd”', () => {
    expect(detourLineOk(DEMO_DETOUR_LINE)).toBe(true);
    const c = demoDetourCase(load('T-17'), NOW);
    expect('none' in c.detour ? null : c.detour.line).toBe(DEMO_DETOUR_LINE);
    expect(detourLineOk([[62.7, 17.9]])).toBe(false);
    expect(detourLineOk([[62.7, 17.9], [99, 17.9]])).toBe(false);
    expect(detourLineOk(null)).toBe(false);
  });
  it('linia dopiero po „Jedziemy objazdem”; po „Stoimy” — bez linii', async () => {
    const a = load('T-17');
    const b = load('SG-31');
    expect(demoDetourLines([a, b], NOW)).toEqual([]);
    await demoDetourDecide(`detour:${b.id}`, { pick: 'HOLD', by: 'SCX', atIso: NOW, note: null });
    expect(demoDetourLines([a, b], NOW)).toEqual([]);
    await demoDetourDecide(`detour:${a.id}`, { pick: 'DETOUR', by: 'SCX', atIso: NOW, note: null });
    const lines = demoDetourLines([a, b], NOW);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ loadId: a.id, addKm: 31, addMin: 35, via: 'przez Kramfors i Sandöbron (droga 90)' });
  });
  it('podpis: kod, którędy, km i czas, „decyzja SCX”', () => {
    const tip = detourLineTip('T-17', { via: 'przez Kramfors i Sandöbron (droga 90)', addKm: 31, addMin: 65 }, e49t);
    expect(tip.replace(/ /g, ' ')).toBe('T-17 · objazd przez Kramfors i Sandöbron (droga 90): +31 km, +1 h 05 min · decyzja SCX');
    expect(E49_PL.e49_map_line).not.toMatch(/sms:|mailto:|supabase/i);
  });
  it('produkcja przed podłączeniem: bez linii i bez sygnału', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const m = await import('../src/lib/e49Source');
      expect(m.detourLinesOf([load('T-17')], NOW)).toEqual([]);
      const off = m.subscribeDetourLines(() => {});
      expect(typeof off).toBe('function');
      off();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('„Inne pliki” z „+ Dodaj” (E31 pkt 5)', () => {
  it('rodzaj „Inne” w oknie „Wgraj dokument” — jedna możliwość, nazwa po polsku', () => {
    expect(kindOptions('x', [], ['OTHER'])).toEqual([{ category: 'OTHER', state: null }]);
    expect(ft('pl', 'p5_doc_cat_OTHER')).toBe('Inne');
    expect(ft('pl', 'p5_pd_other_add')).toBe('+ Dodaj');
  });
  it('demo: kilka plików „Inne” przy jednym transporcie, bez wersji; CMR nadal z wersją', () => {
    const st = useTowerStore.getState();
    const id = st.loads[0].id;
    st.uploadDocument(id, 'OTHER', 'zdjecie-1.jpg');
    st.uploadDocument(id, 'OTHER', 'protokol.pdf');
    const other = useTowerStore.getState().documents.filter((d) => d.loadId === id && d.category === 'OTHER');
    expect(other.map((d) => d.name).sort()).toEqual(['protokol.pdf', 'zdjecie-1.jpg']);
    expect(other.every((d) => d.version === 1)).toBe(true);
    st.uploadDocument(id, 'CMR', 'cmr-1.pdf');
    st.uploadDocument(id, 'CMR', 'cmr-2.pdf');
    const cmr = useTowerStore.getState().documents.filter((d) => d.loadId === id && d.category === 'CMR');
    expect(cmr).toHaveLength(1);
    expect(cmr[0].name).toBe('cmr-2.pdf');
  });
  it('produkcja: „+ Dodaj” wyłączone do podłączenia rodzaju OTHER', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const m = await import('../src/lib/p5Source');
      expect(m.otherDocsOn()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
    const m2 = await import('../src/lib/p5Source');
    expect(m2.otherDocsOn()).toBe(true);
  });
});
