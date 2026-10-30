/**
 * #662 — odczyt pozycji z publicznego linku tymczasowego SafeFleet.
 * Token (32 hex) = klucz dostępu: nigdy w logach w całości (tylko 6 ostatnich znaków).
 */
export const SAFEFLEET_HOST = 'https://portal.safefleet.pl';
export const SAFEFLEET_UA = 'WatchTower-HHL/1.0 (+https://tower.log-mar.pl; lokalizacja transportu)';
export const SAFEFLEET_TIMEOUT_MS = 20_000;

/** Pełny wzór URL (z ukośnikiem końcowym opcjonalnym). */
export const SAFEFLEET_LINK_RE =
  /^https:\/\/portal\.safefleet\.pl\/safefleet\/temporary_link\/view\/([0-9a-f]{32})\/?$/i;

/** Zapisany znacznik bez tokenu: safefleet:&lt;6 ostatnich znaków&gt;. */
export const SAFEFLEET_MARKER_RE = /^safefleet:([0-9a-f]{6})$/i;

export type SafefleetPositionOk = {
  ok: true;
  lat: number;
  lon: number;
  observedAt: string;
  speedKmh: number | null;
  heading: number | null;
  ignition: boolean | null;
  licensePlate: string | null;
};

export type SafefleetPositionErr = {
  ok: false;
  /** invalid = 403/404/login/error; down = sieć/5xx; no_position = 200 bez użytecznej pozycji. */
  kind: 'invalid' | 'down' | 'no_position';
  status: number | null;
  warning: string;
};

export type SafefleetPositionResult = SafefleetPositionOk | SafefleetPositionErr;

export type SafefleetPresence = { lat: number; lon: number; ts: string };

export function safefleetTokenFromLink(ref: string | null | undefined): string | null {
  const m = SAFEFLEET_LINK_RE.exec(String(ref ?? '').trim());
  return m ? m[1].toLowerCase() : null;
}

export function isSafefleetLink(ref: string | null | undefined): boolean {
  return safefleetTokenFromLink(ref) != null;
}

/** Wygląda na SafeFleet, ale wzór nie pasuje (literówka / stary format). */
export function looksLikeBrokenSafefleet(ref: string | null | undefined): boolean {
  const r = String(ref ?? '').trim().toLowerCase();
  if (!r) return false;
  if (SAFEFLEET_LINK_RE.test(r) || SAFEFLEET_MARKER_RE.test(r)) return false;
  return r.includes('safefleet.pl') || r.includes('temporary_link');
}

export function safefleetMarker(token: string): string {
  const t = token.toLowerCase();
  return `safefleet:${t.slice(-6)}`;
}

/** Adres odświeżenia bez tokenu — do integration_runs / ryzyk. */
export function safefleetUrlSafe(token: string): string {
  const tip = token.slice(-6).toLowerCase();
  return `${SAFEFLEET_HOST}/safefleet/temporary_link/view/…${tip}/?refresh=true`;
}

export function safefleetRefreshUrl(token: string): string {
  return `${SAFEFLEET_HOST}/safefleet/temporary_link/view/${token.toLowerCase()}/?refresh=true`;
}

export function safefleetTrajectoryUrl(token: string): string {
  return `${SAFEFLEET_HOST}/safefleet/temporary_link/view/${token.toLowerCase()}/?trajectory=true`;
}

/** Wytnij pełny token / ścieżkę view/&lt;32hex&gt; z komunikatu. */
export function scrubSafefleetToken(msg: string): string {
  return msg
    .replace(/temporary_link\/view\/[0-9a-f]{32}/gi, 'temporary_link/view/…')
    .replace(/([0-9a-f]{26})([0-9a-f]{6})/gi, '…$2');
}

/**
 * SafeFleet: `"30 October 2026, 10:51 (UTC)"` → ISO UTC.
 * Akceptuje też ISO / Date.parse.
 */
export function parseSafefleetTimestamp(raw: unknown, nowMs: number = Date.now()): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  /* Najpierw format SafeFleet („30 October 2026, 10:51 (UTC)”) — Date.parse myli strefę. */
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s+(\d{1,2}):(\d{2})(?:\s*\((UTC|GMT)\))?$/i.exec(s);
  if (m) {
    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };
    const mon = months[m[2].toLowerCase()];
    if (mon == null) return null;
    const day = Number(m[1]);
    const year = Number(m[3]);
    const hour = Number(m[4]);
    const min = Number(m[5]);
    const ms = Date.UTC(year, mon, day, hour, min, 0);
    if (!Number.isFinite(ms) || ms > nowMs + 5 * 60_000) return null;
    return new Date(ms).toISOString();
  }
  /* ISO / inne — tylko gdy wygląda na ISO (żeby nie brać lokalnej strefy z angielskiej daty). */
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const isoTry = Date.parse(s);
  if (!Number.isFinite(isoTry) || isoTry > nowMs + 5 * 60_000) return null;
  return new Date(isoTry).toISOString();
}

function ignitionFromStatus(status: unknown): boolean | null {
  if (status === 1 || status === '1') return true;
  if (status === 0 || status === '0') return false;
  if (status === -1 || status === '-1') return false;
  return null;
}

