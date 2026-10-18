/**
 * wyglad/P10b-b — Pomoc „Jak pracuję” w 5 wersjach (E37 pkt 3, L38). Treść dosłownie z dopisku D-20261009-0015-01
 * (z poprawkami 09.10: piloci D-20261009-1233-01; daty, grupowanie, polisy, dopłaty, konwój D-20261009-1309-01).
 * Nazwy w tekście = nazwy w aplikacji: „Rejsy do Szwecji” → zakładka „Rejsy” w Harmonogramie (różnica wypisana w PR).
 * Bez kodów transportów, numerów telefonów, kwot i dat z danych przykładowych (G-09).
 */
import type { AccountKind } from './cockpitE9';
import type { NavKey } from './permissions';
import { serverRuleOn, SOON } from './serverRules';

/**
 * Cel kroku (dopisek pkt 1): widok menu; `sched/rejsy` — zakładka „Rejsy”; `risk/todo` — „Do zrobienia”;
 * `fin/pack` — „Paczka tygodnia dla księgowości”; `options/users` — Opcje › Ludzie i dostęp › Użytkownicy;
 * `konto` — menu konta; `podglad` — przełącznik „Podgląd”; `panel` — Harmonogram (panel otwiera kliknięcie transportu).
 */
export type HelpTarget = NavKey | 'sched/rejsy' | 'risk/todo' | 'fin/pack' | 'options/users' | 'konto' | 'podglad' | 'panel';

export type HelpStep = { place: string; text: string; target: HelpTarget | null };
export type HelpVersion = { kind: AccountKind; title: string; intro: string; steps: HelpStep[] };

const KONTO_ALL = 'Moje konto (dane, telefon, hasło, weryfikacja dwuetapowa) i Dla mnie (co dostajesz, waluta widoku).';

