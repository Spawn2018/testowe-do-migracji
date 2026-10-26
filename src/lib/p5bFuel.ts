/**
 * wyglad/P5-b — Opcje › Pieniądze: kształty danych ekranów i czyste funkcje widoku (bez zapytań i zapisów).
 * Opłata paliwowa według E3 (img/e3-opcje-desk, img/e3-opcje-phone) i E39 (jedna nazwa, tydzień obowiązywania i tydzień
 * wskaźników); Dopłaty (postój) i Cennik (procenty za anulowanie, próg marży) według E33, E16 i E12; Terminy płatności
 * i adresy księgowości według E40 i E12. Dane podaje `p5bSource.ts` (demo — przykład; produkcja — podłącza wykonawca w P5).
 */

export type FuelSource = 'OKQ8' | 'ORLEN';

/** Wiersz tabeli mnożników z załącznika do umowy: średnia cena od–do (włącznie) → mnożnik. */
export interface FuelTier { from: number; to: number; mult: number }

/** Średnia z publikacji tygodnia wskaźników, liczba publikacji i mnożnik z tabeli. */
export interface FuelIdx { avg: number | null; n: number; mult: number | null }

/** Tydzień obowiązywania (załadunki pn–nd) i tydzień wskaźników (poprzedni), jak w `sefs_week_calc`. */
export interface FuelWeekView {
  from: string;
  to: string;
  idxFrom: string;
  idxTo: string;
  okq8: FuelIdx;
  orlen: FuelIdx;
  /** Stosowany — niższy z dwóch mnożników. */
  applied: number | null;
  /** true = ostateczny (tydzień wskaźników zamknięty), false = prognoza. */
  final: boolean;
}

/** Przyszły tydzień: prognoza (ostatni ostateczny) i dzień, od którego będzie ostateczny. */
export interface FuelNextView { from: string; to: string; idxFrom: string; idxTo: string; forecast: number | null; finalOn: string }

/** Cena z jednego dnia: wartość obowiązująca tego dnia i data publikacji, gdy inna niż dzień (powtórzona cena). */
export interface FuelDayRow {
  date: string;
  okq8: number | null;
  okq8Pub: string | null;
  orlen: number | null;
  orlenPub: string | null;
  /** AUTO — pobrane o godzinie `at`; FILLED — uzupełnione; MISSING — brak ceny jednego ze źródeł. */
  how: 'AUTO' | 'FILLED' | 'MISSING';
  at: string | null;
  /** Przy MISSING: którego źródła brakuje i dlaczego (np. „błąd połączenia”). */
  missing: { source: FuelSource; why: string } | null;
}

export interface FuelDayGroup {
  from: string;
  to: string;
  /** Tydzień zamknięty: średnie i mnożnik („→ ×1,13”); otwarty — „liczy przyszły tydzień”. */
  closed: { okq8: number | null; orlen: number | null; mult: number | null } | null;
  rows: FuelDayRow[];
}

/** Stan pobierania jednego dnia: true — pobrane, false — błąd, null — jeszcze nie było próby. */
export interface FuelFetchDay { date: string; okq8: boolean | null; orlen: boolean | null }

export interface FuelAlarm {
  source: FuelSource;
  date: string;
  /** Godzina nieudanej próby („07:15”). */
  at: string;
  /** Cena opublikowana tego dnia przez źródło (gdy znana z historii źródła). */
  published: number | null;
  /** Tydzień załadunków, na który wpływa brak. */
  affectsFrom: string;
  affectsTo: string;
  /** Następna automatyczna próba („13:15”); null — prób dziś już nie będzie. */
  nextTry: string | null;
}

export interface FuelScreenView {
  contract: { version: number; from: string; agreed: boolean };
  alarm: FuelAlarm | null;
  current: FuelWeekView;
  next: FuelNextView;
  fetch: { at: string; retries: string[]; today: FuelFetchDay; yesterday: FuelFetchDay };
  /** Stawka bazowa do przykładu w „Jak liczymy” (fracht SG z cennika przewoźnika). */
  exampleBaseEur: number;
  /** Ceny z ostatnich 2 tygodni: najpierw tydzień bieżący (liczy przyszły tydzień), potem poprzedni. */
  days: FuelDayGroup[];
  tiers: { sek: FuelTier[]; pln: FuelTier[] };
}

export interface FuelActions {
  /** „Uzupełnij z Orlen” (Administrator HHL): dociągnięcie ceny z historii źródła. */
  fill: ((source: FuelSource, date: string) => Promise<boolean>) | null;
  /** „Nowa wersja umowy”: otwiera zapis nowej wersji załącznika (parametry i tabela). */
  newVersion: (() => void) | null;
}

/** „+13 %” z mnożnika 1,13. */
export function pctOf(mult: number | null): number | null {
  return mult == null ? null : Math.round((mult - 1) * 1000) / 10;
}

/** Opłata = stawka × (mnożnik − 1), zaokrąglona do grosza. */
export function feeOf(base: number, mult: number | null): number | null {
  return mult == null ? null : Math.round(base * (mult - 1) * 100) / 100;
}

