/**
 * wyglad/P10b-c — przykłady demo ekranu Stan systemu (G-09: dane zmyślone, układ jak w makietach E23, E46, E19).
 * Wywoływane wyłącznie z `sysSource.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { AppErrors, OtherJob, Perf, SecRow, SourceRow } from './sysSource';
import { FUEL_FETCH_AT, fuelNextTryToday } from './p5bDemo';
import { fmtDate, TZ_OPS, wallLocalToIso } from './time';

const M = 60_000;
const ago = (nowIso: string, min: number) => new Date(Date.parse(nowIso) - min * M).toISOString();
const p2 = (n: number) => String(n).padStart(2, '0');
/** Dzień `daysBack` dni wcześniej (ujemne — później) o `hh:mm` czasu polskiego — także po zmianie czasu (F7 runda 2). */
const dayAt = (nowIso: string, daysBack: number, hh: number, mm: number) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_OPS }).format(new Date(nowIso));
  const [y, m, d] = today.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d - daysBack)).toISOString().slice(0, 10);
  return new Date(Date.parse(wallLocalToIso(`${day}T${p2(hh)}:${p2(mm)}`, TZ_OPS)!)).toISOString();
};
const hmNow = (nowIso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: TZ_OPS, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(nowIso));

/** A8 w demo: ta sama następna próba co ekran Opłata paliwowa (#563: do 23:15; potem jutro 07:15). */
function fuelNextTryAt(nowIso: string): string {
  const t = fuelNextTryToday(hmNow(nowIso));
  if (!t) return dayAt(nowIso, -1, Number(FUEL_FETCH_AT.slice(0, 2)), Number(FUEL_FETCH_AT.slice(3)));
  return dayAt(nowIso, 0, Number(t.slice(0, 2)), Number(t.slice(3)));
}

/** Przed 07:15 dzisiejszego pobierania jeszcze nie było — „od” liczone od wczoraj (F7 runda 2). */
const fuelBack = (nowIso: string) => (hmNow(nowIso) < FUEL_FETCH_AT ? 1 : 0);

/** Dzień tygodnia w Polsce: poniedziałek = 1. Alarm paliwa w demo (`demoFuelScreen`) jest od wtorku do niedzieli. */
const fuelAlarmDay = (nowIso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ_OPS, weekday: 'short' }).format(new Date(nowIso)) !== 'Mon';

