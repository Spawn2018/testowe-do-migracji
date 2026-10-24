/**
 * #484 (właściciel 23.10 08:17): Historia zmian dla Operacji HHL (Opcje, tylko odczyt) oraz KSH i SCX (Ustawienia,
 * wpisy swoich transportów — zakres i ukrywanie w bazie 0290). Autor z innej firmy bez nazwiska i e-maila.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Historia zmian — role', () => {
  const opt = readFileSync('src/views/OptionsView.tsx', 'utf8');
  const set = readFileSync('src/views/SettingsView.tsx', 'utf8');
  const live = readFileSync('src/auth/LiveHistory.tsx', 'utf8');
  it('Opcje: Administrator i Operacje HHL (Operacje — odczyt)', () => {
    expect(opt).not.toContain("if (isHhlAdmin) system.push(scr('hist'");
    expect(opt).toContain("{ right: isHhlAdmin ? undefined : 'read' }");
  });
  it('Ustawienia: KSH i SCX — Historia zmian tylko do odczytu, tylko produkcja', () => {
    expect(set).toContain("if (LiveHistory && (role === 'KSH' || role === 'SCX')) {");
    expect(set).toContain("{ id: 'hist', right: 'read', body: block(<LiveHistory />) }");
  });
  it('KSH/SCX: osoba z innej firmy → „Inna firma”, bez e-maila; obszary tylko z własnych wpisów', () => {
    expect(live).toContain("hhl ? (r.user_email || t(locale, 'p3l_h_auto')) : r.user_id ? other : t(locale, 'p3l_h_auto')");
    expect(live).toContain("hhl ? (r.acting_as_email ?? '—') : other");
    expect(live).toContain(": ['loads', 'documents']),");
  });
});
