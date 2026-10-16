/**
 * wyglad/P6-e (D-20261016-0250-01 Cz11, D-20261016-0310-01 Cz14 i Cz23, D-20261016-0315-01): „Przeczytali” — kto i kiedy,
 * firmy, w których nikt nie otworzył; wejście z powiadomienia (`?odpowiedz=1&tekst=`); wiadomość w dzwonku
 * „SG-03 · kto” + treść, „tylko HHL i SCX”, „3 nowe wiadomości”; demo — KSH nigdy nie dostaje rozmowy HHL ↔ SCX;
 * produkcja bez automatycznego odczytu dzwonka do podłączenia.
 */
import { describe, expect, it, vi } from 'vitest';
import { chatReadView, joinOrgsPl, peopleText } from '../src/lib/chatReads';
import { composeFromSearch, setChatCompose, takeChatCompose } from '../src/lib/chatCompose';
import { bellGroups, isChatKind, type BellSource } from '../src/lib/bellList';
import { demoChatNotices } from '../src/lib/p6eDemo';
import { P6E_PL } from '../src/i18n/p6e';
import type { Load, LoadMessage } from '../src/types';

const sp = (s: string) => s.replace(/ /g, ' ');

describe('„Przeczytali” — kto i kiedy', () => {
  const m = {
    org: 'HHL' as const,
    visibleTo: 'ALL' as const,
    reads: [
      { userId: 'u2', name: 'Piotr Zieliński', org: 'KSH', at: '2026-10-14T10:30:00Z' },
      { userId: 'u1', name: 'Jan Nowak', org: 'Scandinavian Express', at: '2026-10-14T10:12:00Z' },
      { userId: 'u3', name: 'Ewa Kowalska', org: 'HHL', at: '2026-10-14T10:40:00Z' },
    ],
  };
  it('od najwcześniejszego odczytu, firma jako kod, „Ty” przy moim koncie', () => {
    const v = chatReadView(m, 'u3');
    expect(v.readers.map((r) => [r.name, r.org, r.me])).toEqual([['Jan Nowak', 'SCX', false], ['Piotr Zieliński', 'KSH', false], ['Ewa Kowalska', 'HHL', true]]);
    expect(v.pending).toEqual([]);
  });
  it('firmy bez odczytu (bez firmy autora); „tylko HHL i SCX” — KSH poza odbiorcami', () => {
    expect(chatReadView({ ...m, reads: [m.reads[1]] }, null).pending).toEqual(['KSH']);
    expect(chatReadView({ ...m, reads: [] }, null).pending).toEqual(['SCX', 'KSH']);
    const only = chatReadView({ org: 'SCX', visibleTo: 'HHL_SCX', reads: [] }, null);
    expect(only.audience).toEqual(['HHL', 'SCX']);
    expect(only.pending).toEqual(['HHL']);
  });
  it('liczba osób po polsku i lista firm', () => {
    expect([1, 2, 4, 5, 12, 22].map((n) => sp(peopleText(n)))).toEqual(['1 osoba', '2 osoby', '4 osoby', '5 osób', '12 osób', '22 osoby']);
    expect(joinOrgsPl(['HHL', 'SCX', 'KSH'])).toBe('HHL, SCX i KSH');
    expect(joinOrgsPl(['KSH'])).toBe('KSH');
  });
});

describe('wejście z powiadomienia', () => {
  it('odpowiedz=1 → kursor; tekst → wpisany (do 2000 znaków); bez parametrów → nic', () => {
    expect(composeFromSearch('?zakladka=czat&odpowiedz=1')).toEqual({ focus: true, text: null });
    expect(composeFromSearch(`?zakladka=czat&tekst=${encodeURIComponent('Będę o 14:00')}`)).toEqual({ focus: true, text: 'Będę o 14:00' });
    expect(composeFromSearch(`?tekst=${'x'.repeat(2500)}`)!.text!.length).toBe(2000);
    expect(composeFromSearch('?zakladka=czat')).toBeNull();
  });
  it('polecenie tylko dla swojego transportu i tylko raz', () => {
    setChatCompose('load-1', { focus: true, text: 'a' });
    expect(takeChatCompose('load-2')).toBeNull();
    expect(takeChatCompose('load-1')).toEqual({ focus: true, text: 'a' });
    expect(takeChatCompose('load-1')).toBeNull();
  });
});

