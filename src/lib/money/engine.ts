/**
 * TOWER — silnik pieniędzy: waluta, kurs, opłata paliwowa, poziomy wyceny, marża,
 * dopasowanie faktury.
 *
 * DECYZJE WŁAŚCICIELA (24.09.2026) — ten plik je implementuje, nie interpretuje:
 *
 *  1. WALUTA. Wszystkie ceny w EUR. Każdy użytkownik może w swoich
 *     ustawieniach przełączyć walutę wyświetlania na PLN — wtedy przeliczenie
 *     działa WSZĘDZIE, nie tylko na kokpicie (decyzja z 24.09.2026 zastąpiła
 *     wcześniejszą „PLN tylko na kokpicie"). SEK nigdzie. Wyjątki pokazywane
 *     w walucie źródłowej: dane indeksu paliwowego, suma gwarancyjna polisy,
 *     kwoty na fakturze (dokument jest nadrzędny).
 *
 *  2. KURS. Przewoźnik wystawiając fakturę bierze kurs średni NBP, tabela A,
 *     z dnia roboczego poprzedzającego dzień rozładunku. „Dzień roboczy" =
 *     dzień, w którym NBP opublikował tabelę — dzięki temu nie utrzymujemy
 *     kalendarza świąt. Sprawdzone na żywym API: 24–28.12.2025 NBP nie
 *     publikował (Wigilia jest dniem wolnym od 2025), więc rozładunek
 *     29.12.2025 bierze kurs z 23.12.2025, a nie z 26.12.
 *
 *  3. OPŁATA PALIWOWA. Ten sam mechanizm po obu stronach (koszt i przychód).
 *     Mechanizm: SEFS hybrid_min — appliedMult = Math.min(multSek, multPln),
 *     zastosowany wyłącznie do stawki drogowej. Źródłem prawdy jest
 *     dokumentacja projektu i src/lib/sefs.ts w aplikacji. TEN PLIK NIE
 *     REIMPLEMENTUJE MECHANIZMU — przyjmuje jego wynik jako migawkę.
 *     D-34 (04.10): tydzień opłaty = data załadunku, nie rozładunek.
 *
 *  4. CZAS. Realizacja usługi = rozładunek (potwierdzone przez właściciela). Faktura obejmuje transporty
 *     zrealizowane w danym tygodniu (tydzień rozładunku). Kurs NBP: dzień rozładunku.
 *     Opłata paliwowa: data załadunku (D-34). Trzy poziomy wyceny (kwota, nie tydzień paliwa):
 *       PROGNOZA    — niedostarczony
 *       REALIZACJA  — dostarczony: migawka kursu z rozładunku, paliwa z załadunku
 *       FAKTURA     — zafakturowany: kwota z faktury NADRZĘDNA
 *     Faktura nadpisuje wynik, ale NIE kasuje wartości wyliczonej —
 *     inaczej dopasowanie trójstronne porównuje fakturę samą ze sobą.
 *
 *  5. FAKTURY. Wystawiane w systemach zewnętrznych HHL i SCX, rejestrowane
 *     tu z plikiem. Waluta faktury: EUR albo PLN — wybiera wystawca.
 *     Faktura PLN: kurs per pozycja, z dnia roboczego przed rozładunkiem
 *     danego transportu. Termin płatności liczony przez system.
 *     Oznaczenie „Opłacona" — wyłącznie HHL, ręcznie.
 *
 * Wszystko tu jest funkcją czystą poza fetchNbpEurRange(). Każde wyliczenie
 * zwraca migawkę wejść, żeby spór o fakturę dało się rozstrzygnąć danymi.
 */

export const CURRENCY = 'EUR' as const;
export const TZ_OPERACYJNA = 'Europe/Warsaw';   // = Europe/Stockholm co do przesunięcia i DST

export type PricingTier = 'PROGNOZA' | 'REALIZACJA' | 'FAKTURA';

const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/* =====================================================================
 * 1. CZAS LOKALNY — dzień i tydzień NIGDY w UTC
 *
 * Daty przechowujemy w UTC. Dzień rozładunku i tydzień faktury liczymy
 * w czasie lokalnym. Przykład błędu, przed którym to chroni:
 * rozładunek we wtorek 00:30 czasu lokalnego = poniedziałek 22:30 UTC latem.
 * W UTC „dzień poprzedzający" byłby piątkiem, lokalnie — poniedziałkiem.
 * Dwa różne kursy dla tego samego transportu.
 * ===================================================================== */