/**
 * Wiersz tabeli dla średniej — na zakresach z `tiersFromDb(…, bound)`.
 * #563/F7: przy poprawnych from/to (MIN albo MAX) trafienie = pierwszy wiersz z `to` ≥ średnia;
 * poniżej tabeli — pierwszy, powyżej — ostatni. Nie wołaj na surowych `{lte,mult}` bez `tiersFromDb`.
 */
export function tierOf(tiers: readonly FuelTier[], avg: number | null): number {
  if (avg == null || tiers.length === 0) return -1;
  const v = Math.round(avg * 100) / 100;
  const i = tiers.findIndex((t) => v <= t.to + 1e-9);
  return i < 0 ? tiers.length - 1 : i;
}

/** „Wokół obecnych cen”: 5 wierszy z trafionym w środku (na brzegu tabeli — przesunięte). */
export function tiersAround(tiers: readonly FuelTier[], avg: number | null, half = 2): { rows: FuelTier[]; hit: number } {
  const i = tierOf(tiers, avg);
  if (i < 0) return { rows: tiers.slice(0, half * 2 + 1), hit: -1 };
  const start = Math.max(0, Math.min(i - half, tiers.length - (half * 2 + 1)));
  const rows = tiers.slice(start, start + half * 2 + 1);
  return { rows, hit: i - start };
}

/* ---------- Dopłaty (postój), Cennik (anulowanie, próg marży), Terminy płatności ---------- */

/** Postój (E33, decyzje 07.10 12:23 i 12:35): czas wolny, stawki i chwila, od której liczymy. */
export interface DwellRulesView {
  freeLoadH: number;
  freeUnloadH: number;
  hourEur: number;
  dayEur: number;
  /** Stawka dobowa powyżej tylu godzin postoju. */
  dayAfterH: number;
  /** LATER — od późniejszego z: wjazd do strefy, plan; ENTRY — od wjazdu do strefy. */
  startFrom: 'LATER' | 'ENTRY';
  /** FULL — każda rozpoczęta godzina; FRACTION — za faktyczny czas. */
  hourMode: 'FULL' | 'FRACTION';
  /** Ostatnia zmiana (Historia zmian): kiedy i kto. */
  changed: { at: string; by: string } | null;
}

/** Procent frachtu (bez opłaty paliwowej) według dni kalendarzowych przed załadunkiem; 5 = 5 i więcej.
 *  `example` — fracht z aktualnego cennika do kwot przy procentach (np. SG: koszt 6 900, przychód 7 245 EUR);
 *  null — bez przykładu. */
export interface CancelRulesView {
  pct: Record<number, number>;
  example: { label: string; costEur: number; revEur: number } | null;
  changed: { at: string; by: string } | null;
}

/**
 * wyglad/audyt-E (E-06, C-14; E33 08.10, E11 „Cennik: wersje KSH 1 i 2, SCX 1; po 12 pozycji, 10 symboli”):
 * cennik według symboli. Kwoty netto w EUR, za jeden transport, bez opłaty paliwowej; VAT dolicza system na fakturze.
 */
export interface RateCardRow {
  /** klucz pozycji: „SG”, „KR-1” (Kratownice, 1 auto w konwoju) */
  id: string;
  /** symbol z tabeli symboli: „SG”, „KR”, „PL-A” */
  symbol: string;
  /** liczba aut w konwoju — tylko KR */
  convoy?: number;
  /** „Słupy główne” */
  kind: string;
  /** zestaw z ładunkiem w metrach: D — długość, S — szerokość, W — wysokość (tabela symboli) */
  set: { l: number; w: number; h: number } | null;
  /** koszt — cennik SCX */
  costEur: number;
  /** przychód — cennik KSH */
  revEur: number;
}
/** Wersja cennika jednej strony: „KSH v2 od 28.09.2026”. Nowa wersja kończy poprzednią dzień przed `from`. */
export interface RateCardVersion { side: 'KSH' | 'SCX'; v: number; from: string; note: string | null; at: string; by: string }
export interface RateCardView { rows: RateCardRow[]; ksh: RateCardVersion; scx: RateCardVersion }
/** Zapis nowej wersji: strona, data „od” (RRRR-MM-DD), ceny pozycji (id → EUR), powód. */
export type RateCardSave = (side: 'KSH' | 'SCX', from: string, prices: Record<string, number>, note: string) => Promise<boolean>;

/** Terminy płatności od daty wystawienia faktury (24.09): KSH płaci HHL, HHL płaci SCX. */
export interface PaymentTermsView { kshDays: number; scxDays: number; changed: { at: string; by: string } | null }

/** Klucze listy „procenty za anulowanie” w kolejności tabeli: ≥ 5 dni … dzień załadunku. */
export const CANCEL_DAYS = [5, 4, 3, 2, 1, 0] as const;

/** Prosty adres e-mail do sprawdzenia przed dodaniem (to samo sprawdza baza, 0285). */
export function looksLikeEmail(s: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.trim());
}
