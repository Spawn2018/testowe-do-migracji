/**
 * M10 — rejsy (STATUSY_AUTOMATYCZNE §3.2, §4): jedno źródło prawdy o rejsie (`sailings`),
 * przypisanie rejsu do transportu (HHL i przewoźnik; po wypłynięciu wyłącznie Administrator HHL),
 * rozkład zmienia HHL (dodanie, opóźnienie, odwołanie). Źródło Polferries — decyzja właściciela;
 * do tego czasu dane startowe + ręcznie.
 */
import type { FerryBooking, Load, LoadStatus, Locale, OrgKind, Risk, Sailing, SailingStatus } from '../types';
import { dictEntry } from '../i18n/messages';
import { fmtDateTime, TZ_OPS, wallLocalToIso } from './time';

export const effDeparture = (s: Sailing): string => s.delayedDepartureAt ?? s.departureAt;
export const effArrival = (s: Sailing): string => s.delayedArrivalAt ?? s.arrivalAt;
export const hasDeparted = (s: Sailing, nowIso: string): boolean => Date.parse(effDeparture(s)) <= Date.parse(nowIso);

/** Statusy „na promie lub dalej” — rejsu nie zmienia już przewoźnik (lustro wyzwalacza 0008). */
const AFTER_FERRY: ReadonlySet<LoadStatus> = new Set<LoadStatus>(['ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED']);

/** Statusy, w których przewoźnik i Operacje HHL nie zmieniają rejsu — lustro `old.status >= 'FERRY'` w guard_load_update (0242). */
const SAILING_LOCKED_STATUSES: ReadonlySet<LoadStatus> = new Set<LoadStatus>([...AFTER_FERRY, 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED']);

export type SailingDenied = 'ROLE' | 'DEPARTED' | 'CANCELLED' | 'NOT_FOUND' | null;
/**
 * Kto może zmienić przypisanie rejsu transportu. D-20261020-1501-01 (właściciel 15:01): rejs, który już wypłynął,
 * przypisuje tylko Administrator HHL (`account` = HHL_ADMIN; w demo konto HHL bez „Operacji”); SCX i Operacje HHL —
 * tylko rejsy jeszcze przed wypłynięciem. `account` pominięty = jak dotąd (HHL bez ograniczeń poza odwołanym).
 */
export function sailingAssignDenied(
  role: OrgKind, load: Load, current: Sailing | undefined, target: Sailing | null, nowIso: string, account?: string | null,
): SailingDenied {
  if (target && target.status === 'ODWOLANY') return role === 'HHL' || role === 'SCX' ? 'CANCELLED' : 'ROLE';
  /* 0242 (D-1501): Administrator HHL — także rejsy historyczne i zmiana po wypłynięciu; Operacje HHL jak przewoźnik */
  /* w produkcji (supabase) Administrator tylko przy jawnym HHL_ADMIN; w demo konto HHL bez roli = Administrator */
  const admin = account === 'HHL_ADMIN' || (account == null && import.meta.env.VITE_AUTH_MODE !== 'supabase');
  if (role === 'HHL' && admin) return null;
  if (role !== 'SCX' && role !== 'HHL') return 'ROLE';
  if (SAILING_LOCKED_STATUSES.has(load.status) || (current && hasDeparted(current, nowIso) && current.status !== 'ODWOLANY')) return 'DEPARTED';
  if (target && hasDeparted(target, nowIso)) return 'DEPARTED';
  return null;
}

/**
 * D-20261020-1501-01: rejsy historyczne do wyboru dla Administratora HHL — trasa armatora, nieodwołane, już
 * wypłynęły i dopłynęły do Szwecji (przypłynięcie ≤ teraz); najnowsze pierwsze, z ostatnich `days` dni.
 */
export function historicalSailings(
  all: Sailing[],
  nowIso: string,
  operator: 'POLFERRIES' | 'STENA' = 'POLFERRIES',
  days = 60,
): Sailing[] {
  const outbound = operator === 'STENA' ? 'GDY-KAA' : 'GDN-NYN';
  const now = Date.parse(nowIso);
  const from = now - days * 86_400_000;
  return all
    .filter((s) => {
      if (s.route !== outbound || s.status === 'ODWOLANY') return false;
      const arr = Date.parse(effArrival(s));
      if (!(arr <= now) || arr < from) return false;
      const op = (s.operator ?? '').toLowerCase();
      if (operator === 'STENA') return op.includes('stena') || s.route === 'GDY-KAA';
      return !op.includes('stena');
    })
    .sort((a, b) => Date.parse(effDeparture(b)) - Date.parse(effDeparture(a)));
}

/** Rejsy do wyboru w szufladzie: trasa armatora, przyszłe i nieodwołane (+ bieżący). */
export function selectableSailings(
  all: Sailing[],
  nowIso: string,
  currentId: string | null | undefined,
  operator: 'POLFERRIES' | 'STENA' = 'POLFERRIES',
): Sailing[] {
  const outbound = operator === 'STENA' ? 'GDY-KAA' : 'GDN-NYN';
  return all
    .filter((s) => {
      if (s.id === currentId) return true;
      if (s.route !== outbound) return false;
      if (s.status === 'ODWOLANY') return false;
      if (hasDeparted(s, nowIso)) return false;
      const op = (s.operator ?? '').toLowerCase();
      if (operator === 'STENA') return op.includes('stena') || s.route === 'GDY-KAA';
      return !op.includes('stena');
    })
    .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)));
}