export function demoSources(nowIso: string): SourceRow[] {
  const next = new Date(Date.parse(dayAt(nowIso, 2, 7, 0)) + 7 * 24 * 60 * M);
  const nextTxt = `${fmtDate(next.toISOString())}, 07:00`;
  return [
    /* F7 runda 3: „Nie działa” tylko wtedy, gdy ekran Opłata paliwowa ma alarm (brak ceny z wczoraj w tym samym tygodniu — nie w poniedziałek) */
    fuelAlarmDay(nowIso)
      ? { id: 'fuel', name: 'Ceny paliwa', cadence: '5× dziennie (07:15–23:15)', feeds: 'opłata paliwowa', lastAt: dayAt(nowIso, fuelBack(nowIso) + 1, 7, 15), state: 'down', since: dayAt(nowIso, fuelBack(nowIso), 7, 15), why: 'Strona Orlen nie odpowiada (5 prób z rzędu). Opłata paliwowa liczona z cen z poprzedniego odczytu.', nextTryAt: fuelNextTryAt(nowIso), canCheck: true }
      : { id: 'fuel', name: 'Ceny paliwa', cadence: '5× dziennie (07:15–23:15)', feeds: 'opłata paliwowa', lastAt: dayAt(nowIso, fuelBack(nowIso), 7, 15), state: 'ok', since: null, why: null, canCheck: true },
    { id: 'mail', name: 'Limit poczty', cadence: 'przy wysyłce i co godzinę', feeds: 'e-maile do użytkowników', lastAt: ago(nowIso, 4 * 24 * 60 + 150), state: 'nomeasure', since: ago(nowIso, 4 * 24 * 60 + 150), why: 'Zadanie nie ma harmonogramu, więc stary wynik nie jest błędem. Pomiar co godzinę.', canCheck: true },
    { id: 'weather', name: 'Pogoda morska', cadence: 'co godzinę', feeds: 'fala i wiatr na rejsach, sprawy promowe', lastAt: ago(nowIso, 17), state: 'partial', since: ago(nowIso, 2 * 24 * 60 + 136), why: 'DMI odmawia (za dużo zapytań) w każdym przebiegu, dane tylko z FMI. 8 z 24 godzin bez wyniku.', canCheck: true },
    /* wyglad/audyt-E (E-09; E49 16.10, 02:08 — D-20261016-0230-01 Z5): wiatr na drodze z SMHI, próg świeżości 2 h */
    { id: 'hazards', name: 'Zagrożenia na trasie', cadence: 'co godzinę', feeds: 'zamknięte mosty i drogi, przejazdy, śliskość do 25 km od auta', lastAt: ago(nowIso, 15), state: 'ok', since: null, why: 'Wiatr na drodze liczy osobne źródło „Wiatr — SMHI”. Zamknięty most albo droga przed autem — sprawa SCX „Objazd czy postój?”.', canCheck: true },
    { id: 'wind', name: 'Wiatr — SMHI', cadence: 'co godzinę', feeds: 'wiatr w ETA (od 20\u00a0m/s wolniej, od 25\u00a0m/s postój) i sprawy wiatru', lastAt: ago(nowIso, 12), state: 'ok', since: null, why: 'Ostatnie pobranie: 186 punktów trasy w Szwecji. Dane starsze niż 2 h — „Nie działa” i alarm do Administratorów HHL.', canCheck: true },
    { id: 'telematics', name: 'Telematyka naczep', cadence: 'emtrack · co 2 min', feeds: 'pozycje naczep na Mapie i w panelu, etapy drogi', lastAt: ago(nowIso, 3), state: 'ok', since: null, why: null, canCheck: true },
    { id: 'rio', name: 'Linki RIO podwykonawców', cadence: 'RIO · co 2 min', feeds: 'pozycje transportów podwykonawców SCX', lastAt: ago(nowIso, 2), state: 'ok', since: null, why: '„Nie działa” po 3 błędach z rzędu. Zapytania tylko w oknie śledzenia transportu.', canCheck: true },
    { id: 'ferry-pos', name: 'Pozycje promów', cadence: '3 źródła · 1–3 min', feeds: 'promy na Mapie, rejsy w pasku', lastAt: null, lastText: '3–12 min temu', state: 'ok', since: null, why: 'Liczy się najświeższe z 3 źródeł (Stena, AIS, Digitraffic).', canCheck: true },
    { id: 'ferry-status', name: 'Statusy rejsów', cadence: 'co 10 min', feeds: 'opóźnienia i odwołania', lastAt: ago(nowIso, 6), state: 'ok', since: null, why: null, canCheck: true },
    { id: 'schedule', name: 'Rozkład promów', cadence: 'co tydzień', feeds: 'rejsy do wyboru', lastAt: dayAt(nowIso, 2, 7, 0), state: 'ok', since: null, why: `Następny przebieg ${nextTxt}.`, canCheck: true },
    { id: 'road-se', name: 'Drogi w Szwecji', cadence: 'co 15 min', feeds: 'utrudnienia na trasie SE', lastAt: ago(nowIso, 7), state: 'ok', since: null, why: null, canCheck: true },
    { id: 'sms', name: 'Bramka SMS', cadence: 'co minutę', feeds: 'SMS do Śremu i Boden', lastAt: ago(nowIso, 1), state: 'ok', since: null, why: null, canCheck: true },
    { id: 'backup', name: 'Kopia zapasowa', cadence: 'raz dziennie', feeds: 'kopia bazy', lastAt: dayAt(nowIso, 0, 2, 30), state: 'ok', since: null, why: null, canCheck: false },
    { id: 'road-pl', name: 'Drogi w Polsce', cadence: null, feeds: 'utrudnienia na trasie PL', lastAt: null, state: 'nosource', since: null, why: 'Zadania jeszcze nie ma.', canCheck: false },
  ];
}

export function demoOtherJobs(nowIso: string): OtherJob[] {
  return [
    { id: 'notify', name: 'Wysyłka powiadomień', lastAt: ago(nowIso, 1), state: 'ok' },
    { id: 'push', name: 'Powiadomienia na telefon', lastAt: ago(nowIso, 1), state: 'ok' },
    { id: 'reminders', name: 'Przypomnienia o dokumentach', lastAt: ago(nowIso, 32), state: 'ok' },
    { id: 'cleanup', name: 'Porządki dokumentów', lastAt: dayAt(nowIso, 0, 4, 15), state: 'ok' },
    { id: 'usage', name: 'Zużycie limitów usług', lastAt: dayAt(nowIso, 0, 7, 0), state: 'ok' },
    { id: 'watchdog', name: 'Strażnik zadań', lastAt: ago(nowIso, 25), state: 'ok' },
  ];
}

