/**
 * L-5 — dzwonek bez napisu „przeczytane”.
 * Po kliknięciu pozycja jest przeczytana i znika z listy. Licznik to długość listy.
 */
import { isTechnicalRoadNotice } from './format';
import { plPlural } from './plPlural';
export interface BellItem {
  id: string;
  read: boolean;
  roleScope?: readonly string[];
}

export function bellVisible<T extends BellItem>(items: readonly T[], role: string): T[] {
  return items.filter((n) => {
    const scoped = !n.roleScope || n.roleScope.length === 0 || n.roleScope.includes(role);
    return scoped && !n.read;
  });
}

export function bellAfterClick<T extends BellItem>(items: readonly T[], id: string): T[] {
  return items.map((n) => (n.id === id ? { ...n, read: true } : n));
}

/**
 * AUD-02 (audyt 06.10, A2) — pozycja dzwonka: tytuł „<kod transportu> · <co się stało>”, czas względny
 * („15 min temu”), grupowanie zdarzeń tego samego rodzaju dla jednego transportu, zero kodów szablonów.
 */
export type BellLocale = 'pl' | 'en' | 'sv';

export interface BellSource extends BellItem {
  at: string;
  title: string;
  body: string;
  severity: string;
  loadId?: string;
  kind?: string;
  code?: string;
  /** Cel kliknięcia (L-4) — tylko do napisu „DECYZJA ›”, „DOKUMENTY ›”… przy pozycji. */
  href?: { view?: string; path?: string; loadId?: string };
  /** wyglad/P6-e: wiadomość Czatu „tylko HHL i SCX” (z `visible_to` bez KSH — D-20261016-0310-01 Cz14). */
  chatOnly?: boolean;
}

/** Wiadomość w Czacie (szablon czatu) — w dzwonku jako „SG-03 — kto” i treść (D-20261016-0310-01 Cz14, Cz23; E41). */
export const isChatKind = (k: string | undefined): boolean => k === 'LOAD_CHAT_MESSAGE' || k === 'MESSAGE';

const CHAT_MAX = 160;

/**
 * E5 (img/e5-desk, decyzja 07.10 13:21): dzwonek w grupach.
 * „Do zrobienia” — decyzje, braki, wiadomości i faktury dla Twojej firmy lub roli;
 * „Moje transporty” — strefy, statusy i ryzyka przed pojazdem, zgrupowane na transport;
 * „Sytuacja ogólna” — promy, drogi, pogoda bez przypisanego transportu: tylko strona Ryzyka, nigdy dzwonek.
 */
export type BellSection = 'todo' | 'mine' | 'general';

/** Sytuacja ogólna, gdy wpis nie ma transportu (E5 13:21). */
const GENERAL_KINDS = new Set([
  'RISK_OPEN', 'RISK_RESOLVED', 'RISK_SEVERITY', 'FERRY', 'FERRY_CANCELLED', 'SAILING_CANCELLED', 'MISSED_SAILING',
  'FERRY_OVERDUE', 'WEATHER', 'ROAD_PL', 'ROAD_SE', 'ROAD_RISK', 'ROUTE_OBSTACLE',
]);
/** Informacja o transporcie (E11 grupy „Transport” i „Ryzyka”) — „Moje transporty”. */
const INFO_KINDS = new Set([
  'STATUS_CHANGE', 'LOAD_STATUS_CHANGED', 'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'ZONE', 'ZONE_ENTER',
  'ZONE_EXIT', 'MILESTONE_LOADED', 'MILESTONE_UNLOADED', 'AWIZACJA', 'PLAN_DATES_CHANGED', 'FEE_DECIDED',
  'DECISION_RESOLVED', 'INVOICE_DISPUTE_RESOLVED', 'RISK_OPEN', 'RISK_RESOLVED', 'ROAD_PL', 'ROAD_SE', 'WEATHER',
  'FERRY', 'ROUTE_OBSTACLE', 'WORKFLOW_ALERT',
]);

/** P11 (e5, E5): informacje bez działania i bez transportu („Faktura zaakceptowana”, „Import harmonogramu zatwierdzony”) —
 *  „Moje transporty”, nie „Do zrobienia” (tam tylko sprawy z działaniem). */
const INFO_NOLOAD_KINDS = new Set(['SCHEDULE_IMPORTED', 'INVOICE_ACCEPTED']);

export function bellSection(n: Pick<BellSource, 'kind' | 'loadId' | 'severity' | 'href'>): BellSection {
  const k = n.kind;
  if (k) {
    if (!n.loadId && GENERAL_KINDS.has(k)) return 'general';
    if (INFO_NOLOAD_KINDS.has(k)) return 'mine';
    if (k === 'RISK_SEVERITY') return n.severity === 'CRITICAL' ? 'todo' : 'mine';
    if (n.loadId && INFO_KINDS.has(k)) return 'mine';
    return 'todo';
  }
  /* wpis bez szablonu (dane przykładowe): ryzyko bez transportu = sytuacja ogólna, zdarzenie transportu = moje */
  const view = n.href?.view;
  const load = n.loadId ?? n.href?.loadId;
  if (!load && view === 'risk') return 'general';
  if (load && (view === 'sched' || view === 'map' || view === 'geo' || view === 'wf' || view === 'risk')) return 'mine';
  return 'todo';
}

