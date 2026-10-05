/**
 * TOWER — testy mechanizmu pieniędzy.
 *
 * Dane kursowe: prawdziwe tabele A NBP dla EUR, 15.12.2025–09.01.2026,
 * utrwalone w tests/fixtures/nbp-eur-2025-12.json. Okres wybrany celowo:
 * NBP nie publikował tabel 24–28.12.2025 (Wigilia wolna od 2025 r.)
 * ani 01.01.2026 — najtrudniejszy przypadek „dnia roboczego poprzedzającego".
 *
 * Test na żywym API uruchamia się wyłącznie przy NBP_LIVE=1,
 * żeby CI nie zależało od dostępności serwera NBP.
 */
import { describe, it, expect } from 'vitest';
import fixture from './fixtures/nbp-eur-2025-12.json';
import {
  nbpRateBefore, fetchNbpRateForUnload, localDateOf, isoWeekKeyLocal,
  buildPriceSide, assertSameMechanism, marginForLoad, marginIn, totalsByTier,
  matchInvoice, invoiceLineToEur, validateInvoiceLines, dueDate, paymentState,
  remindersDueToday, invoiceParties, formatMoney, formatForUser,
  hybridMin, resolveTier, referenceUtc, fuelLocalDate, fxReferenceUtc, type NbpRate, type FuelSnapshot,
} from '../src/lib/money/engine';
import { sefsForLoadDate, sefsWeekContaining, type SefsWeekSnapshot } from '../src/lib/sefs';
import { buildLoadMoney } from '../src/lib/money/loadMoney';
import { buildDemoSnapshot } from '../src/data/demoProvider';

const RATES: NbpRate[] = fixture.rates.map((r) => ({ table: 'A', no: r.no, effectiveDate: r.effectiveDate, mid: r.mid }));

const fuel = (referenceDate: string, multSek = 1.031, multPln = 1.024): FuelSnapshot => ({
  mechanism: 'SEFS_HYBRID_MIN', referenceDate, multSek, multPln,
  appliedMultiplier: hybridMin(multSek, multPln), documentRef: 'dokumentacja mechanizmu SEFS',
});

describe('Kurs NBP — tabela A z dnia roboczego poprzedzającego rozładunek', () => {
  it.each([
    ['2025-12-22', '2025-12-19', 'poniedziałek → piątek'],
    ['2025-12-24', '2025-12-23', 'Wigilia → wtorek'],
    ['2025-12-29', '2025-12-23', 'po przerwie świątecznej: 5 dni bez tabeli'],
    ['2025-12-31', '2025-12-30', 'zwykły dzień'],
    ['2026-01-02', '2025-12-31', 'po Nowym Roku'],
    ['2026-01-05', '2026-01-02', 'poniedziałek po święcie'],
  ])('rozładunek %s → tabela z %s (%s)', (unload, expected) => {
    expect(nbpRateBefore(RATES, unload).effectiveDate).toBe(expected);
  });

  it('nie bierze tabeli z samego dnia rozładunku', () => {
    expect(nbpRateBefore(RATES, '2025-12-30').effectiveDate).not.toBe('2025-12-30');
  });

  it('brak tabel → wyjątek, nigdy zgadywanie', () => {
    expect(() => nbpRateBefore([], '2026-01-05')).toThrow();
  });

  it.runIf(process.env.NBP_LIVE === '1')('żywe API zgadza się z utrwalonymi danymi', async () => {
    const live = await fetchNbpRateForUnload('2025-12-29');
    expect(live.no).toBe('248/A/NBP/2025');
  });
});