/**
 * Odpowiedź `?refresh=true`: tablica pojazdów albo obiekt; przy błędzie tekst `error`.
 */
export function parseSafefleetRefreshPayload(
  raw: unknown,
  nowMs: number = Date.now(),
): SafefleetPositionResult {
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (!t || t === 'error' || t.includes('error')) {
      return { ok: false, kind: 'invalid', status: null, warning: 'SafeFleet: error' };
    }
    return { ok: false, kind: 'down', status: null, warning: 'SafeFleet: odpowiedź tekstowa' };
  }
  if (raw == null) {
    return { ok: false, kind: 'no_position', status: null, warning: 'SafeFleet: pusta odpowiedź' };
  }
  let row: Record<string, unknown> | null = null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return { ok: false, kind: 'no_position', status: null, warning: 'SafeFleet: pusta tablica' };
    }
    row = typeof raw[0] === 'object' && raw[0] != null ? raw[0] as Record<string, unknown> : null;
  } else if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.error === 'string' || o.error === true) {
      return { ok: false, kind: 'invalid', status: null, warning: 'SafeFleet: error' };
    }
    row = o;
  }
  if (!row) {
    return { ok: false, kind: 'down', status: null, warning: 'SafeFleet: brak JSON pojazdu' };
  }
  const lat = Number(row.lat);
  const lon = Number(row.lng ?? row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, kind: 'no_position', status: null, warning: 'SafeFleet: brak lat/lng' };
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, kind: 'no_position', status: null, warning: 'SafeFleet: lat/lng poza zakresem' };
  }
  const observedAt = parseSafefleetTimestamp(row.timestamp, nowMs);
  if (!observedAt) {
    return { ok: false, kind: 'no_position', status: null, warning: 'SafeFleet: brak timestamp' };
  }
  const speedRaw = row.speed;
  const speedKmh = speedRaw == null || speedRaw === ''
    ? null
    : Number.isFinite(Number(speedRaw)) ? Number(speedRaw) : null;
  const az = row.azimuth;
  const heading = az == null || az === ''
    ? null
    : Number.isFinite(Number(az)) ? Number(az) : null;
  const plate = typeof row.licensePlate === 'string' ? row.licensePlate : null;
  return {
    ok: true,
    lat,
    lon,
    observedAt,
    speedKmh,
    heading,
    ignition: ignitionFromStatus(row.status),
    licensePlate: plate,
  };
}

/** `?trajectory=true` → presences z timestampAgo (s wstecz od teraz). */
export function parseSafefleetTrajectoryPayload(
  raw: unknown,
  nowMs: number = Date.now(),
): SafefleetPresence[] {
  if (raw == null || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  const list = o.presences;
  if (!Array.isArray(list)) return [];
  const out: SafefleetPresence[] = [];
  for (const item of list) {
    if (item == null || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const lat = Number(p.lat);
    const lon = Number(p.lng ?? p.lon);
    const ago = Number(p.timestampAgo);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    if (!Number.isFinite(ago) || ago < 0) continue;
    const ts = new Date(nowMs - ago * 1000).toISOString();
    out.push({ lat, lon, ts });
  }
  return out;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^error$/i.test(trimmed)) return 'error';
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

/**
 * GET ?refresh=true. Timeout 20 s. Uczciwy User-Agent.
 * 403/404 / redirect logowania / `error` → invalid; 5xx/sieć → down.
 */
export async function fetchSafefleetPosition(opts: {
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}): Promise<SafefleetPositionResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? SAFEFLEET_TIMEOUT_MS;
  const url = safefleetRefreshUrl(opts.token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': SAFEFLEET_UA,
        Accept: 'application/json, text/plain, */*',
      },
      signal: ctrl.signal,
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) {
      return {
        ok: false, kind: 'invalid', status: res.status,
        warning: `SafeFleet HTTP ${res.status} (przekierowanie)`,
      };
    }
    if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 410) {
      return { ok: false, kind: 'invalid', status: res.status, warning: `SafeFleet HTTP ${res.status}` };
    }
    if (!res.ok) {
      return { ok: false, kind: 'down', status: res.status, warning: `SafeFleet HTTP ${res.status}` };
    }
    const body = await readBody(res);
    const parsed = parseSafefleetRefreshPayload(body, opts.nowMs ?? Date.now());
    if (!parsed.ok) return { ...parsed, status: res.status };
    return parsed;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const msg = scrubSafefleetToken(raw);
    const aborted = /abort/i.test(msg);
    return {
      ok: false,
      kind: 'down',
      status: null,
      warning: aborted ? 'SafeFleet: timeout 20 s' : `SafeFleet: sieć ${e instanceof Error ? e.name : 'Error'}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSafefleetTrajectory(opts: {
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}): Promise<SafefleetPresence[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? SAFEFLEET_TIMEOUT_MS;
  const url = safefleetTrajectoryUrl(opts.token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': SAFEFLEET_UA,
        Accept: 'application/json, text/plain, */*',
      },
      signal: ctrl.signal,
      redirect: 'manual',
    });
    if (!res.ok || (res.status >= 300 && res.status < 400)) return [];
    const body = await readBody(res);
    return parseSafefleetTrajectoryPayload(body, opts.nowMs ?? Date.now());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
