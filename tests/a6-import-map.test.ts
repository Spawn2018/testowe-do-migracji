/**
 * A6 · mapowanie 21 kolumn + reguły parsera (E38 / D-20261019-1420-01).
 * Etap A6, paczka po B9 — bez SharePoint (to osobny krok). F7 #555.
 */
import { describe, expect, it } from 'vitest';
import { COLUMN_MAP_DEFAULT } from '../src/lib/importColumnMap';
import { MAP_FIELDS_CREATOR } from '../src/lib/importMapping';
import {
  cellText,
  emptyCell,
  isHhCarrier,
  normalizePhone,
  parseSchedule,
  splitAb,
} from '../src/lib/scheduleParse';
import { toRpcRows } from '../src/lib/scheduleImportRpc';

const base = {
  Wysyłka: 'KR-03',
  Typ: 'KR',
  'Rozmiar L x W x H': '18,21 x 2,45 x 2,45',
  'Waga elementu': 2.5,
  'Ilość elementów': 1,
  'Waga transport [t]': 2.5,
  'Data załadunku': '04.12.2026',
  'Dzień (załadunek)': 'Friday',
  Przewoźnik: 'HH',
  'Godzina (załadunek)': '08:00',
  'Imię i nazwisko kierowcy': 'Jan Kowalski / Erik Svensson',
  'Nr tel. kierowcy': '501234567 / +46701234567',
  'Nr rej. ciągnika': 'WGM12345 / ABC123',
  'Nr rej. naczepy': 'WWW99999',
  'Nr zlecenia HHL-Scan': '15099/2026/OSL/GDA/P',
  'Data dostawy na budowę': '04.11.2026',
  'Dzień (rozładunek)': 'Wednesday',
  'Godzina (rozładunek)': '14:00',
  'Nr zlecenia HHL-KSH': '0009/11/S/2026',
  Komentarz: 'Wcześniej to był SG-99',
};

describe('A6 importColumnMap + parseSchedule', () => {
  it('mapowanie ma kolumny E38 (bez orderNo / Lp.)', () => {
    expect(COLUMN_MAP_DEFAULT).not.toHaveProperty('orderNo');
    expect(COLUMN_MAP_DEFAULT.scxOrderNo).toBe('Nr zlecenia HHL-Scan');
    expect(COLUMN_MAP_DEFAULT.hhlOrderNo).toBe('Nr zlecenia HHL-KSH');
    expect(COLUMN_MAP_DEFAULT.carrier).toBe('Przewoźnik');
    expect(COLUMN_MAP_DEFAULT.tractorPlate).toBe('Nr rej. ciągnika');
    expect(COLUMN_MAP_DEFAULT.trailerPlate).toBe('Nr rej. naczepy');
  });

  it('puste / „...” / „-” i filtr HH; A/B → PL/SE', () => {
    expect(emptyCell('...')).toBe(true);
    expect(emptyCell('-')).toBe(true);
    expect(cellText('  X  ')).toBe('X');
    expect(isHhCarrier('HH')).toBe(true);
    expect(isHhCarrier('NTG')).toBe(false);
    expect(splitAb('A / B')).toEqual({ pl: 'A', se: 'B' });
    expect(splitAb('Tylko PL')).toEqual({ pl: 'Tylko PL', se: null });
  });

  it('kreator bez loadDay/delivDay (F7)', () => {
    expect(MAP_FIELDS_CREATOR).not.toContain('loadDay');
    expect(MAP_FIELDS_CREATOR).not.toContain('delivDay');
    expect(MAP_FIELDS_CREATOR).toContain('carrier');
    expect(MAP_FIELDS_CREATOR).toContain('hhlOrderNo');
  });

  it('KR-03: dostawa przed załadunkiem wchodzi (datesToCheck), nie ERROR DATE_ORDER', () => {
    const r = parseSchedule([base]);
    expect(r.stats.accepted).toBe(1);
    expect(r.stats.datesToCheck).toBe(1);
    expect(r.stats.rejected).toBe(0);
    expect(r.issues.some((i) => i.code === 'KSH_DATES_CHECK')).toBe(true);
    expect(r.rows[0]?.scxOrderNo).toBe('15099/2026/OSL/GDA/P');
    expect(r.rows[0]?.hhlOrderNo).toBe('0009/11/S/2026');
    expect(r.rows[0]?.driverName).toBe('Jan Kowalski');
    expect(r.rows[0]?.driverNameSe).toBe('Erik Svensson');
    expect(r.rows[0]?.tractorPlate).toBe('WGM12345');
    expect(r.rows[0]?.tractorPlateSe).toBe('ABC123');
    expect(r.rows[0]?.comment).toMatch(/SG-99/);
    /* F7: wiersz z span < 0 trafia do toRpcRows (L31 → baza KSH_DATES_CHECK). */
    const rpc = toRpcRows(r.rows)[0];
    expect(rpc?.dates_to_check).toBe(true);
    expect(rpc?.load_date).toBe('2026-12-04');
    expect(rpc?.delivery_date).toBe('2026-11-04');
  });

  it('telefon SE bez + → kraj SE; pusty Przewoźnik = HH z WARN', () => {
    /* F7: odcinek SE z domyślnym krajem SE (zero na początku zostaje). */
    expect(normalizePhone('0701234567', 'SE')).toBe('0701234567');
    const emptyCarr = parseSchedule([{ ...base, Wysyłka: 'SG-E', Przewoźnik: '', 'Data dostawy na budowę': '09.12.2026' }]);
    expect(emptyCarr.stats.accepted).toBe(1);
    expect(emptyCarr.issues.some((i) => i.code === 'CARRIER_EMPTY')).toBe(true);
    const sePhone = parseSchedule([{
      ...base,
      Wysyłka: 'SG-SE',
      'Data dostawy na budowę': '09.12.2026',
      'Nr tel. kierowcy': '501234567 / 0701234567',
    }]);
    expect(sePhone.rows[0]?.driverPhoneSe).toBe('0701234567');
  });

  it('NTG z wymiarami: WARN + skip; Standard cicho; puste wiersze; RPC', () => {
    const r = parseSchedule([
      { Lp: 137 },
      { ...base, Wysyłka: 'N-01', Przewoźnik: 'NTG', 'Rozmiar L x W x H': 'Standard' },
      { ...base, Wysyłka: 'N-02', Przewoźnik: 'NTG', 'Rozmiar L x W x H': '18 x 2,45 x 2,45' },
      { ...base, Wysyłka: 'SG-01', 'Data dostawy na budowę': '09.12.2026' },
    ]);
    expect(r.stats.skippedEmpty).toBe(1);
    expect(r.stats.skippedCarrier).toBeGreaterThanOrEqual(1);
    expect(r.issues.some((i) => i.code === 'CARRIER_SKIP' && i.shipmentCode === 'N-02')).toBe(true);
    expect(r.stats.accepted).toBe(1);
    const rpc = toRpcRows(r.rows)[0];
    expect(rpc?.carrier_order_no).toBeTruthy();
    expect(rpc?.hhl_order_no).toBeTruthy();
    expect(rpc?.dates_to_check).toBe(false);
    expect(rpc).not.toHaveProperty('order_no');
  });
});
