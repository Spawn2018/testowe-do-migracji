/**
 * wyglad/audyt-E — poprawki Opcji z przeglądu zgodności 16.10.2026 (`/tmp/claude-0/gap/E/GAPS.md`):
 * E-01/N-01 przełączniki, E-02/E-14 „Kto co dostaje”, E-04 „Jak to działa”, E-05/N-02 (W47) „Co dostaję”,
 * E-06/C-14 cennik według symboli.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_FLAG_KEYS } from '../src/components/options/SystemScreens';
import { DEMO_FLAGS, DEMO_MATRIX, demoBodies } from '../src/components/options/demo';
import { ForMeScreen } from '../src/components/options/ForMeScreen';
import { myNotifyOf } from '../src/lib/forMeSource';
import { demoMyNotify, demoSaveMyNotify } from '../src/lib/forMeDemo';
import { t } from '../src/i18n/messages';
import { RateCard } from '../src/components/options/MoneyScreens';
import { demoRateCard } from '../src/lib/p5bDemo';
import { rateCardOf, rateCardSaverOf } from '../src/lib/p5bSource';

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const read = (p: string) => readFileSync(p, 'utf8');
const row = (id: string) => DEMO_MATRIX.flatMap((g) => g.rows).find((r) => r.id === id);

describe('E-01, N-01: Przełączniki bezpieczeństwa — 9, bez „Kontroli trasy”, „Przeszkód” i e-maila decyzji', () => {
  it('lista i dane demo: te same 9 kluczy, w tej samej kolejności', () => {
    expect(SECURITY_FLAG_KEYS).toHaveLength(9);
    expect(DEMO_FLAGS.map((f) => f.key)).toEqual([...SECURITY_FLAG_KEYS]);
    for (const k of ['H1_ROUTE_CHECK', 'H3_CORRIDOR_OBSTACLES', 'H6_MAP_OBSTACLES', 'AUTOMATIC_DECISION_EMAIL']) {
      expect(SECURITY_FLAG_KEYS as readonly string[]).not.toContain(k);
      expect(t('pl', `p3c_flag_${k}`)).toBe(`p3c_flag_${k}`);
    }
  });
  it('kafelek „System” na telefonie: „9 przełączników”; nigdzie „Czeka na wymiary”', () => {
    const d = demoBodies('pl', { kind: 'HHL_ADMIN', readOnly: false, mark: null });
    expect(d.summaries.system?.text).toBe('1 źródło nie działa · 9 przełączników');
    expect(read('src/components/options/demo.tsx') + read('src/i18n/p3c.ts')).not.toContain('Czeka na wymiary');
  });
});

describe('E-02, E-14: „Kto co dostaje” — nowe zdarzenia', () => {
  it('„Auto 50 km przed placem” i „przed Śremem” osobno — KSH i SCX; „Auto 20 km przed portem” — HHL (E35 pkt 2, C3-p)', () => {
    expect(row('pre_arrival_site')?.title).toBe('Auto 50 km przed placem');
    expect(row('pre_arrival_srem')?.title).toBe('Auto 50 km przed Śremem');
    for (const id of ['pre_arrival_site', 'pre_arrival_srem'] as const) {
      expect(row(id)?.cells.CLIENT_USER?.bell).toBe(true);
      expect(row(id)?.cells.CARRIER_DISPATCH?.bell).toBe(true);
      expect(row(id)?.cells.HHL_ADMIN?.bell).toBe(false);
    }
    expect(row('pre_port')?.title).toBe('Auto 20 km przed portem');
    expect(row('pre_port')?.cells.HHL_ADMIN?.bell).toBe(true);
    expect(row('pre_port')?.cells.CLIENT_USER?.bell).toBe(false);
  });
  it('„Decyzja SCX: objazd albo postój” — HHL Administrator i Operacje: dzwonek i telefon, e-mail wyłączony (E49)', () => {
    const r = row('scx_detour')!;
    for (const k of ['HHL_ADMIN', 'HHL_OPS'] as const) expect(r.cells[k]).toMatchObject({ bell: true, push: true, mail: false });
    expect(DEMO_MATRIX.find((g) => g.id === 'todo')?.rows.some((x) => x.id === 'scx_detour')).toBe(true);
  });
  it('System: źródło danych (nie działa / wróciło) i błąd aplikacji — Administrator HHL, e-mail i telefon na stałe (E23, E46, C3-p)', () => {
    for (const id of ['src_down', 'src_back', 'app_err']) {
      const c = row(id)!.cells.HHL_ADMIN!;
      expect(c).toMatchObject({ bell: true, push: true, mail: true });
      expect(c.fixed).toEqual(['push', 'mail']);
      expect(row(id)!.cells.CLIENT_USER).toBeNull();
    }
  });
  it('E-14: SMS niewysłany — e-mail do Operacji HHL (E42)', () => {
    expect(row('sms_gw')?.cells.HHL_OPS).toMatchObject({ bell: true, mail: true });
  });
});

describe('E-04: „Jak to działa” bez starych zasad', () => {
  it('Kto co dostaje i Progi alarmów — według E11, E7, E35, E12 i 16.10', () => {
    const notif = t('pl', 'b6_howto_notif');
    const thr = t('pl', 'b6_howto_thresh');
    expect(notif).not.toMatch(/Centrum decyzji|Nowa automatyzacja|dla grupy zdarzenia i firmy/);
    expect(thr).not.toMatch(/Zapis przy wyjściu z pola|albo polisy na 24 h/);
    expect(thr).toMatch(/zezwolenie PL i SE przy transporcie jest potrzebne tylko przy „Trasa”/);
  });
});

describe('E-05, N-02 (W47): „Dla mnie › Co dostaję” — przełączniki osoby', () => {
  it('KSH Użytkownik: zdarzenia rodzaju konta z przełącznikami i miejscem na „Zapisano”', () => {
    const h = html(createElement(ForMeScreen, { locale: 'pl', kind: 'CLIENT_USER', groups: DEMO_MATRIX, onSave: async () => true }));
    expect(h).toContain('data-forme="edit"');
    expect(h).toContain('data-forme-row="pre_arrival_site"');
    expect(h).toContain('data-forme-row="pre_arrival_srem"');
    expect(h).not.toContain('data-forme-row="pre_port"');
    expect(h).toContain('role="status"');
    expect(h).toContain('Włączasz i wyłączasz swoje kanały');
    expect(h).not.toMatch(/Na tym urządzeniu|tylko tej przeglądarki/);
    /* przyciski kanałów działają (bez disabled), kanał „zawsze” — zablokowany */
    const chips = h.match(/<button[^>]*class="ox-ch[^"]*"[^>]*>/g) ?? [];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.filter((b) => !b.includes('is-fixed')).every((b) => !b.includes('disabled'))).toBe(true);
  });
  it('kanał „zawsze” (Zmiana dat planu — dzwonek SCX) nie do wyłączenia; ustawienie osoby nadpisuje wartość startową', () => {
    const h = html(createElement(ForMeScreen, {
      locale: 'pl', kind: 'CARRIER_DISPATCH', groups: DEMO_MATRIX, onSave: async () => true,
      prefs: { status: { bell: false }, dates: { bell: false } },
    }));
    const statusRow = h.slice(h.indexOf('data-forme-row="status"'), h.indexOf('data-forme-row="dates"'));
    expect(statusRow).toMatch(/ox-ch-bell"[^>]*aria-pressed="false"/);
    const datesRow = h.slice(h.indexOf('data-forme-row="dates"'));
    expect(datesRow).toMatch(/ox-ch-bell is-on is-fixed"[^>]*aria-pressed="true"[^>]*disabled/);
  });
  it('bez funkcji zapisu — tylko podgląd (przyciski nieaktywne)', () => {
    const h = html(createElement(ForMeScreen, { locale: 'pl', kind: 'HHL_ADMIN', groups: DEMO_MATRIX }));
    expect(h).toContain('data-forme="read"');
    expect(h).toContain('Tylko podgląd');
    expect(h).not.toContain('role="status"');
  });
  it('jedno miejsce zapisu: demo — magazyn strony (bez localStorage), osobno dla każdej osoby', async () => {
    const my = myNotifyOf('CLIENT_USER');
    expect(my?.save).toBeTypeOf('function');
    expect(await my!.save!('pre_arrival_site', 'mail', true)).toBe(true);
    expect(myNotifyOf('CLIENT_USER')?.prefs.pre_arrival_site).toEqual({ mail: true });
    expect(demoMyNotify('CARRIER_DISPATCH').pre_arrival_site).toBeUndefined();
    await demoSaveMyNotify('CARRIER_DISPATCH', 'pre_arrival_site', 'bell', false);
    expect(demoMyNotify('CARRIER_DISPATCH').pre_arrival_site).toEqual({ bell: false });
    const src = read('src/lib/forMeSource.ts') + read('src/lib/forMeDemo.ts');
    expect(src).not.toMatch(/localStorage|sessionStorage/);
    expect(read('src/lib/forMeSource.ts')).toContain("import.meta.env.VITE_AUTH_MODE !== 'supabase'");
  });
  it('Opcje HHL: bez przełączników „na tym urządzeniu”; Ustawienia KSH i SCX podają funkcję zapisu', () => {
    const opt = read('src/views/OptionsView.tsx');
    expect(opt).not.toMatch(/browserPrefs|notificationPrefs|b6_notif_filter_note/);
    expect(opt).toContain('myNotifyOf(kind)');
    expect(read('src/views/SettingsView.tsx')).toContain('my: myNotifyOf(kind)');
  });
});