describe('Czas lokalny — dzień i tydzień nigdy w UTC', () => {
  it('rozładunek wt 00:30 czasu polskiego latem = pn 22:30 UTC → data lokalna wtorek', () => {
    expect(localDateOf('2026-10-05T22:30:00Z')).toBe('2026-10-06');
  });

  it('rozładunek 29.12.2025 23:30 UTC = wt 30.12 00:30 lokalnie → tabela z 29.12, NIE z 23.12', () => {
    const unload = '2025-12-29T23:30:00Z';
    expect(localDateOf(unload)).toBe('2025-12-30');
    expect(nbpRateBefore(RATES, localDateOf(unload)).no).toBe('249/A/NBP/2025');
    // Gdyby liczyć dzień w UTC, wypadłby poniedziałek i tabela sprzed świąt —
    // sześć dni wcześniej, inny numer tabeli, faktura oflagowana jako błędna.
    // (Kurs średni obu tabel akurat się pokrywa: 4,2274 — liczy się numer tabeli.)
    expect(nbpRateBefore(RATES, unload.slice(0, 10)).no).toBe('248/A/NBP/2025');
  });

  it.each([
    ['2026-09-27T22:30:00Z', '2026-W40', 'pn 00:30 lokalnie latem'],
    ['2026-11-29T23:30:00Z', '2026-W49', 'pn 00:30 lokalnie zimą'],
    ['2026-09-27T21:00:00Z', '2026-W39', 'nd 23:00 lokalnie latem'],
  ])('%s → %s (%s)', (utc, week) => {
    expect(isoWeekKeyLocal(utc)).toBe(week);
  });
});

describe('Poziomy wyceny', () => {
  const planned = '2026-10-10T08:00:00Z';
  it('niedostarczony → PROGNOZA; kurs z planu dostawy, paliwo czeka na datę załadunku', () => {
    const t = { plannedDeliveryUtc: planned };
    expect(resolveTier(t)).toBe('PROGNOZA');
    expect(fxReferenceUtc(t)).toBe(planned);
    expect(fuelLocalDate(t)).toBeNull();
    expect(referenceUtc(t)).toBeNull();
  });
  it('rozładowany → REALIZACJA; kurs z rozładunku, paliwo z załadunku', () => {
    const t = {
      plannedDeliveryUtc: planned,
      unloadedAtUtc: '2026-10-12T11:00:00Z',
      plannedLoadDate: '2026-10-05',
    };
    expect(resolveTier(t)).toBe('REALIZACJA');
    expect(fxReferenceUtc(t)).toBe('2026-10-12T11:00:00Z');
    expect(fuelLocalDate(t)).toBe('2026-10-05');
    expect(referenceUtc(t)).toBe('2026-10-05T12:00:00+02:00');
  });
  it('zafakturowany → FAKTURA', () => {
    expect(resolveTier({ plannedDeliveryUtc: planned, unloadedAtUtc: planned, invoiced: true })).toBe('FAKTURA');
  });
});

