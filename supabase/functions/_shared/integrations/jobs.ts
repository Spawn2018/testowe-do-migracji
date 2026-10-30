/**
 * M12 — zadania integracji (jedno na funkcję Edge). Wejście: magazyn (`SyncStore`), pobieranie (`fetch`),
 * sekrety (`env`) i czas — dzięki temu każde zadanie ma test jednostkowy na zapisanych danych, bez sieci.
 * Funkcje Edge (`supabase/functions/<nazwa>/index.ts`) podają prawdziwy magazyn (service role) i fetch.
 */
import {
  POLFERRIES_SCHEDULE_URL, POLFERRIES_STATUS_URL, parsePolferriesSchedule, parsePolferriesStatus,
} from '../ferry/polferries.ts';
import {
  dateRangeYmd, parseStenaTimetable, stenaTimetableUrl, STENA_ROUTE_PAGE, type StenaSailing,
} from '../ferry/stena.ts';
import {
  STENA_FREIGHT_AJAX, STENA_FREIGHT_PAGE, STENA_FREIGHT_UA,
  freightSecurityToken, freightWindow, parseStenaFreightTimetable,
} from '../ferry/stenaFreight.ts';
import {
  DIGITRAFFIC_ATTRIBUTION, interpretFix, parseDigitrafficLocations, aisDepartureDelayMin,
  departurePortForRoute, arrivalPortForRoute, portCoords, distanceKm, type VesselFix,
} from '../ferry/digitraffic.ts';
import { collectAisstreamFixes, type AisstreamStats } from '../ferry/aisstream.ts';
import {
  STENA_FERRIES_URL, STENA_IMO, STENA_MMSI, isTrackedMmsi, parseStenaFerries, pickNewerFix,
} from '../ferry/stenaAis.ts';
import {
  TALLINK_BOOKING, TALLINK_UA, parseTallinkTimetable, tallinkTimetableUrl,
} from '../ferry/tallink.ts';
import {
  DIGITRAFFIC_PORT_CALLS_URL, digitrafficPortCallsUrl, parseDigitrafficPortCalls,
} from '../ferry/digitrafficPortCalls.ts';
import {
  PORT_TALLINN_ARRIVALS_URL, PORT_TALLINN_DEPARTURES_URL, PORT_TALLINN_UA,
  parsePortTallinnHtml,
} from '../ferry/portTallinn.ts';
import {
  PORTS_STOCKHOLM_PORTENTRY_URL, PORTS_STOCKHOLM_UA,
  parsePortsStockholmPortEntry,
} from '../ferry/portsStockholm.ts';
import {
  VIKING_CARGO_HEL_TLL_PAGE, VIKING_SCHEDULE_PAGE, VIKING_UA, parseVikingTimetableHtml,
} from '../ferry/vikingline.ts';
import {
  ECKERO_SCHEDULE_PAGE, ECKERO_UA, parseEckeroTimetableHtml,
} from '../ferry/eckero.ts';
import {
  DFDS_SCHEDULE_PAGE, DFDS_UA, DFDS_WEEKLY_PDF_URL, parseDfdsWeeklyHtml,
} from '../ferry/dfds.ts';
import {
  MARINE_POINTS, SMHI_OCOBS_URL, dmiWamUrl, evaluateMarineWindow, fmiHarmonieUrl, fmiWamUrl,
  marinePointsForRoute, marineWeatherRisk, parseDmiCoverageJson, parseFmiTimeValuePair, parseSmhiOcobs,
  samplesInWindow, type MarineSample, type MarinePointCode,
} from '../ferry/marineWeather.ts';
import {
  integrationMode, parseDatexSituations, parseTrafikverketRoadConditions,
  parseTrafikverketSituations, parseTrafikverketWeather, roadConditionRisk, roadRisk, seRoadSlowdownMult, trafikverketResultError,
  trafikverketRoadConditionQuery, trafikverketSituationQuery, trafikverketWeatherQuery, weatherRisk, TRAFIKVERKET_URL,
} from './road.ts';
import { buildTrafficIncidentsUrl, parseHereTrafficIncidents } from '../here/trafficIncidents.ts';
import { HERE_BILLING_DEFAULTS } from '../here/billing.ts';
import {
  EMTRACK_EXPECTED_VERSION, EMTRACK_UA, fetchTrackingObjectsReadOnly, pollIntervalSec,
} from '../telematics/emtrackWeb.ts';
import { ambiguousMatchCount, loadInTrackingWindow, matchFixToLoad } from '../telematics/matchTrailer.ts';
import {
  fetchRioPosition, inferRioTrackerOn, rioLinkValidNow, rioPositionUrlSafe,
  speedKmhFromPrev, type RioTrackerOn,
} from '../telematics/rioPositionSharing.ts';
import {
  fetchSafefleetPosition, fetchSafefleetTrajectory, safefleetUrlSafe, scrubSafefleetToken,
} from '../telematics/safefleetTemporaryLink.ts';
import {
  WIND_GUST_MS_THRESHOLD, gustExceedsThreshold, windRiskTitle,
  seWeekendBanHit, plSundayBanHit, banRiskTitle,
} from '../here/windAndBans.ts';
import { unknownCodeRiskInput } from '../../../../src/lib/pl/describe.ts';
import { deeplTranslate, textHash, translateFreeText, usageLevel, DEEPL_MONTHLY_LIMIT } from '../../../../src/lib/pl/deepl.ts';
import {
  emtrackLoginFail, emtrackLoginFresh, emtrackLoginOk, emtrackLoginSkipped, emtrackNextTryAt, emtrackSecretFp,
  unquoteSecret,
} from './emtrackLogin.ts';
import {
  isSourceFailure, planSailingSync, sourceDownRisk, unknownStatusRisk,
  type AutoSailingSource, type DbSailing, type IncomingSailing, type RiskInput, type SailingInsert, type SailingPatch, type VesselRow,
} from './sync.ts';

/** Wyłącznie ASCII (nagłówek HTTP) — test pilnuje. */
export const USER_AGENT = 'TOWER-WatchTower/1.0 (+https://log-mar.pl; H&H Logistics; read max every 15 min)';
export const DIGITRAFFIC_USER = 'TOWER-WatchTower/HHL';
/** AIS-SRC: jedno zapytanie Stena IRM, nagłówek z nazwą Watch Tower. */
export const STENA_IRM_UA = 'Watch Tower (https://tower.log-mar.pl; ferry positions)';

export interface VehiclePos { load_id: string; code: string; lat: number; lon: number; ts: string }

/** E44 — wiersz do odpytania RIO (secret tylko w Edge / service_role). */
export interface RioLoadRow {
  id: string;
  code: string | null;
  rio_tracking_id: string;
  rio_secret: string;
  rio_check_state: string | null;
  rio_check_at: string | null;
  rio_valid_from: string | null;
  rio_valid_to: string | null;
  rio_asset_name: string | null;
  rio_tracker_on: string | null;
  rio_last_fix_at: string | null;
  rio_error_streak: number;
  trailer_plate: string | null;
  tractor_plate: string | null;
  tractor_delivery_plate: string | null;
  status: string | null;
  plannedLoadDate: string | null;
  trackingOpenedAt: string | null;
  telematics_vehicle_id: string | null;
}

const RIO_BUDGET_MS = 40_000;
const RIO_NET_ABORT_AFTER = 3;
const RIO_RECHECK_MS = 30 * 60_000;

const RIO_DATE_KEYS = new Set<keyof RioLoadPatch>([
  'rio_check_at', 'rio_last_fix_at', 'rio_valid_from', 'rio_valid_to',
]);

/** Postgres / JSON czasem daje `+00` zamiast `+00:00` — Date.parse wtedy = NaN. */
function rioParseMs(s: string): number {
  const t = Date.parse(s);
  if (Number.isFinite(t)) return t;
  const fixed = s.replace(/([+-]\d{2})$/, '$1:00');
  const t2 = Date.parse(fixed);
  return Number.isFinite(t2) ? t2 : NaN;
}

function rioSameInstant(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (typeof a === 'string' && typeof b === 'string') {
    const ta = rioParseMs(a);
    const tb = rioParseMs(b);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta === tb;
  }
  return a === b;
}

/** F7 r3: rio_check_at nie liczy się jako zmiana; daty przez Date.parse (+00 vs Z). */
function rioPatchChanged(load: RioLoadRow, patch: RioLoadPatch): boolean {
  for (const [k, v] of Object.entries(patch) as [keyof RioLoadPatch, unknown][]) {
    if (k === 'rio_check_at') continue;
    const cur = (load as unknown as Record<string, unknown>)[k];
    if (RIO_DATE_KEYS.has(k)) {
      if (!rioSameInstant(cur, v)) return true;
      continue;
    }
    if (cur !== v) return true;
  }
  return false;
}

function rioCheckedRecently(load: RioLoadRow, nowMs: number): boolean {
  if (!load.rio_check_at) return false;
  const t = rioParseMs(load.rio_check_at);
  return Number.isFinite(t) && nowMs - t < RIO_RECHECK_MS;
}

export interface RioLoadPatch {
  rio_check_state?: 'ok' | 'pending' | 'invalid' | 'down';
  rio_check_at?: string;
  rio_asset_name?: string | null;
  rio_tracker_on?: RioTrackerOn | null;
  rio_valid_from?: string | null;
  rio_valid_to?: string | null;
  rio_last_fix_at?: string;
  rio_error_streak?: number;
}

/** #662 — wiersz do odpytania SafeFleet (token tylko w Edge / service_role). */
export interface SafefleetLoadRow {
  id: string;
  safefleet_token: string;
  safefleet_check_state: string | null;
  safefleet_check_at: string | null;
  safefleet_last_fix_at: string | null;
  safefleet_error_streak: number;
  safefleet_trajectory_done: boolean;
  telematics_vehicle_id: string | null;
  status: string | null;
  plannedLoadDate: string | null;
  trackingOpenedAt: string | null;
}

export interface SafefleetLoadPatch {
  safefleet_check_state?: 'ok' | 'pending' | 'invalid' | 'down';
  safefleet_check_at?: string;
  safefleet_last_fix_at?: string;
  safefleet_error_streak?: number;
  safefleet_trajectory_done?: boolean;
}

export interface SyncStore {
  projectId(): Promise<string>;
  vessels(): Promise<VesselRow[]>;
  sailingsSince(fromIso: string): Promise<DbSailing[]>;
  insertSailings(rows: SailingInsert[]): Promise<void>;
  /** aktualizacja z warunkiem source <> 'RECZNIE' (wyścig ze zmianą ręczną HHL) — zwraca, czy zapisano */
  updateSailing(id: string, patch: SailingPatch): Promise<boolean>;
  raiseRisk(r: RiskInput & { loadId?: string }): Promise<boolean>;
  latestPositions(maxAgeMin: number): Promise<VehiclePos[]>;
  lastRun(job: string): Promise<string | null>;
  /** zamyka otwarte ryzyka o kluczu z prefiksem (np. źródło znów działa) — zwraca liczbę */
  resolveRisks(dedupPrefix: string): Promise<number>;
  /** zamyka otwarte ryzyka z prefiksu, których klucza nie ma na liście (sytuacja zniknęła) */
  resolveStaleRisks?(dedupPrefix: string, keepDedup: string[]): Promise<number>;
  recordRun(job: string, ok: boolean, result: JobResult): Promise<void>;
  /** I-2j / AIS-SRC: pozycja promu (powtórka tego samego sygnału = bez zmian). Źródło jest na fix.source. */
  saveVesselPosition(vesselId: string, fix: VesselFix): Promise<void>;
  /** Ostatni sygnał każdego statku — ryzyko „brak ponad 1 h”. */
  latestVesselObserved?(): Promise<{ vesselId: string; observedAt: string }[]>;
  /** AIS-POLF: ostatnia pozycja AISSTREAM każdego statku od sinceIso (zapis: ferry-ais-listen co minutę). */
  latestAisstreamFixes?(sinceIso: string): Promise<{ vesselId: string; fix: VesselFix }[]>;
  /** #421 F7: ostatnia pozycja w strefie portu (promień km) → observed_at; do godziny wypłynięcia. */
  lastPortPosition?(vesselId: string, hub: { lat: number; lon: number }, radiusKm: number): Promise<string | null>;
  /** II-6: współczynnik spowolnienia SE (E4) dla silnika ETA II-7 */
  saveCorridorCondition?(row: {
    corridor: 'SE_E4' | 'SE_E22'; slowdownMult: number; reason: string | null; detail: unknown; observedAt: string;
  }): Promise<void>;
  /** II-6: parametr % spowolnienia (domyślnie 15) — opcjonalne */
  seSlowdownPct?(): Promise<number>;
  /** II-8: progi WAVE_M / GUST_KN z ops_thresholds (domyślnie 3.8 / 40) */
  opsThresholds?(): Promise<{ waveM: number; gustKn: number }>;

  /** H-2-PL / D-78: zapis zużycia HERE (service_role → here_note_service). */
  noteHereUsage?(service: 'tiles' | 'routing' | 'matching' | 'attributes' | 'traffic', n: number): Promise<void>;
  /** Koszt ponad pule w bieżącym miesiącu (Europe/Warsaw). */
  hereMonthSpend?(): Promise<number>;
  /** TELM: aktywne transporty do dopasowania naczepy. */
  listActiveLoadsForTelematics?(): Promise<{ id: string; trailer_plate: string | null; telematics_vehicle_id: string | null; status: string | null; plannedLoadDate?: string | null; plannedDeliverDate?: string | null; trackingOpenedAt?: string | null }[]>;
  /** TELM: zapis pozycji (process_position). */
  processPosition?(row: {
    loadId: string; lat: number; lon: number; ts: string;
    source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK' | 'SAFEFLEET';
    speed?: number | null; heading?: number | null; ignition?: boolean | null; raw?: unknown;
  }): Promise<void>;
  lastPositionAt?(loadId: string, source: string): Promise<string | null>;
  telmEmtrackWebEnabled?(): Promise<boolean>;
  /** E44: flaga TELM_RIO_LINKS — wyłącza odczyt linków RIO. */
  telmRioLinksEnabled?(): Promise<boolean>;
  /** #662: flaga TELM_SAFEFLEET_POLL. */
  telmSafefleetPollEnabled?(): Promise<boolean>;
  /** E44: blokada nakładania się przebiegów rio-links (TTL + token właściciela). */
  rioLinksLockTry?(ttlSec?: number, token?: string): Promise<boolean>;
  rioLinksLockRelease?(token?: string): Promise<void>;
  /** #662: blokada safefleet-poll. */
  safefleetPollLockTry?(ttlSec?: number, token?: string): Promise<boolean>;
  safefleetPollLockRelease?(token?: string): Promise<void>;
  /** TELM: pozycja naczepy bez awizacji — bez alarmów. */
  saveOrphanPosition?(row: {
    plate: string; trackingObjectId?: string | null;
    lat: number; lon: number; ts: string;
    source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK' | 'SAFEFLEET';
    speed?: number | null; heading?: number | null; ignition?: boolean | null; raw?: unknown;
  }): Promise<void>;
  /** #622: alarm HHL — GPS>2h, sieroty z tokenem naczepy. */
  scanOrphanTrailerAlerts?(): Promise<number>;
  /** TELM: faza z pozycji (SE/morze) przy podłączeniu w trasie. */
  inferPhaseFromPosition?(loadId: string, lat: number, lon: number, ts: string): Promise<string | null>;
  /** A8: licznik błędów logowania emtrack i pauza 6 h. */
  emtrackLoginState?(): Promise<import('./emtrackLogin.ts').EmtrackLoginState | null>;
  saveEmtrackLoginState?(state: import('./emtrackLogin.ts').EmtrackLoginState): Promise<void>;
  /** E44: transporty z linkiem RIO (secret tylko service_role). */
  listRioLoadsForPoll?(): Promise<RioLoadRow[]>;
  /** E44: wynik odczytu — bez secret w patch. */
  updateRioLoadState?(loadId: string, patch: RioLoadPatch): Promise<void>;
  /** #662: transporty SAFEFLEET (token tylko service_role). */
  listSafefleetLoadsForPoll?(): Promise<SafefleetLoadRow[]>;
  updateSafefleetLoadState?(loadId: string, patch: SafefleetLoadPatch): Promise<void>;
  /** Ostatnia pozycja z lat/lon (do prędkości RIO). */
  lastPositionFix?(loadId: string, source: string): Promise<{ lat: number; lon: number; ts: string } | null>;
  /** II-8: zapis bieżącej pogody morskiej */
  saveMarineCondition?(row: {
    corridor: 'BALTIC_GDN_NYN' | 'BALTIC_GDY_KAA';
    maxWaveM: number | null;
    maxGustKn: number | null;
    risk: 'niskie' | 'podwyższone' | 'wysokie';
    waveThrM: number;
    gustThrKn: number;
    sources: string;
    attribution: string;
    windowFrom: string | null;
    windowTo: string | null;
    detail: unknown;
    observedAt: string;
  }): Promise<void>;
  /** PL-DATA: pamięć tłumaczeń i zużycie DeepL. Brak = bez wywołań DeepL. */
  translationGet?(hash: string): Promise<string | null>;
  translationPut?(hash: string, source: string, pl: string, lang: 'SV' | 'EN'): Promise<void>;
  translationEnqueue?(hash: string, source: string, lang: 'SV' | 'EN', reason: string): Promise<void>;
  /** B9: lista kolejki do ponowienia; delete po sukcesie. */
  translationListQueue?(reasons: string[]): Promise<{ hash: string; source: string; lang: 'SV' | 'EN'; reason: string; createdAt: string }[]>;
  translationDequeue?(hash: string): Promise<void>;
  /** B9: uzupełnij opis PL w otwartych ryzykach drogi po udanym ponowieniu. */
  patchRoadRiskOpis?(original: string, pl: string): Promise<number>;
  deeplUsage?(): Promise<{ characters: number; limit: number }>;
  deeplAddUsage?(n: number): Promise<number>;
}
export interface JobDeps {
  store: SyncStore;
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now: () => Date;
  /** Testy: zamiast żywego WebSocket aisstream. ferry-ais bez tego czyta pozycje AISSTREAM z bazy
   *  (zapisuje je ferry-ais-listen); ferry-ais-listen bez tego słucha WebSocket. */
  collectAisstream?: (listenMs?: number) => Promise<VesselFix[]>;
  /** Testy emtrack: zamiast żywego WebSocket. */
  WebSocketImpl?: typeof WebSocket;
}
export interface JobResult {
  job: string; mode: 'LIVE' | 'DEMO'; ok: boolean; reason?: string;
  inserted?: number; updated?: number; manualKept?: number; unchanged?: number; unknown?: number; risks?: number;
  warnings?: string[]; observations?: Record<string, string>;
  /** #421: liczba rejsów z ustawionym delayed_departure/arrival z AIS. */
  departures?: number;
  /** #446: flaga wyłączona — Stan systemu nie pokazuje „działa” (front: result.disabled). */
  disabled?: boolean;
}