/** Widok rezerwacji transportu z rejsu (jedno źródło prawdy). */
export function ferryFromSailing(s: Sailing | undefined, bookingRef: string | null, prev?: FerryBooking): FerryBooking {
  if (!s) return { vessel: prev?.vessel ?? null, departureAt: null, arrivalAt: null, bookingRef, status: bookingRef ? 'BOOKED' : 'NONE' };
  const vessel = s.vessel || null;
  const keep = prev && (prev.status === 'CHECKED_IN' || prev.status === 'ONBOARD' || prev.status === 'LANDED') ? prev.status : null;
  return {
    vessel,
    departureAt: effDeparture(s),
    arrivalAt: effArrival(s),
    bookingRef,
    status: s.status === 'ODWOLANY' ? 'CANCELLED' : s.status === 'OPOZNIONY' ? 'DELAYED' : keep ?? 'BOOKED',
  };
}

export interface SailingDraft { vessel: string; route: Sailing['route']; departureAt: string; arrivalAt: string }
export type SailingDraftError = 'VESSEL' | 'TIMES' | 'ORDER' | 'DUPLICATE' | null;
export function checkSailingDraft(d: SailingDraft, all: Sailing[]): SailingDraftError {
  if (!d.vessel.trim()) return 'VESSEL';
  const dep = Date.parse(d.departureAt); const arr = Date.parse(d.arrivalAt);
  if (!Number.isFinite(dep) || !Number.isFinite(arr)) return 'TIMES';
  if (arr <= dep) return 'ORDER';
  if (all.some((s) => s.vessel === d.vessel && Date.parse(s.departureAt) === dep)) return 'DUPLICATE';
  return null;
}

/**
 * Rozkład startowy demo (DANE_STARTOWE): Gdańsk → Nynäshamn codziennie 18:00 czasu PL, ~18 h rejsu,
 * na zmianę Wawel / Nova Star; SG-32 — odwołany rejs Nova Star 24.09 20:00 (scenariusz z danych demo).
 * Godziny orientacyjne — rzeczywisty rozkład cargo wg ZRODLA_DANYCH.md (M12 / decyzja właściciela).
 * W-naprawy-2 (A9): 60 dni (do 16.11) — rozkład obejmuje wszystkie załadunki demo, więc SCX może wybrać rejs
 * w Awizacji (wcześniej 25 dni, do 12.10: transporty z załadunkiem później nie miały żadnego rejsu do wyboru).
 */
