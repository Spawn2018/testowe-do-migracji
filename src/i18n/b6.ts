/**
 * B-6 (część B, Opcje, 05.10.2026) — „Jak to działa” w sekcjach Opcji, Stan systemu jako pulpit,
 * dziennik logowań z własnej tabeli (0164), SEFS: odczyty dzienne i stan poprzedniego tygodnia.
 * Linie „Jak to działa” są rozdzielone znakiem „|” (jedna pozycja listy = jeden fragment).
 */
import type { Locale } from '../types';

type Dict = Record<string, string>;

const pl: Dict = {
  b6_howto: 'Jak to działa',
  b6_howto_notif:
    'Zdarzenie: zmiana statusu transportu, nowe albo zmienione ryzyko, wjazd lub wyjazd ze strefy, otwarcie lub zamknięcie decyzji.'
    + '|Baza sprawdza macierz poniżej: dla grupy zdarzenia i firmy — czy wpis w aplikacji, czy e-mail. Tylko macierz decyduje, czy powiadomienie w ogóle powstanie.'
    + '|Przewoźnik dostaje tylko swoje transporty, KSH tylko swój projekt, HHL wszystko według macierzy. To samo zdarzenie powtórzone nie tworzy drugiego wpisu.'
    + '|Gdy sprawa wymaga reakcji (np. brak awizacji przed załadunkiem, brak dokumentu, opłata paliwowa poza tabelą), otwiera się decyzja w Centrum decyzji. Ostrzeżenie i stan krytyczny to ta sama decyzja; gdy warunek ustanie, decyzja zamyka się jako nieaktualna.'
    + '|E-mail: sprawy krytyczne od razu, niekrytyczne raz na dobę w jednym skrócie. Po dziennym limicie poczty wpis w aplikacji zostaje.'
    + '|Automatyzacje: administrator HHL dodaje własne reguły przyciskiem „Nowa automatyzacja”. Reguły działają w tym samym mechanizmie w bazie — jedno zdarzenie daje jeden alarm na odbiorcę, bez dubli z automatami.',
  b6_notif_filter_note: 'Te przełączniki gaszą tylko powiadomienia tworzone w tej przeglądarce. Nie wyłączają e-maili ani wpisów z bazy — o nich decyduje macierz.',
  b6_howto_zones:
    'Strefa to koło na mapie: środek, promień, zapas i rodzaj (załadunek, port, plac, punkt kontrolny…). Kształt, kraj i „kogo powiadomić” ustawia się w widoku Strefy; tutaj jest tylko włącznik.'
    + '|Gdy auto z GPS wjedzie do strefy, system czeka na kilka kolejnych pozycji w środku — pojedyncze drgnięcie GPS nie robi alarmu. Przy porcie i placu czeka też, aż auto postoi zadaną liczbę minut.'
    + '|Wyjazd liczy się dopiero po oddaleniu o zapas, więc auto na granicy koła nie robi pary „wjazd — wyjazd”.'
    + '|Skutek wjazdu albo wyjazdu: zmiana statusu transportu i powiadomienie według macierzy.'
    + '|SMS idzie osobno, tylko z dwóch miejsc: okolica załadunku w Śremie i plac w Boden — na listy telefonów powyżej. Ptaszki „zbliżenie” i „wjazd” włączają te SMS-y. „Test” tylko dodaje próbny SMS do kolejki.'
    + '|Bramka SMS to telefon z aplikacją, który wysyła te SMS-y. Gdy milczy dłużej niż 15 minut — ryzyko i e-mail do HHL.'
    + '|Bez pozycji GPS z aut strefy nic nie robią.',
  b6_howto_thresh:
    'Każda liczba to granica, od której system podnosi alarm. Zapis przy wyjściu z pola, tylko administrator HHL, wartość większa od zera; zmiana trafia do historii. Automaty czytają progi wyłącznie stąd.'
    + '|Ostrzeżenie i stan krytyczny to jeden alarm, który rośnie: przy ostrzeżeniu otwiera się decyzja z terminem w chwili krytycznej; przy krytycznym ta sama decyzja czerwienieje i idą powiadomienia.'
    + '|Awizacja: kierowca, ciągnik, naczepa i telefon liczone od planowanego załadunku, kierowca dostarczający od planowanej dostawy. Brak na 48 h przed — ostrzeżenie, na 12 h — krytyczne.'
    + '|Dokumenty: brak zezwolenia (gdy wymagane) albo polisy na 24 h przed załadunkiem — ostrzeżenie, na 6 h — krytyczne.'
    + '|Fala i porywy wiatru: automat pogody na trasie promu.'
    + '|Opóźnienie: ETA z prawdziwej pozycji (GPS auta, AIS promu) później niż koniec okna dostawy plus próg.'
    + '|Brak GPS: ostatnia pozycja starsza niż próg — tylko gdy auto ma źródło pozycji i jest w drodze.'
    + '|Zjazd z trasy: dalej od trasy niż próg przez co najmniej 2 pozycje i 10 minut; nie na promie, w portach ani na placach.'
    + '|Wyprzedzenie dat KSH: nowy transport albo zmiana daty, gdy do załadunku zostało mniej dni niż próg.'
    + '|Gdy warunek ustanie, alarm się zamyka. Brak danych = brak alarmu.',
  b6_sys_gw: 'Bramka SMS',
  b6_sys_sms_ok: 'Działa',
  b6_sys_sms_silent: 'Cisza',
  b6_sys_sms_none: 'Brak',
  b6_sys_mail: 'Poczta dzisiaj',
  b6_sys_mail_d: 'natychmiast {n} · skrót {d} · wstrzymane {s}',
  b6_sys_backup: 'Kopia zapasowa',
  b6_sys_backup_OK: 'Udana',
  b6_sys_backup_ERROR: 'Nieudana',
  b6_sys_backup_RUNNING: 'W toku',
  b6_sys_backup_SKIPPED: 'Pominięta',
  b6_sys_integ: 'Integracje',
  b6_sys_integ_v: '{ok} z {n} OK',
  b6_sys_integ_bad: 'Błąd: {jobs}',
  b6_sys_integ_all_ok: 'Ostatni przebieg każdej bez błędu',
  b6_sys_here: 'HERE (miesiąc)',
  b6_sys_here_d: 'kafelki {tiles} · trasy {routes} · dopasowanie {match} · ponad pulę {over} USD · podkład {basemap}',
  b6_sys_deepl: 'DeepL (miesiąc)',
  b6_sys_deepl_d: 'z {limit} znaków · kolejka {q}',
  b6_sys_last: 'Ostatnio: {d}',
  b6_sys_none: '—',
  b6_sys_jobs_h: 'Integracje — ostatni przebieg każdej',
  b6_sys_backups_h: 'Kopie zapasowe — ostatnie 7',
  b6_sys_ok: 'OK',
  b6_sys_err: 'Błąd',
  b6_job_send_notifications: 'Wysyłka powiadomień',
  b6_job_ferry_ais: 'Pozycje promów (AIS)',
  b6_job_ferry_ais_listen: 'Nasłuch AIS na żywo',
  b6_job_ferry_status: 'Statusy rejsów',
  b6_job_ferry_schedule: 'Rozkład promów',
  b6_job_ferry_weather: 'Pogoda morska',
  b6_job_road_se: 'Drogi w Szwecji',
  b6_job_road_pl: 'Drogi w Polsce',
  b6_job_daily_admin_digest: 'Dzienny skrót e-mail',
  b6_job_email_budget: 'Limit poczty',
  b6_job_rodo: 'Porządki RODO',
  b6_job_usage_check: 'Zużycie limitów usług',
  b6_job_fuel_wob: 'Paliwo (biuletyn KE)',
  b6_authlog_last_sign_in: 'ostatnie logowanie konta (sprzed dziennika)',
  b6_authlog_note: 'Wpis powstaje przy każdym udanym logowaniu (link e-mail, hasło, kod). Nieudanych prób usługa logowania nie zapisuje w bazie — zostają w dzienniku platformy. Pokazane ostatnie 50.',
  b6_hist_capped: 'Pokazano ostatnie {n} zmian — zawęź filtrem, żeby zobaczyć starsze.',
  b6_howto_sefs:
    'Opłata paliwowa liczy się sama przy każdym transporcie: z daty załadunku system bierze poprzedni tydzień (poniedziałek–niedziela), liczy średnią z odczytów SEK (OKQ8) i osobno PLN (ORLEN), dobiera mnożniki z tabel i stosuje niższy z dwóch. Wynik zapisuje się przy transporcie.'
    + '|Odczytów cen system sam nie pobiera. Każdy dzienny odczyt wpisuje HHL poniżej: indeks, data, cena i adres źródła. Odczyt za miesiąc albo tydzień nie wchodzi do średniej.'
    + '|Brak odczytów SEK albo PLN za poprzedni tydzień: opłata się nie liczy, otwiera się decyzja „opłata paliwowa poza tabelą” dla HHL. Mnożnik nie jest zgadywany.'
    + '|Automatyczne pobieranie biuletynu KE (WOB) istnieje, ale jest wyłączone i liczy inny indeks (EUR/l), nie OKQ8/ORLEN.',
  b6_sefs_week: 'Poprzedni tydzień {from} – {to}: odczyty SEK {s}, PLN {p}.',
  b6_sefs_week_ok: 'Średnia SEK {as}, PLN {ap} → mnożnik {m} dla załadunków w tym tygodniu.',
  b6_sefs_week_missing: 'Brakuje odczytów — opłata paliwowa za ten tydzień się nie policzy.',
  b6_baf_period_daily: 'Dzień odczytu (do średniej tygodnia)',
};

