import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KSH_IMPORT_SUMMARY, importSummaryNotice, kshImportSummaryFromRpc, summaryIdOf } from '../src/lib/kshImportSummary';
import { notificationFromRow } from '../src/data/mappers';
import { bellSection, mergeBellRefresh } from '../src/lib/bellList';
import { KshChangeList } from '../src/components/schedule/KshChangeList';

/**
 * #594 B1 (właściciel 27.10, 14:55): po imporcie pliku KSH — jedno zbiorcze powiadomienie w dzwonku (HHL, SCX, KSH);
 * kliknięcie otwiera okno z rozmytym tłem, zamykane ✕; okno dopasowane do szerokości, tekst nie wychodzi poza sekcje.
 */
const RPC = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  project_id: 'p',
  imported_at: '2026-10-27T17:05:00Z',
  file_name: 'harmonogram.xlsx',
  stats: { transports: 9, fields: 9, added: 9, cancelled: 9 },
  changes: [
    { code: 'SG-30', load_id: 'l30', kind: 'added' },
    { code: 'BS-06', load_id: 'l6', kind: 'changed', field: 'load_date', field_label: 'Data załadunku', wt: '2026-10-28', file: '2026-10-29' },
    { code: 'BS-06', load_id: 'l6', kind: 'changed', field: 'tractor_plate', field_label: 'Ciągnik', wt: 'PO1234A', file: 'PO1234A' },
    { code: 'BS-07', load_id: 'l7', kind: 'changed', field: 'delivery_time', field_label: 'Godzina rozładunku', wt: '08:00', file: 'rano', skip_reason: 'nieczytelna godzina — pominięta' },
    { code: 'TS-02', load_id: 'l2', kind: 'missing' },
  ],
  n: 5,
};

describe('W-594 okno importu — model z RPC', () => {
  it('migawka → model; liczniki z widocznych wierszy (nie ze stats całego importu); zmiana bez różnicy odpada', () => {
    const v = kshImportSummaryFromRpc(RPC);
    expect(v?.id).toBe(RPC.id);
    expect(v?.importedAt).toBe(RPC.imported_at);
    expect(v?.fileName).toBe('harmonogram.xlsx');
    expect(v?.changes.map((c) => `${c.kind}:${c.code}:${c.field}`)).toEqual([
      'added:SG-30:', 'changed:BS-06:load_date', 'changed:BS-07:delivery_time', 'missing:TS-02:',
    ]);
    expect(v?.counts).toMatchObject({ fields: 2, added: 1, missing: 1 });
    expect(v?.changes.find((c) => c.code === 'BS-07')?.skipReason).toBe('nieczytelna godzina — pominięta');
  });

  it('null / brak id / zły kształt → migawka niedostępna', () => {
    expect(kshImportSummaryFromRpc(null)).toBeNull();
    expect(kshImportSummaryFromRpc({ ...RPC, id: null })).toBeNull();
    expect(kshImportSummaryFromRpc({ id: 'x', changes: 'nie' })).toBeNull();
  });
});