describe('U-3-PALIWO — tydzień od daty załadunku (D-34)', () => {
  it('załadunek w tygodniu N, rozładunek w N+1 → stawka tygodnia N', () => {
    // Mnożniki tylko w tym teście wyboru tygodnia. Nie są stawką cennika.
    const weeks: SefsWeekSnapshot[] = [
      { weekLabel: 'N', weekStart: '2026-10-05', weekEnd: '2026-10-11', priceSek: 0, pricePln: 0, multSek: 1.2, multPln: 1.2, appliedMult: 1.2, sourceNote: 'test N' },
      { weekLabel: 'N+1', weekStart: '2026-10-12', weekEnd: '2026-10-18', priceSek: 0, pricePln: 0, multSek: 1.5, multPln: 1.5, appliedMult: 1.5, sourceNote: 'test N+1' },
    ];
    const loadDate = fuelLocalDate({ loadedAtUtc: '2026-10-04T22:30:00Z' });
    const unloadDate = localDateOf('2026-10-13T08:00:00Z');
    expect(loadDate).toBe('2026-10-05');
    expect(unloadDate).toBe('2026-10-13');
    expect(isoWeekKeyLocal('2026-10-04T22:30:00Z')).toBe('2026-W41');
    expect(isoWeekKeyLocal('2026-10-13T08:00:00Z')).toBe('2026-W42');
    const rateN = sefsWeekContaining(loadDate!, weeks);
    const rateNext = sefsWeekContaining(unloadDate, weeks);
    expect(rateN?.weekLabel).toBe('N');
    expect(rateNext?.weekLabel).toBe('N+1');
    expect(rateN?.appliedMult).not.toBe(rateNext?.appliedMult);
    expect(rateN?.appliedMult).toBe(1.2);
  });

  it('granica tygodnia lato i zima: dzień lokalny, nie UTC', () => {
    expect(fuelLocalDate({ loadedAtUtc: '2026-10-04T22:30:00Z' })).toBe('2026-10-05');
    expect(isoWeekKeyLocal('2026-10-04T22:30:00Z')).not.toBe(isoWeekKeyLocal('2026-10-04T12:00:00Z'));
    expect(fuelLocalDate({ loadedAtUtc: '2026-11-29T23:30:00Z' })).toBe('2026-11-30');
    expect(isoWeekKeyLocal('2026-11-29T23:30:00Z')).toBe('2026-W49');
    expect(isoWeekKeyLocal('2026-11-29T12:00:00Z')).not.toBe('2026-W49');
  });

  it('zmiana czasu 25.10.2026: niedziela przed 03:00, druga 02:xx i poniedziałek', () => {
    // PALIWO-33.3. Granica lato/zima z 04.10 i 29.11 tego nie pokrywa.
    // Chwile są w UTC, bo tak leży actual_load_at. Dzień bierze localDateOf
    // (Europe/Warsaw), tydzień bierze isoWeekKeyLocal z tej daty cywilnej:
    // dzień tygodnia tej daty, czwartek ISO, ceil((dzień roku czwartku)/7).
    // 25.10.2026 to niedziela → czwartek 22.10 → 2026-W43 (pon 19.10–niedz 25.10).
    // 26.10.2026 to poniedziałek → czwartek 29.10 → 2026-W44 (pon 26.10–niedz 01.11).
    // Stawki nie ustalamy: oba załadunki z niedzieli mają ten sam tydzień,
    // poniedziałek następny. Cofnięcie zegara 03:00→02:00 zostawia niedzielę.
    const przed = '2026-10-25T00:30:00Z'; // 25.10 02:30 CEST, UTC+2, przed 03:00
    const druga = '2026-10-25T01:30:00Z'; // 25.10 02:30 CET, UTC+1, druga 02:xx
    const pon = '2026-10-25T23:30:00Z';   // 26.10 00:30 CET, w UTC nadal niedziela

    expect(fuelLocalDate({ loadedAtUtc: przed })).toBe('2026-10-25');
    expect(fuelLocalDate({ loadedAtUtc: druga })).toBe('2026-10-25');
    expect(fuelLocalDate({ loadedAtUtc: pon })).toBe('2026-10-26');

    expect(isoWeekKeyLocal(przed)).toBe('2026-W43');
    expect(isoWeekKeyLocal(druga)).toBe('2026-W43');
    expect(isoWeekKeyLocal(pon)).toBe('2026-W44');
    expect(isoWeekKeyLocal(przed)).toBe(isoWeekKeyLocal(druga));
    expect(isoWeekKeyLocal(pon)).not.toBe(isoWeekKeyLocal(przed));
  });

  it('wyliczenie transportu: data paliwa z załadunku, kurs z rozładunku, ten sam mnożnik po obu stronach', () => {
    const delivered = buildDemoSnapshot().loads.find((l) => l.status === 'DELIVERED')!;
    const load = {
      ...delivered,
      plannedLoadDate: '2026-10-05',
      plannedDeliverDate: '2026-10-13',
      unloadedAt: '2026-10-13T08:00:00Z',
    };
    const m = buildLoadMoney(load, { todayLocal: '2026-10-14' });
    expect(m.cost.fuel.refDate).toBe('2026-10-05');
    expect(m.rev.fuel.refDate).toBe('2026-10-05');
    expect(m.cost.fuel.applied).toBe(m.rev.fuel.applied);
    expect(m.cost.fuel.applied).toBe(sefsForLoadDate('2026-10-05').appliedMult);
    expect(m.cost.fx.date < '2026-10-13').toBe(true);
    expect(isoWeekKeyLocal('2026-10-05T12:00:00+02:00')).not.toBe(isoWeekKeyLocal(load.unloadedAt));
  });
});

