/** I-22 — kreator mapowania: podpis układu, propozycja z szablonu i z nazw, braki pól wymaganych. */
import { describe, expect, it } from 'vitest';
import { defaultLayoutFits, headerSignature, missingRequired, suggestMap, toFullMap } from '../src/lib/importMapping';
import { COLUMN_MAP_DEFAULT } from '../src/lib/importColumnMap';
import { parseSchedule } from '../src/lib/scheduleParse';

const B = ['Shipment ID', 'Typ', 'Qty', 'Size LxWxH', 'Loading date', 'Delivery date'];

describe('I-22 mapowanie kolumn', () => {
  it('układ domyślny KSH nie wymaga kreatora; inny układ tak', () => {
    expect(defaultLayoutFits(Object.values(COLUMN_MAP_DEFAULT))).toBe(true);
    expect(defaultLayoutFits(B)).toBe(false);
  });
  it('podpis niezależny od kolejności, wielkości liter i polskich znaków', () => {
    expect(headerSignature(['Wysyłka', 'Ilość'])).toBe(headerSignature(['ilosc', 'WYSYLKA']));
  });
  it('bez szablonu: dopasowane kolumny o nazwach domyślnych, brak wymaganych wykazany', () => {
    const s = suggestMap(B);
    expect(s.template).toBeNull();
    expect(s.map.itemType).toBe('Typ');
    expect(missingRequired(s.map)).toEqual(['shipmentCode', 'qty']);
  });
  it('szablon o tym samym podpisie: pełne mapowanie, parse z mapą daje wiersz', () => {
    const tpl = { name: 'B', header_signature: headerSignature(B), column_map: { shipmentCode: 'Shipment ID', qty: 'Qty', itemType: 'Typ', dimensions: 'Size LxWxH', loadDate: 'Loading date', deliveryDate: 'Delivery date' } };
    const s = suggestMap([...B].reverse(), [tpl]);
    expect(s.template?.name).toBe('B');
    expect(missingRequired(s.map)).toEqual([]);
    const r = parseSchedule([{ 'Shipment ID': 'SG-01-001', Typ: 'SG', Qty: 1, 'Size LxWxH': '10 x 3 x 3', 'Loading date': '2026-10-01', 'Delivery date': '2026-10-06' }], toFullMap(s.map));
    expect(r.stats.accepted).toBe(1);
    expect(r.rows[0].shipmentCode).toBe('SG-01-001');
  });
});
