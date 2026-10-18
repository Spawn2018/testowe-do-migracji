/**
 * wyglad/P8-d (E35, img/e35-after): Automatyzacje — własne reguły zdaniami „Gdy … wtedy …”, walidacja kreatora
 * (powód przy zmianie), „Sprawdź na ostatnich 30 dniach” (pobyt w strefie SG-03 z E34), wbudowane automaty robiące
 * to samo, przebiegi i historia zdaniami (bez kodów), produkcja bez źródła.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  builtinOverlap, durText, dwellHits, emptyDraft, recentRuns, sameRules, validateRule, whenOf,
  type OwnRule, type RuleDraft, type RuleRun, type Visit, type ZoneOption,
} from '../src/lib/p8dRules';
import { histText, ruleSentence, runText, whenText } from '../src/components/automations/ruleText';
import { P8D_PL } from '../src/i18n/p8d';
import { demoRuleCheck, demoRuleHistory, demoRuleRemove, demoRuleRuns, demoRuleSave, demoRuleSetEnabled, demoRulesNow } from '../src/lib/p8dDemo';

const ZONES: ZoneOption[] = [
  { id: 'srem', name: 'KSH Śrem · Grunwaldzka 27C', type: 'LOADING' },
  { id: 'bod-buf', name: 'Bufor 50 km przed Boden', type: 'PRE_ARRIVAL' },
  { id: 'bod', name: 'Plac budowy Stegra Boden', type: 'SITE' },
  { id: 'gda-buf', name: 'Bufor 20 km przed Gdańskiem', type: 'PRE_PORT' },
];
/** spacje nierozdzielające (liczba i jednostka w jednej linii) — porównanie po zwykłych spacjach */
const sp = (s: string) => s.replace(/\u00a0/g, ' ');
const draft = (p: Partial<RuleDraft> = {}): RuleDraft => ({ ...emptyDraft('bod'), name: 'Długi pobyt na placu', ...p });

describe('zdanie reguły (E35 pkt 3)', () => {
  it('„Gdy auto jest w strefie … dłużej niż 3 h — wtedy powiadomienie: HHL Operacje, SCX”', () => {
    const d = draft({ then: { notify: ['HHL_OPS', 'SCX'], todo: null, email: false, smsTo: null } });
    expect(sp(ruleSentence(d, ZONES))).toBe('Gdy auto jest w strefie „Plac budowy Stegra Boden” dłużej niż 3 h — wtedy powiadomienie: HHL Operacje, SCX');
  });
  it('wszystkie rodzaje „Gdy” po polsku, bez kodów statusów i spraw', () => {
    expect(sp(whenText({ when: { kind: 'status', status: 'DELIVERED' } }, ZONES))).toBe('Gdy transport dostaje status „Dostarczone”');
    expect(sp(whenText({ when: { kind: 'status', status: 'ANY' } }, ZONES))).toBe('Gdy zmienia się status transportu');
    expect(sp(whenText({ when: { kind: 'issue', issue: 'AWIZ' } }, ZONES))).toBe('Gdy powstaje sprawa: brak awizacji');
    expect(sp(whenText({ when: { kind: 'daily', check: 'LOAD_WITHIN', hours: 48 } }, ZONES))).toBe('Codziennie o 06:00: transporty z załadunkiem w ciągu 48 h');
    for (const k of ['zone', 'status', 'issue', 'daily'] as const) {
      expect(sp(whenText({ when: whenOf(k, 'bod') }, ZONES))).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    }
  });
  it('„Wtedy” łączy akcje: sprawa, e-mail, SMS według E42', () => {
    const d = draft({ then: { notify: ['KSH'], todo: 'SCX', email: true, smsTo: 'BODEN' } });
    expect(sp(ruleSentence(d, ZONES))).toContain('wtedy powiadomienie: KSH · sprawa w Do zrobienia (SCX) · e-mail · SMS do odbiorców (Boden)');
  });
  it('czas „dłużej niż” słowami', () => {
    expect(sp(durText(15))).toBe('15 min');
    expect(sp(durText(90))).toBe('1 h 30 min');
    expect(sp(durText(1440))).toBe('24 h');
  });
});

