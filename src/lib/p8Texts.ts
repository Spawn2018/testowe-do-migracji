/**
 * wyglad/P8-a — Opcje › Powiadomienia › Treści wiadomości (E43, decyzje 07.10.2026, 22:42; img/e43-after).
 * Spis wiadomości (4 SMS z E42, 28 rodzajów e-maili i wpisów w dzwonku, 2 e-maile paczki do księgowości z E40,
 * 5 e-maili logowania; wyglad/audyt-E: + 6 nowych zdarzeń z „Kto co dostaje” — E35, E49, E23, E46), klocki danych,
 * treści domyślne („Nowe domyślne” E43: kod transportu zamiast wewnętrznego numeru, nazwa miejsca w SMS, konkret i link),
 * zapis klocków jako znaczników `{{id}}` (administrator ich nie widzi), podgląd i licznik SMS bez polskich liter.
 * Czyste funkcje widoku — bez zapytań i zapisów.
 */
import type { Load } from '../types';
import { formatCalendarDay } from './time';

export type MsgChannel = 'SMS' | 'EMAIL' | 'LOGIN';
export type MsgGroup = 'zone' | 'risk' | 'load' | 'inv' | 'sys' | 'login';

export type TokenId =
  | 'code' | 'order' | 'trailer' | 'tractor' | 'place' | 'dwell' | 'arrival' | 'planDate' | 'loadDate' | 'link'
  | 'riskName' | 'severity' | 'decision' | 'due' | 'outcome' | 'author' | 'message' | 'statusFrom' | 'statusTo' | 'time'
  | 'side' | 'missing' | 'ruleName' | 'detail' | 'invoiceNo' | 'amount' | 'reason' | 'policyNo' | 'recipients'
  | 'source' | 'date' | 'count' | 'name' | 'firm' | 'account' | 'inviter' | 'validity' | 'button'
  | 'road' | 'transports' | 'week' | 'loadWeek' | 'queued' | 'limit' | 'carrier' | 'codes' | 'reminder'
  | 'loadDateBefore' | 'planDateBefore' | 'site' | 'placeTo'
  | 'port' | 'closure' | 'choice' | 'feed' | 'since' | 'effect' | 'error' | 'times' | 'people' | 'page';

/** Fragment treści: zwykły tekst albo klocek danych. */
export type Seg = { k: 'txt'; v: string } | { k: 'tok'; id: TokenId };

export interface MsgItem {
  id: string;
  group: MsgGroup;
  channel: MsgChannel;
  /** nazwa na liście */
  name: string;
  /** kto dostaje — jedno zdanie pod tytułem (odbiorców ustawia się w „Kto co dostaje”, E11) */
  to: string;
  tokens: TokenId[];
  /** e-mail: temat (= tytuł w dzwonku); SMS — brak */
  subject?: string;
  body: string;
  /** przycisk logowania obowiązkowy (E43: bez niego zapis zablokowany) */
  needsButton?: boolean;
  /** napis na przycisku w e-mailu logowania */
  buttonLabel?: string;
  /** tylko e-mail, bez wpisu w dzwonku (paczka do księgowości, E40) */
  noBell?: boolean;
  /**
   * wyglad/audyt-E (E-03): nowe zdarzenie z „Kto co dostaje” — treść domyślna jest tu, w widoku; rodzaj w
   * `notifyTemplates.ts` i w bazie (macierz, treści E43) dopisuje wykonawca (D-01). Po dopisaniu znacznik znika.
   */
  planned?: boolean;
}

export const TOKEN_LABEL: Record<TokenId, string> = {
  code: 'Kod transportu', order: 'Nr zlecenia', trailer: 'Rejestracja naczepy', tractor: 'Rejestracja ciągnika',
  place: 'Miejsce', dwell: 'Godzina postoju', arrival: 'Godzina przyjazdu', planDate: 'Data planu', loadDate: 'Data załadunku',
  link: 'Link do transportu', riskName: 'Nazwa ryzyka', severity: 'Waga', decision: 'Sprawa', due: 'Termin', outcome: 'Wynik',
  author: 'Kto', message: 'Treść wiadomości', statusFrom: 'Status przed', statusTo: 'Status po', time: 'Godzina',
  side: 'Czyj numer', missing: 'Czego brakuje', ruleName: 'Nazwa reguły', detail: 'Opis',
  invoiceNo: 'Numer faktury', amount: 'Kwota', reason: 'Powód', policyNo: 'Numer polisy', recipients: 'Odbiorcy',
  source: 'Źródło', date: 'Data', count: 'Liczba transportów', name: 'Imię i nazwisko', firm: 'Firma',
  account: 'Rodzaj konta', inviter: 'Kto zaprasza', validity: 'Ważność linku', button: 'Przycisk z linkiem',
  road: 'Droga', transports: 'Lista transportów', week: 'Tydzień', loadWeek: 'Tydzień załadunków', queued: 'SMS w kolejce',
  limit: 'Limit na dobę', carrier: 'Przewoźnik', codes: 'Kody transportów', reminder: 'Ile do terminu',
  loadDateBefore: 'Załadunek przed zmianą', planDateBefore: 'Dostawa przed zmianą', site: 'Śrem albo Boden',
  placeTo: 'Miejsce (wjazd na …)',
  port: 'Port', closure: 'Co zamknięte', choice: 'Wybór SCX', feed: 'Źródło danych', since: 'Od kiedy', effect: 'Skutek',
  error: 'Treść błędu', times: 'Ile razy', people: 'Ile osób', page: 'Strona',
};