/** 'YYYY-MM-DD' w strefie operacyjnej. */
export function localDateOf(isoUtc: string, tz: string = TZ_OPERACYJNA): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) throw new Error(`Niepoprawna data: ${isoUtc}`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Klucz tygodnia ISO ('2026-W41') liczony z daty LOKALNEJ. */
export function isoWeekKeyLocal(isoUtc: string, tz: string = TZ_OPERACYJNA): string {
  const [y, m, d] = localDateOf(isoUtc, tz).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

const addDaysIso = (dateIso: string, n: number) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};

/* =====================================================================
 * 2. KURS NBP — tabela A, dzień roboczy poprzedzający dzień rozładunku
 * ===================================================================== */

export interface NbpRate {
  table: 'A';
  no: string;              // np. '186/A/NBP/2026' — numer tabeli, do faktury i audytu
  effectiveDate: string;   // 'YYYY-MM-DD'
  mid: number;             // PLN za 1 EUR
}

/**
 * Ostatnia opublikowana tabela z datą ŚCIŚLE WCZEŚNIEJSZĄ niż dzień rozładunku.
 * „Dzień roboczy" = dzień publikacji tabeli przez NBP, więc weekendy i święta
 * obsługują się same, bez kalendarza.
 *
 * Dla daty przyszłej (poziom PROGNOZA) zwraca najnowszą znaną tabelę —
 * wynik jest wtedy prowizoryczny i tak musi być oznaczony.
 *
 * Brak tabeli = wyjątek. Nie zgadujemy kursu.
 */
export function nbpRateBefore(rates: NbpRate[], localUnloadDate: string): NbpRate {
  const candidates = rates
    .filter((r) => r.effectiveDate < localUnloadDate)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const hit = candidates[candidates.length - 1];
  if (!hit) {
    throw new Error(
      `Brak tabeli A NBP przed ${localUnloadDate}. Pobierz szerszy przedział — nie zgaduj kursu.`
    );
  }
  return hit;
}

/**
 * Pobranie tabel A dla EUR z przedziału. NIGDY nie pytaj o pojedynczy dzień:
 * dla dnia bez publikacji API zwraca 404 „Brak danych". Przedział 14 dni
 * wstecz pokrywa najdłuższą przerwę świąteczną (24–28.12: pięć dni bez tabeli).
 * Maksymalny przedział w jednym zapytaniu API NBP: 93 dni.
 */
export async function fetchNbpEurRange(fromIso: string, toIso: string): Promise<NbpRate[]> {
  const url = `https://api.nbp.pl/api/exchangerates/rates/a/eur/${fromIso}/${toIso}/?format=json`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`NBP ${res.status} dla ${fromIso}–${toIso}`);
  const json = (await res.json()) as {
    rates: Array<{ no: string; effectiveDate: string; mid: number }>;
  };
  return json.rates.map((r) => ({ table: 'A' as const, no: r.no, effectiveDate: r.effectiveDate, mid: r.mid }));
}

/** Kurs dla transportu: przedział [dzień − 14, dzień − 1], ostatnia tabela. */
export async function fetchNbpRateForUnload(localUnloadDate: string): Promise<NbpRate> {
  const rates = await fetchNbpEurRange(addDaysIso(localUnloadDate, -14), addDaysIso(localUnloadDate, -1));
  return nbpRateBefore(rates, localUnloadDate);
}

/* =====================================================================
 * 3. OPŁATA PALIWOWA — migawka wyniku mechanizmu, nie jego reimplementacja
 *
 * Mechanizm liczy aplikacja (computeSefs / applySefsToRoadRate).
 * Tu przyjmujemy stawkę drogową PRZED i PO zastosowaniu mechanizmu —
 * dzięki temu ten plik nie zakłada, czy mechanizm zwraca mnożnik,
 * procent czy kwotę. Kwota opłaty = po − przed.
 * ===================================================================== */

export interface FuelSnapshot {
  mechanism: 'SEFS_HYBRID_MIN';
  referenceDate: string;      // lokalna data załadunku (D-34), nie rozładunku
  multSek: number;            // składnik hybrid_min, do audytu
  multPln: number;            // składnik hybrid_min, do audytu
  appliedMultiplier: number;  // = Math.min(multSek, multPln)
  documentRef: string;        // plik dokumentacji mechanizmu, z którego pochodzi reguła
}

