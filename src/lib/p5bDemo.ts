/**
 * wyglad/P5-b — dane przykładowe ekranów Opcje › Pieniądze (tylko tryb demo; strażnik I-0 w `p5bSource.ts`).
 * audyt-C C-13 (E3 „Jedna liczba: Opcje, podgląd transportu, Finanse … biorą mnożnik z tej samej funkcji”):
 * średnie, mnożniki i tabela mnożników z tego samego źródła co ceny transportów demo (`sefsForLoadDate`, tabele
 * załącznika w `sefs.ts`) — Opcje, Finanse i panel „Ceny” pokazują dla tego samego tygodnia ten sam mnożnik.
 * Ceny dni: wahania jak w przykładzie E3 wokół średniej tygodnia; brak ceny Orlen z poprzedniego dnia.
 */
import type { CancelRulesView, DwellRulesView, FuelDayGroup, FuelDayRow, FuelScreenView, FuelTier, PaymentTermsView, RateCardRow, RateCardView } from './p5bFuel';
import { SEFS_PLN, SEFS_SEK, sefsForLoadDate, type SefsTier } from './sefs';

/** Stawka SG z cennika (baza 08.10, E33): SCX v1 — koszt HHL, KSH v2 — przychód HHL. Przykład opłaty paliwowej na własnej stawce strony. */
export const DEMO_EXAMPLE_BASE_EUR = { cost: 6900, rev: 7245 } as const;

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);
/** Poniedziałek tygodnia (pn–nd) dnia `d`. */
function monday(d: string): string {
  const t = ms(d);
  const wd = (new Date(t).getUTCDay() + 6) % 7;
  return iso(t - wd * DAY);
}
const add = (d: string, n: number) => iso(ms(d) + n * DAY);