/** F7 #660: limit ścienny odczytu (20 s) — bez zawieszenia joba na martwym źródle. */
const READ_TEXT_TIMEOUT_MS = 20_000;

async function readText(deps: JobDeps, url: string, init?: RequestInit): Promise<{ ok: true; text: string } | { ok: false; warning: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), READ_TEXT_TIMEOUT_MS);
  try {
    const res = await deps.fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return { ok: false, warning: `HTTP ${res.status} ${url}` };
    return { ok: true, text: await res.text() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort/i.test(msg)) return { ok: false, warning: `Timeout ${READ_TEXT_TIMEOUT_MS / 1000}s ${url}` };
    return { ok: false, warning: `Błąd sieci ${url}: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

/** F7 #660: jak AIS — RECZNIE/ODWOLANY: actual_* bez zmiany statusu. */
function sailingActualPatch(
  s: { source: string; status: string },
  actual: Pick<SailingPatch, 'actual_departure_at' | 'actual_arrival_at'>,
  status: 'W_REJSIE' | 'DOPLYNAL',
): SailingPatch {
  const patch: SailingPatch = { ...actual };
  if (s.source !== 'RECZNIE' && s.status !== 'ODWOLANY') patch.status = status;
  return patch;
}

async function applySailings(
  deps: JobDeps, incoming: IncomingSailing[], sinceIso: string, source: AutoSailingSource = 'POLFERRIES',
) {
  const { store } = deps;
  const [projectId, vessels, existing] = await Promise.all([store.projectId(), store.vessels(), store.sailingsSince(sinceIso)]);
  const plan = planSailingSync({ existing, vessels, incoming, projectId, sinceUtc: sinceIso, source });
  if (plan.inserts.length) await store.insertSailings(plan.inserts);
  let updated = 0; let raced = 0;
  for (const u of plan.updates) { if (await store.updateSailing(u.id, u.patch)) updated++; else raced++; }
  return { plan, updated, manualKept: plan.manualKept + raced };
}

/** #666 F7: pula równoległych odczytów (limit 4) — 60 d × 2 trasy bez sekwencji 120×20 s. */
async function mapPoolLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Pobiera JSON rozkładu Stena na kilka dni × 2 trasy.
 * #666 F7: równolegle (limit 4); SOURCE_DOWN tylko gdy fetchedOk===0 lub zmiana struktury bez rejsów. */
async function fetchStenaDays(deps: JobDeps, days: number): Promise<{
  sailings: StenaSailing[]; warnings: string[]; http403: boolean; fetchedOk: number; structureFail: boolean;
}> {
  const warnings: string[] = [];
  const sailings: StenaSailing[] = [];
  let http403 = false;
  let fetchedOk = 0;
  let structureFail = false;
  const dates = dateRangeYmd(deps.now(), days);
  const jobs = (['GDKA', 'KAGD'] as const).flatMap((routeCode) => dates.map((date) => ({ routeCode, date })));
  const parts = await mapPoolLimit(jobs, 4, async ({ routeCode, date }) => {
    const url = stenaTimetableUrl(routeCode, date);
    const page = await readText(deps, url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!page.ok) {
      return {
        sailings: [] as StenaSailing[],
        warnings: [page.warning],
        http403: /HTTP 403/.test(page.warning),
        ok: false,
        structureFail: false,
      };
    }
    let json: unknown;
    try { json = JSON.parse(page.text); } catch {
      return {
        sailings: [] as StenaSailing[],
        warnings: [`Stena ${routeCode} ${date}: nieczytelny JSON`],
        http403: false,
        ok: false,
        structureFail: false,
      };
    }
    const parsed = parseStenaTimetable(json, { routeCode, dateYmd: date });
    const struct = parsed.warnings.some((w) => /Struktura/i.test(w));
    return {
      sailings: parsed.sailings,
      warnings: parsed.warnings.filter((w) => !/brak rejsów na/i.test(w)),
      http403: false,
      ok: true,
      structureFail: struct,
    };
  });
  for (const p of parts) {
    if (p.ok) fetchedOk += 1;
    if (p.http403) http403 = true;
    if (p.structureFail) structureFail = true;
    sailings.push(...p.sailings);
    warnings.push(...p.warnings);
  }
  return { sailings, warnings, http403, fetchedOk, structureFail };
}

/** BN2 — rozkład Tallink TAL↔HEL (Terminal D) + TAL↔STO na 14 dni.
 * F7 #660: bez wywołania strony booking (readText i tak nie niesie ciastek); częściowa awaria ≠ SOURCE_DOWN. */
async function fetchTallinkDays(deps: JobDeps, days: number): Promise<{
  sailings: ReturnType<typeof parseTallinkTimetable>['sailings'];
  warnings: string[];
  fetchedOk: number;
  structureFail: boolean;
}> {
  const warnings: string[] = [];
  const sailings: ReturnType<typeof parseTallinkTimetable>['sailings'] = [];
  let fetchedOk = 0;
  let structureFail = false;
  const dates = dateRangeYmd(deps.now(), days);
  const dateFrom = dates[0]!;
  const dateTo = dates[dates.length - 1]!;
  for (const [from, to] of [['tal', 'hel'], ['hel', 'tal'], ['tal', 'sto'], ['sto', 'tal']] as const) {
    const url = tallinkTimetableUrl({ from, to, dateFrom, dateTo });
    const page = await readText(deps, url, {
      headers: { 'User-Agent': TALLINK_UA, Accept: 'application/json' },
    });
    if (!page.ok) {
      warnings.push(page.warning);
      continue;
    }
    fetchedOk += 1;
    let json: unknown;
    try { json = JSON.parse(page.text); } catch {
      warnings.push(`Tallink ${from}-${to}: nieczytelny JSON`);
      continue;
    }
    const parsed = parseTallinkTimetable(json);
    if (parsed.warnings.some((w) => /Struktura/i.test(w))) structureFail = true;
    sailings.push(...parsed.sailings);
    warnings.push(...parsed.warnings.filter((w) => /Struktura|nieczytelny|nieznany statek|awaria/i.test(w)));
  }
  return { sailings, warnings, fetchedOk, structureFail };
}

/**
 * #666 A — Viking: najpierw Cargo HEL–TLL, potem sales (zapas).
 * SOURCE_DOWN tylko gdy oba źródła zawiodą (decyzja 50 + #666 A).
 */
async function fetchVikingDays(deps: JobDeps, days: number): Promise<{
  sailings: ReturnType<typeof parseVikingTimetableHtml>['sailings'];
  warnings: string[];
  fetchedOk: number;
  structureFail: boolean;
}> {
  const warnings: string[] = [];
  const cargo = await readText(deps, VIKING_CARGO_HEL_TLL_PAGE, {
    headers: { 'User-Agent': VIKING_UA, Accept: 'text/html' },
  });
  if (cargo.ok) {
    const parsed = parseVikingTimetableHtml(cargo.text, { now: deps.now(), days });
    warnings.push(...parsed.warnings);
    if (parsed.sailings.length > 0) {
      return { sailings: parsed.sailings, warnings, fetchedOk: 1, structureFail: false };
    }
  } else {
    warnings.push(cargo.warning);
  }
  const page = await readText(deps, VIKING_SCHEDULE_PAGE, {
    headers: { 'User-Agent': VIKING_UA, Accept: 'text/html' },
  });
  if (!page.ok) {
    warnings.push(page.warning);
    return { sailings: [], warnings, fetchedOk: 0, structureFail: false };
  }
  const parsed = parseVikingTimetableHtml(page.text, { now: deps.now(), days });
  warnings.push(...parsed.warnings);
  const structureFail = parsed.warnings.some((w) => /Struktura|zablokowana|pusta/i.test(w))
    && parsed.sailings.length === 0;
  return {
    sailings: parsed.sailings,
    warnings,
    fetchedOk: structureFail || parsed.sailings.length === 0 ? 0 : 1,
    structureFail,
  };
}

/** BN2 — Eckerö/Finbo HTML timetable (14 dni). */
async function fetchEckeroDays(deps: JobDeps, days: number): Promise<{
  sailings: ReturnType<typeof parseEckeroTimetableHtml>['sailings'];
  warnings: string[];
  fetchedOk: number;
  structureFail: boolean;
}> {
  const page = await readText(deps, ECKERO_SCHEDULE_PAGE, {
    headers: { 'User-Agent': ECKERO_UA, Accept: 'text/html' },
  });
  if (!page.ok) {
    return { sailings: [], warnings: [page.warning], fetchedOk: 0, structureFail: false };
  }
  const parsed = parseEckeroTimetableHtml(page.text, { now: deps.now(), days });
  const structureFail = parsed.warnings.some((w) => /Struktura|pusta/i.test(w))
    && parsed.sailings.length === 0;
  return {
    sailings: parsed.sailings,
    warnings: parsed.warnings,
    fetchedOk: parsed.sailings.length > 0 ? 1 : 0,
    structureFail,
  };
}

/** BN2 / F7 #661 B1 — DFDS: tylko faktycznie sparsowana treść (HTML/PDF); bez stałej HTML. */
async function fetchDfdsDays(deps: JobDeps, days: number): Promise<{
  sailings: ReturnType<typeof parseDfdsWeeklyHtml>['sailings'];
  warnings: string[];
  fetchedOk: number;
  structureFail: boolean;
}> {
  const warnings: string[] = [];
  const page = await readText(deps, DFDS_SCHEDULE_PAGE, {
    headers: { 'User-Agent': DFDS_UA, Accept: 'text/html' },
  });
  const pdf = await readText(deps, DFDS_WEEKLY_PDF_URL, {
    headers: { 'User-Agent': DFDS_UA, Accept: 'application/pdf' },
  });
  if (!page.ok) warnings.push(page.warning);
  if (!pdf.ok) warnings.push(pdf.warning);
  if (!page.ok && !pdf.ok) {
    return { sailings: [], warnings, fetchedOk: 0, structureFail: false };
  }
  if (page.ok) {
    const fromPage = parseDfdsWeeklyHtml(page.text, { now: deps.now(), days });
    if (fromPage.sailings.length > 0) {
      return {
        sailings: fromPage.sailings,
        warnings: [...warnings, ...fromPage.warnings],
        fetchedOk: 1,
        structureFail: false,
      };
    }
    warnings.push(...fromPage.warnings);
  }
  if (pdf.ok) {
    // PDF tekstowy: wyciąg z bajtów może zawierać HTML-podobną tabelę albo plain text.
    const fromPdf = parseDfdsWeeklyHtml(pdf.text, { now: deps.now(), days });
    if (fromPdf.sailings.length > 0) {
      return {
        sailings: fromPdf.sailings,
        warnings: [...warnings, ...fromPdf.warnings],
        fetchedOk: 1,
        structureFail: false,
      };
    }
    warnings.push(...fromPdf.warnings);
  }
  // HTTP 200 bez czytelnej tabeli → struktura zmieniona (SOURCE_DOWN), nie zmyślone godziny.
  if (!warnings.some((w) => /Struktura|brak tabeli/i.test(w))) {
    warnings.push('Struktura rozkładu DFDS zmieniona: brak tabeli Paldiski/Kapellskär.');
  }
  return { sailings: [], warnings, fetchedOk: 0, structureFail: true };
}

/** BN2 — Portnet Digitraffic: ATA/ATD → actual_* na dopasowanych rejsach (±3 h od planu). */
async function applyDigitrafficPortCallActuals(deps: JobDeps, sinceIso: string): Promise<{
  updated: number; warnings: string[]; fail: boolean;
}> {
  const now = deps.now();
  const fromIso = new Date(now.getTime() - 2 * 864e5).toISOString();
  const toIso = new Date(now.getTime() + 864e5).toISOString();
  const url = digitrafficPortCallsUrl({ fromIso, toIso });
  const page = await readText(deps, url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Digitraffic-User': DIGITRAFFIC_USER,
    },
  });
  if (!page.ok) {
    return { updated: 0, warnings: [page.warning], fail: true };
  }
  let json: unknown;
  try { json = JSON.parse(page.text); } catch {
    return { updated: 0, warnings: ['Digitraffic Portnet: nieczytelny JSON'], fail: true };
  }
  const parsed = parseDigitrafficPortCalls(json);
  if (parsed.warnings.some((w) => /Struktura/i.test(w))) {
    return { updated: 0, warnings: parsed.warnings, fail: true };
  }
  const [vessels, existing] = await Promise.all([
    deps.store.vessels(), deps.store.sailingsSince(sinceIso),
  ]);
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  let updated = 0;
  const WINDOW_MS = 3 * 3600_000;
  for (const c of parsed.calls) {
    const vesselId = byName.get(c.vessel);
    if (!vesselId) continue;
    if (c.actualArrivalUtc && c.arrivalRoute) {
      const t = Date.parse(c.actualArrivalUtc);
      const hit = existing.find((s) =>
        s.vessel_id === vesselId
        && s.route === c.arrivalRoute
        && Math.abs(Date.parse(s.arrival_at) - t) <= WINDOW_MS
        && s.actual_arrival_at == null);
      // F7 #660: RECZNIE → tylko actual_*; ODWOLANY bez zmiany statusu (jak AIS).
      if (hit && await deps.store.updateSailing(
        hit.id, sailingActualPatch(hit, { actual_arrival_at: c.actualArrivalUtc }, 'DOPLYNAL'),
      )) {
        updated += 1;
        hit.actual_arrival_at = c.actualArrivalUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'DOPLYNAL';
      }
    }
    if (c.actualDepartureUtc && c.departureRoute) {
      const t = Date.parse(c.actualDepartureUtc);
      const hit = existing.find((s) =>
        s.vessel_id === vesselId
        && s.route === c.departureRoute
        && Math.abs(Date.parse(s.departure_at) - t) <= WINDOW_MS
        && s.actual_departure_at == null);
      if (hit && await deps.store.updateSailing(
        hit.id, sailingActualPatch(hit, { actual_departure_at: c.actualDepartureUtc }, 'W_REJSIE'),
      )) {
        updated += 1;
        hit.actual_departure_at = c.actualDepartureUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'W_REJSIE';
      }
    }
  }
  return { updated, warnings: parsed.warnings, fail: false };
}

/**
 * F7 #660: Portnet = FI (HEL/VUO); Ports of Stockholm = SE (STO/KPS) — brak ATA w EE.
 * Po arrival_at + 2 h bez ATA → DOPLYNAL (actual_arrival_at = null). F7 r2: + STO-TLL, KPS-PLD.
 */
async function closeStaleFiToEeWithoutAta(deps: JobDeps, sinceIso: string): Promise<number> {
  const ROUTES = new Set(['HEL-TLL', 'HELA-TLL', 'VUO-MUU', 'STO-TLL', 'KPS-PLD']);
  const nowMs = deps.now().getTime();
  const existing = await deps.store.sailingsSince(sinceIso);
  let updated = 0;
  for (const s of existing) {
    if (!ROUTES.has(s.route)) continue;
    if (s.status !== 'W_REJSIE') continue;
    if (s.actual_arrival_at != null) continue;
    if (s.source === 'RECZNIE') continue;
    if (Date.parse(s.arrival_at) + 2 * 3600_000 > nowMs) continue;
    if (await deps.store.updateSailing(s.id, { status: 'DOPLYNAL' })) {
      updated += 1;
      s.status = 'DOPLYNAL';
    }
  }
  return updated;
}

function tallinnDateYmd(now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/**
 * BN2 / F7 r3 — Port of Tallinn: tylko odwołania na istniejących (statek + ±3 h).
 * Bez insertów, bez zmiany godzin, bez actual_* z planu (atUtc = godzina planowana
 * tablicy — actual_* wyłącznie z Portnet / Ports of Stockholm / AIS).
 */
async function applyPortTallinn(deps: JobDeps, sinceIso: string): Promise<{
  warnings: string[]; fail: boolean; cancelled: number;
}> {
  const empty = { warnings: [] as string[], fail: false, cancelled: 0 };
  const headers = { 'User-Agent': PORT_TALLINN_UA, Accept: 'text/html' };
  const [depPage, arrPage] = await Promise.all([
    readText(deps, PORT_TALLINN_DEPARTURES_URL, { headers }),
    readText(deps, PORT_TALLINN_ARRIVALS_URL, { headers }),
  ]);
  const warnings: string[] = [];
  if (!depPage.ok) warnings.push(depPage.warning);
  if (!arrPage.ok) warnings.push(arrPage.warning);
  if (!depPage.ok && !arrPage.ok) {
    return { ...empty, warnings, fail: true };
  }
  const html = `${depPage.ok ? depPage.text : ''}\n${arrPage.ok ? arrPage.text : ''}`;
  // F7 #661 B2: tylko dzień, który tablica faktycznie pokazuje (dziś) —
  // ta sama tablica z datą +1 fałszywie oznacza jutrzejszy rejs jako ODWOLANY.
  const today = tallinnDateYmd(deps.now());
  const parsed = parsePortTallinnHtml(html, today);
  const events = parsed.events;
  const parsedWarnings = parsed.warnings;
  warnings.push(...parsedWarnings);
  if (parsedWarnings.some((w) => /brak tabeli|pusta odpowiedź/i.test(w)) && events.length === 0) {
    return { ...empty, warnings, fail: true };
  }
  const [vessels, existing] = await Promise.all([
    deps.store.vessels(), deps.store.sailingsSince(sinceIso),
  ]);
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  const WINDOW_MS = 3 * 3600_000;
  let cancelled = 0;
  const seen = new Set<string>();
  for (const e of events) {
    if (!e.cancelled) continue; // F7 r3: sam plan → bez actual_* / statusu
    const dedup = `${e.vessel}|${e.route}|${e.atUtc}|${e.kind}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    const vesselId = byName.get(e.vessel);
    if (!vesselId) continue;
    const t = Date.parse(e.atUtc);
    const hit = existing.find((s) =>
      s.vessel_id === vesselId
      && s.route === e.route
      && Math.abs(Date.parse(e.kind === 'DEPARTURE' ? s.departure_at : s.arrival_at) - t) <= WINDOW_MS
      && s.status !== 'ODWOLANY'
      && s.source !== 'RECZNIE');
    if (hit && await deps.store.updateSailing(hit.id, { status: 'ODWOLANY' })) {
      cancelled += 1;
      hit.status = 'ODWOLANY';
    }
  }
  return { warnings, fail: false, cancelled };
}