export function demoAppErrors(nowIso: string): AppErrors {
  return {
    total7d: 146,
    newCount: 0,
    newSince: dayAt(nowIso, 1, 18, 12),
    groups: [
      { id: 'e1', message: "Cannot read properties of undefined (reading 'appendChild')", where: 'Harmonogram', people: 5, count: 95, builds: 15, firstAt: dayAt(nowIso, 3, 7, 17), lastAt: dayAt(nowIso, 2, 17, 31), state: 'fixed', stack: 'ScheduleView › tabela pliku › wiersz (render)', pages: ['Harmonogram'], roles: ['HHL Operacje', 'KSH Użytkownik'] },
      { id: 'e2', message: 'Stara wersja po wdrożeniu (Failed to fetch dynamically imported module)', where: 'Kokpit', people: 3, count: 39, builds: 21, firstAt: dayAt(nowIso, 6, 14, 49), lastAt: dayAt(nowIso, 2, 18, 12), state: 'known', stateNote: 'pasek „Jest nowa wersja”', stack: 'ładowanie części strony po wdrożeniu', pages: ['Kokpit', 'Mapa'], roles: ['HHL Administrator', 'SCX Dyspozytor'] },
      { id: 'e3', message: "Cannot read properties of undefined (reading '_leaflet_pos')", where: 'Panel transportu (mapa)', people: 2, count: 12, builds: 5, firstAt: dayAt(nowIso, 7, 14, 53), lastAt: dayAt(nowIso, 3, 7, 53), state: 'watch', stack: 'mapa w Przeglądzie › zamknięcie panelu w trakcie przybliżania', pages: ['Panel transportu'], roles: ['HHL Operacje'] },
    ],
  };
}

export function demoSecurity(nowIso: string): SecRow[] {
  /* E19 pkt 7: ostatni test bezpieczeństwa — data i commit (przykład, G-09) */
  const d = new Date(Date.parse(nowIso));
  const sun = new Date(d.getTime() - (d.getUTCDay() === 0 ? 7 : d.getUTCDay()) * 24 * 60 * M);
  const sunTxt = fmtDate(sun.toISOString(), 'UTC');
  return [
    { id: 'advisor', what: 'Doradca bezpieczeństwa bazy', state: 'ok', value: '0 nowych', details: 'Błędy: 0. Ostrzeżenia tylko z listy wyjątków: PostGIS, rozszerzenia i funkcje z listy dozwolonych, które sprawdzają konto w środku. Sprawdzane w niedzielnej bramie i przed wdrożeniem z migracją.' },
    { id: 'anon', what: 'Funkcje bez logowania', state: 'ok', value: '8 z listy', details: 'Kierowca 2 (wyłączone), bramka SMS 3, błędy przeglądarki 2, podtrzymanie bazy 1. Funkcja spoza listy zatrzymuje wdrożenie.' },
    { id: 'test', what: 'Test bezpieczeństwa', state: 'ok', value: `zielony · ${sunTxt}`, details: `Niedzielna brama ${sunTxt}, 22:00, commit 4f2a9c1: wszystkie przypadki bez błędów, w tym „Przeczytali”, zdarzenia statusu, sprawdzenie adresu i widoki cen.` },
    { id: 'mfa', what: 'Weryfikacja dwuetapowa', state: 'ok', value: 'dobrowolna · 1 z 3 kont HHL', details: 'Ile kont HHL ma drugi składnik. Weryfikacja dwuetapowa jest dobrowolna.' },
    { id: 'passwords', what: 'Hasła', state: 'ok', value: 'min. 12 znaków', details: 'Minimalna długość 12 znaków, litery i cyfry; ochrona przed wyciekniętymi hasłami (plan Pro).' },
  ];
}

export function demoPerf(nowIso: string): Perf {
  return {
    at: dayAt(nowIso, 2, 22, 0),
    rows: [
      { id: 'p1', what: 'Logowanie · telefon', how: 'LCP · CLS · TBT', result: '2,1 s · 0,02 · 180 ms', limit: 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms', ok: true },
      { id: 'p2', what: 'Strona „Brak połączenia” · telefon', how: 'LCP · CLS · TBT', result: '0,9 s · 0,00 · 0 ms', limit: 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms', ok: true },
      { id: 'p3', what: 'Logowanie · komputer', how: 'LCP · CLS · TBT', result: '2,9 s · 0,03 · 240 ms', limit: 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms', ok: false },
      { id: 'p4', what: 'Zapytania do transportów i wiadomości w bazie', how: 'najwolniejsze od ostatniego zerowania statystyk', result: '410 ms', limit: '≤ 500 ms', ok: true },
      { id: 'p5', what: 'Równoczesność', how: '20 sesji przez 10 min', result: '0 błędów', limit: '0 błędów', ok: true },
    ],
  };
}
