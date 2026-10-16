/**
 * wyglad/P5 — przykłady tylko dla trybu demo (strażnik I-0): próg marży i średnie cen paliwa z publikacjami.
 * Wołane wyłącznie przez `src/lib/p5Source.ts` za warunkiem `import.meta.env.VITE_AUTH_MODE !== 'supabase'`.
 * W produkcji te dane podaje baza (E16 próg w Opcjach, E39 `fuel_basis`, E4b faktoring, E40 adresy i dziennik wysyłek)
 * — podłącza wykonawca. Adresy e-mail zmyślone (example.com, G-09).
 */
import { SEFS_PLN, SEFS_SEK, type SefsTier } from './sefs';
import { addDays, type FuelPubl, type FuelWeekRow } from './p5Finance';
import type { Bill, Document, Load } from '../types';
import { useTowerStore } from '../store/useTowerStore';
import { factoringPayout } from './p5Invoices';
import type { FactoringOfferView, FactoringTask, PackActions, PermitView, PolicyView } from './p5Source';
import type { PackConfig, PackSent } from './p5Pack';
import { cancelFee, DECIDED_RULES, dwellFee, type FeeRules, type FeeSuggestion } from './p5Fees';
import { unloadedAtOf } from './money/loadMoney';
import { addDaysIso } from './invoices3';
import { DEFAULT_DOC_REQUIREMENTS, type DocRequirement } from './docRequirements';

/** Próg marży z Opcji (E16, 08.10: 4 %). */
export const demoMarginThreshold = (): number => 4;

/** Średnia z przedziału tabeli mnożników, która daje ten mnożnik (przykład spójny z tabelą). */
function avgFor(mult: number, tiers: SefsTier[]): number | null {
  const i = tiers.findIndex((t) => t.mult === mult);
  if (i < 0) return null;
  const hi = tiers[i].lte;
  const lo = i > 0 ? tiers[i - 1].lte : hi - 0.4;
  return Math.round((lo + (hi - lo) * 0.62) * 100) / 100;
}

function publications(idxFrom: string, okq8: number, orlen: number, until: string): FuelPubl[] {
  const out: FuelPubl[] = [];
  /* OKQ8: pon, śr, czw, pt; Orlen: pon–pt (jak w bazie: 4 i 5 publikacji w pełnym tygodniu) */
  for (const d of [0, 2, 3, 4]) { const day = addDays(idxFrom, d); if (day <= until) out.push({ date: day, source: 'OKQ8', price: Math.round((okq8 + (d - 2) * 0.03) * 100) / 100 }); }
  for (const d of [0, 1, 2, 3, 4]) { const day = addDays(idxFrom, d); if (day <= until) out.push({ date: day, source: 'ORLEN', price: Math.round((orlen + (d - 2) * 0.02) * 100) / 100 }); }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
}

/** E39: średnie OKQ8 i Orlen z liczbą publikacji dla zamkniętych tygodni wskaźników; lista publikacji (też w toku). */
export function demoFuelEnrich(rows: FuelWeekRow[], today: string): FuelWeekRow[] {
  return rows.map((r) => {
    if (!r.idx) return r;
    const sek = avgFor(r.okq8?.mult ?? r.applied ?? 1, SEFS_SEK) ?? 22.63;
    const pln = avgFor(r.orlen?.mult ?? r.applied ?? 1, SEFS_PLN) ?? 7.22;
    const pub = r.weekLast ? null : publications(r.idx.from, sek, pln, today < r.idx.to ? today : r.idx.to);
    if (r.state !== 'OSTATECZNA') return { ...r, publications: pub };
    return {
      ...r,
      okq8: r.okq8 ? { ...r.okq8, avg: sek, n: 4 } : r.okq8,
      orlen: r.orlen ? { ...r.orlen, avg: pln, n: 5 } : r.orlen,
      publications: pub,
    };
  });
}

/** E4b — oferta HHL (07.10: 1 % od netto, wypłata 48 h po akceptacji przez HHL); w demo z ekranu Opcje › Faktoring. */
export function demoFactoringOffer(): FactoringOfferView | null {
  const o = useTowerStore.getState().factoringOffer;
  if (!o.enabled) return null;
  return { feePct: o.feePercent, hours: o.payoutDelayUnit === 'days' ? o.payoutDelayValue * 24 : o.payoutDelayValue, version: 1, from: '2026-10-07' };
}