/** Tabela załącznika (`sefs.ts`: „do X → ×m”) jako przedziały „od–do”. */
function tiers(t: readonly SefsTier[]): FuelTier[] {
  return t.map((x, i) => ({ from: i === 0 ? 0 : Math.round((t[i - 1].lte + 0.01) * 100) / 100, to: x.lte, mult: x.mult }));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
/* wahania cen dni pn–nd wokół średniej tygodnia (przykład E3): tydzień bieżący (liczy przyszły) i poprzedni (wskaźniki) */
const CUR_OKQ8 = [-0.34, -0.14, -0.14, 0.08, 0.17, 0.17, 0.17];
const CUR_ORLEN = [-0.277, -0.3, -0.356, -0.349, -0.318, -0.318, -0.318];
const PREV_OKQ8 = [0.11, -0.09, -0.54, 0.51, 0.51, 0.51, 0.51];
const PREV_ORLEN = [0.222, 0.143, 0.035, 0.052, 0.06, -0.277, -0.277];

/** E3: pobieranie cen o 07:15, ponowienia o 09:15 i 13:15 (czas polski). */
export const FUEL_FETCH_AT = '07:15';
export const FUEL_RETRIES = ['09:15', '13:15'] as const;
/** Następna automatyczna próba dziś po `nowHm` („HH:MM”, czas polski) albo null — dziś już nie będzie. */
export const fuelNextTryToday = (nowHm: string): string | null => FUEL_RETRIES.find((t) => t > nowHm) ?? null;

/** `nowHm` — godzina zegara demo (czas polski); bez niej przykład z makiety („13:15”). */
export function demoFuelScreen(today: string, nowHm?: string): FuelScreenView {
  const mon = monday(today);
  const prevMon = add(mon, -7);
  const nextMon = add(mon, 7);
  const yesterday = add(today, -1);
  const todayIdx = Math.round((ms(today) - ms(mon)) / DAY);
  /* ta sama funkcja i ten sam klucz co ceny transportów (C-13): notowanie dla załadunków tego tygodnia (średnie
     tygodnia wskaźników), dla przyszłego — notowanie przyszłego tygodnia (prognoza z cen tygodnia bieżącego) */
  const idx = sefsForLoadDate(mon);
  const run = sefsForLoadDate(nextMon);
  const curOkq8 = (i: number) => r2(run.priceSek + (CUR_OKQ8[i] ?? 0));
  const curOrlen = (i: number) => r3(run.pricePln + (CUR_ORLEN[i] ?? 0));
  const curRows: FuelDayRow[] = [];
  for (let i = todayIdx; i >= 0; i--) {
    const date = add(mon, i);
    const miss = date === yesterday;
    curRows.push({
      date,
      okq8: curOkq8(i),
      okq8Pub: miss ? yesterday : null,
      orlen: miss ? null : curOrlen(i),
      orlenPub: i === 0 ? add(prevMon, 5) : null,
      how: miss ? 'MISSING' : 'AUTO',
      at: '07:15',
      missing: miss ? { source: 'ORLEN', why: 'błąd połączenia' } : null,
    });
  }
  const prevRows: FuelDayRow[] = [];
  for (let i = 6; i >= 0; i--) {
    prevRows.push({
      date: add(prevMon, i),
      okq8: r2(idx.priceSek + (PREV_OKQ8[i] ?? 0)),
      okq8Pub: null,
      orlen: r3(idx.pricePln + (PREV_ORLEN[i] ?? 0)),
      orlenPub: i === 0 ? add(prevMon, -2) : null,
      how: 'FILLED',
      at: null,
      missing: null,
    });
  }
  const days: FuelDayGroup[] = [
    { from: mon, to: add(mon, 6), closed: null, rows: curRows },
    { from: prevMon, to: add(prevMon, 6), closed: { okq8: idx.priceSek, orlen: idx.pricePln, mult: idx.appliedMult }, rows: prevRows },
  ];
  const yesterdayInWeek = todayIdx > 0;
  return {
    contract: { version: 3, from: '2026-09-28', agreed: true },
    alarm: yesterdayInWeek
      ? { source: 'ORLEN', date: yesterday, at: '07:15', published: curOrlen(todayIdx - 1), affectsFrom: nextMon, affectsTo: add(nextMon, 6), nextTry: nowHm == null ? '13:15' : fuelNextTryToday(nowHm) }
      : null,
    current: {
      from: mon, to: add(mon, 6), idxFrom: prevMon, idxTo: add(prevMon, 6),
      okq8: { avg: idx.priceSek, n: 4, mult: idx.multSek }, orlen: { avg: idx.pricePln, n: 5, mult: idx.multPln }, applied: idx.appliedMult, final: true,
    },
    next: { from: nextMon, to: add(nextMon, 6), idxFrom: mon, idxTo: add(mon, 6), forecast: run.appliedMult, finalOn: nextMon },
    fetch: {
      at: FUEL_FETCH_AT,
      retries: [...FUEL_RETRIES],
      today: { date: today, okq8: true, orlen: true },
      yesterday: { date: yesterday, okq8: true, orlen: !yesterdayInWeek },
    },
    exampleBaseEur: DEMO_EXAMPLE_BASE_EUR.cost,
    days,
    tiers: { sek: tiers(SEFS_SEK), pln: tiers(SEFS_PLN) },
  };
}

export const demoDwellRules = (): DwellRulesView => ({
  /* dayAfterH 10 h — decyzja właściciela 15.10, 18:32 (W41); wcześniej 24 h (07.10 12:35) */
  freeLoadH: 6, freeUnloadH: 4, hourEur: 75, dayEur: 750, dayAfterH: 10,
  startFrom: 'LATER', hourMode: 'FULL',
  changed: { at: '2026-10-07T12:35:00+02:00', by: 'Administrator HHL' },
});

export const demoCancelRules = (): CancelRulesView => ({
  pct: { 5: 0, 4: 15, 3: 25, 2: 25, 1: 50, 0: 100 },
  /* wyglad/audyt-E (E-06): ten sam fracht SG co w cenniku poniżej (SCX v1 6 900, KSH v2 7 245 EUR — baza 08.10, E33) */
  example: { label: 'SG', costEur: DEMO_EXAMPLE_BASE_EUR.cost, revEur: DEMO_EXAMPLE_BASE_EUR.rev },
  changed: { at: '2026-10-08T12:14:00+02:00', by: 'Administrator HHL' },
});

export const demoPaymentTerms = (): PaymentTermsView => ({ kshDays: 30, scxDays: 35, changed: null });

/* wyglad/audyt-E (E-06, C-14) — cennik według symboli: 10 symboli, 12 pozycji (KR — konwój 1, 2 i 3 auta).
   SG i KR jak w bazie 08.10 (E33: SG 6 900 / 7 245, KR 12 745 / 12 290 / 11 380 i 13 382 / 12 905 / 11 949 EUR);
   pozostałe kwoty przykładowe, KSH v2 = koszt × 1,05 do pełnej liczby. Zestawy — tabela symboli (`p7Demo.ts`). */
const R = (id: string, symbol: string, kind: string, l: number, w: number, h: number, costEur: number, convoy?: number): RateCardRow =>
  ({ id, symbol, kind, set: { l, w, h }, costEur, revEur: Math.round(costEur * 1.05), ...(convoy ? { convoy } : {}) });

export const demoRateCard = (): RateCardView => ({
  rows: [
    R('BS-A', 'BS-A', 'Belki suwnicowe', 18.19, 2.45, 2.6, 5850),
    R('BS-B', 'BS-B', 'Belki suwnicowe', 18.19, 2.45, 3.1, 6100),
    R('BS-C', 'BS-C', 'Belki suwnicowe', 19.69, 2.45, 3.1, 6450),
    R('KR-1', 'KR', 'Kratownice', 23.69, 3.52, 3.9, 12745, 1),
    R('KR-2', 'KR', 'Kratownice', 23.69, 3.52, 3.9, 12290, 2),
    R('KR-3', 'KR', 'Kratownice', 23.69, 3.52, 3.9, 11380, 3),
    R('PL-A', 'PL-A', 'Płatwie dachowe i stężenia', 18.19, 2.45, 3.75, 5700),
    R('PL-B', 'PL-B', 'Płatwie dachowe i stężenia', 18.19, 3.4, 3.75, 6250),
    R('SG', 'SG', 'Słupy główne', 21.69, 2.45, 3.75, 6900),
    R('SS', 'SS', 'Słupy skrajne oś A', 21.69, 3.0, 3.8, 7640),
    R('T', 'T', 'Tężniki', 18.19, 2.45, 3.75, 5320),
    R('TS', 'TS', 'Tężniki ściany A', 20.69, 2.45, 3.95, 5950),
  ],
  ksh: { side: 'KSH', v: 2, from: '2026-09-28', note: 'Poprawa cen do pełnej liczby', at: '2026-10-06T16:02:00+02:00', by: 'Administrator HHL' },
  scx: { side: 'SCX', v: 1, from: '2026-09-28', note: null, at: '2026-09-30T10:00:00+02:00', by: 'Administrator HHL' },
});