const HHL_ADMIN: HelpVersion = {
  kind: 'HHL_ADMIN',
  title: 'HHL Administrator',
  intro: 'Masz pełne prawa: zmieniasz ustawienia, statusy, rejsy i strefy. Każda Twoja zmiana zapisuje się w Historii zmian z Twoim nazwiskiem.',
  steps: [
    { place: 'Kokpit', target: 'dash', text: 'Co jest w trasie, sprawy Twojej firmy w „Do zrobienia”, załadunki w 7 dni (także po terminie), zezwolenia na 7 dni, rozliczenie i marża ważona.' },
    { place: 'Ryzyka › Do zrobienia', target: 'risk/todo', text: 'Sprawy HHL: numer zlecenia HHL, daty KSH do sprawdzenia (także zmiana daty mniej niż 5 dni przed załadunkiem), polisa HHL, dopłaty SCX do akceptacji, podpowiedzi dopłat po stronie HHL (decydujesz, czy dodać), faktoring do wypłaty. Filtry: Moje, Moja firma, Wszystkie. „Biorę tę sprawę” przypisuje sprawę Tobie.' },
    { place: 'Harmonogram', target: 'sched', text: 'Transporty z pliku KSH w układzie pliku; „Widok skrócony” pokazuje 8 kolumn. Do czasu połączenia z SharePoint plik KSH wgrywasz ręcznie. Wiersze i daty do sprawdzenia wchodzą ze sprawą w „Do zrobienia”. Gdy plik różni się od Watch Tower albo transport zniknął z pliku, dostajesz sprawę z wyborem. Zmiany dat i godzin z pliku KSH dostajesz w dzwonku. Daty i godziny zmienia tylko KSH — w pliku albo w Watch Tower.' },
    { place: 'Harmonogram › Rejsy', target: 'sched/rejsy', text: 'Rejsy promów z danych armatorów. Ręczną zmianę rejsu robisz tylko Ty.' },
    { place: 'Panel transportu', target: 'panel', text: 'Kliknij transport. W „Przeglądzie i awizacji” wpisujesz numer zlecenia HHL i wymiary zestawu. Awizację (z pilotami, gdy transport ich wymaga) wpisuje SCX, a Ty możesz ją poprawić.' },
    { place: 'Panel transportu › Status i Czat', target: 'panel', text: '„Zmień status” ręcznie z datą, także wstecz; „Anulowany” ustawiasz tylko Ty, z powodem. W Czacie wybierasz „HHL, SCX, KSH” albo „tylko HHL i SCX” — tych drugich KSH nie widzi.' },
    { place: 'Mapa', target: 'map', text: 'Transporty w oknie śledzenia: od 03:00 w dniu załadunku do „Dostarczone”. Trasy promów. Auta na promie i auta w tym samym miejscu (np. port, plac) — jeden znacznik z liczbą. Kafelki nad mapą zmieniają zakres listy.' },
    { place: 'Dokumenty', target: 'docs', text: 'Braki z terminami. Zezwolenie „Firma” podpina się samo do każdego transportu, zezwolenie „Trasa” jest przy transporcie. Polisę OCP przewoźnika zatwierdzasz, polisę HHL wgrywasz raz — podpina się sama do dokumentów każdego transportu. Wgrywasz zawsze z wyborem transportu (albo „cała firma”) i rodzaju dokumentu.' },
    { place: 'Finanse', target: 'fin', text: 'Od przychodu do marży: zafakturowane, dostarczone, prognoza. Marża poniżej progu z Opcji trafia na listę „Poniżej progu marży”.' },
    { place: 'Finanse › Paczka tygodnia dla księgowości', target: 'fin/pack', text: 'Wysyłasz fakturę z CMR do księgowości KSH i HHL albo pobierasz ZIP. Przycisk działa, gdy faktura ma PDF, każdy transport ma CMR z podpisem, a adres jest w Opcjach. Paczka dla księgowości HHL wymaga też zaakceptowanej faktury SCX.' },
    { place: 'Faktury', target: 'inv', text: 'Sprawdzasz faktury SCX (akceptacja albo spór), wystawiasz fakturę HHL dla KSH za tydzień, oznaczasz „Opłacona”. Faktoring wypłacasz 48\u00a0h po akceptacji faktury; prowizja to 1% netto.' },
    { place: 'Strefy', target: 'geo', text: 'Miejsca na trasie. Zmiana kształtu strefy od razu sprawdza ostatnie pozycje i robi wpis „zmiana strefy”. Statusy zmieniają się jak przy zwykłym wjeździe i wyjeździe, bez SMS.' },
    { place: 'Automatyzacje', target: 'wf', text: 'Reguły, które działają same, i kreator nowych reguł. SMS z kreatora idzie tylko do odbiorców z „SMS przy miejscach”, z ciszą nocną i limitem dziennym.' },
    { place: 'Opcje', target: 'options', text: 'Sześć grup: Ludzie i dostęp, Powiadomienia, Pieniądze, Zasady transportu, System, Dla mnie. Ustawiasz tu cennik i opłaty, treści wiadomości, komunikat HHL, progi i terminy dokumentów; Stan systemu pokazuje źródła danych.' },
    { place: 'Opcje › Ludzie i dostęp › Użytkownicy', target: 'options/users', text: 'Zapraszasz osoby: link działa 24 h, zaproszenie 7 dni. „Działaj jako” zapisuje każdą zmianę jako „Ty (HHL) jako osoba”.' },
    { place: 'Podgląd: HHL · KSH · SCX', target: 'podglad', text: 'Widzisz aplikację tak, jak widzi ją wybrana firma. W podglądzie nic nie zapiszesz.' },
    { place: 'Menu konta', target: 'konto', text: KONTO_ALL },
  ],
};

