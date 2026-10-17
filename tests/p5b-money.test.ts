/**
 * wyglad/P5-b — Opcje › Pieniądze: Opłata paliwowa (E3, E39), Dopłaty — postój (E33), Cennik i opłaty — procenty
 * za anulowanie (E33) i próg marży (E16), Terminy płatności i adresy (E40, E12). Czyste funkcje widoku, przykład demo,
 * wygląd w HTML, jedna nazwa „Opłata paliwowa” w polskich tekstach i strażnik I-0 (przykłady tylko w trybie demo).
 * Adresy zmyślone (G-09).
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DwellScreen, FuelScreen, RatesExtras, TermsScreen } from '../src/components/options/MoneyScreens';
import { CANCEL_DAYS, feeOf, looksLikeEmail, pctOf, tierOf, tiersAround, type FuelTier } from '../src/lib/p5bFuel';
import { demoCancelRules, demoDwellRules, demoFuelScreen, demoPaymentTerms } from '../src/lib/p5bDemo';
import { sefsForLoadDate } from '../src/lib/sefs';
import { I18N_ALL, t } from '../src/i18n/messages';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/&#x27;/g, "'");
const ok = async () => true;
const sent = async () => 'SENT' as const;

describe('E3 — czyste funkcje opłaty paliwowej', () => {
  it('procent i opłata z mnożnika: ×1,13 → +13 %, 6 900 EUR → 897 EUR', () => {
    expect(pctOf(1.13)).toBe(13);
    expect(pctOf(1.125)).toBe(12.5);
    expect(pctOf(null)).toBeNull();
    expect(feeOf(6900, 1.13)).toBe(897);
    expect(feeOf(6900, null)).toBeNull();
  });
  it('wiersz tabeli mnożników i 5 wierszy „wokół obecnych cen” (na brzegu tabeli przesunięte)', () => {
    const T: FuelTier[] = [0, 1, 2, 3, 4, 5, 6].map((k) => ({ from: 20 + k, to: 20.99 + k, mult: 1 + k / 100 }));
    expect(tierOf(T, 23.5)).toBe(3);
    expect(tierOf(T, 99)).toBe(6); // powyżej tabeli — ostatni wiersz (jak lookupMult)
    expect(tierOf(T, 5)).toBe(0); // poniżej — pierwszy
    expect(tierOf(T, 20.995)).toBe(1); // zaokrąglenie do grosza: 21,00 → drugi wiersz, bez luki 0,01
    expect(tierOf(T, null)).toBe(-1);
    expect(tierOf([], 22)).toBe(-1);
    expect(tiersAround(T, 23.5)).toEqual({ rows: T.slice(1, 6), hit: 2 });
    expect(tiersAround(T, 20.1)).toEqual({ rows: T.slice(0, 5), hit: 0 });
    expect(tiersAround(T, 26.5)).toEqual({ rows: T.slice(2, 7), hit: 4 });
    expect(tiersAround(T, 99)).toEqual({ rows: T.slice(2, 7), hit: 4 });
    expect(tiersAround(T, null)).toEqual({ rows: T.slice(0, 5), hit: -1 });
  });
  it('adres e-mail do listy księgowości', () => {
    expect(looksLikeEmail(' ksiegowosc@example.com ')).toBe(true);
    expect(looksLikeEmail('ksiegowosc@example')).toBe(false);
    expect(looksLikeEmail('a b@example.com')).toBe(false);
  });
  it('procenty za anulowanie: ≥ 5 dni … dzień załadunku', () => {
    expect([...CANCEL_DAYS]).toEqual([5, 4, 3, 2, 1, 0]);
  });
});

/* audyt-C C-13 (E3 „Jedna liczba: Opcje, podgląd transportu, Finanse … biorą mnożnik z tej samej funkcji”): przykład demo
   z tego samego źródła co ceny transportów (`sefsForLoadDate`); wcześniej stałe z obrazu E3 (22,63 → ×1,13), których
   transporty demo nie używały (×1,05) — testy sprawdzały ten rozjazd. */
