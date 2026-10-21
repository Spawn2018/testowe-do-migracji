/**
 * wyglad/W-cele-przejsc — cele przejść ze spraw „Do zrobienia” (i z dzwonka, który otwiera kartę sprawy),
 * wiersza promu w „Sytuacji na trasie” i reset okna Awizacja w panelu transportu.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { awizOpenAfter, ferryRowSailing, hintDrawerGo, issueDrawerGo, issueUploadCategory, isFerryIssue, isTrackingIssue } from '../src/lib/goTarget';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const risk = (o: Record<string, unknown>) => ({ id: 'r1', type: 'OPS', ...o });

describe('W-cele-przejsc — cele spraw', () => {
  it('ETA, „najpóźniej do”, cichy GPS i brak pozycji → zakładka Status', () => {
    expect(issueDrawerGo({ go: 'OPEN', risk: risk({ kind: 'ETA_BREACH' }) })).toBe('timeline');
    expect(issueDrawerGo({ go: 'OPEN', risk: risk({ kind: 'SILENT_VEHICLE' }) })).toBe('timeline');
    expect(issueDrawerGo({ go: 'OPEN', decision: { typeCode: 'ETA_AFTER_LATEST' } })).toBe('timeline');
    expect(issueDrawerGo({ go: 'OPEN', decision: { typeCode: 'NO_POSITION' } })).toBe('timeline');
    /* demo (seed bez `kind`) */
    expect(isTrackingIssue({ go: 'OPEN', risk: risk({ id: 'risk-eta-2' }) })).toBe(true);
    expect(isTrackingIssue({ go: 'OPEN', risk: risk({ id: 'risk-gps-silent-33' }) })).toBe(true);
    expect(isTrackingIssue({ go: 'OPEN', risk: risk({ id: 'risk-silent' }) })).toBe(true);
  });

  it('prom (anulowany, zmiana rejsu, spóźniony) → wiersz rejsu, nie okno Awizacji', () => {
    expect(issueDrawerGo({ go: 'OPEN', risk: risk({ type: 'FERRY' }) })).toBe('sailing');
    expect(issueDrawerGo({ go: 'OPEN', risk: risk({ code: 'MISSED_SAILING' }) })).toBe('sailing');
    expect(issueDrawerGo({ go: 'OPEN', decision: { typeCode: 'FERRY_CANCELLED' } })).toBe('sailing');
    expect(isFerryIssue({ go: 'OPEN', risk: risk({ kind: 'ETA_BREACH' }) })).toBe(false);
  });

  it('pozostałe bez zmian (Awizacja, Dokumenty, Ceny, Przegląd)', () => {
    expect(issueDrawerGo({ go: 'AWIZACJA' })).toBe('overview');
    expect(issueDrawerGo({ go: 'DOCS' })).toBe('docs');
    expect(issueDrawerGo({ go: 'PRICING' })).toBe('pricing');
    expect(issueDrawerGo({ go: 'OPEN', risk: risk({ kind: 'SEQUENCE' }) })).toBeNull();
    expect(hintDrawerGo('PICK_SAILING')).toBe('overview');
    expect(hintDrawerGo('OPEN_DOC')).toBe('docs');
    expect(hintDrawerGo('ADD_FEE')).toBe('pricing');
    expect(hintDrawerGo('KSH_DATE_COUNTER')).toBeNull();
  });

  it('„Wgraj” — rodzaj dokumentu do okna „Wgraj dokument”', () => {
    expect(issueUploadCategory({ go: 'DOCS', risk: risk({ type: 'DOC', title: 'Brak zezwolenia SE' }) })).toBe('PERMIT_SE');
    expect(issueUploadCategory({ go: 'DOCS', risk: risk({ type: 'DOC', title: 'Brak CMR z podpisem' }) })).toBe('CMR');
    expect(issueUploadCategory({ go: 'DOCS', risk: risk({ type: 'DOC', title: 'Brak zezwolenia PL' }) })).toBe('PERMIT_PL');
    expect(issueUploadCategory({ go: 'DOCS', risk: risk({ type: 'DOC', kind: 'INSURANCE', title: 'Polisa' }) })).toBe('INSURANCE');
    expect(issueUploadCategory({ go: 'DOCS', decision: { typeCode: 'INSURANCE_EXPIRING' } })).toBe('INSURANCE');
    expect(issueUploadCategory({ go: 'DOCS', risk: risk({ type: 'DOC', title: 'Brak zezwolenia — załadunek za 18 h' }) })).toBe('PERMIT_PL');
    expect(issueUploadCategory({ go: 'DOCS', risk: risk({ type: 'DOC', title: 'Brak dokumentu' }) })).toBeNull();
    expect(issueUploadCategory({ go: 'OPEN', risk: risk({ title: 'Brak zezwolenia SE' }) })).toBeNull();
  });

  it('TodoPanel prowadzi przez wspólne mapowanie i zamawia okno „Wgraj dokument”', () => {
    const s = src('src/components/risks/TodoPanel.tsx');
    expect(s).toContain('setDrawerTab(issueDrawerGo(i))');
    expect(s).toContain('setDrawerTab(hintDrawerGo(hint))');
    expect(s).toMatch(/setUploadReq\(\{ loadId: i\.loadId, category: issueUploadCategory\(i\) \}\)/);
    const d = src('src/components/drawer/PanelDocs.tsx');
    expect(d).toContain('category={upCat}');
    expect(src('src/components/docs/UploadDocModal.tsx')).toMatch(/category && allowed\.includes\(category\)/);
  });
});

