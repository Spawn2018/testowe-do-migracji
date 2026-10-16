/**
 * wyglad/P5-b — dane przykładowe ekranów Opcje › Pieniądze (tylko tryb demo; strażnik I-0 w `p5bSource.ts`).
 * Liczby jak w raporcie audytu E3 (07.10): średnie 22,63 SEK/l (4 publikacje) → ×1,13 i 7,22 PLN/l (5) → ×1,15,
 * stosowany ×1,13, brak ceny Orlen z poprzedniego dnia; daty przesunięte do tygodnia „dziś” w demo.
 */
import type { CancelRulesView, DwellRulesView, FuelDayGroup, FuelDayRow, FuelScreenView, FuelTier, PaymentTermsView, RateCardRow, RateCardView } from './p5bFuel';

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

function tiers(first: number, step: number, mult0: number, below: number, above: number): FuelTier[] {
  const out: FuelTier[] = [];
  for (let k = -below; k <= above; k++) {
    const from = Math.round((first + step * k) * 100) / 100;
    out.push({ from, to: Math.round((from + step - 0.01) * 100) / 100, mult: Math.round((mult0 + 0.01 * k) * 100) / 100 });
  }
  return out;
}

/* ceny dni pn–nd: tydzień bieżący (liczy przyszły) i poprzedni (wskaźniki tygodnia bieżącego) */
const CUR_OKQ8 = [22.29, 22.49, 22.49, 22.71, 22.8, 22.8, 22.8];
const CUR_ORLEN = [6.943, 6.92, 6.864, 6.871, 6.902, 6.902, 6.902];
const PREV_OKQ8 = [22.74, 22.54, 22.09, 23.14, 23.14, 23.14, 23.14];
const PREV_ORLEN = [7.442, 7.363, 7.255, 7.272, 7.28, 6.943, 6.943];

export function demoFuelScreen(today: string): FuelScreenView {
  const mon = monday(today);
  const prevMon = add(mon, -7);
  const nextMon = add(mon, 7);
  const yesterday = add(today, -1);
  const todayIdx = Math.round((ms(today) - ms(mon)) / DAY);
  const curRows: FuelDayRow[] = [];
  for (let i = todayIdx; i >= 0; i--) {
    const date = add(mon, i);
    const miss = date === yesterday;
    curRows.push({
      date,
      okq8: CUR_OKQ8[i] ?? null,
      okq8Pub: miss ? yesterday : null,
      orlen: miss ? null : (CUR_ORLEN[i] ?? null),
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
      okq8: PREV_OKQ8[i] ?? null,
      okq8Pub: null,
      orlen: PREV_ORLEN[i] ?? null,
      orlenPub: i === 0 ? add(prevMon, -2) : null,
      how: 'FILLED',
      at: null,
      missing: null,
    });
  }
  const days: FuelDayGroup[] = [
    { from: mon, to: add(mon, 6), closed: null, rows: curRows },
    { from: prevMon, to: add(prevMon, 6), closed: { okq8: 22.63, orlen: 7.22, mult: 1.13 }, rows: prevRows },
  ];
  const yesterdayInWeek = todayIdx > 0;
  return {
    contract: { version: 3, from: '2026-09-28', agreed: true },
    alarm: yesterdayInWeek
      ? { source: 'ORLEN', date: yesterday, at: '07:15', published: 6.919, affectsFrom: nextMon, affectsTo: add(nextMon, 6), nextTry: '13:15' }
      : null,
    current: {
      from: mon, to: add(mon, 6), idxFrom: prevMon, idxTo: add(prevMon, 6),
      okq8: { avg: 22.63, n: 4, mult: 1.13 }, orlen: { avg: 7.22, n: 5, mult: 1.15 }, applied: 1.13, final: true,
    },
    next: { from: nextMon, to: add(nextMon, 6), idxFrom: mon, idxTo: add(mon, 6), forecast: 1.13, finalOn: nextMon },
    fetch: {
      at: '07:15',
      retries: ['09:15', '13:15'],
      today: { date: today, okq8: true, orlen: true },
      yesterday: { date: yesterday, okq8: true, orlen: !yesterdayInWeek },
    },
    exampleBaseEur: 6900,
    days,
    tiers: { sek: tiers(21.91, 0.3, 1.11, 10, 12), pln: tiers(7.01, 0.1, 1.13, 12, 20) },
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
  example: { label: 'SG', costEur: 6900, revEur: 7245 },
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
