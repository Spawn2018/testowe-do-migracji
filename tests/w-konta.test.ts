/**
 * wyglad/W-konta — rodzaj konta w demo (audyt 17.10 §7: role „HHL Operacje” i „SCX Użytkownik” nie istniały w demo).
 * Demo bez wyboru zachowuje się jak dotąd (konto domyślne firmy); wybór „Operacje” / „Użytkownik” działa tylko w tej firmie.
 * Produkcja: rola z profilu — bez zmian.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountRole } from '../src/lib/accountRole';
import { demoAccountKind, resetDemoAccountCache, setDemoAccountKind } from '../src/lib/demoAccount';
import { viewedKind } from '../src/lib/cockpitE9';
import { canChangeLoadStatus } from '../src/lib/permissions';
import { canFixAwizOf } from '../src/lib/p7Source';
import { mayResolveDecision } from '../src/lib/decisionAccess';
import { hasKey } from '../src/i18n/messages';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { vi.unstubAllGlobals(); setDemoAccountKind(null); resetDemoAccountCache(); });

describe('rodzaj konta w demo', () => {
  it('bez wyboru — konto domyślne firmy (jak dotąd): accountRole = null, viewedKind = Administrator / Dyspozytor', () => {
    expect(demoAccountKind()).toBeNull();
    expect(accountRole('HHL')).toBeNull();
    expect(viewedKind('HHL', accountRole('HHL'))).toBe('HHL_ADMIN');
    expect(viewedKind('SCX', accountRole('SCX'))).toBe('CARRIER_DISPATCH');
    expect(canChangeLoadStatus('HHL', accountRole('HHL'))).toBe(true);
    expect(canFixAwizOf('HHL')).toBe(true);
  });
  it('Operacje HHL — tylko w firmie HHL; w Podglądzie KSH/SCX konto domyślne tej firmy', () => {
    setDemoAccountKind('HHL_OPS');
    expect(accountRole('HHL')).toBe('HHL_OPS');
    expect(viewedKind('HHL', accountRole('HHL'))).toBe('HHL_OPS');
    expect(accountRole('KSH')).toBeNull();
    expect(accountRole('SCX')).toBeNull();
    /* E9: Operacje HHL nie zmieniają statusu ani awizacji; decyzje HHL rozstrzygają */
    expect(canChangeLoadStatus('HHL', accountRole('HHL'))).toBe(false);
    expect(canFixAwizOf('HHL')).toBe(false);
    expect(mayResolveDecision('HHL', accountRole('HHL'))).toBe(true);
    expect(mayResolveDecision('CARRIER', accountRole('HHL'))).toBe(false);
  });
  it('Użytkownik SCX — tylko w firmie SCX; zmienia status jak Dyspozytor', () => {
    setDemoAccountKind('CARRIER_USER');
    expect(accountRole('SCX')).toBe('CARRIER_USER');
    expect(viewedKind('SCX', accountRole('SCX'))).toBe('CARRIER_USER');
    expect(accountRole('HHL')).toBeNull();
    expect(canChangeLoadStatus('SCX', accountRole('SCX'))).toBe(true);
  });
});

