/**
 * L-5 — dzwonek bez napisu „przeczytane”.
 * Po kliknięciu pozycja jest przeczytana i znika z listy. Licznik to długość listy.
 */
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
}

export interface BellGroup<T extends BellSource> {
  key: string;
  ids: string[];
  latest: T;
  count: number;
  title: string;
  body: string;
  severity: string;
}

const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Kod szablonu (RISK_OPEN, ZONE_ENTER…) nigdy nie trafia na ekran. */
export function looksLikeTemplateCode(s: string): boolean {
  return /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(s);
}

const GENERIC: Record<BellLocale, string> = { pl: 'Powiadomienie', en: 'Notification', sv: 'Avisering' };

function safe(text: string, locale: BellLocale): string {
  // techniczny przedrostek „2fc65160: ” (początek id transportu) z tytułów ryzyk/decyzji
  const t = (text ?? '').replace(/(^|[\s:])[0-9a-f]{8}:\s+/gi, '$1').trim();
  if (!t || looksLikeTemplateCode(t)) return GENERIC[locale];
  return t;
}

/** „SG-11 · zdarzenie…”; kod z magazynu transportów, potem z ładunku; bez podwójnego kodu na początku. */
export function bellTitle(title: string, code: string | undefined, locale: BellLocale): string {
  const what = safe(title, locale);
  if (!code) return what;
  const esc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rest = what.replace(new RegExp(`^${esc}\\s*[:·\\-–]\\s*`), '').trim();
  return `${code} · ${rest || what}`;
}

/** „teraz”, „15 min temu”, „3 godz. temu”, „wczoraj”, „5 dni temu” (en/sv odpowiednio). */
export function bellAge(iso: string, nowMs: number, locale: BellLocale): string {
  const min = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60000));
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (locale === 'en') {
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    if (h < 24) return `${h} h ago`;
    if (d < 2) return 'yesterday';
    return `${d} days ago`;
  }
  if (locale === 'sv') {
    if (min < 1) return 'nyss';
    if (min < 60) return `${min} min sedan`;
    if (h < 24) return `${h} tim sedan`;
    if (d < 2) return 'i går';
    return `${d} dagar sedan`;
  }
  if (min < 1) return 'teraz';
  if (min < 60) return `${min} min temu`;
  if (h < 24) return `${h} godz. temu`;
  if (d < 2) return 'wczoraj';
  return `${d} dni temu`;
}

function moreText(n: number, locale: BellLocale): string {
  if (locale === 'en') return `${n} events of this type`;
  if (locale === 'sv') return `${n} händelser av denna typ`;
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
    const key = n.loadId && n.kind ? `${n.loadId}|${n.kind}` : n.id;
    const g = map.get(key);
    if (g) {
      g.ids.push(n.id);
      g.count += 1;
      if ((SEV_RANK[n.severity] ?? 0) > (SEV_RANK[g.severity] ?? 0)) g.severity = n.severity;
      continue;
    }
    const code = (n.loadId ? codeOf(n.loadId) : undefined) ?? n.code;
    map.set(key, { key, ids: [n.id], latest: n, count: 1, title: bellTitle(n.title, code, locale), body: safe(n.body, locale), severity: n.severity });
  }
  const out = [...map.values()];
  for (const g of out) {
    if (g.count > 1) g.body = g.body && g.body !== GENERIC[locale] ? `${moreText(g.count, locale)} · ${g.body}` : moreText(g.count, locale);
    if (g.body === GENERIC[locale]) g.body = '';
  }
  return out;
}

/** AUD-02: cel L-4 `/transport/<kod>` — kod transportu z `load_id`, gdy ładunek go nie miał („brak”) albo miał numer zlecenia. */
export function withLoadCode(path: string, code: string | undefined): string {
  if (!code || !path.startsWith('/transport/')) return path;
  const q = path.indexOf('?');
  return `/transport/${encodeURIComponent(code)}${q >= 0 ? path.slice(q) : ''}`;
}
