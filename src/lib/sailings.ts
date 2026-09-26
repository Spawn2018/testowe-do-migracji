/**
 * M10 — rejsy (STATUSY_AUTOMATYCZNE §3.2, §4): jedno źródło prawdy o rejsie (`sailings`),
 * przypisanie rejsu do transportu (HHL i przewoźnik; po wypłynięciu wyłącznie HHL),
 * rozkład zmienia HHL (dodanie, opóźnienie, odwołanie). Źródło Polferries — decyzja właściciela;
 * do tego czasu dane startowe + ręcznie.
 */
import type { FerryBooking, Load, LoadStatus, Locale, OrgKind, Risk, Sailing, SailingStatus } from '../types';

export const effDeparture = (s: Sailing): string => s.delayedDepartureAt ?? s.departureAt;
export const effArrival = (s: Sailing): string => s.delayedArrivalAt ?? s.arrivalAt;
export const hasDeparted = (s: Sailing, nowIso: string): boolean => Date.parse(effDeparture(s)) <= Date.parse(nowIso);

/** Statusy „na promie lub dalej” — rejsu nie zmienia już przewoźnik (lustro wyzwalacza 0008). */
const AFTER_FERRY: ReadonlySet<LoadStatus> = new Set<LoadStatus>(['ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED']);

export type SailingDenied = 'ROLE' | 'DEPARTED' | 'CANCELLED' | null;
/** Kto może zmienić przypisanie rejsu transportu. */
export function sailingAssignDenied(role: OrgKind, load: Load, current: Sailing | undefined, target: Sailing | null, nowIso: string): SailingDenied {
  if (role === 'HHL') return target && target.status === 'ODWOLANY' ? 'CANCELLED' : null;
  if (role !== 'SCX') return 'ROLE';
  if (AFTER_FERRY.has(load.status) || (current && hasDeparted(current, nowIso) && current.status !== 'ODWOLANY')) return 'DEPARTED';
  if (target && target.status === 'ODWOLANY') return 'CANCELLED';
  return null;
}

/** Rejsy do wyboru w szufladzie: Gdańsk → Nynäshamn, przyszłe i nieodwołane (+ bieżący). */
export function selectableSailings(all: Sailing[], nowIso: string, currentId: string | null | undefined): Sailing[] {
  return all
    .filter((s) => s.id === currentId || (s.route === 'GDN-NYN' && s.status !== 'ODWOLANY' && !hasDeparted(s, nowIso)))
    .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)));
}

/** Widok rezerwacji transportu z rejsu (jedno źródło prawdy). */
export function ferryFromSailing(s: Sailing | undefined, bookingRef: string | null, prev?: FerryBooking): FerryBooking {
  if (!s) return { vessel: prev?.vessel ?? null, departureAt: null, arrivalAt: null, bookingRef, status: bookingRef ? 'BOOKED' : 'NONE' };
  const vessel = s.vessel === 'Wawel' || s.vessel === 'Nova Star' ? s.vessel : null;
  const keep = prev && (prev.status === 'CHECKED_IN' || prev.status === 'ONBOARD' || prev.status === 'LANDED') ? prev.status : null;
  return {
    vessel,
    departureAt: effDeparture(s),
    arrivalAt: effArrival(s),
    bookingRef,
    status: s.status === 'ODWOLANY' ? 'CANCELLED' : s.status === 'OPOZNIONY' ? 'DELAYED' : keep ?? 'BOOKED',
  };
}

export interface SailingDraft { vessel: string; route: 'GDN-NYN' | 'NYN-GDN'; departureAt: string; arrivalAt: string }
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
 */