export function hybridMin(multSek: number, multPln: number): number {
  return Math.min(multSek, multPln);
}

/* =====================================================================
 * 4. POZIOM WYCENY
 * ===================================================================== */

export interface LoadTiming {
  plannedDeliveryUtc: string;          // z harmonogramu — kotwica kursu, nie paliwa
  unloadedAtUtc?: string | null;       // rzeczywisty rozładunek = realizacja usługi i kurs NBP
  /** Rzeczywisty załadunek (UTC). Wygrywa z planem przy opłacie paliwowej. */
  loadedAtUtc?: string | null;
  /** Planowana data załadunku YYYY-MM-DD, gdy nie ma rzeczywistego załadunku. */
  plannedLoadDate?: string | null;
  invoiced?: boolean;
}

export function resolveTier(t: LoadTiming): PricingTier {
  if (t.invoiced) return 'FAKTURA';
  if (t.unloadedAtUtc) return 'REALIZACJA';
  return 'PROGNOZA';
}

/**
 * D-34: lokalna data załadunku (Europe/Warsaw). Nie rozładunek.
 * Brak daty załadunku → null. Nie podstawiamy dostawy.
 */
export function fuelLocalDate(t: LoadTiming): string | null {
  if (t.loadedAtUtc) return localDateOf(t.loadedAtUtc);
  if (t.plannedLoadDate && /^\d{4}-\d{2}-\d{2}$/.test(t.plannedLoadDate)) return t.plannedLoadDate;
  return null;
}

/** Moment załadunku do migawki paliwa. Null, gdy nie ma daty załadunku. */
export function referenceUtc(t: LoadTiming): string | null {
  if (t.loadedAtUtc) return t.loadedAtUtc;
  const day = fuelLocalDate(t);
  return day ? `${day}T12:00:00+02:00` : null;
}

/** Kurs NBP: rozładunek, a przed nim planowana dostawa. Nie data paliwa. */
export function fxReferenceUtc(t: LoadTiming): string {
  return t.unloadedAtUtc ?? t.plannedDeliveryUtc;
}

/* =====================================================================
 * 5. CENNIK — przedziały, stawki w EUR
 * ===================================================================== */

export interface Dimensions { lengthM: number; widthM: number; heightM: number; weightT: number }

export interface RateRule {
  id: string;
  lengthFrom: number; lengthTo: number;
  widthFrom: number;  widthTo: number;
  heightFrom: number; heightTo: number;
  weightFrom: number; weightTo: number;
  roadRateEur: number;
  /** I-12 (D-8): STANDARD; I-30: SYMBOL (max wymiary + rodzina/konwój); brak = DIMENSIONED */
  cargoClass?: 'DIMENSIONED' | 'STANDARD' | 'SYMBOL';
  symbol?: string;
  family?: string;
  convoyCars?: number | null;
}

export type RateMatchResult =
  | { matched: true; rule: RateRule; roadRateEur: number; heightAdopted?: boolean }
  | { matched: false; reason: 'NO_BRACKET'; dims: Dimensions }
  | { matched: false; reason: 'AMBIGUOUS'; candidates: RateRule[] };

/** Brak dopasowania nie daje zera — transport wypada na listę wyjątków. */
export function matchRate(dims: Dimensions, rules: RateRule[]): RateMatchResult {
  const hits = rules.filter(
    (r) =>
      dims.lengthM >= r.lengthFrom && dims.lengthM <= r.lengthTo &&
      dims.widthM  >= r.widthFrom  && dims.widthM  <= r.widthTo  &&
      dims.heightM >= r.heightFrom && dims.heightM <= r.heightTo &&
      dims.weightT >= r.weightFrom && dims.weightT <= r.weightTo
  );
  if (hits.length === 0) return { matched: false, reason: 'NO_BRACKET', dims };
  if (hits.length > 1)  return { matched: false, reason: 'AMBIGUOUS', candidates: hits };
  return { matched: true, rule: hits[0], roadRateEur: hits[0].roadRateEur };
}

/* =====================================================================
 * 5a. I-12 (D-8) — ładunek STANDARD: osobna stała stawka z cennika
 *
 * cargo_class = STANDARD → pozycja STANDARD (jedna na cennik i stronę).
 * Brak pozycji STANDARD NIE daje zera — wynik `NO_STANDARD_RATE` (ostrzeżenie, lista wyjątków).
 * Pozycja STANDARD nie bierze udziału w dopasowaniu po wymiarach. Paliwo i kurs — ten sam mechanizm
 * co dla stawki drogowej (buildPriceSide / assertSameMechanism). Kwot nie wymyślamy (D-1).
 * ===================================================================== */

