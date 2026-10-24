/**
 * #422 / #508 — Stan systemu na produkcji: Wydajność z `perf_results_latest` (0283–0284) i Błędy aplikacji
 * z `app_errors_recent` (tylko Administrator HHL). Bez zmyślonych wartości: brak pomiaru = „—”, nieznane „nowe” = null.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PERF_PLAN, appErrorsFromDb, perfFromDb } from '../src/lib/sysSource';

describe('Wydajność z bazy (#422/#508)', () => {
  it('etykiety planu zgodne z tym, co mierzy Lighthouse (logowanie, strona offline) — bez Kokpitu/Mapy/Harmonogramu', () => {
    expect(PERF_PLAN.map((r) => r.what)).toEqual([
      'Logowanie · telefon',
      'Strona „Brak połączenia” · telefon',
      'Logowanie · komputer',
      'Listy transportów i wiadomości w bazie',
      'Równoczesność',
    ]);
    expect(PERF_PLAN.some((r) => /Kokpit|Mapa|Harmonogram|p95|loads|load_messages|max_exec/.test(`${r.what} ${r.how} ${r.limit}`))).toBe(false);
  });

  it('wynik i stan z bazy, nazwy z planu; „brak pomiaru” → „—” bez stanu; brak wiersza → „—”', () => {
    const p = perfFromDb({
      at: '2026-10-24T02:37:24Z',
      rows: [
        { id: 'p1', what: 'Logowanie · telefon', result: '5,8 s · 0,00 · 82 ms', ok: false },
        { id: 'p3', what: 'Logowanie · komputer', result: '1,1 s · 0,01 · 0 ms', ok: true },
        { id: 'p4', what: 'Listy loads / load_messages', result: 'brak pomiaru', ok: null },
        { id: 'p5', what: 'Równoczesność', result: 'brak pomiaru', ok: null },
      ],
    });
    expect(p.at).toBe('2026-10-24T02:37:24Z');
    const by = Object.fromEntries(p.rows.map((r) => [r.id, r]));
    expect(by.p1).toMatchObject({ what: 'Logowanie · telefon', result: '5,8 s · 0,00 · 82 ms', ok: false });
    expect(by.p2).toMatchObject({ result: '—', ok: null });
    expect(by.p3).toMatchObject({ result: '1,1 s · 0,01 · 0 ms', ok: true });
    expect(by.p4).toMatchObject({ what: 'Listy transportów i wiadomości w bazie', result: '—', ok: null });
    expect(by.p5).toMatchObject({ result: '—', ok: null });
  });

  it('pusty albo zły wynik RPC → sam plan bez daty (ekran pokazuje notkę o braku pomiaru)', () => {
    for (const raw of [null, undefined, 'x', { rows: 'nie' }]) {
      const p = perfFromDb(raw);
      expect(p.at).toBeNull();
      expect(p.rows.map((r) => r.result)).toEqual(['—', '—', '—', '—', '—']);
    }
  });
});

describe('Błędy aplikacji z bazy (#422/#508)', () => {
  it('grupy bez zmyślonego stanu; newCount null zostaje null (nie 0)', () => {
    const e = appErrorsFromDb({
      groups: [{ id: 'abc', message: 'Failed to fetch', where: '/kokpit', people: 2, count: 5, builds: 1, firstAt: '2026-10-20T10:00:00Z', lastAt: '2026-10-23T10:00:00Z', state: null, stack: 'at x' }],
      total7d: 5, newSince: null, newCount: null, days: 7,
    })!;
    expect(e.groups[0]).toMatchObject({ id: 'abc', message: 'Failed to fetch', where: '/kokpit', people: 2, count: 5, state: null, stack: 'at x' });
    expect(e.total7d).toBe(5);
    expect(e.newCount).toBeNull();
    expect(e.newSince).toBeNull();
  });

  it('po zapisie wdrożenia: newSince i newCount z bazy', () => {
    const e = appErrorsFromDb({ groups: [], total7d: 0, newSince: '2026-10-24T02:36:30Z', newCount: 0 })!;
    expect(e).toMatchObject({ newSince: '2026-10-24T02:36:30Z', newCount: 0 });
  });

  it('zły kształt → null (zakładka ukryta, bez zmyślonych danych)', () => {
    expect(appErrorsFromDb(null)).toBeNull();
    expect(appErrorsFromDb({ total7d: 3 })).toBeNull();
  });

  it('LiveStatus: Błędy tylko dla Administratora HHL, Wydajność dla HHL; ekran bez znacznika przy stanie null i „—” przy nieznanych nowych', () => {
    const live = readFileSync('src/auth/LiveStatus.tsx', 'utf8');
    expect(live).toMatch(/admin \? sb\.rpc\('app_errors_recent'/);
    expect(live).toContain("sb.rpc('perf_results_latest')");
    const scr = readFileSync('src/components/options/StatusScreen.tsx', 'utf8');
    expect(scr).toContain('if (!g.state) return null;');
    expect(scr).toContain("data.newCount ?? '—'");
  });
});
