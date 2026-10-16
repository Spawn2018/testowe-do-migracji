/**
 * wyglad/P9-f — dopisek na mapie Przeglądu (E32 pkt 3: „Brak pozycji · Śledzenie od 08.10, 03:00 · Brak linku
 * śledzenia — SCX”; „Na placu od 07.10, 08:35”; E27: po „Dostarczone” śledzenie zakończone).
 */
import { describe, expect, it } from 'vitest';
import type { Load } from '../src/types';
import { drawerMapNote } from '../src/lib/p9fNote';
import { p9e, p9ep } from '../src/i18n/p9e';
import { p9m, p9mp } from '../src/i18n/p9c';

const tx = (k: string, p?: Record<string, string | number>) => (k.startsWith('p9c_') ? (p ? p9mp('pl', k, p) : p9m('pl', k)) : (p ? p9ep('pl', k, p) : p9e('pl', k)));
const base = { nowIso: '2026-10-07T20:00:00Z', prod: true, gpsReady: true, hasFix: false, tx, dt: () => '07.10, 08:35' };
const L = (x: Partial<Load>): Load => ({ id: 'x', status: 'PLANNED', stage: 'PREP', plannedLoadDate: '2026-10-08', ...x } as unknown as Load);

describe('P9-f dopisek na mapie Przeglądu', () => {
  it('przed oknem śledzenia: brak pozycji, od kiedy śledzenie i brak linku (SG-15 z makiety E32)', () => {
    expect(drawerMapNote(L({ trackingLink: null }), base)).toEqual({ kind: 'before', text: 'Brak pozycji · Śledzenie od 08.10, 03:00 · Brak linku śledzenia — SCX' });
    /* serwer nie podaje stanu linku — bez zgadywania powodu */
    expect(drawerMapNote(L({}), base)?.text).toBe('Brak pozycji · Śledzenie od 08.10, 03:00');
    /* link czeka na pierwszą pozycję — przed oknem to normalne, bez powodu */
    expect(drawerMapNote(L({ trackingLink: { url: 'u', check: { state: 'pending' } } as unknown as Load['trackingLink'] }), base)?.text).toBe('Brak pozycji · Śledzenie od 08.10, 03:00');
  });

  it('w oknie bez pozycji (produkcja): powód z linku albo „Brak pozycji GPS”', () => {
    const on = { status: 'IN_TRANSIT_SE', stage: 'SE_ROAD', plannedLoadDate: '2026-10-06' } as Partial<Load>;
    expect(drawerMapNote(L({ ...on, trackingLink: null }), base)?.text).toBe('Brak pozycji · Brak linku śledzenia — SCX');
    expect(drawerMapNote(L({ ...on, trackingLink: { url: 'u', check: { state: 'down' } } as unknown as Load['trackingLink'] }), base)?.text).toBe('Brak pozycji · Źródło pozycji nie odpowiada · Stan systemu');
    expect(drawerMapNote(L(on), base)?.text).toBe('Brak pozycji GPS');
    expect(drawerMapNote(L(on), { ...base, hasFix: true })).toBeNull();
    expect(drawerMapNote(L(on), { ...base, gpsReady: false })).toBeNull();
  });

  it('na placu: „Na placu od …”; po „Dostarczone”: śledzenie zakończone', () => {
    const site = L({ status: 'AT_SITE', stage: 'SITE', plannedLoadDate: '2026-10-03', etaDetail: { waitSince: '2026-10-07T06:35:00Z' } as Load['etaDetail'] });
    expect(drawerMapNote(site, { ...base, hasFix: true })).toEqual({ kind: 'site', text: 'Na placu od 07.10, 08:35' });
    /* wjazd do strefy placu ma pierwszeństwo; bez faktów (tylko ETA) — bez dopisku */
    const seen: string[] = [];
    drawerMapNote(site, { ...base, hasFix: true, siteSince: '2026-10-07T06:00:00Z', dt: (iso) => { seen.push(iso); return 'x'; } });
    expect(seen).toEqual(['2026-10-07T06:00:00Z']);
    expect(drawerMapNote(L({ status: 'AT_SITE', stage: 'SITE', plannedLoadDate: '2026-10-03', etaBoden: '2026-10-07T06:00:00Z' } as Partial<Load>), { ...base, hasFix: true })).toBeNull();
    expect(drawerMapNote(L({ status: 'DELIVERED', stage: 'DELIVERED', plannedLoadDate: '2026-10-01' }), base)).toEqual({ kind: 'after', text: 'Śledzenie zakończone — „Dostarczone”' });
  });
});