const SMS_T: TokenId[] = ['code', 'trailer', 'tractor', 'place', 'placeTo', 'dwell', 'arrival', 'planDate', 'link'];
const RISK_T: TokenId[] = ['code', 'order', 'riskName', 'severity', 'loadDate', 'planDate', 'link'];
const DEC_T: TokenId[] = ['decision', 'due', 'transports', 'outcome', 'author', 'link'];
const LOAD_T: TokenId[] = ['code', 'order', 'loadDate', 'planDate', 'author', 'link'];
const ZONE_T: TokenId[] = ['code', 'order', 'place', 'time', 'link'];
const INV_T: TokenId[] = ['invoiceNo', 'week', 'amount', 'due', 'link'];
const PACK_T: TokenId[] = ['week', 'invoiceNo', 'amount', 'count', 'codes'];
const LOGIN_T: TokenId[] = ['name', 'firm', 'account', 'inviter', 'validity', 'button'];

const SMS_TO_BOTH = 'Do: odbiorcy w Śremie i Boden z zaznaczonym rodzajem (E42)';
const I = (
  id: string, group: MsgGroup, channel: MsgChannel, name: string, to: string, tokens: TokenId[], body: string, subject?: string,
  extra: Partial<MsgItem> = {},
): MsgItem => ({ id, group, channel, name, to, tokens, body, ...(subject !== undefined ? { subject } : {}), ...extra });