/** E4b — zadanie „Wypłata faktoringu” dla pierwszej przyjętej, nieopłaconej faktury przewoźnika. */
export function demoFactoringTasks(bills: Bill[], nowIso: string): FactoringTask[] {
  const b = bills.find((x) => x.direction === 'KOSZT' && x.verification === 'ZAAKCEPTOWANA' && x.payment !== 'OPLACONA');
  if (!b) return [];
  const accepted = new Date(Date.parse(nowIso) - 60 * 60 * 1000).toISOString();
  /* prowizja i czas wypłaty z oferty w Opcjach (demo) */
  const offer = demoFactoringOffer() ?? { feePct: 1, hours: 48 };
  const due = new Date(Date.parse(accepted) + offer.hours * 3600 * 1000).toISOString();
  const { fee, payout } = factoringPayout(b.net, b.gross, offer.feePct);
  return [{ billId: b.id, number: b.number, issuer: 'Scandinavian Express', currency: b.currency, net: b.net, gross: b.gross, fee, payout, issuedAt: b.issueDate, acceptedAt: accepted, dueAt: due, paidAt: null, feePct: offer.feePct, hours: offer.hours }];
}

/** E40 — adresy księgowości (Opcje › Adresy księgowości) i dziennik wysyłek: wysłana paczka HHL dla przyjętej faktury SCX. */
export function demoAccountingPack(bills: Bill[]): PackConfig {
  const sent: PackConfig['sent'] = {};
  for (const b of bills) {
    if (b.direction === 'KOSZT' && (b.verification === 'ZAAKCEPTOWANA' || b.payment === 'OPLACONA')) {
      sent[`${b.weekKey}:HHL`] = { at: `${addDaysIso(b.issueDate, 2)}T09:14:00+02:00`, to: 1, status: 'DORECZONO', by: 'Konto pokazowe' };
    }
  }
  return {
    addresses: { KSH: ['ksiegowosc.ksh@example.com', 'faktury.ksh@example.com'], HHL: ['ksiegowosc.hhl@example.com'] },
    sent,
  };
}

/** E40 — w demo „Wyślij” zapisuje tylko stan na ekranie, ZIP pakuje wgrane CMR (bez wysyłki i bez zapisu w bazie). */
export function demoPackActions(): PackActions {
  return {
    send: async (_key, _weekKey, to, nowIso): Promise<PackSent> => ({ at: nowIso, to: to.length, status: 'DORECZONO', by: 'Konto pokazowe' }),
    /* demo: pliki faktur i zestawienia jako opis (jak inne pliki demo bez treści), CMR z danych */
    zip: async (pack, cmrDocs, codeOf) => {
      const { downloadDocumentsZip } = await import('./zipDocs');
      const stub = (name: string, category: Document['category']): Document => ({
        id: `pack-${name}`, loadId: '', category, name, uploadedAt: null, deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: ['HHL'],
      });
      const extra = pack.files.filter((f) => !/_CMR\.pdf$/.test(f)).map((f) => stub(f, 'INVOICE'));
      await downloadDocumentsZip([...extra, ...cmrDocs], `Paczka_t${Number(pack.weekKey.slice(-2))}_${pack.key}.zip`, codeOf);
    },
  };
}

/** E31 — zezwolenia z tabeli właściciela 07.10 (wymiary i rodzaje); numery i daty przykładowe (G-09). */
export function demoPermits(loads: Load[]): PermitView[] {
  const n = (prefix: string) => loads.filter((l) => l.code.startsWith(prefix)).length;
  return [
    { id: 'demo-p1', scope: 'FIRMA', country: 'PL', number: 'P/0000/2026', validFrom: '2026-10-01', validTo: '2026-12-31', limits: { l: 21.69, w: 2.45, h: 3.75 }, pilot: null, appliesTo: 'Słupy główne (SG)', loads: n('SG-') },
    { id: 'demo-p2', scope: 'FIRMA', country: 'SE', number: 'TRV 0000-2026', validFrom: '2026-10-01', validTo: '2026-12-31', limits: { l: 21.69, w: 2.45, h: 3.75 }, pilot: null, appliesTo: 'Słupy główne (SG)', loads: n('SG-') },
    { id: 'demo-p3', scope: 'TRASA', country: 'PL+SE', number: null, validFrom: null, validTo: null, limits: { l: 23.69, w: 3.52, h: 3.9 }, pilot: 'PL + SE', appliesTo: 'Kratownice (KR)', loads: n('KR-') },
  ];
}

/**
 * E31 — polisa przewoźnika (numer zmyślony) i Polisa HHL (audyt-C C-07, decyzja 16.10 01:13 · 4 i 13:58 · 2):
 * PZU 1106707356, ważna 23.04.2026–22.04.2027 (`DECYZJE_08_10.md`), podpina się sama do każdego transportu jak polisa SCX.
 */