/**
 * BN2 / F7 r2 — Ports of Stockholm: tylko dopasowanie istniejących (statek + ±3 h)
 * → actual_*; bez insertów i bez zmiany departure_at/arrival_at.
 */
async function applyPortsStockholm(deps: JobDeps, sinceIso: string): Promise<{
  warnings: string[]; fail: boolean; actualUpdated: number;
}> {
  const empty = { warnings: [] as string[], fail: false, actualUpdated: 0 };
  const page = await readText(deps, PORTS_STOCKHOLM_PORTENTRY_URL, {
    headers: { 'User-Agent': PORTS_STOCKHOLM_UA, Accept: 'application/json' },
  });
  if (!page.ok) return { ...empty, warnings: [page.warning], fail: true };
  let json: unknown;
  try { json = JSON.parse(page.text); } catch {
    return { ...empty, warnings: ['Ports of Stockholm: nieczytelny JSON'], fail: true };
  }
  const parsed = parsePortsStockholmPortEntry(json);
  if (parsed.warnings.some((w) => /Struktura/i.test(w))) {
    return { ...empty, warnings: parsed.warnings, fail: true };
  }
  const warnings = [...parsed.warnings];
  const [vessels, existing] = await Promise.all([
    deps.store.vessels(), deps.store.sailingsSince(sinceIso),
  ]);
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  let actualUpdated = 0;
  const WINDOW_MS = 3 * 3600_000;
  for (const c of parsed.calls) {
    const vesselId = byName.get(c.vessel);
    if (!vesselId) continue;
    if (c.actualArrivalUtc && c.arrivalRoute) {
      const t = Date.parse(c.actualArrivalUtc);
      const hit = existing.find((s) =>
        s.vessel_id === vesselId
        && s.route === c.arrivalRoute
        && Math.abs(Date.parse(s.arrival_at) - t) <= WINDOW_MS
        && s.actual_arrival_at == null);
      if (hit && await deps.store.updateSailing(
        hit.id, sailingActualPatch(hit, { actual_arrival_at: c.actualArrivalUtc }, 'DOPLYNAL'),
      )) {
        actualUpdated += 1;
        hit.actual_arrival_at = c.actualArrivalUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'DOPLYNAL';
      }
    }
    if (c.actualDepartureUtc && c.departureRoute) {
      const t = Date.parse(c.actualDepartureUtc);
      const hit = existing.find((s) =>
        s.vessel_id === vesselId
        && s.route === c.departureRoute
        && Math.abs(Date.parse(s.departure_at) - t) <= WINDOW_MS
        && s.actual_departure_at == null);
      if (hit && await deps.store.updateSailing(
        hit.id, sailingActualPatch(hit, { actual_departure_at: c.actualDepartureUtc }, 'W_REJSIE'),
      )) {
        actualUpdated += 1;
        hit.actual_departure_at = c.actualDepartureUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'W_REJSIE';
      }
    }
  }
  return { warnings, fail: false, actualUpdated };
}

/** ferry-schedule — Polferries + Stena + BN2 Tallink + Port of Tallinn / Ports of Stockholm (rozkład).
 * Portnet ATD/ATA: ferry-portnet co 15 min (F7 #660). */
export async function runFerrySchedule(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const page = await readText(deps, POLFERRIES_SCHEDULE_URL, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } });
  const parsed = page.ok ? parsePolferriesSchedule(page.text) : { sailings: [], warnings: [page.warning] };
  const pfFail = isSourceFailure({ warnings: parsed.warnings, count: parsed.sailings.length });
  if (pfFail) {
    await deps.store.raiseRisk(sourceDownRisk('POLFERRIES_SCHEDULE', parsed.warnings, now, POLFERRIES_SCHEDULE_URL));
  }
  const since = new Date(Date.parse(now) - 864e5).toISOString();
  let inserted = 0; let updated = 0; let manualKept = 0; let unchanged = 0;
  const warnings = [...parsed.warnings];
  let risks = pfFail ? 1 : 0;
  if (!pfFail) {
    const incoming: IncomingSailing[] = parsed.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incoming, since, 'POLFERRIES');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
    await deps.store.resolveRisks('SOURCE_DOWN:POLFERRIES_SCHEDULE:');
  }

  /* #666 decyzja 54 + F7: horyzont ≥ 60 dni; SOURCE_DOWN tylko przy całkowitej awarii (jak Tallink #660) */
  const stena = await fetchStenaDays(deps, 60);
  warnings.push(...stena.warnings);
  const stFail = stena.fetchedOk === 0
    || (stena.structureFail && stena.sailings.length === 0);
  if (stFail) {
    await deps.store.raiseRisk(sourceDownRisk('STENA_SCHEDULE', stena.warnings.length ? stena.warnings : ['Brak odpowiedzi Stena'], now, STENA_ROUTE_PAGE));
    risks += 1;
  } else if (stena.sailings.length > 0) {
    const incomingS: IncomingSailing[] = stena.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incomingS, since, 'STENA');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
    await deps.store.resolveRisks('SOURCE_DOWN:STENA_SCHEDULE:');
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:STENA_SCHEDULE:');
  }

  // BN2: Tallink + Viking + Eckerö + DFDS LIVE.
  // F7 #660: SOURCE_DOWN tylko gdy fetchedOk===0 lub zmiana struktury bez żadnych rejsów; kierunki OK zapisujemy.
  /* #666 decyzja 54: horyzont ≥ 60 dni */
  const tallink = await fetchTallinkDays(deps, 60);
  warnings.push(...tallink.warnings);
  const tlFail = tallink.fetchedOk === 0
    || (tallink.structureFail && tallink.sailings.length === 0);
  if (tallink.sailings.length > 0) {
    const incomingT: IncomingSailing[] = tallink.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incomingT, since, 'TALLINK');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
  }
  if (tlFail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'TALLINK_SCHEDULE',
      tallink.warnings.length ? tallink.warnings : ['Brak odpowiedzi Tallink'],
      now,
      TALLINK_BOOKING,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:TALLINK_SCHEDULE:');
  }

  /* #666 A + decyzja 54: Viking Cargo, horyzont ≥ 60 dni; sales = zapas */
  const viking = await fetchVikingDays(deps, 60);
  warnings.push(...viking.warnings);
  const vkFail = viking.fetchedOk === 0
    || (viking.structureFail && viking.sailings.length === 0);
  if (viking.sailings.length > 0) {
    const incomingV: IncomingSailing[] = viking.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incomingV, since, 'VIKING');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
  }
  if (vkFail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'VIKING_SCHEDULE',
      viking.warnings.length ? viking.warnings : ['Brak odpowiedzi Viking'],
      now,
      VIKING_CARGO_HEL_TLL_PAGE,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:VIKING_SCHEDULE:');
  }

  /* #666 decyzja 54: horyzont ≥ 60 dni (Viking Cargo — osobny krok #666 A) */
  const eckero = await fetchEckeroDays(deps, 60);
  warnings.push(...eckero.warnings);
  const ekFail = eckero.fetchedOk === 0
    || (eckero.structureFail && eckero.sailings.length === 0);
  if (eckero.sailings.length > 0) {
    const incomingE: IncomingSailing[] = eckero.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incomingE, since, 'ECKERO');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
  }
  if (ekFail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'ECKERO_SCHEDULE',
      eckero.warnings.length ? eckero.warnings : ['Brak odpowiedzi Eckerö'],
      now,
      ECKERO_SCHEDULE_PAGE,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:ECKERO_SCHEDULE:');
  }

  /* #666 decyzja 54 + E: DFDS Dynamic schedule — osobny krok; tu rozszerzenie tygodniówki */
  const dfds = await fetchDfdsDays(deps, 60);
  warnings.push(...dfds.warnings);
  const dfFail = dfds.fetchedOk === 0
    || (dfds.structureFail && dfds.sailings.length === 0);
  if (dfds.sailings.length > 0) {
    const incomingD: IncomingSailing[] = dfds.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incomingD, since, 'DFDS');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
  }
  if (dfFail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'DFDS_SCHEDULE',
      dfds.warnings.length ? dfds.warnings : ['Brak odpowiedzi DFDS'],
      now,
      DFDS_SCHEDULE_PAGE,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:DFDS_SCHEDULE:');
  }

  // Portnet ATD/ATA + Port of Tallinn odwołania → ferry-portnet co 15 min (F7 #660).
  // W ferry-schedule zostawiamy też Tallinn (raz dziennie) jako zapas.

  // BN2 / F7 r3: Port of Tallinn — tylko odwołania (bez insertów / godzin / actual_* z planu).
  const tallinn = await applyPortTallinn(deps, since);
  warnings.push(...tallinn.warnings);
  updated += tallinn.cancelled;
  if (tallinn.fail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'PORT_TALLINN',
      tallinn.warnings.length ? tallinn.warnings : ['Brak odpowiedzi Port of Tallinn'],
      now,
      PORT_TALLINN_DEPARTURES_URL,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:PORT_TALLINN:');
  }

  // BN2 / F7 r2: Ports of Stockholm — tylko actual_* na istniejących (bez insertów / godzin).
  const stockholm = await applyPortsStockholm(deps, since);
  warnings.push(...stockholm.warnings);
  updated += stockholm.actualUpdated;
  if (stockholm.fail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'PORTS_STOCKHOLM',
      stockholm.warnings.length ? stockholm.warnings : ['Brak odpowiedzi Ports of Stockholm'],
      now,
      PORTS_STOCKHOLM_PORTENTRY_URL,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:PORTS_STOCKHOLM:');
  }

  return {
    job: 'ferry-schedule', mode: 'LIVE',
    ok: !(pfFail && stFail && tlFail && vkFail && ekFail && dfFail),
    inserted, updated, manualKept, unchanged, risks, warnings,
  };
}

/** ferry-portnet — Digitraffic Portnet ATD/ATA co 15 min (F7 #660 pkt 6) + domknięcie W_REJSIE FI→EE. */
export async function runFerryPortnet(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const since = new Date(Date.parse(now) - 864e5).toISOString();
  const warnings: string[] = [];
  let risks = 0;
  const portnet = await applyDigitrafficPortCallActuals(deps, since);
  warnings.push(...portnet.warnings);
  let updated = portnet.updated;
  if (portnet.fail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'DIGITRAFFIC_PORTCALL',
      portnet.warnings.length ? portnet.warnings : ['Brak odpowiedzi Portnet'],
      now,
      DIGITRAFFIC_PORT_CALLS_URL,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:DIGITRAFFIC_PORTCALL:');
  }
  const closed = await closeStaleFiToEeWithoutAta(deps, since);
  updated += closed;
  // F7 #660: Port of Tallinn odwołania także co 15 min (dzień + następny).
  const tallinn = await applyPortTallinn(deps, since);
  warnings.push(...tallinn.warnings);
  updated += tallinn.cancelled;
  if (tallinn.fail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'PORT_TALLINN',
      tallinn.warnings.length ? tallinn.warnings : ['Brak odpowiedzi Port of Tallinn'],
      now,
      PORT_TALLINN_DEPARTURES_URL,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:PORT_TALLINN:');
  }
  return {
    job: 'ferry-portnet', mode: 'LIVE', ok: !portnet.fail,
    updated, risks, warnings,
    observations: closed ? { closed_without_ata: String(closed) } : undefined,
  };
}


/** FERRY-STATUS: jedno pobranie strony + jeden POST. Cache 10 min. Przy błędzie bez pętli. */
let stenaFreightCache: { at: number; sailings: StenaSailing[]; warnings: string[] } | null = null;
export function resetStenaFreightCache(): void { stenaFreightCache = null; }

export async function fetchStenaFreight(deps: JobDeps): Promise<{
  sailings: StenaSailing[]; warnings: string[]; ok: boolean;
}> {
  const nowMs = deps.now().getTime();
  if (stenaFreightCache && nowMs - stenaFreightCache.at < 10 * 60_000) {
    return { sailings: stenaFreightCache.sailings, warnings: [], ok: true };
  }
  const page = await readText(deps, STENA_FREIGHT_PAGE, {
    headers: { 'User-Agent': STENA_FREIGHT_UA, Accept: 'text/html' },
  });
  if (!page.ok) return { sailings: [], warnings: [page.warning], ok: false };
  const token = freightSecurityToken(page.text);
  if (!token) {
    return { sailings: [], warnings: ['Struktura strony Stena Freight zmieniona: brak tokenu security.'], ok: false };
  }
  const win = freightWindow(deps.now());
  const body = new URLSearchParams({
    action: 'timetable',
    security: token,
    'data[from]': win.from,
    'data[to]': win.to,
    'data[routeCode]': win.routeCode,
  });
  const res = await readText(deps, STENA_FREIGHT_AJAX, {
    method: 'POST',
    headers: {
      'User-Agent': STENA_FREIGHT_UA,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: STENA_FREIGHT_PAGE,
    },
    body: body.toString(),
  });
  if (!res.ok) return { sailings: [], warnings: [res.warning], ok: false };
  const parsed = parseStenaFreightTimetable(res.text);
  const broken = parsed.warnings.some((w) => /Struktura|nieczytelny JSON|nieznany nagłówek/i.test(w));
  if (broken || parsed.sailings.length === 0) {
    return { sailings: [], warnings: parsed.warnings.length ? parsed.warnings : ['Stena Freight: pusta tabela'], ok: false };
  }
  stenaFreightCache = { at: nowMs, sailings: parsed.sailings, warnings: parsed.warnings };
  return { sailings: parsed.sailings, warnings: parsed.warnings.filter((w) => !/brak rejsów/i.test(w)), ok: true };
}

