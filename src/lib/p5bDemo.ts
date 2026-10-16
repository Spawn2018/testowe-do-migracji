/**
 * wyglad/P5-b — dane przykładowe ekranów Opcje › Pieniądze (tylko tryb demo; strażnik I-0 w `p5bSource.ts`).
 * audyt-C C-13 (E3 „Jedna liczba: Opcje, podgląd transportu, Finanse … biorą mnożnik z tej samej funkcji”):
 * średnie, mnożniki i tabela mnożników z tego samego źródła co ceny transportów demo (`sefsForLoadDate`, tabele
 * załącznika w `sefs.ts`) — Opcje, Finanse i panel „Ceny” pokazują dla tego samego tygodnia ten sam mnożnik.
 * Ceny dni: wahania jak w przykładzie E3 wokół średniej tygodnia; brak ceny Orlen z poprzedniego dnia.
 */
import type { CancelRulesView, DwellRulesView, FuelDayGroup, FuelDayRow, FuelScreenView, FuelTier, PaymentTermsView } from './p5bFuel';
import { SEFS_PLN, SEFS_SEK, sefsForLoadDate, type SefsTier } from './sefs';

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

export function demoFuelScreen(today: string): FuelScreenView {
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
      ? { source: 'ORLEN', date: yesterday, at: '07:15', published: curOrlen(todayIdx - 1), affectsFrom: nextMon, affectsTo: add(nextMon, 6), nextTry: '13:15' }
      : null,
    current: {
      from: mon, to: add(mon, 6), idxFrom: prevMon, idxTo: add(prevMon, 6),
      okq8: { avg: idx.priceSek, n: 4, mult: idx.multSek }, orlen: { avg: idx.pricePln, n: 5, mult: idx.multPln }, applied: idx.appliedMult, final: true,
    },
    next: { from: nextMon, to: add(nextMon, 6), idxFrom: mon, idxTo: add(mon, 6), forecast: run.appliedMult, finalOn: nextMon },
    fetch: {
      at: '07:15',
      retries: ['09:15', '13:15'],
      today: { date: today, okq8: true, orlen: true },
      yesterday: { date: yesterday, okq8: true, orlen: !yesterdayInWeek },
    },
    exampleBaseEur: 6900,
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
  example: { label: 'SG', costEur: 6900, revEur: 7300 },
  changed: { at: '2026-10-08T12:14:00+02:00', by: 'Administrator HHL' },
});

export const demoPaymentTerms = (): PaymentTermsView => ({ kshDays: 30, scxDays: 35, changed: null });