/** Spis wiadomości w kolejności listy (img/e43-after). Odbiorców i kanały ustawia „Kto co dostaje” (E11). */
export const MESSAGES: readonly MsgItem[] = [
  /* SMS: A według L50 (korekta = „korekta - ” + ta sama treść), B–D według E42 (img/e42-after); klocek „Miejsce” w formie
     „przy placu Stegra Boden”, „Miejsce (wjazd na …)” — „plac Stegra Boden” / „teren KSH Śrem” */
  I('SMS_A', 'zone', 'SMS', 'A · Przyjazd za ok. 60 min', SMS_TO_BOTH, SMS_T,
    '{{code}}: auto {{trailer}} będzie przy {{place}} ok. {{arrival}}.'),
  I('SMS_B', 'zone', 'SMS', 'B · Wcześniejszy przyjazd', 'Do: odbiorcy w Boden z zaznaczonym „B” (E42)', SMS_T,
    '{{code}}: auto {{trailer}} będzie przy {{place}} ok. {{arrival}}, dzień przed planem (dostawa {{planDate}}).'),
  I('SMS_C', 'zone', 'SMS', 'C · Auto czeka', 'Do: odbiorcy w Śremie i Boden z zaznaczonym „C” (E42)', SMS_T,
    '{{code}}: auto {{trailer}} stoi przy {{place}} od {{dwell}}. Plan dostawy: {{planDate}}.'),
  I('SMS_D', 'zone', 'SMS', 'D · Wjazd', SMS_TO_BOTH, SMS_T,
    '{{code}}: auto {{trailer}} wjechało na {{placeTo}} o {{arrival}}.'),

  /* E-maile i wpisy w dzwonku — 28 rodzajów z `notifyTemplates.ts` (L53: obecne polskie treści, kod transportu E41,
     daty E21, konkret i link — E43 „Nowe domyślne”); id = rodzaj powiadomienia. */
  I('RISK_OPEN', 'risk', 'EMAIL', 'Nowe ryzyko', '', RISK_T,
    'Waga ryzyka: {{severity}}. Załadunek: {{loadDate}}. Otwórz transport: {{link}}', '{{code}}: nowe ryzyko — {{riskName}}'),
  I('RISK_SEVERITY', 'risk', 'EMAIL', 'Zmiana wagi ryzyka', '', RISK_T,
    'Waga ryzyka: {{severity}}. Załadunek: {{loadDate}}. Otwórz transport: {{link}}', '{{code}}: {{riskName}} — waga {{severity}}'),
  I('RISK_RESOLVED', 'risk', 'EMAIL', 'Ryzyko zamknięte', '', RISK_T,
    'Ryzyko „{{riskName}}” jest zamknięte. Otwórz transport: {{link}}', '{{code}}: ryzyko zamknięte — {{riskName}}'),
  I('ROAD_RISK', 'risk', 'EMAIL', 'Warunki drogowe', '', ['road', 'riskName', 'link'],
    'Zdarzenie drogowe w Szwecji: {{riskName}}. Oryginał jest w panelu, pod przyciskiem „Pokaż oryginał”. Otwórz: {{link}}', 'Warunki drogowe {{road}}: {{riskName}}'),
  I('DECISION_OPEN', 'risk', 'EMAIL', 'Do decyzji', '', DEC_T,
    'Termin: {{due}}. Transporty: {{transports}}. Otwórz sprawę: {{link}}', 'Do decyzji: {{decision}}'),
  I('DECISION_ESCALATED', 'risk', 'EMAIL', 'Decyzja krytyczna', '', DEC_T,
    'Termin minął {{due}}. Transporty: {{transports}}. Otwórz sprawę: {{link}}', 'Decyzja jest teraz krytyczna: {{decision}}'),
  I('DECISION_RESOLVED', 'risk', 'EMAIL', 'Decyzja zamknięta', '', DEC_T,
    'Rozstrzygnięcie: {{outcome}} ({{author}}). Otwórz sprawę: {{link}}', 'Decyzja zamknięta: {{decision}}'),
  I('WORKFLOW_ALERT', 'risk', 'EMAIL', 'Reguła automatyzacji', '', ['code', 'order', 'ruleName', 'detail', 'link'],
    'Reguła „{{ruleName}}” zadziałała dla transportu {{code}}. {{detail}} Otwórz transport: {{link}}', '{{code}}: reguła automatyzacji „{{ruleName}}”'),
  /* wyglad/audyt-E (E-03; E49 16.10, 02:08): wybór SCX przy zamkniętym moście albo drodze */
  I('SCX_DETOUR_CHOICE', 'risk', 'EMAIL', 'Decyzja SCX: objazd albo postój', '', ['code', 'order', 'closure', 'choice', 'author', 'link'],
    'Na trasie: {{closure}}. SCX wybrał: {{choice}} ({{author}}). ETA liczy ten wybór. Otwórz transport: {{link}}',
    '{{code}}: decyzja SCX — {{choice}}'),

  I('LOAD_STATUS_CHANGED', 'load', 'EMAIL', 'Zmiana statusu', '', ['code', 'order', 'statusFrom', 'statusTo', 'time', 'link'],
    'Status: {{statusFrom}} → {{statusTo}} ({{time}}). Otwórz transport: {{link}}', '{{code}}: {{statusTo}}'),
  I('LOAD_CHAT_MESSAGE', 'load', 'EMAIL', 'Czat', '', ['code', 'order', 'author', 'message', 'link'],
    '{{author}}: {{message}} Otwórz czat: {{link}}', 'Czat: {{code}}'),
  I('PLAN_DATES_CHANGED', 'load', 'EMAIL', 'Zmiana dat planu', '', [...LOAD_T, 'loadDateBefore', 'planDateBefore'],
    'Załadunek {{loadDateBefore}} → {{loadDate}}, dostawa {{planDateBefore}} → {{planDate}}. Otwórz transport: {{link}}', '{{code}}: zmiana potwierdzonych dat planu ({{author}})'),
  I('SCHEDULE_DATE_CRITICAL', 'load', 'EMAIL', 'Zmiana daty na awizowanym', '', LOAD_T,
    'Nowy plan: załadunek {{loadDate}}, dostawa {{planDate}}. Sprawdź okno awizacji: {{link}}', '{{code}}: zmiana daty w harmonogramie na awizowanym transporcie'),
  I('ORDER_NO_MISSING', 'load', 'EMAIL', 'Brak numeru zlecenia', '', ['code', 'side', 'due', 'link'],
    'Uzupełnij numer zlecenia przed {{due}}. Otwórz transport: {{link}}', '{{code}}: brak numeru zlecenia {{side}}'),
  I('RESOURCE_DEADLINE', 'load', 'EMAIL', 'Brak danych przed załadunkiem', '', ['code', 'order', 'missing', 'due', 'link'],
    'Uzupełnij przed załadunkiem {{due}}. Otwórz transport: {{link}}', '{{code}}: brak — {{missing}}'),
  I('ZONE_ENTER', 'load', 'EMAIL', 'Wjazd do strefy', '', ZONE_T,
    'Wjazd o {{time}}. Otwórz transport: {{link}}', '{{code}}: wjazd do strefy {{place}}'),
  I('ZONE_EXIT', 'load', 'EMAIL', 'Wyjazd ze strefy', '', ZONE_T,
    'Wyjazd o {{time}}. Otwórz transport: {{link}}', '{{code}}: wyjazd ze strefy {{place}}'),
  /* wyglad/audyt-E (E-03; E35 pkt 2): dawne reguły „Dojazd na plac” i „Wjazd przed port” — zdarzenia w „Kto co dostaje” */
  I('PRE_ARRIVAL', 'load', 'EMAIL', 'Auto 50 km przed placem', '', ['code', 'order', 'trailer', 'site', 'time', 'arrival', 'link'],
    'Auto {{trailer}} jest ok. 50 km przed celem: {{site}} (o {{time}}). Przyjazd ok. {{arrival}}. Otwórz transport: {{link}}',
    '{{code}}: auto 50 km przed celem — {{site}}'),
  I('PRE_PORT', 'load', 'EMAIL', 'Auto 20 km przed portem', '', ['code', 'order', 'trailer', 'port', 'time', 'link'],
    'Auto {{trailer}} jest ok. 20 km przed portem {{port}} (o {{time}}). Otwórz transport: {{link}}',
    '{{code}}: auto 20 km przed portem {{port}}'),

  I('INVOICE_NEW', 'inv', 'EMAIL', 'Nowa faktura', '', INV_T,
    'Faktura {{invoiceNo}} ({{week}}), {{amount}}, termin {{due}}. Otwórz fakturę: {{link}}', 'Nowa faktura {{invoiceNo}} do weryfikacji'),
  I('PAYMENT_REMINDER', 'inv', 'EMAIL', 'Przypomnienie o płatności', '', [...INV_T, 'reminder'],
    'Faktura {{invoiceNo}}, {{amount}}, termin {{due}}. Otwórz fakturę: {{link}}', 'Faktura {{invoiceNo}}: {{reminder}}'),
  I('INVOICE_DISPUTED', 'inv', 'EMAIL', 'Faktura w sporze', '', [...INV_T, 'reason'],
    'Uzasadnienie odbiorcy: {{reason}} Otwórz fakturę: {{link}}', 'Faktura {{invoiceNo}} w sporze'),
  I('INVOICE_DISPUTE_REPLY', 'inv', 'EMAIL', 'Odpowiedź w sporze', '', [...INV_T, 'message'],
    'Treść odpowiedzi: {{message}} Otwórz fakturę: {{link}}', 'Odpowiedź wystawcy w sporze o fakturę {{invoiceNo}}'),
  I('INVOICE_DISPUTE_RESOLVED', 'inv', 'EMAIL', 'Spór zamknięty', '', [...INV_T, 'outcome'],
    'Odbiorca rozstrzygnął spór: {{outcome}}. Otwórz fakturę: {{link}}', 'Spór o fakturę {{invoiceNo}} zamknięty'),
  /* A4 (wyglad/W-faktura-termin): faktura nieopłacona po terminie — raz na fakturę, do HHL; rodzaj w notifyTemplates.ts i w macierzy
     (`inv_overdue`) dopisuje wykonawca (D-20261017-2130-01), wtedy znacznik `planned` znika */
  I('INVOICE_OVERDUE', 'inv', 'EMAIL', 'Faktura po terminie', '', INV_T,
    'Faktura {{invoiceNo}} ({{week}}), {{amount}}: termin płatności {{due}} minął, a faktura nie jest oznaczona jako opłacona. Sprawdź płatność i oznacz fakturę: {{link}}',
    'Faktura {{invoiceNo}} nieopłacona po terminie {{due}}', { planned: true }),
  I('INSURANCE_EXPIRY', 'inv', 'EMAIL', 'Polisa wygasa', '', ['policyNo', 'carrier', 'due', 'link'],
    'Wgraj aktualną polisę przewoźnika w widoku Dokumenty: {{link}}', 'Polisa {{policyNo}} ({{carrier}}) wygasa {{due}}'),
  /* E40 pkt 7: e-mail z paczką tygodnia do księgowości (tylko e-mail, z załącznikami) */
  I('ACCOUNTING_KSH', 'inv', 'EMAIL', 'Paczka do księgowości KSH', 'Do: adresy księgowości KSH (Opcje › Adresy księgowości)', PACK_T,
    'Dzień dobry,\nw załącznikach faktura {{invoiceNo}} ({{amount}} brutto), CMR z podpisem i zestawienie transportów z tygodnia {{week}}.\nTransporty ({{count}}): {{codes}}',
    'Watch Tower — faktura {{invoiceNo}}, tydzień {{week}}', { noBell: true }),
  I('ACCOUNTING_HHL', 'inv', 'EMAIL', 'Paczka do księgowości HHL', 'Do: adresy księgowości HHL (Opcje › Adresy księgowości)', PACK_T,
    'Dzień dobry,\nw załącznikach faktura SCX {{invoiceNo}} ({{amount}} brutto), CMR z podpisem i zestawienie kosztów z tygodnia {{week}}.\nTransporty ({{count}}): {{codes}}',
    'Watch Tower — faktura SCX {{invoiceNo}}, tydzień {{week}}', { noBell: true }),

  /* E42 „Ślad i awaria”: „SMS do Boden (2 osoby) niewysłany: [treść]”; bez „Zadzwoń do kierowcy” (E43) */
  I('SMS_UNDELIVERED', 'sys', 'EMAIL', 'SMS niedoręczony', '', ['code', 'site', 'recipients', 'message', 'link'],
    'SMS do {{site}} ({{recipients}}) wyszedł, ale w ciągu 10 minut nie ma potwierdzenia doręczenia: {{message}} Otwórz transport: {{link}}', '{{code}}: SMS do {{site}} ({{recipients}}) niedoręczony'),
  I('SMS_FALLBACK', 'sys', 'EMAIL', 'SMS niewysłany', '', ['code', 'site', 'recipients', 'message', 'link'],
    'SMS do {{site}} ({{recipients}}) niewysłany: {{message}} Otwórz transport: {{link}}', '{{code}}: SMS do {{site}} ({{recipients}}) niewysłany'),
  I('SMS_GATEWAY_SILENT', 'sys', 'EMAIL', 'Bramka SMS milczy', '', ['time', 'queued', 'link'],
    'Brak sygnału telefonu-bramki od {{time}} (próg 30 min). SMS w kolejce: {{queued}}. Sprawdź zasilanie, Wi-Fi i aplikację bramki. Stan systemu: {{link}}', 'Bramka SMS milczy od {{time}}'),
  I('ZONE_LIMIT', 'sys', 'EMAIL', 'Limit SMS stref', '', ['limit', 'link'],
    'Limit {{limit}} SMS stref na dobę jest wyczerpany. Kolejne wiadomości stref poczekają do następnego dnia. Stan systemu: {{link}}', 'Dzienny limit SMS stref wyczerpany'),
  I('FUEL_READING_MISSING', 'sys', 'EMAIL', 'Brak ceny paliwa', '', ['source', 'date', 'week', 'loadWeek', 'count', 'link'],
    'Brak ceny {{source}} z {{date}} — tydzień {{week}}, wpływa na załadunki {{loadWeek}}, {{count}} transportów. Uzupełnij w Opcjach: {{link}}', 'Brak ceny {{source}} z {{date}}'),
  I('CLIENT', 'sys', 'EMAIL', 'Powiadomienie dla klienta', '', ['firm', 'link'],
    'To powiadomienie dotyczy organizacji klienta {{firm}}. Otwórz: {{link}}', 'Powiadomienie dla organizacji klienta'),
  /* wyglad/audyt-E (E-03; E23 decyzja 1 A, obraz E23): alarm źródła i „Wróciło”; E46: błąd aplikacji */
  I('SOURCE_DOWN', 'sys', 'EMAIL', 'Źródło danych nie działa', '', ['feed', 'since', 'effect', 'link'],
    '{{feed}} nie działa od {{since}}. Skutek: {{effect}}. Przypomnienie po 2 h, jeśli nie wróci. Stan systemu: {{link}}',
    '{{feed}} nie działa od {{since}}'),
  I('SOURCE_BACK', 'sys', 'EMAIL', 'Źródło danych wróciło', '', ['feed', 'since', 'time', 'link'],
    '{{feed}} działa znowu od {{time}}. Przerwa trwała od {{since}}. Stan systemu: {{link}}',
    'Wróciło: {{feed}}'),
  I('APP_ERROR', 'sys', 'EMAIL', 'Błąd aplikacji', '', ['error', 'times', 'people', 'page', 'time', 'link'],
    'Błąd „{{error}}”: {{times}} razy, u {{people}} osób, ostatnio o {{time}}, strona {{page}}. Błędy aplikacji: {{link}}',
    'Błąd aplikacji: {{error}}'),

  I('INVITE', 'login', 'LOGIN', 'Zaproszenie', 'Do: osoba zaproszona w Użytkownikach', LOGIN_T,
    'Dzień dobry,\n{{inviter}} zaprasza do Watch Tower — systemu kontroli transportów Śrem → Boden.\nOsoba: {{name}} · Firma: {{firm}} · Konto: {{account}}\n{{button}}\nLink jest ważny {{validity}}.',
    'Watch Tower — zaproszenie · {{name}}', { needsButton: true, buttonLabel: 'Dołącz' }),
  I('RECOVERY', 'login', 'LOGIN', 'Reset hasła', 'Do: osoba, która kliknęła „Nie pamiętam hasła”', LOGIN_T,
    'Dzień dobry,\nustaw nowe hasło do Watch Tower.\n{{button}}\nLink jest ważny {{validity}}. Jeśli to nie Ty, zignoruj tę wiadomość.',
    'Watch Tower — reset hasła', { needsButton: true, buttonLabel: 'Ustaw hasło' }),
  I('MAGIC', 'login', 'LOGIN', 'Link logowania', 'Do: osoba, która poprosiła o link', LOGIN_T,
    'Dzień dobry,\nzaloguj się do Watch Tower przyciskiem poniżej.\n{{button}}\nLink jest ważny {{validity}}.',
    'Watch Tower — link logowania', { needsButton: true, buttonLabel: 'Zaloguj się' }),
  I('CONFIRM', 'login', 'LOGIN', 'Potwierdzenie adresu', 'Do: nowe konto', LOGIN_T,
    'Dzień dobry,\npotwierdź adres e-mail konta {{name}} w Watch Tower.\n{{button}}\nLink jest ważny {{validity}}.',
    'Watch Tower — potwierdź adres e-mail', { needsButton: true, buttonLabel: 'Potwierdź adres' }),
  I('EMAIL_CHANGE', 'login', 'LOGIN', 'Zmiana e-maila', 'Do: nowy adres e-mail konta', LOGIN_T,
    'Dzień dobry,\npotwierdź zmianę adresu e-mail konta {{name}} w Watch Tower.\n{{button}}\nLink jest ważny {{validity}}.',
    'Watch Tower — zmiana adresu e-mail', { needsButton: true, buttonLabel: 'Potwierdź zmianę' }),
];