const HHL_OPS: HelpVersion = {
  kind: 'HHL_OPS',
  title: 'HHL Operacje',
  intro: 'Prowadzisz sprawy HHL, dokumenty, dopłaty i faktury. Ustawienia, strefy, automatyzacje i rejsy masz w podglądzie — zmienia je Administrator HHL. Statusy zmieniają SCX i Administrator HHL.',
  steps: [
    { place: 'Kokpit', target: 'dash', text: 'Co jest w trasie, sprawy Twojej firmy w „Do zrobienia”, załadunki w 7 dni (także po terminie), zezwolenia na 7 dni, rozliczenie i marża ważona.' },
    { place: 'Ryzyka › Do zrobienia', target: 'risk/todo', text: 'Sprawy HHL: numer zlecenia HHL, wymiary zestawu, daty KSH do sprawdzenia (także zmiana daty mniej niż 5 dni przed załadunkiem), dopłaty SCX do akceptacji, podpowiedzi dopłat po stronie HHL (decydujesz, czy dodać), faktoring do wypłaty. Filtry: Moje, Moja firma, Wszystkie. „Biorę tę sprawę” przypisuje sprawę Tobie.' },
    { place: 'Harmonogram', target: 'sched', text: 'Transporty z pliku KSH w układzie pliku albo w „Widoku skróconym”. Filtry etapów i eksport tego, co widać. Rejsy masz w podglądzie. Zmiany dat i godzin z pliku KSH dostajesz w dzwonku.' },
    { place: 'Panel transportu', target: 'panel', text: 'Kliknij transport. Numer zlecenia HHL i wymiary zestawu wpisujesz Ty. Awizację (z pilotami, gdy transport ich wymaga) wpisuje SCX. Status zmieniają SCX i Administrator HHL — Ty go widzisz. W Czacie wybierasz „HHL, SCX, KSH” albo „tylko HHL i SCX”.' },
    { place: 'Mapa', target: 'map', text: 'Transporty w oknie śledzenia: od 03:00 w dniu załadunku do „Dostarczone”. Trasy promów. Auta na promie i auta w tym samym miejscu — jeden znacznik z liczbą.' },
    { place: 'Dokumenty', target: 'docs', text: 'Wszystkie dokumenty i braki z terminami. Możesz wgrać dokument za SCX, zawsze z wyborem transportu (albo „cała firma”) i rodzaju. Polisę OCP przewoźnika zatwierdzasz. Terminy zmienia Administrator HHL.' },
    { place: 'Finanse', target: 'fin', text: 'Przychód, koszt i marża według etapu rozliczenia: zafakturowane, dostarczone, prognoza.' },
    { place: 'Finanse › Paczka tygodnia dla księgowości', target: 'fin/pack', text: 'Wysyłasz fakturę z CMR do księgowości KSH i HHL albo pobierasz ZIP. Przycisk działa, gdy faktura ma PDF, każdy transport ma CMR z podpisem, a adres jest w Opcjach. Paczka dla księgowości HHL wymaga też zaakceptowanej faktury SCX.' },
    { place: 'Faktury', target: 'inv', text: 'Sprawdzasz faktury SCX, wystawiasz faktury HHL dla KSH, oznaczasz „Opłacona”. Faktoring wypłacasz 48\u00a0h po akceptacji faktury; prowizja to 1% netto.' },
    { place: 'Strefy', target: 'geo', text: 'Miejsca na trasie w podglądzie. Zmiany robi Administrator HHL.' },
    { place: 'Automatyzacje', target: 'wf', text: 'Reguły i kreator w podglądzie. Zmiany robi Administrator HHL.' },
    { place: 'Opcje', target: 'options', text: 'Ustawienia w podglądzie. Zmieniasz tylko „Dla mnie”, pobierasz Eksport, na Stanie systemu możesz kliknąć „Sprawdź teraz”. Zmiany robi Administrator HHL.' },
    { place: 'Menu konta', target: 'konto', text: KONTO_ALL },
  ],
};