describe('E3 — przykład demo z tego samego źródła co ceny transportów', () => {
  const v = demoFuelScreen('2026-10-14');
  const week = sefsForLoadDate('2026-10-12');
  it('tydzień obowiązywania i tydzień wskaźników; stosowany niższy mnożnik — jak przy transporcie z załadunkiem w tym tygodniu', () => {
    expect(v.current).toMatchObject({ from: '2026-10-12', to: '2026-10-18', idxFrom: '2026-10-05', idxTo: '2026-10-11', applied: week.appliedMult, final: true });
    expect(v.current.okq8).toEqual({ avg: week.priceSek, n: 4, mult: week.multSek });
    expect(v.current.orlen).toEqual({ avg: week.pricePln, n: 5, mult: week.multPln });
    expect(v.current.okq8).toEqual({ avg: 19.68, n: 4, mult: 1.05 });
    expect(Math.min(v.current.okq8.mult ?? 9, v.current.orlen.mult ?? 9)).toBe(v.current.applied);
    expect(v.next).toMatchObject({ from: '2026-10-19', idxFrom: '2026-10-12', forecast: sefsForLoadDate('2026-10-19').appliedMult, finalOn: '2026-10-19' });
  });
  it('mnożniki z tabeli załącznika pasują do średnich', () => {
    expect(v.tiers.sek[tierOf(v.tiers.sek, week.priceSek)].mult).toBe(week.multSek);
    expect(v.tiers.pln[tierOf(v.tiers.pln, week.pricePln)].mult).toBe(week.multPln);
  });
  it('brak ceny Orlen z wczoraj: alarm, wiersz „brak”, wpływ na przyszły tydzień', () => {
    expect(v.alarm).toMatchObject({ source: 'ORLEN', date: '2026-10-13', affectsFrom: '2026-10-19', affectsTo: '2026-10-25', nextTry: '13:15' });
    const miss = v.days[0].rows.find((r) => r.how === 'MISSING');
    expect(miss).toMatchObject({ date: '2026-10-13', orlen: null, missing: { source: 'ORLEN' } });
    expect(v.days[1].closed).toEqual({ okq8: 19.68, orlen: 5.74, mult: 1.05 });
  });
  it('w poniedziałek „wczoraj” należy do zamkniętego tygodnia — bez alarmu', () => {
    expect(demoFuelScreen('2026-10-12').alarm).toBeNull();
  });
});

describe('E3, E39 — ekran Opłaty paliwowej w HTML', () => {
  const view = demoFuelScreen('2026-10-14');
  const actions = { fill: ok, newVersion: () => undefined };
  it('karty, kroki „Jak liczymy”, alarm z „Uzupełnij z Orlen”, tabele cen i mnożników', () => {
    const h = html(createElement(FuelScreen, { locale: 'pl', view, actions, readOnly: false }));
    expect(h).toContain('Załącznik 1 do umowy · wersja 3 od 28.09.2026');
    expect(h).toContain('+5 %');
    expect(h).toContain('×1,05');
    expect(h).toContain('Brak ceny Orlen z 13.10.');
    expect(h).toContain('Uzupełnij z Orlen');
    expect(h).toContain('Następna automatyczna próba: dziś 13:15');
    expect(h).toContain('OKQ8 19,68 SEK/l · Orlen 5,74 PLN/l');
    expect(h).toContain('SE ×1,05 · PL ×1,05');
    expect(h).toContain('6 900 EUR × 5 % = 345 EUR');
    expect(h).toContain('Ostateczna wartość w poniedziałek 19.10.2026 rano, ze średniej 12.10.2026–18.10.2026.');
    expect((h.match(/data-pm-tier-hit/g) ?? []).length).toBe(2);
    expect(h).toContain('Nowa wersja umowy');
    expect(h).not.toMatch(/SEFS|BAF|[Dd]odatek/);
  });
  it('Operacje HHL (tylko odczyt): bez „Uzupełnij” i „Nowa wersja umowy”; bez akcji — też bez przycisków', () => {
    for (const h of [
      html(createElement(FuelScreen, { locale: 'pl', view, actions, readOnly: true })),
      html(createElement(FuelScreen, { locale: 'pl', view, actions: null, readOnly: false })),
    ]) {
      expect(h).not.toContain('data-pm-fill');
      expect(h).not.toContain('data-pm-newver');
      expect(h).toContain('Brak ceny Orlen');
    }
  });
});

