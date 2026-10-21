/**
 * #384 pkt 5–6 (właściciel 21.10.2026, 11:30): „Proponuję inny termin” z datą; propozycję przyjmuje albo odrzuca KSH;
 * po terminie decyzję przewoźnika zamykają też Operacje HHL. Baza: 0251 (decision_resolve z p_payload).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { proposalOfDetail, proposalPayload, proposalSummary, EMPTY_PROPOSAL } from '../src/lib/proposeDate';
import { mayResolveDecision } from '../src/lib/decisionAccess';
import { kshProposalsOf } from '../src/components/risks/KshProposals';
import type { TodoDecision } from '../src/lib/p6Todo';
import { bellSection } from '../src/lib/bellList';

const NOW = new Date('2026-10-21T13:00:00Z'); // 21.10, 15:00 w Warszawie

describe('#384 pkt 5 — formularz terminu', () => {
  it('wymaga daty załadunku, nie z przeszłości, dostawa nie przed załadunkiem', () => {
    expect(proposalPayload(EMPTY_PROPOSAL, NOW)).toEqual({ error: 'NO_LOAD_DATE' });
    expect(proposalPayload({ ...EMPTY_PROPOSAL, loadDate: '2026-10-20' }, NOW)).toEqual({ error: 'PAST' });
    expect(proposalPayload({ ...EMPTY_PROPOSAL, loadDate: '2026-10-25', deliveryDate: '2026-10-24' }, NOW)).toEqual({ error: 'DELIVERY_BEFORE_LOAD' });
  });
  it('dziś nie (jak baza), jutro tak; godzina PL dla załadunku, SE dla dostawy (z przesunięciem strefy)', () => {
    expect(proposalPayload({ ...EMPTY_PROPOSAL, loadDate: '2026-10-21' }, NOW)).toEqual({ error: 'PAST' });
    expect(proposalPayload({ ...EMPTY_PROPOSAL, loadDate: '2026-10-22' }, NOW)).toEqual({ payload: { load_date: '2026-10-22' } });
    const r = proposalPayload({ loadDate: '2026-10-24', loadTime: '08:00', deliveryDate: '2026-10-29', deliveryTime: '07:30' }, NOW);
    expect(r).toEqual({ payload: {
      load_date: '2026-10-24', load_from: '2026-10-24T08:00:00+02:00',
      delivery_date: '2026-10-29', delivery_from: '2026-10-29T07:30:00+01:00',
    } });
  });
  it('opis propozycji (komentarz domyślny i opis z bazy)', () => {
    expect(proposalSummary({ loadDate: '2026-10-24', loadTime: '08:00', deliveryDate: '', deliveryTime: '' })).toBe('Proponowany załadunek 24.10.2026, 08:00');
    expect(proposalOfDetail({ proposal: { load_date: '2026-10-24', load_from: '2026-10-24T06:00:00Z', delivery_date: '2026-10-29' } }))
      .toBe('Proponowany załadunek 24.10.2026, 08:00 · dostawa 29.10.2026');
    expect(proposalOfDetail({})).toBeNull();
    expect(proposalOfDetail(null)).toBeNull();
  });
  it('karta: przycisk z efektem PROPOSE otwiera pola daty i wysyła p_payload', () => {
    const src = readFileSync('src/components/risks/TodoCard.tsx', 'utf8');
    expect(src).toContain("effect === 'PROPOSE'");
    expect(src).toContain('ctx.decisions.resolve(d.id, proposeCode, note.trim() || proposalSummary(prop), r.payload)');
    expect(src).toContain('data-rk-propose');
  });
});

describe('#384 pkt 5–6 — kto rozstrzyga', () => {
  it('propozycję terminu (decider CLIENT) rozstrzyga KSH; SCX i Operacje nie', () => {
    expect(mayResolveDecision('CLIENT', 'CLIENT_USER')).toBe(true);
    expect(mayResolveDecision('CLIENT', 'CLIENT_ADMIN')).toBe(true);
    expect(mayResolveDecision('CLIENT', 'CARRIER_DISPATCH')).toBe(false);
    expect(mayResolveDecision('CLIENT', 'HHL_OPS', true)).toBe(false);
  });
  it('po terminie Operacje HHL zamykają sprawy przewoźnika, ale nie ADMIN', () => {
    expect(mayResolveDecision('CARRIER', 'HHL_OPS')).toBe(false);
    expect(mayResolveDecision('CARRIER', 'HHL_OPS', true)).toBe(true);
    expect(mayResolveDecision('ADMIN', 'HHL_OPS', true)).toBe(false);
  });
  it('KSH widzi na stronie Ryzyka tylko swoje decyzje', () => {
    const d = (id: string, decider: TodoDecision['decider']) => ({ id, decider } as TodoDecision);
    expect(kshProposalsOf([d('a', 'KSH'), d('b', 'SCX'), d('c', 'HHL')]).map((x) => x.id)).toEqual(['a']);
    expect(readFileSync('src/views/RisksView.tsx', 'utf8')).toContain('<KshProposals');
  });
  it('wynik propozycji (KSH_DATE_COUNTER_RESULT) w dzwonku SCX to informacja „Moje transporty”, nie „Do zrobienia”', () => {
    expect(bellSection({ kind: 'KSH_DATE_COUNTER_RESULT', loadId: 'L1', severity: 'MEDIUM', href: null } as never)).toBe('mine');
  });
});

/* F7 #390 — drobne: potwierdzenie „Przyjmuję”, brak szuflady po wysłaniu propozycji, pola daty na wąskim ekranie */
describe('w-propozycja-terminu — drobne po F7', () => {
  const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  it('KSH: „Przyjmuję” wymaga potwierdzenia i daje komunikat', () => {
    const s = src('src/components/risks/KshProposals.tsx');
    expect(s).toContain("code === 'ACCEPT' && !confirmAccept");
    expect(s).toContain('data-ksh-confirm-yes');
    expect(s).toContain('dec_ksh_done_accept');
  });
  it('po wysłaniu propozycji nie otwiera szuflady transportu', () => {
    expect(src('src/components/risks/TodoPanel.tsx')).toContain("hint !== 'KSH_DATE_COUNTER'");
  });
  it('pola daty mieszczą się w kolumnie', () => {
    expect(src('src/components/risks/risks.css')).toContain('.rk-propose-grid .input{width:100%;min-width:0}');
  });
});