/**
 * E9 (07.10 19:11) „KSH: … nie ma własnej listy »Do zrobienia«” (audyt-F F-02): u KSH dzwonek ma jedną grupę
 * „Moje transporty” — bez sekcji i liczby „Do zrobienia”. Pozostałe firmy według `bellSection`.
 */
export function sectionFor(section: Exclude<BellSection, 'general'>, role: string): Exclude<BellSection, 'general'> {
  return role === 'KSH' ? 'mine' : section;
}

/** Miejsce, do którego prowadzi kliknięcie — napis po prawej („DECYZJA ›”). Klucz słownika `bell_to_<miejsce>`. */
export type BellPlace = 'decision' | 'invoice' | 'docs' | 'chat' | 'awiz' | 'numbers' | 'prices' | 'system' | 'options'
  | 'transport' | 'risks' | 'finance' | 'schedule' | 'zones' | 'entry';

export function bellPlace(n: Pick<BellSource, 'loadId' | 'href'>): BellPlace {
  const path = n.href?.path ?? '';
  if (path) {
    if (path.startsWith('/decyzje')) return 'decision';
    if (path.startsWith('/finanse/faktury')) return 'invoice';
    if (path.startsWith('/opcje/stan-systemu')) return 'system';
    if (path.startsWith('/opcje')) return 'options';
    if (path.startsWith('/ryzyka')) return 'risks';
    if (path.startsWith('/szczegoly-wpisu')) return 'entry';
    const tab = /[?&]zakladka=([^&]+)/.exec(path)?.[1] ?? '';
    if (tab === 'dokumenty') return 'docs';
    if (tab === 'ustalenia' || tab === 'czat') return 'chat';
    if (tab.startsWith('awizacja')) return 'awiz';
    if (tab.startsWith('numer')) return 'numbers';
    if (tab === 'ceny') return 'prices';
    return 'transport';
  }
  const load = n.loadId ?? n.href?.loadId;
  switch (n.href?.view) {
    case 'risk': return load ? 'transport' : 'risks';
    case 'docs': return 'docs';
    case 'decisions': return 'decision';
    case 'inv': case 'invoices': return 'invoice';
    case 'fin': return 'finance';
    case 'geo': return 'zones';
    case 'sched': return load ? 'transport' : 'schedule';
    default: return load ? 'transport' : 'entry';
  }
}

export interface BellGroup<T extends BellSource> {
  key: string;
  ids: string[];
  latest: T;
  count: number;
  title: string;
  body: string;
  severity: string;
  /** E5: grupa w dzwonku i miejsce docelowe. */
  section: Exclude<BellSection, 'general'>;
  place: BellPlace;
  /** „co się stało” bez nazwy transportu i nazwa transportu według firmy (E41) — osobno do układu E5. */
  what: string;
  name?: string;
  /** wyglad/P6-e: wiadomość w Czacie — nazwa transportu według firmy (E41), autor, treść, „tylko HHL i SCX” */
  chat?: { code: string; who: string; text: string; only: boolean; more: string | null };
}

const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Kod szablonu (RISK_OPEN, ZONE_ENTER…) nigdy nie trafia na ekran. */
export function looksLikeTemplateCode(s: string): boolean {
  return /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(s);
}

/* 8A (17.10), audyt N20: dzwonek tylko po polsku — parametr `locale` zostaje dla zgodności wywołań. */
const GENERIC = 'Powiadomienie';

function safe(text: string, _locale: BellLocale): string {
  // techniczny przedrostek „2fc65160: ” (początek id transportu) z tytułów ryzyk/decyzji
  const t = (text ?? '').replace(/(^|[\s:])[0-9a-f]{8}:\s+/gi, '$1').trim();
  if (!t || looksLikeTemplateCode(t)) return GENERIC;
  return t;
}

/**
 * E41 (P2): „nazwa — co się stało”. Nazwa może już zawierać „ · ” i numer firmy.
 * Pauza „—” nie myli się z separatorem nazwy.
 */
export function bellTitle(title: string, name: string | undefined, locale: BellLocale): string {
  const what = safe(title, locale);
  if (!name) return what;
  const bare = name.split(' \u00B7 ')[0] ?? name;
  const escName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escBare = bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rest = what
    .replace(new RegExp(`^${escName}\\s*[:·—–-]\\s*`), '')
    .replace(new RegExp(`^${escBare}\\s*[:·—–-]\\s*`), '')
    .trim();
  return `${name} — ${rest || what}`;
}