describe('E33 — Dopłaty: postój', () => {
  it('wartości, wybory przyciskami, przykład 8 h 10 min → 225 EUR (każda rozpoczęta godzina)', () => {
    const h = html(createElement(DwellScreen, { locale: 'pl', rules: demoDwellRules(), readOnly: false, onSave: ok }));
    expect(h).toContain('Czas wolny na załadunku');
    expect(h).toContain('6 h');
    expect(h).toContain('75 EUR');
    expect(h).toContain('750 EUR');
    expect(h).toContain('role="radio" aria-checked="true"');
    expect(h).toContain('→ 225,00 EUR');
    expect(h).toContain('Ostatnia zmiana: 07.10.2026, 12:35 · Administrator HHL');
    expect(h).not.toMatch(/WSTĘPNE|wstępne/);
    expect((h.match(/>Zmień</g) ?? []).length).toBe(5);
    expect(h).toContain('Stawka dobowa powyżej');
    expect(h).toMatch(/tabindex="0"[^>]*>każda rozpoczęta godzina|>każda rozpoczęta godzina/);
    expect(h).not.toMatch(/\b(E\d{1,2}|1[23]:\d\d)\)/); // bez kodów etapów i godzin decyzji w tekście
  });
  it('za faktyczny czas: 2 h 10 min × 75 = 162,50 EUR; powyżej progu doby — stawka dobowa', () => {
    const frac = html(createElement(DwellScreen, { locale: 'pl', rules: { ...demoDwellRules(), hourMode: 'FRACTION' }, readOnly: false, onSave: ok }));
    expect(frac).toContain('→ 162,50 EUR');
    const day = html(createElement(DwellScreen, { locale: 'pl', rules: { ...demoDwellRules(), dayAfterH: 8 }, readOnly: false, onSave: ok }));
    expect(day).toContain('→ 750,00 EUR');
  });
  it('tylko odczyt: bez „Zmień”, wybory nieaktywne', () => {
    const h = html(createElement(DwellScreen, { locale: 'pl', rules: demoDwellRules(), readOnly: true, onSave: ok }));
    expect(h).not.toContain('>Zmień<');
    expect(h).toMatch(/role="radio" aria-checked="true" tabindex="0" disabled=""/);
  });
});

