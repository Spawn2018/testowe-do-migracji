/**
 * wyglad/audyt-AF — przegląd zgodności z audytem, grupy A (rama aplikacji i Kokpit) i F (kto co widzi), 16.10.2026.
 * Decyzje: E41 (tytuł bez nazwy — nazwę wstawia ekran), E5 i E9 (dzwonek; KSH bez „Do zrobienia”), E34 (Strefy tylko HHL),
 * E37 (pełne nazwy portów, rejs PL → SE), E21 (po polsku, „t39”), E10 (kontrast ≥ 4,5 : 1), E16 (jeden kurs PLN,
 * odstęp tysięcy), E9 (Operacje HHL: jedna liczba „Do zrobienia”; rejsy i awizacja tylko do odczytu).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatExqAge } from '../src/components/ui/ExceptionRow';
import { t } from '../src/i18n/messages';
import { DEMO_ONLY_I18N } from '../src/i18n/demoOnly';
import { ferryRouteName, portName } from '../src/lib/portName';
import { nextGdnSailing } from '../src/lib/voyage';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { INITIAL_NOTIFICATIONS, INITIAL_WORKFLOW_RUNS } from '../src/data/seed';
import { bellGroups, sectionFor } from '../src/lib/bellList';
import { transportLabel, type TransportParty } from '../src/lib/transportName';
import { buildTodo, countedFor, defaultScope, scopeCards, visibleTodoRisks } from '../src/lib/p6Todo';
import { extraRisksOf, sampleDecisionsOf, todoExtrasOf } from '../src/lib/p6Source';
import { feeSuggestionsOf } from '../src/lib/p5Source';
import { todoQueue, todoRisks } from '../src/lib/cockpitE9';
import { formatLoadMoney, formatLoadRevMargin, loadFxMid } from '../src/lib/money/loadPln';
import { formatMoney } from '../src/lib/money/engine';
import { formatPlNumber } from '../src/lib/format';
import { canFixAwizOf } from '../src/lib/p7Source';
import { setAuthProfile } from '../src/auth/profile';

const snap = buildDemoSnapshot();
const loadById = (id: string) => snap.loads.find((l) => l.id === id);

const groupsFor = (role: TransportParty) =>
  bellGroups(snap.notifications, role, (id) => {
    const l = loadById(id);
    return l ? transportLabel(l, role) : undefined;
  }, 'pl');

describe('A-01 / F-03 — powiadomienia demo: tytuł bez kodu, nazwa z transportu, do którego prowadzi wpis', () => {
  it('żaden tytuł ani treść nie ma wpisanego kodu transportu', () => {
    for (const n of INITIAL_NOTIFICATIONS) {
      expect(n.title, n.id).not.toMatch(/\b(SG|T|SS|K|D|R)-\d{2}\b/);
      expect(n.body, n.id).not.toMatch(/\bdo T-\d+/);
    }
  });
  it('wpis prowadzi do transportu, którego dotyczy (CMR po dostawie, cisza GPS, zasoby, marża)', () => {
    const at = (id: string) => {
      const n = INITIAL_NOTIFICATIONS.find((x) => x.id === id)!;
      return loadById(n.loadId ?? n.href?.loadId ?? '')!;
    };
    const cmrMissing = snap.documents.filter((d) => d.category === 'CMR' && d.status === 'MISSING'
      && ['DELIVERED', 'READY_TO_INVOICE', 'INVOICED'].includes(loadById(d.loadId)?.status ?? ''));
    expect(cmrMissing.map((d) => d.loadId)).toEqual([at('n6').id]);
    expect(at('n9').silentMinutes).toBeGreaterThan(90);
    expect(at('n4').id).toBe(at('n9').id);
    expect(at('n13').status).toBe('RESOURCES_PENDING');
    expect(at('n7').code).toBe('SG-15');
    expect(at('n7').pricing.belowThreshold).toBe(true);
    expect(INITIAL_WORKFLOW_RUNS.find((r) => r.note === 'Oznaczono brak sygnału')!.loadId).toBe(at('n9').id);
  });
  it('dzwonek HHL i SCX: nazwa w drugiej linii to transport z odnośnika', () => {
    const hhl = groupsFor('HHL');
    const cmr = hhl.find((g) => g.what === 'Brak CMR')!;
    expect(cmr.name).toBe(transportLabel(loadById('load-034')!, 'HHL'));
    expect(hhl.find((g) => g.what === 'Marża poniżej progu 4%')!.name).toMatch(/^SG-15 · /);
    const scx = groupsFor('SCX');
    expect(scx.find((g) => g.what === 'Brak sygnału')!.name).toMatch(/^T-05 · SCX-/);
    expect(scx.find((g) => g.what === 'Brak kierowcy i zestawu')!.name).toMatch(/^SG-19 · SCX-/);
    expect(scx.find((g) => g.what === 'Brak zezwolenia PL')!.name).toBeUndefined();
  });
});

describe('A-02 / F-02 — KSH bez „Do zrobienia” i bez zadań SCX; wpis Stref tylko u HHL', () => {
  it('KSH: wszystkie wpisy w „Moje transporty”, bez CMR i bez postoju w Strefach', () => {
    const ksh = groupsFor('KSH');
    expect(ksh.length).toBeGreaterThan(0);
    expect(ksh.every((g) => g.section === 'mine')).toBe(true);
    expect(ksh.some((g) => g.what === 'Brak CMR')).toBe(false);
    expect(ksh.some((g) => g.place === 'zones')).toBe(false);
  });
  it('SCX: bez wpisu Stref; HHL ma go w „Do zrobienia”', () => {
    expect(groupsFor('SCX').some((g) => g.place === 'zones')).toBe(false);
    const hhl = groupsFor('HHL').find((g) => g.place === 'zones')!;
    expect(hhl.section).toBe('todo');
  });
  it('sectionFor: tylko KSH przenosi wpisy do „Moje transporty”', () => {
    expect(sectionFor('todo', 'KSH')).toBe('mine');
    expect(sectionFor('todo', 'HHL')).toBe('todo');
    expect(sectionFor('todo', 'SCX')).toBe('todo');
    expect(sectionFor('mine', 'SCX')).toBe('mine');
  });
});

describe('A-03 / A-04 — prom: pełne nazwy portów, ten sam rejs PL → SE w pasku i w Kokpicie', () => {
  it('portName i ferryRouteName: „Gdańsk → Nynäshamn”, „Gdynia → Karlskrona” w każdym języku', () => {
    expect(ferryRouteName('pl', 'GDN', 'NYN')).toBe('Gdańsk → Nynäshamn');
    expect(ferryRouteName('pl', 'GDY', 'KAA')).toBe('Gdynia → Karlskrona');
    expect(portName('en', 'NYN')).toBe('Nynäshamn');
    expect(portName('pl', 'XYZ')).toBe('XYZ');
  });
  it('nextGdnSailing: najbliższy odjazd z Gdańska, bez rejsu powrotnego (23.09.2026, 16:32 → 23.09.2026, 18:00)', () => {
    const now = new Date('2026-09-23T14:32:00Z');
    const s = nextGdnSailing(now);
    expect(s.depPort).toBe('GDN');
    expect(s.arrPort).toBe('NYN');
    expect(s.depLocal).toBe('2026-09-23T18:00:00+02:00');
  });
  it('pasek górny i Kokpit biorą rejs z nextGdnSailing i nazwy z portName', () => {
    const top = readFileSync('src/components/shell/Topbar.tsx', 'utf8');
    expect(top).toMatch(/const s = nextGdnSailing\(now\)/);
    expect(top).not.toMatch(/nextLiveSailing/);
    const dash = readFileSync('src/views/DashboardView.tsx', 'utf8');
    expect(dash).toMatch(/nextGdnSailing\(new Date\(nowMinute \* 60_000\)\)/);
    /* BN9-b: rejs z bazy — etykieta trasy z kodu (Terminal A, przeprawy z Estonii); demo — z portów */
    expect(dash.match(/ferryRoute(Name|Label)\(locale,/g)).toHaveLength(2);
    expect(dash).not.toMatch(/route: `\$\{/);
  });
});

describe('A-05 — wiek sprawy po polsku', () => {
  it('„24 min temu”, „6 h temu”, „1 dzień temu”, „3 dni temu”', () => {
    expect(formatExqAge(0.4)).toBe('24 min temu');
    expect(formatExqAge(6.2)).toBe('6 h temu');
    expect(formatExqAge(23.7)).toBe('1 dzień temu');
    expect(formatExqAge(26)).toBe('1 dzień temu');
    expect(formatExqAge(72)).toBe('3 dni temu');
    expect(formatExqAge(0.4, 'en')).toBe('24 min temu'); /* 8A (17.10): tylko po polsku */
  });
});

describe('A-06 — „t39” w kafelku „Do zafakturowania”', () => {
  it('bez „tydz.”', () => {
    for (const k of ['p3b_to_invoice_desc', 'p3b_to_invoice_ok', 'p3b_to_invoice_none']) {
      expect(t('pl', k), k).toMatch(/ · t\{w\}$/);
      expect(t('pl', k), k).not.toMatch(/tydz\./);
    }
  });
});

describe('A-07 — tytuł sprawy bez kodu transportu, którego dotyczy', () => {
  it('ryzyka demo nie powtarzają własnego kodu (nazwę wstawia ekran)', () => {
    for (const r of snap.risks) {
      const code = r.loadId ? loadById(r.loadId)?.code : (r as { loadCode?: string }).loadCode;
      if (!code || r.id === 'risk-seq' || r.id.startsWith('risk-sequence')) continue;
      expect(r.title, r.id).not.toContain(code);
    }
    const pl = DEMO_ONLY_I18N.RISK.pl;
    expect(pl.rk_seed_permit_mismatch_34).toBe('Zezwolenie niezgodne z zestawem — przekroczona wysokość i szerokość');
    expect(pl.rk_seed_doc_missing_36).toBe('Brak zezwolenia SE');
  });
});

describe('A-08 / A-09 — kontrast ≥ 4,5 : 1 przez tokeny', () => {
  it('karta przeprawy: opis w --ink-2; znacznik demo na --surface', () => {
    expect(readFileSync('src/components/risks/risks.css', 'utf8')).toMatch(/\.rk-alt \.rk-muted\{color:var\(--ink-2\)\}/);
    expect(readFileSync('src/index.css', 'utf8')).toMatch(/\.panel-mark\.demo-mark\{color:var\(--amber-ink\);background:var\(--surface\);/);
  });
});

describe('F-01 — Operacje HHL: jedna liczba „Do zrobienia” (nagłówek, menu, Kokpit, domyślny filtr)', () => {
  const nowIso = '2026-09-23T14:32:00Z';
  const cardsFor = (role: 'HHL' | 'SCX') => {
    const vis = visibleTodoRisks(role, [...snap.risks, ...extraRisksOf(snap.loads, nowIso)]);
    const decs = sampleDecisionsOf(snap.loads, nowIso, role).filter((d) => role !== 'SCX' || d.decider === 'SCX');
    const base = buildTodo({ risks: vis, decisions: decs, nowIso });
    const cardLoads = new Set(base.map((c) => c.loadId).filter((x): x is string => !!x));
    const items = snap.loads.map((load) => ({ load, fees: feeSuggestionsOf(load) ?? [], check: null }));
    const extras = todoExtrasOf(role, items, cardLoads);
    return extras.length ? buildTodo({ risks: vis, decisions: decs, extras, nowIso }) : base;
  };
  it('HHL_OPS: „Moja firma” = todoQueue (bez kart tylko z dopłatą HHL)', () => {
    const cards = cardsFor('HHL');
    const q = todoQueue('HHL', snap.risks, 'HHL_OPS')!;
    const counted = countedFor('HHL_OPS', todoRisks('HHL', snap.risks, 'HHL_OPS'));
    expect(defaultScope('HHL_OPS')).toBe('FIRM');
    expect(scopeCards(cards, 'FIRM', 'HHL', () => null, null, counted)).toHaveLength(q.total);
    /* przed poprawką filtr pokazywał więcej kart niż liczba w nagłówku */
    expect(scopeCards(cards, 'FIRM', 'HHL', () => null, null).length).toBeGreaterThan(q.total);
    expect(scopeCards(cards, 'ALL', 'HHL', () => null, null, counted)).toHaveLength(cards.length);
  });
  it('inne konta bez zmian: Administrator „Wszystkie”, SCX „Moja firma” bez listy liczonych', () => {
    expect(countedFor('HHL_ADMIN', snap.risks)).toBeUndefined();
    expect(countedFor('CARRIER_DISPATCH', snap.risks)).toBeUndefined();
    const scx = cardsFor('SCX');
    expect(scopeCards(scx, 'FIRM', 'SCX', () => null, null, countedFor('CARRIER_DISPATCH', []))).toEqual(scopeCards(scx, 'FIRM', 'SCX', () => null, null));
  });
});

describe('F-04 / F-05 — jeden kurs PLN (Harmonogram = panel „Ceny”) i odstęp tysięcy', () => {
  const sg03 = snap.loads.find((l) => l.code === 'SG-03')!;
  it('kurs transportu z migawki NBP, nie stałe 4,39', () => {
    const mid = loadFxMid(sg03, 'rev')!;
    expect(mid).toBe(sg03.pricing.money!.rev.fx.mid);
    expect(mid).not.toBe(4.39);
    expect(loadFxMid({ pricing: { ...sg03.pricing, money: undefined } }, 'rev')).toBeNull();
  });
  it('kwoty Harmonogramu = kwoty panelu (przychód × kurs przychodu, marża = przychód × kurs − koszt × kurs)', () => {
    const p = sg03.pricing;
    const r = loadFxMid(sg03, 'rev')!;
    const c = loadFxMid(sg03, 'cost')!;
    const money = (n: number) => `${formatPlNumber(n, 2)} PLN`;
    const rm = formatLoadRevMargin(sg03, 'pl', 'PLN');
    expect(rm.rev.replace(/\s/g, ' ')).toBe(money(p.revTotal * r).replace(/\s/g, ' '));
    expect(rm.margin.replace(/\s/g, ' ')).toBe(money(p.revTotal * r - p.costTotal * c).replace(/\s/g, ' '));
    expect(formatLoadMoney(p.costTotal, sg03, 'cost', 'pl', 'PLN').replace(/\s/g, ' ')).toBe(money(p.costTotal * c).replace(/\s/g, ' '));
    expect(formatLoadMoney(p.revTotal, sg03, 'rev', 'pl', 'EUR')).toBe(formatMoney(p.revTotal, 'pl', 'EUR'));
  });
  it('Harmonogram i panel biorą kurs z loadPln.ts', () => {
    const sched = readFileSync('src/components/schedule/SchedTables.tsx', 'utf8');
    expect(sched).not.toMatch(/formatAppMoney/);
    expect(readFileSync('src/components/drawer/PanelPrices.tsx', 'utf8')).toMatch(/const midCost = loadFxMid\(load, 'cost'\)/);
  });
  it('F-05: „7 301,36 PLN” — odstęp tysięcy także w kwotach 4-cyfrowych', () => {
    expect(formatMoney(7301.36, 'pl', 'PLN')).toMatch(/^7\s301,36\sPLN$/);
    expect(formatMoney(1724.82, 'pl', 'PLN')).toMatch(/^1\s724,82\sPLN$/);
    expect(formatMoney(422.74, 'pl', 'PLN')).toMatch(/^422,74\sPLN$/);
  });
});

describe('F-07 — Operacje HHL: rejsy i awizacja tylko do odczytu (według rodzaju konta)', () => {
  const asKind = (role: string | null) => setAuthProfile(role ? {
    user_id: 'u1', email: 'x@example.com', full_name: 'Test', role: role as never, org_code: 'HHL', org_name: 'H&H Logistics', locale: 'pl', active: true,
  } : null);
  it('„Popraw awizację” i edycja okna: Administrator HHL tak, Operacje HHL nie, KSH i SCX nie', () => {
    asKind(null);
    expect(canFixAwizOf('HHL')).toBe(true);
    asKind('HHL_ADMIN');
    expect(canFixAwizOf('HHL')).toBe(true);
    asKind('HHL_OPS');
    expect(canFixAwizOf('HHL')).toBe(false);
    expect(canFixAwizOf('KSH')).toBe(false);
    asKind(null);
    const modal = readFileSync('src/components/drawer/AwizacjaModal.tsx', 'utf8');
    expect(modal).toMatch(/const readOnly = role === 'KSH' \|\| \(role === 'HHL' && !canFixAwizOf\(role\)\)/);
  });
  it('Rejsy: w demo „Dodaj rejs”, „Opóźnienie”, „Odwołaj” tylko dla konta innego niż Operacje', () => {
    const src = readFileSync('src/views/SailingsPanel.tsx', 'utf8');
    expect(src).toMatch(/: role === 'HHL' && accountRole\(role\) !== 'HHL_OPS';/); /* wyglad/W-konta: rodzaj konta także w demo */
    expect(src).toMatch(/\? getAuthProfile\(\)\?\.role === 'HHL_ADMIN'/);
  });
});
