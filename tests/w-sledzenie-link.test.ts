/**
 * W-sledzenie-link — decyzja właściciela 20.10.2026, 20:01: śledzenie i lokalizacja tylko przy podanym linku
 * (SG-15, SG-16: „Śledzenie trwa” mimo braku linku). Opisy dwóch wartości w bloku ETA: niepewność i opóźnienie.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { trackingNoLink } from '../src/components/drawer/TrackingBar';
import { tp, t } from '../src/i18n/messages';
import { formatDelayPill } from '../src/components/ui/StatusPill';
import type { Load } from '../src/types';

const ld = (ref: string | null) => ({ resources: { trackingRef: ref } }) as unknown as Load;

describe('W-sledzenie-link — pasek śledzenia bez linku', () => {
  it('produkcja bez linku → „Śledzenie wyłączone”', () => {
    expect(trackingNoLink(ld(null), null, true)).toBe(true);
    expect(trackingNoLink(ld('  '), null, true)).toBe(true);
    expect(t('pl', 'p4b_trk_nolink')).toBe('Śledzenie wyłączone — brak linku śledzenia');
  });
  it('link emtrack, RIO albo link z serwera → zwykły pasek', () => {
    expect(trackingNoLink(ld('https://emtrack.eu/app/'), null, true)).toBe(false);
    expect(trackingNoLink(ld('https://position-sharing.rio.cloud/x'), null, true)).toBe(false);
    expect(trackingNoLink(ld(null), { provider: 'RIO' } as never, true)).toBe(false);
  });
  it('demo (bez linków w danych) bez zmian', () => {
    expect(trackingNoLink(ld(null), null, false)).toBe(false);
  });
  it('pasek bez linku sprawdzany przed „trwa od” i „włączy się”', () => {
    const src = readFileSync('src/components/drawer/TrackingBar.tsx', 'utf8');
    expect(src.indexOf("data-tracking-bar=\"nolink\"")).toBeLessThan(src.indexOf("data-tracking-bar=\"before\""));
  });
});

describe('W-sledzenie-link — dwie wartości czasu w ETA opisane', () => {
  it('pasmo: „niepewność ± …”, opóźnienie: „opóźnienie +…”', () => {
    expect(tp('pl', 'p4b_eta_band', { m: '9 h 24 min', word: 'Niska' })).toBe('niepewność ± 9 h 24 min · Niska');
    expect(tp('pl', 'p4b_eta_delay', { d: formatDelayPill(8 * 1440 + 14 * 60 + 18) })).toBe('opóźnienie +8 d 14 h 18 min');
  });
  it('nagłówek panelu i blok ETA używają opisu opóźnienia', () => {
    expect(readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8')).toContain("tp(locale, 'p4b_eta_delay', { d: formatDelayPill(delayMin) })");
    expect(readFileSync('src/components/drawer/EtaBlock.tsx', 'utf8')).toContain("tp(locale, 'p4b_eta_delay', { d: formatDelayPill(delayMin) })");
  });
});

describe('W-sledzenie-link — ten sam stan w PDF, mapie, osi i „najbliższych włączeniach”', () => {
  it('PDF/jedna linia, mapa, oś statusu i lista włączeń sprawdzają brak linku', () => {
    expect(readFileSync('src/lib/trackingStateText.ts', 'utf8')).toContain("trackingNoLink(load, trackingLink)");
    expect(readFileSync('src/lib/p9fNote.ts', 'utf8')).toContain("trackingNoLink(l, l.trackingLink, ctx.prod)");
    expect(readFileSync('src/components/drawer/StatusAxisTab.tsx', 'utf8')).toContain("'p4b_g_route_r_nolink'");
    expect(readFileSync('src/lib/stageTiles.ts', 'utf8')).toContain('if (trackingNoLink(l, l.trackingLink)) continue;');
  });
  it('dopisek mapy bez linku w produkcji: „Brak linku śledzenia — SCX” na czerwono', async () => {
    const { drawerMapNote } = await import('../src/lib/p9fNote');
    const load = { id: 'x', code: 'SG-15', status: 'IN_TRANSIT_PL', stage: 'PL', plannedLoadDate: '2026-10-08', plannedDeliverDate: '2026-10-14', resources: { trackingRef: null } } as unknown as Load;
    const n = drawerMapNote(load, { nowIso: '2026-10-20T18:00:00Z', prod: true, gpsReady: true, hasFix: true, tx: (k) => k, dt: (s) => s });
    expect(n?.kind).toBe('nopos');
    expect(n?.lines).toEqual(['p9f_nopos', 'p9f_why_link']);
    expect(n?.alert).toBe(1);
  });
});