describe('Ten sam mechanizm paliwowy po obu stronach', () => {
  const fx = nbpRateBefore(RATES, '2025-12-29');
  const cost = buildPriceSide({ tier: 'REALIZACJA', roadRateEur: 2000, roadRateAfterFuelEur: 2048,
    extras: [{ code: 'ESC', label: 'Pilotaż', amountEur: 340 }], fuel: fuel('2025-12-29'), fx });
  const rev = buildPriceSide({ tier: 'REALIZACJA', roadRateEur: 2500, roadRateAfterFuelEur: 2560,
    extras: [{ code: 'ESC', label: 'Pilotaż', amountEur: 440 }], fuel: fuel('2025-12-29'), fx });

  it('hybrid_min wybiera niższy mnożnik', () => {
    expect(hybridMin(1.031, 1.024)).toBe(1.024);
  });
  it('równe mnożniki i daty → niezmiennik spełniony', () => {
    expect(() => assertSameMechanism(cost, rev)).not.toThrow();
  });
  it('inna data paliwa po stronie przychodu → niezmiennik pęka', () => {
    const bad = { ...rev, fuel: fuel('2025-12-30') };
    expect(() => assertSameMechanism(cost, bad)).toThrow(/daty/);
  });
  it('inny mnożnik po stronie przychodu → niezmiennik pęka', () => {
    const bad = { ...rev, fuel: { ...rev.fuel, appliedMultiplier: 1.031 } };
    expect(() => assertSameMechanism(cost, bad)).toThrow(/mnożniki/);
  });
  it('opłata paliwowa tylko od stawki drogowej, pilotaż bez niej', () => {
    expect(cost.fuelAmountEur).toBe(48);
    expect(cost.computedTotalEur).toBe(2388);
  });
  it('marża procentowa NIE jest niezmiennikiem — i dobrze', () => {
    const fx2 = nbpRateBefore(RATES, '2025-12-29');
    const c2 = buildPriceSide({ tier: 'REALIZACJA', roadRateEur: 2000, roadRateAfterFuelEur: 2100,
      extras: [{ code: 'ESC', label: 'Pilotaż', amountEur: 340 }], fuel: fuel('2025-12-29', 1.05, 1.05), fx: fx2 });
    const r2 = buildPriceSide({ tier: 'REALIZACJA', roadRateEur: 2500, roadRateAfterFuelEur: 2625,
      extras: [{ code: 'ESC', label: 'Pilotaż', amountEur: 440 }], fuel: fuel('2025-12-29', 1.05, 1.05), fx: fx2 });
    expect(marginForLoad(c2, r2).marginPct).not.toBe(marginForLoad(cost, rev).marginPct);
  });
});

describe('Faktura nadrzędna — ale wyliczenie zostaje', () => {
  const fx = nbpRateBefore(RATES, '2025-12-29');
  const inv = buildPriceSide({ tier: 'FAKTURA', roadRateEur: 2000, roadRateAfterFuelEur: 2048,
    extras: [{ code: 'ESC', label: 'Pilotaż', amountEur: 340 }], fuel: fuel('2025-12-29'), fx, invoicedTotalEur: 2410 });
  it('marża liczy się z kwoty fakturowanej', () => {
    expect(inv.effectiveTotalEur).toBe(2410);
  });
  it('wartość wyliczona NIE jest nadpisana', () => {
    expect(inv.computedTotalEur).toBe(2388);
  });
  it('poziom FAKTURA bez kwoty z faktury → wyjątek', () => {
    expect(() => buildPriceSide({ tier: 'FAKTURA', roadRateEur: 1, roadRateAfterFuelEur: 1,
      fuel: fuel('2025-12-29'), fx })).toThrow();
  });
});