describe('kreator: walidacja', () => {
  it('nazwa, strefa i co najmniej jedna akcja; e-mail tylko z powiadomieniem', () => {
    expect(validateRule({ ...draft({ name: ' ' }), when: { kind: 'zone', zoneId: '', minutes: 180 } }, '', false)).toEqual(['name', 'zone', 'then']);
    expect(validateRule(draft({ then: { notify: [], todo: null, email: true, smsTo: null } }), '', false)).toEqual(['email']);
    expect(validateRule(draft({ then: { notify: [], todo: null, email: false, smsTo: 'SREM' } }), '', false)).toEqual([]);
  });
  it('zmiana istniejącej reguły wymaga powodu (historia z powodem, E35 pkt 4); nowa — nie', () => {
    const ok = draft({ then: { notify: ['SCX'], todo: null, email: false, smsTo: null } });
    expect(validateRule(ok, '', true)).toEqual(['reason']);
    expect(validateRule(ok, '  SCX prosi  ', true)).toEqual([]);
    expect(validateRule(ok, '', false)).toEqual([]);
  });
});

describe('„Sprawdź na ostatnich 30 dniach”', () => {
  const now = '2026-10-08T10:00:00Z';
  const V: Visit[] = [
    { code: 'SG-03', loadId: null, zoneId: 'bod', enter: '2026-10-07T06:35:00Z', exit: '2026-10-07T10:19:00Z' },
    { code: 'SG-03', loadId: null, zoneId: 'bod-buf', enter: '2026-10-06T09:22:00Z', exit: '2026-10-07T11:34:00Z' },
    { code: 'SG-09', loadId: null, zoneId: 'bod', enter: '2026-10-08T08:00:00Z', exit: null },
    { code: 'SG-01', loadId: null, zoneId: 'bod', enter: '2026-09-01T08:00:00Z', exit: '2026-09-02T08:00:00Z' },
  ];
  it('SG-03 na placu 07.10 08:35–12:19 (E34): przy 3 h zadziałałaby raz o 11:35, z wyjazdem', () => {
    const h = dwellHits(V, 'bod', 180, now);
    expect(h.map((x) => x.code)).toEqual(['SG-03']);
    expect(h[0]).toMatchObject({ from: '2026-10-07T06:35:00Z', at: '2026-10-07T09:35:00.000Z', exit: '2026-10-07T10:19:00Z', still: false });
  });
  it('pobyt bez wyjazdu liczy się do teraz; pobyt sprzed 30 dni — nie', () => {
    const h = dwellHits(V, 'bod', 60, now);
    expect(h.map((x) => x.code)).toEqual(['SG-09', 'SG-03']);
    expect(h[0]!.still).toBe(true);
  });
  it('wbudowane automaty robiące to samo', () => {
    expect(builtinOverlap({ kind: 'zone', zoneId: 'bod', minutes: 240 }, ZONES)).toEqual(['dwell']);
    expect(builtinOverlap({ kind: 'zone', zoneId: 'bod', minutes: 180 }, ZONES)).toEqual([]);
    expect(builtinOverlap({ kind: 'zone', zoneId: 'srem', minutes: 360 }, ZONES)).toEqual(['dwell']);
    expect(builtinOverlap({ kind: 'zone', zoneId: 'gda-buf', minutes: 15 }, ZONES)).toEqual(['arrive']);
    expect(builtinOverlap({ kind: 'status', status: 'ANY' }, ZONES)).toEqual(['status']);
    expect(builtinOverlap({ kind: 'daily', check: 'DATES_UNCONFIRMED', hours: 48 }, ZONES)).toEqual(['dates']);
    expect(builtinOverlap({ kind: 'daily', check: 'LOAD_WITHIN', hours: 72 }, ZONES)).toEqual([]);
  });
  it('własna reguła z tym samym „Gdy” i wspólnym odbiorcą — ostrzeżenie; sama siebie nie liczy', () => {
    const r: OwnRule = { ...draft({ then: { notify: ['SCX'], todo: null, email: false, smsTo: null } }), id: 'r1', runs30: 0, lastRunAt: null, name: 'Plac 3 h' };
    expect(sameRules(draft({ then: { notify: ['SCX', 'KSH'], todo: null, email: false, smsTo: null } }), [r], null)).toEqual(['Plac 3 h']);
    expect(sameRules(draft({ then: { notify: ['KSH'], todo: null, email: false, smsTo: null } }), [r], null)).toEqual([]);
    expect(sameRules(draft({ then: { notify: ['SCX'], todo: null, email: false, smsTo: null } }), [r], 'r1')).toEqual([]);
  });
});

