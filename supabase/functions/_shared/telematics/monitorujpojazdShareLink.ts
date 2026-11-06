/**
 * #837 — odczyt pozycji z publicznego linku udostępnienia monitorujpojazd (sledz).
 * Token = UUID w ścieżce /share/<uuid>/ — nigdy w logach w całości (tylko 6 ostatnich hex).
 *
 * API (odkryte z ShareController, bez prawdziwego tokenu):
 *   GET https://sledz.monitorujpojazd.pl/websatadmin/share/data/<uuid>/
 *   state: OK | EXPIRED | NOT_STARTED
 *   OK → data[]: { id, name, lat, lon, speed, speed_unit, ignition, ts, addr, … }
 * Brak endpointu historii trasy (strona odświeża tylko bieżącą pozycję co 30 s).
 */
export const MONITORUJPOJAZD_HOST = 'https://sledz.monitorujpojazd.pl';
export const MONITORUJPOJAZD_UA =
  'WatchTower-HHL/1.0 (+https://tower.log-mar.pl; lokalizacja transportu)';
export const MONITORUJPOJAZD_TIMEOUT_MS = 20_000;

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Pełny wzór URL (http lub https; odpytywanie wyłącznie https). */
export const MONITORUJPOJAZD_LINK_RE = new RegExp(
  `^https?://sledz\\.monitorujpojazd\\.pl/share/(${UUID})/?$`,
  'i',
);

/** Zapisany znacznik bez tokenu: mp:<6 ostatnich hex bez myślników>. */
export const MONITORUJPOJAZD_MARKER_RE = /^mp:([0-9a-f]{6})$/i;

export type MonitorujPojazdPositionOk = {
  ok: true;
  lat: number;
  lon: number;
  observedAt: string;
  speedKmh: number | null;
  heading: number | null;
  ignition: boolean | null;
  vehicleName: string | null;
};

export type MonitorujPojazdPositionErr = {
  ok: false;
  /** invalid = EXPIRED / 404 / zły host; down = sieć/5xx; no_position = OK bez lat/lon. */
  kind: 'invalid' | 'down' | 'no_position';
  status: number | null;
  warning: string;
};

export type MonitorujPojazdPositionResult = MonitorujPojazdPositionOk | MonitorujPojazdPositionErr;

export function monitorujpojazdTokenFromLink(ref: string | null | undefined): string | null {
  const m = MONITORUJPOJAZD_LINK_RE.exec(String(ref ?? '').trim());
  return m ? m[1].toLowerCase() : null;
}

export function isMonitorujPojazdLink(ref: string | null | undefined): boolean {
  return monitorujpojazdTokenFromLink(ref) != null;
}

export function looksLikeBrokenMonitorujPojazd(ref: string | null | undefined): boolean {
  const r = String(ref ?? '').trim().toLowerCase();
  if (!r) return false;
  if (MONITORUJPOJAZD_LINK_RE.test(r) || MONITORUJPOJAZD_MARKER_RE.test(r)) return false;
  return r.includes('monitorujpojazd.pl');
}

export function monitorujpojazdMarker(token: string): string {
  const hex = token.toLowerCase().replace(/-/g, '');
  return `mp:${hex.slice(-6)}`;
}

/** Adres odczytu bez tokenu — do integration_runs / ryzyk. */
export function monitorujpojazdUrlSafe(token: string): string {
  const tip = token.toLowerCase().replace(/-/g, '').slice(-6);
  return `${MONITORUJPOJAZD_HOST}/websatadmin/share/data/…${tip}/`;
}

export function monitorujpojazdDataUrl(token: string): string {
  return `${MONITORUJPOJAZD_HOST}/websatadmin/share/data/${token.toLowerCase()}/`;
}

/** Wytnij UUID / ścieżkę share z komunikatu. */
export function scrubMonitorujPojazdToken(msg: string): string {
  return msg
    .replace(
      /share\/data\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      'share/data/…',
    )
    .replace(
      /share\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      'share/…',
    )
    .replace(/([0-9a-f]{26})([0-9a-f]{6})/gi, '…$2');
}

/**
 * `car.ts` / `data.ts` ze strony share — ISO albo „YYYY-MM-DD HH:MM[:SS]” traktowane jako UTC.
 */
