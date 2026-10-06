/**
 * AUD-01c — zasady publicznych kafelków HERE (bez sesji). Czyste funkcje: używa ich `here-raster` (Deno) i testy.
 */
export const MAX_EDGE_S = 604800;
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

/** s-maxage = max-age z odpowiedzi HERE (warunki HERE: pamięć tylko na tyle, na ile pozwalają nagłówki), ≤ 7 dni. */
export function edgeSeconds(hereCacheControl: string | null): number {
  const m = /max-age=(\d+)/i.exec(hereCacheControl ?? '');
  const s = m ? Number(m[1]) : 3600;
  return Math.max(0, Math.min(MAX_EDGE_S, s));
}

export function tileCacheControl(hereCacheControl: string | null): string {
  const s = edgeSeconds(hereCacheControl);
  return `public, max-age=${Math.min(s, 86400)}, s-maxage=${s}`;
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