describe('E-06, C-14: Cennik i opłaty — symbole, wersje, liczby po polsku, D × S × W', () => {
  const rc = (readOnly: boolean) => html(createElement(RateCard, {
    locale: 'pl', view: demoRateCard(), today: '2026-10-16', nowIso: '2026-10-16T12:00:00Z', readOnly, onSave: async () => true,
  }));
  it('10 symboli w 12 pozycjach (KR — konwój 1, 2 i 3 auta), wersje KSH v2 i SCX v1 od 28.09.2026', () => {
    const v = demoRateCard();
    expect(v.rows).toHaveLength(12);
    expect(new Set(v.rows.map((r) => r.symbol)).size).toBe(10);
    expect(v.rows.filter((r) => r.symbol === 'KR').map((r) => r.convoy)).toEqual([1, 2, 3]);
    const h = rc(false);
    expect(h).toContain('Cennik KSH v2 od 28.09.2026 · cennik SCX v1 od 28.09.2026');
    expect(h).toContain('Koszt SCX · v1');
    expect(h).toContain('Przychód KSH · v2');
  });
  it('kwoty jak w bazie 08.10 (E33) i po polsku; zestaw D × S × W z przecinkiem; bez L/W/H i kropek', () => {
    const h = rc(false);
    const sg = h.slice(h.indexOf('data-rate="SG"'), h.indexOf('data-rate="SS"'));
    expect(sg).toContain('21,69 × 2,45 × 3,75 m');
    expect(sg).toContain('6\u00a0900,00 EUR');
    expect(sg).toContain('7\u00a0245,00 EUR');
    const kr = h.slice(h.indexOf('data-rate="KR-1"'), h.indexOf('data-rate="KR-2"'));
    expect(kr).toContain('12\u00a0745,00 EUR');
    expect(kr).toContain('13\u00a0382,00 EUR');
    expect(kr).toContain('konwój 1 auto');
    expect(h).toContain('Zestaw D × S × W');
    expect(h).not.toMatch(/\bL \d|\bH \d|\d\.\d{1,2} ?(m|EUR)\b/);
    expect(h).toContain('data-deur-exempt="rate-card"');
  });
  it('Administrator HHL: „Nowa wersja cennika”; Operacje (tylko odczyt) — bez przycisku', () => {
    expect(rc(false)).toContain('data-rate-new');
    expect(rc(true)).not.toContain('data-rate-new');
  });
  it('bez noty z kursem demo i „Zapis następuje od razu” (E16, E12)', () => {
    const opt = read('src/views/OptionsView.tsx');
    expect(opt).not.toMatch(/data-fx-note|DEMO_FX_META|RateEditor|opt_rates_note/);
    expect(opt).toContain('<RateCard locale={locale} view={rateCard}');
    expect(rc(false)).not.toMatch(/4,3900|NBP|Zapis następuje od razu/);
  });
  it('demo: dane i zapis z jednego miejsca (`p5bSource.ts`)', () => {
    expect(rateCardOf()?.ksh.v).toBe(2);
    expect(rateCardSaverOf()).toBeTypeOf('function');
  });
});