const en: Dict = {
  b6_howto: 'How it works',
  b6_howto_notif:
    'Event: load status change, new or changed risk, zone entry or exit, decision opened or closed.'
    + '|The database checks the matrix below: per event group and company — in-app entry and/or email. Only the matrix decides whether a notification is created.'
    + '|The carrier gets only its loads, KSH only its project, HHL everything per the matrix. A repeated event does not create a second entry.'
    + '|When action is needed (e.g. missing booking before loading, missing document, fuel surcharge out of table) a decision opens in the Decision centre. Warning and critical are the same decision; when the condition clears it closes as outdated.'
    + '|Email: critical at once, non-critical once a day in one digest. Past the daily mail limit the in-app entry stays.'
    + '|Automations are a history view only. No new rules are added — one mechanism in the database drives everything.',
  b6_notif_filter_note: 'These switches mute only notifications created in this browser. They do not turn off emails or database entries — the matrix decides those.',
  b6_howto_zones:
    'A zone is a circle on the map: centre, radius, margin and type (loading, port, yard, checkpoint…). Shape, country and who to notify are set in the Zones view; here is only the on/off switch.'
    + '|When a truck with GPS enters a zone, the system waits for several positions inside — one GPS jitter raises no alarm. At ports and yards it also waits until the truck has stood for the set minutes.'
    + '|Exit counts only after moving away by the margin, so a truck on the edge does not make an entry/exit pair.'
    + '|Effect of entry or exit: load status change and a notification per the matrix.'
    + '|SMS is separate, only from two places: the loading area in Śrem and the Boden yard — to the phone lists above. The “approach” and “entry” ticks enable these SMS. “Test” only queues a test SMS.'
    + '|The SMS gateway is a phone with the app that sends these SMS. Silent for over 15 minutes — risk and email to HHL.'
    + '|Without GPS positions from trucks, zones do nothing.',
  b6_howto_thresh:
    'Each number is the limit at which the system raises an alarm. Saved on leaving the field, HHL administrator only, value above zero; the change goes to history. Automations read thresholds only from here.'
    + '|Warning and critical are one alarm that grows: on warning a decision opens with its deadline at the critical moment; on critical the same decision turns red and notifications go out.'
    + '|Booking: pickup driver, tractor, trailer and phone counted from planned loading, delivering driver from planned delivery. Missing 48 h before — warning, 12 h — critical.'
    + '|Documents: missing permit (when required) or policy 24 h before loading — warning, 6 h — critical.'
    + '|Wave and wind gusts: the weather automation on the ferry route.'
    + '|Delay: ETA from a real position (truck GPS, ferry AIS) later than the end of the delivery window plus the threshold.'
    + '|No GPS: last position older than the threshold — only when the truck has a position source and is on the road.'
    + '|Off route: farther from the route than the threshold for at least 2 positions and 10 minutes; not on the ferry, in ports or yards.'
    + '|KSH date lead: new load or date change with fewer days to loading than the threshold.'
    + '|When the condition clears, the alarm closes. No data = no alarm.',
  b6_sys_gw: 'SMS gateway',
  b6_sys_sms_ok: 'Working',
  b6_sys_sms_silent: 'Silent',
  b6_sys_sms_none: 'None',
  b6_sys_mail: 'Mail today',
  b6_sys_mail_d: 'immediate {n} · digest {d} · held {s}',
  b6_sys_backup: 'Backup',
  b6_sys_backup_OK: 'Succeeded',
  b6_sys_backup_ERROR: 'Failed',
  b6_sys_backup_RUNNING: 'Running',
  b6_sys_backup_SKIPPED: 'Skipped',
  b6_sys_integ: 'Integrations',
  b6_sys_integ_v: '{ok} of {n} OK',
  b6_sys_integ_bad: 'Error: {jobs}',
  b6_sys_integ_all_ok: 'Last run of each without error',
  b6_sys_here: 'HERE (month)',
  b6_sys_here_d: 'tiles {tiles} · routes {routes} · matching {match} · over pool {over} USD · basemap {basemap}',
  b6_sys_deepl: 'DeepL (month)',
  b6_sys_deepl_d: 'of {limit} characters · queue {q}',
  b6_sys_last: 'Last: {d}',
  b6_sys_none: '—',
  b6_sys_jobs_h: 'Integrations — last run of each',
  b6_sys_backups_h: 'Backups — last 7',
  b6_sys_ok: 'OK',
  b6_sys_err: 'Error',
  b6_job_send_notifications: 'Notification sending',
  b6_job_ferry_ais: 'Ferry positions (AIS)',
  b6_job_ferry_ais_listen: 'Live AIS listener',
  b6_job_ferry_status: 'Sailing statuses',
  b6_job_ferry_schedule: 'Ferry schedule',
  b6_job_ferry_weather: 'Marine weather',
  b6_job_road_se: 'Roads in Sweden',
  b6_job_road_pl: 'Roads in Poland',
  b6_job_daily_admin_digest: 'Daily email digest',
  b6_job_email_budget: 'Mail limit',
  b6_job_rodo: 'GDPR clean-up',
  b6_job_usage_check: 'Service usage limits',
  b6_job_fuel_wob: 'Fuel (EC bulletin)',
  b6_authlog_last_sign_in: 'account’s last sign-in (before the journal)',
  b6_authlog_note: 'An entry is created on every successful sign-in (email link, password, code). The sign-in service does not store failed attempts in the database — they stay in the platform log. Last 50 shown.',
  b6_hist_capped: 'Showing the last {n} changes — narrow the filter to see older ones.',
  b6_howto_sefs:
    'The fuel surcharge is calculated for every load: from the loading date the system takes the previous week (Monday–Sunday), averages the SEK (OKQ8) and PLN (ORLEN) readings separately, picks the multipliers from the tables and applies the lower one. The result is stored with the load.'
    + '|The system does not fetch prices by itself. HHL enters each daily reading below: index, date, price and source URL. A monthly or weekly reading does not count towards the average.'
    + '|No SEK or PLN readings for the previous week: no surcharge is calculated and a “fuel surcharge out of table” decision opens for HHL. The multiplier is never guessed.'
    + '|An automatic EC bulletin (WOB) fetch exists but is off and uses a different index (EUR/l), not OKQ8/ORLEN.',
  b6_sefs_week: 'Previous week {from} – {to}: SEK readings {s}, PLN {p}.',
  b6_sefs_week_ok: 'Average SEK {as}, PLN {ap} → multiplier {m} for loadings this week.',
  b6_sefs_week_missing: 'Readings missing — this week’s fuel surcharge will not be calculated.',
  b6_baf_period_daily: 'Reading day (for the weekly average)',
};