const KSH_USER: HelpVersion = {
  kind: 'CLIENT_USER',
  title: 'KSH Użytkownik',
  intro: 'Widzisz swoje transporty, ich status, dokumenty i koszty po swojej stronie. Transport nazywa się kodem wysyłki z pliku KSH.',
  steps: [
    { place: 'Kokpit', target: 'dash', text: 'Dostarczone, w trasie, plan dostaw na 72 h, terminowość, najbliższy prom i faktury do sprawdzenia.' },
    { place: 'Harmonogram', target: 'sched', text: 'Twoje transporty w układzie pliku KSH; „Widok skrócony” pokazuje 8 kolumn. Filtry etapów, eksport tego, co widać, i Rejsy.' },
    { place: 'Panel transportu', target: 'panel', text: 'Kliknij transport: status, trasa, plan i przewidywany przyjazd. Daty i godziny załadunku i rozładunku zmieniasz i potwierdzasz tylko Ty (w panelu) albo plik KSH. Gdy działa połączenie z SharePoint, Twoja zmiana trafia sama do pliku, a zmiana w pliku — do Watch Tower. Do tego czasu Twoja zmiana zostaje, dopóki ta sama komórka w pliku KSH się nie zmieni.' },
    { place: 'Panel transportu › Czat i Historia', target: 'panel', text: 'W Czacie piszesz do HHL i SCX. Historia pokazuje każdą zmianę z autorem.' },
    { place: 'Mapa', target: 'map', text: 'Transporty w drodze, od 03:00 w dniu załadunku do „Dostarczone”, i trasy promów.' },
    { place: 'Ryzyka', target: 'risk', text: 'Sytuacja na trasie: promy i drogi w Polsce i Szwecji. Sprawy do załatwienia prowadzą HHL i SCX.' },
    { place: 'Dokumenty', target: 'docs', text: 'CMR z podpisem odbiorcy i zezwolenia Twoich transportów oraz polisa HHL. Pobierasz pojedynczo albo paczkę tygodnia. Dokumentów nie wgrywasz.' },
    { place: 'Rozliczenia', target: 'fin', text: '„Twoja cena” do zapłaty: dostarczone, zafakturowane, prognoza. Opłata paliwowa zawsze z tygodniem, w którym obowiązuje. Dopłatę (postój, anulowanie) akceptujesz w panelu transportu › Ceny i dopłaty.' },
    { place: 'Faktury', target: 'inv', text: 'Sprawdzasz faktury HHL: akceptujesz albo zgłaszasz spór. Termin płatności: 30 dni od wystawienia.' },
    { place: 'Menu konta', target: 'konto', text: 'Moje konto (dane, telefon, hasło, weryfikacja dwuetapowa) i Dla mnie (co dostajesz, widok w EUR albo PLN).' },
  ],
};

const SCX_STEPS: HelpStep[] = [
  { place: 'Kokpit', target: 'dash', text: 'Do zrobienia, w trasie, załadunki w 7 dni, do zafakturowania, najbliższy prom z prognozą morza, terminowość.' },
  { place: 'Ryzyka › Do zrobienia', target: 'risk/todo', text: 'Twoje sprawy: uzupełnij awizację, piloci (gdy transport ich wymaga), dodaj link śledzenia, numer zlecenia SCX, brakujące zezwolenie albo polisa, CMR z podpisem po dostawie, podpowiedzi dopłat po Twojej stronie. Filtry: Moje, Moja firma, Wszystkie. „Biorę tę sprawę” przypisuje sprawę Tobie.' },
  { place: 'Harmonogram', target: 'sched', text: 'Transporty z pliku KSH. Widzisz swój numer zlecenia i numer HHL. Filtry etapów i eksport tego, co widać. W zakładce „Rejsy” widzisz rejsy i dodajesz komunikat armatora. Zmiany dat i godzin z pliku KSH dostajesz w dzwonku; dat nie zmieniasz.' },
  { place: 'Panel transportu › Przegląd i awizacja', target: 'panel', text: 'Kliknij transport. Wpisujesz kierowcę, telefon, ciągnik i naczepę (przy przepięciu także odcinek SE), link śledzenia, armatora i rejs (do Szwecji) oraz numer zlecenia SCX. Zapis częściowy pokazuje „Brakuje: …”. Gdy transport wymaga pilotów (Kratownice, Płatwie PL-B), wpisujesz pilota PL i pilota SE: numer rejestracyjny oraz imię i nazwisko. W konwoju Kratownic z tego samego dnia wpisujesz pilotów raz — obowiązują dla wszystkich aut konwoju.' },
  { place: 'Panel transportu › Status i Czat', target: 'panel', text: 'Status zmieniasz ręcznie, tylko do przodu, z datą. W Czacie wybierasz „HHL, SCX, KSH” albo „tylko HHL i SCX”.' },
  { place: 'Mapa', target: 'map', text: 'Śledzenie z linku śledzenia: od 03:00 w dniu załadunku do „Dostarczone”. Auta na promie i w tym samym miejscu — jeden znacznik z liczbą.' },
  { place: 'Dokumenty', target: 'docs', text: 'Zezwolenie „Firma” wpisujesz raz (kraj, numer, ważność, limity, rodzaje ładunku) i podpina się samo do transportów. Zezwolenie „Trasa” wgrywasz przy transporcie. Twoją polisę OCP wgrywasz raz; po zatwierdzeniu przez HHL podpina się sama do dokumentów każdego transportu. Wgrywasz zawsze z wyborem transportu (albo „cała firma”) i rodzaju.' },
  { place: 'Dokumenty › CMR z podpisem odbiorcy', target: 'docs', text: 'Wgrywasz po „Dostarczone”, do 24\u00a0h. Transport przechodzi wtedy do „Gotowe do fakturowania”.' },
  { place: 'Moje stawki', target: 'fin', text: '„Twoja stawka” według etapu rozliczenia. Opłata paliwowa zawsze z tygodniem, w którym obowiązuje. Dopłaty po Twojej stronie (postój, anulowanie) system wylicza i podpowiada. Czy je dodać, decydujesz Ty; dodaną dopłatę akceptuje HHL.' },
  { place: 'Faktury', target: 'inv', text: 'Wystawiasz fakturę SCX dla HHL za transporty „Gotowe do fakturowania”. Przy fakturze wybierasz faktoring: prowizja 1% netto, wypłata 48\u00a0h po akceptacji przez HHL. Termin płatności: 35\u00a0dni od wystawienia.' },
  { place: 'Menu konta', target: 'konto', text: KONTO_ALL },
];