export function buildSeedSailings(fromLocal = '2026-09-18', days = 60): Sailing[] {
  const out: Sailing[] = [];
  const [y, m, d] = fromLocal.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    /* F7 runda 2: 18:00 czasu polskiego każdego dnia — także po zmianie czasu 25.10 (nie stałe 24 h w UTC) */
    const day = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    const dep = new Date(Date.parse(wallLocalToIso(`${day}T18:00`, TZ_OPS)!));
    const next = new Date(Date.UTC(y, m - 1, d + i + 1)).toISOString().slice(0, 10);
    const arr = new Date(Date.parse(wallLocalToIso(`${next}T12:00`, TZ_OPS)!)); /* przypłynięcie 12:00 następnego dnia */
    const vessel = i % 2 === 0 ? 'Wawel' : 'Nova Star';
    out.push({
      id: `sail-${day}-${vessel === 'Wawel' ? 'W' : 'N'}`,
      vessel, route: 'GDN-NYN', departureAt: dep.toISOString(), arrivalAt: arr.toISOString(),
      delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'DANE_STARTOWE',
    });
  }
  out.push({
    id: 'sail-2026-09-24-N-X', vessel: 'Nova Star', route: 'GDN-NYN',
    departureAt: '2026-09-24T18:00:00.000Z', arrivalAt: '2026-09-25T09:00:00.000Z',
    delayedDepartureAt: null, delayedArrivalAt: null, status: 'ODWOLANY', source: 'DANE_STARTOWE',
  });
  return out;
}

/** Transport → rejs demo: tylko gdy rezerwacja wskazuje dokładnie ten rejs (statek + odejście). */
export function linkSeedSailings(loads: Load[], sailings: Sailing[]): Load[] {
  return loads.map((l) => {
    if (l.sailingId || !l.ferry.vessel || !l.ferry.departureAt) return l;
    const s = sailings.find((x) => x.vessel === l.ferry.vessel && Date.parse(x.departureAt) === Date.parse(l.ferry.departureAt!));
    return s ? { ...l, sailingId: s.id } : l;
  });
}

/* ---------- ryzyka rejsów i automatu (M10) — kod z dedup_key bazy ---------- */
export type AutoRiskCode = 'AUTO_STATUS' | 'LOADING_UNCONFIRMED' | 'MISSED_SAILING' | 'SAILING_CANCELLED' | 'FERRY_OVERDUE'
  /* M12 — integracje (funkcje Edge) */
  | 'SOURCE_DOWN' | 'FERRY_UNKNOWN' | 'AIS_NYN';
export const AUTO_RISK_CODES: AutoRiskCode[] = ['AUTO_STATUS', 'LOADING_UNCONFIRMED', 'MISSED_SAILING', 'SAILING_CANCELLED', 'FERRY_OVERDUE'];

/** Kod ryzyka z rodzaju i klucza deduplikacji `risk_signals` (0004). */
export function autoRiskCode(kind: string, dedupKey: string | null | undefined): AutoRiskCode | undefined {
  if (kind === 'AUTO_STATUS') return 'AUTO_STATUS';
  if (kind === 'LOADING_UNCONFIRMED') return 'LOADING_UNCONFIRMED';
  const k = dedupKey ?? '';
  if (k.startsWith('MISSED_SAILING:')) return 'MISSED_SAILING';
  if (k.startsWith('SAILING_CANCELLED:')) return 'SAILING_CANCELLED';
  if (k.startsWith('FERRY_OVERDUE:')) return 'FERRY_OVERDUE';
  if (k.startsWith('SOURCE_DOWN:')) return 'SOURCE_DOWN';
  if (k.startsWith('FERRY_UNKNOWN:')) return 'FERRY_UNKNOWN';
  if (k.startsWith('AIS_NYN:')) return 'AIS_NYN';
  return undefined;
}

