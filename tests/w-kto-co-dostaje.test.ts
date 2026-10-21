/* E11 (właściciel 21.10.2026 19:52): „Kto co dostaje” na produkcji w wyglądzie z audytu, dane z notification_matrix. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matrixFromDb } from '../src/auth/LiveWhoGets';
import { NOTIFY_CATALOG } from '../src/lib/notifyCatalog';

const row = (event_key: string, role: string, in_app: boolean, email: boolean, push: boolean, fx: Partial<Record<'fixed_in_app' | 'fixed_email' | 'fixed_push', boolean>> = {}) =>
  ({ event_key, role, in_app, email, push, fixed_in_app: null, fixed_email: null, fixed_push: null, ...fx }) as never;

describe('Kto co dostaje — produkcja', () => {
  it('zaznaczenia z bazy, nie z katalogu; stałe kanały z fixed_*', () => {
    const g = matrixFromDb(NOTIFY_CATALOG, [row('dec_late', 'HHL_ADMIN', true, false, false), row('dates', 'HHL_OPS', true, false, false, { fixed_in_app: true })]);
    const r = g.flatMap((x) => x.rows);
    expect(r.find((x) => x.id === 'dec_late')!.cells.HHL_ADMIN).toEqual({ bell: true, push: false, mail: false });
    expect(r.find((x) => x.id === 'dates')!.cells.HHL_OPS).toEqual({ bell: true, push: false, mail: false, fixed: ['bell'] });
  });
  it('brak wiersza w bazie = wyłączone; „—” z katalogu zostaje; Sytuacja ogólna bez kanałów', () => {
    const r = matrixFromDb(NOTIFY_CATALOG, []).flatMap((x) => x.rows);
    expect(r.find((x) => x.id === 'status')!.cells.CARRIER_USER).toEqual({ bell: false, push: false, mail: false });
    expect(r.find((x) => x.id === 'cmr')!.cells.CLIENT_USER).toBeNull();
    expect(r.find((x) => x.id === 'risk_general')!.risksOnly).toBe(true);
  });
  it('Opcje ładują LiveWhoGets (ekran z audytu), nie starą tabelę', () => {
    const o = readFileSync(new URL('../src/views/OptionsView.tsx', import.meta.url), 'utf8');
    expect(o).toContain("import('../auth/LiveWhoGets')");
    expect(o).not.toContain("import('../auth/NotificationMatrixForm')");
  });
});