export type CargoClass = 'DIMENSIONED' | 'STANDARD' | 'SYMBOL';

export type RateForCargoResult =
  | RateMatchResult
  | { matched: false; reason: 'NO_STANDARD_RATE' }
  | { matched: false; reason: 'NO_DIMENSIONS' }
  | { matched: false; reason: 'NO_FAMILY' }
  | { matched: false; reason: 'NO_CONVOY' }
  | { matched: false; reason: 'NO_PRICE' };

/** Prefiks numeru wysyłki → rodzina (TS≠T, SS≠SG). */
export function shipmentFamily(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  if (/^TS([.-]|$)/.test(c)) return 'TS';
  if (/^SS([.-]|$)/.test(c)) return 'SS';
  if (/^SG([.-]|$)/.test(c)) return 'SG';
  if (/^BS([.-]|$)/.test(c)) return 'BS';
  if (/^KR([.-]|$)/.test(c)) return 'KR';
  if (/^PL([.-]|$)/.test(c)) return 'PL';
  if (/^T([.-]|$)/.test(c)) return 'T';
  return null;
}

const bySmallestMax = (a: RateRule, b: RateRule) =>
  a.lengthTo - b.lengthTo || a.widthTo - b.widthTo || a.heightTo - b.heightTo || a.weightTo - b.weightTo
  || (a.symbol ?? '').localeCompare(b.symbol ?? '');

/**
 * I-30 — dobór pozycji według symbolu / wariantu / konwoju.
 * Kwoty testowe wyłącznie zmyślone — nigdy z pliku poufnego.
 */
export function matchRateBySymbol(input: {
  shipmentCode: string;
  dims: Dimensions | null;
  /** Liczba KR z tą samą datą załadunku; wymagane dla rodziny KR. */
  convoyCount?: number | null;
  rules: RateRule[];
}): RateForCargoResult & { heightAdopted?: boolean; convoyCapped?: boolean } {
  const family = shipmentFamily(input.shipmentCode);
  if (!family) return { matched: false, reason: 'NO_FAMILY' };
  let dims = input.dims;
  if (!dims) return { matched: false, reason: 'NO_DIMENSIONS' };

  let heightAdopted = false;
  const code = input.shipmentCode.trim().toUpperCase();
  if (family === 'PL' && ['PL-1', 'PL-10.1', 'PL-17.1'].includes(code) && Math.abs(dims.heightM - 2.6) < 1e-9) {
    dims = { ...dims, heightM: 2.45 };
    heightAdopted = true;
  }

  let convoyCap: number | null = null;
  let convoyCapped = false;
  if (family === 'KR') {
    const n = input.convoyCount;
    if (n == null || n < 1) return { matched: false, reason: 'NO_CONVOY' };
    if (n > 3) { convoyCap = 3; convoyCapped = true; }
    else convoyCap = n;
  }

  const pool = input.rules
    .filter((r) => (r.cargoClass ?? 'DIMENSIONED') === 'SYMBOL' && r.family === family)
    .filter((r) => family !== 'KR' || r.convoyCars === convoyCap);

  const covers = (r: RateRule, h: number) =>
    dims!.lengthM <= r.lengthTo && dims!.widthM <= r.widthTo && h <= r.heightTo && dims!.weightT <= r.weightTo;

  const full = pool.filter((r) => covers(r, dims!.heightM)).sort(bySmallestMax);
  if (full.length) {
    return { matched: true, rule: full[0], roadRateEur: full[0].roadRateEur, heightAdopted, convoyCapped };
  }

  const heightOnly = pool
    .filter((r) => dims!.lengthM <= r.lengthTo && dims!.widthM <= r.widthTo && dims!.weightT <= r.weightTo && dims!.heightM > r.heightTo)
    .sort(bySmallestMax);
  if (heightOnly.length) {
    return {
      matched: true, rule: heightOnly[0], roadRateEur: heightOnly[0].roadRateEur,
      heightAdopted: true, convoyCapped,
    };
  }
  return { matched: false, reason: 'NO_PRICE' };
}

