/**
 * wyglad/P3-c — dane przykładowe ekranów Opcji, TYLKO tryb demo (galeria wyglądu, dowód Z4).
 * Ładowany leniwie z OptionsView/SettingsView przy `VITE_AUTH_MODE !== 'supabase'` — w buildzie produkcyjnym
 * gałąź jest martwa i moduł nie trafia do paczki. Osoby, telefony i adresy są zmyślone (jak na obrazach
 * E6 i E37 „Przykład”); stany przełączników, progi i daty — jak w raporcie E12 (baza 08.10).
 * Na produkcji te same ekrany dostają dane od wykonawcy (dopisek do PR wyglad/P3-c).
 */
import type { Locale } from '../../types';
import type { AccountKind } from './types';
import { WhoGetsScreen } from './WhoGetsScreen';
import { ForMeScreen } from './ForMeScreen';
import type { MatrixCell, MatrixGroup } from './channels';
import { ExportScreen, FlagsScreen, HistoryScreen, ThresholdsScreen, type SecurityFlagRow, type ThresholdRow } from './SystemScreens';
import { AccountScreen, BroadcastScreen, LoginsScreen, UsersScreen, type InviteRow, type PersonRow } from './PeopleScreens';
import type { ReactNode } from 'react';
import { m2 } from '../../i18n/mfa2';

const c = (bell: boolean, push = false, mail = false, fixed?: MatrixCell extends null ? never : NonNullable<MatrixCell>['fixed']): MatrixCell => ({ bell, push, mail, fixed });
const all5 = (cell: MatrixCell): Record<AccountKind, MatrixCell> => ({ HHL_ADMIN: cell, HHL_OPS: cell, CLIENT_USER: cell, CARRIER_DISPATCH: cell, CARRIER_USER: cell });

/** Zaznaczenia przykładowe — obraz E11 („ZAZNACZENIA PRZYKŁADOWE”); wiersz zmiany dat według G-18.
 *  `perDay` — przykładowa liczba zdarzeń na dobę (obraz E11: „Decyzja po terminie” ok. 9 na dobę → 72 e-maile). */
