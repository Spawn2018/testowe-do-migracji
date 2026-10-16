/**
 * wyglad/audyt-AF — przegląd zgodności z audytem, grupy A (rama aplikacji i Kokpit) i F (kto co widzi), 16.10.2026.
 * Decyzje: E41 (tytuł bez nazwy — nazwę wstawia ekran), E5 i E9 (dzwonek; KSH bez „Do zrobienia”), E34 (Strefy tylko HHL),
 * E37 (pełne nazwy portów, rejs PL → SE), E21 (po polsku, „t39”), E10 (kontrast ≥ 4,5 : 1), E16 (jeden kurs PLN,
 * odstęp tysięcy), E9 (Operacje HHL: jedna liczba „Do zrobienia”; rejsy i awizacja tylko do odczytu).
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { INITIAL_NOTIFICATIONS, INITIAL_WORKFLOW_RUNS } from '../src/data/seed';
import { bellGroups, sectionFor } from '../src/lib/bellList';
import { transportLabel, type TransportParty } from '../src/lib/transportName';

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
    expect(hhl.find((g) => g.what === 'Marża poniżej progu 4 %')!.name).toMatch(/^SG-15 · /);
    const scx = groupsFor('SCX');
    expect(scx.find((g) => g.what === 'Brak sygnału')!.name).toMatch(/^T-05 · SCX-/);
    expect(scx.find((g) => g.what === 'Brak naczepy')!.name).toMatch(/^SG-09 · SCX-/);
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