describe('menu konta i ekrany', () => {
  it('przełącznik „Rodzaj konta (demo)” tylko bez profilu i poza produkcją; nazwy w słowniku', () => {
    const m = read('src/components/shell/AccountMenu.tsx');
    expect(m).toMatch(/const demoKinds = !profile && import\.meta\.env\.VITE_AUTH_MODE !== 'supabase'/);
    for (const k of ['p3a_acc_kind', 'p3a_kshort_HHL_ADMIN', 'p3a_kshort_HHL_OPS', 'p3a_kshort_CARRIER_DISPATCH', 'p3a_kshort_CARRIER_USER']) {
      expect(hasKey('pl', k), k).toBe(true);
    }
  });
  it('ekrany czytają rodzaj konta przez accountRole (Kokpit, Ryzyka, menu, Pomoc, panel, Opcje, Ustawienia, Strefy, Automatyzacje, Rejsy)', () => {
    for (const f of [
      'src/views/DashboardView.tsx', 'src/views/RisksView.tsx', 'src/components/shell/Nav.tsx', 'src/components/shell/HelpPanel.tsx',
      'src/components/drawer/LoadDrawer.tsx', 'src/components/drawer/StatusChangeModal.tsx', 'src/components/risks/TodoPanel.tsx',
      'src/views/OptionsView.tsx', 'src/views/SettingsView.tsx', 'src/views/ZonesView.tsx', 'src/components/automations/RulesPage.tsx',
      'src/views/SailingsPanel.tsx', 'src/lib/p7Source.ts',
    ]) {
      const s = read(f);
      expect(s, f).toMatch(/accountRole\(role\)/);
    }
    /* produkcja: profil bez zmian; Rejsy na produkcji dalej tylko HHL_ADMIN z profilu */
    expect(read('src/lib/accountRole.ts')).toMatch(/if \(p\) return p\.role;\n {2}if \(import\.meta\.env\.VITE_AUTH_MODE === 'supabase'\) return null;/);
  });
});


describe('Pomoc bez danych na produkcji (audyt 17.10 sekcja 06 N11)', () => {
  it('brak źródła (null) — „pojawi się po włączeniu danych”; pusta lista — „Brak konta…” / „Brak zmian…”', () => {
    const s = read('src/components/shell/HelpPanel.tsx');
    expect(s).toMatch(/hp\(locale, contacts \? 'help_contact_none' : 'help_contact_soon'\)/);
    expect(s).toMatch(/hp\(locale, news \? 'help_news_none' : 'help_news_soon'\)/);
    expect(read('src/i18n/help.ts')).toMatch(/help_contact_soon: 'Kontakt do Operacji HHL pojawi się tutaj po włączeniu danych\.'/);
  });
});

