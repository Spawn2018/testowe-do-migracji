/**
 * M5 — numery zleceń (W12, MECHANIZM_PIENIEDZY §8).
 * KSH: z importu harmonogramu (tylko odczyt) · HHL: wpisuje HHL, obowiązkowy przed GOTOWY ·
 * SCX: wpisuje przewoźnik, obowiązkowy przed załadunkiem. Każda strona zmienia wyłącznie swój
 * numer — wymusza baza (0003 `enforce_order_numbers`, 0008 `guard_load_update`); tu to samo
 * po stronie aplikacji (tryb demo + natychmiastowy komunikat) oraz tłumaczenie błędów bazy.
 */
import type { Load, LoadStatus, Locale, Notification, Risk, RoleId } from '../types';

export type OrderSide = 'HHL' | 'CARRIER';

/** Wyprzedzenie przypomnienia o brakującym numerze względem planowego załadunku (godz.). */
export const ORDER_NO_LEAD_H = 48;

/** Statusy aplikacji wymagające numeru HHL (DB: READY…DELIVERED). */
const NEEDS_HHL: ReadonlySet<LoadStatus> = new Set<LoadStatus>([
  'READY', 'LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED',
]);
/** Statusy wymagające numeru przewoźnika (DB: AT_LOADING…DELIVERED). */
const NEEDS_CARRIER: ReadonlySet<LoadStatus> = new Set<LoadStatus>([
  'LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED',
]);

const blank = (v: string | null | undefined): boolean => !v || !v.trim();

/** Która strona może edytować który numer (KSH — żaden; numer KSH pochodzi z importu). */
export function editableOrderSide(role: RoleId): OrderSide | null {
  if (role === 'HHL') return 'HHL';
  if (role === 'SCX') return 'CARRIER';
  return null;
}

export type OrderGateReason = 'NO_HHL_ORDER' | 'NO_CARRIER_ORDER';

/** Lustro `enforce_order_numbers()` — null = przejście dozwolone. */
export function orderNumberGate(load: Pick<Load, 'hhlOrderNo' | 'carrierOrderNo'>, status: LoadStatus): OrderGateReason | null {
  if (NEEDS_HHL.has(status) && blank(load.hhlOrderNo)) return 'NO_HHL_ORDER';
  if (NEEDS_CARRIER.has(status) && blank(load.carrierOrderNo)) return 'NO_CARRIER_ORDER';
  return null;
}

type Msg = Record<Locale, string>;
const MSG = {
  NO_HHL_ORDER: {
    pl: 'Nie można oznaczyć jako gotowy — brak numeru zlecenia HHL. Numer wpisuje HHL w szufladzie transportu.',
    en: 'Cannot mark as ready — the HHL order number is missing. HHL enters it in the load drawer.',
    sv: 'Kan inte markeras som klar — HHL:s ordernummer saknas. HHL anger det i transportens panel.',
  },
  NO_CARRIER_ORDER: {
    pl: 'Załadunek niemożliwy — brak numeru zlecenia przewoźnika. Numer wpisuje przewoźnik w szufladzie transportu.',
    en: 'Loading not possible — the carrier order number is missing. The carrier enters it in the load drawer.',
    sv: 'Lastning inte möjlig — transportörens ordernummer saknas. Transportören anger det i transportens panel.',
  },
  CARRIER_ONLY: {
    pl: 'Numer zlecenia przewoźnika wpisuje wyłącznie przewoźnik.',
    en: 'Only the carrier can enter the carrier order number.',
    sv: 'Endast transportören kan ange transportörens ordernummer.',
  },
  HHL_ONLY: {
    pl: 'Numer zlecenia HHL wpisuje wyłącznie HHL.',
    en: 'Only HHL can enter the HHL order number.',
    sv: 'Endast HHL kan ange HHL:s ordernummer.',
  },
  PLAN_WINDOWS: {
    pl: 'Okna planowe załadunku i dostawy zmienia wyłącznie HHL — plan pochodzi z harmonogramu KSH.',
    en: 'Only HHL can change the planned loading and delivery windows — the plan comes from the KSH schedule.',
    sv: 'Endast HHL kan ändra planerade lastnings- och leveransfönster — planen kommer från KSH:s schema.',
  },
  DELIVERY_FROZEN: {
    pl: 'Data rozładunku zamrożona — transport jest na fakturze.',
    en: 'Unloading date frozen — the load is on an invoice.',
    sv: 'Lossningsdatum låst — transporten finns på en faktura.',
  },
  NO_BACKWARD: {
    pl: 'Status nie może się cofnąć.',
    en: 'The status cannot move backwards.',
    sv: 'Statusen kan inte gå bakåt.',
  },
  UNLOADED_NEEDS_DATE: {
    pl: 'Rozładunek wymaga daty rozładunku — to data realizacji usługi.',
    en: 'Unloading requires the unloading date — it is the service date.',
    sv: 'Lossning kräver lossningsdatum — det är tjänstens datum.',
  },
  DUPLICATE: {
    pl: 'Ten numer zlecenia jest już użyty w innym transporcie.',
    en: 'This order number is already used on another load.',
    sv: 'Detta ordernummer används redan på en annan transport.',
  },
} satisfies Record<string, Msg>;

