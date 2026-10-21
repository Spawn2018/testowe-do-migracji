/**
 * C3 — katalog „Kto co dostaje” na produkcji (te same wiersze co macierz w bazie).
 * KSH nie ma stref ani „Brak CMR” (D-20261016-1750-01 pkt 3.5). Wygląd demo zostaje w `demo.tsx`.
 */
import type { AccountKind } from '../components/options/types';
import type { MatrixCell, MatrixGroup } from '../components/options/channels';

const c = (bell: boolean, push = false, mail = false, fixed?: NonNullable<MatrixCell>['fixed']): MatrixCell =>
  ({ bell, push, mail, ...(fixed ? { fixed } : {}) });
const all5 = (cell: MatrixCell): Record<AccountKind, MatrixCell> =>
  ({ HHL_ADMIN: cell, HHL_OPS: cell, CLIENT_USER: cell, CARRIER_DISPATCH: cell, CARRIER_USER: cell });

export const NOTIFY_CATALOG: MatrixGroup[] = [
  {
    id: 'todo', title: 'Do zrobienia', sub: 'wymaga działania', rows: [
      { id: 'dec_new', title: 'Nowa decyzja do podjęcia', sub: 'trafia do firmy, która ma zdecydować', target: 'Ryzyka › ta decyzja',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true, true), CLIENT_USER: c(true), CARRIER_DISPATCH: c(true, true), CARRIER_USER: c(false) } },
      { id: 'dec_late', title: 'Decyzja po terminie', sub: 'eskalacja · krytyczne', target: 'Ryzyka › ta decyzja',
        cells: { HHL_ADMIN: c(true, true, true), HHL_OPS: c(true, true, true), CLIENT_USER: c(true), CARRIER_DISPATCH: c(true, true, true), CARRIER_USER: c(false) } },
      { id: 'res_missing', title: 'Brak kierowcy, pojazdu lub pilota', sub: 'przed terminem podania danych', target: 'Harmonogram › transport',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true, true, true), CARRIER_USER: c(true) } },
      { id: 'order_no', title: 'Brak numeru zlecenia', sub: 'numer HHL albo przewoźnika', target: 'Harmonogram › transport',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true), CARRIER_USER: c(false) } },
      { id: 'chat', title: 'Nowa wiadomość w czacie', sub: 'tylko do firm, które widzą wiadomość · „tylko HHL i SCX” nigdy do KSH, niezależnie od ustawień', target: 'Transport › Czat',
        cells: all5(c(true, true)) },
      { id: 'cmr', title: 'Brak CMR', sub: 'zadanie przewoźnika — KSH nic nie dostaje', target: 'Transport › Dokumenty',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: null, CARRIER_DISPATCH: c(true), CARRIER_USER: c(true) } },
      { id: 'scx_detour', title: 'Decyzja SCX: objazd albo postój', sub: 'zamknięty most albo droga przed autem · SCX wybrał, ETA liczy wybór', target: 'Transport › Historia',
        cells: { HHL_ADMIN: c(true, true), HHL_OPS: c(true, true), CLIENT_USER: c(false), CARRIER_DISPATCH: null, CARRIER_USER: null } },
    ],
  },
  {
    id: 'transport', title: 'Transport', rows: [
      { id: 'status', title: 'Zmiana statusu transportu', sub: 'załadowany, w drodze, na promie, dostarczony', target: 'Transport › Status', cells: all5(c(true)) },
      { id: 'dates', title: 'Zmiana dat planu', sub: 'daty załadunku albo rozładunku od KSH', fixedNote: true, target: 'Transport › Historia',
        cells: { HHL_ADMIN: c(true, false, false, ['bell']), HHL_OPS: c(true, false, false, ['bell']), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true, true, false, ['bell']), CARRIER_USER: c(true, false, false, ['bell']) } },
      { id: 'zone', title: 'Wjazd lub wyjazd ze strefy', sub: 'Śrem, port, Boden · SMS ustawiasz osobno · KSH nie dostaje', target: 'Mapa › auto',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: null, CARRIER_DISPATCH: c(true), CARRIER_USER: c(true) } },
      { id: 'pre_arrival_site', title: 'Auto 50 km przed placem', sub: 'bufor 50 km przed Boden', target: 'Mapa › auto',
        cells: { HHL_ADMIN: c(false), HHL_OPS: c(false), CLIENT_USER: c(true), CARRIER_DISPATCH: c(true), CARRIER_USER: c(false) } },
      { id: 'pre_arrival_srem', title: 'Auto 50 km przed Śremem', sub: 'bufor 50 km przed Śremem', target: 'Mapa › auto',
        cells: { HHL_ADMIN: c(false), HHL_OPS: c(false), CLIENT_USER: c(true), CARRIER_DISPATCH: c(true), CARRIER_USER: c(false) } },
      { id: 'pre_port', title: 'Auto 20 km przed portem', sub: 'bufor 20 km przed Gdańskiem albo Gdynią', target: 'Mapa › auto',
        cells: { HHL_ADMIN: c(true), HHL_OPS: c(true), CLIENT_USER: c(false), CARRIER_DISPATCH: c(false), CARRIER_USER: c(false) } },
    ],
  },
  {
    id: 'risk', title: 'Ryzyka', rows: [
      { id: 'risk_route', title: 'Ryzyko na trasie przed pojazdem', sub: 'prom jeszcze przed nim, odcinek drogi jeszcze nieminięty · po minięciu znika', target: 'Ryzyka › ta sprawa', cells: all5(c(true)) },
      { id: 'risk_crit', title: 'Ryzyko podniesione do krytycznego', target: 'Ryzyka › ta sprawa',
        cells: { HHL_ADMIN: c(true, true, true), HHL_OPS: c(true, true), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(true, true), CARRIER_USER: c(true) } },
      { id: 'risk_general', title: 'Sytuacja ogólna: promy, drogi, pogoda', sub: 'bez transportu albo już za pojazdem', risksOnly: true, cells: all5(null) },
    ],
  },
  {
    id: 'money', title: 'Pieniądze', rows: [
      { id: 'week', title: 'Tydzień zamknięty: faktura do wystawienia', sub: 'SCX wystawia HHL, HHL wystawia KSH', target: 'Faktury',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(false), CLIENT_USER: c(false), CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
      { id: 'inv_check', title: 'Faktura do weryfikacji', sub: 'u odbiorcy faktury', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(false), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(false), CARRIER_USER: c(false) } },
      { id: 'inv_dispute', title: 'Faktura sporna', sub: 'u wystawcy i odbiorcy', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(false), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
      { id: 'inv_overdue', title: 'Faktura nieopłacona po terminie', sub: 'raz na fakturę · tylko HHL · sprawa znika po „Opłacona” albo sporze', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'inv_updated', title: 'Faktura zmieniona przez wystawcę', sub: 'przed akceptacją · dzwonek i e-mail u odbiorcy', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
      { id: 'inv_corrected', title: 'Faktura poprawiona przez Administratora HHL', sub: 'po akceptacji albo korekta HHL na fakturze SCX', target: 'Faktury › ta faktura',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true), CLIENT_USER: c(true, false, true), CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
      { id: 'factoring', title: 'Faktoring: wypłata', sub: 'HHL: do wykonania w 48 h · SCX: wykonana', target: 'Faktury',
        cells: { HHL_ADMIN: c(true, true, true), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: c(true, false, true), CARRIER_USER: c(false) } },
    ],
  },
  {
    id: 'system', title: 'System', sub: 'tylko HHL', rows: [
      { id: 'sms_gw', title: 'Bramka SMS milczy albo SMS niedoręczony', sub: 'SMS niewysłany w 10 min · e-mail do Operacji HHL', target: 'Opcje › Stan systemu',
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true, false, true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'src_down', title: 'Źródło danych nie działa', sub: 'przy awarii, przypomnienie po 2 h · Administrator HHL: e-mail i telefon zawsze', target: 'Opcje › Stan systemu',
        cells: { HHL_ADMIN: c(true, true, true, ['push', 'mail']), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'src_back', title: 'Źródło danych wróciło', sub: 'po awarii · Administrator HHL: e-mail i telefon zawsze', target: 'Opcje › Stan systemu',
        cells: { HHL_ADMIN: c(true, true, true, ['push', 'mail']), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'app_err', title: 'Błąd aplikacji', sub: 'nowy błąd 3 razy albo u 2 osób w 1 h · Administrator HHL: e-mail i telefon zawsze', target: 'Opcje › Stan systemu › Błędy aplikacji',
        cells: { HHL_ADMIN: c(true, true, true, ['push', 'mail']), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'daily', title: 'Raport dzienny', sub: 'podsumowanie doby', target: 'Kokpit',
        cells: { HHL_ADMIN: c(false, false, true), HHL_OPS: c(false), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      /* audyt-teksty (e): klucze z migracji 0255 (#406) — do jej wdrożenia `pendingDb` (bez wiersza w bazie ekran ich nie pokazuje) */
      { id: 'workflow', title: 'Alert automatyzacji (reguła zgłosiła problem)', sub: 'reguła z kreatora w Automatyzacjach', target: 'Automatyzacje', pendingDb: true,
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true, false, true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'email_budget', title: 'Limit maili wyczerpany / bliski limitu', sub: 'dzienny limit wysyłki e-maili', target: 'Opcje › Stan systemu', pendingDb: true,
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true, false, true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'fuel_miss', title: 'Brak odczytu ceny paliwa (OKQ8 / Orlen)', sub: 'opłata paliwowa liczy się z ostatniego odczytu', target: 'Opcje › Cennik', pendingDb: true,
        cells: { HHL_ADMIN: c(true, false, true), HHL_OPS: c(true), CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
      { id: 'ext_mail', title: 'Maile do adresów spoza aplikacji (np. księgowość)', sub: 'tylko e-mail · tylko Administrator HHL', pendingDb: true,
        cells: { HHL_ADMIN: c(false, false, true), HHL_OPS: null, CLIENT_USER: null, CARRIER_DISPATCH: null, CARRIER_USER: null } },
    ],
  },
];

/** Zdarzenia, które są już w macierzy w bazie (bez czekających na migrację — `pendingDb`). */
export const NOTIFY_EVENT_IDS: readonly string[] = NOTIFY_CATALOG.flatMap((g) => g.rows.filter((r) => !r.pendingDb).map((r) => r.id));

/** „Co dostaję” (zapis `my_notify_set`): bez zdarzeń, których baza jeszcze nie zna (migracja niewdrożona). */
export const NOTIFY_CATALOG_READY: MatrixGroup[] = NOTIFY_CATALOG.map((g) => ({ ...g, rows: g.rows.filter((r) => !r.pendingDb) }));
