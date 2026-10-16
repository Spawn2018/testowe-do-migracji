/**
 * wyglad/P6-f (D-20261016-0310-01 Cz19 pkt 5, Cz23 pkt 4–5; D-20261016-0315-01 Cz32): stan aplikacji na telefonie
 * i teksty „Ten telefon” — aplikacja z ikony, propozycja instalacji, przeglądarka; teksty bez „sms:”, „mailto:”, „supabase”.
 */
import { describe, expect, it } from 'vitest';
import { installStateNow } from '../src/lib/installPrompt';
import { P6F_PL } from '../src/i18n/p6f';

describe('stan aplikacji na telefonie', () => {
  it('z ikony → aplikacja; propozycja przeglądarki → przycisk; po instalacji → „zainstalowano”; inaczej → przeglądarka', () => {
    expect(installStateNow({ standalone: true, canPrompt: true, installedNow: false })).toBe('app');
    expect(installStateNow({ standalone: false, canPrompt: true, installedNow: false })).toBe('can-install');
    expect(installStateNow({ standalone: false, canPrompt: false, installedNow: true })).toBe('installed');
    expect(installStateNow({ standalone: false, canPrompt: false, installedNow: false })).toBe('browser');
  });
  it('teksty: przyciski w powiadomieniu, ekran blokady, „tylko HHL i SCX” nie do KSH; bez „sms:” / „mailto:” / „supabase”', () => {
    const all = Object.values(P6F_PL).join('\n');
    expect(all).toContain('Oznacz jako odczytane');
    expect(all).toContain('Odpowiedz');
    expect(all).toContain('Ukryj treść na ekranie blokady');
    expect(all).toContain('nie trafiają do KSH');
    for (const bad of ['sms:', 'mailto:', 'supabase']) expect(all.toLowerCase()).not.toContain(bad);
  });
});