describe('W-cele-przejsc — okno Awizacja w panelu transportu', () => {
  it('zamyka się przy innym transporcie i przy zamknięciu panelu', () => {
    expect(awizOpenAfter(true, { type: 'load', prevId: 'a', nextId: null })).toBe(false);
    expect(awizOpenAfter(true, { type: 'load', prevId: null, nextId: 'a' })).toBe(false);
    expect(awizOpenAfter(true, { type: 'load', prevId: 'a', nextId: 'b' })).toBe(false);
    expect(awizOpenAfter(true, { type: 'load', prevId: 'a', nextId: 'a' })).toBe(true);
  });
  it('otwiera się tylko na wyraźne żądanie (zakładka „overview” z linku albo sprawy)', () => {
    expect(awizOpenAfter(false, { type: 'tab', tab: 'overview' })).toBe(true);
    expect(awizOpenAfter(false, { type: 'tab', tab: 'timeline' })).toBe(false);
    expect(awizOpenAfter(false, { type: 'tab', tab: 'sailing' })).toBe(false);
  });
  it('LoadDrawer resetuje stan przy zmianie id (przed odczytem zakładki z linku)', () => {
    const s = src('src/components/drawer/LoadDrawer.tsx');
    expect(s).toMatch(/useLayoutEffect\(\(\) => \{[\s\S]*?awizOpenAfter\(prev, \{ type: 'load', prevId, nextId: id \}\)[\s\S]*?\}, \[id\]\);/);
    expect(s).not.toContain("if (drawerTab === 'overview') setAwizOpen(true);");
  });
});

describe('W-cele-przejsc — wiersz promu → Harmonogram › Rejsy', () => {
  const sailings = [
    { id: 's-1', vessel: 'Nova Star', departureAt: '2026-10-21T16:00:00Z' },
    { id: 's-2', vessel: 'Nova Star', departureAt: '2026-10-22T16:00:00Z' },
    { id: 's-3', vessel: 'Stena Ebba', departureAt: '2026-10-21T18:00:00Z' },
  ];
  it('produkcja: id wiersza = id rejsu', () => {
    expect(ferryRowSailing({ id: 's-3', vessel: 'x', depIso: '2026-10-21T18:00:00Z' }, sailings)).toBe('s-3');
  });
  it('demo: ten sam statek, najbliższe odejście; brak statku → null', () => {
    expect(ferryRowSailing({ id: 'demo-fr-1', vessel: 'Nova Star', depIso: '2026-10-21T16:00:00Z' }, sailings)).toBe('s-1');
    expect(ferryRowSailing({ id: 'demo-fr-9', vessel: 'Wawel', depIso: '2026-10-21T16:00:00Z' }, sailings)).toBeNull();
  });
  it('RoutePanel i Harmonogram używają wspólnego celu', () => {
    expect(src('src/components/risks/RoutePanel.tsx')).toContain("setSailingFocus(ferryRowSailing(r, sailings) ?? '*')");
    expect(src('src/views/SailingsPanel.tsx')).toContain('is-go-target');
    expect(src('src/components/risks/KshProposals.tsx')).toContain('data-ksh-open');
  });
});
