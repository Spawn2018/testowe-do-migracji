import { describe, expect, it } from 'vitest';
import { statusLabel } from '../src/lib/statusLabel';

describe('L-7 nazwy statusów na liście harmonogramu', () => {
  it('opóźniony ma własną polską nazwę, nie nazwę etapu', () => {
    expect(statusLabel('DELAYED', 'SE_ROAD', 'pl')).toBe('Opóźniony');
    expect(statusLabel('DELAYED', 'TO_PORT', 'pl')).toBe('Opóźniony');
    expect(statusLabel('DELAYED', undefined, 'pl')).toBe('Opóźniony');
    expect(statusLabel('DELAYED', 'SE_ROAD', 'pl')).not.toBe('Droga SE');
    expect(statusLabel('DELAYED', undefined, 'pl')).not.toBe('Droga PL');
  });

  it('cichy ma własną polską nazwę, nie nazwę etapu', () => {
    expect(statusLabel('SILENT', 'SE_ROAD', 'pl')).toBe('Cichy');
    expect(statusLabel('SILENT', 'TO_PORT', 'pl')).toBe('Cichy');
    expect(statusLabel('SILENT', undefined, 'pl')).toBe('Cichy');
    expect(statusLabel('SILENT', 'SE_ROAD', 'pl')).not.toBe('Droga SE');
    expect(statusLabel('SILENT', undefined, 'pl')).not.toBe('Droga PL');
  });

  /* Przepisane w wyglad/P4-b — E25 (jeden słownik nazw: panel, pasek, oś): „Zaplanowany”, „Brak zasobów”, „Droga PL”, „Port PL”, „Droga SE”. */
  it('pozostałe statusy mają nazwy ze spisu E25', () => {
    expect(statusLabel('IN_TRANSIT_PL', 'TO_PORT', 'pl')).toBe('Droga PL');
    expect(statusLabel('PLANNED', 'PLAN', 'pl')).toBe('Zaplanowany');
    expect(statusLabel('RESOURCES_PENDING', undefined, 'pl')).toBe('Brak zasobów');
    expect(statusLabel('AT_PORT', undefined, 'pl')).toBe('Port PL');
    expect(statusLabel('IN_TRANSIT_SE', undefined, 'pl')).toBe('Droga SE');
    expect(statusLabel('AT_PORT_SE', undefined, 'pl')).toBe('Port SE');
    expect(statusLabel('APPROACHING_SITE', undefined, 'pl')).toBe('Na placu');
  });
});