export function matchRateForCargo(cargo: { cargoClass: CargoClass; dims: Dimensions | null }, rules: RateRule[]): RateForCargoResult {
  if (cargo.cargoClass === 'STANDARD') {
    const std = rules.filter((r) => r.cargoClass === 'STANDARD');
    if (std.length === 0) return { matched: false, reason: 'NO_STANDARD_RATE' };
    if (std.length > 1) return { matched: false, reason: 'AMBIGUOUS', candidates: std };
    return { matched: true, rule: std[0], roadRateEur: std[0].roadRateEur };
  }
  if (!cargo.dims) return { matched: false, reason: 'NO_DIMENSIONS' };
  return matchRate(cargo.dims, rules.filter((r) => r.cargoClass !== 'STANDARD' && r.cargoClass !== 'SYMBOL'));
}

/** Klucz komunikatu ostrzeżenia (i18n `i12_warn_*` / `i30_warn_*`) albo null, gdy stawka jest. */
export function rateWarningKey(r: RateForCargoResult): string | null {
  if (r.matched) return null;
  if (r.reason === 'NO_PRICE' || r.reason === 'NO_FAMILY' || r.reason === 'NO_CONVOY') {
    return `i30_warn_${r.reason}`;
  }
  return `i12_warn_${r.reason}`;
}

/* =====================================================================
 * 6. STRONA CENY — koszt albo przychód, zawsze w EUR
 * ===================================================================== */

export interface Extra { code: string; label: string; amountEur: number }

export interface PriceSide {
  currency: typeof CURRENCY;
  tier: PricingTier;
  roadRateEur: number;
  fuelAmountEur: number;        // = stawka po mechanizmie − przed
  extras: Extra[];              // pilotaż, prom, postojowe — BEZ opłaty paliwowej
  extrasEur: number;
  computedTotalEur: number;     // wynik mechanizmu — ZAWSZE zachowany
  invoicedTotalEur: number | null;  // z faktury, gdy przyjdzie
  effectiveTotalEur: number;    // faktura, jeśli jest; inaczej wyliczenie
  fuel: FuelSnapshot;
  fx: NbpRate;                  // kurs wg reguły; na poziomie FAKTURA — kurs z faktury
  fxProvisional: boolean;       // true dla PROGNOZA z datą w przyszłości
}

export function buildPriceSide(args: {
  tier: PricingTier;
  roadRateEur: number;
  roadRateAfterFuelEur: number;   // z applySefsToRoadRate w aplikacji
  extras?: Extra[];
  fuel: FuelSnapshot;
  fx: NbpRate;
  fxProvisional?: boolean;
  invoicedTotalEur?: number | null;
}): PriceSide {
  const extras = args.extras ?? [];
  const extrasEur = round(extras.reduce((s, e) => s + e.amountEur, 0));
  const fuelAmountEur = round(args.roadRateAfterFuelEur - args.roadRateEur);
  const computedTotalEur = round(args.roadRateEur + fuelAmountEur + extrasEur);
  const invoiced = args.invoicedTotalEur ?? null;
  if (args.tier === 'FAKTURA' && invoiced === null) {
    throw new Error('Poziom FAKTURA bez kwoty z faktury');
  }
  return {
    currency: CURRENCY,
    tier: args.tier,
    roadRateEur: round(args.roadRateEur),
    fuelAmountEur,
    extras,
    extrasEur,
    computedTotalEur,
    invoicedTotalEur: invoiced,
    effectiveTotalEur: invoiced ?? computedTotalEur,
    fuel: args.fuel,
    fx: args.fx,
    fxProvisional: args.fxProvisional ?? false,
  };
}

/* =====================================================================
 * 7. NIEZMIENNIK „TEN SAM MECHANIZM PO OBU STRONACH"
 *
 * Nie testujemy stałości marży procentowej — ta się zmienia, bo mechanizm
 * obejmuje tylko stawkę drogową, a prom i pilotaż nie. Testujemy równość
 * mnożnika i daty odniesienia po obu stronach.
 * ===================================================================== */

export function assertSameMechanism(cost: PriceSide, revenue: PriceSide): void {
  if (cost.fuel.referenceDate !== revenue.fuel.referenceDate) {
    throw new Error(`Różne daty opłaty paliwowej: koszt ${cost.fuel.referenceDate}, przychód ${revenue.fuel.referenceDate}`);
  }
  if (cost.fuel.appliedMultiplier !== revenue.fuel.appliedMultiplier) {
    throw new Error(`Różne mnożniki paliwowe: koszt ${cost.fuel.appliedMultiplier}, przychód ${revenue.fuel.appliedMultiplier}`);
  }
  if (cost.tier !== 'FAKTURA' && revenue.tier !== 'FAKTURA' && cost.fx.no !== revenue.fx.no) {
    throw new Error(`Różne tabele kursowe przed fakturą: koszt ${cost.fx.no}, przychód ${revenue.fx.no}`);
  }
}

