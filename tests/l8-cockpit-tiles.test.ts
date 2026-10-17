/** L-8 — liczby kafelków: KSH tylko to, co widzi; przewoźnik bieżący tydzień; HHL cała kolejka. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isoWeekNumber, needsDecisionCount } from '../src/lib/cockpitTiles';
import { d19Pl } from '../src/i18n/d19Extra';
import { tp } from '../src/i18n/messages';

const RISKS = [
  { type: 'FERRY', owner: 'HHL' },
  { type: 'OPS', owner: 'SCX' },
  { type: 'OPS', owner: 'HHL' },
  { type: 'ROAD_SE', owner: 'HHL' },
  { type: 'DOC', owner: 'SCX' },
] as const;

describe('L-8 kafelki kokpitu', () => {
  it('HHL: kafelek liczy całą kolejkę ryzyk, nie liczbę decyzji', () => {
    expect(needsDecisionCount('HHL', RISKS)).toBe(5);
  });

  it('KSH: kafelek liczy tylko ryzyka widoczne dla KSH (OPS cudzej firmy odpada)', () => {
    expect(needsDecisionCount('KSH', RISKS)).toBe(4);
    expect(needsDecisionCount('KSH', RISKS)).not.toBe(9);
  });

  it('SCX: podpis to bieżący tydzień, nie stałe 38', () => {
    expect(isoWeekNumber('2026-09-16T12:00:00Z')).toBe(38);
    expect(isoWeekNumber('2026-10-04T12:00:00Z')).toBe(40);
    const caption = tp('pl', 'dash_week_invoice', { week: String(isoWeekNumber('2026-10-04T12:00:00Z')) });
    expect(caption).toBe('tydzień 40, do zafakturowania');
    expect(caption).not.toContain('38');
    expect(d19Pl.dash_week_invoice).toBe('tydzień {week}, do zafakturowania');
  });

  /* Przepisane w wyglad/P3-b — E9 (decyzja 07.10 19:11): KSH nie ma listy „Do zrobienia”, więc nie ma kafelka decyzji;
     „Do zrobienia” HHL i SCX to ta sama liczba w Kokpicie i przy „Ryzyka” w menu (todoQueue); tydzień SCX z isoWeekNumber. */
  it('kokpit nie bierze liczby z Centrum decyzji, „Do zrobienia” = liczba w menu, bez stałego tygodnia 38', () => {
    const src = readFileSync('src/views/DashboardView.tsx', 'utf8');
    expect(src).not.toContain('openDecisions');
    expect(src).not.toContain('countOpenDecisions');
    expect(src).toContain('todoQueue(role, risks, kind)');
    expect(src).toContain('todoRisks(role, risks, kind)');
    expect(readFileSync('src/components/shell/Nav.tsx', 'utf8')).toContain('todoQueue(role, risks, viewedKind(role, accountRole(role)))');
    const ck = readFileSync('src/lib/cockpitE9.ts', 'utf8');
    expect(ck).toContain('isoWeekNumber(input.nowIso)');
    expect(src + ck).not.toContain('tydzień 38');
  });
});
