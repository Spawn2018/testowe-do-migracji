/**
 * wyglad/audyt-C — przegląd zgodności z audytem, grupa C (Ryzyka, Dokumenty, Finanse, Faktury), 16.10.2026.
 * Decyzje: E7 (bez kodów, jednakowe zgłoszenia łączą się), E49 (zamknięcie = sprawa „Objazd czy postój?”), E31 (CMR
 * z podpisem odbiorcy, bez POD i rysunku, nazwy plików z kodem, polisy firmy), 16.10 13:58 (VAT 23 % liczy system,
 * „Polisa HHL”, data z rokiem), E4 (faktura po tygodniu rozładunku, jedna liczba w menu i na kaflu), E16 (rodzaje po
 * polsku), E3 (jedna opłata paliwowa).
 */
import { describe, expect, it } from 'vitest';
import { buildSeedDocuments, buildSeedRisks, INITIAL_NOTIFICATIONS, WORKFLOWS } from '../src/data/seed';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { mergeClosures } from '../src/lib/e49Detour';
import { addDaysIso, isoWeekMonday, vatGrossOf } from '../src/lib/invoices3';
import { pendingWeeks, weekOptionLabel } from '../src/lib/p5Invoices';
import { invoiceReadyLoads, invoiceTodoCount } from '../src/lib/cockpitE9';
import { itemKindName } from '../src/lib/p5Finance';
import { docRequirementsStart, docsSeenOf, fuelWeeksOf, policiesOf } from '../src/lib/p5Source';
import { demoFuelScreen } from '../src/lib/p5bDemo';
import { demoReadyGaps } from '../src/lib/p4cDemo';
import { cmrKind } from '../src/lib/p5Docs';
import { ft } from '../src/i18n/p5';
import { RISK_I18N } from '../src/i18n/risks';
import { DEMO_ONLY_I18N } from '../src/i18n/demoOnly';
import type { Document } from '../src/types';

const snap = buildDemoSnapshot();

describe('C-01, C-02, C-15 — Ryzyka i dzwonek po polsku', () => {
  const risks = buildSeedRisks(snap.loads);
  it('C-01: ryzyko SG-34 bez „Permit mismatch”, „READY” i „PERMIT_SE”', () => {
    const text = risks.map((r) => `${r.title} ${r.detail ?? ''} ${r.meta ?? ''}`).join('\n');
    expect(text).not.toMatch(/Permit mismatch|READY|PERMIT_SE|missing/);
    /* audyt-AF A-07 (E41): nazwę transportu wstawia ekran — tytuł bez „SG-34” */
    expect(DEMO_ONLY_I18N.RISK.pl.rk_seed_permit_mismatch_34).toBe('Zezwolenie niezgodne z zestawem — przekroczona wysokość i szerokość');
  });
  it('C-02: zamknięcie przy T-17 w postaci E49 i połączone ze sprawą „Objazd czy postój?” (jedna sprawa w karcie)', () => {
    expect(RISK_I18N.pl.rk_seed_e4_closure).toBe('Högakustenbron (E4) zamknięty — porywy 31 m/s');
    const t17 = snap.loads.find((l) => l.code === 'T-17')!;
    const closure = risks.filter((r) => r.loadId === t17.id);
    expect(closure.map((r) => r.causeCategory)).toEqual(['closure']);
    const m = mergeClosures(risks, [{ id: `detour:${t17.id}`, loadId: t17.id }]);
    expect(m.risks.some((r) => r.loadId === t17.id)).toBe(false);
    expect(m.mergedIds[`detour:${t17.id}`]).toEqual(closure.map((r) => r.id));
    expect(mergeClosures(risks, []).risks).toHaveLength(risks.length);
  });
  it('C-15: dzwonek — „faktoring”, próg 4 %, tydzień „t38”, kwota w EUR, bez „READY”', () => {
    const text = [...INITIAL_NOTIFICATIONS.map((n) => `${n.title} ${n.body}`), ...WORKFLOWS.map((w) => `${w.name} ${w.description}`)].join('\n');
    expect(text).not.toMatch(/factoring|READY|W3\d\b|12%|>50 PLN/);
    /* audyt-AF A-01: tytuł bez kodu — nazwę transportu (SG-15) wstawia dzwonek z odnośnika */
    expect(text).toContain('Marża poniżej progu 4 %');
    expect(text).not.toContain('· SG-15');
    expect(text).toContain('Faktura w sporze · t38');
    expect(text).toContain('Zgodność OK · faktoring zaplanowany.');
  });
});