export function orderGateMessage(reason: OrderGateReason, locale: Locale): string {
  return MSG[reason][locale] ?? MSG[reason].pl;
}

/** Próba zmiany cudzego numeru (W12). */
export function orderEditDeniedMessage(side: OrderSide, locale: Locale): string {
  const k = side === 'CARRIER' ? 'CARRIER_ONLY' : 'HHL_ONLY';
  return MSG[k][locale] ?? MSG[k].pl;
}

/** Komunikaty bazy (wyjątki z wyzwalaczy) → zrozumiały tekst. Nieznane → bez zmian. */
export function friendlyDbError(raw: string, locale: Locale = 'pl'): string {
  const m = (k: keyof typeof MSG) => MSG[k][locale] ?? MSG[k].pl;
  if (/bez numeru zlecenia HHL/i.test(raw)) return m('NO_HHL_ORDER');
  if (/bez numeru zlecenia przewo/i.test(raw)) return m('NO_CARRIER_ORDER');
  if (/Numer zlecenia przewo\S* wpisuje wy/i.test(raw)) return m('CARRIER_ONLY');
  if (/Przewo\S* nie mo\S* zmienia\S*:.*\b(hhl_order_no|order_no)\b/i.test(raw)) return m('HHL_ONLY');
  if (/Przewo\S* nie mo\S* zmienia\S*:.*\bplan_(load|delivery)/i.test(raw)) return m('PLAN_WINDOWS');
  if (/Data roz\S+ .*zamro/i.test(raw)) return m('DELIVERY_FROZEN');
  if (/Status nie mo\S* si\S* cofn/i.test(raw)) return m('NO_BACKWARD');
  if (/UNLOADED wymaga daty/i.test(raw)) return m('UNLOADED_NEEDS_DATE');
  if (/loads_(hhl|carrier)_order_no_uq/i.test(raw)) return m('DUPLICATE');
  return raw;
}

/**
 * Ryzyka „brak numeru przed terminem” (lustro `detect_missing_order_numbers()` z 0012):
 * HHL — przed GOTOWY, przewoźnik — przed załadunkiem; alarm od ORDER_NO_LEAD_H przed planowym załadunkiem.
 */
export function orderNoRisks(loads: Load[], nowIso: string): Risk[] {
  const now = Date.parse(nowIso);
  const out: Risk[] = [];
  const PRE_READY: ReadonlySet<LoadStatus> = new Set<LoadStatus>(['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING']);
  for (const l of loads) {
    const due = Date.parse(l.plannedLoadDate);
    if (!Number.isFinite(due) || due - now > ORDER_NO_LEAD_H * 36e5) continue;
    const ageHours = Math.max(0, Math.round((now - (due - ORDER_NO_LEAD_H * 36e5)) / 36e5));
    if (PRE_READY.has(l.status) && blank(l.hhlOrderNo)) {
      out.push({
        id: `risk-orderno-hhl-${l.id}`, type: 'OPS', severity: due <= now ? 'CRITICAL' : 'HIGH', loadId: l.id, owner: 'HHL',
        title: `${l.code}: brak numeru zlecenia HHL`,
        detail: 'Numer zlecenia HHL jest obowiązkowy przed statusem GOTOWY (W12).',
        meta: 'Odpowiada: HHL', nextAction: 'Wpisz numer zlecenia HHL w szufladzie transportu', ageHours,
      });
    }
    if ((PRE_READY.has(l.status) || l.status === 'READY') && blank(l.carrierOrderNo)) {
      out.push({
        id: `risk-orderno-scx-${l.id}`, type: 'OPS', severity: due <= now ? 'CRITICAL' : 'HIGH', loadId: l.id, owner: 'SCX',
        title: `${l.code}: brak numeru zlecenia przewoźnika`,
        detail: 'Numer zlecenia przewoźnika jest obowiązkowy przed załadunkiem (W12).',
        meta: 'Odpowiada: Scandinavian Express', nextAction: 'Wpisz numer zlecenia przewoźnika w szufladzie transportu', ageHours,
      });
    }
  }
  return out;
}

export const isOrderNoRisk = (r: Pick<Risk, 'id'>): boolean => r.id.startsWith('risk-orderno-');

/** Przypomnienie w centrum powiadomień — wyłącznie strona, która ma wpisać numer. */
export function orderNoReminders(risks: Risk[], atIso: string): Notification[] {
  return risks.filter(isOrderNoRisk).map((r) => ({
    id: `n-${r.id}`,
    at: atIso,
    title: r.title,
    body: r.nextAction,
    severity: r.severity,
    loadId: r.loadId,
    read: false,
    roleScope: [r.owner === 'SCX' ? 'SCX' : 'HHL'] as RoleId[],
    href: { view: 'risk', entityId: r.id, loadId: r.loadId },
  }));
}
