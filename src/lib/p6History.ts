/**
 * wyglad/P6-b — Historia transportu (E17 pkt 2, img/e17-after „Historia”): dziennik wszystkich zmian po polsku,
 * „było → jest”, po dniach (najnowsze najpierw), filtry, autor „Imię Nazwisko // Firma”, „System // Watch Tower”
 * albo źródło pozycji („GPS …”), przy strefie jej nazwa. Wpisy bez zmiany ukryte i policzone.
 * Kto co widzi: KSH bez numerów zleceń (E41), bez ceny SCX i marży; SCX bez ceny KSH i marży; cena bez strony — tylko HHL.
 * Moduł czysty. Zapis „było → jest” w bazie (wyzwalacze, E17 pkt 3) — wykonawca; dziś bierzemy to, co jest w zdarzeniu,
 * a wartości poprzedniej, której zdarzenie nie ma, nie zgadujemy.
 */
import type { LoadEvent, LoadStatus, Locale } from '../types';
import { statusLabel } from './statusLabel';
import { statusFromDb } from '../data/mappers';
import { formatHistoryActor } from './historyActor';
import { docCategoryLabel, eventTypeLabel, readyGateReasonLabel } from './enumLabels';
import { ht, htHas, htp } from '../i18n/p6b';

export type HistCat = 'STATUS' | 'TRASA' | 'ZASOBY' | 'NUMER' | 'DOKUMENT' | 'CENA' | 'PLAN' | 'IMPORT' | 'PROBA' | 'NOTATKA' | 'INNE';
export type HistFilter = 'ALL' | 'ROUTE' | 'RES' | 'NUM' | 'DOC' | 'PRICE';
export const HIST_FILTERS: HistFilter[] = ['ALL', 'ROUTE', 'RES', 'NUM', 'DOC', 'PRICE'];
type Role = 'HHL' | 'KSH' | 'SCX';

const FILTER_CATS: Record<Exclude<HistFilter, 'ALL'>, HistCat[]> = {
  ROUTE: ['STATUS', 'TRASA'],
  RES: ['ZASOBY'],
  NUM: ['NUMER'],
  DOC: ['DOKUMENT'],
  PRICE: ['CENA'],
};

/** Filtry według firmy: KSH bez „Numery” (E41 — KSH nie widzi numerów zleceń). */
export function histFiltersFor(role: Role): HistFilter[] {
  return role === 'KSH' ? HIST_FILTERS.filter((f) => f !== 'NUM') : HIST_FILTERS;
}