const RISK_LABEL: Record<AutoRiskCode, Record<Locale, string>> = {
  AUTO_STATUS: dictEntry('a6_risk_label_auto_status'),
  LOADING_UNCONFIRMED: dictEntry('a6_risk_label_loading_unconfirmed'),
  MISSED_SAILING: dictEntry('a6_risk_label_missed_sailing'),
  SAILING_CANCELLED: dictEntry('a6_risk_label_sailing_cancelled'),
  FERRY_OVERDUE: dictEntry('a6_risk_label_ferry_overdue'),
  SOURCE_DOWN: dictEntry('a6_risk_label_source_down'),
  FERRY_UNKNOWN: dictEntry('a6_risk_label_ferry_unknown'),
  AIS_NYN: dictEntry('a6_risk_label_ais_nyn'),
};
export const autoRiskLabel = (c: AutoRiskCode, locale: Locale): string => RISK_LABEL[c][locale];

/** Ryzyka odwołanego rejsu dla przypisanych transportów (demo; w bazie promote_ferry_departures). */
export function cancelledSailingRisks(s: Sailing, loads: Load[]): Risk[] {
  return loads.filter((l) => l.sailingId === s.id && !AFTER_FERRY.has(l.status)).map((l) => ({
    id: `risk-sail-cancel-${s.id}-${l.id}`, type: 'FERRY' as const, severity: 'HIGH' as const, loadId: l.id, owner: 'HHL' as const,
    title: `${l.code}: rejs ${s.vessel} ${fmtLocal(effDeparture(s))} odwołany — transport wymaga nowego rejsu`,
    detail: 'Rejs odwołany w rozkładzie (HHL). Przypisz transport do innego rejsu.',
    titleKey: 'rk_seed_sail_cancel', titleParams: { code: l.code, vessel: s.vessel, dep: fmtLocal(effDeparture(s)) },
    metaKey: 'risk_meta_owner', metaParams: { name: 'H&H Logistics' },
    meta: 'Odpowiada: H&H Logistics', nextAction: 'Przypisz nowy rejs w szufladzie transportu', ageHours: 0,
    code: 'SAILING_CANCELLED' as const,
  }));
}

const SAILING_STATUS_LABEL: Record<SailingStatus, Record<Locale, string>> = {
  ZAPLANOWANY: dictEntry('a6_sailing_status_label_zaplanowany'),
  OPOZNIONY: dictEntry('a6_sailing_status_label_opozniony'),
  ODWOLANY: dictEntry('a6_sailing_status_label_odwolany'),
  W_REJSIE: dictEntry('a6_sailing_status_label_w_rejsie'),
  DOPLYNAL: dictEntry('a6_sailing_status_label_doplynal'),
};
export const sailingStatusLabel = (s: SailingStatus, locale: Locale): string => SAILING_STATUS_LABEL[s][locale];
export const sailingStatusPill = (s: SailingStatus): string => (
  s === 'ODWOLANY' ? 'p-red' : s === 'OPOZNIONY' ? 'p-amber' : 'p-sea'
);

/** „DD.MM.RRRR, GG:MM” w czasie PL (B-REJSY: rok w datach; właściciel 16.10.2026). */
export function fmtLocal(iso: string, tz = 'Europe/Warsaw'): string {
  return fmtDateTime(iso, tz);
}

/** Oś zdarzeń: zmiana automatyczna z powodem (STATUS_AUTO z bazy: from/to/powod). */
export function autoStatusText(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  const from = typeof payload.from === 'string' ? payload.from : null;
  const to = typeof payload.to === 'string' ? payload.to : null;
  const why = typeof payload.powod === 'string' ? payload.powod : null;
  if (!from && !to && !why) return null;
  return `${from ?? '?'} → ${to ?? '?'}${why ? ` · ${why}` : ''}`;
}

/**
 * I-2e — pasek górny w produkcji: najbliższy rejs z tabeli `sailings` (rozkład armatora w bazie),
 * bez prognozy fali (brak źródła danych). Odwołane rejsy pomijane; opóźnienie → czas po opóźnieniu.
 */
export function nextDbSailing(all: readonly Sailing[], nowMs: number): Sailing | null {
  return [...all]
    .filter((s) => s.status !== 'ODWOLANY' && Date.parse(effDeparture(s)) >= nowMs)
    .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)))[0] ?? null;
}