export const GROUP_LABEL: Record<MsgGroup, string> = {
  zone: 'SMS do Śremu i Boden (E42)', risk: 'Ryzyka i decyzje', load: 'Transport', inv: 'Faktury', sys: 'System', login: 'Logowanie',
};
/** Napis kanału przy pozycji i w nagłówku edytora (bez obiektu z kluczem „SMS:”, strażnik I-2 szuka „sms:”). */
export function channelLabel(c: MsgChannel): string {
  return c === 'SMS' ? 'SMS' : 'E-mail';
}

export const GROUPS: readonly MsgGroup[] = ['zone', 'risk', 'load', 'inv', 'sys', 'login'];

/* ---------- znaczniki ↔ fragmenty ---------- */

const TOKEN_IDS = new Set(Object.keys(TOKEN_LABEL));

/** A4 (wyglad/W-faktura-termin): wiadomości o fakturze prowadzą do faktury (`/finanse/faktury/<id>`, `clickTargets.ts`), nie do transportu.
 *  „Polisa wygasa” jest w tej samej grupie, ale prowadzi do sprawy — zostaje „Link do transportu” (F7). */
export const INVOICE_LINK_IDS: ReadonlySet<string> = new Set([
  'INVOICE_NEW', 'PAYMENT_REMINDER', 'INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED', 'INVOICE_OVERDUE',
]);
export const INVOICE_LINK_SAMPLE = 'tower.log-mar.pl/#/finanse/faktury/FV-12-10-2026';
/** Termin płatności przykładowej faktury „FV 12/10/2026” (t41): wystawiona 12.10, 30 dni. */
export const INVOICE_DUE_SAMPLE = '11.11.2026';
export function tokenLabelIn(id: TokenId, msgId?: string): string {
  return id === 'link' && !!msgId && INVOICE_LINK_IDS.has(msgId) ? 'Link do faktury' : TOKEN_LABEL[id];
}