const STATUS_WORDS = new Set(['LOADED', 'DEPARTED', 'AT_PORT', 'ON_FERRY', 'OFF_FERRY', 'APPROACHING', 'UNLOADED', 'DELIVERED',
  'STATUS_CHANGED', 'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'DRIVER_ON_FERRY']);
const ROUTE_WORDS = new Set(['SAILING_ASSIGNED', 'FERRY_UPDATED', 'PLAN_B_ACTIVATED', 'DELAY_DETECTED', 'SILENT_VEHICLE', 'DRIVER_PROBLEM']);

export function histCat(type: string): HistCat {
  if (/FEE|PRIC|SURCHARGE|MARGIN/.test(type)) return 'CENA';
  if (type.startsWith('STATUS_') || STATUS_WORDS.has(type)) return 'STATUS';
  if (type.startsWith('GEOFENCE') || type.startsWith('POSITION_') || ROUTE_WORDS.has(type)) return 'TRASA';
  if (type.startsWith('RESOURCES_') || type === 'AWIZACJA_UPDATED' || type === 'SCX_ASSIGNED' || type === 'ESCORTS_UPDATED') return 'ZASOBY';
  if (type === 'ORDER_NO_UPDATED') return 'NUMER';
  if (type.startsWith('DOC_') || type.startsWith('PERMIT_')) return 'DOKUMENT';
  if (type === 'SCHEDULE_IMPORTED') return 'IMPORT';
  if (type.startsWith('PLAN_DATES') || type.startsWith('SCHEDULE_')) return 'PLAN';
  if (type === 'READY_BLOCKED') return 'PROBA';
  if (type === 'NOTE') return 'NOTATKA';
  return 'INNE';
}

const DB_STATUSES = new Set(['PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY', 'AT_LOADING', 'IN_TRANSIT_PL', 'AT_PORT_GDANSK', 'FERRY',
  'AT_PORT_NYNASHAMN', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'AT_SITE', 'UNLOADED', 'DELIVERED', 'READY_TO_INVOICE', 'INVOICED']);

/** Nazwa statusu po polsku z kodu aplikacji albo bazy; nieznany kod — „—” (bez kodu). */
export function statusName(code: string | null | undefined, locale: Locale): string {
  if (!code) return '—';
  if (code === 'CANCELLED') return ht(locale, 'p6b_st_CANCELLED');
  const app = statusLabel(code as LoadStatus, undefined, locale);
  if (app !== code) return app;
  if (DB_STATUSES.has(code)) return statusLabel(statusFromDb(code), undefined, locale);
  return '—';
}
const isStatusCode = (v: string) => v === 'CANCELLED' || DB_STATUSES.has(v) || statusLabel(v as LoadStatus, undefined, 'pl') !== v;

export interface HistRow {
  id: string;
  at: string;
  cat: HistCat;
  /** tekst przed zmianą (np. „Nr zlecenia HHL:”); pusty przy samym statusie */
  head: string;
  /** „było” (przekreślone); null — wartości poprzedniej zdarzenie nie ma */
  from: string | null;
  /** „jest” (pogrubione) */
  to: string | null;
  /** dopisek po „ · ” (przyczyna, notatka) */
  tail: string | null;
  who: string;
  /** źródło po autorze („GPS emtrack”) */
  src: string | null;
}

const TZ = 'Europe/Warsaw';
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
};
const fmtDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

/** Wartość po polsku: status — nazwa, data — dd.mm.rrrr, tak / nie; obiekt — brak (nie drukujemy surowych danych). */
function fmtVal(v: unknown, locale: Locale): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return ht(locale, v ? 'p6b_yes' : 'p6b_no');
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtDay(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && Number.isFinite(Date.parse(s))) return fmtDateTime(s);
  if (/^[A-Z][A-Z_]+$/.test(s) && isStatusCode(s)) return statusName(s, locale);
  return s;
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const objectish = (v: unknown) => v !== null && typeof v === 'object';

function oldNew(p: Record<string, unknown>, locale: Locale): { from: string | null; to: string | null; has: boolean } {
  const rawFrom = 'old' in p ? p.old : 'from' in p ? p.from : p.before;
  const rawTo = 'new' in p ? p.new : 'to' in p ? p.to : p.after;
  const keys = 'old' in p || 'new' in p || 'from' in p || 'to' in p || 'before' in p || 'after' in p;
  return { from: fmtVal(rawFrom, locale), to: fmtVal(rawTo, locale), has: keys && !objectish(rawFrom) && !objectish(rawTo) };
}

/** Wpis bez zmiany sam w sobie (E17 fakty: „Gotowy → Gotowy”, ten sam numer „było = jest”). Powtórzenia — w `buildHistory`. */
export function isNoChange(e: LoadEvent): boolean {
  const p = e.payload ?? {};
  const on = oldNew(p, 'pl');
  if (on.has && on.from != null && on.from === on.to) return true;
  if (e.type.startsWith('STATUS_') && e.type !== 'STATUS_AUTO' && str(p.from) && statusName(str(p.from), 'pl') === statusName(e.type.slice(7), 'pl')) return true;
  return false;
}

const SIDE_KSH = new Set(['REVENUE', 'CLIENT', 'KSH']);
const SIDE_SCX = new Set(['COST', 'CARRIER', 'SCX']);

/**
 * Kto co widzi (E17 pkt 2, E41): KSH bez numerów zleceń; ceny — HHL wszystkie, KSH tylko strona przychodu,
 * SCX tylko strona kosztu; marża i cena bez oznaczonej strony — tylko HHL.
 */
export function visibleFor(e: LoadEvent, role: Role): boolean {
  if (role === 'HHL') return true;
  const cat = histCat(e.type);
  if (cat === 'NUMER') return role !== 'KSH';
  if (cat !== 'CENA') return true;
  const side = String(e.payload?.side ?? '').toUpperCase();
  return role === 'KSH' ? SIDE_KSH.has(side) : SIDE_SCX.has(side);
}

const ORG_FULL: Record<string, string> = { HHL: 'H&H Logistics', SCX: 'Scandinavian Express', KSH: 'KSH' };

/** Autor (E6, E17): „Imię Nazwisko // Firma”; wpis z samą firmą — „Firma (zapis bez osoby)”; automaty — „System // Watch Tower”. */
export function whoOf(actor: string | null | undefined, locale: Locale): string {
  const raw = String(actor ?? '').trim();
  if (raw === 'driver-pwa' || raw === 'DRIVER') return ht(locale, 'p6b_driver_app');
  const s = formatHistoryActor(raw);
  const bare = /^—\s*\/\/\s*(.+)$/.exec(s);
  if (bare) return `${ORG_FULL[bare[1].trim()] ?? bare[1].trim()} ${ht(locale, 'p6b_no_person')}`;
  const i = s.indexOf(' // ');
  if (i > 0) {
    const firm = s.slice(i + 4).trim();
    return `${s.slice(0, i)} // ${ORG_FULL[firm] ?? firm}`;
  }
  return s;
}

/** Źródło pozycji: „GPS emtrack” (z dostawcą), „AIS”, „GPS”. */
function posSource(p: Record<string, unknown>, locale: Locale): string {
  if (String(p.source ?? '').toUpperCase() === 'AIS') return ht(locale, 'p6b_src_AIS');
  const prov = str(p.provider ?? p.source_name);
  return prov ? `${ht(locale, 'p6b_src_GPS')} ${prov}` : ht(locale, 'p6b_src_GPS');
}

function srcOf(p: Record<string, unknown>, locale: Locale): string | null {
  const raw = String(p.source ?? '').toUpperCase();
  if (raw === 'GPS' || raw === 'AIS' || typeof p.lat === 'number') return posSource(p, locale);
  return htHas(`p6b_src_${raw}`) ? ht(locale, `p6b_src_${raw}`) : null;
}

/** Słowa techniczne w notatce (kody, nazwy pól) — takiej notatki nie pokazujemy (E17: bez kodów). */
const TECH = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[a-z]+_[a-z_]+\b|\b[A-Z]{4,}\b|→\s*vault/;

/** Notatka po polsku albo nic: znane przyczyny blokady przetłumaczone, rozmiar pliku i kody kategorii usunięte. */
function cleanNote(note: string | null, type: string, locale: Locale): string | null {
  if (!note) return null;
  let s = note.replace(/\s*\(\d+ B\)/g, '').replace(/\s*→\s*vault\s*$/i, '').trim();
  if (type.startsWith('DOC_')) {
    const m = /^([A-Z][A-Z_]+):\s*(.+)$/.exec(s);
    if (m) s = `${docCategoryLabel(m[1], locale)}: ${m[2]}`;
  }
  if (type === 'READY_BLOCKED') {
    s = s.replace(/^(READY|Wyjazd):\s*/i, '');
    s = readyGateReasonLabel(s, locale);
  }
  /* notatka człowieka (NOTE) zostaje jak jest; techniczne zapisy automatów — tylko bez kodów */
  return s && (type === 'NOTE' || !TECH.test(s)) ? s : null;
}

const META_KEYS = new Set(['source', 'provider', 'source_name', 'side', 'lat', 'lng', 'synthetic', 'by', 'code', 'status']);

/** Notatka powtarza nazwę wpisu („Rozładowano · Rozładowany”, „Na promie · Na promie”) — bez dopisku. */
function repeats(note: string, head: string): boolean {
  const a = note.toLowerCase();
  const b = head.toLowerCase();
  return a === b || (!a.includes(' ') && a.length >= 6 && a.slice(0, 6) === b.slice(0, 6));
}

export function histRow(e: LoadEvent, locale: Locale, zones: ReadonlyMap<string, string> = new Map()): HistRow {
  const p = e.payload ?? {};
  const cat = histCat(e.type);
  const on = oldNew(p, locale);
  const note = cleanNote(str(e.note), e.type, locale);
  const base = { id: e.id, at: e.at, cat, who: whoOf(e.actor, locale), src: srcOf(p, locale) };

  if (e.type === 'STATUS_AUTO') {
    const from = str(p.from) ? statusName(str(p.from), locale) : null;
    const to = str(p.to) ? statusName(str(p.to), locale) : null;
    const why = cleanNote(str(p.powod ?? p.reason), e.type, locale) ?? note;
    if (!from && !to) return { ...base, head: ht(locale, 'p6b_ev_STATUS_AUTO'), from: null, to: null, tail: why };
    return { ...base, head: '', from, to: to ?? '—', tail: why };
  }
  if (e.type.startsWith('STATUS_') && e.type !== 'STATUS_CHANGED') {
    const to = statusName(e.type.slice(7), locale);
    const from = str(p.from) ? statusName(str(p.from), locale) : null;
    return { ...base, head: '', from, to, tail: note };
  }
  if (e.type.startsWith('GEOFENCE')) {
    const id = str(p.geofence_id ?? p.geofenceId);
    const zoneName = str(p.geofence_name ?? p.zone_name ?? p.zone ?? p.name) ?? (id ? zones.get(id) ?? null : null);
    const zone = zoneName ? `„${zoneName}”` : ht(locale, 'p6b_ev_zone_none');
    const kind = e.type.endsWith('EXIT') ? 'EXIT' : e.type.includes('DWELL') ? 'DWELL' : 'ENTER';
    /* E17: autor wpisu ze strefy — źródło pozycji („GPS emtrack”) */
    return { ...base, who: posSource(p, locale), src: null, head: htp(locale, `p6b_ev_GEOFENCE_${kind}`, { zone }), from: null, to: null, tail: null };
  }
  if (e.type === 'RESOURCES_UPDATED' && !on.has) {
    const keys = Object.keys(p).filter((k) => p[k] !== undefined && !META_KEYS.has(k));
    const names = [...new Set(keys.map((k) => (htHas(`p6b_field_${k}`) ? ht(locale, `p6b_field_${k}`) : ht(locale, 'p6b_field_other'))))];
    return { ...base, head: htp(locale, 'p6b_ev_RESOURCES_UPDATED', { fields: names.join(', ') || ht(locale, 'p6b_field_other') }), from: null, to: null, tail: null };
  }
  if (e.type === 'ORDER_NO_UPDATED') {
    const side = String(p.side ?? '').toUpperCase();
    const raw = str(e.note);
    const noteSide = raw && /^Nr zlecenia HHL/i.test(raw) ? 'HHL' : raw && /^Nr zlecenia/i.test(raw) ? 'SCX' : null;
    const s = side === 'HHL' ? 'HHL' : side === 'CARRIER' || side === 'SCX' ? 'SCX' : noteSide;
    const label = s ? ht(locale, `p6b_ev_ORDER_NO_${s}`) : ht(locale, 'p6b_ev_ORDER_NO_UPDATED');
    if (on.has) return { ...base, head: `${label}:`, from: on.from ?? '—', to: on.to ?? ht(locale, 'p6b_removed'), tail: null };
    if (raw && raw.includes(':')) {
      /* dzisiejszy zapis przeglądarki: „Nr zlecenia HHL: 0005/09/S/2026” — wartości poprzedniej nie ma, nie zgadujemy */
      const v = raw.slice(raw.indexOf(':') + 1).trim();
      return { ...base, head: `${label}:`, from: null, to: v && v !== '—' ? v : ht(locale, 'p6b_removed'), tail: null };
    }
    return { ...base, head: label, from: null, to: null, tail: null };
  }
  if (e.type === 'PLAN_DATES_CHANGED') {
    /* 0192: daty planu przed i po (dzień załadunku i dostawy) */
    const ld = [fmtVal(p.before_load_date, locale), fmtVal(p.load_date, locale)];
    const dd = [fmtVal(p.before_delivery_date, locale), fmtVal(p.delivery_date, locale)];
    const head = eventTypeLabel('PLAN_DATES_CHANGED', locale);
    const delTail = dd[1] && dd[0] !== dd[1] ? htp(locale, 'p6b_plan_del', { a: dd[0] ?? '—', b: dd[1] }) : null;
    if (ld[1] && ld[0] !== ld[1]) return { ...base, head: `${head} · ${ht(locale, 'p6b_plan_load')}`, from: ld[0] ?? '—', to: ld[1], tail: delTail };
    return { ...base, head, from: null, to: null, tail: delTail };
  }
  if (e.type === 'SCHEDULE_IMPORTED') {
    const ver = str(p.version);
    const file = str(p.file_name ?? p.file);
    const tail = ver || file
      ? [ver ? htp(locale, 'p6b_import_ver', { v: ver }) : null, file ? htp(locale, 'p6b_import_file', { f: file }) : null].filter(Boolean).join(', ')
      : note && !/^KSH import\b/i.test(note) ? note : null;
    return { ...base, head: ht(locale, 'p6b_ev_SCHEDULE_IMPORTED'), from: null, to: null, tail };
  }
  const head = htHas(`p6b_ev_${e.type}`) ? ht(locale, `p6b_ev_${e.type}`)
    : cat === 'CENA' ? ht(locale, e.type.includes('FEE') ? 'p6b_ev_FEE' : 'p6b_ev_PRICE')
      : eventTypeLabel(e.type, locale) !== e.type ? eventTypeLabel(e.type, locale) : ht(locale, 'p6b_ev_OTHER');
  if (on.has && (on.from != null || on.to != null)) return { ...base, head: `${head}:`, from: on.from ?? '—', to: on.to ?? '—', tail: note };
  return { ...base, head, from: null, to: null, tail: note && !repeats(note, head) ? note : null };
}

export interface HistDay { day: string; rows: HistRow[] }

export const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export const hhmm = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** „07.10.2026” */
export const dmy = (day: string) => fmtDay(day);
/** „07.10.2026 · środa” */
export function dayLabel(day: string): string {
  const wd = new Intl.DateTimeFormat('pl-PL', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${day}T12:00:00Z`));
  return `${fmtDay(day)} · ${wd}`;
}

/** Zapisy, których powtórzenie nic nie zmienia (ten sam numer, te same zasoby, ta sama awizacja, te same daty). */
const REPEAT_IS_NOOP = new Set(['ORDER_NO_UPDATED', 'RESOURCES_UPDATED', 'AWIZACJA_UPDATED', 'SAILING_ASSIGNED', 'FERRY_UPDATED', 'SCX_ASSIGNED', 'PLAN_DATES_CHANGED']);
const sig = (e: LoadEvent) => `${e.type}|${e.note ?? ''}|${JSON.stringify(e.payload ?? {}, Object.keys(e.payload ?? {}).sort())}`;

/** Identyfikatory wpisów bez zmiany: sam wpis „było = jest”, powtórzenie poprzedniego zapisu tego rodzaju, „rejs usunięty” bez rejsu. */
export function noChangeIds(events: readonly LoadEvent[]): Set<string> {
  const out = new Set<string>();
  const last = new Map<string, string>();
  let sailing = false;
  for (const e of [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (isNoChange(e)) { out.add(e.id); continue; }
    if (e.type === 'SAILING_ASSIGNED') {
      const removed = /usunięt/i.test(e.note ?? '') || (e.payload && 'sailing_id' in e.payload && e.payload.sailing_id == null);
      if (removed && !sailing) { out.add(e.id); continue; }
      sailing = !removed;
    }
    if (REPEAT_IS_NOOP.has(e.type)) {
      const k = e.type === 'ORDER_NO_UPDATED' ? `${e.type}|${String(e.payload?.side ?? (e.note ?? '').split(':')[0])}` : e.type;
      const s = sig(e);
      if (last.get(k) === s) { out.add(e.id); continue; }
      last.set(k, s);
    }
  }
  return out;
}

export function buildHistory(
  events: readonly LoadEvent[],
  role: Role,
  filter: HistFilter,
  locale: Locale,
  zones: ReadonlyMap<string, string> = new Map(),
): { days: HistDay[]; hidden: number; total: number } {
  const seen = new Set<string>();
  const valid = events.filter((e) => {
    if (seen.has(e.id) || !Number.isFinite(Date.parse(e.at)) || !visibleFor(e, role)) return false;
    seen.add(e.id);
    return true;
  });
  const inFilter = (e: LoadEvent) => filter === 'ALL' || FILTER_CATS[filter].includes(histCat(e.type));
  const noop = noChangeIds(valid);
  const hidden = valid.filter((e) => noop.has(e.id) && inFilter(e)).length;
  const rows = valid
    .filter((e) => !noop.has(e.id) && inFilter(e))
    .map((e) => histRow(e, locale, zones))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const days: HistDay[] = [];
  for (const r of rows) {
    const k = dayKey(r.at);
    const last = days[days.length - 1];
    if (last && last.day === k) last.rows.push(r);
    else days.push({ day: k, rows: [r] });
  }
  return { days, hidden, total: rows.length };
}