/** ferry-status — komunikaty Polferries + status Stena z JSON; 403 → NIEZNANY + ryzyko. */
export async function runFerryStatus(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const page = await readText(deps, POLFERRIES_STATUS_URL, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } });
  const http403 = !page.ok && /HTTP 403/.test(page.warning);
  const parsed = page.ok
    ? parsePolferriesStatus(page.text)
    : {
      sailings: [],
      warnings: [
        page.warning,
        ...(http403
          ? ['Cloudflare zablokował odczyt komunikatów Polferries (HTTP 403) — status NIEZNANY, HHL weryfikuje ręcznie. Nie obchodzimy zabezpieczeń.']
          : []),
      ],
    };
  const pfFail = isSourceFailure({ warnings: parsed.warnings, count: parsed.sailings.length });
  if (pfFail) {
    await deps.store.raiseRisk(sourceDownRisk('POLFERRIES_STATUS', parsed.warnings, now, POLFERRIES_STATUS_URL));
  }
  const since = new Date(Date.parse(now) - 864e5).toISOString();
  let inserted = 0; let updated = 0; let manualKept = 0; let unchanged = 0; let unknown = 0; let risks = pfFail ? 1 : 0;
  const warnings = [...parsed.warnings];
  if (!pfFail) {
    const incoming: IncomingSailing[] = parsed.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.plannedDepartureUtc, arrivalUtc: s.plannedArrivalUtc,
      status: s.status, expectedDepartureUtc: s.expectedDepartureUtc, expectedArrivalUtc: s.expectedArrivalUtc,
    }));
    const { plan, updated: u, manualKept: m } = await applySailings(deps, incoming, since, 'POLFERRIES');
    inserted += plan.inserts.length; updated += u; manualKept += m; unchanged += plan.unchanged; unknown += plan.unknown.length;
    await deps.store.resolveRisks('SOURCE_DOWN:POLFERRIES_STATUS:');
    for (const urow of plan.unknown) {
      const raw = parsed.sailings.find((p) => p.vessel === urow.vessel && p.plannedDepartureUtc === urow.departureUtc);
      if (await deps.store.raiseRisk(unknownStatusRisk(urow, `${raw?.rawStatusClass ?? ''} / ${raw?.rawBadge ?? ''}`, 'POLFERRIES'))) risks++;
    }
  } else if (http403) {
    unknown += 1; // II-5: 403 = NIEZNANY (bez zmiany rejsów)
  }

  // FERRY-STATUS: Freight admin-ajax jest głównym źródłem (rzeczywiste godziny i status).
  // JSON AEM (II-5) jest zapasem. Błąd Freight → ryzyko i jeden odczyt zapasu, bez pętli.
  const freight = await fetchStenaFreight(deps);
  let stenaSailings = freight.sailings;
  let stFail = !freight.ok;
  if (!freight.ok) {
    warnings.push(...freight.warnings);
    warnings.push('Stena Freight niedostępna — przejście na zapas (stenalinetravel JSON).');
    if (await deps.store.raiseRisk(sourceDownRisk(
      'STENA_STATUS',
      freight.warnings.length ? freight.warnings : ['Brak odpowiedzi Stena Freight'],
      now,
      STENA_FREIGHT_PAGE,
    ))) risks += 1;
    const backup = await fetchStenaDays(deps, 2);
    warnings.push(...backup.warnings);
    const backupFail = backup.http403 || backup.fetchedOk === 0
      || backup.warnings.some((w) => /Struktura|HTTP|nieczytelny JSON/i.test(w));
    if (backupFail) {
      stFail = true;
      if (backup.http403) unknown += 1;
    } else {
      stenaSailings = backup.sailings;
      stFail = false;
    }
  } else {
    warnings.push(...freight.warnings);
    await deps.store.resolveRisks('SOURCE_DOWN:STENA_STATUS:');
    stFail = false;
  }
  if (stenaSailings.length > 0) {
    const incomingS: IncomingSailing[] = stenaSailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
      status: s.status, expectedDepartureUtc: s.expectedDepartureUtc, expectedArrivalUtc: s.expectedArrivalUtc,
    }));
    const { plan, updated: u, manualKept: m } = await applySailings(deps, incomingS, since, 'STENA');
    inserted += plan.inserts.length; updated += u; manualKept += m; unchanged += plan.unchanged; unknown += plan.unknown.length;
    if (freight.ok) await deps.store.resolveRisks('SOURCE_DOWN:STENA_STATUS:');
    for (const urow of plan.unknown) {
      const raw = stenaSailings.find((p) => p.vessel === urow.vessel && p.departureUtc === urow.departureUtc);
      if (await deps.store.raiseRisk(unknownStatusRisk(urow, raw?.rawStatus ?? '', 'STENA'))) risks++;
    }
  } else if (freight.ok) {
    await deps.store.resolveRisks('SOURCE_DOWN:STENA_STATUS:');
  }

  const result: JobResult = {
    job: 'ferry-status', mode: 'LIVE', ok: !(pfFail && stFail),
    inserted, updated, manualKept, unchanged, unknown, risks, warnings,
  };
  // #421 F7: po zmianie statusu odśwież rozkład, ale max raz na 60 min (unikaj 28× Stena / 10 min).
  if (updated > 0 || inserted > 0) {
    const lastSched = await deps.store.lastRun('ferry-schedule');
    const gapMin = lastSched ? (deps.now().getTime() - Date.parse(lastSched)) / 60_000 : 999;
    if (gapMin >= 60) {
      try {
        const sched = await runFerrySchedule(deps);
        await deps.store.recordRun('ferry-schedule', sched.ok, sched);
        if (sched.warnings?.length) warnings.push(...sched.warnings.map((w) => `po statusie→rozkład: ${w}`));
      } catch (e) {
        warnings.push(`po statusie→rozkład: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      warnings.push(`po statusie→rozkład: pominięte (ostatni ${Math.round(gapMin)} min temu, limit 60)`);
    }
  }
  return result;
}

/** ferry-ais — AIS-SRC. Stena IRM (co przebieg, bez cache), aisstream (5 MMSI), Digitraffic jako zapas.
 *  Zapisujemy Digitraffic/STENA/żywy AISSTREAM (nie ponownie z bazy). Q-18 nie filtruje zapisu.
 *  #421 F7: actual_* przy wypłynięciu/dopłynięciu; integration_runs ferry-departures zawsze. */
/** F7 r2: godzina wypłynięcia tylko w [plan−2 h, teraz] i po poprzednim actual_arrival tego statku. */
export function acceptActualDepartureAt(
  depAtIso: string, planDepIso: string, nowMs: number, prevActualArrivalIso: string | null,
): boolean {
  const t = Date.parse(depAtIso);
  if (!Number.isFinite(t)) return false;
  const plan = Date.parse(planDepIso);
  if (!Number.isFinite(plan)) return false;
  if (t < plan - 2 * 3600_000) return false;
  if (t > nowMs) return false;
  if (prevActualArrivalIso != null && t <= Date.parse(prevActualArrivalIso)) return false;
  return true;
}

/** Wycofanie Stena IRM po 403/429 — bez SOURCE_DOWN przy każdym przebiegu (F7). */
let stenaIrmBackoffUntilMs = 0;

async function readStenaIrm(deps: JobDeps, nowMs: number): Promise<{ fixes: VesselFix[]; warning: string | null; suppressRisk?: boolean }> {
  if (nowMs < stenaIrmBackoffUntilMs) {
    return { fixes: [], warning: null, suppressRisk: true };
  }
  const r = await readText(deps, STENA_FERRIES_URL, { headers: { 'User-Agent': STENA_IRM_UA, Accept: 'application/json' } });
  if (!r.ok) {
    if (/HTTP 403|HTTP 429/.test(r.warning)) {
      const wasBacking = nowMs < stenaIrmBackoffUntilMs;
      stenaIrmBackoffUntilMs = nowMs + 15 * 60_000;
      return { fixes: [], warning: r.warning, suppressRisk: wasBacking };
    }
    return { fixes: [], warning: r.warning };
  }
  stenaIrmBackoffUntilMs = 0;
  try {
    return parseStenaFerries(JSON.parse(r.text));
  } catch {
    return { fixes: [], warning: 'Stena IRM: nieczytelna odpowiedź (zmiana formatu?)' };
  }
}

export async function runFerryAis(deps: JobDeps): Promise<JobResult> {
  const nowD = deps.now(); const now = nowD.toISOString();
  const [vessels, sailings] = await Promise.all([deps.store.vessels(), deps.store.sailingsSince(new Date(nowD.getTime() - 2 * 864e5).toISOString())]);
  const tracked = vessels.filter((v) => isTrackedMmsi(v.mmsi) || (v.imo != null && STENA_IMO.has(v.imo)));
  const eff = (s: DbSailing) => ({
    dep: Date.parse(s.actual_departure_at ?? s.delayed_departure_at ?? s.departure_at),
    arr: Date.parse(s.actual_arrival_at ?? s.delayed_arrival_at ?? s.arrival_at),
  });
  const inProgress = sailings.filter((s) => s.status !== 'ODWOLANY' && eff(s).dep <= nowD.getTime() && nowD.getTime() <= eff(s).arr + 3 * 36e5);
  const upcoming = sailings.filter((s) => {
    if (s.status === 'ODWOLANY') return false;
    const d = eff(s).dep;
    return d > nowD.getTime() && d <= nowD.getTime() + 6 * 36e5;
  });
  const observations: Record<string, string> = {};
  const warnings: string[] = [];
  let risks = 0;
  const byVessel = new Map<string, VesselFix[]>();
  const aisstreamFromDb = new Set<string>();
  const pushFix = (vesselId: string, fix: VesselFix | null) => {
    if (!fix) return;
    const list = byVessel.get(vesselId) ?? [];
    list.push(fix);
    byVessel.set(vesselId, list);
  };

  const wantsStena = tracked.some((v) => (v.imo != null && STENA_IMO.has(v.imo)) || (v.mmsi != null && STENA_MMSI.has(v.mmsi)));
  if (wantsStena) {
    const stena = await readStenaIrm(deps, nowD.getTime());
    if (stena.warning) {
      warnings.push(stena.warning);
      if (!stena.suppressRisk) {
        await deps.store.raiseRisk(sourceDownRisk('STENA_IRM', [stena.warning], now, STENA_FERRIES_URL));
        risks++;
      }
    } else if (stena.fixes.length || !stena.suppressRisk) {
      await deps.store.resolveRisks('SOURCE_DOWN:STENA_IRM:');
    }
    for (const fix of stena.fixes) {
      const v = tracked.find((x) => (fix.imo != null && x.imo === fix.imo) || x.mmsi === fix.mmsi);
      if (v) pushFix(v.id, fix);
    }
  }

  // AIS-POLF (05.10): WebSocket słucha osobna funkcja ferry-ais-listen (co minutę, ~50 s).
  // Tu tylko jej ostatnie pozycje z bazy (≤ 10 min) — porównanie „nowsza wygrywa”; bez ponownego zapisu (F7).
  const allow = tracked.map((v) => v.mmsi).filter((m): m is number => isTrackedMmsi(m)).map(String);
  if (deps.collectAisstream) {
    if (deps.env.AISSTREAM_API_KEY && allow.length) {
      try {
        const fixes = await deps.collectAisstream();
        for (const fix of fixes) {
          if (!isTrackedMmsi(fix.mmsi)) continue;
          const v = tracked.find((x) => x.mmsi === fix.mmsi);
          if (v) pushFix(v.id, { ...fix, source: 'AISSTREAM' });
        }
      } catch {
        warnings.push('aisstream niedostępne — zapas Digitraffic');
      }
    }
  } else if (deps.store.latestAisstreamFixes) {
    try {
      const recent = await deps.store.latestAisstreamFixes(new Date(nowD.getTime() - 10 * 60_000).toISOString());
      for (const r of recent) {
        if (tracked.some((v) => v.id === r.vesselId)) {
          aisstreamFromDb.add(r.vesselId);
          pushFix(r.vesselId, { ...r.fix, source: 'AISSTREAM' });
        }
      }
    } catch {
      warnings.push('aisstream: odczyt z bazy nieudany — zapas Digitraffic');
    }
  }

  const pollDigitraffic = async (v: { id: string; mmsi: number | null }) => {
    if (!v.mmsi) return;
    const r = await readText(deps, `https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${v.mmsi}`, { headers: { 'Accept-Encoding': 'gzip', 'Digitraffic-User': DIGITRAFFIC_USER } });
    if (!r.ok) { warnings.push(r.warning); return; }
    try {
      const fix = parseDigitrafficLocations(JSON.parse(r.text), v.mmsi);
      if (fix) pushFix(v.id, fix);
    } catch {
      warnings.push('Digitraffic: nieczytelna odpowiedź (zmiana formatu?)');
    }
  };
  for (const v of tracked) {
    if (v.mmsi) await pollDigitraffic(v);
  }

  const chosen = new Map<string, VesselFix>();
  for (const v of tracked) {
    const list = byVessel.get(v.id) ?? [];
    // #421 F7: zapis Digitraffic/STENA/żywy AISSTREAM; bez ponownego zapisu AISSTREAM z bazy.
    for (const f of list) {
      if (f.source === 'AISSTREAM' && aisstreamFromDb.has(v.id)) continue;
      await deps.store.saveVesselPosition(v.id, f);
    }
    const stenaEta = list.find((f) => f.source === 'STENA' && f.etaAt)?.etaAt ?? null;
    const win = pickNewerFix(list);
    if (!win) continue;
    const fix = stenaEta && !win.etaAt ? { ...win, etaAt: stenaEta } : win;
    chosen.set(v.id, fix);
  }

  let departures = 0;
  for (const s of inProgress) {
    const v = vessels.find((x) => x.id === s.vessel_id);
    if (!v) continue;
    if (!v.mmsi && !(v.imo != null && STENA_IMO.has(v.imo))) { observations[v.name] = 'BRAK_MMSI'; continue; }
    const fix = chosen.get(v.id);
    if (!fix) { observations[v.name] = 'BRAK_SWIEZEGO_SYGNALU'; continue; }
    const arrPort = arrivalPortForRoute(s.route);
    const depPort = departurePortForRoute(s.route);
    // F7 r2: etykieta SE z portu SE na trasie (KAA-GDY → KAA, nie NYN).
    const seObsPort: 'NYN' | 'KAA' =
      arrPort === 'NYN' || arrPort === 'KAA' ? arrPort
        : depPort === 'NYN' || depPort === 'KAA' ? depPort
          : 'NYN';
    const obs = interpretFix(fix, now, 60, seObsPort);
    observations[v.name] = obs;

    // #421 F7: wypłynął → actual_departure_at; wiek ≤15 min; 3–10 km (preferuj ostatnią w porcie) albo poza >3 km z lastPortPosition.
    if (s.actual_departure_at == null) {
      const ageMin = (Date.parse(now) - Date.parse(fix.timestampUtc)) / 60_000;
      if (ageMin <= 15) {
        const depHub = portCoords(depPort);
        const dist = distanceKm(fix.lat, fix.lon, depHub.lat, depHub.lon);
        const moving = (fix.sogKn ?? 0) >= 3;
        const prevArr = sailings
          .filter((x) => x.vessel_id === s.vessel_id && x.id !== s.id && x.actual_arrival_at)
          .map((x) => x.actual_arrival_at!)
          .sort()
          .at(-1) ?? null;
        let depAt: string | null = null;
        if (moving && dist > 3) {
          // F7 r2: najpierw ostatnia pozycja w porcie; #446: odrzucona (null / poza oknem) → zapas tylko 3–10 km.
          if (deps.store.lastPortPosition) {
            depAt = await deps.store.lastPortPosition(v.id, depHub, 3);
          }
          if (depAt != null && !acceptActualDepartureAt(depAt, s.departure_at, nowD.getTime(), prevArr)) {
            depAt = null;
          }
          if (depAt == null && dist <= 10) depAt = fix.timestampUtc;
        }
        if (depAt && acceptActualDepartureAt(depAt, s.departure_at, nowD.getTime(), prevArr)) {
          // #446: status W_REJSIE przy actual_departure_at (ODWOLANY bez zmian — updateSailing / trigger).
          const ok = await deps.store.updateSailing(s.id, {
            actual_departure_at: depAt,
            ...(s.status === 'ODWOLANY' ? {} : { status: 'W_REJSIE' }),
          });
          if (ok) {
            s.actual_departure_at = depAt;
            if (s.status !== 'ODWOLANY') s.status = 'W_REJSIE';
            departures++;
            observations[`${v.name}:DEP`] = `WYPŁYNĄŁ_${depAt}`;
          }
        }
      }
    }
    // #421 F7 r2: dopłynął — port docelowy; wiek ≤15 min; po wypłynięciu (actual albo plan).
    if (s.actual_arrival_at == null) {
      const ageMin = (Date.parse(now) - Date.parse(fix.timestampUtc)) / 60_000;
      const arrHub = portCoords(arrPort);
      const arrived = distanceKm(fix.lat, fix.lon, arrHub.lat, arrHub.lon) <= 3 && (fix.sogKn ?? 0) < 3;
      const depRef = s.actual_departure_at ?? s.delayed_departure_at ?? s.departure_at;
      if (arrived && ageMin <= 15 && Date.parse(fix.timestampUtc) > Date.parse(depRef)) {
        // #446: status DOPLYNAL przy actual_arrival_at (ODWOLANY bez zmian).
        const ok = await deps.store.updateSailing(s.id, {
          actual_arrival_at: fix.timestampUtc,
          ...(s.status === 'ODWOLANY' ? {} : { status: 'DOPLYNAL' }),
        });
        if (ok) {
          s.actual_arrival_at = fix.timestampUtc;
          if (s.status !== 'ODWOLANY') s.status = 'DOPLYNAL';
          departures++;
          observations[`${v.name}:ARR`] = `DOPŁYNĄŁ_${fix.timestampUtc}`;
        }
      }
    }

    if (obs === 'W_PORCIE_NYNASHAMN' && s.route === 'GDN-NYN') {
      const ok = await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'INFO', title: `AIS: ${v.name} w porcie Nynäshamn — potwierdzenie przypłynięcia (informacja)`,
        titleKey: 'rk_ais_arrived', params: { vessel: v.name },
        detail: { sailing_id: s.id, statek: v.name, pozycja: [fix.lat, fix.lon], sygnal: fix.timestampUtc, zrodlo: fix.source ?? 'DIGITRAFFIC', atrybucja: DIGITRAFFIC_ATTRIBUTION },
        dedup: `AIS_NYN:${s.id}`, sourceUrl: 'https://www.digitraffic.fi/en/marine-traffic/',
      });
      if (ok) risks++;
    }
    if (obs === 'W_PORCIE_KARLSKRONA' && s.route === 'GDY-KAA') {
      const ok = await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'INFO', title: `AIS: ${v.name} w porcie Karlskrona — potwierdzenie przypłynięcia (informacja)`,
        titleKey: 'rk_ais_arrived_kaa', params: { vessel: v.name },
        detail: { sailing_id: s.id, statek: v.name, pozycja: [fix.lat, fix.lon], sygnal: fix.timestampUtc, zrodlo: fix.source ?? 'DIGITRAFFIC', atrybucja: DIGITRAFFIC_ATTRIBUTION },
        dedup: `AIS_KAA:${s.id}`, sourceUrl: 'https://www.digitraffic.fi/en/marine-traffic/',
      });
      if (ok) risks++;
    }
  }
  for (const s of upcoming) {
    const v = vessels.find((x) => x.id === s.vessel_id);
    if (!v?.mmsi || !isTrackedMmsi(v.mmsi)) continue;
    if (inProgress.some((x) => x.vessel_id === v.id)) continue;
    const fix = chosen.get(v.id);
    if (!fix) {
      observations[`${v.name}:II9`] = 'BRAK_POZYCJI_NIE_OPOZNIENIE';
      continue;
    }
    const delayMin = aisDepartureDelayMin(fix, now, s.actual_departure_at ?? s.delayed_departure_at ?? s.departure_at, s.route);
    if (delayMin == null || delayMin <= 0) continue;
    observations[`${v.name}:II9`] = `OPOZNIENIE_WYPŁYNIECIA_${delayMin}min`;
    const ok = await deps.store.raiseRisk({
      kind: 'FERRY', severity: 'MEDIUM',
      title: `AIS: możliwe opóźnienie wypłynięcia ${v.name} (~${delayMin} min)`,
      titleKey: 'rk_ais_departure_delay',
      params: { vessel: v.name, minutes: delayMin },
      detail: {
        sailing_id: s.id, statek: v.name, minutes: delayMin,
        pozycja: [fix.lat, fix.lon], sog_kn: fix.sogKn, sygnal: fix.timestampUtc,
        zrodlo: fix.source ?? 'DIGITRAFFIC', atrybucja: DIGITRAFFIC_ATTRIBUTION,
      },
      dedup: `AIS_DEP_DELAY:${s.id}`,
      sourceUrl: 'https://www.digitraffic.fi/en/marine-traffic/',
    });
    if (ok) risks++;
  }

  // Zawsze wpis w integration_runs — Stan systemu widzi ostatni przebieg (#421 F7 pkt 6).
  await deps.store.recordRun('ferry-departures', true, {
    job: 'ferry-departures', mode: 'LIVE', ok: true, departures, observations,
  });
  return { job: 'ferry-ais', mode: 'LIVE', ok: true, risks, warnings, observations, departures };
}

/** ferry-ais-listen — AIS-POLF (05.10). Nasłuch aisstream co minutę przez ~50 s (limit ścienny funkcji Edge
 *  150 s; statek przy nabrzeżu nadaje co 3 min, więc 8 s w ferry-ais prawie nigdy go nie łapało).
 *  Zapis każdej odebranej pozycji pięciu promów ze źródłem AISSTREAM. Bez filtra Q-18, obie strony. */
export const AIS_LISTEN_DEFAULT_MS = 50_000;
export function aisListenMs(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return AIS_LISTEN_DEFAULT_MS;
  return Math.min(55_000, Math.max(5_000, Math.round(n)));
}

export async function runFerryAisListen(deps: JobDeps): Promise<JobResult> {
  const vessels = await deps.store.vessels();
  const tracked = vessels.filter((v) => isTrackedMmsi(v.mmsi));
  const allow = tracked.map((v) => String(v.mmsi));
  const key = deps.env.AISSTREAM_API_KEY;
  if (!key) return { job: 'ferry-ais-listen', mode: 'DEMO', ok: true, reason: 'brak AISSTREAM_API_KEY — nic nie pobrano' };
  if (!allow.length) return { job: 'ferry-ais-listen', mode: 'LIVE', ok: true, reason: 'brak śledzonych MMSI' };
  const listenMs = aisListenMs(deps.env.AIS_LISTEN_MS);
  const stats: AisstreamStats = { opened: false, frames: 0, firstFrameMs: null, error: null };
  const observations: Record<string, string> = {};
  const warnings: string[] = [];
  let fixes: VesselFix[] = [];
  try {
    fixes = deps.collectAisstream
      ? await deps.collectAisstream(listenMs)
      : await collectAisstreamFixes(key, allow, listenMs, { stopWhenAllSeen: true, stats });
  } catch {
    warnings.push(stats.error ?? 'aisstream niedostępne');
  }
  let inserted = 0;
  for (const fix of fixes) {
    const v = tracked.find((x) => x.mmsi === fix.mmsi);
    if (!v) continue;
    await deps.store.saveVesselPosition(v.id, { ...fix, source: 'AISSTREAM' });
    inserted++;
    observations[v.name] = fix.timestampUtc;
  }
  observations.ramki = String(stats.frames);
  observations.nasluch_ms = String(listenMs);
  if (stats.firstFrameMs != null) observations.pierwsza_ramka_ms = String(stats.firstFrameMs);
  return {
    job: 'ferry-ais-listen', mode: 'LIVE', ok: warnings.length === 0, inserted, warnings, observations,
  };
}

/**
 * road-se — Trafikverket wzdłuż E4 (co 15 min).
 * II-6: RoadCondition + WeatherMeasurepoint → współczynnik korytarza i ryzyka nawierzchni/pogody.
 * H-2: Situation 1.6 (namespace road.trafficinfo) → wypadki, zamknięcia, roboty, ryzyka ROAD_SE.
 * Pusta lista sytuacji nie jest uzupełniana. Bez klucza: DEMO.
 */

async function polishRoadFreeText(deps: JobDeps, events: { title: string; detail: string; freeText?: string | null; note?: string | null }[], nowIso: string): Promise<void> {
  const key = deps.env.DEEPL_API_KEY;
  const store = deps.store;
  if (!key || !store.translationGet || !store.translationPut || !store.translationEnqueue || !store.deeplUsage || !store.deeplAddUsage) return;
  let usage = await store.deeplUsage();
  let warned = false;
  for (const e of events) {
    if (!e.freeText || e.note) continue;
    const result = await translateFreeText({
      text: e.freeText,
      source: 'SV',
      used: usage.characters,
      limit: usage.limit || DEEPL_MONTHLY_LIMIT,
      memoryGet: (hash) => store.translationGet!(hash),
      memoryPut: (hash, source, pl) => store.translationPut!(hash, source, pl, 'SV'),
      enqueue: (hash, reason) => store.translationEnqueue!(hash, e.freeText || '', 'SV', reason),
      addUsage: async (n) => { usage = { ...usage, characters: await store.deeplAddUsage!(n) }; return usage.characters; },
      deepl: (text, source) => deeplTranslate(deps.fetch, key, text, source),
    });
    if (result.pl) {
      e.note = result.pl;
      e.detail = result.pl;
      /* B9: po udanym tłumaczeniu usuń wpis z kolejki (także przy trafieniu z pamięci po wcześniejszym błędzie). */
      if (store.translationDequeue) {
        try { await store.translationDequeue(textHash(e.freeText)); }
        catch { /* błąd DELETE nie przerywa tłumaczenia dalszych zdarzeń (F7 B9) */ }
      }
    }
    const level = result.level === 'ok' ? usageLevel(result.used, result.limit) : result.level;
    if (!warned && (level === 'warn' || level === 'full')) {
      warned = true;
      await store.raiseRisk({
        kind: 'ROAD_SE', severity: level === 'full' ? 'MEDIUM' : 'LOW',
        title: level === 'full'
          ? 'Limit tłumaczeń wyczerpany — opisy z kodów, teksty czekają w kolejce'
          : 'Tłumaczenia komunikatów drogowych powyżej 80% limitu miesięcznego',
        titleKey: 'rk_deepl_usage',
        params: { used: result.used, limit: result.limit },
        detail: { zrodlo: 'DeepL', poziom: level, czas: nowIso },
        dedup: `DEEPL_USAGE:${nowIso.slice(0, 7)}:${level}`,
      });
    }
  }
}

export async function runRoadSe(deps: JobDeps): Promise<JobResult> {
  const m = integrationMode(deps.env, 'TRAFIKVERKET_API_KEY');
  if (m.mode === 'DEMO') return { job: 'road-se', mode: 'DEMO', ok: true, reason: m.reason };
  const now = deps.now().toISOString();
  const key = deps.env.TRAFIKVERKET_API_KEY!;
  const headers = { 'Content-Type': 'text/xml' };
  const [rcRes, wxRes, sitRes] = await Promise.all([
    readText(deps, TRAFIKVERKET_URL, { method: 'POST', headers, body: trafikverketRoadConditionQuery(key) }),
    readText(deps, TRAFIKVERKET_URL, { method: 'POST', headers, body: trafikverketWeatherQuery(key) }),
    readText(deps, TRAFIKVERKET_URL, { method: 'POST', headers, body: trafikverketSituationQuery(key) }),
  ]);
  const warnings: string[] = [];
  if (!rcRes.ok) warnings.push(rcRes.warning);
  if (!wxRes.ok) warnings.push(wxRes.warning);
  if (!sitRes.ok) warnings.push(sitRes.warning);
  if (!rcRes.ok && !wxRes.ok && !sitRes.ok) {
    await deps.store.raiseRisk(sourceDownRisk('TRAFIKVERKET', warnings, now, TRAFIKVERKET_URL));
    return { job: 'road-se', mode: 'LIVE', ok: false, risks: 1, warnings };
  }
  if (rcRes.ok || wxRes.ok || sitRes.ok) await deps.store.resolveRisks('SOURCE_DOWN:TRAFIKVERKET:');
  let conditions: ReturnType<typeof parseTrafikverketRoadConditions> = [];
  let weather: ReturnType<typeof parseTrafikverketWeather> = [];
  let situations: ReturnType<typeof parseTrafikverketSituations> = [];
  let situationsStatus: 'ok' | 'blad' = 'blad';
  if (rcRes.ok) {
    try { conditions = parseTrafikverketRoadConditions(JSON.parse(rcRes.text)); }
    catch { warnings.push('Trafikverket RoadCondition: nieczytelna odpowiedź'); }
  }
  if (wxRes.ok) {
    try { weather = parseTrafikverketWeather(JSON.parse(wxRes.text)); }
    catch { warnings.push('Trafikverket WeatherMeasurepoint: nieczytelna odpowiedź'); }
  }
  if (sitRes.ok) {
    try {
      const json = JSON.parse(sitRes.text) as unknown;
      const err = trafikverketResultError(json);
      if (err) warnings.push(`Trafikverket Situation: ${err}`);
      else {
        situations = parseTrafikverketSituations(json);
        situationsStatus = 'ok';
      }
    } catch { warnings.push('Trafikverket Situation: nieczytelna odpowiedź'); }
  }
  let risks = 0;
  for (const c of conditions.filter((x) => x.adverse)) {
    if (await deps.store.raiseRisk(roadConditionRisk(c))) risks++;
  }
  for (const w of weather.filter((x) => x.adverse)) {
    if (await deps.store.raiseRisk(weatherRisk(w))) risks++;
  }
  if (situationsStatus === 'ok' && deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('ROAD_SE:SIT:', situations.map((e) => `ROAD_SE:SIT:${e.id}`));
  }
  for (const e of situations) {
    for (const code of e.unknownCodes ?? []) {
      const extra = unknownCodeRiskInput(code, now.slice(0, 10));
      if (await deps.store.raiseRisk(extra)) risks++;
    }
  }
  try { await polishRoadFreeText(deps, situations, now); }
  catch { /* DeepL nie przerywa odczytu drogi */ }
  for (const e of situations) {
    const risk = roadRisk('SE', e, 'https://www.trafikverket.se/trafikinformation/');
    risk.dedup = `ROAD_SE:SIT:${e.id}`;
    if (e.note) risk.detail = { ...risk.detail, opis: e.note };
    if (await deps.store.raiseRisk(risk)) risks++;
  }
  const pct = deps.store.seSlowdownPct ? await deps.store.seSlowdownPct() : 15;
  const onRoad = (road: string | null | undefined, code: 'E4' | 'E22') =>
    typeof road === 'string' && new RegExp(`^E\\s*${code.slice(1)}$`, 'i').test(road.trim());
  const sitAll = situations.slice(0, 80).map((e) => ({
    id: e.id, kind: e.kind, severity: e.severity, title: e.title, road: e.road ?? 'E4',
    original: e.original ?? null, note: e.note ?? null,
  }));
  const slow = (rcRes.ok || wxRes.ok) ? seRoadSlowdownMult({
    conditions: conditions.filter((c) => onRoad(c.road, 'E4') || !onRoad(c.road, 'E22')),
    weather, pct,
  }) : null;
  const slow22 = (rcRes.ok || wxRes.ok) ? seRoadSlowdownMult({
    conditions: conditions.filter((c) => onRoad(c.road, 'E22')),
    weather: [], pct,
  }) : null;
  if (slow && deps.store.saveCorridorCondition) {
    await deps.store.saveCorridorCondition({
      corridor: 'SE_E4', slowdownMult: slow.mult, reason: slow.reason, observedAt: now,
      detail: {
        conditions: conditions.filter((c) => !onRoad(c.road, 'E22')).length,
        weather: weather.length,
        adverseConditions: slow.adverseConditions, adverseWeather: slow.adverseWeather,
        pct, zrodlo: 'Trafikverket RoadCondition+WeatherMeasurepoint+Situation',
        situationsStatus,
        situations: sitAll,
        drogi: ['E4', 'E22'],
      },
    });
  }
  if (slow22 && deps.store.saveCorridorCondition) {
    await deps.store.saveCorridorCondition({
      corridor: 'SE_E22', slowdownMult: slow22.mult, reason: slow22.reason, observedAt: now,
      detail: {
        conditions: conditions.filter((c) => onRoad(c.road, 'E22')).length,
        weather: 0,
        adverseConditions: slow22.adverseConditions, adverseWeather: 0,
        pct, zrodlo: 'Trafikverket E22 Karlskrona–E4',
        situationsStatus,
        situations: sitAll.filter((e) => onRoad(e.road, 'E22')),
        drogi: ['E22', 'E4'],
      },
    });
  }
  return {
    job: 'road-se', mode: 'LIVE', ok: warnings.length === 0,
    risks, warnings,
    observations: {
      conditions: String(conditions.length), weather: String(weather.length),
      situations: String(situationsStatus === 'ok' ? situations.length : 'blad'),
      slowdown: slow ? String(slow.mult) : 'bez_zmiany',
      reason: slow?.reason ?? 'norma',
    },
  };
}

/**
 * road-pl / H-2-PL — utrudnienia PL.
 * 1) HERE Traffic v7 incidents wzdłuż CORRIDOR_PL (gdy HERE_API_KEY) — 1 transakcja / przebieg, pula traffic.
 * 2) Zapas: KPD GDDKiA DATEX II (KPD_DATEX_URL + certyfikat).
 * Bez obu → DEMO (D18).
 */
export async function runRoadPl(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const hereKey = deps.env.HERE_API_KEY?.trim();
  const kpdUrl = deps.env.KPD_DATEX_URL?.trim();

  if (hereKey) {
    const spend = deps.store.hereMonthSpend ? await deps.store.hereMonthSpend() : 0;
    const budget = HERE_BILLING_DEFAULTS.budgetUsd;
    if (spend >= budget - 1e-9) {
      return {
        job: 'road-pl', mode: 'LIVE', ok: true, risks: 0, warnings: [],
        reason: 'HERE Traffic wstrzymany: budżet ponad pule wyczerpany (D-78)',
        observations: { source: 'here_traffic', skipped: 'budget_stop' },
      };
    }
    const url = buildTrafficIncidentsUrl({ apiKey: hereKey });
    const r = await readText(deps, url, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      const w = r.warning;
      await deps.store.raiseRisk(sourceDownRisk('HERE_TRAFFIC_PL', [w], now, HERE_TRAFFIC_ATTR));
      // zapas KPD gdy dostępny
      if (kpdUrl) {
        const kpd = await runRoadPlKpd(deps, now, kpdUrl);
        return { ...kpd, warnings: [...(kpd.warnings ?? []), `HERE Traffic: ${w}; użyto KPD`], observations: { ...(kpd.observations ?? {}), here: 'down' } };
      }
      return { job: 'road-pl', mode: 'LIVE', ok: false, risks: 1, warnings: [w] };
    }
    let parsed: unknown;
    try { parsed = JSON.parse(r.text); } catch {
      const w = 'HERE Traffic: odpowiedź nie-JSON';
      await deps.store.raiseRisk(sourceDownRisk('HERE_TRAFFIC_PL', [w], now, HERE_TRAFFIC_ATTR));
      return { job: 'road-pl', mode: 'LIVE', ok: false, risks: 1, warnings: [w] };
    }
    if (deps.store.noteHereUsage) await deps.store.noteHereUsage('traffic', 1);
    await deps.store.resolveRisks('SOURCE_DOWN:HERE_TRAFFIC_PL:');
    const events = parseHereTrafficIncidents(parsed);
    let risks = 0;
    const keep: string[] = [];
    for (const e of events) {
      const risk = roadRisk('PL', e, HERE_TRAFFIC_ATTR);
      risk.detail = { ...risk.detail, zrodlo: 'HERE Traffic API v7' };
      risk.dedup = `ROAD_PL:HERE:${e.id.replace(/^HERE:/, '')}`;
      keep.push(risk.dedup);
      if (await deps.store.raiseRisk(risk)) risks++;
    }
    if (deps.store.resolveStaleRisks) await deps.store.resolveStaleRisks('ROAD_PL:HERE:', keep);
    return {
      job: 'road-pl', mode: 'LIVE', ok: true, risks, warnings: [],
      observations: { source: 'here_traffic', incidents: String(events.length) },
    };
  }

  if (!kpdUrl) {
    return {
      job: 'road-pl', mode: 'DEMO', ok: true,
      reason: 'Brak HERE_API_KEY i KPD_DATEX_URL — panel oznaczony jako dane demonstracyjne (D18); H-2-PL = HERE Traffic',
    };
  }
  return runRoadPlKpd(deps, now, kpdUrl);
}

const HERE_TRAFFIC_ATTR = 'https://www.here.com/docs/bundle/traffic-api-developer-guide-v7';

async function runRoadPlKpd(deps: JobDeps, now: string, url: string): Promise<JobResult> {
  const headers: Record<string, string> = { Accept: 'application/xml' };
  if (deps.env.KPD_AUTH_HEADER) headers.Authorization = deps.env.KPD_AUTH_HEADER;
  const r = await readText(deps, url, { headers });
  if (!r.ok || !/situationRecord|d2LogicalModel|payload/i.test(r.text)) {
    const w = r.ok ? 'KPD: odpowiedź bez rekordów DATEX II (zmiana formatu?)' : r.warning;
    await deps.store.raiseRisk(sourceDownRisk('KPD_GDDKIA', [w], now, url));
    return { job: 'road-pl', mode: 'LIVE', ok: false, risks: 1, warnings: [w], observations: { source: 'kpd' } };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:KPD_GDDKIA:');
  let risks = 0;
  for (const e of parseDatexSituations(r.text)) if (await deps.store.raiseRisk(roadRisk('PL', e, 'https://kpd.gddkia.gov.pl'))) risks++;
  return { job: 'road-pl', mode: 'LIVE', ok: true, risks, warnings: [], observations: { source: 'kpd' } };
}

/** traffic-flow — TomTom wycofany (CLEAN-TT-HERE / D-28). Cron może wołać; zawsze DEMO. ETA = II-7 OSM. */
export async function runTrafficFlow(_deps: JobDeps): Promise<JobResult> {
  return {
    job: 'traffic-flow',
    mode: 'DEMO',
    ok: true,
    reason: 'DEMO: TomTom Flow wycofany (CLEAN-TT-HERE / D-28); ETA = II-7 OSM',
  };
}

/**
 * ferry-weather — II-8 FMI (główne) + DMI (zapas) + SMHI ocobs (podejście SE).
 * Okno: odejście rejsu ± 6 h; progi WAVE_M / GUST_KN (D-39). Co 1 h.
 */
export async function runFerryWeather(deps: JobDeps): Promise<JobResult> {
  const now = deps.now();
  const nowIso = now.toISOString();
  const warnings: string[] = [];
  const thr = deps.store.opsThresholds
    ? await deps.store.opsThresholds()
    : { waveM: 3.8, gustKn: 40 };
  const fromIso = new Date(now.getTime() - 3 * 3600_000).toISOString();
  const toIso = new Date(now.getTime() + 72 * 3600_000).toISOString();
  const sailings = await deps.store.sailingsSince(fromIso);
  const upcoming = sailings.filter((s) => Date.parse(s.departure_at) <= Date.parse(toIso));
  const vessels = await deps.store.vessels();
  const vesselName = (id: string) => vessels.find((v) => v.id === id)?.name ?? id;

  // Okno pobrania: od teraz −6 h do najdalszego odejścia +6 h (max 72 h)
  let fetchFrom = new Date(now.getTime() - 6 * 3600_000);
  let fetchTo = new Date(now.getTime() + 18 * 3600_000);
  for (const s of upcoming) {
    const dep = Date.parse(s.departure_at);
    fetchFrom = new Date(Math.min(fetchFrom.getTime(), dep - 6 * 3600_000));
    fetchTo = new Date(Math.max(fetchTo.getTime(), dep + 6 * 3600_000));
  }
  const fFrom = fetchFrom.toISOString();
  const fTo = fetchTo.toISOString();

  const samples: MarineSample[] = [];
  let fmiOk = 0;
  let dmiOk = 0;
  let smhiOk = 0;

  for (const code of Object.keys(MARINE_POINTS) as MarinePointCode[]) {
    const p = MARINE_POINTS[code];
    const wUrl = fmiWamUrl(p.lat, p.lon, fFrom, fTo);
    const gUrl = fmiHarmonieUrl(p.lat, p.lon, fFrom, fTo);
    const wRes = await readText(deps, wUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml' } });
    const gRes = await readText(deps, gUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml' } });
    if (wRes.ok) {
      const parsed = parseFmiTimeValuePair(wRes.text, code, 'wave');
      samples.push(...parsed);
      if (parsed.length) fmiOk++;
    } else warnings.push(`FMI WAM ${code}: ${wRes.warning}`);
    if (gRes.ok) {
      const parsed = parseFmiTimeValuePair(gRes.text, code, 'gust');
      samples.push(...parsed);
      if (parsed.length) fmiOk++;
    } else warnings.push(`FMI Harmonie ${code}: ${gRes.warning}`);

    // DMI zapas — retry 1× przy 429
    const dUrl = dmiWamUrl(p.lon, p.lat, fFrom, fTo);
    let dRes = await readText(deps, dUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/prs.coverage+json,application/json' },
    });
    if (!dRes.ok && /HTTP 429/.test(dRes.warning)) {
      dRes = await readText(deps, dUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/prs.coverage+json,application/json' },
      });
    }
    if (dRes.ok) {
      try {
        const parsed = parseDmiCoverageJson(JSON.parse(dRes.text), code);
        samples.push(...parsed);
        if (parsed.length) dmiOk++;
      } catch {
        warnings.push(`DMI ${code}: nieczytelny CoverageJSON`);
      }
    } else {
      warnings.push(`DMI ${code}: ${dRes.warning}`);
    }
  }

  const smhiRes = await readText(deps, SMHI_OCOBS_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (smhiRes.ok) {
    try {
      const parsed = parseSmhiOcobs(JSON.parse(smhiRes.text));
      samples.push(...parsed);
      if (parsed.length) smhiOk++;
    } catch {
      warnings.push('SMHI ocobs: nieczytelna odpowiedź');
    }
  } else {
    warnings.push(`SMHI ocobs: ${smhiRes.warning}`);
  }

  if (fmiOk === 0 && dmiOk === 0 && smhiOk === 0) {
    await deps.store.raiseRisk(sourceDownRisk('MARINE_WEATHER', warnings, nowIso, 'https://en.ilmatieteenlaitos.fi/open-data'));
    return { job: 'ferry-weather', mode: 'LIVE', ok: false, risks: 1, warnings };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:MARINE_WEATHER:');

  const nearTo = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const corridors = ['BALTIC_GDN_NYN', 'BALTIC_GDY_KAA'] as const;
  const evalByCorridor = new Map<string, ReturnType<typeof evaluateMarineWindow>>();
  for (const corridor of corridors) {
    const pts = new Set(marinePointsForRoute(corridor === 'BALTIC_GDY_KAA' ? 'GDY-KAA' : 'GDN-NYN'));
    const slice = samplesInWindow(samples.filter((s) => pts.has(s.point)), nowIso, nearTo);
    const ev = evaluateMarineWindow(slice.length ? slice : samples.filter((s) => pts.has(s.point)), thr.waveM, thr.gustKn);
    evalByCorridor.set(corridor, ev);
    if (deps.store.saveMarineCondition && (slice.length || ev.sources.length)) {
      await deps.store.saveMarineCondition({
        corridor,
        maxWaveM: ev.maxWaveM,
        maxGustKn: ev.maxGustKn,
        risk: ev.risk,
        waveThrM: thr.waveM,
        gustThrKn: thr.gustKn,
        sources: ev.sources.join('+'),
        attribution: ev.attribution,
        windowFrom: fFrom,
        windowTo: fTo,
        detail: {
          fmi: fmiOk, dmi: dmiOk, smhi: smhiOk,
          samples: slice.length, sailings: upcoming.length,
          warnings: warnings.slice(0, 8),
          punkty: [...pts],
        },
        observedAt: nowIso,
      });
    }
  }
  const globalEval = evalByCorridor.get('BALTIC_GDN_NYN')
    ?? evaluateMarineWindow(samples, thr.waveM, thr.gustKn);

  let risks = 0;
  const breachedIds = new Set<string>();
  for (const s of upcoming) {
    const pts = new Set(marinePointsForRoute(s.route));
    const winFrom = new Date(Date.parse(s.departure_at) - 6 * 3600_000).toISOString();
    const winTo = new Date(Date.parse(s.departure_at) + 6 * 3600_000).toISOString();
    const winSamples = samplesInWindow(samples.filter((x) => pts.has(x.point)), winFrom, winTo);
    if (!winSamples.length) continue;
    const ev = evaluateMarineWindow(winSamples, thr.waveM, thr.gustKn);
    if (!ev.breached) continue;
    breachedIds.add(s.id);
    if (await deps.store.raiseRisk(marineWeatherRisk({
      sailingId: s.id,
      vessel: vesselName(s.vessel_id),
      departureUtc: s.departure_at,
      eval: ev,
      nowIso,
      route: s.route,
    }))) risks++;
  }
  if (breachedIds.size === 0) {
    await deps.store.resolveRisks('FERRY_WEATHER:');
  }

  return {
    job: 'ferry-weather', mode: 'LIVE', ok: true, risks, warnings,
    observations: {
      wave: globalEval.maxWaveM != null ? String(globalEval.maxWaveM) : '',
      gust: globalEval.maxGustKn != null ? String(globalEval.maxGustKn) : '',
      risk: globalEval.risk,
      sources: globalEval.sources.join('+'),
      fmi: String(fmiOk), dmi: String(dmiOk), smhi: String(smhiOk),
      attribution: globalEval.attribution,
    },
  };
}


/**
 * emtrack-web / TELM-EMTRACK-WEB — odczyt pozycji naczepy (D-36 zapas).
 * Tylko odczyt WS; zero zapisu do emtrack. Wymaga flagi TELM_EMTRACK_WEB + sekretów EMTRACK_*.
 */

/**
 * H-10 (ryzyko wiatru, próg 15 m/s) + H-12 (zakazy czasowe).
 * Korekta ETA przez wiatr = etap po TELM (H-4) — tu tylko ryzyko.
 */
export async function runRouteHazards(deps: JobDeps): Promise<JobResult> {
  const nowIso = deps.now().toISOString();
  let risks = 0;
  const warnings: string[] = [];
  const loads = deps.store.listActiveLoadsForTelematics
    ? await deps.store.listActiveLoadsForTelematics()
    : [];
  for (const load of loads) {
    const loadAt = load.plannedLoadDate ?? undefined;
    const deliverAt = load.plannedDeliverDate ?? undefined;
    const plHit = loadAt && (plSundayBanHit(loadAt) || (deps.store.truckBanHolidayHit
      ? await deps.store.truckBanHolidayHit('PL', loadAt) : false));
    if (plHit && loadAt) {
      await deps.store.raiseRisk({
        kind: 'ROAD_PL', severity: 'MEDIUM',
        title: banRiskTitle('PL', loadAt.slice(0, 10)),
        titleKey: 'rk_time_ban', params: { where: 'PL', when: loadAt.slice(0, 10) },
        detail: { zrodlo: 'H-12', loadId: load.id, holiday: true },
        dedup: `TIME_BAN:PL:${load.id}:${loadAt.slice(0, 10)}`,
        sourceUrl: null, validUntil: null,
      });
      risks++;
    }
    const seHit = deliverAt && (seWeekendBanHit(deliverAt) || (deps.store.truckBanHolidayHit
      ? await deps.store.truckBanHolidayHit('SE', deliverAt) : false));
    if (seHit && deliverAt) {
      await deps.store.raiseRisk({
        kind: 'ROAD_SE', severity: 'MEDIUM',
        title: banRiskTitle('SE', deliverAt.slice(0, 10)),
        titleKey: 'rk_time_ban', params: { where: 'SE', when: deliverAt.slice(0, 10) },
        detail: { zrodlo: 'H-12', loadId: load.id, holiday: true },
        dedup: `TIME_BAN:SE:${load.id}:${deliverAt.slice(0, 10)}`,
        sourceUrl: null, validUntil: null,
      });
      risks++;
    }
  }
  // H-10: opcjonalny gust z env (test) albo z observations — bez wołania HERE gdy brak danych
  const gustEnv = deps.env.H10_TEST_GUST_MS;
  if (gustEnv != null && gustEnv !== '') {
    const g = Number(gustEnv);
    if (gustExceedsThreshold(g)) {
      await deps.store.raiseRisk({
        kind: 'WEATHER', severity: 'HIGH',
        title: windRiskTitle(g, 'korytarz (test)'),
        titleKey: 'rk_wind_gust', params: { gust: String(g), thr: String(WIND_GUST_MS_THRESHOLD) },
        detail: { zrodlo: 'H-10', gustMs: g },
        dedup: `WIND_GUST:${nowIso.slice(0, 10)}`,
        sourceUrl: null, validUntil: null,
      });
      risks++;
    }
  } else {
    warnings.push('H-10: brak żywej serii wiatru drogowego w tym przebiegu — próg 15 m/s gotowy; ETA+wiatr po TELM');
  }
  return {
    job: 'route-hazards', mode: 'LIVE', ok: true, risks,
    warnings, observations: { loads: String(loads.length), thrMs: String(WIND_GUST_MS_THRESHOLD) },
  };
}

export async function runEmtrackWeb(deps: JobDeps): Promise<JobResult> {
  const login = unquoteSecret(deps.env.EMTRACK_LOGIN ?? '');
  const password = unquoteSecret(deps.env.EMTRACK_PASSWORD ?? '');
  if (!login || !password) {
    return {
      job: 'emtrack-web', mode: 'DEMO', ok: true,
      reason: 'Brak EMTRACK_LOGIN/PASSWORD — warstwa web wyłączona (D18)',
    };
  }
  const enabled = deps.store.telmEmtrackWebEnabled ? await deps.store.telmEmtrackWebEnabled() : false;
  if (!enabled) {
    return {
      job: 'emtrack-web', mode: 'LIVE', ok: true,
      reason: 'Flaga TELM_EMTRACK_WEB wyłączona — bez zapisu pozycji',
      observations: { flag: 'false' },
    };
  }

  const secretFp = emtrackSecretFp(login, password);
  const prevLogin = deps.store.emtrackLoginState ? await deps.store.emtrackLoginState() : null;
  let loginState = emtrackLoginFresh(prevLogin, secretFp);
  if (emtrackLoginSkipped(loginState, deps.now())) {
    return {
      job: 'emtrack-web', mode: 'LIVE', ok: false,
      reason: `Logowanie wstrzymane do ${loginState.skippedUntil} — po trzech odmowach jedna próba na 6 h`,
      observations: {
        skipped: 'true',
        skipped_until: loginState.skippedUntil ?? '',
        next_try_at: emtrackNextTryAt(loginState) ?? '',
      },
    };
  }

  let version = '';
  const verRes = await readText(deps, 'https://emtrack.eu/app/', { headers: { 'User-Agent': EMTRACK_UA } });
  if (verRes.ok) {
    const m = verRes.text.match(/<meta\s+name=["']version["']\s+content=["']([^"']+)["']/i);
    version = m?.[1] ?? '';
  }
  const expected = deps.env.EMTRACK_EXPECTED_VERSION?.trim() || EMTRACK_EXPECTED_VERSION;
  // #374: inna wersja meta ≠ awaria — SOURCE_DOWN tylko przy nieudanym logowaniu / pobraniu.
  const versionMismatch = version && version !== expected ? `${version}≠${expected}` : '';

  let objects: Awaited<ReturnType<typeof fetchTrackingObjectsReadOnly>>['objects'] = [];
  let sentLog: Awaited<ReturnType<typeof fetchTrackingObjectsReadOnly>>['sentLog'] = [];
  let loginFrames: Awaited<ReturnType<typeof fetchTrackingObjectsReadOnly>>['loginFrames'] = [];
  let loginOk = false;
  const loginObs = () => ({
    sentTypes: sentLog.map((s) => s.type).join(','),
    login_types: loginFrames.map((f) => f.type).join(','),
    ...(loginFrames.some((f) => f.waitSec != null)
      ? { login_wait_sec: String(loginFrames.find((f) => f.waitSec != null)?.waitSec) }
      : {}),
    ...(loginFrames.find((f) => f.code != null)
      ? { login_code: String(loginFrames.find((f) => f.code != null)?.code) }
      : {}),
  });
  try {
    const r = await fetchTrackingObjectsReadOnly({
      login,
      password,
      auth: (deps.env.EMTRACK_AUTH_TYPE as 'INTERNAL' | 'DIRECT' | undefined) ?? 'INTERNAL',
      WebSocketImpl: deps.WebSocketImpl,
      ...(deps.env.EMTRACK_WS_TIMEOUT_MS
        ? { timeoutMs: Number(deps.env.EMTRACK_WS_TIMEOUT_MS) }
        : {}),
    });
    objects = r.objects;
    sentLog = r.sentLog;
    loginFrames = r.loginFrames;
    loginOk = r.loginOk;
  } catch (e) {
    const w = e instanceof Error ? e.message : String(e);
    if (deps.store.saveEmtrackLoginState && loginState.secretFp !== (prevLogin?.secretFp ?? null)) {
      await deps.store.saveEmtrackLoginState(loginState);
    }
    await deps.store.raiseRisk(sourceDownRisk('EMTRACK_WEB', [w], deps.now().toISOString(), 'https://emtrack.eu/app/'));
    return {
      job: 'emtrack-web', mode: 'LIVE', ok: false, risks: 1, warnings: [w],
      observations: {
        ...loginObs(),
        fail_streak: String(loginState.failStreak),
        ...(versionMismatch ? { version_mismatch: versionMismatch } : {}),
      },
    };
  }
  if (!loginOk) {
    loginState = emtrackLoginFail(loginState, deps.now());
    if (deps.store.saveEmtrackLoginState) await deps.store.saveEmtrackLoginState(loginState);
    await deps.store.raiseRisk(sourceDownRisk('EMTRACK_WEB', ['login_failed'], deps.now().toISOString(), 'https://emtrack.eu/app/'));
    return {
      job: 'emtrack-web', mode: 'LIVE', ok: false, risks: 1, warnings: ['login_failed'],
      observations: {
        ...loginObs(),
        fail_streak: String(loginState.failStreak),
        ...(versionMismatch ? { version_mismatch: versionMismatch } : {}),
      },
    };
  }
  loginState = emtrackLoginOk(loginState);
  if (deps.store.saveEmtrackLoginState) await deps.store.saveEmtrackLoginState(loginState);
  await deps.store.resolveRisks('SOURCE_DOWN:EMTRACK_WEB');

  const loads = deps.store.listActiveLoadsForTelematics ? await deps.store.listActiveLoadsForTelematics() : [];
  const moveSec = Number(deps.env.TELM_WEB_MOVE_SEC ?? 120);
  const stopSec = Number(deps.env.TELM_WEB_STOP_SEC ?? 900);
  let written = 0;
  let matched = 0;
  let orphans = 0;
  let phaseInferred = 0;
  let skippedInterval = 0;
  let ambiguousTrailer = 0;
  const trailers = objects.filter((o) => String(o.type).toUpperCase() === 'TRAILER');
  for (const fix of trailers) {
    if (fix.lat == null || fix.lon == null || !fix.observedAt) continue;
    const amb = ambiguousMatchCount(fix, loads);
    if (amb > ambiguousTrailer) ambiguousTrailer = amb;
    const load = matchFixToLoad(fix, loads);
    const raw = {
      provider: 'EMTRACK_WEB',
      trackingObjectId: fix.trackingObjectId,
      textId: fix.textId,
      name: fix.name,
      type: fix.type,
      sentFrameTypes: sentLog.map((s) => s.type),
    };
    // Bez awizacji: zapisz pozycję sieroty, ZERO alarmów / powiadomień (decyzja 05.10).
    if (!load) {
      if (deps.store.saveOrphanPosition) {
        await deps.store.saveOrphanPosition({
          plate: fix.textId || String(fix.trackingObjectId),
          trackingObjectId: String(fix.trackingObjectId),
          lat: fix.lat, lon: fix.lon, ts: fix.observedAt,
          source: 'EMTRACK_WEB',
          speed: fix.speedKmh, heading: fix.headingDeg, ignition: fix.ignition, raw,
        });
        orphans++;
      }
      continue;
    }
    matched++;
    const last = deps.store.lastPositionAt ? await deps.store.lastPositionAt(load.id, 'EMTRACK_WEB') : null;
    const needSec = pollIntervalSec(fix, moveSec, stopSec);
    if (last) {
      const ageSec = (deps.now().getTime() - Date.parse(last)) / 1000;
      if (ageSec < needSec - 5) {
        skippedInterval++;
        continue;
      }
    }
    if (deps.store.processPosition) {
      await deps.store.processPosition({
        loadId: load.id,
        lat: fix.lat,
        lon: fix.lon,
        ts: fix.observedAt,
        source: 'EMTRACK_WEB',
        speed: fix.speedKmh,
        heading: fix.headingDeg,
        ignition: fix.ignition,
        raw,
      });
      written++;
    }
    if (deps.store.inferPhaseFromPosition) {
      const phase = await deps.store.inferPhaseFromPosition(load.id, fix.lat, fix.lon, fix.observedAt);
      if (phase) phaseInferred++;
    }
  }

  let orphanAlerts = 0;
  if (deps.store.scanOrphanTrailerAlerts) {
    try {
      orphanAlerts = await deps.store.scanOrphanTrailerAlerts();
    } catch (e) {
      orphanAlerts = -1;
      // #622 F7: komunikat błędu skanu (nie tylko -1)
      const msg = e instanceof Error ? e.message : String(e);
      console.error('telm_scan_orphan_trailer_alerts:', msg);
    }
  }

  return {
    job: 'emtrack-web', mode: 'LIVE', ok: true,
    observations: {
      version,
      objects: String(objects.length),
      trailers: String(trailers.length),
      matched: String(matched),
      orphans: String(orphans),
      written: String(written),
      phaseInferred: String(phaseInferred),
      skippedInterval: String(skippedInterval),
      ambiguous_trailer: String(ambiguousTrailer),
      orphan_alerts: String(orphanAlerts),
      ...loginObs(),
      ...(versionMismatch ? { version_mismatch: versionMismatch } : {}),
    },
  };
}

/**
 * E44 — odczyt pozycji z linku RIO (podwykonawca SCX).
 * Cron `tower-rio-links` co 2 min. Job w integration_runs: `rio-links`.
 * Secret nigdy w observations / warnings / URL.
 */
export async function runRioLinks(deps: JobDeps): Promise<JobResult> {
  const started = deps.now().getTime();
  const nowIso = new Date(started).toISOString();

  const enabled = deps.store.telmRioLinksEnabled
    ? await deps.store.telmRioLinksEnabled()
    : true;
  if (!enabled) {
    return {
      job: 'rio-links', mode: 'LIVE', ok: true,
      disabled: true,
      reason: 'Flaga TELM_RIO_LINKS wyłączona — bez zapisu pozycji',
      observations: { flag: 'false', links: '0', disabled: 'true' },
    };
  }

  const lockToken = crypto.randomUUID();
  if (deps.store.rioLinksLockTry) {
    const got = await deps.store.rioLinksLockTry(90, lockToken);
    if (!got) {
      return {
        job: 'rio-links', mode: 'LIVE', ok: true,
        reason: 'Nakładający się przebieg rio-links — pominięto',
        observations: { links: '0', overlap: '1' },
      };
    }
  }

  try {
    const loads = deps.store.listRioLoadsForPoll ? await deps.store.listRioLoadsForPoll() : [];
    let queried = 0;
    let written = 0;
    let skippedWindow = 0;
    let skippedValidity = 0;
    let skippedDup = 0;
    let skippedRecheck = 0;
    let invalid = 0;
    let down = 0;
    let hardDown = 0;
    let noPosition = 0;
    let pendingOk = 0;
    let sourceFailStreak = 0;
    let anyHardStreakGe3 = false;
    let netFails = 0;
    let abortedBudget = false;
    let abortedNet = false;
    const warnings: string[] = [];
    let risks = 0;

    const applyPatch = async (load: RioLoadRow, patch: RioLoadPatch) => {
      if (!deps.store.updateRioLoadState) return;
      const meaningful = rioPatchChanged(load, patch);
      // Samo rio_check_at: odświeżaj najwyżej co 30 min (F7 r3).
      if (!meaningful) {
        if (patch.rio_check_at == null || rioCheckedRecently(load, started)) return;
      }
      await deps.store.updateRioLoadState(load.id, patch);
      Object.assign(load, patch);
    };

    for (const load of loads) {
      if (deps.now().getTime() - started > RIO_BUDGET_MS) {
        abortedBudget = true;
        break;
      }
      if (netFails >= RIO_NET_ABORT_AFTER) {
        abortedNet = true;
        break;
      }

      const pending = load.rio_check_state === 'pending' || load.rio_check_state == null;
      const matchRow = {
        id: load.id,
        trailer_plate: load.trailer_plate,
        telematics_vehicle_id: load.telematics_vehicle_id ?? `rio:${load.rio_tracking_id}`,
        status: load.status,
        plannedLoadDate: load.plannedLoadDate,
        trackingOpenedAt: load.trackingOpenedAt,
      };
      const inWindow = loadInTrackingWindow(matchRow, nowIso);
      const linkValid = rioLinkValidNow(nowIso, load.rio_valid_from, load.rio_valid_to);
      const wasInvalid = load.rio_check_state === 'invalid';
      const wasDown = load.rio_check_state === 'down';
      const wasExpired = !pending && !wasInvalid && !linkValid
        && (load.rio_valid_from != null || load.rio_valid_to != null);

      if (!pending && !inWindow && !wasInvalid && !wasExpired) {
        skippedWindow++;
        continue;
      }

      // Wygasły / invalid: ponów co 30 min (podwykonawca mógł przedłużyć end).
      if (!pending && (wasExpired || wasInvalid)) {
        if (rioCheckedRecently(load, started)) {
          skippedRecheck++;
          continue;
        }
      } else if (!pending && !linkValid) {
        skippedValidity++;
        continue;
      }

      queried++;
      const res = await fetchRioPosition({
        trackingId: load.rio_tracking_id,
        secret: load.rio_secret,
        fetchImpl: deps.fetch,
        nowMs: started,
      });

      if (!res.ok) {
        if (res.kind === 'invalid') {
          invalid++;
          await applyPatch(load, {
            rio_check_state: 'invalid',
            rio_check_at: nowIso,
            rio_error_streak: 0,
          });
          if (await deps.store.raiseRisk({
            kind: 'RESOURCE_MISSING',
            severity: 'HIGH',
            title: 'Link RIO nieprawidłowy',
            titleKey: 'rk_rio_invalid',
            params: {},
            detail: {
              zrodlo: 'RIO', loadId: load.id, status: res.status,
              url: rioPositionUrlSafe(load.rio_tracking_id),
            },
            dedup: `RIO_INVALID:${load.id}`,
            sourceUrl: rioPositionUrlSafe(load.rio_tracking_id),
            loadId: load.id,
          })) risks++;
          continue;
        }
        // #453: 200 JSON bez pozycji → sprawa transportu (SCX+HHL), nie SOURCE_DOWN.
        // F7 #456 P2: sprawa HIGH dopiero od 3. kolejnego no_position (~6 min), jak streak przy down.
        if (res.kind === 'no_position') {
          down++;
          noPosition++;
          const streak = (load.rio_error_streak ?? 0) + 1;
          await applyPatch(load, {
            rio_check_state: 'down',
            rio_check_at: nowIso,
            rio_error_streak: streak,
          });
          warnings.push(res.warning);
          if (streak >= 3) {
            if (await deps.store.raiseRisk({
              kind: 'RESOURCE_MISSING',
              severity: 'HIGH',
              title: 'Link RIO nie zwraca pozycji — sprawdź udostępnianie w RIO / czy pojazd nadaje',
              titleKey: 'rk_rio_no_position',
              params: {},
              detail: {
                zrodlo: 'RIO', loadId: load.id, status: res.status,
                url: rioPositionUrlSafe(load.rio_tracking_id),
                warning: res.warning,
                streak,
              },
              dedup: `RIO_NO_POSITION:${load.id}`,
              sourceUrl: rioPositionUrlSafe(load.rio_tracking_id),
              loadId: load.id,
            })) risks++;
          }
          continue;
        }
        // sieć / 5xx — liczy się do awarii źródła dopiero gdy wszystkie linki tak padną (#453).
        down++;
        hardDown++;
        netFails++;
        const streak = (load.rio_error_streak ?? 0) + 1;
        if (streak > sourceFailStreak) sourceFailStreak = streak;
        if (streak >= 3) anyHardStreakGe3 = true;
        // ok → down zawsze ustawia 'down' (F7 r3).
        await applyPatch(load, {
          rio_check_state: 'down',
          rio_check_at: nowIso,
          rio_error_streak: streak,
        });
        warnings.push(res.warning);
        continue;
      }

      const wasUnknownAsset = load.rio_tracker_on === 'NIEZNANY';
      const trackerOn = inferRioTrackerOn(res.assetName, {
        trailer: load.trailer_plate,
        tractorPl: load.tractor_plate,
        tractorSe: load.tractor_delivery_plate,
      });
      await applyPatch(load, {
        rio_check_state: 'ok',
        rio_check_at: nowIso,
        rio_asset_name: res.assetName,
        rio_tracker_on: trackerOn,
        rio_valid_from: res.validFrom,
        rio_valid_to: res.validTo,
        rio_last_fix_at: res.observedAt,
        rio_error_streak: 0,
      });
      if (pending) pendingOk++;
      // resolveRisks tylko przy przejściu ze stanu invalid / wygasłego / down (F7 r3; F7 #456 D).
      if (wasInvalid) await deps.store.resolveRisks(`RIO_INVALID:${load.id}`);
      if (wasExpired) await deps.store.resolveRisks(`RIO_EXPIRED:${load.id}`);
      if (wasDown) await deps.store.resolveRisks(`RIO_NO_POSITION:${load.id}`);

      if (!rioLinkValidNow(nowIso, res.validFrom, res.validTo)) {
        skippedValidity++;
        if (await deps.store.raiseRisk({
          kind: 'RESOURCE_MISSING',
          severity: 'HIGH',
          title: 'Link RIO wygasł',
          titleKey: 'rk_rio_expired',
          params: {},
          detail: {
            zrodlo: 'RIO', loadId: load.id,
            validTo: res.validTo,
            url: rioPositionUrlSafe(load.rio_tracking_id),
          },
          dedup: `RIO_EXPIRED:${load.id}`,
          sourceUrl: rioPositionUrlSafe(load.rio_tracking_id),
          loadId: load.id,
        })) risks++;
        continue;
      }

      if (trackerOn === 'NIEZNANY' && res.assetName) {
        if (await deps.store.raiseRisk({
          kind: 'RESOURCE_MISSING',
          severity: 'MEDIUM',
          title: `Link RIO dotyczy pojazdu ${res.assetName}, którego nie ma w awizacji`,
          titleKey: 'rk_rio_unknown_asset',
          params: { asset: res.assetName },
          detail: { zrodlo: 'RIO', loadId: load.id, asset: res.assetName },
          dedup: `RIO_UNKNOWN_ASSET:${load.id}`,
          sourceUrl: rioPositionUrlSafe(load.rio_tracking_id),
          loadId: load.id,
        })) risks++;
      } else if (wasUnknownAsset && trackerOn !== 'NIEZNANY') {
        // #446: resolveRisks RIO_UNKNOWN_ASSET tylko NIEZNANY → znany (nie przy każdym przebiegu).
        await deps.store.resolveRisks(`RIO_UNKNOWN_ASSET:${load.id}`);
      }

      // Poza oknem E27 — tylko zapytanie testowe (pending) / recheck, bez zapisu pozycji.
      if (!inWindow) {
        if (pending) { /* pending check poza oknem — OK */ }
        else skippedWindow++;
        continue;
      }

      const prevFix = deps.store.lastPositionFix
        ? await deps.store.lastPositionFix(load.id, 'SUBCONTRACTOR_LINK')
        : null;
      if (prevFix && Date.parse(prevFix.ts) >= Date.parse(res.observedAt)) {
        skippedDup++;
        continue;
      }
      const speed = speedKmhFromPrev(prevFix, { lat: res.lat, lon: res.lon, ts: res.observedAt });

      if (deps.store.processPosition) {
        await deps.store.processPosition({
          loadId: load.id,
          lat: res.lat,
          lon: res.lon,
          ts: res.observedAt,
          source: 'SUBCONTRACTOR_LINK',
          speed,
          heading: null,
          ignition: null,
          raw: {
            provider: 'RIO',
            trackingId: load.rio_tracking_id,
            asset_name: res.assetName,
            name: res.name,
            url: rioPositionUrlSafe(load.rio_tracking_id),
          },
        });
        written++;
      }
      if (deps.store.inferPhaseFromPosition) {
        await deps.store.inferPhaseFromPosition(load.id, res.lat, res.lon, res.observedAt);
      }
    }

    // #453: SOURCE_DOWN tylko gdy żaden link nie odpowiada (sieć/5xx dla wszystkich) albo abortedNet.
    const allHardDown = queried > 0 && hardDown === queried;
    const sourceDown = abortedNet || (allHardDown && anyHardStreakGe3);
    if (sourceDown) {
      if (await deps.store.raiseRisk(sourceDownRisk(
        'RIO',
        warnings.slice(-5),
        nowIso,
      ))) risks++;
    } else if (!abortedBudget) {
      // Także zamyka fałszywy SOURCE_DOWN gdy choć jeden link zapisuje pozycję (SG-19).
      await deps.store.resolveRisks('SOURCE_DOWN:RIO');
    }

    return {
      job: 'rio-links',
      mode: 'LIVE',
      ok: !sourceDown,
      risks,
      warnings: warnings.slice(0, 20),
      observations: {
        candidates: String(loads.length),
        links: String(loads.length),
        queried: String(queried),
        written: String(written),
        pending_ok: String(pendingOk),
        invalid: String(invalid),
        down: String(down),
        hard_down: String(hardDown),
        no_position: String(noPosition),
        skipped_window: String(skippedWindow),
        skipped_validity: String(skippedValidity),
        skipped_recheck: String(skippedRecheck),
        skipped_dup: String(skippedDup),
        fail_streak_max: String(sourceFailStreak),
        aborted_budget: abortedBudget ? '1' : '0',
        aborted_net: abortedNet ? '1' : '0',
      },
    };
  } finally {
    if (deps.store.rioLinksLockRelease) {
      await deps.store.rioLinksLockRelease(lockToken);
    }
  }
}

/**
 * #662 — odczyt pozycji z linku tymczasowego SafeFleet.
 * Cron `tower-safefleet-poll` co 2 min. Job: `safefleet-poll`. Token nigdy w logach (tylko 6 znaków).
 */
export async function runSafefleetPoll(deps: JobDeps): Promise<JobResult> {
  const started = deps.now().getTime();
  const nowIso = new Date(started).toISOString();

  const enabled = deps.store.telmSafefleetPollEnabled
    ? await deps.store.telmSafefleetPollEnabled()
    : true;
  if (!enabled) {
    return {
      job: 'safefleet-poll', mode: 'LIVE', ok: true,
      disabled: true,
      reason: 'Flaga TELM_SAFEFLEET_POLL wyłączona — bez zapisu pozycji',
      observations: { flag: 'false', links: '0', disabled: 'true' },
    };
  }

  const lockToken = crypto.randomUUID();
  if (deps.store.safefleetPollLockTry) {
    const got = await deps.store.safefleetPollLockTry(90, lockToken);
    if (!got) {
      return {
        job: 'safefleet-poll', mode: 'LIVE', ok: true,
        reason: 'Nakładający się przebieg safefleet-poll — pominięto',
        observations: { links: '0', overlap: '1' },
      };
    }
  }

  try {
    const loads = deps.store.listSafefleetLoadsForPoll
      ? await deps.store.listSafefleetLoadsForPoll()
      : [];
    let queried = 0;
    let written = 0;
    let skippedWindow = 0;
    let skippedDup = 0;
    let invalid = 0;
    let down = 0;
    let noPosition = 0;
    let trajectory = 0;
    const warnings: string[] = [];
    let risks = 0;

    for (const load of loads) {
      if (deps.now().getTime() - started > 40_000) break;

      const matchRow = {
        id: load.id,
        trailer_plate: null as string | null,
        telematics_vehicle_id: load.telematics_vehicle_id ?? `safefleet:${load.safefleet_token.slice(-6)}`,
        status: load.status,
        plannedLoadDate: load.plannedLoadDate,
        trackingOpenedAt: load.trackingOpenedAt,
      };
      const inWindow = loadInTrackingWindow(matchRow, nowIso);
      if (!inWindow) {
        skippedWindow++;
        continue;
      }

      queried++;
      const safeUrl = safefleetUrlSafe(load.safefleet_token);
      const res = await fetchSafefleetPosition({
        token: load.safefleet_token,
        fetchImpl: deps.fetch,
        nowMs: started,
      });

      const apply = async (patch: SafefleetLoadPatch) => {
        if (!deps.store.updateSafefleetLoadState) return;
        await deps.store.updateSafefleetLoadState(load.id, patch);
        Object.assign(load, patch);
      };

      if (!res.ok) {
        const streak = (load.safefleet_error_streak ?? 0) + 1;
        const kind = res.kind;
        if (kind === 'invalid') {
          invalid++;
          await apply({
            safefleet_check_state: 'invalid',
            safefleet_check_at: nowIso,
            safefleet_error_streak: streak,
          });
        } else if (kind === 'no_position') {
          noPosition++;
          down++;
          await apply({
            safefleet_check_state: 'down',
            safefleet_check_at: nowIso,
            safefleet_error_streak: streak,
          });
        } else {
          down++;
          await apply({
            safefleet_check_state: 'down',
            safefleet_check_at: nowIso,
            safefleet_error_streak: streak,
          });
        }
        warnings.push(scrubSafefleetToken(res.warning));
        // ≥3 kolejne błędy (invalid / error / pusty) → ryzyko HHL+SCX (dedup).
        if (streak >= 3) {
          if (await deps.store.raiseRisk({
            kind: 'RESOURCE_MISSING',
            severity: 'HIGH',
            title: 'Link SafeFleet nie działa / wygasł',
            titleKey: 'rk_safefleet_dead',
            params: {},
            detail: {
              zrodlo: 'SAFEFLEET', loadId: load.id, status: res.status,
              url: safeUrl, warning: scrubSafefleetToken(res.warning), streak,
            },
            dedup: `SAFEFLEET_DEAD:${load.id}`,
            sourceUrl: safeUrl,
            loadId: load.id,
          })) risks++;
        }
        continue;
      }

      const wasBad = load.safefleet_check_state === 'invalid' || load.safefleet_check_state === 'down';
      await apply({
        safefleet_check_state: 'ok',
        safefleet_check_at: nowIso,
        safefleet_last_fix_at: res.observedAt,
        safefleet_error_streak: 0,
      });
      if (wasBad) await deps.store.resolveRisks(`SAFEFLEET_DEAD:${load.id}`);

      // Opcjonalnie raz: trajectory → presences w oknie (bez duplikatów po ts).
      if (!load.safefleet_trajectory_done && deps.store.processPosition) {
        const points = await fetchSafefleetTrajectory({
          token: load.safefleet_token,
          fetchImpl: deps.fetch,
          nowMs: started,
        });
        for (const p of points) {
          if (!loadInTrackingWindow(matchRow, p.ts)) continue;
          const prev = deps.store.lastPositionFix
            ? await deps.store.lastPositionFix(load.id, 'SAFEFLEET')
            : null;
          if (prev && Date.parse(prev.ts) >= Date.parse(p.ts)) continue;
          await deps.store.processPosition({
            loadId: load.id,
            lat: p.lat,
            lon: p.lon,
            ts: p.ts,
            source: 'SAFEFLEET',
            speed: null,
            heading: null,
            ignition: null,
            raw: { provider: 'SAFEFLEET', url: safeUrl, trajectory: true },
          });
          trajectory++;
        }
        await apply({ safefleet_trajectory_done: true });
      }

      const prevFix = deps.store.lastPositionFix
        ? await deps.store.lastPositionFix(load.id, 'SAFEFLEET')
        : null;
      if (prevFix && Date.parse(prevFix.ts) >= Date.parse(res.observedAt)) {
        skippedDup++;
        continue;
      }

      if (deps.store.processPosition) {
        await deps.store.processPosition({
          loadId: load.id,
          lat: res.lat,
          lon: res.lon,
          ts: res.observedAt,
          source: 'SAFEFLEET',
          speed: res.speedKmh,
          heading: res.heading,
          ignition: res.ignition,
          raw: {
            provider: 'SAFEFLEET',
            url: safeUrl,
            licensePlate: res.licensePlate,
          },
        });
        written++;
      }
      if (deps.store.inferPhaseFromPosition) {
        await deps.store.inferPhaseFromPosition(load.id, res.lat, res.lon, res.observedAt);
      }
    }

    // Spec #662 pkt 5 / F7 #662-b: błąd down/invalid w przebiegu → integration_runs.ok=false.
    const hadFault = invalid > 0 || down > 0;
    return {
      job: 'safefleet-poll',
      mode: 'LIVE',
      ok: !hadFault,
      risks,
      warnings: warnings.slice(0, 20),
      observations: {
        candidates: String(loads.length),
        links: String(loads.length),
        queried: String(queried),
        written: String(written),
        trajectory: String(trajectory),
        invalid: String(invalid),
        down: String(down),
        no_position: String(noPosition),
        skipped_window: String(skippedWindow),
        skipped_dup: String(skippedDup),
      },
    };
  } finally {
    if (deps.store.safefleetPollLockRelease) {
      await deps.store.safefleetPollLockRelease(lockToken);
    }
  }
}

/**
 * B9 — ponowienie translation_queue (blad/brak; limit: nowy miesiąc = nowy wiersz deepl_usage).
 * Po sukcesie: pamięć + opis ryzyka + usunięcie z kolejki + zamknięcie TRANSLATE_WAIT.
 * Wpisy >15 min (poza odrzucone) → ryzyko ROAD_SE / rk_translate_wait (per hash).
 * Alarm kolejki także bez DEEPL_API_KEY (wpisy „brak”).
 */
export async function runTranslateRetry(deps: JobDeps): Promise<JobResult> {
  const key = deps.env.DEEPL_API_KEY;
  const store = deps.store;
  const now = deps.now();
  const nowIso = now.toISOString();
  let risks = 0;
  let usageChars = 0;
  let usageLimit = DEEPL_MONTHLY_LIMIT;
  if (store.deeplUsage) {
    const u = await store.deeplUsage();
    usageChars = u.characters;
    usageLimit = u.limit || DEEPL_MONTHLY_LIMIT;
  }
  const raiseStale = async (rows: { hash: string; reason: string; createdAt: string }[]) => {
    for (const row of rows) {
      const ageMin = (now.getTime() - Date.parse(row.createdAt)) / 60000;
      if (!(ageMin > 15) || row.reason === 'odrzucone') continue;
      if (await store.raiseRisk({
        kind: 'ROAD_SE', severity: 'LOW',
        title: 'Komunikat drogowy czeka na tłumaczenie',
        titleKey: 'rk_translate_wait',
        params: { used: usageChars, limit: usageLimit },
        detail: { zrodlo: 'DeepL', powód: 'kolejka>15min', hash: row.hash, czas: nowIso },
        dedup: `ROAD_SE:TRANSLATE_WAIT:${row.hash}`,
      })) risks++;
    }
  };

  if (!store.translationListQueue) {
    return { job: 'translate-retry', mode: 'LIVE', ok: true, reason: 'Brak magazynu kolejki tłumaczeń — pominięto' };
  }
  const rows = await store.translationListQueue(['blad', 'brak', 'limit']);
  await raiseStale(rows);

  if (!key || !store.translationGet || !store.translationPut
    || !store.translationEnqueue || !store.translationDequeue || !store.deeplUsage || !store.deeplAddUsage) {
    return {
      job: 'translate-retry', mode: 'LIVE', ok: true, risks,
      reason: 'Brak DeepL / magazynu tłumaczeń — pominięto (alarm kolejki OK)',
    };
  }

  let usage = await store.deeplUsage();
  usageChars = usage.characters;
  usageLimit = usage.limit || DEEPL_MONTHLY_LIMIT;
  let done = 0;
  for (const row of rows) {
    /* Nowy miesiąc = nowy wiersz deepl_usage (F7: bez !isFirstDay). */
    if (row.reason === 'limit' && usage.characters >= usage.limit) continue;
    const result = await translateFreeText({
      text: row.source,
      source: row.lang,
      used: usage.characters,
      limit: usage.limit || DEEPL_MONTHLY_LIMIT,
      memoryGet: (hash) => store.translationGet!(hash),
      memoryPut: (hash, source, pl) => store.translationPut!(hash, source, pl, row.lang),
      enqueue: (hash, reason) => store.translationEnqueue!(hash, row.source, row.lang, reason),
      addUsage: async (n) => { usage = { ...usage, characters: await store.deeplAddUsage!(n) }; return usage.characters; },
      deepl: (text, source) => deeplTranslate(deps.fetch, key, text, source),
    });
    if (!result.pl) continue;
    try { await store.translationDequeue(row.hash); }
    catch { /* nie przerywaj dalszych wpisów */ }
    if (store.patchRoadRiskOpis) await store.patchRoadRiskOpis(row.source, result.pl);
    await store.resolveRisks(`ROAD_SE:TRANSLATE_WAIT:${row.hash}`);
    done++;
  }
  return {
    job: 'translate-retry', mode: 'LIVE', ok: true,
    updated: done, risks,
    reason: done ? `Ponowiono ${done} tłumaczeń` : 'Kolejka bez udanych ponowień',
  };
}

export const JOBS = {
  'ferry-schedule': runFerrySchedule, 'ferry-status': runFerryStatus, 'ferry-ais': runFerryAis,
  'ferry-ais-listen': runFerryAisListen,
  'ferry-portnet': runFerryPortnet,
  'ferry-weather': runFerryWeather,
  'road-se': runRoadSe, 'road-pl': runRoadPl, 'traffic-flow': runTrafficFlow,
  'emtrack-web': runEmtrackWeb,
  'rio-links': runRioLinks,
  'safefleet-poll': runSafefleetPoll,
  'route-hazards': runRouteHazards,
  'translate-retry': runTranslateRetry,
} as const;
export type JobName = keyof typeof JOBS;

/** Minimalny odstęp między przebiegami [min] — ferry-status: co 15 min, nie częściej (ZRODLA_DANYCH §1.1). */
export const MIN_INTERVAL_MIN: Record<JobName, number> = {
  'ferry-schedule': 60, 'ferry-status': 10, 'ferry-ais': 3, 'ferry-ais-listen': 0,
  'ferry-portnet': 15, 'ferry-weather': 60,
  'road-se': 15, 'road-pl': 10, 'traffic-flow': 15, 'emtrack-web': 2, 'rio-links': 2,
  'safefleet-poll': 2, 'route-hazards': 60,
  'translate-retry': 5,
};

/** Przebieg zadania z kontrolą częstotliwości i zapisem do dziennika (integration_runs). */
export async function runJob(name: JobName, deps: JobDeps): Promise<JobResult & { skipped?: boolean }> {
  const last = await deps.store.lastRun(name);
  const gapMin = last ? (deps.now().getTime() - Date.parse(last)) / 60000 : Infinity;
  // 1 min luzu na niedokładność harmonogramu pg_cron
  if (gapMin < MIN_INTERVAL_MIN[name] - 1) {
    return { job: name, mode: 'LIVE', ok: true, skipped: true, reason: `Poprzedni odczyt ${Math.round(gapMin)} min temu — limit co ${MIN_INTERVAL_MIN[name]} min` };
  }
  let res: JobResult;
  try { res = await JOBS[name](deps); } catch (e) {
    res = { job: name, mode: 'LIVE', ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
  await deps.store.recordRun(name, res.ok, res);
  return res;
}
