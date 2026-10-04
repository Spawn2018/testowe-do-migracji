import { describe, expect, it } from 'vitest';
import { statusLabel } from '../src/lib/statusLabel';

describe('L-7 nazwy statusów na liście harmonogramu', () => {
  it('opóźniony ma własną polską nazwę, nie nazwę etapu', () => {
    expect(statusLabel('DELAYED', 'SE_ROAD', 'pl')).toBe('Opóźniony');
    expect(statusLabel('DELAYED', 'TO_PORT', 'pl')).toBe('Opóźniony');
    expect(statusLabel('DELAYED', undefined, 'pl')).toBe('Opóźniony');
    expect(statusLabel('DELAYED', 'SE_ROAD', 'pl')).not.toBe('W drodze SE');
    expect(statusLabel('DELAYED', undefined, 'pl')).not.toBe('W drodze PL');
  });

  it('cichy ma własną polską nazwę, nie nazwę etapu', () => {
    expect(statusLabel('SILENT', 'SE_ROAD', 'pl')).toBe('Cichy');
    expect(statusLabel('SILENT', 'TO_PORT', 'pl')).toBe('Cichy');
    expect(statusLabel('SILENT', undefined, 'pl')).toBe('Cichy');
    expect(statusLabel('SILENT', 'SE_ROAD', 'pl')).not.toBe('W drodze SE');
    expect(statusLabel('SILENT', undefined, 'pl')).not.toBe('W drodze PL');
  });

  it('pozostałe statusy zostają przy swoich nazwach', () => {
    expect(statusLabel('IN_TRANSIT_PL', 'TO_PORT', 'pl')).toBe('W drodze PL');
    expect(statusLabel('PLANNED', 'PLAN', 'pl')).toBe('Planowany');
  });
});