/* =====================================================================
 * 8. MARŻA — EUR jako waluta źródłowa; PLN jako przeliczenie wyświetlania
 *
 * PLN liczony per transport, każda strona swoim kursem, zaokrąglenie
 * per transport, potem suma. Tak robi księgowość — inaczej grosze
 * rozjadą się z fakturami. Waluta wyświetlania to ustawienie użytkownika.
 * ===================================================================== */

export type DisplayCurrency = 'EUR' | 'PLN';

export const eurToPln = (eur: number, fx: NbpRate) => round(eur * fx.mid);

export interface LoadMargin {
  tier: PricingTier;
  revenueEur: number;
  costEur: number;
  marginEur: number;
  marginPct: number | null;
  /** Przeliczenie dla użytkowników z walutą wyświetlania PLN. */
  pln: { revenue: number; cost: number; margin: number; provisional: boolean };
}

export function marginForLoad(cost: PriceSide, revenue: PriceSide): LoadMargin {
  const revenueEur = revenue.effectiveTotalEur;
  const costEur = cost.effectiveTotalEur;
  const marginEur = round(revenueEur - costEur);
  const revPln = eurToPln(revenueEur, revenue.fx);
  const costPln = eurToPln(costEur, cost.fx);
  // poziom transportu = poziom najmniej pewnej strony
  const order: PricingTier[] = ['PROGNOZA', 'REALIZACJA', 'FAKTURA'];
  const tier = order[Math.min(order.indexOf(cost.tier), order.indexOf(revenue.tier))];
  return {
    tier,
    revenueEur, costEur, marginEur,
    marginPct: revenueEur === 0 ? null : round(marginEur / revenueEur, 4),
    pln: {
      revenue: revPln, cost: costPln, margin: round(revPln - costPln),
      provisional: cost.fxProvisional || revenue.fxProvisional,
    },
  };
}

/** Wartość do wyświetlenia w walucie wybranej przez użytkownika. */
export function marginIn(m: LoadMargin, cur: DisplayCurrency) {
  return cur === 'EUR'
    ? { revenue: m.revenueEur, cost: m.costEur, margin: m.marginEur, provisional: false }
    : m.pln;
}

/** Sumy rozbite na trzy poziomy pewności, w obu walutach. */
export function totalsByTier(loads: LoadMargin[]) {
  const empty = () => ({ count: 0, marginEur: 0, marginPln: 0 });
  const acc: Record<PricingTier, ReturnType<typeof empty>> = {
    FAKTURA: empty(), REALIZACJA: empty(), PROGNOZA: empty(),
  };
  for (const l of loads) {
    const a = acc[l.tier];
    a.count += 1;
    a.marginEur = round(a.marginEur + l.marginEur);
    a.marginPln = round(a.marginPln + l.pln.margin);
  }
  return acc;
}

/* =====================================================================
 * 9. FAKTURY — rejestracja, dopasowanie, termin, płatność
 *
 * Faktury powstają w systemach zewnętrznych (HHL i SCX) i są tu rejestrowane
 * z plikiem PDF. Dwa kierunki:
 *   KOSZT     — wystawca SCX, odbiorca HHL. Widzą: SCX i HHL. KSH nigdy.
 *   PRZYCHOD  — wystawca HHL, odbiorca KSH. Widzą: HHL i KSH. SCX nigdy.
 * HHL widzi wszystkie. Rozdzielenie egzekwuje baza (0003), nie interfejs.
 *
 * Dwa niezależne statusy — faktura może być jednocześnie sporna i po terminie:
 *   weryfikacja: DO_WERYFIKACJI / ZGODNA / SPORNA / ZAAKCEPTOWANA
 *   płatność:    NIEOPLACONA / PO_TERMINIE / OPLACONA
 * ===================================================================== */

export type InvoiceCurrency = 'EUR' | 'PLN';
export type InvoiceDirection = 'KOSZT' | 'PRZYCHOD';