export function buildSeedSailings(fromLocal = '2026-09-18', days = 25): Sailing[] {
  const out: Sailing[] = [];
  const start = Date.parse(`${fromLocal}T18:00:00+02:00`);
  for (let i = 0; i < days; i++) {
    const dep = new Date(start + i * 864e5);
    const arr = new Date(dep.getTime() + 18 * 36e5);
    const vessel = i % 2 === 0 ? 'Wawel' : 'Nova Star';
    out.push({
      id: `sail-${dep.toISOString().slice(0, 10)}-${vessel === 'Wawel' ? 'W' : 'N'}`,
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
export type AutoRiskCode = 'AUTO_STATUS' | 'LOADING_UNCONFIRMED' | 'MISSED_SAILING' | 'SAILING_CANCELLED' | 'FERRY_OVERDUE';
export const AUTO_RISK_CODES: AutoRiskCode[] = ['AUTO_STATUS', 'LOADING_UNCONFIRMED', 'MISSED_SAILING', 'SAILING_CANCELLED', 'FERRY_OVERDUE'];

/** Kod ryzyka z rodzaju i klucza deduplikacji `risk_signals` (0004). */
export function autoRiskCode(kind: string, dedupKey: string | null | undefined): AutoRiskCode | undefined {
  if (kind === 'AUTO_STATUS') return 'AUTO_STATUS';
  if (kind === 'LOADING_UNCONFIRMED') return 'LOADING_UNCONFIRMED';
  const k = dedupKey ?? '';
  if (k.startsWith('MISSED_SAILING:')) return 'MISSED_SAILING';
  if (k.startsWith('SAILING_CANCELLED:')) return 'SAILING_CANCELLED';
  if (k.startsWith('FERRY_OVERDUE:')) return 'FERRY_OVERDUE';
  return undefined;
}

const RISK_LABEL: Record<AutoRiskCode, Record<Locale, string>> = {
  AUTO_STATUS: { pl: 'Zmiana automatyczna zablokowana', en: 'Automatic change blocked', sv: 'Automatisk ändring blockerad' },
  LOADING_UNCONFIRMED: { pl: 'Załadunek niepotwierdzony', en: 'Loading unconfirmed', sv: 'Lastning obekräftad' },
  MISSED_SAILING: { pl: 'Rejs przegapiony', en: 'Sailing missed', sv: 'Missad avgång' },
  SAILING_CANCELLED: { pl: 'Rejs odwołany', en: 'Sailing cancelled', sv: 'Avgång inställd' },
  FERRY_OVERDUE: { pl: 'PROM po czasie', en: 'FERRY overdue', sv: 'FÄRJA försenad' },
};
export const autoRiskLabel = (c: AutoRiskCode, locale: Locale): string => RISK_LABEL[c][locale];

/** Ryzyka odwołanego rejsu dla przypisanych transportów (demo; w bazie promote_ferry_departures). */
export function cancelledSailingRisks(s: Sailing, loads: Load[]): Risk[] {
  return loads.filter((l) => l.sailingId === s.id && !AFTER_FERRY.has(l.status)).map((l) => ({
    id: `risk-sail-cancel-${s.id}-${l.id}`, type: 'FERRY' as const, severity: 'HIGH' as const, loadId: l.id, owner: 'HHL' as const,
    title: `${l.code}: rejs ${s.vessel} ${fmtLocal(effDeparture(s))} odwołany — transport wymaga nowego rejsu`,
    detail: 'Rejs odwołany w rozkładzie (HHL). Przypisz transport do innego rejsu.',
    meta: 'Odpowiada: H&H Logistics', nextAction: 'Przypisz nowy rejs w szufladzie transportu', ageHours: 0,
    code: 'SAILING_CANCELLED' as const,
  }));
}

const SAILING_STATUS_LABEL: Record<SailingStatus, Record<Locale, string>> = {
  ZAPLANOWANY: { pl: 'Zaplanowany', en: 'Scheduled', sv: 'Planerad' },
  OPOZNIONY: { pl: 'Opóźniony', en: 'Delayed', sv: 'Försenad' },
  ODWOLANY: { pl: 'Odwołany', en: 'Cancelled', sv: 'Inställd' },
};
export const sailingStatusLabel = (s: SailingStatus, locale: Locale): string => SAILING_STATUS_LABEL[s][locale];
export const sailingStatusPill = (s: SailingStatus): string => (s === 'ODWOLANY' ? 'p-red' : s === 'OPOZNIONY' ? 'p-amber' : 'p-sea');

/** 'DD.MM HH:MM' w czasie PL (rozkład portu Gdańsk). */
export function fmtLocal(iso: string, tz = 'Europe/Warsaw'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = new Intl.DateTimeFormat('pl-PL', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('day')}.${g('month')} ${g('hour')}:${g('minute')}`;
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
