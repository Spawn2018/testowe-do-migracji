/**
 * TOWER — silnik cenowy: stawka bazowa, BAF, waluty, marża.
 *
 * Wszystko tu jest funkcją czystą — żadnych zapytań do bazy, żadnych
 * dat "now()". Dzięki temu da się to przetestować i, co ważniejsze,
 * odtworzyć wyliczenie sprzed trzech tygodni przy sporze z przewoźnikiem.
 *
 * DWIE ZASADY, KTÓRYCH NIE ŁAMIEMY:
 *  1. Każde wyliczenie zapisuje SNAPSHOT wejść (indeks, kurs, wersja cennika).
 *     Cennik się zmieni, indeks się zmieni — a faktura ma być odtwarzalna.
 *  2. Koszt i przychód liczą się NIEZALEŻNIE, na osobnych cennikach.
 *     Nigdy nie wyprowadzaj jednego z drugiego przez narzut.
 */

export interface Dimensions {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
}

export interface RateRule {
  id: string;
  lengthFrom: number; lengthTo: number;
  widthFrom: number;  widthTo: number;
  heightFrom: number; heightTo: number;
  weightFrom: number; weightTo: number;
  baseRate: number;
}

export type RateMatchResult =
  | { matched: true; rule: RateRule; baseRate: number }
  | { matched: false; reason: 'NO_BRACKET'; dims: Dimensions }
  | { matched: false; reason: 'AMBIGUOUS'; candidates: RateRule[] };

/**
 * Dopasowanie do macierzy cennikowej.
 *
 * Celowo NIE zwracamy zera przy braku dopasowania. Transport bez stawki
 * musi wywalić się głośno i trafić na listę wyjątków — ciche zero
 * w kolumnie kosztu to najprostszy sposób na fikcyjną marżę.
 */
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
  return { matched: true, rule: hits[0], baseRate: hits[0].baseRate };
}

/* ---------------------------------------------------------------------
 * BAF — dodatek paliwowy
 * ------------------------------------------------------------------- */

export interface BafDefinition {
  indexSource: string;        // EC_WEEKLY_OIL_BULLETIN | ORLEN_WHOLESALE | ...
  baseValue: number;          // wartość indeksu w dacie bazowej
  baseDate: string;           // ISO date
  fuelShare: number;          // udział paliwa w strukturze kosztu, np. 0.28
  triggerThreshold: number;   // poniżej tej zmiany BAF się nie rusza, np. 0.015
  roundingStep: number;       // np. 0.005 => zaokrąglanie do 0,5 pp
  floorPct?: number;
  capPct?: number;
}

export interface BafInput {
  currentValue: number;
  valueDate: string;
  sourceUrl: string;          // DOWÓD. Bez tego nie wygrasz sporu.
  previousBafPct?: number;    // do zastosowania progu wyzwolenia
}

export interface BafResult {
  bafPct: number;
  applied: boolean;           // czy próg został przekroczony
  rawPct: number;             // przed progiem i zaokrągleniem
  snapshot: {
    indexSource: string; baseValue: number; baseDate: string;
    currentValue: number; valueDate: string; fuelShare: number; sourceUrl: string;
  };
}

/**
 *   BAF% = ((I_bieżący − I_bazowy) / I_bazowy) × udział_paliwa
 *
 * Następnie: próg wyzwolenia (nie zmieniaj stawki przy drgnięciu indeksu),
 * zaokrąglenie do kroku, ograniczenie floor/cap.
 */
export function calcBaf(def: BafDefinition, input: BafInput): BafResult {
  if (def.baseValue <= 0) throw new Error('BAF: baseValue musi być > 0');

  const rawPct = ((input.currentValue - def.baseValue) / def.baseValue) * def.fuelShare;

  let pct = Math.round(rawPct / def.roundingStep) * def.roundingStep;
  if (def.floorPct != null) pct = Math.max(pct, def.floorPct);
  if (def.capPct   != null) pct = Math.min(pct, def.capPct);

  const prev = input.previousBafPct;
  const applied = prev == null || Math.abs(pct - prev) >= def.triggerThreshold;
  const finalPct = applied ? pct : prev!;

  return {
    bafPct: round(finalPct, 6),
    applied,
    rawPct: round(rawPct, 6),
    snapshot: {
      indexSource: def.indexSource,
      baseValue: def.baseValue,
      baseDate: def.baseDate,
      currentValue: input.currentValue,
      valueDate: input.valueDate,
      fuelShare: def.fuelShare,
      sourceUrl: input.sourceUrl,
    },
  };
}