/** Kurs podany na pozycji faktury PLN — wymagany, sprawdzany z regułą. */
export interface InvoiceLineFx { tableNo: string; mid: number; effectiveDate: string }

export interface InvoiceLineInput {
  loadId: string;
  expected: PriceSide;           // wyliczone mechanizmem — nigdy nadpisywane
  invoicedNet: number;           // w walucie faktury
  invoicedFuel?: number;         // w walucie faktury, jeśli podana osobno
  fx?: InvoiceLineFx;            // wymagany przy fakturze PLN
}

export type Discrepancy =
  | 'KWOTA' | 'OPLATA_PALIWOWA' | 'TABELA_NBP' | 'KURS_NBP' | 'DATA_KURSU' | 'BRAK_KURSU';

/**
 * Faktura PLN: kurs PER POZYCJA, bo reguła wiąże kurs z dniem rozładunku
 * danego transportu, a faktura tygodniowa obejmuje różne dni rozładunku.
 * Oczekiwana kwota PLN pozycji = kwota EUR × kurs z reguły, zaokrąglenie
 * per pozycja.
 */
export function matchInvoice(args: {
  currency: InvoiceCurrency;
  lines: InvoiceLineInput[];
  tolerance?: { abs: number; pct: number };
}) {
  const tol = args.tolerance ?? { abs: 1, pct: 0.002 };
  const out = (d: number, base: number) =>
    Math.abs(d) > tol.abs && (base === 0 || Math.abs(d) / base > tol.pct);

  const rows = args.lines.map((l) => {
    const flags: Discrepancy[] = [];
    const rule = l.expected.fx;
    const toInv = (eur: number) => (args.currency === 'EUR' ? round(eur) : eurToPln(eur, rule));
    const expectedNet = toInv(l.expected.computedTotalEur);
    const expectedFuel = toInv(l.expected.fuelAmountEur);
    const diff = round(l.invoicedNet - expectedNet);

    if (out(diff, expectedNet)) flags.push('KWOTA');
    if (l.invoicedFuel !== undefined && out(round(l.invoicedFuel - expectedFuel), expectedFuel)) {
      flags.push('OPLATA_PALIWOWA');
    }
    if (args.currency === 'PLN' && !l.fx) flags.push('BRAK_KURSU');
    if (l.fx) {
      if (l.fx.tableNo !== rule.no) flags.push('TABELA_NBP');
      if (Math.abs(l.fx.mid - rule.mid) > 0.00005) flags.push('KURS_NBP');
      if (l.fx.effectiveDate !== rule.effectiveDate) flags.push('DATA_KURSU');
    }
    return {
      loadId: l.loadId,
      expectedNet, invoicedNet: l.invoicedNet, diff,
      ruleFx: { tableNo: rule.no, mid: rule.mid, effectiveDate: rule.effectiveDate },
      invoiceFx: l.fx ?? null,
      flags,
    };
  });
  const expectedTotal = round(rows.reduce((s, r) => s + r.expectedNet, 0));
  const invoicedTotal = round(rows.reduce((s, r) => s + r.invoicedNet, 0));
  return {
    currency: args.currency,
    status: rows.every((r) => r.flags.length === 0) ? ('ZGODNA' as const) : ('SPORNA' as const),
    expectedTotal, invoicedTotal,
    variance: round(invoicedTotal - expectedTotal),
    rows,
  };
}

/** Kwota netto pozycji faktury sprowadzona do EUR — do marży. Kurs z faktury. */
export function invoiceLineToEur(net: number, currency: InvoiceCurrency, fx?: InvoiceLineFx): number {
  if (currency === 'EUR') return round(net);
  if (!fx) throw new Error('Pozycja faktury PLN bez kursu — nie da się sprowadzić do EUR');
  return round(net / fx.mid);
}

/* ---------- pozycje faktury wobec tygodnia realizacji ---------- */

export type LineIssue = 'ZLY_TYDZIEN' | 'BRAK_NA_FAKTURZE' | 'PODWOJNIE_FAKTUROWANY' | 'NIEZREALIZOWANY';

