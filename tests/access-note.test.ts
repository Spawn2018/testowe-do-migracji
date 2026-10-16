/**
 * wyglad/P6-d — E37 „Komunikaty zdaniami”: sprawa zamknięta i sprawa innej firmy zamiast „Brak dostępu”.
 */
import { describe, expect, it } from 'vitest';
import { accessNoteText, closedNote, firmNote, parseAccessNote } from '../src/lib/accessNote';

describe('E37 — komunikaty zdaniami', () => {
  it('sprawa zamknięta: data wygaśnięcia i transport', () => {
    const n = parseAccessNote(closedNote('2026-10-06T21:59:00Z', 'SG-03'));
    expect(n).toEqual({ kind: 'closed', until: '2026-10-06', code: 'SG-03' });
    expect(accessNoteText(n!)).toBe('Ta sprawa jest już zamknięta (wygasła 06.10).');
  });
  it('sprawa zamknięta bez daty i bez transportu', () => {
    const n = parseAccessNote(closedNote(null, null));
    expect(n).toEqual({ kind: 'closed', until: null, code: null });
    expect(accessNoteText(n!)).toBe('Ta sprawa jest już zamknięta.');
  });
  it('sprawa innej firmy', () => {
    const n = parseAccessNote(firmNote('SCX'));
    expect(accessNoteText(n!)).toBe('Tę sprawę prowadzi SCX. Możesz ją tylko podejrzeć.');
  });
  it('dzisiejsze „Brak dostępu” i nieznany zapis → bez zmian', () => {
    expect(parseAccessNote('Brak dostępu')).toEqual({ kind: 'denied' });
    expect(accessNoteText({ kind: 'denied' })).toBeNull();
    expect(parseAccessNote('firm|XYZ')).toEqual({ kind: 'denied' });
    expect(parseAccessNote(null)).toBeNull();
  });
});