const sv: Dict = {
  b6_howto: 'Så fungerar det',
  b6_howto_notif:
    'Händelse: ändrad transportstatus, ny eller ändrad risk, in- eller utpassage i zon, beslut öppnat eller stängt.'
    + '|Databasen kontrollerar matrisen nedan: per händelsegrupp och företag — post i appen och/eller e-post. Bara matrisen avgör om en avisering skapas.'
    + '|Åkeriet får bara sina transporter, KSH bara sitt projekt, HHL allt enligt matrisen. En upprepad händelse ger ingen ny post.'
    + '|När något kräver åtgärd (t.ex. saknad avisering före lastning, saknat dokument, bränsletillägg utanför tabellen) öppnas ett beslut i beslutscentret. Varning och kritiskt är samma beslut; när villkoret upphör stängs det som inaktuellt.'
    + '|E-post: kritiskt direkt, övrigt en gång per dygn i en sammanfattning. Efter dagens e-postgräns finns posten kvar i appen.'
    + '|Automatiseringar är bara en historikvy. Nya regler läggs inte till — en mekanism i databasen styr allt.',
  b6_notif_filter_note: 'Dessa reglage tystar bara aviseringar som skapas i den här webbläsaren. De stänger inte av e-post eller poster från databasen — det avgör matrisen.',
  b6_howto_zones:
    'En zon är en cirkel på kartan: mittpunkt, radie, marginal och typ (lastning, hamn, upplag, kontrollpunkt…). Form, land och vem som aviseras ställs in i vyn Zoner; här finns bara på/av.'
    + '|När ett fordon med GPS kör in i en zon väntar systemet på flera positioner inuti — ett enstaka GPS-hopp ger inget larm. Vid hamn och upplag väntar det också tills fordonet stått angivna minuter.'
    + '|Utpassage räknas först efter marginalen, så ett fordon på kanten ger inget par in/ut.'
    + '|Följd av in- eller utpassage: ändrad transportstatus och avisering enligt matrisen.'
    + '|SMS skickas separat, bara från två platser: lastningsområdet i Śrem och upplaget i Boden — till telefonlistorna ovan. Kryssen ”närmar sig” och ”inpassage” slår på dessa SMS. ”Test” köar bara ett test-SMS.'
    + '|SMS-gatewayen är en telefon med appen som skickar dessa SMS. Tyst i över 15 minuter — risk och e-post till HHL.'
    + '|Utan GPS-positioner från fordonen gör zonerna ingenting.',
  b6_howto_thresh:
    'Varje tal är gränsen där systemet larmar. Sparas när fältet lämnas, bara HHL-administratör, värde över noll; ändringen går till historiken. Automatiken läser gränser bara härifrån.'
    + '|Varning och kritiskt är ett larm som växer: vid varning öppnas ett beslut med deadline vid kritisk tidpunkt; vid kritiskt blir samma beslut rött och aviseringar skickas.'
    + '|Avisering: hämtande förare, dragbil, trailer och telefon räknas från planerad lastning, levererande förare från planerad leverans. Saknas 48 h före — varning, 12 h — kritiskt.'
    + '|Dokument: saknat tillstånd (när det krävs) eller försäkring 24 h före lastning — varning, 6 h — kritiskt.'
    + '|Våghöjd och vindbyar: väderautomatiken på färjerutten.'
    + '|Försening: ETA från verklig position (fordonets GPS, färjans AIS) senare än leveransfönstrets slut plus gränsen.'
    + '|Ingen GPS: senaste position äldre än gränsen — bara när fordonet har positionskälla och är på väg.'
    + '|Avvikelse från rutt: längre från rutten än gränsen i minst 2 positioner och 10 minuter; inte på färjan, i hamnar eller upplag.'
    + '|KSH-framförhållning: ny transport eller datumändring med färre dagar till lastning än gränsen.'
    + '|När villkoret upphör stängs larmet. Inga data = inget larm.',
  b6_sys_gw: 'SMS-gateway',
  b6_sys_sms_ok: 'Fungerar',
  b6_sys_sms_silent: 'Tyst',
  b6_sys_sms_none: 'Ingen',
  b6_sys_mail: 'E-post idag',
  b6_sys_mail_d: 'direkt {n} · sammanfattning {d} · stoppade {s}',
  b6_sys_backup: 'Säkerhetskopia',
  b6_sys_backup_OK: 'Lyckad',
  b6_sys_backup_ERROR: 'Misslyckad',
  b6_sys_backup_RUNNING: 'Pågår',
  b6_sys_backup_SKIPPED: 'Hoppades över',
  b6_sys_integ: 'Integrationer',
  b6_sys_integ_v: '{ok} av {n} OK',
  b6_sys_integ_bad: 'Fel: {jobs}',
  b6_sys_integ_all_ok: 'Senaste körningen av varje utan fel',
  b6_sys_here: 'HERE (månad)',
  b6_sys_here_d: 'kartbilder {tiles} · rutter {routes} · matchning {match} · över pool {over} USD · bakgrund {basemap}',
  b6_sys_deepl: 'DeepL (månad)',
  b6_sys_deepl_d: 'av {limit} tecken · kö {q}',
  b6_sys_last: 'Senast: {d}',
  b6_sys_none: '—',
  b6_sys_jobs_h: 'Integrationer — senaste körning av varje',
  b6_sys_backups_h: 'Säkerhetskopior — senaste 7',
  b6_sys_ok: 'OK',
  b6_sys_err: 'Fel',
  b6_job_send_notifications: 'Utskick av aviseringar',
  b6_job_ferry_ais: 'Färjepositioner (AIS)',
  b6_job_ferry_ais_listen: 'AIS-lyssnare i realtid',
  b6_job_ferry_status: 'Avgångsstatus',
  b6_job_ferry_schedule: 'Färjetidtabell',
  b6_job_ferry_weather: 'Sjöväder',
  b6_job_road_se: 'Vägar i Sverige',
  b6_job_road_pl: 'Vägar i Polen',
  b6_job_daily_admin_digest: 'Daglig e-postsammanfattning',
  b6_job_email_budget: 'E-postgräns',
  b6_job_rodo: 'GDPR-städning',
  b6_job_usage_check: 'Tjänsters användningsgränser',
  b6_job_fuel_wob: 'Bränsle (EU-bulletin)',
  b6_authlog_last_sign_in: 'kontots senaste inloggning (före loggen)',
  b6_authlog_note: 'En post skapas vid varje lyckad inloggning (e-postlänk, lösenord, kod). Misslyckade försök sparar inloggningstjänsten inte i databasen — de finns i plattformens logg. Senaste 50 visas.',
  b6_hist_capped: 'Visar de senaste {n} ändringarna — smalna av filtret för att se äldre.',
  b6_howto_sefs:
    'Bränsletillägget räknas för varje transport: från lastningsdatum tar systemet föregående vecka (måndag–söndag), räknar medel av SEK-avläsningar (OKQ8) och separat PLN (ORLEN), väljer multiplikatorer ur tabellerna och använder den lägre. Resultatet sparas vid transporten.'
    + '|Systemet hämtar inte priser själv. HHL för in varje daglig avläsning nedan: index, datum, pris och källadress. En månads- eller veckoavläsning räknas inte in i medlet.'
    + '|Inga SEK- eller PLN-avläsningar för föregående vecka: inget tillägg räknas och ett beslut ”bränsletillägg utanför tabellen” öppnas för HHL. Multiplikatorn gissas aldrig.'
    + '|Automatisk hämtning av EU-bulletinen (WOB) finns men är avstängd och använder ett annat index (EUR/l), inte OKQ8/ORLEN.',
  b6_sefs_week: 'Föregående vecka {from} – {to}: SEK-avläsningar {s}, PLN {p}.',
  b6_sefs_week_ok: 'Medel SEK {as}, PLN {ap} → multiplikator {m} för lastningar denna vecka.',
  b6_sefs_week_missing: 'Avläsningar saknas — veckans bränsletillägg räknas inte.',
  b6_baf_period_daily: 'Avläsningsdag (för veckomedel)',
};

export const B6_I18N: Record<Locale, Dict> = { pl, en, sv };