/** „{{code}}: auto …” → fragmenty. Nieznany znacznik zostaje tekstem. */
export function parseMarkers(s: string): Seg[] {
  const out: Seg[] = [];
  const re = /\{\{([a-zA-Z]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (!TOKEN_IDS.has(m[1]!)) continue;
    if (m.index > last) out.push({ k: 'txt', v: s.slice(last, m.index) });
    out.push({ k: 'tok', id: m[1] as TokenId });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ k: 'txt', v: s.slice(last) });
  return normalize(out);
}

export function toMarkers(segs: readonly Seg[]): string {
  return segs.map((x) => (x.k === 'txt' ? x.v : `{{${x.id}}}`)).join('');
}

/** Sklejone sąsiednie teksty, bez pustych. */
export function normalize(segs: readonly Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const x of segs) {
    if (x.k === 'txt') {
      if (!x.v) continue;
      const prev = out[out.length - 1];
      if (prev && prev.k === 'txt') out[out.length - 1] = { k: 'txt', v: prev.v + x.v };
      else out.push({ k: 'txt', v: x.v });
    } else out.push(x);
  }
  return out;
}

/* ---------- podgląd ---------- */

export type Sample = Partial<Record<TokenId, string>>;

/** „08.10.2026” — rok zawsze (właściciel 16.10.2026). */
const dm = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? formatCalendarDay(d.slice(0, 10)) : null);