export const DEMO_MATRIX: MatrixGroup[] = [
  {
    id: 'todo', title: 'Do zrobienia', sub: 'wymaga działania', rows: [
      { id: 'dec_new', perDay: 6, title: 'Nowa decyzja do podjęcia', sub: 'trafia do firmy, która ma zdecydować', target: 'Ryzyka › ta decyzja',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true, true), CLIENT_USER: c(true), CARRIER_DISPATCH: c(true, true), CARRIER_USER: c(false) } },
      { id: 'dec_late', perDay: 9, title: 'Decyzja po terminie', sub: 'eskalacja · krytyczne', target: 'Ryzyka › ta decyzja',
        cells: { HHL_ADMIN: c(true, true, true), HHL_OPS: c(true, true, true), CLIENT_USER: c(true), CARRIER_DISPATCH: c(true, true, true), CARRIER_USER: c(false) } },
      { id: 'res_missing', perDay: 3, title: 'Brak kierowcy, pojazdu lub pilota', sub: 'przed terminem podania danych', target: 'Harmonogram › transport',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true, true, true), CARRIER_USER: c(true) } },
      { id: 'order_no', perDay: 4, title: 'Brak numeru zlecenia', sub: 'numer HHL albo przewoźnika', target: 'Harmonogram › transport',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true), CARRIER_USER: c(false) } },
      /* wyglad/P6-e (D-20261016-0310-01 Cz13, D-20261016-0315-01 Cz25): dzwonek i telefon dla 5 rodzajów kont, bez e-maila;
       * odbiorców zawęża zawsze `visible_to` — rozmowa „tylko HHL i SCX” nigdy do KSH */
      { id: 'chat', perDay: 14, title: 'Nowa wiadomość w czacie', sub: 'tylko do firm, które widzą wiadomość · „tylko HHL i SCX” nigdy do KSH, niezależnie od ustawień', target: 'Transport › Czat',
        cells: all5(c(true, true)) },
    ],
  },
  {
    id: 'transport', title: 'Transport', rows: [
      { id: 'status', perDay: 22, title: 'Zmiana statusu transportu', sub: 'załadowany, w drodze, na promie, dostarczony', target: 'Transport › Status', cells: all5(c(true)) },
      { id: 'dates', perDay: 2, title: 'Zmiana dat planu', sub: 'daty załadunku albo rozładunku od KSH', fixedNote: true, target: 'Transport › Historia',
        cells: { HHL_ADMIN: c(true, false, false, ['bell']), HHL_OPS: c(true, false, false, ['bell']), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true, true, false, ['bell']), CARRIER_USER: c(true, false, false, ['bell']) } },
      { id: 'zone', perDay: 30, title: 'Wjazd lub wyjazd ze strefy', sub: 'Śrem, port, Boden · SMS ustawiasz osobno', target: 'Mapa › auto', cells: all5(c(true)) },
    ],
  },
  {
    id: 'risk', title: 'Ryzyka', rows: [
      { id: 'risk_route', perDay: 5, title: 'Ryzyko na trasie przed pojazdem', sub: 'prom jeszcze przed nim, odcinek drogi jeszcze nieminięty · po minięciu znika', target: 'Ryzyka › ta sprawa', cells: all5(c(true)) },
      { id: 'risk_crit', perDay: 1, title: 'Ryzyko podniesione do krytycznego', target: 'Ryzyka › ta sprawa',
        cells: { HHL_ADMIN: c(true, true, true), HHL_OPS: c(true, true), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(true, true), CARRIER_USER: c(true) } },
      { id: 'risk_general', title: 'Sytuacja ogólna: promy, drogi, pogoda', sub: 'bez transportu albo już za pojazdem', risksOnly: true, cells: all5(null) },
    ],
  },
  {
    id: 'money', title: 'Pieniądze', rows: [
      { id: 'week', perDay: 1, title: 'Tydzień zamknięty: faktura do wystawienia', sub: 'SCX wystawia HHL, HHL wystawia KSH', target: 'Faktury',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(false), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
      { id: 'inv_check', perDay: 1, title: 'Faktura do weryfikacji', sub: 'u odbiorcy faktury', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(false), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(false), CARRIER_USER: c(false) } },
      { id: 'inv_dispute', perDay: 1, title: 'Faktura sporna', sub: 'u wystawcy i odbiorcy', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(false), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
      { id: 'factoring', perDay: 1, title: 'Faktoring: wypłata', sub: 'HHL: do wykonania w 48 h · SCX: wykonana', target: 'Faktury',
        cells: { HHL_ADMIN: c(true, true, true), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
    ],
  },
  {
    id: 'system', title: 'System', sub: 'tylko HHL', rows: [
      { id: 'sms_gw', perDay: 1, title: 'Bramka SMS milczy albo SMS niedoręczony', target: 'Opcje › Stan systemu',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'daily', perDay: 1, title: 'Raport dzienny', sub: 'podsumowanie doby', target: 'Kokpit',
        cells: { HHL_ADMIN: c(false, false, true), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
    ],
  },
];

export const DEMO_ACCOUNTS: Record<AccountKind, number> = { HHL_ADMIN: 4, HHL_OPS: 2, CLIENT_USER: 0, CARRIER_DISPATCH: 2, CARRIER_USER: 0 };

/** 13 przełączników — nazwy i zdania z obrazu E12, stany i ostatnie zmiany z bazy 08.10. */
export const DEMO_FLAGS: SecurityFlagRow[] = [
  { key: 'EXTERNAL_MESSAGING', on: false, when: '02.10, 18:43', by: null },
  { key: 'MFA_HHL_ADMIN', on: false, when: '27.09, 21:25', by: null },
  { key: 'PERMIT_REQUIRED_NON_STANDARD', on: false, when: '05.10, 19:38', by: 'Administrator HHL' },
  { key: 'SMS_ZONE_APPROACH', on: true, when: '01.10, 23:01', by: null },
  { key: 'SMS_ZONE_ENTER', on: true, when: '01.10, 23:01', by: null },
  { key: 'AUTOMATIC_DECISION_EMAIL', on: true, when: '04.10, 17:36', by: null },
  { key: 'TELM_EMTRACK_WEB', on: true, when: '05.10, 13:18', by: null },
  { key: 'DRIVER_LINK_ACCEPT', on: false, when: '03.10, 23:52', by: null },
  { key: 'FUEL_SE_PL_INGEST', on: true, when: '05.10, 11:07', by: null },
  { key: 'FUEL_WOB_INGEST', on: false, when: '28.09, 09:58', by: null },
];

/** Wartości progów z bazy 08.10 (E12 „Fakty”; cisza GPS według E12-3: 30 min w ruchu). */
export const DEMO_THRESHOLDS: ThresholdRow[] = [
  { key: 'WAVE_M', value: 3.8, unit: 'm' },
  { key: 'GUST_KN', value: 40, unit: 'węzłów' },
  { key: 'DELAY_MIN', value: 30, unit: 'min' },
  { key: 'LEAD_DAYS', value: 5, unit: 'dni' },
  { key: 'AWIZ_EARLY_H', value: 48, unit: 'h' },
  { key: 'AWIZ_LATE_H', value: 12, unit: 'h' },
  { key: 'DOC_WARN_H', value: 24, unit: 'h' },
  { key: 'DOC_CRIT_H', value: 6, unit: 'h' },
  { key: 'SILENT_MIN', value: 30, unit: 'min' },
  { key: 'OFFROUTE_KM', value: 2, unit: 'km' },
  /* wyglad/E49 — wiatr i śliskość (decyzja 16.10.2026, 02:08; D-20261016-0230-01 Z1 pkt 5, Z4) */
  { key: 'WIND_SLOW_MS', value: 20, unit: 'm/s' },
  { key: 'WIND_CROSS_PCT', value: 15, unit: '%' },
  { key: 'WIND_HEAD_PCT', value: 5, unit: '%' },
  { key: 'WIND_HOLD_MS', value: 25, unit: 'm/s' },
  { key: 'WIND_RESUME_MS', value: 20, unit: 'm/s' },
  { key: 'WIND_RESUME_MIN', value: 30, unit: 'min' },
  { key: 'SLIP_RADIUS_KM', value: 25, unit: 'km' },
  { key: 'SLIP_PCT', value: 15, unit: '%' },
];

const PEOPLE: PersonRow[] = [
  { id: 'p1', name: 'Anna Wiśniewska', mail: 'a.wisniewska@…', kind: 'HHL_ADMIN', phone: '+48 600 000 010', last: 'dziś, 08:12', mfa: true, self: true },
  { id: 'p2', name: 'Marek Lis', mail: 'm.lis@…', kind: 'HHL_OPS', phone: '+48 600 000 003', last: 'dziś, 07:55', mfa: false },
  { id: 'p3', name: 'Piotr Zając', mail: 'p.zajac@…', kind: 'CLIENT_USER', phone: null, last: '06.10, 16:40', mfa: false },
  { id: 'p4', name: 'Jan Nowak', mail: 'j.nowak@…', kind: 'CARRIER_DISPATCH', phone: '+48 600 000 001', last: 'dziś, 06:30', mfa: false },
  { id: 'p5', name: 'Ewa Kowal', mail: 'e.kowal@…', kind: 'CARRIER_DISPATCH', phone: '+48 600 000 002', last: '05.10, 11:09', mfa: false },
];

const INVITES: InviteRow[] = [
  { id: 'i1', name: 'Dyspozytor SCX', kind: 'CARRIER_DISPATCH', domain: 'scandinavian.com.pl', line: 'link otwarty 29.09, hasła nie ustawił · 0 aktywnych sesji', status: 'unfinished' },
  { id: 'i2', name: 'Anna Nowak', kind: 'CLIENT_USER', line: 'zaproszenie wysłane 09.10, 10:15 · ważne do 16.10 · e-mail doręczony', status: 'sent' },
  { id: 'i3', name: 'Jan Kowalski', kind: 'CARRIER_USER', line: 'zaproszenie z 01.10 wygasło 08.10', status: 'expired' },
  { id: 'i4', name: 'Operacje HHL', kind: 'HHL_OPS', domain: 'hhlogistics.pl', line: 'aktywne · ostatnie logowanie 05.10 · bez imienia i telefonu', status: 'nophone' },
];

export type DemoBodies = {
  bodies: Partial<Record<string, ReactNode>>;
  meta: Partial<Record<string, { meta?: string; tone?: 'muted' | 'alert' }>>;
  summaries: Partial<Record<string, { text: string; tone?: 'muted' | 'alert' }>>;
};

/** Ekrany w trybie demo. `mark` — oznaczenie danych przykładowych (DemoMark). `kind` — rodzaj konta osoby. */
export function demoBodies(locale: Locale, opts: { kind: AccountKind; readOnly: boolean; mark: ReactNode; prefs?: ReactNode }): DemoBodies {
  const { kind, readOnly, mark } = opts;
  const me = PEOPLE.find((p) => p.kind === kind) ?? PEOPLE[0];
  const [first, ...rest] = me.name.split(' ');
  return {
    bodies: {
      users: <UsersScreen locale={locale} counts={{ total: 14, active: 12, withPhone: 0, named: 7, noPassword: 8 }} people={PEOPLE} invites={INVITES} readOnly={readOnly} mark={mark} />,
      logins: (
        <LoginsScreen
          locale={locale}
          mark={mark}
          rows={[
            { id: 'l1', when: 'dziś, 08:12', who: 'Anna Wiśniewska', kind: 'HHL_ADMIN', ok: true, where: 'Chrome · Windows' },
            { id: 'l2', when: 'dziś, 07:55', who: 'Marek Lis', kind: 'HHL_OPS', ok: true, where: 'Safari · iPhone' },
            { id: 'l3', when: 'dziś, 07:51', who: 'm.lis@…', kind: null, ok: false, where: 'Safari · iPhone' },
            { id: 'l4', when: 'dziś, 06:30', who: 'Jan Nowak', kind: 'CARRIER_DISPATCH', ok: true, where: 'Chrome · Android' },
            { id: 'l5', when: '06.10, 16:40', who: 'Piotr Zając', kind: 'CLIENT_USER', ok: true, where: 'Edge · Windows' },
          ]}
        />
      ),
      who: (
        <WhoGetsScreen
          locale={locale}
          groups={DEMO_MATRIX}
          accounts={DEMO_ACCOUNTS}
          readOnly={readOnly}
          mark={mark}
          cards={{ mail: { on: true, used: 23, max: 90, reserve: 10 }, push: { on: true, devices: 1 }, last: { when: '05.10, 12:10', text: 'Administrator HHL · System → HHL: e-mail wyłączony' } }}
          history={{ n: 4, since: '01.10', last: '05.10, 12:10' }}
        />
      ),
      bcast: (
        <BroadcastScreen
          locale={locale}
          readOnly={readOnly}
          mark={mark}
          draft={{ text: 'Prom Stena Estelle 09.10 wypływa o 10:00 zamiast 08:00. Awizacje bez zmian.', firms: ['HHL', 'KSH', 'SCX'], until: '2026-10-09T12:00' }}
          history={[
            { id: 'b1', when: '01.10, 22:04', who: 'Administrator HHL', text: 'Witamy w Watch Tower. To jest komunikat testowy.', line: 'HHL, KSH, SCX · zdjęty 02.10, 14:50', test: true },
            { id: 'b2', when: '01.10, 22:03', who: 'Administrator HHL', text: 'Witamy w Watch Tower…', line: 'zdjęty po 5 s', test: true },
          ]}
        />
      ),
      thr: <ThresholdsScreen locale={locale} rows={DEMO_THRESHOLDS} readOnly={readOnly} mark={mark} />,
      /* wyglad/2fa: wymaganie 2FA dla administratorów — dopiero przy 2FA na dwóch urządzeniach (I-17) */
      flags: <FlagsScreen locale={locale} flags={DEMO_FLAGS} readOnly={readOnly} mark={mark} blocked={{ MFA_HHL_ADMIN: m2('m2_flag_blocked_two') }} />,
      hist: (
        <HistoryScreen
          locale={locale}
          mark={mark}
          techCount={2713}
          range={{ from: '2026-10-01', to: '2026-10-08' }}
          people={['Administrator HHL', 'Operacje HHL', 'System // Watch Tower']}
          areas={['konta', 'ustawienia', 'ceny', 'powiadomienia', 'przełączniki']}
          entries={[
            { id: 'h1', when: '07.10, 14:10', who: 'Administrator HHL', text: 'Zaproszenie: nowe konto Operacje HHL' },
            { id: 'h2', when: '07.10, 14:08', who: 'Administrator HHL', text: 'Konto włączone' },
            { id: 'h3', when: '06.10, 16:02', who: 'Administrator HHL', text: 'Cennik KSH: wersja 2 · „Poprawa cen do pełnej liczby”' },
            { id: 'h4', when: '05.10, 19:38', who: 'Administrator HHL', text: 'Bez zezwolenia nie ma „Gotowy”', was: 'włączony', is: 'wyłączony' },
          ]}
        />
      ),
      export: (
        <ExportScreen
          locale={locale}
          kinds={readOnly ? ['loads', 'risks', 'fin'] : ['loads', 'hist', 'risks', 'fin']}
          range={{ from: '2026-10-01', to: '2026-10-08' }}
          fileName={(k) => `WatchTower_${k === 'loads' ? 'Transporty' : k === 'hist' ? 'Historia' : k === 'risks' ? 'Sprawy' : 'Finanse'}_01.10–08.10.xlsx`}
        />
      ),
      account: (
        <AccountScreen
          locale={locale}
          mark={mark}
          me={{ first: first ?? '', last: rest.join(' '), phone: me.phone ?? '', mail: me.mail, kind, lastLogin: me.last }}
          mfa={me.mfa}
          mfaDevices={me.mfa ? [{ id: 'f1', name: 'Telefon 1', since: '12.10.2026' }] : undefined}
          mfaCode
          onMfaAdd={() => undefined}
          onMfaRemove={() => undefined}
          devices={[
            { id: 'd1', name: 'Chrome · Windows', last: 'dziś, 08:12', push: false, current: true },
            { id: 'd2', name: 'Safari · iPhone', last: 'wczoraj, 19:40', push: true, current: false },
          ]}
        />
      ),
      forme: <ForMeScreen locale={locale} kind={kind} groups={DEMO_MATRIX} mark={mark}>{opts.prefs}</ForMeScreen>,
    },
    meta: {
      users: { meta: '12 aktywnych' },
      zones: { meta: 'Boden: brak', tone: 'alert' },
      rates: { meta: 'KSH v2 · SCX v1' },
      fuel: { meta: '× 1,13' },
      fact: { meta: '1 %' },
      permits: { meta: 'wył.' },
      status: { meta: '1 problem', tone: 'alert' },
    },
    summaries: {
      people: { text: '14 kont · 0 z telefonem', tone: 'alert' },
      notify: { text: 'SMS przy miejscach: Boden brak' },
      money: { text: 'Cennik KSH v2 · paliwo × 1,13' },
      rules: { text: '10 progów · wymóg zezwoleń wył.' },
      system: { text: '1 źródło nie działa · 13 przełączników', tone: 'alert' },
      forme: { text: 'motyw, waluta, 2FA' },
    },
  };
}