describe('Waluta wyświetlania — EUR domyślnie, PLN z ustawień użytkownika', () => {
  const fxA = nbpRateBefore(RATES, '2025-12-29');   // 4.2274
  const fxB = nbpRateBefore(RATES, '2026-01-05');   // 4.2156
  const mk = (tier: 'PROGNOZA' | 'REALIZACJA', fx: NbpRate) => {
    const c = buildPriceSide({ tier, roadRateEur: 1000, roadRateAfterFuelEur: 1000, fuel: fuel('x'), fx });
    const r = buildPriceSide({ tier, roadRateEur: 1200, roadRateAfterFuelEur: 1200, fuel: fuel('x'), fx });
    return marginForLoad(c, r);
  };
  it('EUR: wartości źródłowe bez przeliczenia', () => {
    expect(marginIn(mk('REALIZACJA', fxA), 'EUR').margin).toBe(200);
  });
  it('PLN: kwota × kurs danego transportu, zaokrąglenie per transport', () => {
    expect(marginIn(mk('REALIZACJA', fxA), 'PLN').margin).toBe(845.48);
    expect(marginIn(mk('REALIZACJA', fxB), 'PLN').margin).toBe(843.12);
  });
  it('sumy w obu walutach, rozbite na trzy poziomy pewności', () => {
    const t = totalsByTier([mk('REALIZACJA', fxA), mk('REALIZACJA', fxB), mk('PROGNOZA', fxB)]);
    expect(t.REALIZACJA.count).toBe(2);
    expect(t.REALIZACJA.marginEur).toBe(400);
    expect(t.REALIZACJA.marginPln).toBe(1688.6);
    expect(t.PROGNOZA.count).toBe(1);
    expect(t.FAKTURA.count).toBe(0);
  });
  it('format: kod waluty, liczba według języka interfejsu', () => {
    expect(formatMoney(12345.6, 'pl', 'EUR')).toMatch(/^12\s345,60\sEUR$/);
    expect(formatMoney(12345.6, 'en', 'EUR')).toMatch(/^EUR\s12,345\.60$/);
    expect(formatMoney(12345.6, 'sv', 'EUR')).toMatch(/^12\s345,60\sEUR$/);
    expect(formatForUser(100, fxA, 'pl', 'PLN')).toMatch(/^422,74\sPLN$/);
  });
});