/** L-9: ile najbliższych odejść do Szwecji pokazać na armatora. */
export const NEAREST_CROSSING_LIMIT = 3;

/**
 * L-9 — linia z rozkładu w bazie. Dane startowe (demo) nie są rozkładem.
 * Stena: źródło STENA albo armator ze słowem „stena”. Polferries analogicznie.
 * Ręczny wpis bez armatora: trasa GDY–KAA to Stena, GDN–NYN to Polferries.
 */
export function crossingLine(s: Sailing): 'POLFERRIES' | 'STENA' | null {
  if (s.source === 'DANE_STARTOWE') return null;
  const op = (s.operator ?? '').toLowerCase();
  if (s.source === 'STENA' || op.includes('stena')) return 'STENA';
  if (s.source === 'POLFERRIES' || op.includes('polferries')) return 'POLFERRIES';
  // Inny armator (np. TT-Line) nie jest ani Polferries, ani Steną — nie dopisujemy go do listy.
  if (op.trim()) return null;
  if (s.route === 'GDY-KAA' || s.route === 'KAA-GDY') return 'STENA';
  if (s.route === 'GDN-NYN' || s.route === 'NYN-GDN') return 'POLFERRIES';
  return null;
}

/**
 * L-9 — najbliższe rejsy do Szwecji z tabeli `sailings`.
 * Polferries: GDN–NYN. Stena: GDY–KAA. Odwołane i już odeszłe odpadają.
 * Pusta lista = brak rozkładu tego armatora (w interfejsie „Brak danych”).
 */
export function nearestCrossingSailings(
  all: readonly Sailing[],
  nowMs: number,
  limit = NEAREST_CROSSING_LIMIT,
): { polferries: Sailing[]; stena: Sailing[] } {
  const pick = (line: 'POLFERRIES' | 'STENA', route: Sailing['route']) =>
    all
      .filter((s) => {
        if (crossingLine(s) !== line || s.route !== route || s.status === 'ODWOLANY') return false;
        const dep = Date.parse(effDeparture(s));
        return Number.isFinite(dep) && dep >= nowMs;
      })
      .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)))
      .slice(0, limit);
  return { polferries: pick('POLFERRIES', 'GDN-NYN'), stena: pick('STENA', 'GDY-KAA') };
}

/**
 * B-2a — nadchodzące wypłynięcia do Szwecji w panelu Ryzyka (oba armatorzy).
 * Polferries: GDN–NYN. Stena: GDY–KAA. Lookback jak w dotychczasowym filtrze (3 h).
 */
export function upcomingOutboundSailings(
  all: readonly Sailing[],
  nowMs: number,
  lookbackMs = 3 * 3600_000,
  limit = 6,
): { polferries: Sailing[]; stena: Sailing[] } {
  const from = nowMs - lookbackMs;
  const pick = (line: 'POLFERRIES' | 'STENA', route: Sailing['route']) =>
    all
      .filter((s) => {
        if (crossingLine(s) !== line || s.route !== route) return false;
        const dep = Date.parse(effDeparture(s));
        return Number.isFinite(dep) && dep >= from;
      })
      .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)))
      .slice(0, limit);
  return { polferries: pick('POLFERRIES', 'GDN-NYN'), stena: pick('STENA', 'GDY-KAA') };
}

export function dbFerryWidget(s: Sailing | null, nowMs: number): { cd: string; line: string } | null {
  if (!s) return null;
  const depMs = Date.parse(effDeparture(s));
  const mins = Math.max(0, Math.round((depMs - nowMs) / 60_000));
  const dir =
    s.route === 'GDN-NYN' ? 'GDN→NYN'
      : s.route === 'NYN-GDN' ? 'NYN→GDN'
        : s.route === 'GDY-KAA' ? 'GDY→KAA'
          : 'KAA→GDY';
  return { cd: `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`, line: `${s.vessel} · ${fmtLocal(effDeparture(s))} · ${dir}` };
}
