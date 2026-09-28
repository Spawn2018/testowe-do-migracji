/** PLAN §1.5 (28.09) — eksport XLSX harmonogramu: kolumny i wartości zależne od roli (brak kolumny = brak struktury). */
import { describe, expect, it } from 'vitest';
import { exportColumnsFor, exportRows } from '../src/lib/xlsxExport';
import { buildSeedLoads } from '../src/data/seed';

const hdr = (r: 'HHL' | 'KSH' | 'SCX') => exportColumnsFor(r).map((c) => c.header);

describe('eksport XLSX per rola', () => {
  it('HHL: koszt, przychód, marża, kierowca, telefon', () => {
    expect(hdr('HHL')).toEqual(expect.arrayContaining(['Koszt_EUR', 'Przychód_EUR', 'Marża_EUR', 'Kierowca', 'Telefon']));
  });
  it('KSH: cena; bez kosztu, marży, przychodu HHL i imienia kierowcy', () => {
    const h = hdr('KSH');
    expect(h).toContain('Cena_EUR');
    for (const x of ['Koszt_EUR', 'Marża_EUR', 'Przychód_EUR', 'Kierowca']) expect(h).not.toContain(x);
  });
  it('SCX: koszt i kierowca; bez przychodu, ceny klienta i marży', () => {
    const h = hdr('SCX');
    expect(h).toEqual(expect.arrayContaining(['Koszt_EUR', 'Kierowca', 'Telefon']));
    for (const x of ['Przychód_EUR', 'Cena_EUR', 'Marża_EUR']) expect(h).not.toContain(x);
  });
  it('KSH: telefon kierowcy tylko w oknie ±24 h od dostawy (D6)', () => {
    const l = { ...buildSeedLoads()[0], plannedDeliverDate: '2026-10-10', etaBoden: '2026-10-10T10:00:00+02:00', awizacja: undefined } as never;
    const withPhone = { ...(l as object), resources: { ...(l as { resources: object }).resources, driverPhone: '+48600123456', driverName: 'Jan Próbny' } } as never;
    const far = exportRows([withPhone], 'KSH', Date.parse('2026-10-01T10:00:00Z'));
    const near = exportRows([withPhone], 'KSH', Date.parse('2026-10-10T06:00:00Z'));
    const i = far[0].indexOf('Telefon');
    expect(far[1][i]).toBe('');
    expect(near[1][i]).toBe('+48600123456');
    expect(JSON.stringify(near)).not.toContain('Jan Próbny');
  });
});