describe('E33, E16 — Cennik i opłaty: procenty za anulowanie i próg marży', () => {
  it('6 wierszy z przykładem SG (koszt / przychód), próg marży „nie ustawiony”', () => {
    const h = html(createElement(RatesExtras, { locale: 'pl', cancel: demoCancelRules(), onCancelSave: ok, margin: null, onMarginSave: ok, readOnly: false }));
    expect((h.match(/data-pm-row="\d"/g) ?? []).length).toBe(6);
    expect(h).toContain('25 %');
    /* wyglad/audyt-E (E-06): przykład = fracht SG z cennika poniżej (SCX v1 6 900, KSH v2 7 245 EUR — baza 08.10, E33) */
    expect(h).toContain('SG: 1 725,00 / 1 811,25 EUR');
    expect(h).toContain('SG: 6 900,00 / 7 245,00 EUR');
    expect(h).toContain('Przykład dla frachtu SG z cennika: koszt 6 900 EUR, przychód 7 245 EUR.');
    expect(h).not.toMatch(/\(E\d{1,2}\)|\(12:35\)/);
    expect(h).toContain('Próg marży');
    expect(h).toContain('nie ustawiony');
    expect(h).toContain('Cennik przewoźnika i cennik KSH');
  });
  it('bez przykładu z cennika — procenty bez kwot SG (nic na stałe w komponencie)', () => {
    const h = html(createElement(RatesExtras, { locale: 'pl', cancel: { ...demoCancelRules(), example: null }, onCancelSave: ok, margin: 4, onMarginSave: ok, readOnly: false }));
    expect(h).toContain('15 %');
    expect(h).not.toMatch(/SG:|6 900|7 245/);
    expect(h).toContain('Dni liczymy kalendarzowo od daty anulowania do planowanego załadunku.');
  });
  it('Operacje HHL (tylko odczyt): procenty i próg bez „Zmień”', () => {
    const h = html(createElement(RatesExtras, { locale: 'pl', cancel: demoCancelRules(), onCancelSave: ok, margin: 4, onMarginSave: ok, readOnly: true }));
    expect(h).toContain('4 %');
    expect(h).not.toContain('>Zmień<');
  });
  it('próg niepodłączony (undefined) — pola nie ma', () => {
    const h = html(createElement(RatesExtras, { locale: 'pl', cancel: demoCancelRules(), onCancelSave: null, margin: undefined, onMarginSave: null, readOnly: false }));
    expect(h).not.toContain('data-pm-margin');
    expect(h).not.toContain('>Zmień<');
  });
});

describe('E40, E12 — Terminy płatności i adresy księgowości', () => {
  it('terminy 30 / 35 dni, listy adresów z próbnym e-mailem, pusta lista z dopiskiem', () => {
    const h = html(createElement(TermsScreen, {
      locale: 'pl', terms: demoPaymentTerms(), onTermsSave: ok,
      addresses: { KSH: ['ksiegowosc@example.com'], HHL: [] }, onAddrSave: ok, onTest: sent, readOnly: false,
    }));
    expect(h).toContain('30 dni');
    expect(h).toContain('35 dni');
    expect(h).toContain('ksiegowosc@example.com');
    expect(h).toContain('Wyślij próbny e-mail');
    expect(h).toContain('Brak adresu — wysyłka paczki tygodnia niedostępna.');
    expect(h).toContain('aria-label="usuń ksiegowosc@example.com"');
    expect((h.match(/\+ Dodaj adres/g) ?? []).length).toBe(1);
    expect(h).toContain('Wyślij próbny e-mail na ten adres');
    expect((h.match(/>usuń</g) ?? []).length).toBe(1);
  });
  it('tylko odczyt: bez dodawania, usuwania i próbnego e-maila', () => {
    const h = html(createElement(TermsScreen, {
      locale: 'pl', terms: demoPaymentTerms(), onTermsSave: ok,
      addresses: { KSH: ['ksiegowosc@example.com'], HHL: [] }, onAddrSave: ok, onTest: sent, readOnly: true,
    }));
    expect(h).not.toMatch(/Dodaj adres|>usuń<|próbny e-mail|>Zmień</);
  });
});