/* ---------------------------------------------------------------------
 * Waluty — NBP
 *
 * Trasa generuje koszty w trzech walutach: fracht może być w PLN lub EUR,
 * opłaty drogowe i usługi w Szwecji w SEK, prom w PLN/EUR. Bez jednej,
 * uzgodnionej konwencji kursowej marża jest zgadywana.
 *
 * NBP publikuje kursy średnie (tabela A) bezpłatnym API pod api.nbp.pl
 * w dni robocze. KONWENCJĘ USTAL Z PRZEWOŹNIKIEM I KLIENTEM NA PIŚMIE:
 * kurs z dnia poprzedzającego dzień wykonania usługi? dzień wystawienia
 * faktury? średnia z tygodnia? Trzy różne odpowiedzi = trzy różne marże.
 * ------------------------------------------------------------------- */

export type FxConvention =
  | 'NBP_A_DAY_BEFORE_SERVICE'
  | 'NBP_A_DAY_BEFORE_INVOICE'
  | 'NBP_A_PERIOD_AVERAGE';

export interface FxRate { currency: string; rateDate: string; ratePln: number; tableNo?: string }

export function toPln(amount: number, currency: string, fx: FxRate | null): number {
  if (currency === 'PLN') return round(amount, 2);
  if (!fx) throw new Error(`Brak kursu ${currency} — nie licz marży na zgadywanym kursie`);
  if (fx.currency !== currency) throw new Error(`Kurs ${fx.currency} != ${currency}`);
  return round(amount * fx.ratePln, 2);
}

/* ---------------------------------------------------------------------
 * Składanie ceny i marży
 * ------------------------------------------------------------------- */

export interface Extra { code: string; label: string; amount: number }

export interface PriceSide {
  currency: string;
  baseAmount: number;
  bafPct: number;
  bafAmount: number;
  extras: Extra[];
  extrasAmount: number;
  totalAmount: number;
  totalPln: number;
  fx: FxRate | null;
}

export function buildPriceSide(args: {
  currency: string;
  baseRate: number;
  baf: BafResult;
  extras?: Extra[];
  /** Czy BAF nalicza się także od dodatków. Domyślnie NIE — pilotaż
   *  i postojowe zwykle nie są paliwozależne w tym samym stopniu.
   *  Ustal z przewoźnikiem i zapisz w umowie. */
  bafOnExtras?: boolean;
  fx: FxRate | null;
}): PriceSide {
  const extras = args.extras ?? [];
  const extrasAmount = round(extras.reduce((s, e) => s + e.amount, 0), 2);
  const bafBase = args.baseRate + (args.bafOnExtras ? extrasAmount : 0);
  const bafAmount = round(bafBase * args.baf.bafPct, 2);
  const totalAmount = round(args.baseRate + bafAmount + extrasAmount, 2);

  return {
    currency: args.currency,
    baseAmount: round(args.baseRate, 2),
    bafPct: args.baf.bafPct,
    bafAmount,
    extras,
    extrasAmount,
    totalAmount,
    totalPln: toPln(totalAmount, args.currency, args.fx),
    fx: args.fx,
  };
}

export interface MarginResult {
  revenuePln: number;
  costPln: number;
  marginPln: number;
  marginPct: number | null;
  belowThreshold: boolean;
}

export function calcMargin(
  revenue: PriceSide,
  cost: PriceSide,
  minMarginPct = 0.08
): MarginResult {
  const marginPln = round(revenue.totalPln - cost.totalPln, 2);
  const marginPct = revenue.totalPln === 0 ? null : round(marginPln / revenue.totalPln, 4);
  return {
    revenuePln: revenue.totalPln,
    costPln: cost.totalPln,
    marginPln,
    marginPct,
    belowThreshold: marginPct != null && marginPct < minMarginPct,
  };
}

/* ---------------------------------------------------------------------
 * 3-way match faktury zbiorczej
 * ------------------------------------------------------------------- */

export interface InvoiceMatchInput {
  lines: Array<{ loadId: string; expected: number; invoiced: number }>;
  tolerancePln?: number;
  tolerancePct?: number;
}

export function matchInvoice(input: InvoiceMatchInput) {
  const tolPln = input.tolerancePln ?? 5;
  const tolPct = input.tolerancePct ?? 0.01;

  const discrepancies = input.lines
    .map((l) => ({ ...l, diff: round(l.invoiced - l.expected, 2) }))
    .filter((l) => {
      const abs = Math.abs(l.diff);
      return abs > tolPln && (l.expected === 0 || abs / l.expected > tolPct);
    });

  const expectedTotal = round(input.lines.reduce((s, l) => s + l.expected, 0), 2);
  const invoicedTotal = round(input.lines.reduce((s, l) => s + l.invoiced, 0), 2);

  return {
    status: discrepancies.length === 0 ? ('MATCHED' as const) : ('DISPUTED' as const),
    expectedTotal,
    invoicedTotal,
    variance: round(invoicedTotal - expectedTotal, 2),
    discrepancies,
  };
}

const round = (n: number, d: number) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};