describe('C-03…C-07 — Dokumenty (E31)', () => {
  const docs = buildSeedDocuments(snap.loads);
  it('C-03: w demo tylko „CMR z podpisem odbiorcy” po „Dostarczone”; bez rysunku', () => {
    const reqs = docRequirementsStart();
    const cmr = reqs.find((r) => r.category === 'CMR')!;
    expect(cmrKind(cmr)).toBe('SIGNED');
    expect(ft('pl', 'p5_doc_r_CMR_SIGNED')).toBe('CMR z podpisem odbiorcy');
    expect(reqs.filter((r) => r.required).map((r) => r.category).sort()).toEqual(['CMR', 'INSURANCE', 'PERMIT_PL', 'PERMIT_SE']);
    const delivered = new Set(snap.loads.filter((l) => l.status === 'DELIVERED').map((l) => l.id));
    const cmrs = docs.filter((d) => d.category === 'CMR' && d.status === 'UPLOADED');
    expect(cmrs.length).toBeGreaterThan(0);
    expect(cmrs.every((d) => delivered.has(d.loadId))).toBe(true);
  });
  it('C-04, C-05: bez POD, rysunku i zdjęć mocowania; nazwy „SG-01_Zezwolenie_PL.pdf”, „SG-01_CMR_podpisany.pdf”', () => {
    expect(new Set(docs.map((d) => d.category))).toEqual(new Set(['PERMIT_PL', 'PERMIT_SE', 'CMR', 'INSURANCE']));
    const sg01 = snap.loads.find((l) => l.code === 'SG-01')!;
    expect(docs.filter((d) => d.loadId === sg01.id).map((d) => d.name)).toEqual(['SG-01_Zezwolenie_PL.pdf', 'SG-01_Zezwolenie_SE.pdf', 'SG-01_CMR_podpisany.pdf']);
  });
  it('C-06: polisy to pliki firmy; KSH widzi Polisę HHL, SCX swoją, HHL obie', () => {
    const pol = docs.filter((d) => d.category === 'INSURANCE');
    expect(pol.every((d) => !d.loadId)).toBe(true);
    const seen = (role: Document['visibleTo'][number]) => docsSeenOf(pol, role).map((d) => d.name).sort();
    expect(seen('HHL')).toEqual(['Polisa_HHL.pdf', 'Polisa_OCP_SCX.pdf']);
    expect(seen('KSH')).toEqual(['Polisa_HHL.pdf']);
    expect(seen('SCX')).toEqual(['Polisa_OCP_SCX.pdf']);
    /* polisa firmy podpina się sama — przy „Gotowy” nie brakuje polisy SCX */
    const prep = snap.loads.find((l) => l.status === 'PLANNED')!;
    expect(demoReadyGaps(prep, [], docs).some((g) => g.kind === 'POLICY_SCX')).toBe(false);
    expect(demoReadyGaps(prep, [], []).some((g) => g.kind === 'POLICY_SCX')).toBe(true);
  });
  it('C-07: „Polisa HHL” PZU 1106707356 jak polisa SCX; tekst braku bez „wgrywa HHL”', () => {
    expect(ft('pl', 'p5_doc_r_OCS')).toBe('Polisa HHL');
    expect(policiesOf()?.find((p) => p.org === 'HHL')).toMatchObject({ number: 'PZU 1106707356', approved: true });
    expect(ft('pl', 'p5_pd_policy_none_OCS')).not.toContain('wgrywa HHL');
  });
});