describe('E-07 … E-15: Zezwolenia, Historia, Stan systemu, Automatyzacje, Strefy, hasło, Wygląd, Terminy', () => {
  it('E-07: stan wymogu zezwoleń zamiast „po Auth”; PL i SE przy transporcie tylko „Trasa” (KR); „Firma” samo', async () => {
    const d = demoBodies('pl', { kind: 'HHL_ADMIN', readOnly: false, mark: null });
    const flag = html(d.bodies.permitsFlag as ReturnType<typeof createElement>);
    expect(flag).toContain('Bez zezwolenia nie ma „Gotowy”: wyłączony · zmiana w System › Przełączniki bezpieczeństwa');
    expect(read('src/views/OptionsView.tsx')).toContain('demo?.bodies.permitsFlag ?? <Soon');
    expect(t('pl', 'opt_acc_perm_soon')).not.toMatch(/Auth/);
    const { ft } = await import('../src/i18n/p5');
    expect(ft('pl', 'p5_terms_req_route')).toBe('wymagany tylko przy „Trasa” (KR)');
    expect(read('src/components/docs/DocTerms.tsx')).toContain("ROUTE_ONLY && PERMITS.includes(r.category) ? ft(locale, 'p5_terms_req_route')");
    expect(t('pl', 'p3c_flag_PERMIT_REQUIRED_NON_STANDARD_fx')).toMatch(/„Trasa” \(KR\)/);
  });
  it('E-08: Historia zmian — filtr „transporty”, wpis „(HHL) jako” i wpis porządków', () => {
    const src = read('src/components/options/demo.tsx');
    expect(src).toContain("areas={['konta', 'ustawienia', 'ceny', 'transporty', 'powiadomienia', 'przełączniki']}");
    expect(src).toContain("who: 'Anna Wiśniewska (HHL) jako Jan Nowak'");
    expect(src).toMatch(/Porządki danych testowych: faktura testowa i 1 pozycja usunięte · kopia zapisana/);
  });
  it('E-10: „Działa samo” — wiatr w ETA 20 / 25 m/s, śliskość do 25 km, sprawa SCX „Objazd czy postój?”', async () => {
    /* F7 #303 D1: liczba i jednostka na twardej spacji — w źródle `\u00a0` */
    const src = read('src/i18n/p4cWf.ts').replace(/\\u00a0/g, ' ');
    expect(src).toMatch(/wiatr w ETA \(od 20 m\/s wolniej, od 25 m\/s postój\), śliskość do 25 km od auta, sprawa SCX „Objazd czy postój\?”/);
  });
  it('E-11: Strefy — bufory odsyłają do zdarzeń „Kto co dostaje”, bez „(Automatyzacje)”', () => {
    const src = read('src/i18n/p8c.ts');
    /* P11 pkt 7 (etap6, CI): liczba i jednostka na twardej spacji — „50 km” nie łamie się na końcu linii */
    expect(src).toContain("p8c_do_PRE_PORT: 'powiadomienie HHL (Kto co dostaje: „Auto 20\\u00a0km przed portem”)'");
    expect(src).toMatch(/p8c_do_PRE_ARRIVAL_PL: '[^']*powiadomienie KSH, SCX \(„Auto 50\\u00a0km przed placem \/ przed Śremem”\)'/);
    expect(src).not.toMatch(/\(Automatyzacje(, E35)?\)/);
  });
  it('E-12: hasło — „Minimum 12 znaków, litery i cyfry”', () => {
    expect(t('pl', 'p3c_m_pw_note')).toMatch(/^Minimum 12 znaków, litery i cyfry\./);
  });
  it('E-13: Wygląd i waluta HHL — opis „Twoje konto” i zdanie o EUR; EUR pierwsze', () => {
    expect(read('src/views/OptionsView.tsx')).toContain('subKey="settings_prefs_sub" noteKey="settings_prefs_note"');
    expect(read('src/components/settings/UiPrefsPanel.tsx')).toContain('<option value="EUR">EUR</option><option value="PLN">PLN</option>');
  });
  it('E-15: „Terminy płatności i adresy” ze stanem „30 / 35 dni” z danych', () => {
    expect(read('src/views/OptionsView.tsx')).toContain('meta: terms ? `${terms.kshDays} / ${terms.scxDays} dni` : undefined');
  });
});