/** „Co się stało” bez nazwy transportu na początku (E5: nazwa jest w drugiej linii). */
export function bellWhat(title: string, name: string | undefined, locale: BellLocale): string {
  const full = bellTitle(title, name, locale);
  return name && full.startsWith(`${name} — `) ? full.slice(name.length + 3) : full;
}

/**
 * Sytuacja ogólna pominięta w dzwonku (E5): liczba nieprzeczytanych wpisów z ostatniej doby — do zdania pod listą
 * „… jest na stronie Ryzyka”.
 */
export function bellGeneralCount<T extends BellSource>(items: readonly T[], role: string, nowMs: number): number {
  return bellVisible(items, role).filter((n) => bellSection(n) === 'general' && nowMs - Date.parse(n.at) <= 86_400_000).length;
}

/** „teraz”, „15 min temu”, „3 godz. temu”, „wczoraj”, „5 dni temu” — tylko po polsku (8A). */
export function bellAge(iso: string, nowMs: number, _locale: BellLocale): string {
  const min = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60000));
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (min < 1) return 'teraz';
  if (min < 60) return `${min} min temu`;
  if (h < 24) return `${h} godz. temu`;
  if (d < 2) return 'wczoraj';
  return `${d} dni temu`;
}

function moreText(n: number, _locale: BellLocale): string {
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  return `${n} ${last >= 2 && last <= 4 && !teen ? 'zdarzenia' : 'zdarzeń'} tego rodzaju`;
}

/**
 * Nieprzeczytane (i w zasięgu roli) pozycje w grupach: ten sam transport + ten sam rodzaj zdarzenia = jedna pozycja
 * (najnowsza treść, licznik, najwyższa waga). Bez transportu — każda osobno. Kolejność: najnowsze najpierw.
 */
export function bellGroups<T extends BellSource>(
  items: readonly T[],
  role: string,
  codeOf: (loadId: string) => string | undefined,
  locale: BellLocale,
): BellGroup<T>[] {
  const sorted = bellVisible(items, role).slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const map = new Map<string, BellGroup<T>>();
  for (const n of sorted) {
    /* E21 (P2): „Nieznany kod źródła drogowego” zostaje w bazie do P10a, bez dzwonka. */
    if (isTechnicalRoadNotice(n.title) || isTechnicalRoadNotice(n.body)) continue;
    /* E5 (13:21): sytuacja ogólna bez transportu — tylko strona Ryzyka. */
    const raw = bellSection(n);
    if (raw === 'general') continue;
    const section = sectionFor(raw, role);
    const key = n.loadId && n.kind ? `${n.loadId}|${n.kind}` : n.id;
    const g = map.get(key);
    if (g) {
      g.ids.push(n.id);
      g.count += 1;
      if ((SEV_RANK[n.severity] ?? 0) > (SEV_RANK[g.severity] ?? 0)) g.severity = n.severity;
      continue;
    }
    const lid = n.loadId ?? n.href?.loadId;
    const code = (lid ? codeOf(lid) : undefined) ?? n.code;
    map.set(key, {
      key, ids: [n.id], latest: n, count: 1, title: bellTitle(n.title, code, locale), body: safe(n.body, locale), severity: n.severity,
      section, place: bellPlace(n), what: bellWhat(n.title, code, locale), name: code,
    });
  }
  const out = [...map.values()];
  for (const g of out) {
    if (isChatKind(g.latest.kind)) {
      /* nazwa transportu według firmy (E41: KSH — sam kod, HHL i SCX — z numerem zlecenia) i pauza, jak w całym dzwonku */
      const code = g.name ?? '';
      const raw = (g.latest.body ?? '').replace(/\s+/g, ' ').trim();
      g.chat = {
        code,
        who: g.what,
        text: raw.length > CHAT_MAX ? `${raw.slice(0, CHAT_MAX - 1).trimEnd()}…` : raw,
        only: !!g.latest.chatOnly,
        more: g.count > 1 && locale === 'pl' ? `${g.count}\u00a0${plPlural(g.count, 'nowa wiadomość', 'nowe wiadomości', 'nowych wiadomości')}` : null,
      };
      g.title = code ? `${code} — ${g.what}` : g.what;
      continue;
    }
    if (g.count > 1) g.body = g.body && g.body !== GENERIC ? `${moreText(g.count, locale)} · ${g.body}` : moreText(g.count, locale);
    if (g.body === GENERIC) g.body = '';
  }
  return out;
}

/** AUD-02: cel L-4 `/transport/<kod>` — kod transportu z `load_id`, gdy ładunek go nie miał („brak”) albo miał numer zlecenia. */
export function withLoadCode(path: string, code: string | undefined): string {
  if (!code || !path.startsWith('/transport/')) return path;
  const q = path.indexOf('?');
  return `/transport/${encodeURIComponent(code)}${q >= 0 ? path.slice(q) : ''}`;
}