describe('E39 — jedna nazwa „Opłata paliwowa” w polskim interfejsie', () => {
  const re = /SEFS|BAF|[Dd]odat\w* paliw|[Mm]nożnik paliwow|[Dd]opłat\w* paliw/;
  it('żaden polski tekst słownika głównego nie mówi „SEFS”, „BAF”, „dodatek / dopłata paliwowa”, „mnożnik paliwowy”', () => {
    const hits = Object.entries(I18N_ALL.pl).filter(([, v]) => re.test(v)).map(([k]) => k);
    expect(hits).toEqual([]);
  });
  it('to samo w słownikach osobnych (decyzje, P5, P5-b) i bez „WSTĘPNE” przy postoju (E33)', () => {
    /* wartości polskiego słownika pliku: od `const pl`/`const PL` do zamknięcia obiektu; klucze (np. dec_type_SEFS_…) pomijamy */
    const plValues = (file: string) => {
      const src = readFileSync(new URL(`../src/i18n/${file}`, import.meta.url), 'utf8');
      const start = src.search(/const (pl|PL)\b[^=]*= \{/);
      const body = src.slice(start, src.indexOf('\n};', start));
      return [...body.matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    };
    for (const f of ['decisions.ts', 'p5.ts', 'p5b.ts']) {
      const vals = plValues(f);
      expect(vals.length).toBeGreaterThan(10);
      expect(vals.filter((v) => re.test(v))).toEqual([]);
    }
    expect(Object.entries(I18N_ALL.pl).filter(([k, v]) => /dwell/i.test(k) && /WSTĘPNE/.test(v))).toEqual([]);
  });
  it('tytuł ekranu i nagłówki', () => {
    expect(t('pl', 'opt_acc_sefs_title')).toBe('Opłata paliwowa');
    expect(t('pl', 'opt_fuel_h2')).toBe('Opłata paliwowa');
    expect(t('pl', 'fin_fuel_addon')).toBe('Opłata paliwowa');
    expect(t('pl', 'p3c_s_terms')).toBe('Terminy płatności i adresy');
  });
});

describe('I-0 i podłączenie w Opcjach', () => {
  it('build produkcyjny (VITE_AUTH_MODE=supabase): każda funkcja danych zwraca null', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    vi.resetModules();
    const m = await import('../src/lib/p5bSource');
    const fns = Object.entries(m).filter(([, v]) => typeof v === 'function') as [string, (...a: unknown[]) => unknown][];
    expect(fns.length).toBe(13); /* wyglad/audyt-E (E-06): + rateCardOf, rateCardSaverOf */
    for (const [name, fn] of fns) expect([name, fn('2026-10-14')]).toEqual([name, null]);
    vi.unstubAllEnvs();
    vi.resetModules();
    const d = await import('../src/lib/p5bSource');
    expect(d.fuelScreenOf('2026-10-14')).not.toBeNull();
    expect(d.marginSettingOf()).toEqual({ pct: expect.any(Number), save: expect.any(Function) });
  });
  const src = readFileSync(new URL('../src/lib/p5bSource.ts', import.meta.url), 'utf8');
  it('każda funkcja danych zwraca przykład tylko w trybie demo (warunek wpisany wprost)', () => {
    const fns = src.match(/^export function \w+/gm) ?? [];
    const guards = src.match(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase'/g) ?? [];
    expect(fns.length).toBe(13); /* wyglad/audyt-E (E-06): + rateCardOf, rateCardSaverOf */
    expect(guards.length).toBe(fns.length);
    expect(src).toMatch(/VITE_AUTH_MODE !== 'supabase' \? demoFuelScreen\(today(, hm)?\) : null/); /* W-naprawy-2: + godzina zegara demo */
    expect(src).not.toMatch(/supabase\.|fetch\(|\.rpc\(/);
  });
  it('OptionsView: nowe ekrany tylko przy danych; bez danych zostaje dzisiejszy formularz', () => {
    const v = readFileSync(new URL('../src/views/OptionsView.tsx', import.meta.url), 'utf8');
    expect(v).toMatch(/scr\('fuel', fuelView \? block\(/);
    expect(v).toMatch(/scr\('surch', dwell\s*\? block\(<DwellScreen/);
    expect(v).toMatch(/if \(terms \|\| addresses\) \{\s*money\.push\(scr\('terms'/);
    expect(v).toContain('BafForm');
    expect(v).toContain('DwellOptionsForm');
    const types = readFileSync(new URL('../src/components/options/types.ts', import.meta.url), 'utf8');
    expect(types).toMatch(/terms: 'p3c_s_terms'/);
  });
});
