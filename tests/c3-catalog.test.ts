/**
 * C3 — katalog zdarzeń i podłączenie „Co dostaję” (D-20261016-1620 pkt 5.1, 1750 pkt 3.5).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTIFY_CATALOG, NOTIFY_EVENT_IDS } from '../src/lib/notifyCatalog';

describe('C3 katalog powiadomień', () => {
  it('każdy wiersz katalogu jest w migracji macierzy', () => {
    const sql = readFileSync('supabase/migrations/0222_c3_matrix_events.sql', 'utf8');
    expect(NOTIFY_EVENT_IDS).toHaveLength(23);
    for (const id of NOTIFY_EVENT_IDS) expect(sql, id).toContain(`'${id}'`);
    expect(sql).toContain('notify_audience_ok');
    expect(sql).toContain("'visible_to'");
  });

  it('KSH nie ma stref ani Brak CMR', () => {
    const zone = NOTIFY_CATALOG.flatMap((g) => g.rows).find((r) => r.id === 'zone');
    const cmr = NOTIFY_CATALOG.flatMap((g) => g.rows).find((r) => r.id === 'cmr');
    expect(zone?.cells.CLIENT_USER).toBeNull();
    expect(cmr?.cells.CLIENT_USER).toBeNull();
  });

  it('produkcja czyta ustawienia osoby z bazy', () => {
    const src = readFileSync('src/lib/forMeSource.ts', 'utf8');
    expect(src).toContain("import.meta.env.VITE_AUTH_MODE !== 'supabase'");
    expect(src).toContain('my_notify_get');
    expect(src).toContain('my_notify_set');
    expect(readFileSync('src/views/SettingsView.tsx', 'utf8')).toContain('useLiveNotify');
  });
});