describe('Dopasowanie faktury — EUR i PLN, kurs per pozycja', () => {
  const fx29 = nbpRateBefore(RATES, '2025-12-29');   // 248/A z 23.12
  const fx05 = nbpRateBefore(RATES, '2026-01-05');   // 001/A z 02.01 (pierwsza tabela roku)
  const side = (fx: NbpRate) => buildPriceSide({ tier: 'REALIZACJA', roadRateEur: 2000, roadRateAfterFuelEur: 2048,
    extras: [{ code: 'ESC', label: 'Pilotaż', amountEur: 340 }], fuel: fuel(fx.effectiveDate), fx });
  const e29 = side(fx29), e05 = side(fx05);

  it('faktura EUR zgodna', () => {
    const r = matchInvoice({ currency: 'EUR', lines: [{ loadId: 'SG-01', expected: e29, invoicedNet: 2388 }] });
    expect(r.status).toBe('ZGODNA');
  });

  it('faktura EUR: kwota poza tolerancją → KWOTA, oczekiwana nienadpisana', () => {
    const r = matchInvoice({ currency: 'EUR', lines: [{ loadId: 'SG-03', expected: e29, invoicedNet: 2450 }] });
    expect(r.rows[0].flags).toContain('KWOTA');
    expect(r.rows[0].expectedNet).toBe(2388);
  });

  it('faktura PLN tygodniowa: dwa transporty, dwa dni rozładunku, DWA kursy', () => {
    const r = matchInvoice({ currency: 'PLN', lines: [
      { loadId: 'SG-01', expected: e29, invoicedNet: 10095.03,
        fx: { tableNo: '248/A/NBP/2025', mid: 4.2274, effectiveDate: '2025-12-23' } },
      { loadId: 'SG-02', expected: e05, invoicedNet: 10066.85,
        fx: { tableNo: '001/A/NBP/2026', mid: 4.2156, effectiveDate: '2026-01-02' } },
    ]});
    expect(r.rows[0].expectedNet).toBe(10095.03);   // 2388 × 4.2274
    expect(r.rows[1].expectedNet).toBe(10066.85);   // 2388 × 4.2156
    expect(r.status).toBe('ZGODNA');
  });

  it('faktura PLN z jednym kursem dla całej faktury → pozycje z innym dniem rozładunku oflagowane', () => {
    const jeden = { tableNo: '001/A/NBP/2026', mid: 4.2156, effectiveDate: '2026-01-02' };
    const r = matchInvoice({ currency: 'PLN', lines: [
      { loadId: 'SG-01', expected: e29, invoicedNet: 10066.85, fx: jeden },
      { loadId: 'SG-02', expected: e05, invoicedNet: 10066.85, fx: jeden },
    ]});
    expect(r.rows[0].flags).toEqual(expect.arrayContaining(['TABELA_NBP', 'KURS_NBP', 'DATA_KURSU']));
    expect(r.rows[1].flags).toEqual([]);
  });

  it('faktura PLN bez kursu na pozycji → BRAK_KURSU', () => {
    const r = matchInvoice({ currency: 'PLN', lines: [{ loadId: 'SG-01', expected: e29, invoicedNet: 10095.03 }] });
    expect(r.rows[0].flags).toContain('BRAK_KURSU');
  });

  it('kurs z dnia rozładunku zamiast poprzedzającego → TABELA_NBP i DATA_KURSU', () => {
    const r = matchInvoice({ currency: 'PLN', lines: [{ loadId: 'SG-01', expected: e29, invoicedNet: 10095.03,
      fx: { tableNo: '249/A/NBP/2025', mid: 4.2274, effectiveDate: '2025-12-29' } }] });
    expect(r.rows[0].flags).toEqual(expect.arrayContaining(['TABELA_NBP', 'DATA_KURSU']));
    expect(r.rows[0].flags).not.toContain('KURS_NBP');   // kurs średni akurat ten sam
  });

  it('opłata paliwowa policzona innym mnożnikiem → OPLATA_PALIWOWA', () => {
    const r = matchInvoice({ currency: 'EUR', lines: [{ loadId: 'SG-04', expected: e29, invoicedNet: 2388, invoicedFuel: 61.44 }] });
    expect(r.rows[0].flags).toContain('OPLATA_PALIWOWA');
  });

  it('pozycja PLN sprowadzona do EUR kursem z faktury — do marży', () => {
    expect(invoiceLineToEur(10095.03, 'PLN', { tableNo: '248/A/NBP/2025', mid: 4.2274, effectiveDate: '2025-12-23' })).toBe(2388);
    expect(() => invoiceLineToEur(100, 'PLN')).toThrow();
  });
});