describe('W-594 powiadomienie w dzwonku', () => {
  const row = {
    id: 77, template: KSH_IMPORT_SUMMARY, load_id: null, created_at: '2026-10-27T17:05:00Z', read_at: null,
    payload: { summary_id: RPC.id, project_id: 'p', imported_at: '2026-10-27T17:05:00Z', transports: 3, fields: 4, added: 1, cancelled: 2 },
  };

  it('tytuł z czasem importu (Europe/Warsaw) i skrót liczb po polsku; bez kodu szablonu', () => {
    const r = importSummaryNotice(row.payload);
    expect(r.subject).toBe('Zmiany z pliku KSH — 27.10.2026, 18:05');
    expect(r.body).toBe('Transporty: 3 · pola: 4 · nowe: 1 · anulowane/usunięte: 2');
    expect(r.subject + r.body).not.toMatch(/KSH_IMPORT_SUMMARY/);
  });

  it('#653: w tym N spraw, M decyzji gdy payload ma risks/decisions', () => {
    const r = importSummaryNotice({ ...row.payload, risks: 2, decisions: 1 });
    expect(r.body).toBe('Transporty: 3 · pola: 4 · nowe: 1 · anulowane/usunięte: 2 · w tym: 2 spraw, 1 decyzji');
  });

  it('wiersz bazy → powiadomienie z id migawki; sekcja „Moje transporty”, nie „Do zrobienia”', () => {
    const n = notificationFromRow(row);
    expect(n.summaryId).toBe(RPC.id);
    expect(n.title).toBe('Zmiany z pliku KSH — 27.10.2026, 18:05');
    expect(n.body).toBe('Transporty: 3 · pola: 4 · nowe: 1 · anulowane/usunięte: 2');
    expect(n.kind).toBe(KSH_IMPORT_SUMMARY);
    expect(bellSection({ kind: n.kind, loadId: n.loadId, severity: n.severity, href: n.href })).toBe('mine');
  });

  it('bez liczb w payloadzie — zdanie zamiast zer', () => {
    expect(importSummaryNotice({ imported_at: '2026-10-27T17:05:00Z' }).body).toBe('Otwórz, aby zobaczyć zmiany z ostatniego importu.');
  });

  it('nowy import (ten sam wiersz, nowszy czas) wraca jako nieprzeczytany mimo lokalnego odczytu', () => {
    const local = [{ id: 'srv-77', read: true, at: '2026-10-27T17:05:00Z', summaryId: 'a' }];
    const fresh = [{ id: 'srv-77', read: false, at: '2026-10-27T19:40:00Z', summaryId: 'b' }];
    expect(mergeBellRefresh(local, fresh)[0]).toMatchObject({ read: false, summaryId: 'b' });
    /* ten sam wpis (ten sam czas) — lokalny odczyt zostaje, jak dotąd */
    expect(mergeBellRefresh(local, [{ ...local[0], read: false }])[0].read).toBe(true);
  });

  it('summary_id tylko dla tego szablonu', () => {
    expect(summaryIdOf('SCHEDULE_IMPORTED', { summary_id: 'x' })).toBeUndefined();
    expect(summaryIdOf(KSH_IMPORT_SUMMARY, {})).toBeUndefined();
  });

  it('kliknięcie powiadomienia z migawką otwiera okno i oznacza odczytane (zamiast przejścia do widoku)', () => {
    const store = readFileSync('src/store/useTowerStore.ts', 'utf8');
    expect(store).toMatch(/if \(n\.summaryId\) \{\s*set\(\{ importSummaryId: n\.summaryId \}\);\s*get\(\)\.markNotificationRead\(id\);\s*return;/);
  });
});

describe('W-594 granica błędu okna', () => {
  it('PartBoundary z onError: po błędzie woła rodzica i nic nie rysuje (bez bloku „Odśwież”)', async () => {
    const { PartBoundary } = await import('../src/components/shell/PartBoundary');
    let called = 0;
    const b = new PartBoundary({ children: null, name: 'kis', onError: () => { called += 1; } });
    b.state = { failed: true };
    expect(b.render()).toBeNull();
    b.componentDidCatch(new Error('x'), { componentStack: '' } as never);
    expect(called).toBe(1);
  });
});

describe('W-594 okno — wygląd i zachowanie', () => {
  const modal = readFileSync('src/components/shell/KshImportSummaryModal.tsx', 'utf8');
  const css = readFileSync('src/components/schedule/sched7.css', 'utf8');
  const shell = readFileSync('src/TowerShell.tsx', 'utf8');

  it('rozmyte tło, zamknięcie ✕, Esc i dotknięcie tła; fokus w oknie; fokus wraca na dzwonek', () => {
    expect(css).toMatch(/\.kis-scrim\{[^}]*backdrop-filter:blur\(/);
    expect(modal).toMatch(/className="kis-scrim"[^>]*onClick=\{\(\) => done\(\)\}/);
    expect(modal).toMatch(/data-kis-close onClick=\{\(\) => done\(\)\}>✕</);
    /* przejście do transportu: okno zamknięte bez oddawania fokusu dzwonkowi (pasek transportu ma swój fokus) */
    expect(modal).toMatch(/onOpenLoad=\{\(loadId\) => \{ done\(false\); selectLoad\(loadId\); \}\}/);
    /* pułapka fokusu łapie też fokus spoza okna */
    expect(modal).toMatch(/!boxRef\.current\.contains\(document\.activeElement\)/);
    expect(modal).toMatch(/e\.key === 'Escape'/);
    expect(modal).toMatch(/e\.key !== 'Tab'/);
    expect(modal).toMatch(/role="dialog" aria-modal="true"/);
    expect(modal).toMatch(/querySelector<HTMLElement>\('\.bell-trigger'\)\?\.focus\(\)/);
  });

  it('telefon: okno na cały ekran; tekst zawija się i maleje (clamp) zamiast wychodzić poza sekcję', () => {
    expect(css).toMatch(/@media \(max-width:768px\)\{\s*\.kis-modal\{inset:0;[^}]*width:100%/);
    expect(css).toMatch(/\.kis-hd h2\{[^}]*font-size:clamp\([^}]*overflow-wrap:anywhere/);
    expect(css).toMatch(/\.kis-bd \.ox-table th,\.kis-bd \.ox-table td\{font-size:clamp\([^}]*overflow-wrap:anywhere/);
  });

  it('okno nad dzwonkiem (60) i paskiem transportu (51)', () => {
    expect(css).toMatch(/\.kis-scrim\{[^}]*z-index:70/);
    expect(css).toMatch(/\.kis-modal\{[^}]*z-index:71/);
  });

  it('okno ładowane osobno (budżet paczki) i tylko gdy otwarte', () => {
    expect(shell).toMatch(/lazy\(lazyRetry\(\(\) => import\('\.\/components\/shell\/KshImportSummaryModal'\)/);
    expect(shell).toMatch(/\{importSummaryId \? \(/);
    /* skróty klawiszowe wyłączone przy otwartym oknie */
    expect(shell).toMatch(/if \(document\.querySelector\('\[data-kis-modal\]'\)\) return;/);
    /* okno, które się nie wczytało: zamknięte z komunikatem, bez bloku „Odśwież” w środku strony */
    expect(shell).toMatch(/<PartBoundary name="kis" onError=\{onKisError\}>/);
    expect(shell).toMatch(/st\.closeImportSummary\(\);\s*st\.pushToast\(/);
  });

  it('okno po imporcie: pominięte pole jako „nie zapisane”, poza liczbą pól', () => {
    const v = kshImportSummaryFromRpc(RPC)!;
    const html = renderToStaticMarkup(createElement(KshChangeList, { locale: 'pl', changes: v.changes, counts: v.counts, onOpenLoad: () => {}, skipKey: 's7_kis_skip' }));
    expect(html).toContain('nie zapisane: nieczytelna godzina — pominięta');
    expect(html).not.toContain('nie zostanie zapisane');
    expect(modal).toMatch(/f: d\.changes\.filter\(\(c\) => c\.kind === 'changed' && !c\.skipReason\)\.length/);
  });

  it('lista zmian: kod w każdym wierszu, powód pominięcia, nowe i brakujące kody', () => {
    const v = kshImportSummaryFromRpc(RPC)!;
    const html = renderToStaticMarkup(createElement(KshChangeList, { locale: 'pl', changes: v.changes, counts: v.counts, onOpenLoad: () => {} }));
    expect(html).toContain('Nowe w pliku (1)');
    expect(html).toContain('Brak w pliku (1)');
    expect((html.match(/data-ksh-preview-row="BS-0[67]"/g) ?? []).length).toBe(2);
    expect(html).toContain('nie zostanie zapisane: nieczytelna godzina — pominięta');
    expect(html).toContain('28.10.2026');
  });
});