/**
 * Dane podglądu z prawdziwego transportu (E43 „Podgląd”): kod, numer zlecenia HHL, rejestracje, daty planu, link.
 * Reszta — przykład (osoby zmyślone, G-09). W SMS kod bez numeru zlecenia (E41 pkt 5).
 */
export function sampleOf(load: Pick<Load, 'code' | 'hhlOrderNo' | 'plannedLoadDate' | 'plannedDeliverDate' | 'resources'> | null): Sample {
  const r = load?.resources;
  return {
    code: load?.code ?? 'XX-00',
    order: load?.hhlOrderNo ?? undefined,
    trailer: r?.trailerPlate ?? undefined,
    tractor: r?.tractorPlate ?? undefined,
    place: 'placu Stegra Boden',
    dwell: '12:35',
    arrival: '12:45',
    planDate: dm(load?.plannedDeliverDate) ?? undefined,
    loadDate: dm(load?.plannedLoadDate) ?? undefined,
    link: `tower.log-mar.pl/#/transport/${load?.code ?? 'XX-00'}`,
    riskName: 'brak awizacji przed załadunkiem',
    severity: 'krytyczna',
    decision: 'brak awizacji przed załadunkiem',
    due: dm(load?.plannedLoadDate) ?? undefined,
    outcome: 'Akceptuję',
    author: 'Jan Nowak (SCX)',
    message: 'Kierowca będzie o 14:00.',
    statusFrom: 'Na promie',
    statusTo: 'Port SE',
    time: '13:05',
    side: 'HHL',
    missing: 'kierowca, ciągnik',
    ruleName: 'Brak awizacji 48 h przed załadunkiem',
    detail: 'awizacja niekompletna',
    invoiceNo: 'FV 12/10/2026',
    amount: '13 800,00 EUR',
    reason: 'kwota postoju niezgodna z ustaleniem',
    policyNo: 'OC-0000-PRZYKLAD',
    recipients: '2 osoby',
    source: 'Orlen',
    date: '15.10.2026',
    count: '19',
    name: 'Anna Nowak',
    firm: 'KSH',
    account: 'KSH Użytkownik',
    inviter: 'Anna Wiśniewska',
    validity: '24 h',
    road: 'E4',
    transports: load?.code ?? 'XX-00',
    week: 't41',
    loadWeek: 't42',
    queued: '3',
    limit: '150',
    carrier: 'Scandinavian Express',
    codes: load?.code ?? 'XX-00',
    reminder: 'termin za 3 dni',
    loadDateBefore: '04.10.2026',
    planDateBefore: '06.10.2026',
    site: 'Boden',
    placeTo: 'plac Stegra Boden',
    port: 'Gdynia',
    closure: 'most Högakustenbron zamknięty do 18:00',
    choice: 'objazd, +62 km, +1 h 05 min',
    feed: 'Telematyka naczep',
    since: '00:00',
    effect: 'brak pozycji naczep na mapie i w ETA',
    error: 'Nie udało się zapisać awizacji',
    times: '3',
    people: '2',
    page: 'Harmonogram',
  };
}