describe('wiadomość w dzwonku', () => {
  const base = (id: string, at: string, body: string, extra: Partial<BellSource> = {}): BellSource => ({
    id, at, title: 'SG-03 · Anna Wiśniewska // H&H Logistics', body, severity: 'MEDIUM', read: false, loadId: 'l3', kind: 'LOAD_CHAT_MESSAGE', ...extra,
  });
  const name = () => 'SG-03 · HHL/2026/1243';
  it('„nazwa — kto” (E41), treść; kilka wiadomości → „3 nowe wiadomości”', () => {
    const g = bellGroups([base('a', '2026-10-14T10:00:00Z', 'Pierwsza'), base('b', '2026-10-14T10:05:00Z', 'Druga'), base('c', '2026-10-14T10:09:00Z', 'Trzecia')], 'HHL', name, 'pl');
    expect(g).toHaveLength(1);
    expect(g[0].title).toBe('SG-03 · HHL/2026/1243 — Anna Wiśniewska // H&H Logistics');
    expect(bellGroups([base('a', '2026-10-14T10:00:00Z', 'x')], 'KSH', () => 'SG-03', 'pl')[0].title).toBe('SG-03 — Anna Wiśniewska // H&H Logistics');
    expect(g[0].chat?.text).toBe('Trzecia');
    expect(sp(g[0].chat?.more ?? '')).toBe('3 nowe wiadomości');
  });
  it('długa treść skrócona do 160 znaków z „…”; „tylko HHL i SCX” z `chatOnly`', () => {
    const g = bellGroups([base('a', '2026-10-14T10:00:00Z', 'x'.repeat(400), { chatOnly: true })], 'HHL', name, 'pl');
    expect(g[0].chat?.text.length).toBe(160);
    expect(g[0].chat?.text.endsWith('…')).toBe(true);
    expect(g[0].chat?.only).toBe(true);
    expect(isChatKind('MESSAGE')).toBe(true);
    expect(isChatKind('RISK_OPEN')).toBe(false);
  });
  it('demo: rozmowa „tylko HHL i SCX” nigdy u KSH; wiadomość HHL u KSH (jeszcze nieprzeczytana)', () => {
    const loads = [{ id: 'l1', code: 'SG-01' }, { id: 'l2', code: 'SG-02' }] as unknown as Load[];
    const msgs = [
      { id: 'msg-1', loadId: 'l1', at: '2026-09-21T11:00:00+02:00', author: 'Anna Ops', org: 'HHL', text: 'Proszę potwierdzić awizację dla SG-01.' },
      { id: 'msg-2', loadId: 'l2', at: '2026-09-21T11:00:00+02:00', author: 'Erik Dispatch', org: 'SCX', text: 'Awizacja potwierdzona.' },
    ] as LoadMessage[];
    const n = demoChatNotices(loads, msgs);
    expect(n.filter((x) => x.chatOnly).every((x) => x.roleScope?.length === 1 && x.roleScope[0] === 'HHL')).toBe(true);
    expect(n.filter((x) => x.roleScope?.includes('KSH')).every((x) => !x.chatOnly)).toBe(true);
    expect(n.find((x) => x.roleScope?.includes('KSH'))?.title).toBe('SG-01 · Anna Wiśniewska // H&H Logistics');
    expect(n.every((x) => x.href?.path?.endsWith('?zakladka=czat'))).toBe(true);
  });
});

describe('teksty i produkcja', () => {
  it('bez „sms:” / „mailto:” / „supabase” (I-2)', () => {
    const all = (Object.keys(P6E_PL).join('\n') + Object.values(P6E_PL).join('\n')).toLowerCase();
    for (const bad of ['sms:', 'mailto:', 'supabase']) expect(all).not.toContain(bad);
  });
  it('produkcja: otwarcie Czatu nie oznacza dzwonka sam (do podłączenia, Cz22)', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      vi.resetModules();
      const m = await import('../src/lib/p6eSource');
      expect(m.chatBellAutoReadOn()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
