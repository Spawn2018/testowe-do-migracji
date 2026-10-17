/**
 * wyglad/P4-c — teksty do wyglądu z danych, które dostarcza wykonawca (bez zapytań i zapisów):
 * - pole „Link śledzenia” (E44 pkt 1, 5, 6, 8): wynik zapytania testowego, ostrzeżenia, gdzie jest lokalizator;
 * - „Gotowy” (L6, L9, L29): czego brakuje i kto uzupełnia;
 * - opis lokalizatora w pasku śledzenia panelu (E44 pkt 6).
 * Samego linku RIO nie pokazujemy nigdy (klucz `secret`, E44 pkt 8) — tylko „RIO · <rejestracja> · ••••”.
 */
import type { Load, Locale, ReadyGap, TrackingLinkInfo } from '../types';
import { t, tp } from '../i18n/messages';
import { dayOnly, dayTime, isoMs, timeOnly } from './statusAxis';
import { TZ_OPS, wallLocalToIso } from './time';

/** godzina czasu polskiego w danym dniu → ms (zmiana czasu 25.10 — bez stałego „+02:00”) */
const warsawMs = (day: string, hhmm: string) => isoMs(wallLocalToIso(`${day}T${hhmm}`, TZ_OPS));

export type TlTone = 'ok' | 'info' | 'warn' | 'bad';
export type TlNote = { key: string; tone: TlTone; text: string };