/** Tekst wiadomości na danych podglądu; brak danej → „—” (E43 „Brak danej”). Przycisk logowania — jego napis w [ ]. */
export function renderSegs(segs: readonly Seg[], sample: Sample, buttonLabel = 'Dołącz'): string {
  return segs.map((x) => {
    if (x.k === 'txt') return x.v;
    if (x.id === 'button') return `[${buttonLabel}]`;
    const v = sample[x.id];
    return v && v.trim() ? v : '—';
  }).join('');
}

const PL: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' };

/**
 * SMS bez polskich liter (E43 „SMS”, E42: treść bez polskich znaków); typograficzne znaki na znaki z alfabetu SMS (GSM 03.38):
 * „—” i „–” → „-”, „→” → „->”, cudzysłowy i apostrofy proste, „…” → „...”, twarda spacja → spacja.
 */
export function smsText(s: string): string {
  return s
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => PL[c] ?? c)
    .replace(/[—–]/g, '-').replace(/→/g, '->')
    .replace(/[„”“«»]/g, '"').replace(/[’‘‚]/g, "'")
    .replace(/…/g, '...').replace(/\u00a0/g, ' ');
}

/* alfabet SMS (GSM 03.38): podstawowy — 1 znak; rozszerzony — 2 znaki; reszta przełącza SMS na 70 znaków */
const GSM_BASIC = new Set([...'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà']);
const GSM_EXT = new Set([...'^{}\\[~]|€']);