export function validateInvoiceLines(args: {
  invoiceWeekKey: string;
  lineLoadIds: string[];
  loads: Array<{ id: string; unloadedAtUtc?: string | null }>;
  alreadyInvoicedLoadIds: Set<string>;   // ten sam kierunek, inne faktury
}): Array<{ loadId: string; issue: LineIssue }> {
  const issues: Array<{ loadId: string; issue: LineIssue }> = [];
  const byId = new Map(args.loads.map((l) => [l.id, l]));
  const onInvoice = new Set(args.lineLoadIds);
  for (const id of args.lineLoadIds) {
    const l = byId.get(id);
    if (!l || !l.unloadedAtUtc) { issues.push({ loadId: id, issue: 'NIEZREALIZOWANY' }); continue; }
    if (isoWeekKeyLocal(l.unloadedAtUtc) !== args.invoiceWeekKey) issues.push({ loadId: id, issue: 'ZLY_TYDZIEN' });
    if (args.alreadyInvoicedLoadIds.has(id)) issues.push({ loadId: id, issue: 'PODWOJNIE_FAKTUROWANY' });
  }
  for (const l of args.loads) {
    if (l.unloadedAtUtc && isoWeekKeyLocal(l.unloadedAtUtc) === args.invoiceWeekKey &&
        !onInvoice.has(l.id) && !args.alreadyInvoicedLoadIds.has(l.id)) {
      issues.push({ loadId: l.id, issue: 'BRAK_NA_FAKTURZE' });
    }
  }
  return issues;
}

/* ---------- termin płatności i stan płatności ---------- */

export type TermBasis = 'WYSTAWIENIE' | 'DORECZENIE';
export type PaymentState = 'NIEOPLACONA' | 'PO_TERMINIE' | 'OPLACONA';

/**
 * Termin = data bazowa + dni. Podstawa (wystawienie albo doręczenie)
 * z ustawień relacji. Termin wpisany z dokumentu faktury ma pierwszeństwo —
 * dokument jest nadrzędny.
 */
export function dueDate(args: {
  issueDate: string; receiptDate?: string | null;
  termDays: number; basis: TermBasis; overrideFromDocument?: string | null;
}): string {
  if (args.overrideFromDocument) return args.overrideFromDocument;
  const base = args.basis === 'DORECZENIE' ? args.receiptDate : args.issueDate;
  if (!base) throw new Error('Termin od doręczenia wymaga daty doręczenia');
  return addDaysIso(base, args.termDays);
}

export function paymentState(due: string, todayLocal: string, paidAt?: string | null): PaymentState {
  if (paidAt) return 'OPLACONA';
  return todayLocal > due ? 'PO_TERMINIE' : 'NIEOPLACONA';
}

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);

/**
 * Które przypomnienia wychodzą dziś. Kadencja w dniach względem terminu:
 * ujemne przed, zero w dniu terminu, dodatnie po. Opłacona → żadne.
 * Odbiorcy: płatnik i wierzyciel tej faktury — nigdy trzecia strona.
 */
export function remindersDueToday(
  due: string, todayLocal: string, paidAt?: string | null,
  cadence: number[] = [-3, 0, 1, 7, 14]
): number[] {
  if (paidAt) return [];
  const offset = daysBetween(due, todayLocal);
  return cadence.filter((c) => c === offset);
}

export function invoiceParties(direction: InvoiceDirection) {
  return direction === 'KOSZT'
    ? { issuer: 'SCX', recipient: 'HHL', payer: 'HHL', payee: 'SCX', visibleTo: ['HHL', 'SCX'] as const }
    : { issuer: 'HHL', recipient: 'KSH', payer: 'KSH', payee: 'HHL', visibleTo: ['HHL', 'KSH'] as const };
}

/* =====================================================================
 * 10. FORMATOWANIE KWOT
 *
 * Decyzja P5: KOD waluty (EUR, PLN), nie symbol; format liczby według
 * języka interfejsu. Jedna funkcja dla całej aplikacji.
 * ===================================================================== */

const LOCALE: Record<'pl' | 'en' | 'sv', string> = { pl: 'pl-PL', en: 'en-GB', sv: 'sv-SE' };

export function formatMoney(
  amount: number,
  lang: 'pl' | 'en' | 'sv',
  currency: 'EUR' | 'PLN' | 'SEK' = CURRENCY
): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    style: 'currency', currency, currencyDisplay: 'code',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

/** Kwota źródłowa w EUR, wyświetlona w walucie wybranej przez użytkownika. */
export function formatForUser(
  eur: number, fx: NbpRate, lang: 'pl' | 'en' | 'sv', display: DisplayCurrency
): string {
  return display === 'EUR' ? formatMoney(eur, lang, 'EUR') : formatMoney(eurToPln(eur, fx), lang, 'PLN');
}