describe('Pozycje faktury wobec tygodnia realizacji', () => {
  const loads = [
    { id: 'A', unloadedAtUtc: '2026-09-22T10:00:00Z' },   // W39
    { id: 'B', unloadedAtUtc: '2026-09-24T10:00:00Z' },   // W39
    { id: 'C', unloadedAtUtc: '2026-09-29T10:00:00Z' },   // W40
    { id: 'D', unloadedAtUtc: null },
    { id: 'E', unloadedAtUtc: '2026-09-23T10:00:00Z' },   // W39, już na innej fakturze
  ];
  const issues = validateInvoiceLines({
    invoiceWeekKey: '2026-W39', lineLoadIds: ['A', 'C', 'D', 'E'], loads,
    alreadyInvoicedLoadIds: new Set(['E']),
  });
  const has = (id: string, issue: string) => issues.some((i) => i.loadId === id && i.issue === issue);
  it('transport z innego tygodnia → ZLY_TYDZIEN', () => expect(has('C', 'ZLY_TYDZIEN')).toBe(true));
  it('transport nierozładowany → NIEZREALIZOWANY', () => expect(has('D', 'NIEZREALIZOWANY')).toBe(true));
  it('transport już zafakturowany → PODWOJNIE_FAKTUROWANY', () => expect(has('E', 'PODWOJNIE_FAKTUROWANY')).toBe(true));
  it('transport z tego tygodnia pominięty → BRAK_NA_FAKTURZE', () => expect(has('B', 'BRAK_NA_FAKTURZE')).toBe(true));
  it('poprawny transport bez uwag', () => expect(issues.some((i) => i.loadId === 'A')).toBe(false));
});

describe('Termin i stan płatności', () => {
  it('termin od daty wystawienia', () => {
    expect(dueDate({ issueDate: '2026-09-28', termDays: 30, basis: 'WYSTAWIENIE' })).toBe('2026-10-28');
  });
  it('termin od doręczenia wymaga daty doręczenia', () => {
    expect(dueDate({ issueDate: '2026-09-28', receiptDate: '2026-10-02', termDays: 30, basis: 'DORECZENIE' })).toBe('2026-11-01');
    expect(() => dueDate({ issueDate: '2026-09-28', termDays: 30, basis: 'DORECZENIE' })).toThrow();
  });
  it('termin z dokumentu faktury ma pierwszeństwo', () => {
    expect(dueDate({ issueDate: '2026-09-28', termDays: 30, basis: 'WYSTAWIENIE', overrideFromDocument: '2026-10-15' })).toBe('2026-10-15');
  });
  it('stany: nieopłacona, po terminie, opłacona', () => {
    expect(paymentState('2026-10-28', '2026-10-28')).toBe('NIEOPLACONA');
    expect(paymentState('2026-10-28', '2026-10-29')).toBe('PO_TERMINIE');
    expect(paymentState('2026-10-28', '2026-11-30', '2026-11-02')).toBe('OPLACONA');
  });
  it('przypomnienia według kadencji; opłacona → cisza', () => {
    expect(remindersDueToday('2026-10-28', '2026-10-25')).toEqual([-3]);
    expect(remindersDueToday('2026-10-28', '2026-10-28')).toEqual([0]);
    expect(remindersDueToday('2026-10-28', '2026-11-04')).toEqual([7]);
    expect(remindersDueToday('2026-10-28', '2026-10-30')).toEqual([]);
    expect(remindersDueToday('2026-10-28', '2026-11-04', '2026-11-01')).toEqual([]);
  });
});

describe('Widoczność faktur — kto jest stroną', () => {
  it('faktura kosztowa: SCX → HHL, KSH jej nie widzi', () => {
    const p = invoiceParties('KOSZT');
    expect(p.payer).toBe('HHL'); expect(p.payee).toBe('SCX');
    expect(p.visibleTo).not.toContain('KSH' as never);
  });
  it('faktura przychodowa: HHL → KSH, SCX jej nie widzi', () => {
    const p = invoiceParties('PRZYCHOD');
    expect(p.payer).toBe('KSH'); expect(p.payee).toBe('HHL');
    expect(p.visibleTo).not.toContain('SCX' as never);
  });
});