describe('przebiegi i historia zdaniami (bez SKIPPED i „warunek niespełniony”)', () => {
  it('wyniki', () => {
    expect(sp(runText({ kind: 'done', notify: [{ who: 'KSH', n: 4 }, { who: 'SCX', n: 1 }] }))).toBe('powiadomienie: KSH 4 osoby, SCX 1 osoba');
    expect(sp(runText({ kind: 'nomatch', why: 'wjazd na plac, a reguła dotyczy strefy 50 km' }))).toBe('nie pasuje: wjazd na plac, a reguła dotyczy strefy 50 km');
    expect(sp(runText({ kind: 'skipped', since: '2026-10-05T08:09:00Z' }, 2))).toBe('pominięte: reguły wyłączone (05.10.2026)');
    expect(sp(runText({ kind: 'skipped', since: '2026-10-05T08:09:00Z' }))).toBe('pominięte: reguła wyłączona (05.10.2026)');
    expect(sp(runText({ kind: 'done', notify: [], smsN: 2 }))).toBe('SMS (2)');
  });
  it('tylko ostatnie 30 dni, najnowsze pierwsze', () => {
    const R = (id: string, at: string): RuleRun => ({ id, at, rules: ['x'], code: 'SG-03', loadId: null, result: { kind: 'skipped', since: null } });
    expect(recentRuns([R('a', '2026-09-01T00:00:00Z'), R('b', '2026-10-01T00:00:00Z'), R('c', '2026-10-06T00:00:00Z')], '2026-10-08T00:00:00Z').map((r) => r.id)).toEqual(['c', 'b']);
  });
  it('historia: akcja, reguła, powód; dawne przełączenia bez powodu opisane wprost', () => {
    expect(sp(histText({ at: '', who: 'Anna', action: 'off', rule: 'Plac 3 h', reason: 'SCX prosi' }))).toBe('wyłączona · „Plac 3 h” · powód: SCX prosi');
    expect(sp(histText({ at: '', who: 'Admin', action: 'on', rule: 'Transport anulowany', reason: null }))).toBe('włączona · „Transport anulowany” · powód: — (wtedy pola nie było)');
    expect(sp(histText({ at: '', who: 'Anna', action: 'created', rule: 'Plac 3 h', reason: null }))).toBe('dodana · „Plac 3 h”');
  });
});

describe('demo: zapis z powodem trafia do historii (E35 pkt 4)', () => {
  it('dodanie, wyłączenie z powodem, usunięcie', async () => {
    const d = draft({ then: { notify: ['SCX'], todo: null, email: false, smsTo: null } });
    const before = demoRulesNow().length;
    const r = await demoRuleSave(null, d, null);
    expect(r.ok).toBe(true);
    const id = r.rule!.id;
    expect(demoRulesNow().length).toBe(before + 1);
    expect((await demoRuleSetEnabled(id, false, 'test')).ok).toBe(true);
    expect(demoRulesNow().find((x) => x.id === id)?.enabled).toBe(false);
    const chk = await demoRuleCheck(d, null);
    expect(chk.same).toEqual([d.name]);
    expect((await demoRuleRemove(id, 'koniec')).ok).toBe(true);
    const h = await demoRuleHistory();
    expect(h.slice(0, 3).map((x) => [x.action, x.reason])).toEqual([['removed', 'koniec'], ['off', 'test'], ['created', null]]);
    expect(demoRulesNow().length).toBe(before);
  });
  it('przebiegi jak w bazie 08.10 (E35 „Fakty”): jeden wykonany — SG-03, 06.10 11:22', async () => {
    const done = (await demoRuleRuns()).filter((r) => r.result.kind === 'done');
    expect(done.map((r) => [r.code, r.at])).toEqual([['SG-03', '2026-10-06T09:22:00Z']]);
  });
});

describe('teksty i źródło', () => {
  it('bez „sms:” / „mailto:” / „supabase” (I-2)', () => {
    const all = (Object.keys(P8D_PL).join('\n') + Object.values(P8D_PL).join('\n')).toLowerCase();
    expect(all).not.toContain('sms:');
    expect(all).not.toContain('mailto:');
    expect(all).not.toContain('supabase');
  });
  it('produkcja przed podłączeniem: Automatyzacje zostają przy dzisiejszym widoku', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      const { rulesOf } = await import('../src/lib/p8dSource');
      const { rulesReady } = await import('../src/lib/p8dReady');
      expect(rulesOf()).toBeNull();
      expect(rulesReady()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('demo: strona E35 i źródło reguł włączają się razem (p8dReady = p8dSource)', async () => {
    const { rulesOf } = await import('../src/lib/p8dSource');
    const { rulesReady } = await import('../src/lib/p8dReady');
    expect(rulesReady()).toBe(rulesOf() !== null);
    expect(rulesReady()).toBe(true);
  });
});
