/** PLAN §1.5 (28.09) — eksport XLSX harmonogramu: kolumny i wartości zależne od roli (brak kolumny = brak struktury). */
import { describe, expect, it } from 'vitest';
import { exportColumnsFor, exportRows } from '../src/lib/xlsxExport';
import { buildSeedLoads } from '../src/data/seed';

const hdr = (r: 'HHL' | 'KSH' | 'SCX') => exportColumnsFor(r).map((c) => c.header);

describe('eksport XLSX per rola', () => {
  it('HHL: koszt, przychód, marża, kierowca, telefon', () => {
    expect(hdr('HHL')).toEqual(expect.arrayContaining(['Koszt_EUR', 'Przychód_EUR', 'Marża_EUR', 'Kierowca', 'Telefon']));
  });
  it('KSH: cena + kierowca + telefon; bez kosztu i marży (I-7a)', () => {
    const h = hdr('KSH');
    expect(h).toEqual(expect.arrayContaining(['Cena_EUR', 'Kierowca', 'Telefon', 'Ciągnik', 'Naczepa']));
    for (const x of ['Koszt_EUR', 'Marża_EUR', 'Przychód_EUR']) expect(h).not.toContain(x);
  });
  it('SCX: koszt i kierowca; bez przychodu, ceny klienta i marży', () => {
    const h = hdr('SCX');
    expect(h).toEqual(expect.arrayContaining(['Koszt_EUR', 'Kierowca', 'Telefon']));
    for (const x of ['Przychód_EUR', 'Cena_EUR', 'Marża_EUR']) expect(h).not.toContain(x);
  });
  it('ETA przed załadunkiem to sama kreska', () => {
    const l = { ...buildSeedLoads()[0], etaBoden: null, etaPreLoad: true } as never;
    const rows = exportRows([l], 'HHL');
    expect(rows[1][rows[0].indexOf('ETA_Boden')]).toBe('–');
  });
  it('KSH: telefon i imię kierowcy zawsze (I-7a), także poza ±24 h', () => {
    const l = { ...buildSeedLoads()[0], plannedDeliverDate: '2026-10-10', etaBoden: '2026-10-10T10:00:00+02:00', awizacja: undefined } as never;
    const withPhone = { ...(l as object), resources: { ...(l as { resources: object }).resources, driverPhone: '600123456', driverName: 'Jan Próbny', driverPhoneCountry: 'PL' } } as never;
    const far = exportRows([withPhone], 'KSH', Date.parse('2026-10-01T10:00:00Z'));
    const iTel = far[0].indexOf('Telefon');
    const iName = far[0].indexOf('Kierowca');
    expect(far[1][iTel]).toBe('600123456');
    expect(far[1][iName]).toBe('Jan Próbny');
  });
});