const SCX_DISPATCH: HelpVersion = {
  kind: 'CARRIER_DISPATCH',
  title: 'SCX Dyspozytor',
  intro: 'Prowadzisz awizację, dokumenty, statusy i faktury SCX. Numer zlecenia HHL widzisz tylko do odczytu.',
  steps: SCX_STEPS,
};

const SCX_USER: HelpVersion = {
  kind: 'CARRIER_USER',
  title: 'SCX Użytkownik',
  intro: 'Masz te same prawa i tę samą pracę co SCX Dyspozytor: awizacja, dokumenty, statusy, stawki i faktury SCX. Numer zlecenia HHL widzisz tylko do odczytu.',
  /* „Kroki 1–11: dosłownie jak w wersji 4” */
  steps: SCX_STEPS,
};

/** „Na telefonie” — na końcu każdej wersji, tylko przy szerokości telefonu (E8). */
export const HELP_PHONE_STEPS: HelpStep[] = [
  { place: 'Dolny pasek i konto', target: null, text: 'Na dole: Kokpit, Harmonogram, Ryzyka, Dokumenty i Więcej (reszta menu). Ikona konta u góry otwiera Moje konto, Dla mnie, Pomoc i motyw.' },
  { place: 'Instalacja i powiadomienia', target: 'konto', text: 'iPhone: „Dodaj do ekranu głównego”. Android: „Zainstaluj”. Powiadomienia na telefon włączasz w „Dla mnie”.' },
];

export const HELP_VERSIONS: Record<AccountKind, HelpVersion> = {
  HHL_ADMIN, HHL_OPS, CLIENT_USER: KSH_USER, CARRIER_DISPATCH: SCX_DISPATCH, CARRIER_USER: SCX_USER,
};

/** Okno śledzenia w tekstach Pomocy (E27). */
export const HELP_WINDOW = 'od 03:00 w dniu załadunku do „Dostarczone”';

/**
 * Wersja dla rodzaju konta (w Podglądzie — rodzaj domyślny podglądanej firmy, `viewedKind`).
 * Audyt 17.10 (D-20261017-0730-01 §4): dopóki okno śledzenia nie działa na serwerze (A1), zdanie o oknie
 * ma dopisek „włączamy wkrótce”.
 */
export function helpVersion(kind: AccountKind): HelpVersion {
  const v = HELP_VERSIONS[kind];
  if (serverRuleOn('TRACKING_WINDOW')) return v;
  return { ...v, steps: v.steps.map((s) => (s.text.includes(HELP_WINDOW) ? { ...s, text: s.text.replace(HELP_WINDOW, `${HELP_WINDOW} (${SOON})`) } : s)) };
}

/** Widok menu, który otwiera cel (do testu „każda pozycja menu ma krok”). */
export function targetView(target: HelpTarget): NavKey | null {
  if (target === 'konto' || target === 'podglad') return null;
  if (target === 'panel') return 'sched';
  if (target === 'options/users') return 'options';
  const i = target.indexOf('/');
  return (i < 0 ? target : target.slice(0, i)) as NavKey;
}