/** Koniec planowanej dostawy: okno KSH z godziną albo koniec dnia dostawy (czas polski). */
export function deliveryRefMs(load: Pick<Load, 'plannedDeliverDate' | 'planDates'>): number {
  const to = load.planDates?.deliveryTo;
  if (to && /T\d{2}:\d{2}/.test(to)) return isoMs(to);
  const day = (to ?? load.plannedDeliverDate ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? warsawMs(day, '23:59') : Number.NaN;
}

/** Start okna śledzenia: 03:00 czasu polskiego w dniu załadunku (E27, L15, L16). */
export function trackingStartMs(load: Pick<Load, 'plannedLoadDate'>): number {
  const day = (load.plannedLoadDate ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? warsawMs(day, '03:00') : Number.NaN;
}

function trackerLine(info: TrackingLinkInfo, locale: Locale): string | null {
  const asset = (info.asset ?? '').trim();
  if (!asset) return null;
  if (info.trackerOn === 'NACZEPA') return tp(locale, 'p4c_tl_on_trailer', { asset });
  if (info.trackerOn === 'CIAGNIK_PL') return tp(locale, 'p4c_tl_on_tractor_pl', { asset });
  if (info.trackerOn === 'CIAGNIK_SE') return tp(locale, 'p4c_tl_on_tractor_se', { asset });
  return null;
}

/**
 * Wynik zapytania testowego i ostrzeżenia pod polem „Link śledzenia” (E44 pkt 1, 5, 6).
 * `check` — jedna linia stanu linku; `notes` — ostrzeżenia i informacje; `tracker` — gdzie jest lokalizator.
 */
export function trackingLinkNotes(
  info: TrackingLinkInfo,
  load: Pick<Load, 'plannedLoadDate' | 'plannedDeliverDate' | 'planDates'>,
  nowIso: string,
  locale: Locale,
): { check: TlNote | null; notes: TlNote[]; tracker: string | null } {
  const now = isoMs(nowIso);
  const asset = (info.asset ?? '').trim();
  const to = info.validTo ?? null;
  const expired = !!to && isoMs(to) <= now;
  let check: TlNote | null = null;
  if (expired) {
    check = { key: 'expired', tone: 'bad', text: tp(locale, 'p4c_tl_expired', { at: dayTime(to) }) };
  } else if (info.check?.state === 'ok') {
    const base = to
      ? asset
        ? tp(locale, 'p4c_tl_ok', { asset, to: dayTime(to) })
        : tp(locale, 'p4c_tl_ok_noasset', { to: dayTime(to) })
      : asset
        ? tp(locale, 'p4c_tl_ok_nodate', { asset })
        : t(locale, 'p4c_tl_ok_bare');
    const fix = info.check.lastFixAt ? tp(locale, 'p4c_tl_ok_fix', { at: timeOnly(info.check.lastFixAt) }) : null;
    check = { key: 'ok', tone: 'ok', text: fix ? `${base} · ${fix}` : base };
  } else if (info.check?.state === 'pending') {
    check = { key: 'pending', tone: 'info', text: t(locale, 'p4c_tl_pending') };
  } else if (info.check?.state === 'invalid') {
    check = { key: 'invalid', tone: 'bad', text: t(locale, 'p4c_tl_invalid') };
  } else if (info.check?.state === 'down') {
    check = { key: 'down', tone: 'warn', text: t(locale, 'p4c_tl_down') };
  }

  const notes: TlNote[] = [];
  const used = (info.usedBy ?? []).filter(Boolean);
  if (used.length) notes.push({ key: 'used-by', tone: 'warn', text: tp(locale, 'p4c_tl_used_by', { list: used.join(', ') }) });
  if (info.trackerOn === 'NIEZNANY' && asset) notes.push({ key: 'unknown-asset', tone: 'warn', text: tp(locale, 'p4c_tl_unknown_asset', { asset }) });
  const deliv = deliveryRefMs(load);
  if (!expired && to && Number.isFinite(deliv) && isoMs(to) < deliv) {
    notes.push({ key: 'expires-early', tone: 'warn', text: tp(locale, 'p4c_tl_expires_early', { to: dayTime(to), day: dayOnly(load.planDates?.deliveryTo ?? load.plannedDeliverDate) }) });
  }
  if (info.validFrom && rioStartsLate(info, load, nowIso)) {
    notes.push({ key: 'starts-late', tone: 'info', text: tp(locale, 'p4c_tl_starts_late', { from: dayTime(info.validFrom) }) });
  }
  return { check, notes, tracker: expired ? null : trackerLine(info, locale) };
}

/** Opis lokalizatora w pasku śledzenia panelu (E44 pkt 5, 6); null = bez danych z serwera (zostaje opis P4-b). */
/** Link RIO nadaje później niż od startu okna śledzenia (03:00 w dniu załadunku) i ten czas jeszcze nie minął (E44 pkt 5). */
export function rioStartsLate(info: TrackingLinkInfo | null | undefined, load: Pick<Load, 'plannedLoadDate'> | null, nowIso: string): boolean {
  const from = info?.validFrom;
  if (!from || isoMs(from) <= isoMs(nowIso)) return false;
  const start = load ? trackingStartMs(load) : Number.NaN;
  return !Number.isFinite(start) || isoMs(from) > start;
}

export function trackerBarRio(info: TrackingLinkInfo | null | undefined, nowIso: string, locale: Locale, load: Pick<Load, 'plannedLoadDate'> | null = null): string | null {
  if (!info || info.provider !== 'RIO') return null;
  const now = isoMs(nowIso);
  if (info.validTo && isoMs(info.validTo) <= now) return tp(locale, 'p4c_trk_rio_expired', { at: dayTime(info.validTo) });
  const asset = (info.asset ?? '').trim();
  let text = t(locale, 'p4b_tracker_rio');
  if (asset && info.trackerOn === 'NACZEPA') text = tp(locale, 'p4c_trk_rio_trailer', { asset });
  else if (asset && (info.trackerOn === 'CIAGNIK_PL' || info.trackerOn === 'CIAGNIK_SE')) text = tp(locale, 'p4c_trk_rio_tractor', { asset });
  else if (asset && info.trackerOn === 'NIEZNANY') text = tp(locale, 'p4c_trk_rio_unknown', { asset });
  if (info.validFrom && rioStartsLate(info, load, nowIso)) text = `${text} · ${tp(locale, 'p4c_trk_rio_starts', { from: dayTime(info.validFrom) })}`;
  return text;
}

/* słowa listy braków (kontrakt A9 z bazą) → etykiety okna Awizacja („kierowca odcinka SE”) */
const AWIZ_ITEM_LABEL: Readonly<Record<string, string>> = {
  'kierowca SE': 'kierowca odcinka SE',
  'telefon SE': 'telefon odcinka SE',
  'ciągnik SE': 'ciągnik odcinka SE',
};

function gapLabel(g: ReadyGap, locale: Locale): string {
  const base = t(locale, `p4c_gap_${g.kind}`);
  const items = (g.items ?? []).filter(Boolean).map((x) => (g.kind === 'AWIZ' ? AWIZ_ITEM_LABEL[x] ?? x : x));
  if (!items.length) return base;
  /* „zezwolenie PL, SE”; pozostałe: „awizacja (naczepa, telefon)” */
  return g.kind === 'PERMIT' ? `${base} ${items.join(', ')}` : `${base} (${items.join(', ')})`;
}

/** „Brakuje: …” i „Uzupełnia …” do „Gotowy” (L6, L9, L29). */
export function readyGapsText(gaps: readonly ReadyGap[], locale: Locale): { list: string; who: string } {
  const list = gaps.map((g) => gapLabel(g, locale)).join(' · ');
  const order: ReadyGap['who'][] = [];
  for (const g of gaps) if (!order.includes(g.who)) order.push(g.who);
  const who = order.length > 1
    ? order
      .map((w) => `${t(locale, `p4c_who_${w}`)} (${gaps.filter((g) => g.who === w).map((g) => t(locale, `p4c_gap_${g.kind}`)).join(', ')})`)
      .join(' i ')
    : order.length
      ? t(locale, `p4c_who_${order[0]}`)
      : '';
  return { list, who };
}