/** Długość SMS w znakach alfabetu SMS (znaki rozszerzone liczą się podwójnie). */
export function gsmLength(s: string): number {
  let n = 0;
  for (const c of s) n += GSM_EXT.has(c) ? 2 : 1;
  return n;
}

/** Znaki spoza alfabetu SMS (po zamianie `smsText`) — bez powtórzeń. */
export function gsmBad(s: string): string[] {
  return [...new Set([...s].filter((c) => !GSM_BASIC.has(c) && !GSM_EXT.has(c)))];
}

export const SMS_MAX = 160;

/** Najdłuższe wartości klocków SMS — limit 160 ma wytrzymać każdy transport, nie tylko ten z podglądu (E43 „SMS”). */
const SMS_WORST: Sample = {
  code: 'X'.repeat(8), trailer: 'X'.repeat(10), tractor: 'X'.repeat(10), place: 'X'.repeat(28), placeTo: 'X'.repeat(28),
  dwell: '00:00', arrival: '00:00', planDate: '00.00.0000', link: `tower.log-mar.pl/#/transport/${'X'.repeat(8)}`,
};

/** SMS gotowy do wysłania na danych podglądu. */
export function smsOf(body: readonly Seg[], sample: Sample): string {
  return smsText(renderSegs(body, sample));
}
/** Długość SMS przy najdłuższych danych. */
export function smsWorstLength(body: readonly Seg[]): number {
  return gsmLength(smsOf(body, SMS_WORST));
}

/** Fragment linii podglądu: zwykły tekst albo przycisk e-maila logowania (z klocka, nie z nawiasów w tekście). */
export type PreviewPart = { btn: boolean; v: string };

/** Podgląd w liniach: klocki zamienione na dane („—”, gdy brak), przycisk osobno; SMS bez polskich liter. */
export function previewLines(segs: readonly Seg[], sample: Sample, sms: boolean, buttonLabel = 'Dołącz'): PreviewPart[][] {
  const lines: PreviewPart[][] = [[]];
  const push = (v: string, btn: boolean) => {
    if (btn) { lines[lines.length - 1]!.push({ btn, v }); return; }
    const t = sms ? smsText(v) : v;
    t.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ btn: false, v: part });
    });
  };
  for (const x of segs) {
    if (x.k === 'txt') push(x.v, false);
    else if (x.id === 'button') push(buttonLabel, true);
    else push(renderSegs([x], sample), false);
  }
  return lines;
}

export type CheckError = 'empty' | 'sms_long' | 'sms_chars' | 'no_button' | 'subject_empty';

/**
 * Sprawdzenie przed zapisem: treść niepusta; temat e-maila niepusty; e-mail logowania z przyciskiem;
 * SMS tylko ze znakami alfabetu SMS i ≤ 160 znaków na podglądzie i przy najdłuższych danych.
 */
export function checkMessage(item: MsgItem, subject: readonly Seg[] | null, body: readonly Seg[], sample: Sample):
  { ok: true } | { ok: false; error: CheckError; field: 'subject' | 'body'; chars?: string[] } {
  if (!body.some((x) => x.k === 'tok' || x.v.trim())) return { ok: false, error: 'empty', field: 'body' };
  if (item.channel !== 'SMS' && subject && !subject.some((x) => x.k === 'tok' || x.v.trim())) return { ok: false, error: 'subject_empty', field: 'subject' };
  if (item.needsButton && !body.some((x) => x.k === 'tok' && x.id === 'button')) return { ok: false, error: 'no_button', field: 'body' };
  if (item.channel === 'SMS') {
    const txt = smsOf(body, sample);
    const bad = gsmBad(txt);
    if (bad.length) return { ok: false, error: 'sms_chars', field: 'body', chars: bad };
    if (Math.max(gsmLength(txt), smsWorstLength(body)) > SMS_MAX) return { ok: false, error: 'sms_long', field: 'body' };
  }
  return { ok: true };
}
