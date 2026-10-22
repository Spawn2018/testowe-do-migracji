/**
 * E44 — odczyt ostatniej pozycji z publicznego API RIO Position Sharing.
 * Secret nigdy w logach / URL zapisanym w integration_runs (pkt 8).
 * Zgoda RIO na piśmie — właściciel, 22.10.2026 09:02 (dokument u właściciela).
 */
import { normalizePlate } from './emtrackWeb.ts';

export const RIO_API_HOST = 'https://api.position-sharing.rio.cloud';
export const RIO_UA = 'WatchTower-HHL';
export const RIO_TIMEOUT_MS = 10_000;
/** Skok GPS powyżej tej prędkości — nie licz prędkości (F7 #438). */
export const RIO_SPEED_CAP_KMH = 130;
/** Przy odstępie > 1 h nie licz prędkości. */
export const RIO_SPEED_MAX_GAP_SEC = 3600;

export type RioTrackerOn = 'NACZEPA' | 'CIAGNIK_PL' | 'CIAGNIK_SE' | 'NIEZNANY';

export type RioPositionOk = {
  ok: true;
  id: string;
  name: string | null;
  assetName: string | null;
  validFrom: string | null;
  validTo: string | null;
  lat: number;
  lon: number;
  observedAt: string;
};

export type RioPositionErr = {
  ok: false;
  /** invalid = 4xx link; down = sieć/5xx; no_position = 200 bez użytecznej pozycji (sprawa transportu). */
  kind: 'invalid' | 'down' | 'no_position';
  status: number | null;
  warning: string;
};

export type RioPositionResult = RioPositionOk | RioPositionErr;

/** Adres zapytania bez secret — do logów / integration_runs. */
export function rioPositionUrlSafe(trackingId: string): string {
  return `${RIO_API_HOST}/trackings/${encodeURIComponent(trackingId)}/position`;
}

export function rioPositionUrl(trackingId: string, secret: string): string {
  return `${rioPositionUrlSafe(trackingId)}?secret=${encodeURIComponent(secret)}`;
}

