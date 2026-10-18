// E5 (img/e5-desk, decyzja 07.10 13:21): dzwonek w grupach „Do zrobienia” i „Moje transporty”;
// sytuacja ogólna (promy, drogi, pogoda bez transportu) nie trafia do dzwonka — tylko strona Ryzyka.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bellGeneralCount, bellGroups, bellPlace, bellSection, bellWhat, type BellSource } from '../src/lib/bellList';

const L1 = 'load-1';
const now = Date.parse('2026-10-07T12:00:00+02:00');
const n = (id: string, kind: string | undefined, loadId: string | undefined, extra: Partial<BellSource> = {}): BellSource => ({
  id, at: '2026-10-07T11:00:00+02:00', title: 'Zdarzenie', body: '', severity: 'MEDIUM', read: false, kind, loadId, ...extra,
});

describe('E5: grupy dzwonka', () => {
  it('ryzyko, prom, droga, pogoda bez transportu = sytuacja ogólna (poza dzwonkiem)', () => {
    for (const k of ['RISK_OPEN', 'RISK_RESOLVED', 'FERRY', 'WEATHER', 'ROAD_SE', 'ROAD_PL']) {
      expect(bellSection(n('a', k, undefined)), k).toBe('general');
    }
  });
  it('strefa, status, ryzyko przed pojazdem z transportem = Moje transporty', () => {
    for (const k of ['ZONE_ENTER', 'ZONE_EXIT', 'LOAD_STATUS_CHANGED', 'RISK_OPEN', 'ROAD_SE', 'PLAN_DATES_CHANGED']) {
      expect(bellSection(n('a', k, L1)), k).toBe('mine');
    }
  });
  it('decyzje, braki, czat, faktury, numery = Do zrobienia', () => {
    for (const k of ['DECISION_OPEN', 'DECISION_ESCALATED', 'RESOURCE_DEADLINE', 'ORDER_NO_MISSING', 'LOAD_CHAT_MESSAGE', 'INVOICE_DISPUTED', 'DOC_MISSING']) {
      expect(bellSection(n('a', k, L1)), k).toBe('todo');
    }
    expect(bellSection(n('a', 'INVOICE_NEW', undefined))).toBe('todo');
  });
  it('P11: informacja bez działania i bez transportu (faktura zaakceptowana, import zatwierdzony) = Moje transporty', () => {
    expect(bellSection(n('a', 'INVOICE_ACCEPTED', undefined))).toBe('mine');
    expect(bellSection(n('a', 'SCHEDULE_IMPORTED', undefined))).toBe('mine');
  });
  it('ryzyko podniesione do krytycznego przy transporcie = Do zrobienia, inne podniesienie = Moje transporty', () => {
    expect(bellSection(n('a', 'RISK_SEVERITY', L1, { severity: 'CRITICAL' }))).toBe('todo');
    expect(bellSection(n('a', 'RISK_SEVERITY', L1, { severity: 'HIGH' }))).toBe('mine');
  });
  it('wpis bez szablonu (demo): ryzyko bez transportu ogólne, transport na Mapie lub w Harmonogramie — moje', () => {
    expect(bellSection(n('a', undefined, undefined, { href: { view: 'risk' } }))).toBe('general');
    expect(bellSection(n('a', undefined, L1, { href: { view: 'map' } }))).toBe('mine');
    expect(bellSection(n('a', undefined, undefined, { href: { view: 'docs' } }))).toBe('todo');
  });
  it('sytuacja ogólna nie wchodzi do listy; licznik z ostatniej doby', () => {
    const items = [n('g1', 'FERRY', undefined), n('g2', 'ROAD_SE', undefined, { at: '2026-10-05T10:00:00+02:00' }), n('t1', 'DECISION_OPEN', L1)];
    const groups = bellGroups(items, 'HHL', () => 'SG-03 · 0005/09/S/2026', 'pl');
    expect(groups.map((g) => g.latest.id)).toEqual(['t1']);
    expect(groups[0]!.section).toBe('todo');
    expect(bellGeneralCount(items, 'HHL', now)).toBe(1);
  });
});

describe('E5: miejsce po kliknięciu i tytuł bez nazwy', () => {
  it('napis po prawej według celu kliknięcia (L-4)', () => {
    expect(bellPlace({ href: { path: '/decyzje/d1' } })).toBe('decision');
    expect(bellPlace({ href: { path: '/transport/SG-03?zakladka=dokumenty' } })).toBe('docs');
    expect(bellPlace({ href: { path: '/transport/SG-03?zakladka=ustalenia' } })).toBe('chat');
    expect(bellPlace({ href: { path: '/transport/SG-03?zakladka=awizacja-pilot' } })).toBe('awiz');
    expect(bellPlace({ href: { path: '/transport/SG-03?zakladka=numer-hhl' } })).toBe('numbers');
    expect(bellPlace({ href: { path: '/transport/SG-03?zakladka=status' } })).toBe('transport');
    expect(bellPlace({ href: { path: '/finanse/faktury/i1' } })).toBe('invoice');
    expect(bellPlace({ href: { path: '/opcje/stan-systemu#integracje' } })).toBe('system');
    expect(bellPlace({ href: { view: 'risk' } })).toBe('risks');
  });
  it('„co się stało” bez nazwy transportu na początku', () => {
    expect(bellWhat('Brak awizacji przed załadunkiem', 'SG-03 · 0005/09/S/2026', 'pl')).toBe('Brak awizacji przed załadunkiem');
    expect(bellWhat('SG-03: Brak awizacji', 'SG-03', 'pl')).toBe('Brak awizacji');
  });
  it('komponent: dwie grupy, zdanie o Ryzykach, biała liczba na stałym tle (E10)', () => {
    const src = readFileSync('src/components/shell/NotificationBell.tsx', 'utf8');
    expect(src).toMatch(/section\('todo', todo\)/);
    expect(src).toMatch(/section\('mine', mine\)/);
    expect(src).toMatch(/bell_general_link/);
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/\.bell-badge\{color:var\(--on-red\);background:var\(--alarm\)/);
    expect(css).toMatch(/nav\.tower-nav \.nav-pin \.count\.hot\{[^}]*background:var\(--alarm\)/);
  });
});