export function parseMonitorujPojazdTimestamp(raw: unknown, nowMs: number = Date.now()): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = Date.parse(s);
    if (!Number.isFinite(ms) || ms > nowMs + 5 * 60_000) return null;
    return new Date(ms).toISOString();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) {
    const ms = Date.UTC(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4]), Number(m[5]), Number(m[6] ?? 0),
    );
    if (!Number.isFinite(ms) || ms > nowMs + 5 * 60_000) return null;
    return new Date(ms).toISOString();
  }
  return null;
}

function speedToKmh(speed: unknown, unit: unknown): number | null {
  if (speed == null || speed === '') return null;
  const n = Number(speed);
  if (!Number.isFinite(n)) return null;
  const u = String(unit ?? 'km/h').toLowerCase();
  if (u.includes('mph') || u === 'mi/h') return n * 1.60934;
  return n;
}

/**
 * Odpowiedź /websatadmin/share/data/<uuid>/:
 * { state, data?: car[], ts?: string, reason?, exception? }
 */
export function parseMonitorujPojazdPayload(
  raw: unknown,
  nowMs: number = Date.now(),
): MonitorujPojazdPositionResult {
  if (raw == null || typeof raw !== 'object') {
    return { ok: false, kind: 'down', status: null, warning: 'monitorujpojazd: brak JSON' };
  }
  const o = raw as Record<string, unknown>;
  const state = String(o.state ?? '').toUpperCase();
  if (state === 'EXPIRED' || state === 'NOT_STARTED') {
    return {
      ok: false,
      kind: 'invalid',
      status: null,
      warning: `monitorujpojazd: ${state}`,
    };
  }
  if (state && state !== 'OK') {
    return {
      ok: false,
      kind: 'down',
      status: null,
      warning: `monitorujpojazd: state=${state || '?'}`,
    };
  }
  const list = Array.isArray(o.data) ? o.data : [];
  if (list.length === 0) {
    return { ok: false, kind: 'no_position', status: null, warning: 'monitorujpojazd: brak pojazdu' };
  }
  const car = list[0];
  if (car == null || typeof car !== 'object') {
    return { ok: false, kind: 'down', status: null, warning: 'monitorujpojazd: zły wiersz' };
  }
  const row = car as Record<string, unknown>;
  const lat = Number(row.lat);
  const lon = Number(row.lon ?? row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, kind: 'no_position', status: null, warning: 'monitorujpojazd: brak lat/lon' };
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, kind: 'no_position', status: null, warning: 'monitorujpojazd: lat/lon poza zakresem' };
  }
  const observedAt = parseMonitorujPojazdTimestamp(row.ts ?? o.ts, nowMs);
  if (!observedAt) {
    return { ok: false, kind: 'no_position', status: null, warning: 'monitorujpojazd: brak ts' };
  }
  const ign = row.ignition;
  const ignition = typeof ign === 'boolean' ? ign : null;
  const name = typeof row.name === 'string' ? row.name : null;
  return {
    ok: true,
    lat,
    lon,
    observedAt,
    speedKmh: speedToKmh(row.speed, row.speed_unit),
    heading: null,
    ignition,
    vehicleName: name,
  };
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

/**
 * GET data/<uuid>/. Timeout 20 s. Tylko host sledz.monitorujpojazd.pl; redirect: manual.
 * EXPIRED/NOT_STARTED / 403/404 → invalid; 5xx/sieć → down.
 */
export async function fetchMonitorujPojazdPosition(opts: {
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}): Promise<MonitorujPojazdPositionResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? MONITORUJPOJAZD_TIMEOUT_MS;
  const url = monitorujpojazdDataUrl(opts.token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': MONITORUJPOJAZD_UA,
        Accept: 'application/json, text/plain, */*',
      },
      signal: ctrl.signal,
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) {
      return {
        ok: false, kind: 'invalid', status: res.status,
        warning: `monitorujpojazd HTTP ${res.status} (przekierowanie)`,
      };
    }
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) {
      return {
        ok: false, kind: 'invalid', status: res.status,
        warning: `monitorujpojazd HTTP ${res.status}`,
      };
    }
    if (!res.ok) {
      return {
        ok: false, kind: 'down', status: res.status,
        warning: `monitorujpojazd HTTP ${res.status}`,
      };
    }
    const body = await readBody(res);
    const parsed = parseMonitorujPojazdPayload(body, opts.nowMs ?? Date.now());
    if (!parsed.ok) return { ...parsed, status: res.status };
    return parsed;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = scrubMonitorujPojazdToken(raw);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      kind: 'down',
      status: null,
      warning: aborted
        ? 'monitorujpojazd: timeout 20 s'
        : `monitorujpojazd: sieć ${e instanceof Error ? e.name : 'Error'}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
