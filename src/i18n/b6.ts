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
    'Zdarzenie: zmiana statusu, nowe albo zmienione ryzyko, wjazd lub wyjazd ze strefy, auto 50\u00a0km przed placem albo 20\u00a0km przed portem, sprawa do zrobienia, wiadomość w czacie, faktura.'
    + '|Tabela poniżej: zdarzenie × rodzaj konta (HHL Administrator, HHL Operacje, KSH Użytkownik, SCX Dyspozytor, SCX Użytkownik) × kanał: dzwonek w aplikacji, powiadomienie na telefonie, e-mail. To wartości startowe dla każdego konta tego rodzaju.'
    + '|Każda osoba zmienia swoje kanały w „Dla mnie › Co dostaję”, tylko dla zdarzeń, które dostaje jej rodzaj konta. Kanał oznaczony „zawsze” zostaje włączony.'
    + '|Przewoźnik dostaje tylko swoje transporty, KSH tylko swój projekt, HHL wszystko według tabeli. To samo zdarzenie powtórzone nie tworzy drugiego wpisu.'
    + '|Gdy sprawa wymaga reakcji (np. brak awizacji przed załadunkiem, brak dokumentu, opłata paliwowa poza tabelą), pojawia się w Ryzyka › Do zrobienia. Ostrzeżenie i stan krytyczny to ta sama sprawa; gdy warunek ustanie, sprawa zamyka się sama.'
    + '|E-mail: sprawy krytyczne od razu, niekrytyczne raz na dobę w jednym skrócie. Po dziennym limicie poczty wpis w dzwonku zostaje.'
    + '|Automatyzacje: Administrator HHL dodaje własne reguły przyciskiem „+ Nowa reguła”. Jedno zdarzenie daje jedno powiadomienie na osobę, bez dubli z automatami.',
  b6_howto_centre:
    'Lista poniżej to otwarte sprawy wymagające reakcji (brak awizacji, brak dokumentu, opłata paliwowa poza tabelą i inne typy z macierzy).'
    + '|Kliknięcie otwiera sprawę: osoba z właściwą rolą wybiera rozstrzygnięcie, może dodać komentarz albo odłożyć na 2\u00a0h.'
    + '|Ostrzeżenie i stan krytyczny to ta sama sprawa; po terminie sprawa czerwienieje. Gdy warunek ustanie — sprawa zamyka się jako nieaktualna.'
    + '|Powiadomienia o sprawach idą według macierzy w Opcjach; rozstrzygnięcie zapisuje się w historii transportu.',
  b6_howto_zones:
    'Strefa to koło na mapie: środek, promień, zapas i rodzaj (załadunek, port, plac, punkt kontrolny…). Kształt, kraj i „kogo powiadomić” ustawia się w widoku Strefy; tutaj jest tylko włącznik.'
    + '|Gdy auto z GPS wjedzie do strefy, system czeka na kilka kolejnych pozycji w środku — pojedyncze drgnięcie GPS nie robi alarmu. Przy porcie i placu czeka też, aż auto postoi zadaną liczbę minut.'
    + '|Wyjazd liczy się dopiero po oddaleniu o zapas, więc auto na granicy koła nie robi pary „wjazd — wyjazd”.'
    + '|Skutek wjazdu albo wyjazdu: zmiana statusu transportu i powiadomienie według macierzy.'
    + '|SMS idzie osobno, tylko z dwóch miejsc: okolica załadunku w Śremie i plac w Boden — na listy telefonów powyżej. Ptaszki „zbliżenie” i „wjazd” włączają te SMS-y. „Test” tylko dodaje próbny SMS do kolejki.'
    + '|Bramka SMS to telefon z aplikacją, który wysyła te SMS-y. Gdy milczy dłużej niż 15 minut — ryzyko i e-mail do HHL.'
    + '|Bez pozycji GPS z aut strefy nic nie robią.',
  b6_howto_thresh:
    'Każda liczba to granica, od której system podnosi alarm. Zmienia tylko Administrator HHL: „Zmień” → nowa wartość większa od zera → potwierdzenie → wpis w Historii zmian (kto, kiedy, było → jest). Automaty czytają progi wyłącznie stąd.'
    + '|Ostrzeżenie i stan krytyczny to jeden alarm, który rośnie: przy ostrzeżeniu w Ryzyka › Do zrobienia pojawia się sprawa z terminem w chwili krytycznej; przy krytycznym ta sama sprawa czerwienieje i idą powiadomienia według „Kto co dostaje”.'
    + '|Awizacja: kierowca, ciągnik, naczepa i telefon liczone od planowanego załadunku, kierowca dostarczający od planowanej dostawy. Brak na 48\u00a0h przed — ostrzeżenie, na 12\u00a0h — krytyczne.'
    + '|Dokumenty: brak wymaganego dokumentu na 24\u00a0h przed terminem — ostrzeżenie, na 6\u00a0h — krytyczne. Polisa HHL i zezwolenie „Firma” podpinają się same; zezwolenie PL i SE przy transporcie jest potrzebne tylko przy „Trasa” (KR).'
    + '|Fala i porywy wiatru: automat pogody na trasie promu. Wiatr na drodze: od 20\u00a0m/s ETA liczy wolniejszą jazdę, od 25\u00a0m/s postój; śliskość tylko do 25\u00a0km od auta.'
    + '|Opóźnienie: ETA z prawdziwej pozycji (GPS auta, AIS promu) później niż koniec okna dostawy plus próg.'
    + '|Brak GPS: ostatnia pozycja starsza niż próg — tylko gdy auto ma źródło pozycji i jest w drodze.'
    + '|Zjazd z trasy: dalej od trasy niż próg przez co najmniej 2 pozycje i 10 minut; nie na promie, w portach ani na placach.'
    + '|Potwierdzenie daty: nowy transport albo zmiana daty, gdy do załadunku zostało mniej dni niż próg.'
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
  b6_sys_csp: 'CSP (Report-Only)',
  b6_sys_csp_d: 'do {until} · {hits} wystąpień / 7 dni · {top}',
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

export const B6_I18N: Record<Locale, Dict> = { pl, en: {}, sv: {} };