/** Wytnij secret=… z komunikatu błędu (Deno fetch bywa zawiera pełny URL). */
export function scrubRioSecret(msg: string): string {
  return msg.replace(/([?&]secret=)[^&\s)'"`]+/gi, '$1***');
}

/** E44 pkt 6: asset_name vs rejestracje z awizacji. */
export function inferRioTrackerOn(
  assetName: string | null | undefined,
  plates: { trailer?: string | null; tractorPl?: string | null; tractorSe?: string | null },
): RioTrackerOn {
  const asset = normalizePlate(assetName);
  if (!asset) return 'NIEZNANY';
  if (normalizePlate(plates.trailer) === asset) return 'NACZEPA';
  if (normalizePlate(plates.tractorPl) === asset) return 'CIAGNIK_PL';
  if (normalizePlate(plates.tractorSe) === asset) return 'CIAGNIK_SE';
  return 'NIEZNANY';
}

/** Prędkość z dystansu i czasu względem poprzedniej pozycji (> 5 km/h = ruch). */
export function speedKmhFromPrev(
  prev: { lat: number; lon: number; ts: string } | null,
  curr: { lat: number; lon: number; ts: string },
): number | null {
  if (!prev) return null;
  const dtSec = (Date.parse(curr.ts) - Date.parse(prev.ts)) / 1000;
  if (!(dtSec > 0) || !Number.isFinite(dtSec)) return null;
  if (dtSec > RIO_SPEED_MAX_GAP_SEC) return null;
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (curr.lat - prev.lat) * rad;
  const dLon = (curr.lon - prev.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(prev.lat * rad) * Math.cos(curr.lat * rad) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  if (!Number.isFinite(km)) return null;
  const sp = (km / dtSec) * 3600;
  if (!Number.isFinite(sp) || sp > RIO_SPEED_CAP_KMH) return null;
  return sp;
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function isBlankCoord(v: unknown): boolean {
  return v == null || v === '';
}

/**
 * Parsuje JSON odpowiedzi RIO; bez secret w wyniku.
 * Poprawny JSON bez użytecznej pozycji → no_position (#453).
 * null / nie-obiekt → down (F7 #456 P1 — to nie jest „link bez pozycji”).
 */
export function parseRioPositionPayload(
  raw: unknown,
  nowMs: number = Date.now(),
): RioPositionResult {
  if (raw == null || typeof raw !== 'object') {
    return { ok: false, kind: 'down', status: null, warning: 'RIO: brak JSON' };
  }
  const o = raw as Record<string, unknown>;
  const pos = o.position;
  if (pos == null || typeof pos !== 'object') {
    return { ok: false, kind: 'no_position', status: null, warning: 'RIO: brak position' };
  }
  const p = pos as Record<string, unknown>;
  if (isBlankCoord(p.latitude) || isBlankCoord(p.longitude)) {
    return { ok: false, kind: 'no_position', status: null, warning: 'RIO: brak latitude/longitude' };
  }
  const lat = Number(p.latitude);
  const lon = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, kind: 'no_position', status: null, warning: 'RIO: brak latitude/longitude' };
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, kind: 'no_position', status: null, warning: 'RIO: lat/lon poza zakresem' };
  }
  const observedAt = isoOrNull(p.timestamp);
  if (!observedAt) {
    return { ok: false, kind: 'no_position', status: null, warning: 'RIO: brak position.timestamp' };
  }
  if (Date.parse(observedAt) > nowMs + 5 * 60_000) {
    return { ok: false, kind: 'no_position', status: null, warning: 'RIO: timestamp z przyszłości' };
  }
  return {
    ok: true,
    id: typeof o.id === 'string' ? o.id : '',
    name: typeof o.name === 'string' ? o.name : null,
    assetName: typeof o.asset_name === 'string' ? o.asset_name : null,
    validFrom: isoOrNull(o.start),
    validTo: isoOrNull(o.end),
    lat,
    lon,
    observedAt,
  };
}

/**
 * GET pozycji. Timeout 10 s.
 * 401/403/404/400/410 → invalid; 5xx / sieć → down; 200 bez pozycji → no_position (#453).
 */
export async function fetchRioPosition(opts: {
  trackingId: string;
  secret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}): Promise<RioPositionResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? RIO_TIMEOUT_MS;
  const url = rioPositionUrl(opts.trackingId, opts.secret);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { 'User-Agent': RIO_UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (
      res.status === 401 || res.status === 403 || res.status === 404
      || res.status === 400 || res.status === 410
    ) {
      return {
        ok: false,
        kind: 'invalid',
        status: res.status,
        warning: `RIO HTTP ${res.status}`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        kind: 'down',
        status: res.status,
        warning: `RIO HTTP ${res.status}`,
      };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      // F7 #456 P1: HTML/konserwacja z kodem 200 = awaria źródła, nie sprawa transportu.
      return { ok: false, kind: 'down', status: res.status, warning: 'RIO: odpowiedź nie-JSON' };
    }
    const parsed = parseRioPositionPayload(json, opts.nowMs ?? Date.now());
    if (!parsed.ok) {
      return { ...parsed, status: res.status };
    }
    return parsed;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = scrubRioSecret(raw);
    const aborted = /abort/i.test(msg);
    const name = e instanceof Error && e.name ? e.name : 'Error';
    return {
      ok: false,
      kind: 'down',
      status: null,
      warning: aborted ? 'RIO: timeout 10 s' : `RIO: sieć ${name}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Czy teraz mieści się w ważności linku (start–end). Brak granic → true (jeszcze nie sprawdzono). */
export function rioLinkValidNow(
  nowIso: string,
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
): boolean {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return false;
  if (validFrom) {
    const a = Date.parse(validFrom);
    if (Number.isFinite(a) && now < a) return false;
  }
  if (validTo) {
    const b = Date.parse(validTo);
    if (Number.isFinite(b) && now > b) return false;
  }
  return true;
}