export const demoPolicies = (): PolicyView[] => [
  { org: 'SCX', name: 'OCP przewoźnika', number: 'OCP-0000-PRZYKLAD', validTo: '2027-03-29', approved: true },
  { org: 'HHL', name: 'Polisa HHL', number: 'PZU 1106707356', validTo: '2027-04-22', approved: true },
];

let docReqs: DocRequirement[] | null = null;
/**
 * audyt-C (C-03, C-04; E31 decyzja 1 B 08.10, 19:11, 19:51): w demo tylko „CMR z podpisem odbiorcy” — po „Dostarczone”,
 * termin z Opcji (24 h); bez CMR z załadunku, bez rysunku (KSH nie wgrywa), POD i zdjęć mocowania.
 * Produkcja — `doc_requirements` z bazy (wykonawca, P5 · E31). Tworzone przy pierwszym użyciu (I-0).
 */
export function demoDocRequirements(): DocRequirement[] {
  docReqs ??= DEFAULT_DOC_REQUIREMENTS.map((r): DocRequirement => {
    if (r.category === 'CMR') return { ...r, anchor: 'AFTER_UNLOAD', offsetHours: 24 };
    if (r.category === 'DRAWING' || r.category === 'POD' || r.category === 'LASHING_PHOTOS') return { ...r, required: false };
    return r;
  });
  return docReqs;
}

/** E33 — zasady cennika: wartości z decyzji 12:23 i 12:35 (w produkcji z bazy — wykonawca). */
export const demoFeeRules = (): FeeRules => DECIDED_RULES;

/**
 * E33 — podpowiedzi dopłat dla transportu: postój na załadunku i rozładunku (pomiar ze strefy albo powód braku),
 * anulowanie (nie dotyczy). Przykład: co piąty transport po załadunku ma postój 8 h 10 min w Śremie.
 */
export function demoFeeSuggestions(load: Load): FeeSuggestion[] {
  const at = unloadedAtOf(load);
  const n = Number((load.code.match(/(\d+)$/) ?? ['', '1'])[1]);
  const loaded = !['PLANNED', 'RESOURCES_PENDING', 'READY'].includes(load.status);
  const base = { costEur: 0, revEur: 0, hhl: null, scx: null, enterAt: null, exitAt: null, minutes: null, zone: null, noMeasure: null } as const;
  const out: FeeSuggestion[] = [];
  if (loaded && n % 5 === 0 && load.plannedLoadDate) {
    const day = load.plannedLoadDate.slice(0, 10);
    const f = dwellFee(490, 'LOAD');
    /* wyglad/P5-c (img/e33-after „Po zmianie · KSH, SCX”): przy SG-15 obie firmy już dodały dopłatę — KSH i HHL
       widzą „Akceptuj” / „Odrzuć” (odrzucenie z powodem, E33) */
    const waiting = n === 15 ? { hhl: 'CZEKA_KSH' as const, scx: 'CZEKA_HHL' as const } : {};
    out.push({ ...base, id: `${load.id}-dl`, kind: 'DWELL', place: 'LOAD', where: 'Śrem', enterAt: `${day}T07:10:00+02:00`, exitAt: `${day}T15:20:00+02:00`, minutes: 490, zone: 'Załadunek Śrem', costEur: f.eur, revEur: f.eur, ...waiting });
  } else {
    out.push({ ...base, id: `${load.id}-dl`, kind: 'DWELL', place: 'LOAD', where: 'Śrem', noMeasure: loaded ? 'brak pomiaru — śledzenie od Szwecji' : 'jeszcze nie mierzono' });
  }
  if (at) {
    const exit = Date.parse(at);
    out.push({ ...base, id: `${load.id}-du`, kind: 'DWELL', place: 'UNLOAD', where: 'Boden', enterAt: new Date(exit - 224 * 60_000).toISOString(), exitAt: at, minutes: 224, zone: 'Plac budowy Stegra Boden' });
  } else {
    out.push({ ...base, id: `${load.id}-du`, kind: 'DWELL', place: 'UNLOAD', where: 'Boden', noMeasure: 'jeszcze nie mierzono' });
  }
  const c = cancelFee(load.pricing.costBase, load.pricing.revBase, 4);
  out.push({ ...base, id: `${load.id}-c`, kind: 'CANCEL', place: null, where: '', noMeasure: 'nie dotyczy', cancelledAt: null, days: 4, pct: c.pct });
  return out;
}
