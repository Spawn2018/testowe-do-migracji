/**
 * AUD-01c — zasady publicznych kafelków HERE (bez sesji). Czyste funkcje: używa ich `here-raster` (Deno) i testy.
 */
/** AUD-01d: pamięć tylko w przeglądarce, ≤ 24 h (HERE Platform Terms §1.3, §6.4 l) — bez wspólnej pamięci brzegu. */
export const MAX_BROWSER_S = 86400;
/**
 * AUD-04 (PL-DATA, A4): język napisów kafelków HERE Raster Tile API v3 — parametr `lang` (BCP47: ISO 639-1,
 * opcjonalnie skrypt ISO 15924). Polski; inne wartości spoza listy → polski (bez dowolnych parametrów do HERE).
 */
export const TILE_LANG = 'pl';
const TILE_LANGS = new Set(['pl']);
export function tileLang(v: string | null | undefined): string {
  return v && TILE_LANGS.has(v) ? v : TILE_LANG;
}
export const STYLE: Record<string, 'logistics.day' | 'logistics.night'> = {
  light: 'logistics.day',
  dark: 'logistics.night',
  'logistics.day': 'logistics.day',
  'logistics.night': 'logistics.night',
};
const ALLOWED_HOSTS = new Set(['tower.log-mar.pl', 'watch-tower-makieta.vercel.app', 'localhost', '127.0.0.1']);

export function gridOk(z: number, x: number, y: number): boolean {
  if (!Number.isInteger(z) || z < 0 || z > 19 || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  const max = 2 ** z;
  return x >= 0 && y >= 0 && x < max && y < max;
}

/** Brak Referer/Origin (curl, prywatność) — dopuszczony; obcy host — odmowa. */
export function refererOk(value: string | null): boolean {
  if (!value) return true;
  try {
    const host = new URL(value).hostname;
    return ALLOWED_HOSTS.has(host) || /^watch-tower-makieta-[a-z0-9-]+\.vercel\.app$/.test(host);
  } catch {
    return false;
  }
}

/** max-age z odpowiedzi HERE (warunki HERE: pamięć tylko na tyle, na ile pozwalają nagłówki), ≤ 24 h. */
export function browserSeconds(hereCacheControl: string | null): number {
  const m = /max-age=(\d+)/i.exec(hereCacheControl ?? '');
  const s = m ? Number(m[1]) : 3600;
  return Math.max(0, Math.min(MAX_BROWSER_S, s));
}

/** AUD-01d: `private` — CDN/Vercel nie przechowuje kafelka dla wielu użytkowników; bez s-maxage. */
export function tileCacheControl(hereCacheControl: string | null): string {
  return `private, max-age=${browserSeconds(hereCacheControl)}`;
}

/** Okno 60 s: najwyżej `perIp` pobrań z HERE na IP i `total` na proces (zwykła mapa: 20–60 kafelków na widok). */
export function rateLimiter(limits = { perIp: 600, total: 3000, windowMs: 60_000 }) {
  let win = { at: 0, total: 0, ip: new Map<string, number>() };
  return (ip: string, now = Date.now()): boolean => {
    if (now - win.at >= limits.windowMs) win = { at: now, total: 0, ip: new Map() };
    const n = (win.ip.get(ip) ?? 0) + 1;
    if (n > limits.perIp || win.total + 1 > limits.total) return false;
    win.ip.set(ip, n);
    win.total += 1;
    return true;
  };
}