describe('SMS przy miejscach na produkcji do czasu P8 (audyt 17.10 sekcja 03 N7)', () => {
  it('Operacje HHL — bez „Zapisz”, przełączników i SMS testowego; PL/SE jako numer kierunkowy', () => {
    const s = read('src/auth/SmsZoneRecipients.tsx');
    expect(s).toMatch(/\{readOnly \? null : <button type="submit"/);
    expect(s).toMatch(/\{readOnly \? null : <button type="button" className="btn ghost" onClick=\{\(\) => void testList/);
    expect(s).toMatch(/checked=\{approach\} disabled=\{readOnly\}/);
    expect(s).toMatch(/<option value="PL">PL \+48<\/option>/);
    /* W-opcje-live-2: na produkcji ekran z audytu (LiveSmsPlaces) — Operacje HHL tylko odczyt, wyzwalacze i SMS testowe pod nim */
    expect(read('src/views/OptionsView.tsx')).toMatch(/<LiveSmsPlaces readOnly=\{ro\}>/);
    const live = read('src/auth/LiveSmsPlaces.tsx');
    expect(live).toMatch(/checked=\{flags\.approach\} disabled=\{readOnly\}/);
    expect(live).toMatch(/\{readOnly \? null : \(\s*<div className="ol2-acts">/);
    expect(hasKey('pl', 'dec5_prefix')).toBe(true);
  });
});

describe('stare formularze Opcji na produkcji u Operacji HHL (audyt 17.10 sekcja 07 N2, do czasu P3-d)', () => {
  it('fieldset disabled + ukryte przyciski zmian dla 6 formularzy', () => {
    const v = read('src/views/OptionsView.tsx');
    expect(v).toMatch(/const roBlock = \(el: ReactNode\) => block\(ro \? <fieldset disabled className="opt-ro" data-opt-ro>\{el\}<\/fieldset> : el\);/);
    for (const f of ['OpsThresholdsForm', 'BroadcastForm', 'PermitRequirement']) {
      expect(v, f).toContain(`roBlock(<${f} />)`);
      expect(v, f).not.toContain(` block(<${f} />)`);
    }
    /* W-opcje-live-2: Dopłaty, Opłata paliwowa i bramka SMS — ekrany z audytu z readOnly; stare formularze pod nimi w fieldset disabled */
    for (const f of ['LiveDwell', 'LiveFuel']) expect(v, f).toContain(`block(<${f} readOnly={ro} />)`);
    expect(read('src/auth/LiveFuel.tsx')).toContain('<fieldset disabled className="opt-ro" data-opt-ro><BafForm /></fieldset>');
    expect(read('src/auth/LiveSmsPlaces.tsx')).toContain('<fieldset disabled className="opt-ro" data-opt-ro><SmsGateway /></fieldset>');
    expect(read('src/index.css')).toContain('.opt-ro :is(button[type="submit"],.btn,.chipbtn,[data-action]){display:none}');
  });
  it('Cennik (F7): Operacje HHL przełączają Stronę i Firmę — każda karta do obejrzenia; pola edycji nieaktywne, bez „Zapisz”, „Dodaj”, „Usuń”', () => {
    const v = read('src/views/OptionsView.tsx');
    expect(v).not.toContain('roBlock(<RateCardForm');
    /* W-opcje-live-2: produkcja — LiveRateCard (tabela z audytu), pełny RateCardForm z readOnly rozwijany pod nią */
    expect(v).toContain('block(<LiveRateCard readOnly={ro} />)');
    expect(read('src/auth/LiveRateCard.tsx')).toContain('<RateCardForm readOnly={readOnly} />');
    const f = read('src/auth/RateCardForm.tsx');
    expect(f).toMatch(/export default function RateCardForm\(\{ readOnly = false \}/);
    /* Strona i Firma bez disabled */
    expect(f).toMatch(/<select className="input" value=\{side\} onChange=/);
    expect(f).toMatch(/<select className="input" value=\{orgId\} onChange=/);
    expect(f.match(/disabled=\{readOnly\}/g)?.length).toBe(7);
    expect(f).toMatch(/\{readOnly \? null : <button className="btn" type="submit"/);
    expect(f).toMatch(/\{readOnly \? null : <button className="chipbtn" type="button" onClick=\{\(\) => setRows\(\(x\) => \[\.\.\.x/);
    expect(f).toMatch(/onSubmit=\{readOnly \? \(e\) => e\.preventDefault\(\) : save\}/);
  });
});

describe('wybór rodzaju konta zapisany w adresie (F7)', () => {
  const fakeWindow = (hash: string, search = '') => {
    const location = { pathname: '/', search, hash };
    const history = {
      state: null,
      replaceState: (_s: unknown, _t: string, url: string) => {
        const u = new URL(url, 'https://tower.example');
        location.search = u.search;
        location.hash = u.hash;
      },
    };
    vi.stubGlobal('window', { location, history });
    return location;
  };
  it('menu nadpisuje `konto=` z adresu; konto domyślne usuwa parametr', () => {
    const loc = fakeWindow('#/opcje?konto=operacje&x=1');
    resetDemoAccountCache();
    expect(demoAccountKind()).toBe('HHL_OPS');
    setDemoAccountKind('CARRIER_USER');
    expect(loc.hash).toBe('#/opcje?x=1&konto=uzytkownik');
    resetDemoAccountCache();
    expect(demoAccountKind()).toBe('CARRIER_USER');
    setDemoAccountKind(null);
    expect(loc.hash).toBe('#/opcje?x=1');
    resetDemoAccountCache();
    expect(demoAccountKind()).toBeNull();
  });
  it('bez trasy w adresie — parametr w części `?`; wybór z adresu zostaje po przejściu na ekran bez `konto=`', () => {
    const loc = fakeWindow('');
    setDemoAccountKind('HHL_OPS');
    expect(loc.search).toBe('?konto=operacje');
    loc.search = '';
    loc.hash = '#/kokpit';
    expect(demoAccountKind()).toBe('HHL_OPS');
  });
});

describe('„Moje konto” w demo (F7)', () => {
  it('Użytkownik SCX ma własną osobę (dane wymyślone) — nie Administratora HHL', () => {
    expect(read('src/components/options/demo.tsx')).toMatch(/\{ id: 'p6', name: 'Tomasz Wrona', mail: 't\.wrona@…', kind: 'CARRIER_USER'/);
  });
});