describe('C-08…C-11, C-16 — Faktury (E4, E40)', () => {
  it('C-08, C-09: VAT = round(netto × 0,23, 2), brutto = netto + VAT; demo bez „VAT 0,00”', () => {
    expect(vatGrossOf(21820.3)).toEqual({ vat: 5018.67, gross: 26838.97 });
    expect(vatGrossOf(0.05)).toEqual({ vat: 0.01, gross: 0.06 });
    for (const b of snap.bills) expect(b.vat).toBe(vatGrossOf(b.net).vat);
    expect(snap.bills.every((b) => b.vat > 0)).toBe(true);
  });
  it('C-11: faktura demo za tydzień rozładunku, wystawiona po niedzieli tego tygodnia', () => {
    for (const b of snap.bills) {
      expect(b.issueDate > addDaysIso(isoWeekMonday(b.weekKey), 6)).toBe(true);
      expect(b.payment).not.toBe('PO_TERMINIE');
    }
  });
  it('C-10: liczba w menu = kafel „Czeka na wystawienie” (te same transporty) + faktury do mojego działania', () => {
    const today = '2026-10-19';
    for (const role of ['HHL', 'SCX'] as const) {
      const dir = role === 'SCX' ? 'KOSZT' : 'PRZYCHOD';
      const kafel = pendingWeeks(snap.loads, snap.bills, dir, today).flatMap((w) => w.loads.map((l) => l.id));
      expect(invoiceReadyLoads(role, snap.loads, snap.bills, today).map((l) => l.id)).toEqual(kafel);
      const waiting = snap.bills.filter((b) => (b.recipient === role && b.verification === 'DO_WERYFIKACJI') || (b.issuer === role && b.verification === 'SPORNA')).length;
      expect(invoiceTodoCount(role, { loads: snap.loads, bills: snap.bills, today })).toBe(waiting + kafel.length);
    }
    /* „dziś” w danych demo (23.09): żaden tydzień rozładunku nie jest zamknięty — w menu tylko faktury do sprawdzenia */
    expect(invoiceReadyLoads('HHL', snap.loads, snap.bills, DEMO_TODAY_LOCAL)).toEqual([]);
  });
  it('C-16: tydzień w oknie faktury „t42 · 12.10.2026–18.10.2026”', () => {
    expect(weekOptionLabel('2026-W42')).toBe('t42 · 12.10.2026–18.10.2026');
    expect(weekOptionLabel('2026-W01')).toBe('t1 · 29.12.2025–04.01.2026');
  });
});

describe('C-12, C-13 — Finanse (E16, E3, E39)', () => {
  it('C-12: rodzaje po polsku z symbolu pliku KSH; nazwa spoza tabeli bez zmian', () => {
    expect(itemKindName('SG')).toBe('Słupy główne');
    expect(itemKindName('K')).toBe('Kratownice');
    expect(itemKindName('PL-B')).toBe('Płatwie dachowe i stężenia');
    expect(itemKindName('BS-A')).toBe('Belki suwnicowe');
    expect(itemKindName('Słupy')).toBe('Słupy');
    expect(snap.loads.every((l) => /^[A-Z]{1,3}$/.test(l.itemType))).toBe(true);
  });
  it('C-13: ten sam tydzień = ten sam mnożnik i średnie w Opcjach i w Finansach', () => {
    const today = DEMO_TODAY_LOCAL;
    const opt = demoFuelScreen(today);
    const row = fuelWeeksOf(snap.loads, 'both', today).find((r) => r.week?.from === opt.current.from)!;
    expect(row).toBeDefined();
    expect(row.applied).toBe(opt.current.applied);
    expect(row.okq8).toMatchObject({ avg: opt.current.okq8.avg, mult: opt.current.okq8.mult });
    expect(row.orlen).toMatchObject({ avg: opt.current.orlen.avg, mult: opt.current.orlen.mult });
    /* panel „Ceny”: mnożnik transportu z załadunkiem w tym tygodniu */
    const load = snap.loads.find((l) => l.pricing.money && l.plannedLoadDate >= opt.current.from && l.plannedLoadDate <= opt.current.to);
    if (load) expect(load.pricing.money!.cost.fuel.applied).toBe(opt.current.applied);
  });
});
