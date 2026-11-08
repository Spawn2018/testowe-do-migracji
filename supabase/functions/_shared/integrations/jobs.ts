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
  DIGITRAFFIC_ATTRIBUTION, interpretRouteFix, parseDigitrafficLocations, aisDepartureDelayMin,
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
  DIGITRAFFIC_PORT_CALLS_URL, DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX, DIGITRAFFIC_USER,
  digitrafficPortCallSourceRef, digitrafficPortCallsUrl, parseDigitrafficPortCalls,
  vikingScheduleFromDigitrafficPortCalls, VIKING_DIGITRAFFIC_HORIZON_DAYS, VIKING_XPRS_MMSI,
} from '../ferry/digitrafficPortCalls.ts';
export { DIGITRAFFIC_USER };
import {
  FERRY_ICE_ATTRIBUTION, WINTER_NAV_LOCATIONS_URL,
  ferryIceRisk, ibnetRestrictionStrictness, isWinterNavWindowActiveOnSailingDay,
  isPortCallV2Reissued, matchPortCallV2CancelledFleet, parseIbnetRestriction, parsePortCallV2Visits,
  parseWinterNavigationLocations, portCallV2ActiveVisitsUrl, portCallV2CancelledFleetRisk,
  portCallV2CancelledUrl,
  utcDayEndMs, vesselMeetsIbnetIceClass, winterLocodeEndsForRoute, winterNavIceRisk,
} from '../ferry/winterNavigation.ts';
import {
  cancelSuspectRisk, cancelSuspectRiskDedup, cancelSuspectTrigger,
  departureHubsForRoute, digitrafficAisUrl, isDigitrafficAisPayloadOk, isFreshAisFix,
  aisClearsCancelSuspect, isGulfFerryRoute, isStandingAtDeparturePort,
  mergePortCallIdsIfComplete, nearestGulfHub,
  CANCEL_SUSPECT_DEDUP_PREFIX, DIGITRAFFIC_AIS_LOCATIONS_URL,
} from '../ferry/cancelSuspect.ts';
import {
  UMG_ATTRIBUTION, UMG_EXPECTED_URL, UMG_IN_PORT_URL, UMG_OUTGOING_URL, UMG_UA,
  parseUmgdyGdanskNowyHtml, parseUmgdyGdyniaHtml, polferriesUmgCandidates,
  stenaUmgCandidates, type UmgKind, type UmgShipRow,
} from '../ferry/umgdyShipMovements.ts';
import {
  PORT_TALLINN_ARRIVALS_URL, PORT_TALLINN_DEPARTURES_URL, PORT_TALLINN_UA,
  operatorFromTsCompany,
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
  VIKING_FILE_COVERAGE_DAYS_CLOSE,
  vikingCoverageDaysFromMaxDeparture,
  vikingScheduleCoverageDaysFromNow,
} from '../ferry/vikingFileImport.ts';
import {
  ECKERO_SCHEDULE_PAGE, ECKERO_UA, parseEckeroTimetableHtml,
} from '../ferry/eckero.ts';
import {
  DFDS_SCHEDULE_PAGE, DFDS_TERMINAL_KPS, DFDS_TERMINAL_PLD, DFDS_UA, DFDS_WEEKLY_PDF_URL,
  dfdsTimetableUrl, dfdsWeekWindows, extractDfdsSeasonalPdfUrl, filterDfdsFallbackToFailedWeeks,
  mergeDfdsMissingDays, mergeDfdsSailings, type DfdsFailedWindow,
  FERRY_PORT_DELAY_MIN_DEFAULT, parseDfdsTimetableApi, parseDfdsWeeklyHtml,
} from '../ferry/dfds.ts';
import {
  TALLINK_ALERT_FAIL_STREAK_SOURCE_DOWN, TALLINK_ALERT_UA, TALLINK_HEL_TLL_URL, TALLINK_HOME_URL,
  isTallinkAlertHtmlUsable,
  finalizeTallinkAlertsForStatus, matchTallinkAlertSailings, matchTallinkRestoreSailings,
  parseTallinkAlerts,
} from '../ferry/tallinkAlert.ts';
import {
  isTallinkAlertAutoCancel,
  restoreStatusAfterCancel,
  tallinkAlertLooksLikeRestore,
} from '../ferry/tallinkRestore.ts';
import {
  ERR_ATTRIBUTION, ERR_RSS_MAX_CHARS, ERR_RSS_UA, ERR_RSS_URL,
  errRssCancelRisk, filterErrFerryCancel, isErrRssEnabled, isErrRssItemFresh, parseErrRss,
} from '../ferry/errRss.ts';
import {
  MARINE_CORRIDORS, MARINE_POINTS, SMHI_OCOBS_URL, dmiPointsUnique, dmiWamUrl, evaluateMarineWindow,
  fmiHarmonieUrl, fmiLastValidIso, fmiNanAllOffGrid, fmiWamUrl,
  marinePointsForCorridor, marinePointsForRoute, marineWeatherRisk, parseDmiCoverageJson, parseFmiTimeValuePair,
  parseSmhiOcobs, parseSmhiSnow1g, samplesInWindow, smhiSnow1gUrl, type MarineSample, type MarinePointCode,
} from '../ferry/marineWeather.ts';
import {
  integrationMode, parseDatexSituations, parseTrafikverketRoadConditions,
  parseTrafikverketSituations, parseTrafikverketWeather, roadConditionRisk, roadRisk, seRoadSlowdownMult, trafikverketResultError,
  trafikverketRoadConditionQuery, trafikverketSituationQuery, trafikverketWeatherQuery, weatherRisk, TRAFIKVERKET_URL,
} from './road.ts';
import {
  EE_ATTRIBUTION, EE_DATEX_FEEDS, EE_DATEX_KEY_HEADER, EE_SOURCE_REF, EE_UA,
  FI_ANNOUNCEMENTS_URL, FI_ATTRIBUTION, FI_ROADWORKS_URL, FI_WEIGHT_URL,
  FI_WEATHER_STATIONS_URL, FI_WEATHER_STATIONS_DATA_URL,
  LT_ATTRIBUTION, LT_RESTRICTIONS_URL, LT_UA, LT_WEATHER_URL,
  LV_ATTRIBUTION, LV_DOWNLOAD_FILE_URL, LV_FILE_INFO_URL,
  LV_NAP_BASE, LV_NAP_CODES, LV_NAP_KEY_HEADER, LV_SOURCE_REF, LV_UA,
  BALTIC_FEED_BUDGET_MS, BALTIC_FEED_TIMEOUT_MS, EE_RESTRICTIONS_MAX_BYTES,
  EE_FEED_BUDGET_MS, EE_FEED_TIMEOUT_MS, EE_HEAVY_FEED_CACHE_TTL_MS,
  EE_RESTRICTIONS_TIMEOUT_MS,
  applyBalticCorridorRoadFilter, applyFiCorridorRoadFilter, balticFeedObsOk, balticFeedShapeObs,
  balticJsonErrorSnippet, balticKeyMeta,
  balticNetWarning, balticRoadRisk, balticShouldRaiseRisk, balticSlowdownMult, balticUrlKind,
  balticWarnHost,
  capBalticRiskSeverity, markBalticOffRoute, classifyBalticNetError, dedupeLvSlippery, eeDatexApiKeyMeta,
  resolveBalticEventType,
  eeDatexFeedUrl, fiCorridorBboxes, fiTrafficUrl, filterInEeBboxes, filterInFiBboxes,
  filterInLvBboxes, dimensionLimitRisk, filterInLtBboxes, getEeHeavyFeedCache, getEeSitesCache,
  isDimensionLimitEvent, isEeHeavyFeedCode,
  isFiWeightLimitLike, fiWeatherToRiskEvents, fiWeatherSegmentsAhead, fiWxLoadSlipRisk,
  ltWeatherToSlowdownEvents, lvFileInfoFirstId, lvIsFileIdMismatch,
  lvNapKeyAllowedForUrl, lvNapKeyEnv, lvNapUrlEnv,
  normalizeLvNapUrl,
  lvWeatherToSlowdownEvents, parseEeFeedBody, parseFiTrafficMessages, parseFiWeatherStationsData,
  parseFiWeatherStationsMeta, parseLtRestrictions,
  parseLtWeather, parseLvFeedBody, probeBalticHost, probeEeDatexApi, readBalticFeedBody,
  setEeHeavyFeedCache, setEeSitesCache, weightLimitRisk,
  type BalticKeyMeta, type BalticRoadEvent, type EeSiteInfo, type LvNapCode,
} from './roadBaltic.ts';
import { buildTrafficIncidentsUrl, parseHereTrafficIncidents } from '../here/trafficIncidents.ts';
import { HERE_BILLING_DEFAULTS } from '../here/billing.ts';
import {
  refreshRoadLegs, ROAD_CRON_REFRESH_MS, type RoadRefreshStore,
} from '../here/refreshRoadLegs.ts';
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
  fetchMonitorujPojazdPosition, monitorujpojazdUrlSafe, scrubMonitorujPojazdToken,
} from '../telematics/monitorujpojazdShareLink.ts';
import {
  WIND_GUST_MS_THRESHOLD, gustExceedsThreshold, windRiskTitle,
  seWeekendBanHit, plSundayBanHit, banRiskTitle,
} from '../here/windAndBans.ts';
import { runCorridorWindCore } from '../e49/corridorWindJob.ts';
import { runDetourCases } from '../e49/detourCaseJob.ts';
import { planWindCase, windCaseDedup, type CorridorWindRow } from '../e49/etaWeather.ts';
import { E49_WIND_DEFAULTS } from '../e49/windEta.ts';
import { applyPendingRoadTitle, humanizeRoadCode } from '../../../../src/lib/pl/describe.ts';
import { PANEL_FALLBACK } from '../../../../src/lib/pl/codes.ts';
import {
  deeplTranslate, textHash, translateFreeText, usageLevel, DEEPL_MONTHLY_LIMIT,
  DEEPL_MAX_CALLS_PER_RUN,
  deeplSourceForBalticCountry,
  type DeeplSourceLang,
} from '../../../../src/lib/pl/deepl.ts';
import {
  emtrackLoginFail, emtrackLoginFresh, emtrackLoginOk, emtrackLoginSkipped, emtrackNextTryAt, emtrackSecretFp,
  unquoteSecret,
} from './emtrackLogin.ts';
import {
  isSourceFailure, planSailingSync, sourceDownRisk, unknownStatusRisk, warsaw,
  type AutoSailingSource, type DbSailing, type IncomingSailing, type RiskInput, type SailingInsert, type SailingPatch, type VesselRow,
} from './sync.ts';

/** Wyłącznie ASCII (nagłówek HTTP) — test pilnuje. */
export const USER_AGENT = 'TOWER-WatchTower/1.0 (+https://log-mar.pl; H&H Logistics; read max every 15 min)';
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

/** #837 — wiersz do odpytania monitorujpojazd (token tylko w Edge / service_role). */
export interface MonitorujPojazdLoadRow {
  id: string;
  monitorujpojazd_token: string;
  monitorujpojazd_check_state: string | null;
  monitorujpojazd_check_at: string | null;
  monitorujpojazd_last_fix_at: string | null;
  monitorujpojazd_error_streak: number;
  telematics_vehicle_id: string | null;
  status: string | null;
  plannedLoadDate: string | null;
  trackingOpenedAt: string | null;
}

export interface MonitorujPojazdLoadPatch {
  monitorujpojazd_check_state?: 'ok' | 'pending' | 'invalid' | 'down';
  monitorujpojazd_check_at?: string;
  monitorujpojazd_last_fix_at?: string;
  monitorujpojazd_error_streak?: number;
}

export interface SyncStore {
  projectId(): Promise<string>;
  vessels(): Promise<VesselRow[]>;
  sailingsSince(fromIso: string): Promise<DbSailing[]>;
  /**
   * F7 #690 R2-B4 / 63c: max(departure_at) VIKING source_ref null > now
   * (+ max viking_schedule_imports.to_at) — bez limitu max_rows sailingsSince.
   */
  maxVikingFileDepartureAt?(nowIso: string): Promise<string | null>;
  /** F7 #690 R2-B4: VIKING+RECZNIE ze stronicowaniem (import pliku). */
  sailingsForVikingFileImport?(fromIso: string): Promise<DbSailing[]>;
  insertSailings(rows: SailingInsert[]): Promise<void>;
  /** aktualizacja z warunkiem source <> 'RECZNIE' (wyścig ze zmianą ręczną HHL) — zwraca, czy zapisano */
  updateSailing(id: string, patch: SailingPatch): Promise<boolean>;
  /** #685-a / decyzja 74: liczba transportów z sailing_id (przed usunięciem Portnet). */
  sailingAssignedLoadCount?(sailingId: string): Promise<number>;
  /**
   * DP-237 B3: id niezakończonych transportów na rejsie
   * (nie CANCELLED/REMOVED/UNLOADED/DELIVERED/READY_TO_INVOICE/INVOICED).
   */
  sailingUnfinishedLoadIds?(sailingId: string): Promise<string[]>;
  /** #685-a / decyzja 74: usuń rejs (nie RECZNIE). */
  deleteSailing?(id: string): Promise<boolean>;
  /** BN3 decyzja 57: AUTO komunikat do historii operator_notices (created_by null). */
  insertOperatorNotice?(row: {
    sailingId: string;
    operator: string;
    kind: 'ODWOLANY' | 'OPOZNIONY' | 'ZMIANA_GODZINY' | 'PRZYWROCONY';
    note?: string | null;
    sourceUrl?: string | null;
    newDeparture?: string | null;
  }): Promise<string | null>;
  /**
   * DP-101 / F7 #866: atomowe AUTO ODWOLANY + notice (RPC `sailing_cancel_auto`).
   * false gdy już ODWOLANY / RECZNIE / brak zapisu — bez osobnego insertu.
   */
  cancelSailingAuto?(row: {
    sailingId: string;
    operator: string;
    note?: string | null;
    sourceUrl?: string | null;
  }): Promise<boolean>;
  /**
   * #686 F7 B1: ostatni ODWOLANY (+ sourceUrl). Cofnięcie tylko Tallink Alert
   * (AUTO + tallink.com); brak metody / brak wpisu → ryzyko bez cofania.
   */
  latestCancelNotice?(sailingId: string): Promise<{
    source: string;
    operator: string;
    sourceUrl?: string | null;
  } | null>;
  /** #686: zamknij ryzyka SAILING_CANCELLED:%:{sailingId}. */
  resolveSailingCancelledRisks?(sailingId: string): Promise<number>;
  /** #686: decyzje FERRY_CANCELLED z tych ryzyk → EXPIRED. */
  expireFerryCancelledDecisions?(sailingId: string): Promise<number>;
  /**
   * #686 F7 B2: load_id z SAILING_CANCELLED (także zamkniętych), których
   * sailing_id już nie wskazuje na ten rejs — bez cofania przypisań.
   */
  reassignedLoadsAfterCancel?(sailingId: string): Promise<string[]>;
  raiseRisk(r: RiskInput & { loadId?: string }): Promise<boolean>;
  /**
   * F7 #699 B2: czy istnieje ryzyko z tym dedup (także zamknięte) —
   * trwała pamięć guid ERR, bez powrotu po ręcznym zamknięciu.
   */
  hasRiskDedup?(dedup: string): Promise<boolean>;
  latestPositions(maxAgeMin: number): Promise<VehiclePos[]>;
  lastRun(job: string): Promise<string | null>;
  /** F7 #689 R1-B3: ostatnie N wyników joba z integration_runs (od najnowszego). */
  recentJobResults?(job: string, limit: number): Promise<JobResult[]>;
  /** F7 #695 r2 B2: czy jest otwarte ryzyko z prefiksem dedup (np. SOURCE_DOWN:STENA_STATUS:). */
  hasOpenRisk?(dedupPrefix: string): Promise<boolean>;
  /**
   * F7 #696 r3 B1: otwarte FERRY_CANCEL_SUSPECT + ich rejsy (bez limitu since).
   * Brak metody → job nie woła resolveStaleRisks (nie zamyka na ślepo).
   */
  openCancelSuspectSailings?(): Promise<DbSailing[]>;
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
  /**
   * DP-128 / DP-222: ATD — para p_in (≤3 km) → p_out (>4 km); ≤20 min albo ≤60 min
   * przy SOG≥3 / oddalaniu; czas = ostatnia w strefie z SOG≥1. Brak pary → null.
   */
  lastPortPosition?(
    vesselId: string,
    hub: { lat: number; lon: number },
    radiusKm: number,
    sinceIso: string,
  ): Promise<string | null>;
  /**
   * DP-128 / DP-222 B2: ATA — pierwsze wejście ≤3 km po poprzedniej (>4 km lub SOG≥3);
   * luka ≤20 min albo ≤60 min przy SOG≥3 / zbliżaniu; od `sinceIso` (depRef).
   */
  firstPortEntryAfter?(
    vesselId: string,
    hub: { lat: number; lon: number },
    radiusKm: number,
    sinceIso: string,
  ): Promise<string | null>;
  /** II-6: współczynnik spowolnienia SE (E4) dla silnika ETA II-7 */
  saveCorridorCondition?(row: {
    corridor: 'SE_E4' | 'SE_E22' | 'ROAD_LT' | 'ROAD_LV' | 'ROAD_EE' | 'ROAD_FI';
    slowdownMult: number; reason: string | null; detail: unknown; observedAt: string;
    source?: string;
  }): Promise<void>;
  /** II-6: parametr % spowolnienia (domyślnie 15) — opcjonalne */
  seSlowdownPct?(): Promise<number>;
  /** BN3 F7 #682 B1: FERRY_PORT_DELAY_MIN z app_parameters (domyślnie 15) */
  ferryPortDelayMin?(): Promise<number>;
  /** II-8: progi WAVE_M / GUST_KN z ops_thresholds (domyślnie 3.8 / 40) */
  opsThresholds?(): Promise<{ waveM: number; gustKn: number }>;
  /** E49-a: korytarze z transportem w oknie śledzenia. */
  e49WindActiveCorridors?(): Promise<string[]>;
  /** E49-a Z2: korytarze per transport (odcinek PL / SE-FI; bez AT_SITE) + postęp auta `fromKm`. */
  e49WindLoadCorridors?(): Promise<Array<{
    loadId: string;
    code: string;
    leg: 'PL' | 'SE';
    fromKm: number;
    currentLeg: boolean;
  }>>;
  /** E49-a Z2: progi WIND_* / SLIP_* z ops_thresholds (Z1 pkt 5). */
  e49WindThresholds?(): Promise<import('../e49/windEta.ts').E49Thr>;
  /** E49-a Z2: klucze dedup otwartych spraw z prefiksem (jedno zapytanie zamiast hasOpenRisk per sprawa). */
  openRiskDedups?(dedupPrefix: string): Promise<string[]>;
  /** E49-a: geometria korytarza (GeoJSON) z corridor_polylines. */
  corridorPolylineGeoJson?(code: string): Promise<unknown | null>;
  /** E49-a: zapis prognozy wiatru na punkcie. */
  upsertCorridorWindForecast?(row: {
    corridor: string;
    km: number;
    lon: number;
    lat: number;
    bearingDeg: number;
    source: 'SMHI' | 'FMI';
    samples: unknown;
    fetchedAt: string;
  }): Promise<void>;
  /** E49-a: liczba świeżych punktów prognozy (Stan systemu / route-hazards). */
  corridorWindFreshCount?(maxAgeMin: number): Promise<number>;
  /** E49-a Z2 / DP-212: punkty prognozy — jeden kod albo lista (jedno zapytanie). */
  listCorridorWindForecast?(
    corridor: string | readonly string[],
    maxAgeMin?: number,
  ): Promise<CorridorWindRow[]>;
  /** E49-b Z3: otwarte ryzyka ROAD_* wyglądające na zamknięcie (do spraw SCX). */
  listOpenRoadClosures?(): Promise<import('../e49/detourCaseJob.ts').RoadClosureCandidate[]>;
  /** E49-b Z3: transporty na korytarzu + wymiary/pozycja pod HERE. */
  e49DetourLoadLegs?(): Promise<import('../e49/detourCaseJob.ts').DetourLoadLegsResult>;
  /** E49-b Z3: upsert sprawy „Objazd czy postój?”. */
  upsertE49DetourCase?(row: import('../e49/detourCaseJob.ts').DetourCaseUpsert): Promise<boolean>;
  /** E49-b Z3: zamknij sprawy bez keep (zamknięcie odwołane). */
  closeStaleE49DetourCases?(keepDedup: string[]): Promise<number>;
  /** E49-b F7 r4 B6: pamięć HERE między przebiegami. */
  getOpenDetourCache?(dedupKey: string): Promise<import('../e49/detourCaseJob.ts').OpenDetourCache | null>;
  /** E49-a: transport w oknie śledzenia? */
  loadInTrackingWindow?(loadId: string, at?: string): Promise<boolean>;
  /**
   * DP-145 / BN5: `ferry_routes.code` → `family_key` (UPPER).
   * Brak metody → marineWeather używa zapasu w kodzie.
   */
  ferryRouteFamilies?(): Promise<Record<string, string>>;

  /** H-2-PL / D-78: zapis zużycia HERE (service_role → here_note_service). */
  noteHereUsage?(service: 'tiles' | 'routing' | 'matching' | 'attributes' | 'traffic', n: number): Promise<void>;
  /** Koszt ponad pule w bieżącym miesiącu (Europe/Warsaw). */
  hereMonthSpend?(): Promise<number>;
  /** #667 C: geometria pomarańczowych dróg (cron here-roads). */
  listHereRoadGeometry?(): Promise<{ leg: string; fetched_at: string; points: unknown; retry_after: string | null }[]>;
  /** #667 E / DP-23 */
  listHereRoadLegs?(): Promise<import('../here/refreshRoadLegs.ts').RoadLegDef[]>;
  storeHereRoad?(
    leg: string,
    points: unknown,
    summary: string,
    nowIso?: string,
    meta?: { lengthM?: number; durationS?: number },
  ): Promise<void>;
  hereCorridorBundle?(code: string): Promise<{ code: string; pts: [number, number][]; via: [number, number][]; updatedAt: number }>;
  /** TELM: aktywne transporty do dopasowania naczepy. */
  listActiveLoadsForTelematics?(): Promise<{ id: string; trailer_plate: string | null; telematics_vehicle_id: string | null; status: string | null; plannedLoadDate?: string | null; plannedDeliverDate?: string | null; trackingOpenedAt?: string | null }[]>;
  /** TELM: zapis pozycji (process_position). */
  processPosition?(row: {
    loadId: string; lat: number; lon: number; ts: string;
    source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK' | 'SAFEFLEET' | 'MONITORUJPOJAZD';
    speed?: number | null; heading?: number | null; ignition?: boolean | null; raw?: unknown;
  }): Promise<void>;
  lastPositionAt?(loadId: string, source: string): Promise<string | null>;
  telmEmtrackWebEnabled?(): Promise<boolean>;
  /** E44: flaga TELM_RIO_LINKS — wyłącza odczyt linków RIO. */
  telmRioLinksEnabled?(): Promise<boolean>;
  /** #662: flaga TELM_SAFEFLEET_POLL. */
  telmSafefleetPollEnabled?(): Promise<boolean>;
  /** #837: flaga TELM_MONITORUJPOJAZD_POLL. */
  telmMonitorujPojazdPollEnabled?(): Promise<boolean>;
  /** E44: blokada nakładania się przebiegów rio-links (TTL + token właściciela). */
  rioLinksLockTry?(ttlSec?: number, token?: string): Promise<boolean>;
  rioLinksLockRelease?(token?: string): Promise<void>;
  /** #662: blokada safefleet-poll. */
  safefleetPollLockTry?(ttlSec?: number, token?: string): Promise<boolean>;
  safefleetPollLockRelease?(token?: string): Promise<void>;
  /** #837: blokada monitorujpojazd-poll. */
  monitorujpojazdPollLockTry?(ttlSec?: number, token?: string): Promise<boolean>;
  monitorujpojazdPollLockRelease?(token?: string): Promise<void>;
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
  listMonitorujPojazdLoadsForPoll?(): Promise<MonitorujPojazdLoadRow[]>;
  updateMonitorujPojazdLoadState?(loadId: string, patch: MonitorujPojazdLoadPatch): Promise<void>;
  /** Ostatnia pozycja z lat/lon (do prędkości RIO). */
  lastPositionFix?(loadId: string, source: string): Promise<{ lat: number; lon: number; ts: string } | null>;
  /** II-8: zapis bieżącej pogody morskiej */
  saveMarineCondition?(row: {
    corridor: 'BALTIC_GDN_NYN' | 'BALTIC_GDY_KAA' | 'BALTIC_GULF_FI' | 'BALTIC_PLD_KPS' | 'BALTIC_TLL_STO';
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
  /** PL-DATA / DP-172: pamięć tłumaczeń i zużycie DeepL. Brak = bez wywołań DeepL. */
  translationGet?(hash: string): Promise<string | null>;
  translationPut?(hash: string, source: string, pl: string, lang: DeeplSourceLang): Promise<void>;
  translationEnqueue?(hash: string, source: string, lang: DeeplSourceLang, reason: string): Promise<void>;
  /** B9: lista kolejki do ponowienia; delete po sukcesie. */
  translationListQueue?(reasons: string[]): Promise<{ hash: string; source: string; lang: DeeplSourceLang; reason: string; createdAt: string }[]>;
  translationDequeue?(hash: string): Promise<void>;
  /** B9 / DP-172: uzupełnij opis PL w otwartych ryzykach drogi po udanym ponowieniu. */
  patchRoadRiskOpis?(original: string, pl: string): Promise<number>;
  deeplUsage?(): Promise<{ characters: number; limit: number }>;
  deeplAddUsage?(n: number): Promise<number>;
  /**
   * DP-186: ostatnia dobra kopia EE RESTRICTIONS/SAFETY w bazie (cold start).
   * `maxAgeMs` = Infinity → dowolny wiek (cache-stale przy błędzie fetch).
   */
  getEeHeavyFeedDbCache?(
    code: 'RESTRICTIONS' | 'SAFETY',
    nowMs: number,
    maxAgeMs?: number,
  ): Promise<{ fetchedAt: number; events: import('./roadBaltic.ts').BalticRoadEvent[] } | null>;
  setEeHeavyFeedDbCache?(
    code: 'RESTRICTIONS' | 'SAFETY',
    events: import('./roadBaltic.ts').BalticRoadEvent[],
    fetchedAtMs: number,
  ): Promise<void>;
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
  /** F7 #689 R1-B3 / DP-114: niepełna pula Tallink Alert — streak SOURCE_DOWN z integration_runs. */
  tallink_alert_incomplete?: boolean;
  /**
   * DP-115 / F7 #689: Stena IRM 403/429 — ISO do kiedy nie wołać IRM
   * (persist w integration_runs; zimny start Edge nie resetuje okna).
   */
  stena_irm_backoff_until?: string;
  /**
   * DP-154: po 3 przebiegach bez DMI — ISO do kiedy pomijać DMI
   * (persist w integration_runs; zimny start Edge nie resetuje okna).
   */
  dmi_skip_until?: string;
  /**
   * DP-187: początek przebiegu (ISO) — `runJob` liczy odstęp od startu, nie od `ran_at`
   * (wolny Tark Tee ~90 s nie pomija następnego crona co 15 min).
   */
  started_at?: string;
  /**
   * DP-187 / F7 #765 A: pominięcie limitem — tylko w odpowiedzi i `console.info`,
   * bez wiersza w `integration_runs` (seria SOURCE_DOWN i panele stanu).
   */
  skipped?: boolean;
}

/** F7 #660: limit ścienny odczytu (20 s) — bez zawieszenia joba na martwym źródle. */
const READ_TEXT_TIMEOUT_MS = 20_000;
/** DP-150: krótszy timeout DMI (częste 429 / wiszące position). */
const DMI_READ_TIMEOUT_MS = 8_000;
const DMI_CACHE_TTL_MS = 3 * 3600_000;
const DMI_DEFAULT_GAP_MS = 400;
/** DP-154: po 3 przebiegach bez odpowiedzi DMI — pomiń 24 h (jeden warn). */
export const DMI_SKIP_AFTER_FAILS = 3;
export const DMI_SKIP_MS = 24 * 3600_000;

type DmiCacheEntry = { fetchedAt: number; text: string };
const dmiResponseCache = new Map<string, DmiCacheEntry>();
/** Pamięć izolatu + hydrate z integration_runs (zimny start Edge). */
let dmiSkipUntilMs = 0;

/** Testy DP-150 / DP-154: wyczyść cache odpowiedzi DMI i okno pominięcia. */
export function clearDmiResponseCache(): void {
  dmiResponseCache.clear();
  dmiSkipUntilMs = 0;
}

/** Testy DP-154: wyczyść tylko okno pominięcia DMI. */
export function clearDmiSkip(): void {
  dmiSkipUntilMs = 0;
}

/** DP-154: przywróć okno z ostatniego ferry-weather, gdy pamięć izolatu jest pusta/wygasła. */
async function hydrateDmiSkip(deps: JobDeps, nowMs: number): Promise<void> {
  if (nowMs < dmiSkipUntilMs) return;
  if (!deps.store.recentJobResults) return;
  const recent = await deps.store.recentJobResults('ferry-weather', 1);
  const until = recent[0]?.dmi_skip_until;
  if (typeof until !== 'string') return;
  const ms = Date.parse(until);
  if (Number.isFinite(ms) && ms > nowMs) dmiSkipUntilMs = ms;
}

/**
 * DP-154: ile kolejnych przebiegów ferry-weather miało dmi=0 bez aktywnego pominięcia.
 * Najnowsze pierwsze (jak road-* streak).
 */
async function dmiFailStreak(deps: JobDeps): Promise<number> {
  let streak = 0;
  if (!deps.store.recentJobResults) return streak;
  const rows = await deps.store.recentJobResults('ferry-weather', 5);
  for (const r of rows) {
    if (r.observations?.dmi_skipped === '1') break;
    if (r.observations?.dmi === '0') streak++;
    else break;
  }
  return streak;
}

async function readText(
  deps: JobDeps,
  url: string,
  init?: RequestInit,
  timeoutMs: number = READ_TEXT_TIMEOUT_MS,
  /** DP-126 F7 #884: Content-Length przed text() — bez pobierania ciała ponad limit. */
  maxChars?: number,
): Promise<{ ok: true; text: string } | { ok: false; warning: string }> {
  const ctrl = new AbortController();
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : READ_TEXT_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await deps.fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return { ok: false, warning: `HTTP ${res.status} ${url}` };
    if (maxChars != null) {
      const clRaw = res.headers.get('content-length');
      const cl = clRaw != null ? Number(clRaw) : NaN;
      if (Number.isFinite(cl) && cl > maxChars) {
        return { ok: false, warning: `Odpowiedź za duża (Content-Length) ${url}` };
      }
    }
    return { ok: true, text: await res.text() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/abort/i.test(msg)) return { ok: false, warning: `Timeout ${ms / 1000}s ${url}` };
    return { ok: false, warning: `Błąd sieci ${url}: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

function sleepMs(ms: number): Promise<void> {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** F7 #660: jak AIS — RECZNIE/ODWOLANY: actual_* bez zmiany statusu. BN3: też delayed_arrival. */
function sailingActualPatch(
  s: { source: string; status: string },
  actual: Pick<SailingPatch, 'actual_departure_at' | 'actual_arrival_at' | 'delayed_arrival_at'>,
  status: 'W_REJSIE' | 'DOPLYNAL' | 'ZAMKNIETY_BEZ_POTWIERDZENIA',
): SailingPatch {
  const patch: SailingPatch = { ...actual };
  if (s.source !== 'RECZNIE' && s.status !== 'ODWOLANY') patch.status = status;
  return patch;
}

const FLEET_CLOSE_STATUS = 'ZAMKNIETY_BEZ_POTWIERDZENIA' as const;

function laterVesselAtd(
  s: Pick<DbSailing, 'id' | 'vessel_id' | 'departure_at'>,
  peers: readonly Pick<DbSailing, 'id' | 'vessel_id' | 'departure_at' | 'actual_departure_at'>[],
): boolean {
  const depMs = Date.parse(s.departure_at);
  return peers.some((x) =>
    x.vessel_id === s.vessel_id
    && x.id !== s.id
    && x.actual_departure_at != null
    && Date.parse(x.departure_at) > depMs);
}

/**
 * DP-222 F7 #818 B2 + DP-237 r2 (decyzja 114 / B2): po ATD — nie zostawiaj W_REJSIE.
 * ATA → DOPLYNAL; W_REJSIE z ATD + późniejszy ATD floty → DOPLYNAL (statek wypłynął);
 * GDN-NYN: arrival+6h przy znanym ATD → DOPLYNAL; trwający → W_REJSIE.
 * Znacznik ZAMKNIETY_BEZ_POTWIERDZENIA tylko bez ATD (shouldClose*).
 */
export function statusAfterGdnNynAtd(
  s: Pick<DbSailing, 'id' | 'vessel_id' | 'route' | 'departure_at' | 'arrival_at'>,
  peers: readonly Pick<DbSailing, 'id' | 'vessel_id' | 'departure_at' | 'actual_departure_at'>[],
  nowMs: number,
  ataIso: string | null = null,
): 'W_REJSIE' | 'DOPLYNAL' | 'ZAMKNIETY_BEZ_POTWIERDZENIA' {
  if (ataIso) return 'DOPLYNAL';
  if (laterVesselAtd(s, peers)) return 'DOPLYNAL';
  if (s.route === 'GDN-NYN' && Date.parse(s.arrival_at) + 6 * 3600_000 < nowMs) return 'DOPLYNAL';
  return 'W_REJSIE';
}

/**
 * DP-222 drobne + DP-237: ZAPLANOWANY/OPOZNIONY bez ATD+ATA + późniejszy ATD floty
 * (wszystkie trasy) → ZAMKNIETY_BEZ_POTWIERDZENIA. Bez arrival+6h (61b).
 */
export function shouldCloseGdnNynWithoutAtd(
  s: Pick<DbSailing, 'id' | 'vessel_id' | 'route' | 'status' | 'departure_at' | 'actual_departure_at' | 'actual_arrival_at'>,
  peers: readonly Pick<DbSailing, 'id' | 'vessel_id' | 'departure_at' | 'actual_departure_at'>[],
): boolean {
  if (s.status !== 'ZAPLANOWANY' && s.status !== 'OPOZNIONY') return false;
  if (s.actual_departure_at != null || s.actual_arrival_at != null) return false;
  return laterVesselAtd(s, peers);
}

/** Alias DP-237 — ta sama reguła, wszystkie trasy. */
export const shouldCloseFleetEvidenceWithoutAtd = shouldCloseGdnNynWithoutAtd;

/**
 * DP-237 B3: rejs bez ATD z niezakończonym transportem — nie domykaj znacznikiem;
 * HIGH HHL+SCX (sprawdź, czy transport płynął).
 */
export function fleetUnconfirmedDepRisk(
  s: Pick<DbSailing, 'id' | 'route' | 'departure_at'>,
  loadId: string,
  vesselName?: string,
): RiskInput & { loadId: string } {
  // DP-238: params.dep / tytuł = warsaw (jak DP-97 Portnet), nie surowy UTC.
  const dep = warsaw(s.departure_at);
  const vessel = vesselName ?? 'prom';
  return {
    kind: 'FERRY',
    severity: 'HIGH',
    title: `Rejs bez potwierdzenia wypłynięcia — sprawdź, czy transport płynął (${vessel}, ${dep})`,
    titleKey: 'rk_ferry_unconfirmed_dep',
    params: { vessel, dep },
    detail: {
      audience: 'HHL_PRZEWOZNIK',
      sailing_id: s.id,
      trasa: s.route,
      odejscie: s.departure_at,
      zrodlo: 'FLEET_EVIDENCE',
    },
    dedup: `FERRY_UNCONFIRMED_DEP:${s.id}:${loadId}`,
    loadId,
  };
}

/**
 * DP-222 B2 + DP-237 r2: W_REJSIE+ATD → DOPLYNAL (późniejszy ATD / GDN arrival+6h);
 * ZAPLANOWANY/OPOZNIONY bez ATD → ZAMKNIETY_BEZ_POTWIERDZENIA.
 * Pomiń cancel-suspect; B3: bez ATD + niezakończony transport → ryzyko, bez domknięcia.
 * Resolve AIS_DEP_DELAY po domknięciu.
 */
async function closeStaleGdnNynWithoutAta(deps: JobDeps, _sinceIso?: string): Promise<number> {
  const nowMs = deps.now().getTime();
  /* 14 d — okno analizy DP-140; GDN-NYN wcześniej 7 d. */
  const lookback = new Date(nowMs - 14 * 864e5).toISOString();
  const existing = await deps.store.sailingsSince(lookback);
  const vessels = await deps.store.vessels();
  const vesselName = (id: string) => vessels.find((v) => v.id === id)?.name;
  let updated = 0;
  for (const s of existing) {
    if (s.actual_arrival_at != null) continue;
    if (s.source === 'RECZNIE') continue;
    if (s.status !== 'W_REJSIE' && s.status !== 'ZAPLANOWANY' && s.status !== 'OPOZNIONY') continue;
    const nextSt = s.status === 'W_REJSIE'
      ? statusAfterGdnNynAtd(s, existing, nowMs, null)
      : (shouldCloseGdnNynWithoutAtd(s, existing) ? FLEET_CLOSE_STATUS : null);
    if (nextSt == null || nextSt === 'W_REJSIE') continue;
    if (deps.store.hasOpenRisk
      && await deps.store.hasOpenRisk(cancelSuspectRiskDedup(s.id))) {
      continue;
    }
    /* B3: znacznik tylko bez ATD — przy niezakończonych transportach nie domykaj. */
    if (nextSt === FLEET_CLOSE_STATUS && s.actual_departure_at == null) {
      const loadIds = deps.store.sailingUnfinishedLoadIds
        ? await deps.store.sailingUnfinishedLoadIds(s.id)
        : (deps.store.sailingAssignedLoadCount
          && (await deps.store.sailingAssignedLoadCount(s.id)) > 0
          ? [s.id]
          : []);
      if (loadIds.length > 0) {
        for (const lid of loadIds) {
          const risk = fleetUnconfirmedDepRisk(s, lid, vesselName(s.vessel_id));
          /* Fallback bez listy id: dedup na rejs, bez load_id. */
          if (!deps.store.sailingUnfinishedLoadIds && lid === s.id) {
            const { loadId: _drop, ...rest } = risk;
            await deps.store.raiseRisk({ ...rest, dedup: `FERRY_UNCONFIRMED_DEP:${s.id}` });
          } else {
            await deps.store.raiseRisk(risk);
          }
        }
        continue;
      }
    }
    if (await deps.store.updateSailing(s.id, { status: nextSt })) {
      updated += 1;
      s.status = nextSt;
      if (deps.store.resolveStaleRisks) {
        await deps.store.resolveStaleRisks(`AIS_DEP_DELAY:${s.id}`, []);
      }
    }
  }
  return updated;
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
 * #666 F7: równolegle (limit 4); SOURCE_DOWN tylko gdy fetchedOk===0 lub zmiana struktury bez rejsów.
 * F7 #668 N9: łączny budżet czasu (domyślnie 90 s) — po limicie zapisujemy już pobrane. */
export async function fetchStenaDays(
  deps: JobDeps,
  days: number,
  budgetMs = 90_000,
  /** F7 #668 r4: wstrzyknięty zegar ścienny (test budżetu bez zależności od Date.now). */
  wallNow: () => number = Date.now,
): Promise<{
  sailings: StenaSailing[]; warnings: string[]; http403: boolean; fetchedOk: number; structureFail: boolean;
}> {
  const warnings: string[] = [];
  const sailings: StenaSailing[] = [];
  let http403 = false;
  let fetchedOk = 0;
  let structureFail = false;
  /* N9: ścienny zegar — deps.now() w testach bywa zamrożony. */
  const started = wallNow();
  const dates = dateRangeYmd(deps.now(), days);
  /* F7 #668 r3 N9: przeplatanie po dacie (GDKA/KAGD tego samego dnia), nie cała trasa najpierw. */
  const jobs = dates.flatMap((date) => (['GDKA', 'KAGD'] as const).map((routeCode) => ({ routeCode, date })));
  const parts = await mapPoolLimit(jobs, 4, async ({ routeCode, date }) => {
    if (wallNow() - started > budgetMs) {
      return {
        sailings: [] as StenaSailing[],
        warnings: [] as string[],
        http403: false,
        ok: false,
        structureFail: false,
        skippedBudget: true,
      };
    }
    const url = stenaTimetableUrl(routeCode, date);
    const page = await readText(deps, url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!page.ok) {
      return {
        sailings: [] as StenaSailing[],
        warnings: [page.warning],
        http403: /HTTP 403/.test(page.warning),
        ok: false,
        structureFail: false,
        skippedBudget: false,
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
        skippedBudget: false,
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
      skippedBudget: false,
    };
  });
  let budgetHits = 0;
  for (const p of parts) {
    if (p.skippedBudget) { budgetHits += 1; continue; }
    if (p.ok) fetchedOk += 1;
    if (p.http403) http403 = true;
    if (p.structureFail) structureFail = true;
    sailings.push(...p.sailings);
    warnings.push(...p.warnings);
  }
  if (budgetHits > 0) {
    /* F7 #668 r4: fetchedOk = pary trasa×dzień, nie kalendarzowe doby. */
    warnings.push(
      `Stena: przerwano po ${Math.round(budgetMs / 1000)} s — zapisano ${fetchedOk} pobrań (trasa×dzień), pominięto ${budgetHits}.`,
    );
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

/**
 * #666 E / BN2 — DFDS Dynamic `/api/timetable` (oba kierunki, tygodnie do horyzontu);
 * zapas: PDF sezonowy ze strony, potem HTML/PDF tygodniówki. Bez stałej HTML w jobie.
 * DP-90: `apiOnly` (ferry-status) — bez PDF/HTML; puste tygodnie OK (fetchedOk>0).
 */
async function fetchDfdsDays(
  deps: JobDeps,
  days: number,
  delayMin: number = FERRY_PORT_DELAY_MIN_DEFAULT,
  opts: { apiOnly?: boolean } = {},
): Promise<{
  sailings: ReturnType<typeof parseDfdsWeeklyHtml>['sailings'];
  warnings: string[];
  fetchedOk: number;
  structureFail: boolean;
  /** F7 #668 r7: liczba rejsów z API Dynamic (0 = tylko PDF/HTML albo totalna awaria). */
  apiSailingsCount: number;
}> {
  const warnings: string[] = [];
  const dirs = [
    { portOfLoading: DFDS_TERMINAL_PLD, portOfDischarge: DFDS_TERMINAL_KPS },
    { portOfLoading: DFDS_TERMINAL_KPS, portOfDischarge: DFDS_TERMINAL_PLD },
  ] as const;
  const weeks = dfdsWeekWindows(deps.now(), days);
  const jobs = weeks.flatMap((w) => dirs.map((d) => ({ ...w, ...d })));
  let apiOk = 0;
  let apiStructureFail = false;
  const failedWindows: DfdsFailedWindow[] = [];
  const routeOfDir = (portOfLoading: string): DfdsFailedWindow['route'] =>
    portOfLoading === DFDS_TERMINAL_PLD ? 'PLD-KPS' : 'KPS-PLD';
  const apiParts = await mapPoolLimit(jobs, 4, async (job) => {
    const url = dfdsTimetableUrl({
      portOfLoading: job.portOfLoading,
      portOfDischarge: job.portOfDischarge,
      dateFromIso: job.dateFromIso,
      dateToIso: job.dateToIso,
    });
    const page = await readText(deps, url, {
      headers: { 'User-Agent': DFDS_UA, Accept: 'application/json' },
    });
    if (!page.ok) {
      return {
        sailings: [] as ReturnType<typeof parseDfdsTimetableApi>['sailings'],
        warn: [page.warning],
        job,
        ok: false,
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(page.text);
    } catch {
      return { sailings: [], warn: ['DFDS Dynamic: odpowiedź nie-JSON'], job, ok: false };
    }
    const parsed = parseDfdsTimetableApi(json, delayMin);
    /* F7 #668 r6 B1: tylko prawdziwa pusta tablica [] = pusty tydzień (dok).
       JSON nie-tablica albo niepusta tablica z 0 sparsowanymi → struktura / failedWindow + PDF. */
    const emptyOk = Array.isArray(json) && json.length === 0;
    if (emptyOk) {
      /* DP-81: ostrzeżenie o pustym tygodniu zbiorczo po pętli (nie per tydzień×kierunek). */
      return {
        sailings: [] as ReturnType<typeof parseDfdsTimetableApi>['sailings'],
        warn: [...parsed.warnings],
        job,
        ok: true,
        emptyOk: true,
      };
    }
    if (parsed.sailings.length === 0) {
      /* F7 #668 r7: bez martwego „bez rozpoznanych”; pusty warnings → oczekiwano tablicy. */
      return {
        sailings: [],
        warn: parsed.warnings.length
          ? parsed.warnings
          : ['Struktura rozkładu DFDS Dynamic zmieniona: oczekiwano tablicy.'],
        job,
        ok: false,
        emptyOk: false,
      };
    }
    return {
      sailings: parsed.sailings,
      warn: parsed.warnings,
      job,
      ok: true,
      emptyOk: false,
    };
  });
  let apiSailings: ReturnType<typeof parseDfdsTimetableApi>['sailings'] = [];
  const emptyWeekDates: string[] = [];
  for (const part of apiParts) {
    warnings.push(...part.warn);
    if (part.ok) {
      apiOk += 1;
      apiSailings = mergeDfdsSailings(apiSailings, part.sailings);
      /* Pusty tydzień OK — nie wrzucaj do failedWindows (PDF nie „przywraca” odwołanych). */
      if ((part as { emptyOk?: boolean }).emptyOk) {
        emptyWeekDates.push(part.job.dateFromIso.slice(0, 10));
      }
    } else {
      failedWindows.push({
        dateFromIso: part.job.dateFromIso,
        dateToIso: part.job.dateToIso,
        route: routeOfDir(part.job.portOfLoading),
      });
      /* F7 #668 r7 + DP-29: junk z „nieczytelne godziny” / „nieczytelny rejs”. */
      if (part.warn.some((w) => /Struktura|nie-JSON|nieznan|nieczytelny rejs|nieczytelne godziny|oczekiwano tablicy/i.test(w))) {
        apiStructureFail = true;
      }
    }
  }
  /* DP-81 (#762): po dacie granicznej API — jedno podsumowanie zamiast wpisu na każdy tydzień×kierunek. */
  if (emptyWeekDates.length > 0) {
    const unique = [...new Set(emptyWeekDates)].sort();
    if (unique.length === 1) {
      warnings.push(`DFDS Dynamic: API pusty tydzień ${unique[0]}`);
    } else {
      warnings.push(
        `DFDS Dynamic: API pusty tydzień ×${unique.length} od ${unique[0]} (po dacie granicznej API)`,
      );
    }
  }

  /* F7 #668 r6: apiComplete tylko przy realnych rejsach (nie same puste []).
     Wszystkie tygodnie puste → zapas PDF; struktura → failedWindows + PDF.
     DP-90: ferry-status — tylko API (bez PDF/HTML); puste tygodnie = fetchedOk>0. */
  const apiComplete = failedWindows.length === 0 && apiSailings.length > 0;
  if (apiComplete || opts.apiOnly) {
    return {
      sailings: apiSailings,
      warnings,
      fetchedOk: apiOk,
      structureFail: opts.apiOnly
        ? (apiOk === 0 && apiStructureFail)
        : false,
      apiSailingsCount: apiSailings.length,
    };
  }

  const page = await readText(deps, DFDS_SCHEDULE_PAGE, {
    headers: { 'User-Agent': DFDS_UA, Accept: 'text/html' },
  });
  if (!page.ok) warnings.push(page.warning);
  const pdfUrl = (page.ok && extractDfdsSeasonalPdfUrl(page.text)) || DFDS_WEEKLY_PDF_URL;
  const pdf = await readText(deps, pdfUrl, {
    headers: { 'User-Agent': DFDS_UA, Accept: 'application/pdf' },
  });
  if (!pdf.ok) warnings.push(pdf.warning);

  let fallback: ReturnType<typeof parseDfdsWeeklyHtml>['sailings'] = [];
  if (page.ok) {
    const fromPage = parseDfdsWeeklyHtml(page.text, { now: deps.now(), days });
    warnings.push(...fromPage.warnings);
    if (fromPage.sailings.length > 0) fallback = mergeDfdsSailings(fallback, fromPage.sailings);
  }
  if (pdf.ok) {
    const fromPdf = parseDfdsWeeklyHtml(pdf.text, { now: deps.now(), days });
    warnings.push(...fromPdf.warnings);
    if (fromPdf.sailings.length > 0) fallback = mergeDfdsSailings(fallback, fromPdf.sailings);
  }

  /* F7 #668 r4: przy częściowym API zawęż PDF do padniętych tygodni (odwołany rejs nie wraca z PDF). */
  if (apiSailings.length > 0 && failedWindows.length > 0) {
    fallback = filterDfdsFallbackToFailedWeeks(fallback, failedWindows);
  }
  const sailings = mergeDfdsMissingDays(apiSailings, fallback);
  if (sailings.length > 0) {
    if (apiSailings.length > 0 && failedWindows.length > 0) {
      const filled = sailings.length > apiSailings.length;
      warnings.push(
        filled
          ? `DFDS: częściowa awaria API (${apiOk}/${jobs.length}) — uzupełniono brakujące doby z PDF/HTML.`
          : `DFDS: częściowa awaria API (${apiOk}/${jobs.length}) — brak zapasu PDF/HTML dla brakujących tygodni.`,
      );
    }
    /* DP-29: structureFail zostaje, gdy API było nieczytelne — ryzyko SOURCE_DOWN ma opis struktury. */
    return {
      sailings,
      warnings,
      fetchedOk: apiSailings.length > 0 ? apiOk : (fallback.length > 0 ? 1 : 0),
      structureFail: apiStructureFail,
      apiSailingsCount: apiSailings.length,
    };
  }
  if (apiOk === 0 && !page.ok && !pdf.ok) {
    return { sailings: [], warnings, fetchedOk: 0, structureFail: apiStructureFail, apiSailingsCount: 0 };
  }
  /* DP-30: bez martwego „struktura bez rozpoznanych rejsów” — parser HTML/PDF już dodaje
     „brak tabeli…”, a API „oczekiwano tablicy” / „nieczytelny rejs”. Tu tylko gdy warnings puste. */
  if (!warnings.some((w) => /Struktura|brak tabeli|Dynamic|nieczytelny/i.test(w))) {
    warnings.push('Struktura rozkładu DFDS zmieniona: brak tabeli Paldiski/Kapellskär.');
  }
  return {
    sailings: [],
    warnings,
    fetchedOk: 0,
    structureFail: apiStructureFail || warnings.some((w) => /Struktura|nieczytelny/i.test(w)),
    apiSailingsCount: apiSailings.length,
  };
}

/**
 * F7 #682 B4: w oknie ±windowMs — 0 brak; 1 hit; ≥2 ambiguous (pomiń + ryzyko).
 * Eksport pod testy (dwa rejsy / północ).
 */
export function pickUniqueInWindow<T>(
  items: T[],
  tMs: number,
  timeOf: (x: T) => number,
  windowMs: number,
): { kind: 'hit'; item: T } | { kind: 'ambiguous'; items: T[] } | { kind: 'none' } {
  const inWin = items.filter((x) => Math.abs(timeOf(x) - tMs) <= windowMs);
  if (inWin.length === 0) return { kind: 'none' };
  if (inWin.length >= 2) {
    // Najbliższy nie wystarczy — dwa w oknie = niejednoznaczność.
    return { kind: 'ambiguous', items: inWin };
  }
  return { kind: 'hit', item: inWin[0]! };
}

/**
 * #685-a / decyzja 63a — Digitraffic FIHEL ES / Viking XPRS → sailings TLLA-HEL / HELA-TLL (źródło VIKING).
 * Dopasowanie jak #682: jeden kandydat w oknie ±30 min; RECZNIE bez zmian; ambiguous → ryzyko MEDIUM.
 * Nie zamyka SOURCE_DOWN:VIKING_SCHEDULE (to 63c / plik ≥ 30 dni).
 */
async function applyDigitrafficVikingNearSchedule(deps: JobDeps, sinceIso: string): Promise<{
  inserted: number; updated: number; manualKept: number; removed: number; warnings: string[]; fail: boolean; risks: number;
}> {
  const now = deps.now();
  /* F7 #688 r1 B1: etaFrom/etaTo (i etd*) filtrują po ETA/ETD — nie po portCallTimestamp (from/to). */
  const winFrom = new Date(now.getTime() - 3 * 3600_000).toISOString();
  const winTo = new Date(now.getTime() + VIKING_DIGITRAFFIC_HORIZON_DAYS * 864e5).toISOString();
  const urlEta = digitrafficPortCallsUrl({
    locode: 'FIHEL', mmsi: VIKING_XPRS_MMSI, etaFrom: winFrom, etaTo: winTo,
  });
  const urlEtd = digitrafficPortCallsUrl({
    locode: 'FIHEL', mmsi: VIKING_XPRS_MMSI, etdFrom: winFrom, etdTo: winTo,
  });
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Accept-Encoding': 'gzip',
    'Digitraffic-User': DIGITRAFFIC_USER,
  };
  const [pageEta, pageEtd] = await Promise.all([
    readText(deps, urlEta, { headers }),
    readText(deps, urlEtd, { headers }),
  ]);
  /* F7 #688 r2 B1: obie strony padły → fail; jedna OK → dalej, ale bez usuwania. */
  if (!pageEta.ok && !pageEtd.ok) {
    return {
      inserted: 0, updated: 0, manualKept: 0, removed: 0,
      warnings: [pageEta.warning || pageEtd.warning], fail: true, risks: 0,
    };
  }
  const hasPortCallsArray = (json: unknown): boolean =>
    !!json && typeof json === 'object' && Array.isArray((json as { portCalls?: unknown }).portCalls);
  const mergePortCalls = (a: unknown, b: unknown): { portCalls: unknown[] } => {
    const list: unknown[] = [];
    const seen = new Set<number>();
    for (const json of [a, b]) {
      if (!hasPortCallsArray(json)) continue;
      const arr = (json as { portCalls: unknown[] }).portCalls;
      for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        const id = Number((row as { portCallId?: unknown }).portCallId);
        if (Number.isFinite(id) && seen.has(id)) continue;
        if (Number.isFinite(id)) seen.add(id);
        list.push(row);
      }
    }
    return { portCalls: list };
  };
  let jsonEta: unknown = null;
  let jsonEtd: unknown = null;
  let etaParseFail = false;
  let etdParseFail = false;
  if (pageEta.ok) {
    try { jsonEta = JSON.parse(pageEta.text); } catch {
      etaParseFail = true;
    }
  }
  if (pageEtd.ok) {
    try { jsonEtd = JSON.parse(pageEtd.text); } catch {
      etdParseFail = true;
    }
  }
  if (etaParseFail && etdParseFail) {
    return {
      inserted: 0, updated: 0, manualKept: 0, removed: 0,
      warnings: ['Digitraffic Portnet (Viking): nieczytelny JSON'], fail: true, risks: 0,
    };
  }
  /* F7 #688 r2 B1: tablica portCalls sprawdzana osobno przed scaleniem (merge nie maskuje struktury). */
  const etaHasArr = !etaParseFail && hasPortCallsArray(jsonEta);
  const etdHasArr = !etdParseFail && hasPortCallsArray(jsonEtd);
  const warnings: string[] = [];
  if (pageEta.ok && !etaParseFail && jsonEta !== null && !etaHasArr) {
    warnings.push('Struktura Portnet (Viking ETA) zmieniona: brak tablicy portCalls.');
  }
  if (pageEtd.ok && !etdParseFail && jsonEtd !== null && !etdHasArr) {
    warnings.push('Struktura Portnet (Viking ETD) zmieniona: brak tablicy portCalls.');
  }
  if (etaParseFail) warnings.push('Digitraffic Portnet (Viking ETA): nieczytelny JSON');
  if (etdParseFail) warnings.push('Digitraffic Portnet (Viking ETD): nieczytelny JSON');
  const json = mergePortCalls(
    etaHasArr ? jsonEta : null,
    etdHasArr ? jsonEtd : null,
  );
  /* F7 #688 r3 nieblokujące: niepusta lista osobno na ETA i ETD (nie tylko scalona). */
  const etaLen = etaHasArr ? (jsonEta as { portCalls: unknown[] }).portCalls.length : 0;
  const etdLen = etdHasArr ? (jsonEtd as { portCalls: unknown[] }).portCalls.length : 0;
  const completeForRemoval =
    pageEta.ok && pageEtd.ok
    && !etaParseFail && !etdParseFail
    && etaHasArr && etdHasArr
    && etaLen > 0 && etdLen > 0;
  const parsed = vikingScheduleFromDigitrafficPortCalls(json, { now });
  warnings.push(...parsed.warnings);
  if (!pageEta.ok) warnings.push(`Digitraffic Viking ETA: ${pageEta.warning}`);
  if (!pageEtd.ok) warnings.push(`Digitraffic Viking ETD: ${pageEtd.warning}`);
  if (!completeForRemoval) {
    warnings.push('Digitraffic Viking: niepełna odpowiedź Portnet — bez usuwania rejsów');
  }
  const [projectId, vessels, existing] = await Promise.all([
    deps.store.projectId(), deps.store.vessels(), deps.store.sailingsSince(sinceIso),
  ]);
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  const WINDOW_MS = 30 * 60_000;
  /* F7 #688 r3 B2: odstępy XPRS ≥ 3 h — najbliższy wiersz rozkładu (bez digitraffic:) w ±3 h. */
  const SCHEDULE_WIN_MS = 3 * 3600_000;
  let inserted = 0;
  let updated = 0;
  let manualKept = 0;
  let removed = 0;
  let risks = 0;
  const seenRefs = new Set<string>();
  const isDigitrafficRef = (ref: string | null | undefined) =>
    (ref ?? '').startsWith(DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX);
  const nearestScheduleNeighbor = (
    vesselId: string, route: string, depMs: number, exceptId?: string,
  ) => {
    let best: (typeof existing)[number] | undefined;
    let bestAbs = Infinity;
    for (const s of existing) {
      if (s.id === exceptId) continue;
      if (s.vessel_id !== vesselId || s.route !== route) continue;
      /* F7 #688 r4: VIKING / RECZNIE / DANE_STARTOWE = rozkład w ±3 h (Digitraffic nie dubluje). */
      if (s.source !== 'VIKING' && s.source !== 'RECZNIE' && s.source !== 'DANE_STARTOWE') continue;
      if (isDigitrafficRef(s.source_ref)) continue;
      const abs = Math.abs(Date.parse(s.departure_at) - depMs);
      if (abs > SCHEDULE_WIN_MS || abs >= bestAbs) continue;
      bestAbs = abs;
      best = s;
    }
    return best;
  };
  /* F7 #688 r3 nieblokujące: wyścig Awizacja/FK → ostrzeżenie, job nie pada. */
  const safeDelete = async (id: string): Promise<boolean> => {
    if (!deps.store.deleteSailing) return false;
    try {
      return await deps.store.deleteSailing(id);
    } catch (e) {
      warnings.push(
        `Digitraffic Viking: nie usunięto rejsu ${id} (${e instanceof Error ? e.message : 'błąd'})`,
      );
      return false;
    }
  };
  const raiseDupRisk = async (
    row: (typeof existing)[number],
    vessel: string,
    sourceRef: string,
    htmlDep: string,
    loads: number,
  ) => {
    await deps.store.raiseRisk({
      kind: 'FERRY', severity: 'MEDIUM',
      title: `Zdublowany rejs Vikinga — sprawdź (${vessel}, ${row.departure_at.slice(0, 16)})`,
      titleKey: 'rk_ferry_digitraffic_dup',
      params: { vessel, dep: row.departure_at.slice(0, 16) },
      detail: {
        zrodlo: 'DIGITRAFFIC_VIKING_SCHEDULE', source_ref: sourceRef, trasa: row.route,
        odejscie: row.departure_at, html_odejscie: htmlDep, transporty: loads,
      },
      dedup: `FERRY_UNKNOWN:DIGITRAFFIC_VIKING_DUP:${row.id}`,
      sourceUrl: DIGITRAFFIC_PORT_CALLS_URL,
    });
    risks += 1;
  };
  for (const inc of parsed.sailings) {
    if (Date.parse(inc.departureUtc) < Date.parse(sinceIso)) continue;
    const vesselId = byName.get(inc.vessel);
    if (!vesselId) {
      if (!warnings.includes(`Statek spoza rejestru: ${inc.vessel}`)) {
        warnings.push(`Statek spoza rejestru: ${inc.vessel}`);
      }
      continue;
    }
    const sourceRef = digitrafficPortCallSourceRef(inc.portCallId, inc.route);
    seenRefs.add(sourceRef);
    const byRef = existing.find((s) => s.source_ref === sourceRef);
    if (byRef) {
      if (byRef.source === 'RECZNIE') { manualKept += 1; continue; }
      /* F7 #688 r2 B2 + r3 B2: HTML/plik w ±3 h wygrywa — usuń Digitraffic, nie aktualizuj. */
      const depMsInc = Date.parse(inc.departureUtc);
      const depMsRef = Date.parse(byRef.departure_at);
      const htmlWin = nearestScheduleNeighbor(vesselId, inc.route, depMsInc, byRef.id)
        ?? nearestScheduleNeighbor(vesselId, inc.route, depMsRef, byRef.id);
      if (htmlWin) {
        const loads = deps.store.sailingAssignedLoadCount
          ? await deps.store.sailingAssignedLoadCount(byRef.id)
          : 0;
        if (loads > 0) {
          await raiseDupRisk(byRef, inc.vessel, sourceRef, htmlWin.departure_at, loads);
        } else if (await safeDelete(byRef.id)) {
          removed += 1;
          const ix = existing.findIndex((x) => x.id === byRef.id);
          if (ix >= 0) existing.splice(ix, 1);
        }
        continue;
      }
      const patch: SailingPatch = {};
      const depIso = new Date(inc.departureUtc).toISOString();
      const arrIso = new Date(inc.arrivalUtc).toISOString();
      if (new Date(byRef.departure_at).toISOString() !== depIso) patch.departure_at = depIso;
      if (new Date(byRef.arrival_at).toISOString() !== arrIso) patch.arrival_at = arrIso;
      if (byRef.source !== 'VIKING') patch.source = 'VIKING';
      if (Object.keys(patch).length === 0) continue;
      if (await deps.store.updateSailing(byRef.id, patch)) {
        updated += 1;
        Object.assign(byRef, patch);
      }
      continue;
    }
    const depMs = Date.parse(inc.departureUtc);
    const pool = existing.filter((s) => s.vessel_id === vesselId && s.route === inc.route);
    const pick = pickUniqueInWindow(pool, depMs, (s) => Date.parse(s.departure_at), WINDOW_MS);
    if (pick.kind === 'ambiguous') {
      warnings.push(
        `Digitraffic Viking: niejednoznaczne dopasowanie ${inc.vessel} ${inc.route} (±30 min, ${pick.items.length} rejsy)`,
      );
      await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'MEDIUM',
        title: `Digitraffic: niejednoznaczne dopasowanie ${inc.vessel} — bez zmiany, do weryfikacji HHL`,
        titleKey: 'rk_ferry_status_unknown',
        params: { vessel: inc.vessel, dep: inc.departureUtc.slice(0, 16) },
        detail: {
          zrodlo: 'DIGITRAFFIC_VIKING_SCHEDULE', statek: inc.vessel, trasa: inc.route,
          odejscie: inc.departureUtc, rejsy: pick.items.length,
        },
        dedup: `FERRY_UNKNOWN:DIGITRAFFIC_VIKING:${vesselId}:${inc.route}:${inc.departureUtc}`,
        sourceUrl: DIGITRAFFIC_PORT_CALLS_URL,
      });
      risks += 1;
      continue;
    }
    if (pick.kind === 'hit') {
      /* F7 #688 r1 B3: przy trafieniu oknem ±30 min niczego nie zmienia — HTML/plik/RECZNIE wygrywają. */
      if (pick.item.source === 'RECZNIE') manualKept += 1;
      continue;
    }
    /* F7 #688 r3 B2: rozkład w ±3 h → bez insertu (opóźnienie tylko delayed_* z ferry-portnet). */
    const schedNear = nearestScheduleNeighbor(vesselId, inc.route, depMs);
    if (schedNear) continue;
    const row: SailingInsert = {
      project_id: projectId,
      vessel_id: vesselId,
      route: inc.route,
      departure_at: new Date(inc.departureUtc).toISOString(),
      arrival_at: new Date(inc.arrivalUtc).toISOString(),
      delayed_departure_at: null,
      delayed_arrival_at: null,
      status: 'ZAPLANOWANY',
      source: 'VIKING',
      source_ref: sourceRef,
    };
    /* F7 #688 r3 nieblokujące: konflikt unikalnego source_ref (wiersz poza sinceIso) → bez wyjątku. */
    try {
      await deps.store.insertSailings([row]);
    } catch (e) {
      warnings.push(
        `Digitraffic Viking: konflikt source_ref ${sourceRef} (${e instanceof Error ? e.message : 'błąd'})`,
      );
      continue;
    }
    existing.push({
      id: `digitraffic-vk-${inserted}`,
      vessel_id: vesselId,
      route: inc.route,
      departure_at: row.departure_at,
      arrival_at: row.arrival_at,
      delayed_departure_at: null,
      delayed_arrival_at: null,
      status: 'ZAPLANOWANY',
      source: 'VIKING',
      source_ref: sourceRef,
    });
    inserted += 1;
  }
  /* F7 #688 r2 B1 + r3: usuwanie tylko gdy obie strony OK + niepusta lista ETA i ETD osobno. */
  const nowMs = now.getTime();
  if (completeForRemoval) {
    for (const s of [...existing]) {
      const ref = s.source_ref ?? '';
      if (!ref.startsWith(DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX)) continue;
      if (seenRefs.has(ref)) continue;
      if (s.source === 'RECZNIE') continue;
      if (s.status !== 'ZAPLANOWANY') continue;
      if (Date.parse(s.departure_at) < nowMs) continue;
      const loads = deps.store.sailingAssignedLoadCount
        ? await deps.store.sailingAssignedLoadCount(s.id)
        : 0;
      if (loads > 0) {
        await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `Digitraffic: zgłoszenie portowe wycofane — sprawdź Viking XPRS ${s.departure_at.slice(0, 16)}`,
          titleKey: 'rk_ferry_digitraffic_withdrawn',
          params: { vessel: 'Viking XPRS', dep: s.departure_at.slice(0, 16) },
          detail: {
            zrodlo: 'DIGITRAFFIC_VIKING_SCHEDULE', source_ref: ref, trasa: s.route,
            odejscie: s.departure_at, transporty: loads,
          },
          dedup: `FERRY_UNKNOWN:DIGITRAFFIC_VIKING_WITHDRAWN:${s.id}`,
          sourceUrl: DIGITRAFFIC_PORT_CALLS_URL,
        });
        risks += 1;
        continue;
      }
      if (await safeDelete(s.id)) {
        removed += 1;
        const ix = existing.findIndex((x) => x.id === s.id);
        if (ix >= 0) existing.splice(ix, 1);
      }
    }
  }
  /* F7 #688 r4: klauzule 1–2 (obie 5xx / oba JSON) już early-return z fail — tu tylko struktura. */
  const totalFail = pageEta.ok && pageEtd.ok && !etaHasArr && !etdHasArr;
  return { inserted, updated, manualKept, removed, warnings, fail: totalFail, risks };
}

/** BN2/BN3 — Portnet Digitraffic: ATA/ATD → actual_*; ATA spóźnione ≥ FERRY_PORT_DELAY_MIN → delayed_arrival. */
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
  const byId = new Map(vessels.map((v) => [v.id, v.name]));
  let updated = 0;
  const warnings = [...parsed.warnings];
  const WINDOW_MS = 3 * 3600_000;
  const delayMin = deps.store.ferryPortDelayMin
    ? await deps.store.ferryPortDelayMin()
    : FERRY_PORT_DELAY_MIN_DEFAULT;
  const delayMinMs = Math.max(0, delayMin) * 60_000;
  for (const c of parsed.calls) {
    const vesselId = byName.get(c.vessel);
    if (!vesselId) continue;
    if (c.actualArrivalUtc && c.arrivalRoute) {
      const t = Date.parse(c.actualArrivalUtc);
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === c.arrivalRoute
        && s.actual_arrival_at == null);
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.arrival_at), WINDOW_MS);
      const ataDedup = `FERRY_UNKNOWN:PORTNET_ATA:${vesselId}:${c.actualArrivalUtc}`;
      if (pick.kind === 'ambiguous') {
        // DP-97 F7 #862: params.dep = warsaw (HHL); dedup UTC; auto-zamknięcie dopiero po hicie / gdy okno wyjaśnione.
        warnings.push(`Portnet ATA niejednoznaczna: ${c.vessel} ${c.arrivalRoute} (±3 h, ${pick.items.length} rejsy)`);
        await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `Portnet: niejednoznaczne dopasowanie ATA ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: warsaw(c.actualArrivalUtc) },
          detail: { zrodlo: 'DIGITRAFFIC_PORTCALL', statek: c.vessel, ata: c.actualArrivalUtc, rejsy: pick.items.length },
          dedup: ataDedup,
        });
        continue;
      }
      // F7 #660: RECZNIE → tylko actual_*; ODWOLANY bez zmiany statusu (jak AIS).
      // BN3 decyzja 58: ATA − arrival ≥ FERRY_PORT_DELAY_MIN → delayed_arrival_at (ATD bez opóźnienia wypłynięcia).
      // DP-93: delayed_arrival_at nie dopisywane rejsowi ODWOLANY.
      if (pick.kind === 'hit') {
        const hit = pick.item;
        const lateArr = t - Date.parse(hit.arrival_at) >= delayMinMs;
        const setDelayed = lateArr && hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY';
        const patch = sailingActualPatch(
          hit,
          {
            actual_arrival_at: c.actualArrivalUtc,
            ...(setDelayed ? { delayed_arrival_at: c.actualArrivalUtc } : {}),
          },
          'DOPLYNAL',
        );
        if (await deps.store.updateSailing(hit.id, patch)) {
          updated += 1;
          hit.actual_arrival_at = c.actualArrivalUtc;
          if (setDelayed) hit.delayed_arrival_at = c.actualArrivalUtc;
          if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'DOPLYNAL';
        }
        await deps.store.resolveRisks(ataDedup);
      } else if (pick.kind === 'none') {
        /* Okno bez kandydatów bez ATA = sprawa wyjaśniona (wszystkie actual_* albo brak rejsu). */
        await deps.store.resolveRisks(ataDedup);
      }
    }
    if (c.actualDepartureUtc && c.departureRoute) {
      const t = Date.parse(c.actualDepartureUtc);
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === c.departureRoute
        && s.actual_departure_at == null);
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.departure_at), WINDOW_MS);
      const atdDedup = `FERRY_UNKNOWN:PORTNET_ATD:${vesselId}:${c.actualDepartureUtc}`;
      if (pick.kind === 'ambiguous') {
        warnings.push(`Portnet ATD niejednoznaczna: ${c.vessel} ${c.departureRoute} (±3 h, ${pick.items.length} rejsy)`);
        await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `Portnet: niejednoznaczne dopasowanie ATD ${byId.get(vesselId) ?? c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: warsaw(c.actualDepartureUtc) },
          detail: { zrodlo: 'DIGITRAFFIC_PORTCALL', statek: c.vessel, atd: c.actualDepartureUtc, rejsy: pick.items.length },
          dedup: atdDedup,
        });
        continue;
      }
      if (pick.kind === 'hit' && await deps.store.updateSailing(
        pick.item.id, sailingActualPatch(pick.item, { actual_departure_at: c.actualDepartureUtc }, 'W_REJSIE'),
      )) {
        updated += 1;
        pick.item.actual_departure_at = c.actualDepartureUtc;
        if (pick.item.source !== 'RECZNIE' && pick.item.status !== 'ODWOLANY') pick.item.status = 'W_REJSIE';
      }
      if (pick.kind === 'hit' || pick.kind === 'none') {
        await deps.store.resolveRisks(atdDedup);
      }
    }
  }
  return { updated, warnings, fail: false };
}

/**
 * F7 #696 r1 B5 — id Portnet do „zniknięcia” tylko przy kompletnej odpowiedzi
 * etaFrom/etaTo + etdFrom/etdTo (jak DP-116/#688 completeForRemoval).
 */
async function fetchCancelSuspectPortCallIds(deps: JobDeps): Promise<{
  ids: Set<string> | null; warnings: string[];
}> {
  const now = deps.now();
  const fromIso = new Date(now.getTime() - 2 * 864e5).toISOString();
  const toIso = new Date(now.getTime() + 864e5).toISOString();
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Accept-Encoding': 'gzip',
    'Digitraffic-User': DIGITRAFFIC_USER,
  };
  const [pageEta, pageEtd] = await Promise.all([
    readText(deps, digitrafficPortCallsUrl({ etaFrom: fromIso, etaTo: toIso }), { headers }),
    readText(deps, digitrafficPortCallsUrl({ etdFrom: fromIso, etdTo: toIso }), { headers }),
  ]);
  const warnings: string[] = [];
  if (!pageEta.ok) warnings.push(`cancel-suspect Portnet ETA: ${pageEta.warning}`);
  if (!pageEtd.ok) warnings.push(`cancel-suspect Portnet ETD: ${pageEtd.warning}`);
  let etaJson: unknown = null;
  let etdJson: unknown = null;
  let etaParseOk = false;
  let etdParseOk = false;
  if (pageEta.ok) {
    try { etaJson = JSON.parse(pageEta.text); etaParseOk = true; } catch {
      warnings.push('cancel-suspect Portnet ETA: nieczytelny JSON');
    }
  }
  if (pageEtd.ok) {
    try { etdJson = JSON.parse(pageEtd.text); etdParseOk = true; } catch {
      warnings.push('cancel-suspect Portnet ETD: nieczytelny JSON');
    }
  }
  const ids = mergePortCallIdsIfComplete({
    etaOk: pageEta.ok && etaParseOk,
    etdOk: pageEtd.ok && etdParseOk,
    etaJson,
    etdJson,
  });
  if (!ids) {
    warnings.push('cancel-suspect Portnet: niepełna odpowiedź — bez sygnału zniknięcia');
  }
  return { ids, warnings };
}

/**
 * BN3 decyzja 61 / 61b — podejrzenie odwołania (Zatoka Fińska).
 * Podnoszenie: bez ATD i bez ATA; ETA+45…+90 **albo** zniknięcie (dep+45…ETA+90) + AIS w hubie wyjścia.
 * Keep poza oknem do ATD/ATA / AIS clear (≥3 kn lub poza geofence) / HHL.
 * F7 #696 r3: otwarte dedupy niezależnie od since; SOG null ≠ clear.
 */
async function applyCancelSuspectAis(
  deps: JobDeps,
  sinceIso: string,
  activePortCallIds: Set<string> | null,
): Promise<{ risks: number; hits: number; warnings: string[]; aisDown: boolean }> {
  const nowIso = deps.now().toISOString();
  const nowMs = Date.parse(nowIso);
  const [vessels, recent] = await Promise.all([
    deps.store.vessels(), deps.store.sailingsSince(sinceIso),
  ]);
  /* F7 r3 B1: otwarte podejrzenia + rejsy poza since — inaczej resolve zamyka po ~24 h. */
  const openRows = deps.store.openCancelSuspectSailings
    ? await deps.store.openCancelSuspectSailings()
    : null;
  const canSafelyResolve = openRows !== null;
  const openIds = new Set((openRows ?? []).map((s) => s.id));
  const bySailing = new Map<string, DbSailing>();
  for (const s of recent) bySailing.set(s.id, s);
  for (const s of openRows ?? []) bySailing.set(s.id, s);
  const existing = [...bySailing.values()];
  const byId = new Map(vessels.map((v) => [v.id, v]));
  /** VesselFix | null (pusta/brak) | 'DOWN' (HTTP/zła struktura). */
  const aisCache = new Map<number, VesselFix | null | 'DOWN'>();
  const warnings: string[] = [];
  const keep: string[] = [];
  let risks = 0;
  let hits = 0;
  let aisDown = false;
  /** Przebieg z ≥1 poprawną odpowiedzią AIS (także puste features) — wolno zamknąć SOURCE_DOWN. */
  let aisOkSeen = false;

  const aisHeaders = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Accept-Encoding': 'gzip',
    'Digitraffic-User': DIGITRAFFIC_USER,
  };

  for (const s of existing) {
    if (!isGulfFerryRoute(s.route)) continue;
    /* ODWOLANY zamyka; DOPLYNAL bez ATA nie zamyka (F7 r3 61b). */
    if (s.status === 'ODWOLANY') continue;
    /* 61b: ATD lub ATA → zamknij podejrzenie (brak w keep). */
    if (s.actual_arrival_at != null || s.actual_departure_at != null) continue;

    const etaIso = s.delayed_arrival_at ?? s.arrival_at;
    const trig = cancelSuspectTrigger({
      etaIso,
      departureIso: s.departure_at,
      nowMs,
      sourceRef: s.source_ref,
      activePortCallIds,
    });
    const open = openIds.has(s.id);
    /* Poza oknem: tylko utrzymuj / gaś istniejące. */
    if (!trig.check && !open) continue;

    const v = byId.get(s.vessel_id);
    if (!v?.mmsi) {
      warnings.push(`cancel-suspect: brak MMSI ${s.id}`);
      if (open) keep.push(cancelSuspectRiskDedup(s.id));
      continue;
    }
    let cached = aisCache.get(v.mmsi);
    if (cached === undefined) {
      const page = await readText(deps, digitrafficAisUrl(v.mmsi), { headers: aisHeaders });
      if (!page.ok) {
        warnings.push(`cancel-suspect AIS ${v.mmsi}: ${page.warning}`);
        aisCache.set(v.mmsi, 'DOWN');
        cached = 'DOWN';
      } else {
        try {
          const json = JSON.parse(page.text) as unknown;
          if (!isDigitrafficAisPayloadOk(json)) {
            warnings.push(`cancel-suspect AIS ${v.mmsi}: zła struktura`);
            cached = 'DOWN';
          } else {
            aisOkSeen = true;
            cached = parseDigitrafficLocations(json, v.mmsi) ?? null;
          }
        } catch {
          warnings.push(`cancel-suspect AIS ${v.mmsi}: nieczytelny JSON`);
          cached = 'DOWN';
        }
        aisCache.set(v.mmsi, cached);
      }
    }
    /* NB2 / B4: awaria lub nieznany stan AIS → keep (nie gaś); DOWN → SOURCE_DOWN. */
    if (cached === 'DOWN') {
      aisDown = true;
      keep.push(cancelSuspectRiskDedup(s.id));
      continue;
    }
    const fix = cached;
    if (!fix || !isFreshAisFix(fix, nowIso)) {
      keep.push(cancelSuspectRiskDedup(s.id));
      continue;
    }
    /* F7 r3 B2: clear tylko poza geofence albo SOG ≥ 3; null/1 kn w porcie → keep. */
    if (aisClearsCancelSuspect(fix, s.route)) continue;

    keep.push(cancelSuspectRiskDedup(s.id));
    /* DOPLYNAL bez ATA: keep, bez nowego podniesienia. */
    if (s.status === 'DOPLYNAL') continue;
    if (!trig.check) continue; /* poza oknem: tylko keep */
    /* Podnoszenie nadal wymaga SOG≈0 w hubie wyjścia. */
    if (!isStandingAtDeparturePort(fix, s.route)) continue;

    const depHubs = departureHubsForRoute(s.route);
    const hub = nearestGulfHub(fix.lat, fix.lon, undefined, depHubs);
    const reason = trig.due && trig.disappeared ? 'BOTH'
      : trig.disappeared ? 'PORTCALL_GONE'
        : 'ETA_GRACE';
    const risk = cancelSuspectRisk({
      sailingId: s.id,
      vessel: v.name,
      route: s.route,
      departureAt: s.departure_at,
      etaIso,
      reason,
      hubCode: hub?.code ?? null,
      sogKn: fix.sogKn,
      nowIso,
    });
    hits += 1;
    if (await deps.store.raiseRisk(risk)) risks += 1;
  }

  if (aisDown) {
    if (await deps.store.raiseRisk(sourceDownRisk(
      'DIGITRAFFIC_AIS',
      warnings.length ? warnings.filter((w) => /AIS/i.test(w)) : ['Brak odpowiedzi Digitraffic AIS'],
      nowIso,
      DIGITRAFFIC_AIS_LOCATIONS_URL,
    ))) risks += 1;
  } else if (aisOkSeen) {
    /* F7 #696 r2 pkt 5: zamykaj SOURCE_DOWN tylko po realnym, poprawnym odczycie AIS. */
    await deps.store.resolveRisks('SOURCE_DOWN:DIGITRAFFIC_AIS:');
  }

  /* F7 r3 B1: bez openCancelSuspectSailings — nie zamykaj niczego (zamiast zamykać wszystko). */
  if (canSafelyResolve) {
    if (deps.store.resolveStaleRisks) {
      await deps.store.resolveStaleRisks(CANCEL_SUSPECT_DEDUP_PREFIX, keep);
    } else if (!keep.length) {
      await deps.store.resolveRisks(CANCEL_SUSPECT_DEDUP_PREFIX);
    }
  }
  return { risks, hits, warnings, aisDown };
}

/**
 * F7 #660: Portnet = FI (HEL/VUO); Ports of Stockholm = SE (STO/KPS) — brak ATA w EE.
 * Po arrival_at + 2 h bez ATA → DOPLYNAL (actual_arrival_at = null). F7 r2: + STO-TLL, KPS-PLD.
 * F7 #696 r1: nie zamykaj, gdy otwarte podejrzenie odwołania (decyzja 61b — do HHL / ATA).
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
    if (deps.store.hasOpenRisk
      && await deps.store.hasOpenRisk(cancelSuspectRiskDedup(s.id))) {
      continue;
    }
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
 * DP-102 / F7 #871 — nota AUTO z ts.ee: treść komunikatu bez nagłówka kolumny
 * „Lisainfo” / „Additional info” (źródło i tak w source_url + source=AUTO).
 */
export function portTallinnCancelNote(lisainfo: string | null | undefined): string {
  const raw = (lisainfo ?? '').trim();
  if (!raw) return 'Port of Tallinn: odwołanie (ts.ee)';
  const stripped = raw
    .replace(/^(?:Lisainfo\s*:?\s*|Additional\s+info\s*:\s*)/i, '')
    .trim();
  return stripped || 'Port of Tallinn: odwołanie (ts.ee)';
}

/**
 * BN2 / F7 r3 — Port of Tallinn: tylko odwołania na istniejących.
 * DP-102 (F7 #683): reguła jednego kandydata w ±30 min (tablica ma godzinę);
 * bez `existing.find` ±3 h. Bez insertów / godzin / actual_* z planu.
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
  // DP-102: komunikat z godziną tablicy → ±30 min + dokładnie 1 kandydat.
  const WINDOW_MS = 30 * 60_000;
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
    const pool = existing.filter((s) =>
      s.vessel_id === vesselId
      && s.route === e.route
      && s.status !== 'ODWOLANY'
      && s.source !== 'RECZNIE');
    const pick = pickUniqueInWindow(
      pool,
      t,
      (s) => Date.parse(e.kind === 'DEPARTURE' ? s.departure_at : s.arrival_at),
      WINDOW_MS,
    );
    const ambDedup = `FERRY_UNKNOWN:TS_EE:${vesselId}:${e.route}:${e.atUtc}`;
    // F7 #871 (nieblokujące): ambiguous w ±30 min → ryzyko HHL jak Portnet FERRY_UNKNOWN.
    if (pick.kind === 'ambiguous') {
      warnings.push(
        `ts.ee odwołanie niejednoznaczne: ${e.vessel} ${e.route} (±30 min, ${pick.items.length} rejsy)`,
      );
      await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'MEDIUM',
        title: `ts.ee: niejednoznaczne odwołanie ${e.vessel} — bez zmiany, do weryfikacji HHL`,
        titleKey: 'rk_ferry_status_unknown',
        params: { vessel: e.vessel, dep: warsaw(e.atUtc) },
        detail: {
          zrodlo: 'PORT_TALLINN', statek: e.vessel, at: e.atUtc, rejsy: pick.items.length,
        },
        dedup: ambDedup,
      });
      continue;
    }
    if (pick.kind === 'none') {
      await deps.store.resolveRisks(ambDedup);
      continue;
    }
    const hit = pick.item;
    // DP-101 / F7 #866: atomowe AUTO ODWOLANY + notice (RPC) — bez wyścigu dwóch przebiegów.
    const cancelledOk = deps.store.cancelSailingAuto
      ? await deps.store.cancelSailingAuto({
        sailingId: hit.id,
        // DP-99: data-company / company z ts.ee, potem source, potem pierwotny armator trasy.
        operator: operatorFromSailingSource(hit.source, hit.route, e.company),
        note: portTallinnCancelNote(e.lisainfo),
        sourceUrl: e.kind === 'DEPARTURE' ? PORT_TALLINN_DEPARTURES_URL : PORT_TALLINN_ARRIVALS_URL,
      })
      : await deps.store.updateSailing(hit.id, { status: 'ODWOLANY' });
    if (cancelledOk) {
      cancelled += 1;
      hit.status = 'ODWOLANY';
    }
    await deps.store.resolveRisks(ambDedup);
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
  const parsed = page.ok
    ? parsePolferriesSchedule(page.text, { now: deps.now() })
    : { sailings: [], warnings: [page.warning] };
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
  /* #685-a / decyzja 63a: Digitraffic FIHEL ES / XPRS — najbliższe dni (także gdy HTML 403).
     SOURCE_DOWN zostaje przy vkFail (zamyka dopiero 63c / plik ≥ 30 dni). */
  const vkDt = await applyDigitrafficVikingNearSchedule(deps, since);
  warnings.push(...vkDt.warnings);
  inserted += vkDt.inserted;
  updated += vkDt.updated;
  manualKept += vkDt.manualKept;
  risks += vkDt.risks;
  /* F7 #688 r2 nieblokujące: całkowita awaria Digitraffic przy działającym HTML → SOURCE_DOWN DIGITRAFFIC_VIKING. */
  if (vkDt.fail) {
    await deps.store.raiseRisk(sourceDownRisk(
      'DIGITRAFFIC_VIKING',
      vkDt.warnings.length ? vkDt.warnings : ['Digitraffic Portnet (Viking) niedostępny'],
      now,
      DIGITRAFFIC_PORT_CALLS_URL,
    ));
    risks += 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:DIGITRAFFIC_VIKING:');
  }
  if (vkFail) {
    /* F7 #690 R2-B4 / 63c: max(departure_at) bez limitu 1000 wierszy sailingsSince.
       Cron: pokrycie ≥ 30 d → nie wystawiaj / zamknij. */
    let covDays = 0;
    if (deps.store.maxVikingFileDepartureAt) {
      const maxDep = await deps.store.maxVikingFileDepartureAt(now);
      covDays = vikingCoverageDaysFromMaxDeparture(maxDep, Date.parse(now));
    } else {
      const covRows = await deps.store.sailingsSince(now);
      covDays = vikingScheduleCoverageDaysFromNow(covRows, Date.parse(now));
    }
    if (covDays >= VIKING_FILE_COVERAGE_DAYS_CLOSE) {
      await deps.store.resolveRisks('SOURCE_DOWN:VIKING_SCHEDULE:');
    } else {
      await deps.store.raiseRisk(sourceDownRisk(
        'VIKING_SCHEDULE',
        viking.warnings.length ? viking.warnings : ['Brak odpowiedzi Viking'],
        now,
        VIKING_CARGO_HEL_TLL_PAGE,
      ));
      risks += 1;
    }
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

  /* #666 decyzja 54 + E: DFDS Dynamic schedule — osobny krok; tu rozszerzenie tygodniówki.
     F7 #668 r7 (decyzja 50): resolveRisks tylko gdy API dało rejsy; sam PDF/HTML → SOURCE_DOWN MEDIUM.
     DP-29: structureFail → opis ryzyka z „nieczytelny…”; DP-32: klucz bez daty. */
  const dfds = await fetchDfdsDays(deps, 60);
  warnings.push(...dfds.warnings);
  const dfFail = dfds.sailings.length === 0;
  if (dfds.sailings.length > 0) {
    const incomingD: IncomingSailing[] = dfds.sailings.map((s) => ({
      route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
    }));
    const r = await applySailings(deps, incomingD, since, 'DFDS');
    inserted += r.plan.inserts.length; updated += r.updated; manualKept += r.manualKept; unchanged += r.plan.unchanged;
    warnings.push(...r.plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`));
  }
  if (dfds.apiSailingsCount > 0) {
    await deps.store.resolveRisks('SOURCE_DOWN:DFDS_SCHEDULE');
  } else {
    const fromPdfOnly = dfds.sailings.length > 0;
    const structHint = dfds.structureFail
      ? ['DFDS: nieczytelny rozkład API (struktura / nieczytelny rejs) — HHL weryfikuje']
      : [];
    const msgs = fromPdfOnly
      ? [
        ...structHint,
        'główne źródło DFDS niedostępne lub zmienione — rozkład z zapasu PDF',
        ...dfds.warnings.slice(0, 8),
      ]
      : (structHint.length
        ? [...structHint, ...dfds.warnings.slice(0, 9)]
        : (dfds.warnings.length ? dfds.warnings : ['Brak odpowiedzi DFDS']));
    const risk = sourceDownRisk('DFDS_SCHEDULE', msgs, now, DFDS_SCHEDULE_PAGE);
    if (fromPdfOnly) risk.severity = 'MEDIUM';
    await deps.store.raiseRisk(risk);
    risks += 1;
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

  /* BN3 decyzja 61 / F7 #696 r1: podejrzenie PRZED closeStale — otwarte ryzyko blokuje auto-DOPLYNAL (61b). */
  const portIds = await fetchCancelSuspectPortCallIds(deps);
  warnings.push(...portIds.warnings);
  const suspect = await applyCancelSuspectAis(deps, since, portIds.ids);
  warnings.push(...suspect.warnings);
  risks += suspect.risks;

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

  /* BN3 pkt 7: Digitraffic winter-navigation v2 — ograniczenie lodowe / zawieszenie portu → FERRY MEDIUM. */
  const winter = await applyWinterNavigation(deps, now);
  warnings.push(...winter.warnings);
  risks += winter.risks;

  /* DP-121 / decyzja 100: v2 cancelled → ryzyko HIGH HHL; bez ODWOLANY / notice. */
  const v2c = await applyPortCallV2Cancelled(deps, since, now);
  warnings.push(...v2c.warnings);
  risks += v2c.risks;

  /* BN3 pkt 7: Urząd Morski Gdynia — zapas ETA/ATA/ETD Stena GDY↔KAA + DP-222 Polferries GDN. */
  const umg = await applyUmgdyStenaBackup(deps, since);
  warnings.push(...umg.warnings);
  updated += umg.updated;
  risks += umg.risks;

  /* DP-222 F7 #818 B2: po UMG — domknij GDN-NYN W_REJSIE bez ATA (późniejszy ATD / arrival+6h). */
  const closedGdn = await closeStaleGdnNynWithoutAta(deps);
  updated += closedGdn;

  return {
    /* Winter-nav / v2 / UMG / cancel-suspect: awaria → ryzyko, bez wywracania ok Portnet. */
    job: 'ferry-portnet', mode: 'LIVE', ok: !portnet.fail,
    updated, risks, warnings,
    observations: {
      ...(closed ? { closed_without_ata: String(closed) } : {}),
      ...(closedGdn ? { dp222_closed_gdn: String(closedGdn) } : {}),
      ...(winter.hits ? { winter_hits: String(winter.hits) } : {}),
      ...(v2c.fihel ? { port_call_v2_fihel_cancelled: '1' } : {}),
      port_call_v2_fleet_n: String(v2c.fleet),
      port_call_v2_cancelled_n: String(v2c.count),
      ...(v2c.matched ? { port_call_v2_matched: String(v2c.matched) } : {}),
      ...(v2c.reissued ? { port_call_v2_reissued: String(v2c.reissued) } : {}),
      umg_stena_rows: String(umg.rows),
      ...(umg.updated ? { umg_stena_updated: String(umg.updated) } : {}),
      /* DP-124 / F7 #796: puste komórki czasu UMG (bez ostrzeżeń). */
      umg_empty_time: String(umg.emptyTime),
      ...(suspect.hits ? { cancel_suspect_hits: String(suspect.hits) } : {}),
    },
  };
}

/** BN3: winter-navigation/v2/locations → ryzyka FERRY_WINTER:* (MEDIUM). */
async function applyWinterNavigation(deps: JobDeps, nowIso: string): Promise<{
  hits: number; risks: number; warnings: string[]; fail: boolean;
}> {
  const page = await readText(deps, WINTER_NAV_LOCATIONS_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Digitraffic-User': DIGITRAFFIC_USER,
    },
  });
  if (!page.ok) {
    await deps.store.raiseRisk(sourceDownRisk(
      'DIGITRAFFIC_WINTER',
      [page.warning],
      nowIso,
      WINTER_NAV_LOCATIONS_URL,
    ));
    return { hits: 0, risks: 1, warnings: [page.warning], fail: true };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:DIGITRAFFIC_WINTER:');
  let json: unknown;
  try { json = JSON.parse(page.text); } catch {
    const w = 'winter-nav: nieczytelny JSON';
    await deps.store.raiseRisk(sourceDownRisk('DIGITRAFFIC_WINTER', [w], nowIso, WINTER_NAV_LOCATIONS_URL));
    return { hits: 0, risks: 1, warnings: [w], fail: true };
  }
  const parsed = parseWinterNavigationLocations(json, nowIso);
  const warnings = [...parsed.warnings];
  if (parsed.warnings.some((w) => /struktura/i.test(w))) {
    await deps.store.raiseRisk(sourceDownRisk('DIGITRAFFIC_WINTER', parsed.warnings, nowIso, WINTER_NAV_LOCATIONS_URL));
    return { hits: 0, risks: 1, warnings, fail: true };
  }
  const keep: string[] = [];
  let risks = 0;
  for (const hit of parsed.hits) {
    const risk = winterNavIceRisk(hit, nowIso);
    keep.push(risk.dedup);
    if (await deps.store.raiseRisk(risk)) risks += 1;
  }
  if (deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('FERRY_WINTER:', keep);
  } else if (!keep.length) {
    await deps.store.resolveRisks('FERRY_WINTER:');
  }
  return { hits: parsed.hits.length, risks, warnings, fail: false };
}

/**
 * BN3: UMG Gdynia — zapas ATA (KAA-GDY) / ETD (GDY-KAA) / ETA→delayed_arrival (KAA-GDY).
 * Tylko gdy primary (Stena/Portnet/AIS) nie ustawił actual_*; ±3 h; RECZNIE/ODWOLANY jak Portnet.
 * F7 #695 r1: przyszłe ETD → delayed_departure (próg); SOURCE_DOWN tylko po 3×OK.
 * F7 #695 r2 B2: delayed_* tylko przy otwartym SOURCE_DOWN:STENA_STATUS (bez skakania z feedem Steny);
 *   wtedy UMG może aktualizować własną poprzednią wartość.
 * F7 #695 r2 B4: przeszłe ETD→actual tylko gdy strona „w porcie” OK i statku na niej nie ma.
 */
async function applyUmgdyStenaBackup(deps: JobDeps, sinceIso: string): Promise<{
  updated: number; rows: number; emptyTime: number; risks: number; warnings: string[];
}> {
  const nowIso = deps.now().toISOString();
  const nowMs = Date.parse(nowIso);
  const headers = { 'User-Agent': UMG_UA, Accept: 'text/html,application/xhtml+xml' };
  const pages: { url: string; kind: UmgKind }[] = [
    { url: UMG_EXPECTED_URL, kind: 'ETA' },
    { url: UMG_IN_PORT_URL, kind: 'ATA' },
    { url: UMG_OUTGOING_URL, kind: 'ETD' },
  ];
  const warnings: string[] = [];
  const allRows: UmgShipRow[] = [];
  const gdanskRows: UmgShipRow[] = [];
  let okPages = 0;
  let inPortPageOk = false;
  let gdanskInPortPageOk = false;
  let emptyTime = 0;
  const umgStructureFail = (ws: string[]) =>
    ws.some((w) => /struktura|pusta tabela/i.test(w));
  for (const p of pages) {
    const page = await readText(deps, p.url, { headers });
    if (!page.ok) {
      warnings.push(`UMG ${p.kind}: ${page.warning}`);
      continue;
    }
    const parsed = parseUmgdyGdyniaHtml(page.text, p.kind);
    warnings.push(...parsed.warnings);
    emptyTime += parsed.emptyTime;
    if (!umgStructureFail(parsed.warnings)) {
      okPages += 1;
      if (p.kind === 'ATA') inPortPageOk = true;
      allRows.push(...parsed.rows);
    }
    /* DP-222: Gdańsk Nowy Port (Polferries). Sekcja opcjonalna — bez „brak sekcji”.
     * Pusta tabela OK (brak Polferries w porcie ≠ awaria); struktura = brak tabeli/nagłówków. */
    const gdansk = parseUmgdyGdanskNowyHtml(page.text, p.kind);
    const gdanskMissing = gdansk.warnings.some((w) => /brak sekcji Gdańsk Nowy Port/i.test(w));
    if (!gdanskMissing) {
      const gdanskBroken = gdansk.warnings.some((w) =>
        /brak tabeli desktopowej|brak nagłówków kolumn/i.test(w));
      warnings.push(...gdansk.warnings.filter((w) =>
        !/pusta tabela/i.test(w) && !/brak sekcji/i.test(w)));
      emptyTime += gdansk.emptyTime;
      if (!gdanskBroken) {
        if (p.kind === 'ATA') gdanskInPortPageOk = true;
        gdanskRows.push(...gdansk.rows);
      }
    }
  }
  /* F7 #695 r1 B3: zamykać SOURCE_DOWN tylko gdy wszystkie 3 strony OK. */
  let risks = 0;
  if (okPages < pages.length) {
    await deps.store.raiseRisk(sourceDownRisk(
      'UMG_GDY',
      warnings.length ? warnings : ['Brak odpowiedzi Urzędu Morskiego Gdynia'],
      nowIso,
      UMG_IN_PORT_URL,
    ));
    risks = 1;
  } else {
    await deps.store.resolveRisks('SOURCE_DOWN:UMG_GDY:');
  }

  const candidates = stenaUmgCandidates(allRows);
  const polCandidates = polferriesUmgCandidates(gdanskRows);
  const vessels = await deps.store.vessels();
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  const existing = await deps.store.sailingsSince(sinceIso);
  const WINDOW_MS = 3 * 3600_000;
  const delayMin = deps.store.ferryPortDelayMin
    ? await deps.store.ferryPortDelayMin()
    : FERRY_PORT_DELAY_MIN_DEFAULT;
  const delayMinMs = Math.max(0, delayMin) * 60_000;
  /* F7 #695 r2 B2: delayed_* tylko gdy status Steny nie działa. */
  const stenaStatusDown = deps.store.hasOpenRisk
    ? await deps.store.hasOpenRisk('SOURCE_DOWN:STENA_STATUS:')
    : false;
  const polStatusDown = deps.store.hasOpenRisk
    ? await deps.store.hasOpenRisk('SOURCE_DOWN:POLFERRIES_STATUS:')
    : false;
  /* Statki nadal na liście „w porcie” — past ETD nie może stać się actual. */
  const inPortNames = new Set(allRows.filter((r) => r.kind === 'ATA').map((r) => r.vessel));
  const gdanskInPortNames = new Set(
    gdanskRows.filter((r) => r.kind === 'ATA').map((r) => r.vessel),
  );
  let updated = 0;

  for (const c of candidates) {
    const vesselId = byName.get(c.vessel);
    if (!vesselId) continue;
    /* DP-124: ATA bez godziny — tylko obecność w porcie (inPortNames); bez actual. */
    if (c.kind === 'ATA' && !c.atUtc) continue;
    if (!c.atUtc) continue;
    const t = Date.parse(c.atUtc);
    if (!Number.isFinite(t)) continue;

    if (c.kind === 'ATA') {
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === 'KAA-GDY'
        && s.actual_arrival_at == null
        && s.status !== 'ODWOLANY');
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.arrival_at), WINDOW_MS);
      if (pick.kind === 'ambiguous') {
        warnings.push(`UMG ATA niejednoznaczna: ${c.vessel} KAA-GDY (±3 h, ${pick.items.length} rejsy)`);
        if (await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `UMG: niejednoznaczne dopasowanie ATA ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
          detail: { zrodlo: 'UMG_GDY', statek: c.vessel, ata: c.atUtc, rejsy: pick.items.length },
          dedup: `FERRY_UNKNOWN:UMG_ATA:${vesselId}:${c.atUtc}`,
        })) risks += 1;
        continue;
      }
      if (pick.kind !== 'hit') continue;
      const hit = pick.item;
      const patch = sailingActualPatch(hit, { actual_arrival_at: c.atUtc }, 'DOPLYNAL');
      if (await deps.store.updateSailing(hit.id, patch)) {
        updated += 1;
        hit.actual_arrival_at = c.atUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'DOPLYNAL';
      }
      continue;
    }

    if (c.kind === 'ETD') {
      /* F7 #695 r1 B1 + r2 B2: przyszłe ETD → delayed_departure tylko przy SOURCE_DOWN:STENA_STATUS. */
      if (t > nowMs) {
        if (!stenaStatusDown) continue;
        const pool = existing.filter((s) =>
          s.vessel_id === vesselId
          && s.route === 'GDY-KAA'
          && s.actual_departure_at == null
          && s.source !== 'RECZNIE'
          && s.status !== 'ODWOLANY');
        const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.departure_at), WINDOW_MS);
        if (pick.kind === 'ambiguous') {
          warnings.push(`UMG ETD niejednoznaczna: ${c.vessel} GDY-KAA (±3 h, ${pick.items.length} rejsy)`);
          if (await deps.store.raiseRisk({
            kind: 'FERRY', severity: 'MEDIUM',
            title: `UMG: niejednoznaczne dopasowanie ETD ${c.vessel} — bez zmiany, do weryfikacji HHL`,
            titleKey: 'rk_ferry_status_unknown',
            params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
            detail: { zrodlo: 'UMG_GDY', statek: c.vessel, etd: c.atUtc, rejsy: pick.items.length },
            dedup: `FERRY_UNKNOWN:UMG_ETD:${vesselId}:${c.atUtc}`,
          })) risks += 1;
          continue;
        }
        if (pick.kind !== 'hit') continue;
        const hit = pick.item;
        if (t - Date.parse(hit.departure_at) < delayMinMs) continue;
        if (hit.delayed_departure_at === c.atUtc) continue;
        if (await deps.store.updateSailing(hit.id, { delayed_departure_at: c.atUtc })) {
          updated += 1;
          hit.delayed_departure_at = c.atUtc;
        }
        continue;
      }
      /* F7 #695 r2 B4: przeszłe ETD→actual tylko gdy „w porcie” OK i statku nie ma. */
      if (!inPortPageOk || inPortNames.has(c.vessel)) continue;
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === 'GDY-KAA'
        && s.actual_departure_at == null
        && s.status !== 'ODWOLANY');
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.departure_at), WINDOW_MS);
      if (pick.kind === 'ambiguous') {
        warnings.push(`UMG ETD niejednoznaczna: ${c.vessel} GDY-KAA (±3 h, ${pick.items.length} rejsy)`);
        if (await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `UMG: niejednoznaczne dopasowanie ETD ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
          detail: { zrodlo: 'UMG_GDY', statek: c.vessel, etd: c.atUtc, rejsy: pick.items.length },
          dedup: `FERRY_UNKNOWN:UMG_ETD:${vesselId}:${c.atUtc}`,
        })) risks += 1;
        continue;
      }
      if (pick.kind !== 'hit') continue;
      const hit = pick.item;
      const patch = sailingActualPatch(hit, { actual_departure_at: c.atUtc }, 'W_REJSIE');
      if (await deps.store.updateSailing(hit.id, patch)) {
        updated += 1;
        hit.actual_departure_at = c.atUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'W_REJSIE';
      }
      continue;
    }

    /* F7 #695 r2 B2: ETA→delayed tylko przy SOURCE_DOWN:STENA_STATUS; może aktualizować własne. */
    if (c.kind === 'ETA') {
      if (!stenaStatusDown) continue;
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === 'KAA-GDY'
        && s.actual_arrival_at == null
        && s.source !== 'RECZNIE'
        && s.status !== 'ODWOLANY');
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.arrival_at), WINDOW_MS);
      if (pick.kind === 'ambiguous') {
        warnings.push(`UMG ETA niejednoznaczna: ${c.vessel} KAA-GDY (±3 h, ${pick.items.length} rejsy)`);
        if (await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `UMG: niejednoznaczne dopasowanie ETA ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
          detail: { zrodlo: 'UMG_GDY', statek: c.vessel, eta: c.atUtc, rejsy: pick.items.length },
          dedup: `FERRY_UNKNOWN:UMG_ETA:${vesselId}:${c.atUtc}`,
        })) risks += 1;
        continue;
      }
      if (pick.kind !== 'hit') continue;
      const hit = pick.item;
      if (t - Date.parse(hit.arrival_at) < delayMinMs) continue;
      if (hit.delayed_arrival_at === c.atUtc) continue;
      if (await deps.store.updateSailing(hit.id, { delayed_arrival_at: c.atUtc })) {
        updated += 1;
        hit.delayed_arrival_at = c.atUtc;
      }
    }
  }

  /* DP-222 #814: Polferries GDN-NYN — past ETD z Gdańsk Nowy Port → actual_departure_at.
   * Digitraffic nie pokrywa Zatoki; AISSTREAM często bez pary geofence ≤20 min. */
  for (const c of polCandidates) {
    const vesselId = byName.get(c.vessel);
    if (!vesselId) continue;
    if (c.kind === 'ATA' && !c.atUtc) continue;
    if (!c.atUtc) continue;
    const t = Date.parse(c.atUtc);
    if (!Number.isFinite(t)) continue;

    if (c.kind === 'ATA') {
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === 'NYN-GDN'
        && s.actual_arrival_at == null
        && s.status !== 'ODWOLANY');
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.arrival_at), WINDOW_MS);
      if (pick.kind === 'ambiguous') {
        warnings.push(`UMG ATA niejednoznaczna: ${c.vessel} NYN-GDN (±3 h, ${pick.items.length} rejsy)`);
        if (await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `UMG: niejednoznaczne dopasowanie ATA ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
          detail: { zrodlo: 'UMG_GDN', statek: c.vessel, ata: c.atUtc, rejsy: pick.items.length },
          dedup: `FERRY_UNKNOWN:UMG_GDN_ATA:${vesselId}:${c.atUtc}`,
        })) risks += 1;
        continue;
      }
      if (pick.kind !== 'hit') continue;
      const hit = pick.item;
      const patch = sailingActualPatch(hit, { actual_arrival_at: c.atUtc }, 'DOPLYNAL');
      if (await deps.store.updateSailing(hit.id, patch)) {
        updated += 1;
        hit.actual_arrival_at = c.atUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = 'DOPLYNAL';
      }
      continue;
    }

    if (c.kind === 'ETD') {
      if (t > nowMs) {
        if (!polStatusDown) continue;
        const pool = existing.filter((s) =>
          s.vessel_id === vesselId
          && s.route === 'GDN-NYN'
          && s.actual_departure_at == null
          && s.source !== 'RECZNIE'
          && s.status !== 'ODWOLANY');
        const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.departure_at), WINDOW_MS);
        if (pick.kind === 'ambiguous') {
          warnings.push(`UMG ETD niejednoznaczna: ${c.vessel} GDN-NYN (±3 h, ${pick.items.length} rejsy)`);
          if (await deps.store.raiseRisk({
            kind: 'FERRY', severity: 'MEDIUM',
            title: `UMG: niejednoznaczne dopasowanie ETD ${c.vessel} — bez zmiany, do weryfikacji HHL`,
            titleKey: 'rk_ferry_status_unknown',
            params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
            detail: { zrodlo: 'UMG_GDN', statek: c.vessel, etd: c.atUtc, rejsy: pick.items.length },
            dedup: `FERRY_UNKNOWN:UMG_GDN_ETD:${vesselId}:${c.atUtc}`,
          })) risks += 1;
          continue;
        }
        if (pick.kind !== 'hit') continue;
        const hit = pick.item;
        if (t - Date.parse(hit.departure_at) < delayMinMs) continue;
        if (hit.delayed_departure_at === c.atUtc) continue;
        if (await deps.store.updateSailing(hit.id, { delayed_departure_at: c.atUtc })) {
          updated += 1;
          hit.delayed_departure_at = c.atUtc;
        }
        continue;
      }
      if (!gdanskInPortPageOk || gdanskInPortNames.has(c.vessel)) continue;
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === 'GDN-NYN'
        && s.actual_departure_at == null
        && s.status !== 'ODWOLANY');
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.departure_at), WINDOW_MS);
      if (pick.kind === 'ambiguous') {
        warnings.push(`UMG ETD niejednoznaczna: ${c.vessel} GDN-NYN (±3 h, ${pick.items.length} rejsy)`);
        if (await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `UMG: niejednoznaczne dopasowanie ETD ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
          detail: { zrodlo: 'UMG_GDN', statek: c.vessel, etd: c.atUtc, rejsy: pick.items.length },
          dedup: `FERRY_UNKNOWN:UMG_GDN_ETD:${vesselId}:${c.atUtc}`,
        })) risks += 1;
        continue;
      }
      if (pick.kind !== 'hit') continue;
      const hit = pick.item;
      /* DP-222 B2: past ETD → ATD; status DOPLYNAL gdy późniejszy ATD / arrival+6h. */
      const nextSt = statusAfterGdnNynAtd(hit, existing, nowMs, null);
      const patch = sailingActualPatch(hit, { actual_departure_at: c.atUtc }, nextSt);
      if (await deps.store.updateSailing(hit.id, patch)) {
        updated += 1;
        hit.actual_departure_at = c.atUtc;
        if (hit.source !== 'RECZNIE' && hit.status !== 'ODWOLANY') hit.status = nextSt;
      }
      continue;
    }

    if (c.kind === 'ETA') {
      if (!polStatusDown) continue;
      const pool = existing.filter((s) =>
        s.vessel_id === vesselId
        && s.route === 'NYN-GDN'
        && s.actual_arrival_at == null
        && s.source !== 'RECZNIE'
        && s.status !== 'ODWOLANY');
      const pick = pickUniqueInWindow(pool, t, (s) => Date.parse(s.arrival_at), WINDOW_MS);
      if (pick.kind === 'ambiguous') {
        warnings.push(`UMG ETA niejednoznaczna: ${c.vessel} NYN-GDN (±3 h, ${pick.items.length} rejsy)`);
        if (await deps.store.raiseRisk({
          kind: 'FERRY', severity: 'MEDIUM',
          title: `UMG: niejednoznaczne dopasowanie ETA ${c.vessel} — bez zmiany, do weryfikacji HHL`,
          titleKey: 'rk_ferry_status_unknown',
          params: { vessel: c.vessel, dep: c.atUtc.slice(0, 16) },
          detail: { zrodlo: 'UMG_GDN', statek: c.vessel, eta: c.atUtc, rejsy: pick.items.length },
          dedup: `FERRY_UNKNOWN:UMG_GDN_ETA:${vesselId}:${c.atUtc}`,
        })) risks += 1;
        continue;
      }
      if (pick.kind !== 'hit') continue;
      const hit = pick.item;
      if (t - Date.parse(hit.arrival_at) < delayMinMs) continue;
      if (hit.delayed_arrival_at === c.atUtc) continue;
      if (await deps.store.updateSailing(hit.id, { delayed_arrival_at: c.atUtc })) {
        updated += 1;
        hit.delayed_arrival_at = c.atUtc;
      }
    }
  }

  if (candidates.length) {
    warnings.push(`${UMG_ATTRIBUTION}: ${candidates.length} Stena`);
  }
  if (polCandidates.length) {
    warnings.push(`${UMG_ATTRIBUTION}: ${polCandidates.length} Polferries (Gdańsk Nowy Port)`);
  }
  return {
    updated,
    rows: candidates.length + polCandidates.length,
    emptyTime,
    risks,
    warnings,
  };
}

/**
 * DP-121 / decyzja 100 (F7 #782 r1): Digitraffic port-call v2 `status=cancelled`.
 * Filtr floty FIHEL/FIVUO ±3 h → ryzyko HIGH HHL; **bez** `updateSailing(ODWOLANY)`
 * i **bez** `insertOperatorNotice`. Re-zgłoszenie (aktywna wizyta ±3 h) → bez ryzyka.
 * Drugi GET bez `status` (OpenAPI „active visits”); HTTP≠OK → bez filtra, wpis w warnings.
 */
async function applyPortCallV2Cancelled(deps: JobDeps, sinceIso: string, nowIso: string): Promise<{
  count: number; fleet: number; matched: number; reissued: number;
  fihel: boolean; risks: number; warnings: string[];
}> {
  const empty = {
    count: 0, fleet: 0, matched: 0, reissued: 0, fihel: false, risks: 0, warnings: [] as string[],
  };
  const nowMs = Date.parse(nowIso);
  const fromIso = new Date(nowMs - 14 * 864e5).toISOString();
  const toIso = new Date(nowMs + 21 * 864e5).toISOString();
  const url = portCallV2CancelledUrl(fromIso, toIso);
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Accept-Encoding': 'gzip',
    'Digitraffic-User': DIGITRAFFIC_USER,
  };
  const page = await readText(deps, url, { headers });
  /* HTTP ≠ OK: bez ostrzeżenia co przebieg (F7 #694); stary URL 400 nie spamuje. */
  if (!page.ok) return empty;
  let json: unknown;
  try { json = JSON.parse(page.text); } catch {
    return { ...empty, warnings: ['port-call v2 cancelled: nieczytelny JSON'] };
  }
  const parsed = parsePortCallV2Visits(json, 'cancelled');
  const warnings = [...parsed.warnings];

  /* Re-zgłoszenie: aktywne wizyty w tym samym oknie (bez status=cancelled). */
  let activeVisits: ReturnType<typeof parsePortCallV2Visits>['visits'] = [];
  const activeUrl = portCallV2ActiveVisitsUrl(fromIso, toIso);
  const activePage = await readText(deps, activeUrl, { headers });
  if (!activePage.ok) {
    warnings.push(
      'port-call v2 active: niedostępne — bez filtra re-zgłoszenia (decyzja 100)',
    );
  } else {
    try {
      const activeJson = JSON.parse(activePage.text) as unknown;
      const activeParsed = parsePortCallV2Visits(activeJson, 'active');
      activeVisits = activeParsed.visits;
      warnings.push(...activeParsed.warnings);
    } catch {
      warnings.push('port-call v2 active: nieczytelny JSON — bez filtra re-zgłoszenia');
    }
  }

  const [vessels, sailings] = await Promise.all([
    deps.store.vessels(), deps.store.sailingsSince(sinceIso),
  ]);
  const hits = matchPortCallV2CancelledFleet(parsed.visits, vessels, sailings);
  const fihel = hits.some((h) => h.visit.portOfCall === 'FIHEL' || h.visit.portOfCall === 'FIVUO')
    || parsed.visits.some((v) => v.portOfCall === 'FIHEL' || v.portOfCall === 'FIVUO');
  let risks = 0;
  let matched = 0;
  let reissued = 0;
  const keepDedup: string[] = [];
  for (const hit of hits) {
    if (isPortCallV2Reissued(hit.visit, activeVisits)) {
      reissued += 1;
      continue;
    }
    matched += 1;
    const risk = portCallV2CancelledFleetRisk(hit, nowIso, url);
    keepDedup.push(risk.dedup);
    if (await deps.store.raiseRisk(risk)) risks += 1;
  }
  await deps.store.resolveStaleRisks('FERRY_PORTCALL_V2_CANCELLED:', keepDedup);
  return {
    count: parsed.visits.length,
    fleet: hits.length,
    matched,
    reissued,
    fihel,
    risks,
    warnings,
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

const FERRY_OPERATOR_SOURCES = new Set(['POLFERRIES', 'STENA', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS']);

/**
 * DP-99: armator do `operator_notices` — najpierw `data-company` ts.ee, potem source rejsu,
 * potem pierwotny z `ferry_route_operators` / seed (MUU-VUO = ECKERO, nie VIKING).
 */
export function operatorFromSailingSource(
  source: string,
  route: string,
  companyHint?: string | null,
): string {
  const fromCompany = operatorFromTsCompany(companyHint);
  if (fromCompany) return fromCompany;
  const up = source.trim().toUpperCase();
  if (FERRY_OPERATOR_SOURCES.has(up)) return up;
  // Jak ferryCatalog / ferry_route_operators (DP-1 / DP-83).
  if (route === 'GDY-KAA' || route === 'KAA-GDY') return 'STENA';
  if (route === 'GDN-NYN' || route === 'NYN-GDN') return 'POLFERRIES';
  if (route === 'MUU-VUO' || route === 'VUO-MUU') return 'ECKERO';
  if (route.startsWith('TLLA') || route.startsWith('HELA')) return 'VIKING';
  if (route === 'TLL-HEL' || route === 'HEL-TLL' || route === 'TLL-STO' || route === 'STO-TLL') return 'TALLINK';
  if (route === 'PLD-KPS' || route === 'KPS-PLD') return 'DFDS';
  return 'TALLINK';
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

  // BN3: DFDS Dynamic — remark „New ETD…” / actualDeparture → OPOZNIONY (ferry-status, nie rozkład).
  // F7 #682 B1: próg z app_parameters.FERRY_PORT_DELAY_MIN.
  // DP-90: tylko API (bez PDF/HTML); puste tygodnie ≠ SOURCE_DOWN (fetchedOk>0).
  const delayMin = deps.store.ferryPortDelayMin
    ? await deps.store.ferryPortDelayMin()
    : FERRY_PORT_DELAY_MIN_DEFAULT;
  const dfdsStatus = await fetchDfdsDays(deps, 7, delayMin, { apiOnly: true });
  warnings.push(...dfdsStatus.warnings.filter((w) => !warnings.includes(w)));
  const dfStatusFail = dfdsStatus.fetchedOk === 0;
  if (dfStatusFail) {
    if (await deps.store.raiseRisk(sourceDownRisk(
      'DFDS_STATUS',
      dfdsStatus.warnings.length ? dfdsStatus.warnings : ['Brak odpowiedzi DFDS status'],
      now,
      DFDS_SCHEDULE_PAGE,
    ))) risks += 1;
  } else {
    // DP-91/92: status/ATD; DP-91 F7 #858 — wiersz API bez remarku/ATD czyści OPOZNIONY przed wypłynięciem.
    const withSignal = dfdsStatus.sailings.filter((s) => s.status || s.actualDepartureUtc);
    const clearKeys = new Set(
      dfdsStatus.sailings
        .filter((s) => !s.status && !s.actualDepartureUtc)
        .map((s) => `${s.route}|${s.departureUtc}`),
    );
    const nowMs = Date.parse(now);
    const existingDfds = (await deps.store.sailingsSince(since))
      .filter((s) => s.source === 'DFDS' && s.status === 'OPOZNIONY'
        && s.actual_departure_at == null
        && Date.parse(s.delayed_departure_at ?? s.departure_at) > nowMs
        && clearKeys.has(`${s.route}|${new Date(s.departure_at).toISOString()}`));
    const vessels = await deps.store.vessels();
    const vesselName = new Map(vessels.map((v) => [v.id, v.name]));
    const incomingD: IncomingSailing[] = [
      ...withSignal.map((s) => ({
        route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc,
        status: s.status, expectedDepartureUtc: s.expectedDepartureUtc, expectedArrivalUtc: s.expectedArrivalUtc,
        actualDepartureUtc: s.actualDepartureUtc,
      })),
      ...existingDfds.flatMap((s) => {
        const name = vesselName.get(s.vessel_id);
        if (!name) return [];
        const api = dfdsStatus.sailings.find(
          (x) => x.route === s.route && x.departureUtc === new Date(s.departure_at).toISOString(),
        );
        if (!api) return [];
        return [{
          route: s.route, vessel: name, departureUtc: api.departureUtc, arrivalUtc: api.arrivalUtc,
          status: 'ZAPLANOWANY' as const,
        }];
      }),
    ];
    if (incomingD.length > 0) {
      const { plan, updated: u, manualKept: m } = await applySailings(deps, incomingD, since, 'DFDS');
      inserted += plan.inserts.length; updated += u; manualKept += m; unchanged += plan.unchanged; unknown += plan.unknown.length;
      for (const urow of plan.unknown) {
        const raw = withSignal.find((p) => p.vessel === urow.vessel && p.departureUtc === urow.departureUtc);
        if (await deps.store.raiseRisk(unknownStatusRisk(urow, `${raw?.rawStatus ?? ''} / ${raw?.rawRemark ?? ''}`, 'DFDS'))) {
          risks += 1;
        }
      }
    }
    await deps.store.resolveRisks('SOURCE_DOWN:DFDS_STATUS:');
  }

  // BN3: Tallink Alert (decyzja 59) — ODWOLANY przy jednoznacznym dopasowaniu; inaczej FERRY MEDIUM.
  // DP-114 / F7 #689: niepełna pula (HTTP≠OK / challenge / śmieć) → brak auto; streak z integration_runs.
  let tallinkAlertIncomplete = false;
  {
    const urls = [TALLINK_HOME_URL, TALLINK_HEL_TLL_URL];
    const headers = { 'User-Agent': TALLINK_ALERT_UA, Accept: 'text/html' };
    let alertFail = 0;
    const failMsgs: string[] = [];
    const allAlerts = [];
    for (const url of urls) {
      const page = await readText(deps, url, { headers });
      if (!page.ok) {
        warnings.push(page.warning);
        failMsgs.push(page.warning);
        alertFail += 1;
        continue;
      }
      const usable = isTallinkAlertHtmlUsable(page.text);
      if (!usable.ok) {
        const w = `${usable.reason} (${url})`;
        warnings.push(w);
        failMsgs.push(w);
        alertFail += 1;
        continue;
      }
      const parsed = parseTallinkAlerts(page.text, url, deps.now());
      warnings.push(...parsed.warnings);
      allAlerts.push(...parsed.alerts);
    }
    const poolIncomplete = alertFail > 0;
    tallinkAlertIncomplete = poolIncomplete;

    // F7 #689 R1-B3: seria z integration_runs (zimny start Edge) + bieżący przebieg.
    let priorStreak = 0;
    if (poolIncomplete && deps.store.recentJobResults) {
      const recent = await deps.store.recentJobResults(
        'ferry-status',
        TALLINK_ALERT_FAIL_STREAK_SOURCE_DOWN,
      );
      for (const prev of recent) {
        if (prev.tallink_alert_incomplete) priorStreak += 1;
        else break;
      }
    }
    const failStreak = poolIncomplete ? priorStreak + 1 : 0;

    // DP-114 pkt 3: SOURCE_DOWN dopiero po ≥ 3 kolejnych przebiegach z błędem (także gdy obie strony padły).
    const sourceDown = failStreak >= TALLINK_ALERT_FAIL_STREAK_SOURCE_DOWN;
    if (sourceDown) {
      if (await deps.store.raiseRisk(sourceDownRisk(
        'TALLINK_STATUS',
        failMsgs.length
          ? failMsgs.slice(0, 5)
          : ['Brak odpowiedzi Tallink Alert (tallink.com)'],
        now,
        TALLINK_HOME_URL,
      ))) risks += 1;
    } else {
      await deps.store.resolveRisks('SOURCE_DOWN:TALLINK_STATUS:');
    }
    if (!poolIncomplete) {
      await deps.store.resolveRisks('TALLINK_ALERT_INCOMPLETE:');
    }

    if (alertFail < urls.length) {
      const [vessels, existing] = await Promise.all([
        deps.store.vessels(), deps.store.sailingsSince(since),
      ]);
      const byId = new Map(vessels.map((v) => [v.id, v.name]));
      const cands = existing.map((row) => ({
        id: row.id,
        vesselName: byId.get(row.vessel_id) ?? '',
        route: row.route,
        departureAt: row.departure_at,
        status: row.status,
        source: row.source,
      }));
      // F7 #683 R12 / decyzja 72: najnowszy po złączeniu HOME + HEL-TLL; 72c — ryzyko też ze zdegradowanych.
      const mergedAlerts = finalizeTallinkAlertsForStatus(allAlerts, deps.now());
      for (const alert of mergedAlerts) {
        if (alert.isCampaign || alert.kind === 'IGNORE') continue;
        if (alert.filterReject === 'expired' || alert.filterReject === 'empty') continue;
        // #686 F7 r1: wzorzec przywrócenia / 72c zdegradowane → ryzyka; AUTO Tallink Alert → status.
        if (alert.autoRestoreOk || (alert.kind === 'INFO' && tallinkAlertLooksLikeRestore(alert.text))) {
          if (poolIncomplete) {
            const ok = await deps.store.raiseRisk({
              kind: 'FERRY',
              severity: 'MEDIUM',
              title: 'Tallink Alert: niepełna pula stron — bez auto-przywrócenia, weryfikacja HHL',
              titleKey: 'rk_tallink_alert_restore_incomplete',
              params: { vessel: alert.vessel ?? '' },
              detail: {
                tekst: alert.text.slice(0, 400),
                statek: alert.vessel,
                trasy: alert.routes,
                niepelna_pula: true,
                przywrocenie: true,
                atrybucja: 'Komunikat: Tallink (tallink.com)',
              },
              dedup: `TALLINK_ALERT_INCOMPLETE:RESTORE:${alert.vessel ?? 'any'}:${alert.contentStartYmd ?? alert.windowStartYmd ?? 'x'}:${alert.text.slice(0, 40)}`,
              sourceUrl: alert.sourceUrl,
            });
            if (ok) risks += 1;
            continue;
          }
          // F7 pkt 5 / 72c: zdegradowany lub niewzorcowy → MEDIUM, bez cichego continue.
          if (!alert.autoRestoreOk) {
            const ok = await deps.store.raiseRisk({
              kind: 'FERRY',
              severity: 'MEDIUM',
              title: 'Tallink podaje przywrócenie — sprawdź',
              titleKey: 'rk_tallink_alert_restore_check',
              params: { vessel: alert.vessel ?? '' },
              detail: {
                tekst: alert.text.slice(0, 400),
                statek: alert.vessel,
                trasy: alert.routes,
                zdegradowany: !!alert.suppressedByNewer,
                atrybucja: 'Komunikat: Tallink (tallink.com)',
              },
              dedup: `TALLINK_ALERT_RESTORE_CHECK:${alert.vessel ?? 'any'}:${alert.contentStartYmd ?? alert.windowStartYmd ?? 'x'}:${alert.text.slice(0, 40)}`,
              sourceUrl: alert.sourceUrl,
            });
            if (ok) risks += 1;
            continue;
          }
          const hit = matchTallinkRestoreSailings(alert, cands);
          if (hit.kind === 'not_cancelled') {
            // F7 pkt 4: status już przywrócony, a ryzyka SAILING_CANCELLED mogą zostać — dokończ.
            const sid = hit.sailing.id;
            if (deps.store.resolveSailingCancelledRisks) {
              await deps.store.resolveSailingCancelledRisks(sid);
            }
            if (deps.store.expireFerryCancelledDecisions) {
              await deps.store.expireFerryCancelledDecisions(sid);
            }
            continue;
          }
          if (hit.kind === 'restore') {
            const match = hit.sailing;
            const row = existing.find((x) => x.id === match.id);
            // F7 pkt 2: rejs RECZNIE → jak ręczne odwołanie.
            if (match.source === 'RECZNIE') {
              const ok = await deps.store.raiseRisk({
                kind: 'FERRY',
                severity: 'MEDIUM',
                title: 'Tallink przywraca rejs odwołany ręcznie/innym źródłem — potwierdź',
                titleKey: 'rk_tallink_alert_restore_manual',
                params: { vessel: alert.vessel ?? '' },
                detail: {
                  tekst: alert.text.slice(0, 400),
                  statek: alert.vessel,
                  trasy: alert.routes,
                  zrodlo_odwolania: 'RECZNIE',
                  operator_odwolania: 'RECZNIE',
                  atrybucja: 'Komunikat: Tallink (tallink.com)',
                },
                dedup: `TALLINK_ALERT_RESTORE_MANUAL:${match.id}:${alert.contentStartYmd ?? 'x'}`,
                sourceUrl: alert.sourceUrl,
              });
              if (ok) risks += 1;
              continue;
            }
            // F7 pkt 3 + B1: brak metody / brak Tallink Alert → ryzyko bez cofania.
            if (!deps.store.latestCancelNotice) {
              const ok = await deps.store.raiseRisk({
                kind: 'FERRY',
                severity: 'MEDIUM',
                title: 'Tallink przywraca rejs odwołany ręcznie/innym źródłem — potwierdź',
                titleKey: 'rk_tallink_alert_restore_manual',
                params: { vessel: alert.vessel ?? '' },
                detail: {
                  tekst: alert.text.slice(0, 400),
                  statek: alert.vessel,
                  trasy: alert.routes,
                  zrodlo_odwolania: 'brak',
                  operator_odwolania: 'brak',
                  atrybucja: 'Komunikat: Tallink (tallink.com)',
                },
                dedup: `TALLINK_ALERT_RESTORE_MANUAL:${match.id}:${alert.contentStartYmd ?? 'x'}`,
                sourceUrl: alert.sourceUrl,
              });
              if (ok) risks += 1;
              continue;
            }
            const notice = await deps.store.latestCancelNotice(match.id);
            if (!isTallinkAlertAutoCancel(notice)) {
              const ok = await deps.store.raiseRisk({
                kind: 'FERRY',
                severity: 'MEDIUM',
                title: 'Tallink przywraca rejs odwołany ręcznie/innym źródłem — potwierdź',
                titleKey: 'rk_tallink_alert_restore_manual',
                params: { vessel: alert.vessel ?? '' },
                detail: {
                  tekst: alert.text.slice(0, 400),
                  statek: alert.vessel,
                  trasy: alert.routes,
                  zrodlo_odwolania: notice?.source ?? 'brak',
                  operator_odwolania: notice?.operator ?? 'brak',
                  url_odwolania: notice?.sourceUrl ?? null,
                  atrybucja: 'Komunikat: Tallink (tallink.com)',
                },
                dedup: `TALLINK_ALERT_RESTORE_MANUAL:${match.id}:${alert.contentStartYmd ?? 'x'}`,
                sourceUrl: alert.sourceUrl,
              });
              if (ok) risks += 1;
              continue;
            }
            const reassigned = deps.store.reassignedLoadsAfterCancel
              ? await deps.store.reassignedLoadsAfterCancel(match.id)
              : [];
            if (reassigned.length > 0) {
              const ok = await deps.store.raiseRisk({
                kind: 'FERRY',
                severity: 'MEDIUM',
                title: 'Tallink: rejs przywrócony po zmianie planu — sprawdź',
                titleKey: 'rk_tallink_alert_restore_reassigned',
                params: { vessel: alert.vessel ?? '' },
                detail: {
                  tekst: alert.text.slice(0, 400),
                  statek: alert.vessel,
                  transporty: reassigned.slice(0, 20),
                  atrybucja: 'Komunikat: Tallink (tallink.com)',
                },
                dedup: `TALLINK_ALERT_RESTORE_REASSIGNED:${match.id}:${alert.contentStartYmd ?? 'x'}`,
                sourceUrl: alert.sourceUrl,
              });
              if (ok) risks += 1;
              // Status rejsu i tak przywracamy; przypisań transportów nie cofamy.
            }
            const target = restoreStatusAfterCancel(row ?? {
              delayed_departure_at: null,
              delayed_arrival_at: null,
            });
            // F7 pkt 4: najpierw PRZYWROCONY (przetrwa wyjątek), potem status, potem ryzyka.
            if (deps.store.insertOperatorNotice) {
              await deps.store.insertOperatorNotice({
                sailingId: match.id,
                operator: 'TALLINK',
                kind: 'PRZYWROCONY',
                note: alert.text.slice(0, 400),
                sourceUrl: alert.sourceUrl,
              });
            }
            // F7 #698 r2 B-r2-1: bez zamknięcia ryzyk / INFO, gdy update padł (np. HHL → RECZNIE).
            // Wpis PRZYWROCONY przed statusem zostaje; kolejny przebieg dokończy albo podniesie ryzyko.
            if (!(await deps.store.updateSailing(match.id, { status: target }))) {
              continue;
            }
            updated += 1;
            match.status = target;
            if (row) row.status = target;
            if (deps.store.resolveSailingCancelledRisks) {
              await deps.store.resolveSailingCancelledRisks(match.id);
            }
            if (deps.store.expireFerryCancelledDecisions) {
              await deps.store.expireFerryCancelledDecisions(match.id);
            }
            const okInfo = await deps.store.raiseRisk({
              kind: 'FERRY',
              severity: 'INFO',
              title: 'Tallink: rejs przywrócony',
              titleKey: 'rk_tallink_alert_restored',
              params: { vessel: alert.vessel ?? '' },
              detail: {
                tekst: alert.text.slice(0, 400),
                statek: alert.vessel,
                trasy: alert.routes,
                status_docelowy: target,
                atrybucja: 'Komunikat: Tallink (tallink.com)',
              },
              dedup: `TALLINK_ALERT_RESTORED:${match.id}:${alert.contentStartYmd ?? 'x'}`,
              sourceUrl: alert.sourceUrl,
            });
            if (okInfo) risks += 1;
            continue;
          }
          const ambiguous = hit.kind === 'ambiguous';
          const beyond = hit.kind === 'beyond_horizon';
          const ok = await deps.store.raiseRisk({
            kind: 'FERRY',
            severity: 'MEDIUM',
            title: ambiguous
              ? 'Tallink Alert: przywrócenie — wiele rejsów, weryfikacja HHL'
              : beyond
                ? 'Tallink Alert: przywrócenie poza horyzontem rozkładu — weryfikacja HHL'
                : 'Tallink Alert: przywrócenie bez jednoznacznego rejsu — weryfikacja HHL',
            titleKey: ambiguous ? 'rk_tallink_alert_restore_ambiguous' : beyond ? 'rk_tallink_alert_restore_beyond' : 'rk_tallink_alert_restore_unmatched',
            params: { vessel: alert.vessel ?? '' },
            detail: {
              tekst: alert.text.slice(0, 400),
              statek: alert.vessel,
              trasy: alert.routes,
              przywrocenie: true,
              niejednoznaczne: ambiguous,
              poza_horyzontem: beyond,
              atrybucja: 'Komunikat: Tallink (tallink.com)',
            },
            dedup: `TALLINK_ALERT_RESTORE:${alert.vessel ?? 'any'}:${alert.contentStartYmd ?? alert.windowStartYmd ?? 'x'}:${alert.text.slice(0, 40)}`,
            sourceUrl: alert.sourceUrl,
          });
          if (ok) risks += 1;
          continue;
        }
        if (alert.kind !== 'ODWOLANY') continue;
        // DP-114 pkt 2: niepełna pula → tylko ryzyko MEDIUM, bez auto-ODWOLANY (reguła 72 traci połowę).
        if (poolIncomplete) {
          // F7 #689 nieblokujące: bez INCOMPLETE gdy rejs już ODWOLANY.
          const hit = matchTallinkAlertSailings(alert, cands);
          if (hit.kind === 'already_cancelled') continue;
          const ok = await deps.store.raiseRisk({
            kind: 'FERRY',
            severity: 'MEDIUM',
            title: 'Tallink Alert: niepełna pula stron — bez auto-odwołania, weryfikacja HHL',
            titleKey: 'rk_tallink_alert_incomplete',
            params: { vessel: alert.vessel ?? '' },
            detail: {
              tekst: alert.text.slice(0, 400),
              statek: alert.vessel,
              trasy: alert.routes,
              niepelna_pula: true,
              atrybucja: 'Komunikat: Tallink (tallink.com)',
            },
            dedup: `TALLINK_ALERT_INCOMPLETE:${alert.vessel ?? 'any'}:${alert.contentStartYmd ?? alert.windowStartYmd ?? 'x'}:${alert.text.slice(0, 40)}`,
            sourceUrl: alert.sourceUrl,
          });
          if (ok) risks += 1;
          continue;
        }
        // F7 #683 B1: pełna pula; already_cancelled → nic; manual_only / ambiguous / none → ryzyko.
        const hit = matchTallinkAlertSailings(alert, cands);
        if (hit.kind === 'already_cancelled') continue;
        if (hit.kind === 'match') {
          const match = hit.sailing;
          // DP-101 / F7 #866: atomowe AUTO ODWOLANY + notice (RPC) — bez duplikatów przy wyścigu.
          const cancelledOk = deps.store.cancelSailingAuto
            ? await deps.store.cancelSailingAuto({
              sailingId: match.id,
              operator: 'TALLINK',
              note: alert.text.slice(0, 400),
              sourceUrl: alert.sourceUrl,
            })
            : await deps.store.updateSailing(match.id, { status: 'ODWOLANY' });
          if (!cancelledOk) continue;
          updated += 1;
          match.status = 'ODWOLANY';
          const row = existing.find((x) => x.id === match.id);
          if (row) row.status = 'ODWOLANY';
          continue;
        }
        const ambiguous = hit.kind === 'ambiguous' || hit.kind === 'manual_only';
        const beyond = hit.kind === 'beyond_horizon';
        const ok = await deps.store.raiseRisk({
          kind: 'FERRY',
          severity: 'MEDIUM',
          title: ambiguous
            ? 'Tallink Alert: odwołanie — wiele rejsów, weryfikacja HHL'
            : beyond
              ? 'Tallink Alert: odwołanie poza horyzontem rozkładu — weryfikacja HHL'
              : 'Tallink Alert: odwołanie bez jednoznacznego rejsu — weryfikacja HHL',
          titleKey: ambiguous ? 'rk_tallink_alert_ambiguous' : 'rk_tallink_alert_unmatched',
          params: { vessel: alert.vessel ?? '' },
          detail: {
            tekst: alert.text.slice(0, 400),
            statek: alert.vessel,
            trasy: alert.routes,
            okno: [alert.contentStartYmd ?? alert.windowStartYmd, alert.contentEndYmd ?? alert.windowEndYmd],
            godzina: alert.contentHm,
            niejednoznaczne: ambiguous,
            poza_horyzontem: beyond,
            recznie: hit.kind === 'manual_only',
            atrybucja: 'Komunikat: Tallink (tallink.com)',
          },
          // DP-103 (F7 #683): bez text.slice(0,40) — drobna zmiana treści nie mnoży ryzyk.
          dedup: `TALLINK_ALERT:${alert.vessel ?? 'any'}:${alert.contentStartYmd ?? alert.windowStartYmd ?? 'x'}:${ambiguous ? 'ambiguous' : beyond ? 'beyond' : 'unmatched'}`,
          sourceUrl: alert.sourceUrl,
        });
        if (ok) risks += 1;
      }
    }
  }

  /* BN3 decyzja 61 pkt 3 / 80: RSS ERR (domyślnie on; env=0 = off). Yle → W64 STOP.
   * DP-127 (#699 odbiór): zawsze liczniki w observations (enabled/items/hits). */
  let errRss: ErrRssConfirmResult = {
    enabled: isErrRssEnabled(deps.env), items: 0, hits: 0, risks: 0, warnings: [],
  };
  try {
    errRss = await applyErrRssConfirmations(deps, since);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errRss = {
      enabled: true, items: 0, hits: 0, risks: 0,
      warnings: [`ERR RSS: wyjątek — ${msg.slice(0, 160)}`],
    };
  }
  warnings.push(...errRss.warnings);
  risks += errRss.risks;

  const result: JobResult = {
    job: 'ferry-status', mode: 'LIVE', ok: !(pfFail && stFail && dfStatusFail),
    inserted, updated, manualKept, unchanged, unknown, risks, warnings,
    tallink_alert_incomplete: tallinkAlertIncomplete || undefined,
    observations: {
      err_rss_enabled: errRss.enabled ? '1' : '0',
      err_rss_items: String(errRss.items),
      err_rss_hits: String(errRss.hits),
    },
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

/** DP-127: wynik ERR dla observations ferry-status (enabled / items / hits). */
export type ErrRssConfirmResult = {
  enabled: boolean;
  items: number;
  hits: number;
  risks: number;
  warnings: string[];
};

/**
 * BN3 decyzja 61 pkt 3 / F7 #699 — RSS ERR: filtr → FERRY MEDIUM + sourceUrl.
 * Decyzja 80 (r2): domyślnie włączone; env `ERR_RSS_ENABLED=0` → 0 zapytań/ryzyk/SOURCE_DOWN.
 * Decyzja 69: bez AUTO ODWOLANY. Yle niepodłączone (W64 STOP).
 * DP-127: zawsze zwraca enabled + items + hits (odbiór #699: pusty observations).
 */
export async function applyErrRssConfirmations(deps: JobDeps, _sinceIso: string): Promise<ErrRssConfirmResult> {
  if (!isErrRssEnabled(deps.env)) {
    return { enabled: false, items: 0, hits: 0, risks: 0, warnings: [] };
  }
  const now = deps.now();
  const nowIso = now.toISOString();
  const page = await readText(
    deps,
    ERR_RSS_URL,
    {
      headers: { 'User-Agent': ERR_RSS_UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    },
    READ_TEXT_TIMEOUT_MS,
    ERR_RSS_MAX_CHARS,
  );
  if (!page.ok) {
    /* B4: nie zamykaj SOURCE_DOWN przy awarii; klucz sticky bez daty.
     * DP-126: Content-Length > limitu też tu (za duża → SOURCE_DOWN). */
    const warn = /za duża/i.test(page.warning)
      ? 'ERR RSS: odpowiedź za duża (limit).'
      : page.warning;
    if (await deps.store.raiseRisk(sourceDownRisk(
      'ERR_RSS',
      [warn],
      nowIso,
      ERR_RSS_URL,
    ))) {
      return { enabled: true, items: 0, hits: 0, risks: 1, warnings: [warn] };
    }
    return { enabled: true, items: 0, hits: 0, risks: 0, warnings: [warn] };
  }
  if (page.text.length > ERR_RSS_MAX_CHARS) {
    const w = 'ERR RSS: odpowiedź za duża (limit).';
    if (await deps.store.raiseRisk(sourceDownRisk('ERR_RSS', [w], nowIso, ERR_RSS_URL))) {
      return { enabled: true, items: 0, hits: 0, risks: 1, warnings: [w] };
    }
    return { enabled: true, items: 0, hits: 0, risks: 0, warnings: [w] };
  }
  const parsed = parseErrRss(page.text);
  const warnings = [...parsed.warnings];
  if (parsed.warnings.some((w) => /struktura|pusta odpowiedź|za duża/i.test(w))) {
    /* B4: zamykać SOURCE_DOWN dopiero po udanym parsowaniu — tu awaria. */
    if (await deps.store.raiseRisk(sourceDownRisk('ERR_RSS', parsed.warnings, nowIso, ERR_RSS_URL))) {
      return { enabled: true, items: 0, hits: 0, risks: 1, warnings };
    }
    return { enabled: true, items: 0, hits: 0, risks: 0, warnings };
  }
  /* Udane parsowanie (także pusty kanał) → zamknij SOURCE_DOWN. */
  await deps.store.resolveRisks('SOURCE_DOWN:ERR_RSS');

  const fresh = parsed.items.filter((it) => isErrRssItemFresh(it, now));
  const hits = filterErrFerryCancel(fresh);
  let risks = 0;
  const keep: string[] = [];
  for (const hit of hits) {
    const risk = errRssCancelRisk(hit, nowIso);
    keep.push(risk.dedup);
    /* B2: nie podnoś ponownie po ręcznym zamknięciu (pamięć guid). */
    if (deps.store.hasRiskDedup && await deps.store.hasRiskDedup(risk.dedup)) continue;
    if (await deps.store.raiseRisk(risk)) risks += 1;
  }
  if (hits.length) warnings.push(`${ERR_ATTRIBUTION}: ${hits.length} trafień`);

  /* R2-B1: pusty kanał (0 itemów) nie zamyka ryzyk — hasRiskDedup zablokowałby powrót.
   * Zamykanie starych: niepusty kanał (także 0 trafień po filtrze) albo validUntil. */
  if (parsed.items.length > 0 && deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('FERRY_ERR_RSS:', keep);
  }
  return {
    enabled: true,
    items: parsed.items.length,
    hits: hits.length,
    risks,
    warnings,
  };
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

/**
 * DP-222 (#814 Nova 02.11): poprzednie `actual_arrival_at` tylko z rejsów
 * o wcześniejszym `departure_at` (i ATA ≤ plan tego odejścia). Max ATA
 * spośród *wszystkich* rejsów (w tym późniejszych) psuje since/accept —
 * backfill 0412 i cron na historii dostawały since z przyszłości.
 */
export function previousActualArrivalBefore(
  sailings: ReadonlyArray<Pick<DbSailing, 'id' | 'vessel_id' | 'departure_at' | 'actual_arrival_at'>>,
  vesselId: string,
  sailingId: string,
  beforeDepartureIso: string,
): string | null {
  const before = Date.parse(beforeDepartureIso);
  if (!Number.isFinite(before)) return null;
  const times = sailings
    .filter((x) => {
      if (x.vessel_id !== vesselId || x.id === sailingId || x.actual_arrival_at == null) return false;
      const dep = Date.parse(x.departure_at);
      const ata = Date.parse(x.actual_arrival_at);
      return Number.isFinite(dep) && Number.isFinite(ata) && dep < before && ata <= before;
    })
    .map((x) => x.actual_arrival_at!)
    .sort();
  return times.at(-1) ?? null;
}

/** BN4: etykiety portów docelowych dla ryzyka INFO `AIS_<port>` (jak NYN/KAA + HEL/STO/KPS/VUO). */
export const AIS_ARRIVAL_PORT_LABEL: Readonly<Record<string, string>> = {
  NYN: 'Nynäshamn',
  KAA: 'Karlskrona',
  HEL: 'Helsinki (West Harbour)',
  HELA: 'Helsinki (Katajanokka)',
  VUO: 'Vuosaari',
  STO: 'Sztokholm',
  KPS: 'Kapellskär',
};

/** DP-115: wycofanie Stena IRM po 403/429 — 15 min bez SOURCE_DOWN przy każdym przebiegu. */
export const STENA_IRM_BACKOFF_MS = 15 * 60_000;

/** Pamięć izolatu + hydrate z integration_runs (zimny start Edge). */
let stenaIrmBackoffUntilMs = 0;

/** Testy DP-115: wyczyść backoff w pamięci (symulacja zimnego startu Edge). */
export function clearStenaIrmBackoff(): void {
  stenaIrmBackoffUntilMs = 0;
}

/** DP-115: przywróć okno z ostatniego ferry-ais, gdy pamięć izolatu jest pusta/wygasła. */
async function hydrateStenaIrmBackoff(deps: JobDeps, nowMs: number): Promise<void> {
  if (nowMs < stenaIrmBackoffUntilMs) return;
  if (!deps.store.recentJobResults) return;
  const recent = await deps.store.recentJobResults('ferry-ais', 1);
  const until = recent[0]?.stena_irm_backoff_until;
  if (typeof until !== 'string') return;
  const ms = Date.parse(until);
  if (Number.isFinite(ms) && ms > nowMs) stenaIrmBackoffUntilMs = ms;
}

async function readStenaIrm(deps: JobDeps, nowMs: number): Promise<{ fixes: VesselFix[]; warning: string | null; suppressRisk?: boolean }> {
  await hydrateStenaIrmBackoff(deps, nowMs);
  if (nowMs < stenaIrmBackoffUntilMs) {
    return { fixes: [], warning: null, suppressRisk: true };
  }
  const r = await readText(deps, STENA_FERRIES_URL, { headers: { 'User-Agent': STENA_IRM_UA, Accept: 'application/json' } });
  if (!r.ok) {
    if (/HTTP 403|HTTP 429/.test(r.warning)) {
      stenaIrmBackoffUntilMs = nowMs + STENA_IRM_BACKOFF_MS;
      /* Pierwszy 403/429 w oknie → SOURCE_DOWN; kolejne przebiegi w oknie nie dochodzą tu (early return). */
      return { fixes: [], warning: r.warning, suppressRisk: false };
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
  // BN4: śledzenie z `vessels` (MMSI / Stena IMO) — nie z zamkniętej listy 5 MMSI.
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
    // DP-129 / BN4: huby dep+arr (Zatoka → W_PORCIE_<kod>); bez mapy → BRAK_MAPY_PORTU.
    // Nigdy nie licz Zatoki względem Nynäshamn (stary fallback GDN/NYN).
    const obs = interpretRouteFix(fix, now, depPort, arrPort, 60);
    observations[v.name] = obs;

    // #421 / DP-128 / DP-222: ATD przy parze geofence (3/4 km; ≤20/60 min + SOG≥1).
    // BN4 F7 #701: bez mapy portu wyjścia — bez geofence (nigdy GDN dla TLLA-HEL).
    if (s.actual_departure_at == null) {
      const ageMin = (Date.parse(now) - Date.parse(fix.timestampUtc)) / 60_000;
      const depHub = portCoords(depPort);
      if (ageMin <= 15 && depHub) {
        const dist = distanceKm(fix.lat, fix.lon, depHub.lat, depHub.lon);
        const moving = (fix.sogKn ?? 0) >= 3;
        const prevArr = previousActualArrivalBefore(
          sailings, s.vessel_id, s.id, s.departure_at,
        );
        const plan2h = new Date(Date.parse(s.departure_at) - 2 * 3600_000).toISOString();
        const sinceIso = prevArr != null && prevArr > plan2h ? prevArr : plan2h;
        let depAt: string | null = null;
        /* Histereza OUT: próba ATD gdy bieżący fix >4 km. */
        if (moving && dist > 4 && deps.store.lastPortPosition) {
          depAt = await deps.store.lastPortPosition(v.id, depHub, 3, sinceIso);
          if (depAt != null && !acceptActualDepartureAt(depAt, s.departure_at, nowD.getTime(), prevArr)) {
            depAt = null;
          }
        }
        if (depAt && acceptActualDepartureAt(depAt, s.departure_at, nowD.getTime(), prevArr)) {
          // #446 + DP-222 B2: GDN-NYN → DOPLYNAL gdy późniejszy ATD / arrival+6h (nie W_REJSIE na zawsze).
          const nextSt = statusAfterGdnNynAtd(s, sailings, nowD.getTime(), null);
          const ok = await deps.store.updateSailing(s.id, {
            actual_departure_at: depAt,
            ...(s.status === 'ODWOLANY' ? {} : { status: nextSt }),
          });
          if (ok) {
            s.actual_departure_at = depAt;
            if (s.status !== 'ODWOLANY') s.status = nextSt;
            departures++;
            observations[`${v.name}:DEP`] = `WYPŁYNĄŁ_${depAt}`;
          }
        } else if (moving && dist > 4) {
          observations[`${v.name}:DEP`] = 'BEZ_PRZEJSCIA_GEOFENCE';
        }
      }
    }
    // #421 F7 r2 + DP-128 F7 r1: ATA tylko przy wejściu z poprzednią ≤20 min (poza lub SOG≥3).
    if (s.actual_arrival_at == null) {
      const ageMin = (Date.parse(now) - Date.parse(fix.timestampUtc)) / 60_000;
      const arrHub = portCoords(arrPort);
      if (arrHub) {
        const inHub = distanceKm(fix.lat, fix.lon, arrHub.lat, arrHub.lon) <= 3 && (fix.sogKn ?? 0) < 3;
        const depRef = s.actual_departure_at ?? s.delayed_departure_at ?? s.departure_at;
        if (inHub && ageMin <= 15 && Date.parse(fix.timestampUtc) > Date.parse(depRef)) {
          let arrAt: string | null = null;
          if (deps.store.firstPortEntryAfter) {
            arrAt = await deps.store.firstPortEntryAfter(v.id, arrHub, 3, depRef);
          }
          if (arrAt == null) {
            observations[`${v.name}:ARR`] = 'BEZ_PRZEJSCIA_GEOFENCE';
          } else if (Date.parse(arrAt) > Date.parse(depRef)) {
            const ok = await deps.store.updateSailing(s.id, {
              actual_arrival_at: arrAt,
              ...(s.status === 'ODWOLANY' ? {} : { status: 'DOPLYNAL' }),
            });
            if (ok) {
              s.actual_arrival_at = arrAt;
              if (s.status !== 'ODWOLANY') s.status = 'DOPLYNAL';
              departures++;
              observations[`${v.name}:ARR`] = `DOPŁYNĄŁ_${arrAt}`;
            }
          }
        }
      }
    }

    /* BN4 F7 #706 r1: INFO AIS_<port> tylko z transportami (B1) i po ATA geofence (B2 / DP-128). */
    {
      const arr = arrivalPortForRoute(s.route);
      const hub = arr ? portCoords(arr) : null;
      const ageArr = (Date.parse(now) - Date.parse(fix.timestampUtc)) / 60_000;
      const inArr = hub != null
        && ageArr <= 60
        && distanceKm(fix.lat, fix.lon, hub.lat, hub.lon) <= 3
        && (fix.sogKn ?? 0) < 3;
      const portLabel = arr ? AIS_ARRIVAL_PORT_LABEL[arr] : null;
      if (inArr && arr && portLabel && s.actual_arrival_at != null) {
        const assigned = deps.store.sailingAssignedLoadCount
          ? await deps.store.sailingAssignedLoadCount(s.id)
          : 0;
        if (assigned > 0) {
          const titleKey = arr === 'NYN' ? 'rk_ais_arrived'
            : arr === 'KAA' ? 'rk_ais_arrived_kaa'
              : 'rk_ais_arrived_at';
          const params = (arr === 'NYN' || arr === 'KAA')
            ? { vessel: v.name }
            : { vessel: v.name, port: portLabel };
          const ok = await deps.store.raiseRisk({
            kind: 'FERRY', severity: 'INFO',
            title: `AIS: ${v.name} w porcie ${portLabel} — potwierdzenie przypłynięcia (informacja)`,
            titleKey, params,
            detail: {
              sailing_id: s.id, statek: v.name, port: arr, pozycja: [fix.lat, fix.lon],
              sygnal: fix.timestampUtc, zrodlo: fix.source ?? 'DIGITRAFFIC', atrybucja: DIGITRAFFIC_ATTRIBUTION,
              obs,
            },
            dedup: `AIS_${arr}:${s.id}`,
            sourceUrl: 'https://www.digitraffic.fi/en/marine-traffic/',
          });
          if (ok) risks++;
        }
      }
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
  /* DP-222 B2: domknięcie starych GDN-NYN W_REJSIE bez ATA (późniejszy ATD / arrival+6h). */
  const closedGdn = await closeStaleGdnNynWithoutAta(
    deps, new Date(nowD.getTime() - 2 * 864e5).toISOString(),
  );
  if (closedGdn) observations.dp222_closed_gdn = String(closedGdn);

  await deps.store.recordRun('ferry-departures', true, {
    job: 'ferry-departures', mode: 'LIVE', ok: true, departures, observations,
  });
  return {
    job: 'ferry-ais',
    mode: 'LIVE',
    ok: true,
    risks,
    warnings,
    observations,
    departures,
    /* DP-115: okno 403/429 w wyniku — kolejny zimny start Edge czyta recentJobResults. */
    stena_irm_backoff_until: stenaIrmBackoffUntilMs > nowD.getTime()
      ? new Date(stenaIrmBackoffUntilMs).toISOString()
      : undefined,
  };
}

/** ferry-ais-listen — AIS-POLF (05.10). Nasłuch aisstream co minutę przez ~50 s (limit ścienny funkcji Edge
 *  150 s; statek przy nabrzeżu nadaje co 3 min, więc 8 s w ferry-ais prawie nigdy go nie łapało).
 *  Zapis pozycji ze źródłem AISSTREAM dla wszystkich `vessels` z MMSI (BN4). Bez filtra Q-18. */
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

/**
 * PL-DATA / DP-172 — DeepL wolnego tekstu sytuacji drogowych.
 * `source` = SV (SE) albo LT/LV/ET/FI (BN6). Tylko zdarzenia z freeText; nazwy miejsc w freeText
 * zostają w oryginale (jak SE — bez osobnego słownika bałtyckiego).
 */
async function polishRoadFreeText(
  deps: JobDeps,
  events: { title: string; detail: string; freeText?: string | null; note?: string | null }[],
  nowIso: string,
  source: DeeplSourceLang = 'SV',
  usageRiskKind: string = 'ROAD_SE',
): Promise<void> {
  const key = deps.env.DEEPL_API_KEY;
  const store = deps.store;
  if (!key || !store.translationGet || !store.translationPut || !store.translationEnqueue || !store.deeplUsage || !store.deeplAddUsage) return;
  let usage = await store.deeplUsage();
  let warned = false;
  let runCalls = 0;
  for (const e of events) {
    if (!e.freeText || e.note) continue;
    const result = await translateFreeText({
      text: e.freeText,
      source,
      used: usage.characters,
      limit: usage.limit || DEEPL_MONTHLY_LIMIT,
      runCalls,
      maxCallsPerRun: DEEPL_MAX_CALLS_PER_RUN,
      memoryGet: (hash) => store.translationGet!(hash),
      memoryPut: (hash, src, pl) => store.translationPut!(hash, src, pl, source),
      enqueue: (hash, reason) => store.translationEnqueue!(hash, e.freeText || '', source, reason),
      addUsage: async (n) => { usage = { ...usage, characters: await store.deeplAddUsage!(n) }; return usage.characters; },
      deepl: (text, src) => deeplTranslate(deps.fetch, key, text, src),
    });
    if (result.deeplCalls > 0) runCalls += result.deeplCalls;
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
        kind: usageRiskKind, severity: level === 'full' ? 'MEDIUM' : 'LOW',
        title: level === 'full'
          ? 'Limit tłumaczeń wyczerpany — opisy z kodów, teksty czekają w kolejce'
          : 'Tłumaczenia komunikatów drogowych powyżej 80% limitu miesięcznego',
        titleKey: 'rk_deepl_usage',
        params: { used: result.used, limit: result.limit },
        detail: { zrodlo: 'DeepL', poziom: level, czas: nowIso, jezyk: source },
        dedup: `DEEPL_USAGE:${nowIso.slice(0, 7)}:${level}`,
      });
    }
  }
}

/**
 * DP-172 + decyzja 99: DeepL dla wszystkich pokazywanych (także „obok trasy”),
 * nie tylko corridorMatch=on.
 * F7 #780 r3: nieznany typ (resolveBalticEventType) → freeText z oryginału typu.
 */
async function polishBalticCorridorEvents(
  deps: JobDeps,
  country: 'LT' | 'LV' | 'EE' | 'FI',
  events: BalticRoadEvent[],
  nowIso: string,
): Promise<void> {
  for (const e of events) {
    if (!balticShouldRaiseRisk(country, e)) continue;
    const resolved = resolveBalticEventType(e);
    if (resolved.known || !resolved.raw) continue;
    const humRaw = humanizeRoadCode(resolved.raw);
    if (!humRaw) continue;
    if (!e.freeText) e.freeText = humRaw;
    else if (!e.freeText.includes(humRaw)) e.freeText = `${humRaw}. ${e.freeText}`;
  }
  const toPolish = events.filter((e) => e.freeText && balticShouldRaiseRisk(country, e));
  if (!toPolish.length) return;
  try {
    await polishRoadFreeText(
      deps,
      toPolish,
      nowIso,
      deeplSourceForBalticCountry(country),
      `ROAD_${country}`,
    );
  } catch { /* DeepL nie przerywa odczytu drogi */ }
}

/** Decyzja 99: on bez zmian; unknown-near → LOW „sprawdź”; off → LOW „obok trasy”. */
function finalizeBalticRaisedRisk(
  raw: RiskInput,
  e: BalticRoadEvent,
  raise: 'on' | 'unknown-near' | 'off',
): RiskInput {
  if (raise === 'off') return markBalticOffRoute(capBalticRiskSeverity(raw, e.corridorMatch ?? 'off'));
  if (raise === 'unknown-near') {
    return {
      ...raw,
      severity: 'LOW',
      title: raw.title.replace(/: /, ': sprawdź — '),
    };
  }
  return capBalticRiskSeverity(raw, e.corridorMatch);
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
    /* DP-203 / F7 #780 r3: zamknij stare „Nieznany kod…” i RESOURCE_MISSING:TV_CODE (bez nowych). */
    await deps.store.resolveStaleRisks('ROAD_SE:TV_CODE:', []);
    await deps.store.resolveStaleRisks('RESOURCE_MISSING:TV_CODE:', []);
  }
  /* F7 #780 r3: nieznane kody → humanize → translateFreeText (pamięć/DeepL), nie RESOURCE_MISSING. */
  const unknownSeCodes = [
    ...new Set(situations.flatMap((e) => e.unknownCodes ?? [])),
  ];
  for (const e of situations) {
    if (!e.unknownCodes?.length) continue;
    const hum = e.unknownCodes.map((c) => humanizeRoadCode(c)).filter(Boolean).join('. ');
    if (!hum) continue;
    if (!e.freeText) e.freeText = hum;
    else if (!e.freeText.includes(hum)) e.freeText = `${hum}. ${e.freeText}`;
  }
  try { await polishRoadFreeText(deps, situations, now); }
  catch { /* DeepL nie przerywa odczytu drogi */ }
  for (const e of situations) {
    const pending = Boolean(e.freeText && !e.note);
    e.title = applyPendingRoadTitle(e.title, { note: e.note, pending });
    if (e.note) e.detail = e.note;
    else if (pending && e.detail.includes(PANEL_FALLBACK)) {
      e.detail = applyPendingRoadTitle(e.detail, { pending: true });
    }
    const risk = roadRisk('SE', e, 'https://www.trafikverket.se/trafikinformation/');
    risk.dedup = `ROAD_SE:SIT:${e.id}`;
    if (e.note) risk.detail = { ...risk.detail, opis: e.note };
    else if (pending) risk.detail = { ...risk.detail, pending: true, oryginal: e.original ?? e.freeText };
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
      /* F7 #780 r3: luki słownika TV — auto DeepL, bez zadania HHL. */
      tv_codes_auto: String(unknownSeCodes.length),
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

/**
 * BN6 (#716) cz.1 — drogi FI (Digitraffic tie, bez klucza).
 * F7 #726: filtr bboxami (B2); resolveStale tylko przy komplecie odczytów (B3);
 * SOURCE_DOWN:ROAD_FI po 3× fetched_ok===0. loadTons=null → HIGH masy tylko gdy combo_weight_t.
 */
export async function runRoadFi(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const headers = {
    'Accept-Encoding': 'gzip',
    'Digitraffic-User': DIGITRAFFIC_USER,
  };
  const bboxes = fiCorridorBboxes();
  const expectedFetches = 3 * bboxes.length; // roadworks + announcements + weight × bbox
  const warnings: string[] = [];
  let fetchedOk = 0;
  const byId = new Map<string, { event: BalticRoadEvent; sourceUrl: string }>();

  const fetchKind = async (base: string): Promise<void> => {
    for (const b of bboxes) {
      let url: string;
      try {
        url = fiTrafficUrl(base, b);
      } catch (e) {
        warnings.push(e instanceof Error ? e.message : String(e));
        continue;
      }
      const r = await readText(deps, url, { headers });
      if (!r.ok) {
        warnings.push(r.warning);
        continue;
      }
      fetchedOk++;
      try {
        const parsed = parseFiTrafficMessages(JSON.parse(r.text));
        for (const e of parsed) {
          if (!byId.has(e.id)) byId.set(e.id, { event: e, sourceUrl: base });
        }
      } catch {
        warnings.push(`FI Digitraffic: nieczytelna odpowiedź (${base})`);
      }
    }
  };

  await fetchKind(FI_ROADWORKS_URL);
  await fetchKind(FI_ANNOUNCEMENTS_URL);
  await fetchKind(FI_WEIGHT_URL);

  /* DP-216 / F7 #802 + DP-217 / #804: Digitraffic weather ≤ 3 km → klaster 25 km (MEDIUM);
   * HIGH 1× na transport (odcinki przed autem, audience HHL+SCX) — bez fali MEDIUM→HIGH. */
  let weatherFetched = 0;
  let weatherEvents = 0;
  let fiWxLoadAlerts = 0;
  const fiWxLoadRisks: NonNullable<ReturnType<typeof fiWxLoadSlipRisk>>[] = [];
  {
    const metaR = await readText(deps, FI_WEATHER_STATIONS_URL, { headers });
    const dataR = await readText(deps, FI_WEATHER_STATIONS_DATA_URL, { headers });
    if (metaR.ok && dataR.ok) {
      weatherFetched = 2;
      try {
        const meta = parseFiWeatherStationsMeta(JSON.parse(metaR.text));
        const readings = parseFiWeatherStationsData(JSON.parse(dataR.text), meta);
        const wx = fiWeatherToRiskEvents(readings);
        weatherEvents = wx.length;
        for (const e of wx) {
          if (!byId.has(e.id)) byId.set(e.id, { event: e, sourceUrl: FI_WEATHER_STATIONS_DATA_URL });
        }
        /* DP-217: zbiorcze HIGH tylko dla FI_E75 z bieżącym odcinkiem (currentLeg). */
        if (wx.length && deps.store.e49WindLoadCorridors) {
          try {
            const loads = await deps.store.e49WindLoadCorridors();
            const onFi = loads.filter((l) => (
              l.currentLeg && /FI_E75|ROAD_FI/i.test(l.code)
            ));
            const seen = new Set<string>();
            for (const leg of onFi) {
              if (seen.has(leg.loadId)) continue;
              seen.add(leg.loadId);
              const ahead = fiWeatherSegmentsAhead(wx, leg.fromKm);
              const risk = fiWxLoadSlipRisk({
                loadId: leg.loadId,
                ahead,
                sourceUrl: FI_WEATHER_STATIONS_DATA_URL,
                nowMs: deps.now().getTime(),
              });
              if (risk) fiWxLoadRisks.push(risk);
            }
            fiWxLoadAlerts = fiWxLoadRisks.length;
          } catch (e) {
            warnings.push(
              `E49 wind load corridors (FI slip): ${e instanceof Error ? e.message : 'błąd'}`,
            );
          }
        }
      } catch {
        warnings.push('FI Digitraffic: nieczytelna odpowiedź (weather stations)');
      }
    } else {
      if (!metaR.ok) warnings.push(metaR.warning);
      if (!dataR.ok) warnings.push(dataR.warning);
    }
  }

  if (fetchedOk === 0 && weatherFetched === 0) {
    const streak = await roadFiFailStreak(deps);
    if (streak >= 3) {
      await deps.store.raiseRisk(sourceDownRisk('ROAD_FI', warnings, now, FI_ROADWORKS_URL));
      return {
        job: 'road-fi', mode: 'LIVE', ok: false, risks: 1, warnings,
        observations: {
          road_fi_fail_streak: String(streak),
          source: 'digitraffic_tie',
          fetched_ok: '0',
          expected_fetches: String(expectedFetches),
        },
      };
    }
    return {
      job: 'road-fi', mode: 'LIVE', ok: false, risks: 0, warnings,
      observations: {
        road_fi_fail_streak: String(streak),
        source: 'digitraffic_tie',
        fetched_ok: '0',
        expected_fetches: String(expectedFetches),
      },
    };
  }

  await deps.store.resolveRisks('SOURCE_DOWN:ROAD_FI:');
  /* DP-157: bbox → filtr numerów VT4/E75/…; poza listą bez raise → resolveStale zamyka 146 ulicznych. */
  const near = applyFiCorridorRoadFilter(
    filterInFiBboxes([...byId.values()].map((x) => x.event)),
  );
  /* DP-172 / decyzja 99: DeepL także „obok trasy”. */
  await polishBalticCorridorEvents(deps, 'FI', near, now);
  const complete = fetchedOk === expectedFetches;
  let risks = 0;
  const keep: string[] = [];
  let fiOffCorridor = 0;
  for (const e of near) {
    /* Decyzja 99: off / unknown daleko → LOW „obok trasy”; licznik = obserwacja. */
    const raise = balticShouldRaiseRisk('FI', e);
    if (!raise) continue;
    if (e.corridorMatch === 'off' || raise === 'off') fiOffCorridor++;
    const src = byId.get(e.id)?.sourceUrl ?? FI_ROADWORKS_URL;
    /* F7 #732 B1: kelirikko/painorajoitus bez liczby → weightLimitRisk(limit=null) MEDIUM. */
    const raw = isFiWeightLimitLike(e)
      ? weightLimitRisk('FI', e, null, src, FI_ATTRIBUTION)
      : balticRoadRisk('FI', e, src, FI_ATTRIBUTION);
    const risk = finalizeBalticRaisedRisk(raw, e, raise);
    if (e.corridorMatch) {
      (risk.detail as Record<string, unknown>).korytarz_droga = e.corridorMatch;
    }
    if (e.road) (risk.detail as Record<string, unknown>).droga = e.road;
    /* DP-158: params.event = etykieta PL; surowy fiński w detail.opis. */
    if (risk.params && typeof risk.params === 'object') {
      (risk.params as Record<string, unknown>).type_pl = e.title;
    }
    keep.push(risk.dedup);
    if (await deps.store.raiseRisk(risk)) risks++;
  }
  /* DP-217 / #804: 1× HIGH na transport (HHL+SCX); segmenty zostają MEDIUM. */
  for (const loadRisk of fiWxLoadRisks) {
    if (!loadRisk) continue;
    keep.push(loadRisk.dedup);
    if (await deps.store.raiseRisk(loadRisk)) risks++;
  }
  /* F7 B3: zamykaj zniknięcia tylko przy komplecie (jak ROAD_SE situationsStatus===ok). */
  if (complete && deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('ROAD_FI:', keep);
  }

  const slow = balticSlowdownMult(near.filter((e) => e.corridorMatch === 'on'));
  if (deps.store.saveCorridorCondition) {
    await deps.store.saveCorridorCondition({
      corridor: 'ROAD_FI',
      slowdownMult: slow.mult,
      reason: slow.reason,
      observedAt: now,
      detail: {
        events: near.length,
        zrodlo: FI_ATTRIBUTION,
        complete,
        note: 'LT: źródło nie podaje wypadków — dotyczy innych krajów BN6',
      },
    });
  }

  return {
    job: 'road-fi', mode: 'LIVE', ok: complete && warnings.length === 0,
    risks, warnings,
    observations: {
      source: 'digitraffic_tie',
      fetched_ok: String(fetchedOk),
      expected_fetches: String(expectedFetches),
      complete: complete ? '1' : '0',
      events_raw: String(byId.size),
      events_near: String(near.length),
      fi_off_corridor: String(fiOffCorridor),
      fi_weather_fetched: String(weatherFetched),
      fi_weather_events: String(weatherEvents),
      fi_wx_load_alerts: String(fiWxLoadAlerts),
    },
  };
}

/** Streak: tylko przebiegi z fetched_ok===0 (F7 #726; częściowe nie nabijają). */
async function roadFiFailStreak(deps: JobDeps): Promise<number> {
  let streak = 1; // bieżący przebieg: fetchedOk === 0
  if (!deps.store.recentJobResults) return streak;
  const rows = await deps.store.recentJobResults('road-fi', 5);
  for (const row of rows) {
    const fo = Number(row.observations?.fetched_ok ?? NaN);
    if (fo === 0) streak++;
    else break;
  }
  return streak;
}

/**
 * BN6 (#716) cz.2 — drogi LT (eismoinfo restrictions + weather, bez klucza).
 * Filtr bboxami Via Baltica do BN7; resolveStale tylko przy komplecie 2/2;
 * SOURCE_DOWN:ROAD_LT po 3× fetched_ok===0. Bez wypadków w źródle.
 */
export async function runRoadLt(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const headers = { 'User-Agent': LT_UA, Accept: 'application/json' };
  const expectedFetches = 2;
  const warnings: string[] = [];
  let fetchedOk = 0;
  let restrictionEvents: BalticRoadEvent[] = [];
  let weatherSlow: BalticRoadEvent[] = [];

  const rRest = await readText(deps, LT_RESTRICTIONS_URL, { headers });
  if (!rRest.ok) {
    warnings.push(rRest.warning);
  } else {
    fetchedOk++;
    try {
      restrictionEvents = parseLtRestrictions(JSON.parse(rRest.text));
    } catch {
      warnings.push('LT eismoinfo: nieczytelne restrictions');
    }
  }

  const rWx = await readText(deps, LT_WEATHER_URL, { headers });
  if (!rWx.ok) {
    warnings.push(rWx.warning);
  } else {
    fetchedOk++;
    try {
      const stations = parseLtWeather(JSON.parse(rWx.text));
      weatherSlow = ltWeatherToSlowdownEvents(stations);
    } catch {
      warnings.push('LT eismoinfo: nieczytelna pogoda drogowa');
    }
  }

  if (fetchedOk === 0) {
    const streak = await roadLtFailStreak(deps);
    if (streak >= 3) {
      await deps.store.raiseRisk(sourceDownRisk('ROAD_LT', warnings, now, LT_RESTRICTIONS_URL));
      return {
        job: 'road-lt', mode: 'LIVE', ok: false, risks: 1, warnings,
        observations: {
          road_lt_fail_streak: String(streak),
          source: 'eismoinfo_lt',
          fetched_ok: '0',
          expected_fetches: String(expectedFetches),
        },
      };
    }
    return {
      job: 'road-lt', mode: 'LIVE', ok: false, risks: 0, warnings,
      observations: {
        road_lt_fail_streak: String(streak),
        source: 'eismoinfo_lt',
        fetched_ok: '0',
        expected_fetches: String(expectedFetches),
      },
    };
  }

  await deps.store.resolveRisks('SOURCE_DOWN:ROAD_LT:');
  /* DP-164: filtr numerów dróg korytarza (A5/A8/A10/E67 + A1 przy Kownie) do BN7. */
  const near = applyBalticCorridorRoadFilter('LT', filterInLtBboxes(restrictionEvents));
  const weatherOn = applyBalticCorridorRoadFilter('LT', weatherSlow);
  /* DP-172 / decyzja 99: DeepL także „obok trasy”. */
  await polishBalticCorridorEvents(deps, 'LT', near, now);
  const complete = fetchedOk === expectedFetches;
  let risks = 0;
  const keep: string[] = [];
  let ltOffCorridor = 0;
  for (const e of near) {
    /* Decyzja 99: off zostaje (LOW · obok trasy); DeepL dla wszystkich pokazywanych. */
    const raise = balticShouldRaiseRisk('LT', e);
    if (!raise) continue;
    if (e.corridorMatch === 'off' || raise === 'off') ltOffCorridor++;
    const raw = e.weightLimitT != null
      ? weightLimitRisk('LT', e, null, LT_RESTRICTIONS_URL, LT_ATTRIBUTION)
      : isDimensionLimitEvent(e)
        ? dimensionLimitRisk('LT', e, LT_RESTRICTIONS_URL, LT_ATTRIBUTION)
        : balticRoadRisk('LT', e, LT_RESTRICTIONS_URL, LT_ATTRIBUTION);
    const risk = finalizeBalticRaisedRisk(raw, e, raise);
    /* F7 #727 N2: jedna uwaga o braku wypadków w ryzyku (nie w każdym detail zdarzenia). */
    if (risk.detail && typeof risk.detail === 'object') {
      (risk.detail as Record<string, unknown>).uwaga_wypadki =
        'zrodlo LT nie podaje wypadkow';
      if (e.road) (risk.detail as Record<string, unknown>).droga = e.road;
      if (e.corridorMatch) {
        (risk.detail as Record<string, unknown>).korytarz_droga = e.corridorMatch;
      }
    }
    keep.push(risk.dedup);
    if (await deps.store.raiseRisk(risk)) risks++;
  }
  if (complete && deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('ROAD_LT:', keep);
  }

  const slow = balticSlowdownMult([...near, ...weatherOn]);
  if (deps.store.saveCorridorCondition) {
    await deps.store.saveCorridorCondition({
      corridor: 'ROAD_LT',
      slowdownMult: slow.mult,
      reason: slow.reason,
      observedAt: now,
      detail: {
        events: near.length,
        events_corridor: near.filter((e) => e.corridorMatch === 'on').length,
        events_off_road: near.filter((e) => e.corridorMatch === 'off').length,
        weather_adverse: weatherOn.length,
        zrodlo: LT_ATTRIBUTION,
        complete,
        note: 'zrodlo LT nie podaje wypadkow',
        dp164: 'filtr A5/A8/A10/E67+A1 Kaunas',
        lt_off_corridor: ltOffCorridor,
      },
    });
  }

  return {
    job: 'road-lt', mode: 'LIVE', ok: complete && warnings.length === 0,
    risks, warnings,
    observations: {
      source: 'eismoinfo_lt',
      fetched_ok: String(fetchedOk),
      expected_fetches: String(expectedFetches),
      complete: complete ? '1' : '0',
      events_raw: String(restrictionEvents.length),
      events_near: String(near.length),
      weather_adverse: String(weatherSlow.length),
      lt_off_corridor: String(ltOffCorridor),
    },
  };
}

async function roadLtFailStreak(deps: JobDeps): Promise<number> {
  let streak = 1;
  if (!deps.store.recentJobResults) return streak;
  const rows = await deps.store.recentJobResults('road-lt', 5);
  for (const row of rows) {
    const fo = Number(row.observations?.fetched_ok ?? NaN);
    if (fo === 0) streak++;
    else break;
  }
  return streak;
}

/**
 * BN6 (#716) cz.3 / #589 — drogi LV (22 zbiory LV_NAP_*_KEY).
 * DP-200 / #773: POST snapshot `/api/v1/get/file/download-file` + `x-api-key`
 * (stary GET sekretu URL dawał „No file”). URL opcjonalny — ignorowany.
 * F7 #730 / DP-168: 5 MB / 10 s / 65 s; równolegle 6; resolveStale przy komplecie;
 * SOURCE_DOWN po 3× fetched_ok===0 gdy configured>0.
 */
const LV_FEED_CONCURRENCY = 6;

function lvDiagObservations(
  keyMeta: BalticKeyMeta,
  opts: { urlKind?: string; probe?: string; urlShapes?: Record<string, string> } = {},
): Record<string, string> {
  const o: Record<string, string> = {
    key_header_sent: String(keyMeta.key_header_sent),
    key_len: String(keyMeta.key_len),
    key_trimmed: String(keyMeta.key_trimmed),
    lv_mode: 'rest_snapshot',
  };
  if (opts.urlKind) o.lv_url_kind = opts.urlKind;
  if (opts.probe) o.probe_lv = opts.probe;
  /* DP-170/171: lv_shape_<kod> nadal (sekret URL opcjonalny); bez wartości URL. */
  if (opts.urlShapes) {
    for (const [code, shape] of Object.entries(opts.urlShapes)) {
      o[`lv_shape_${code.toLowerCase()}`] = shape;
    }
  }
  return o;
}

/** DP-171 — kształt po normalizacji (raw → normalizeLvNapUrl); URL nie wymagany (DP-200). */
function lvUrlShapesFromEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of LV_NAP_CODES) {
    out[code] = normalizeLvNapUrl(env[lvNapUrlEnv(code)]).shape;
  }
  return out;
}

export async function runRoadLv(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const warnings: string[] = [];
  const configured: { code: LvNapCode; key: string; keyMeta: BalticKeyMeta }[] = [];
  const urlShapes = lvUrlShapesFromEnv(deps.env as Record<string, string | undefined>);
  for (const code of LV_NAP_CODES) {
    const keyMeta = balticKeyMeta(deps.env[lvNapKeyEnv(code)]);
    /* DP-200: wystarczy KEY; URL (jeśli jest) — ignorowany, shape w obs. */
    if (keyMeta.key) configured.push({ code, key: keyMeta.key, keyMeta });
  }
  const expectedFetches = configured.length;
  const first = configured[0];
  const lvBaseHost = balticWarnHost(LV_NAP_BASE);
  if (expectedFetches === 0) {
    return {
      job: 'road-lv', mode: 'LIVE', ok: true, risks: 0,
      warnings: [...warnings, 'LV: brak skonfigurowanych LV_NAP_*_KEY'],
      observations: {
        source: 'lvc_nap',
        fetched_ok: '0',
        expected_fetches: '0',
        configured: '0',
        header: LV_NAP_KEY_HEADER,
        lv_base: lvBaseHost,
        lv_mode: 'rest_snapshot',
        ...lvDiagObservations(balticKeyMeta(''), { urlShapes }),
      },
    };
  }

  if (!lvNapKeyAllowedForUrl(LV_DOWNLOAD_FILE_URL)) {
    return {
      job: 'road-lv', mode: 'LIVE', ok: false, risks: 0,
      warnings: ['LV: host snapshot poza NAP'],
      observations: {
        source: 'lvc_nap', fetched_ok: '0', expected_fetches: String(expectedFetches),
        configured: String(expectedFetches), header: LV_NAP_KEY_HEADER,
        lv_base: lvBaseHost, lv_mode: 'rest_snapshot',
      },
    };
  }

  const probeLv = await probeBalticHost(deps.fetch, lvBaseHost, LV_UA);
  const diag = lvDiagObservations(first!.keyMeta, {
    urlKind: balticUrlKind(LV_DOWNLOAD_FILE_URL),
    probe: probeLv,
    urlShapes,
  });
  diag.lv_base = lvBaseHost;

  const started = Date.now();
  const parseStats = { parsed: 0, skipped: 0, swapped: 0 };
  type LvFeedPart = {
    code: string;
    ok: boolean;
    warning: string | null;
    per: string;
    format: string;
    events: BalticRoadEvent[];
    skipped: number;
    swapped: number;
    shape?: string;
    err?: string;
  };

  const parts = await mapPoolLimit(configured, LV_FEED_CONCURRENCY, async ({ code, key }): Promise<LvFeedPart> => {
    if (Date.now() - started > BALTIC_FEED_BUDGET_MS) {
      return {
        code, ok: false, warning: `niepobrany ${code} (budżet czasu)`,
        per: 'budget', format: '', events: [], skipped: 0, swapped: 0,
      };
    }
    const errOf = (bodyText: string) => balticJsonErrorSnippet(bodyText) ?? undefined;
    const keyHeaders = (): Record<string, string> => ({
      'User-Agent': LV_UA,
      Accept: 'application/json, application/xml, text/xml, */*',
      [LV_NAP_KEY_HEADER]: key,
    });

    const postDownload = async (fileId: string): Promise<{
      res: Response;
      text: string;
      bytes: number;
      ct: string | null;
      bodyOk: boolean;
    }> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), BALTIC_FEED_TIMEOUT_MS);
      try {
        const res = await deps.fetch(LV_DOWNLOAD_FILE_URL, {
          method: 'POST',
          headers: {
            ...keyHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ file_id: fileId, format: 'xml' }),
          signal: ctrl.signal,
        });
        const ct = res.headers.get('content-type');
        if (res.status === 204) {
          return { res, text: '', bytes: 0, ct, bodyOk: true };
        }
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          return {
            res, text: errBody.slice(0, 8_000), bytes: errBody.length, ct, bodyOk: false,
          };
        }
        const body = await readBalticFeedBody(res);
        if (!body.ok) {
          return { res, text: '', bytes: body.bytes, ct, bodyOk: false };
        }
        return { res, text: body.text, bytes: body.bytes, ct, bodyOk: true };
      } finally {
        clearTimeout(timer);
      }
    };

    const getFileInfoId = async (): Promise<string | null> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), BALTIC_FEED_TIMEOUT_MS);
      try {
        const res = await deps.fetch(LV_FILE_INFO_URL, {
          method: 'GET',
          headers: keyHeaders(),
          signal: ctrl.signal,
        });
        if (!res.ok) return null;
        const body = await readBalticFeedBody(res);
        if (!body.ok) return null;
        try {
          return lvFileInfoFirstId(JSON.parse(body.text) as unknown);
        } catch {
          return null;
        }
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      let dl = await postDownload('1');
      /* DP-200: 403 FileIdMismatch → lista plików → ponów z pierwszym file_id. */
      if (dl.res.status === 403 && lvIsFileIdMismatch(dl.res.status, dl.text)) {
        const fallbackId = await getFileInfoId();
        if (fallbackId && fallbackId !== '1') {
          dl = await postDownload(fallbackId);
        } else {
          return {
            code, ok: false,
            warning: `LV ${code}: HTTP 403`,
            per: 'err:403', format: '', events: [], skipped: 0, swapped: 0,
            err: errOf(dl.text) ?? 'FileIdMismatch',
          };
        }
      }

      if (dl.res.status === 204) {
        return {
          code, ok: true, warning: null,
          per: 'empty_204', format: 'empty', events: [], skipped: 0, swapped: 0,
        };
      }

      if (!dl.res.ok) {
        const st = dl.res.status;
        const warnHttp = st === 404 || st === 422 || st >= 500 || st === 403;
        return {
          code, ok: false,
          warning: warnHttp ? `LV ${code}: HTTP ${st}` : `LV ${code}: HTTP ${st}`,
          per: `err:${st}`, format: '', events: [], skipped: 0, swapped: 0,
          err: errOf(dl.text),
        };
      }

      if (!dl.bodyOk) {
        const shape = balticFeedShapeObs(dl.res.status, dl.ct, dl.bytes, '');
        return {
          code, ok: false,
          warning: `nieczytelna odpowiedź ${code}`,
          per: 'too_large', format: 'unknown', events: [],
          skipped: 0, swapped: 0, shape,
        };
      }

      const text = dl.text;
      const shape = balticFeedShapeObs(dl.res.status, dl.ct, dl.bytes, text);
      const err = errOf(text);
      const localStats = { parsed: 0, skipped: 0, swapped: 0 };
      const parsed = parseLvFeedBody(text, code, localStats);
      parseStats.parsed += localStats.parsed;
      parseStats.skipped += localStats.skipped;
      parseStats.swapped += localStats.swapped;
      const recognized = parsed.format === 'datex-xml'
        || parsed.format === 'datex-json'
        || parsed.format === 'geojson';
      if (!recognized) {
        return {
          code, ok: false,
          warning: `nieczytelna odpowiedź ${code}`,
          per: `bad:${parsed.format}`, format: parsed.format, events: [],
          skipped: localStats.skipped, swapped: localStats.swapped, shape, err,
        };
      }
      /* DP-200: lv_<kod>=ok:<rekordy> (+ szczegół formatu jak wcześniej dla diagnostyki). */
      return {
        code, ok: true, warning: null,
        per: `ok:${parsed.events.length}`,
        format: parsed.format, events: parsed.events,
        skipped: localStats.skipped, swapped: localStats.swapped, err,
      };
    } catch (e) {
      const klass = classifyBalticNetError(e);
      return {
        code, ok: false,
        warning: balticNetWarning(`LV ${code}`, LV_DOWNLOAD_FILE_URL, e),
        per: klass === 'timeout' ? 'timeout' : `error:${klass}`,
        format: '', events: [], skipped: 0, swapped: 0,
      };
    }
  });

  let fetchedOk = 0;
  const allEvents: BalticRoadEvent[] = [];
  const perCode: Record<string, string> = {};
  const perShape: Record<string, string> = {};
  const formats: Record<string, string> = {};
  for (const p of parts) {
    perCode[p.code] = p.per;
    if (p.format) formats[p.code] = p.format;
    if (p.shape) perShape[p.code] = p.shape;
    if (p.warning) warnings.push(p.warning);
    if (p.ok) {
      fetchedOk++;
      for (const e of p.events) allEvents.push(e);
    }
  }

  const lvErrObs = Object.fromEntries(
    parts.filter((p) => p.err).slice(0, 3)
      .map((p) => [`lv_${p.code.toLowerCase()}_err`, p.err!]),
  );
  const lvPerObs = {
    ...Object.fromEntries(Object.entries(perCode).map(([k, v]) => [`lv_${k.toLowerCase()}`, v])),
    ...Object.fromEntries(Object.entries(perShape).map(([k, v]) => [`lv_${k.toLowerCase()}_shape`, v])),
    ...lvErrObs,
  };

  if (fetchedOk === 0) {
    const streak = await roadLvFailStreak(deps);
    if (streak >= 3) {
      await deps.store.raiseRisk(sourceDownRisk(
        'ROAD_LV',
        warnings.length ? warnings : ['LV NAP niedostępne'],
        now,
        LV_SOURCE_REF,
      ));
      return {
        job: 'road-lv', mode: 'LIVE', ok: false, risks: 1, warnings,
        observations: {
          road_lv_fail_streak: String(streak),
          source: 'lvc_nap',
          fetched_ok: '0',
          expected_fetches: String(expectedFetches),
          complete: '0',
          configured: String(expectedFetches),
          header: LV_NAP_KEY_HEADER,
          records_skipped: String(parseStats.skipped),
          ...diag,
          ...lvPerObs,
        },
      };
    }
    return {
      job: 'road-lv', mode: 'LIVE', ok: false, risks: 0, warnings,
      observations: {
        road_lv_fail_streak: String(streak),
        source: 'lvc_nap',
        fetched_ok: '0',
        expected_fetches: String(expectedFetches),
        complete: '0',
        configured: String(expectedFetches),
        header: LV_NAP_KEY_HEADER,
        records_skipped: String(parseStats.skipped),
        ...diag,
        ...lvPerObs,
      },
    };
  }

  await deps.store.resolveRisks('SOURCE_DOWN:ROAD_LV:');
  const deduped = dedupeLvSlippery(allEvents);
  const near = applyBalticCorridorRoadFilter('LV', filterInLvBboxes(deduped));
  await polishBalticCorridorEvents(deps, 'LV', near, now);
  const complete = fetchedOk === expectedFetches;
  let risks = 0;
  const keep: string[] = [];
  let lvOffCorridor = 0;
  for (const e of near) {
    /* Decyzja 99: A6/P/V off → LOW „obok trasy” (nie odrzucane); DeepL też. */
    const raise = balticShouldRaiseRisk('LV', e);
    if (!raise) continue;
    if (e.corridorMatch === 'off' || raise === 'off') lvOffCorridor++;
    const raw = e.weightLimitT != null
      ? weightLimitRisk('LV', e, null, LV_SOURCE_REF, LV_ATTRIBUTION)
      : isDimensionLimitEvent(e)
        ? dimensionLimitRisk('LV', e, LV_SOURCE_REF, LV_ATTRIBUTION)
        : balticRoadRisk('LV', e, LV_SOURCE_REF, LV_ATTRIBUTION);
    const risk = finalizeBalticRaisedRisk(raw, e, raise);
    if (risk.detail && typeof risk.detail === 'object') {
      if (e.road) (risk.detail as Record<string, unknown>).droga = e.road;
      if (e.corridorMatch) {
        (risk.detail as Record<string, unknown>).korytarz_droga = e.corridorMatch;
      }
    }
    keep.push(risk.dedup);
    if (await deps.store.raiseRisk(risk)) risks++;
  }
  if (complete && deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('ROAD_LV:', keep);
  }

  const weatherSlow = lvWeatherToSlowdownEvents(near);
  const slow = balticSlowdownMult(near);
  if (deps.store.saveCorridorCondition) {
    await deps.store.saveCorridorCondition({
      corridor: 'ROAD_LV',
      slowdownMult: slow.mult,
      reason: slow.reason,
      observedAt: now,
      detail: {
        events: near.length,
        events_corridor: near.filter((e) => e.corridorMatch === 'on').length,
        events_off_road: near.filter((e) => e.corridorMatch === 'off').length,
        weather_adverse: weatherSlow.length,
        zrodlo: LV_ATTRIBUTION,
        complete,
        formats,
        records_skipped: parseStats.skipped,
        dedup_ver: 'v2',
        dp164: 'filtr A7/E67+A1/A4/A5 + ≤3 km',
        lv_mode: 'rest_snapshot',
        lv_off_corridor: lvOffCorridor,
      },
    });
  }

  const safeWarnings = warnings.filter((w) =>
    !configured.some((c) => c.key && w.includes(c.key))
  );

  return {
    job: 'road-lv', mode: 'LIVE', ok: complete && safeWarnings.length === 0,
    risks, warnings: safeWarnings,
    observations: {
      source: 'lvc_nap',
      fetched_ok: String(fetchedOk),
      expected_fetches: String(expectedFetches),
      complete: complete ? '1' : '0',
      events_raw: String(deduped.length),
      events_near: String(near.length),
      configured: String(expectedFetches),
      header: LV_NAP_KEY_HEADER,
      records_skipped: String(parseStats.skipped),
      lv_swapped: String(parseStats.swapped),
      lv_off_corridor: String(lvOffCorridor),
      ...diag,
      ...lvPerObs,
    },
  };
}

async function roadLvFailStreak(deps: JobDeps): Promise<number> {
  let streak = 1;
  if (!deps.store.recentJobResults) return streak;
  const rows = await deps.store.recentJobResults('road-lv', 5);
  for (const row of rows) {
    const configured = Number(row.observations?.configured ?? NaN);
    /* F7 #730 N3: przebiegi bez sekretów (configured:0) przerywają streak. */
    if (Number.isFinite(configured) && configured === 0) break;
    const fo = Number(row.observations?.fetched_ok ?? NaN);
    if (fo === 0) streak++;
    else break;
  }
  return streak;
}

/**
 * BN6 (#716) cz.4 — drogi EE (Tark Tee DATEX, klucz X-DATEX-API-KEY).
 * Sekrety: TARKTEE_DATEX_TOKEN (pierwszy), potem TARKTEE_DATEX_PASSWORD (F7 #733 N5).
 * DP-168 / F7 #733 B6: wspólny fetch 5 MB / 10 s / 65 s. SOURCE_DOWN po 3× fetched_ok===0.
 */
const EE_FEED_CONCURRENCY = 4;

type EeFeedPart = {
  code: string;
  ok: boolean;
  warning: string | null;
  per: string;
  format: string;
  events: BalticRoadEvent[];
  sites?: Map<string, [number, number]> | Map<string, EeSiteInfo>;
  /** DP-171 — czas pobrania [ms]. */
  ms: number;
  /** DP-178 — kształt nieczytelnej odpowiedzi (bez treści/URL). */
  shape?: string;
  /** DP-180 — fetch | cache (RESTRICTIONS/SAFETY / sites). */
  source?: 'fetch' | 'cache';
};

async function fetchEeFeedPart(
  deps: JobDeps,
  feed: (typeof EE_DATEX_FEEDS)[number],
  apiKey: string,
  started: number,
  sites: Map<string, [number, number]>,
  parseStats: {
    parsed: number; skipped: number; swapped: number;
    roadFromPole: number; roadFromOpis: number;
    weatherBlocks: number; weatherNoSite: number;
  },
  timeoutMs: number = EE_FEED_TIMEOUT_MS,
): Promise<EeFeedPart> {
  const t0 = Date.now();
  if (Date.now() - started > EE_FEED_BUDGET_MS) {
    return {
      code: feed.code, ok: false,
      warning: `niepobrany ${feed.code} (budżet czasu)`,
      per: 'budget', format: '', events: [], ms: 0,
    };
  }
  const url = eeDatexFeedUrl(feed.path);
  const headers: Record<string, string> = {
    'User-Agent': EE_UA,
    Accept: feed.format === 'json'
      ? 'application/json, application/xml, text/xml, */*'
      : 'application/xml, text/xml, application/json, */*',
    /* DP-171: gzip na wszystkich usługach EE (jak sonda). */
    'Accept-Encoding': 'gzip',
    [EE_DATEX_KEY_HEADER]: apiKey,
  };
  const ctrl = new AbortController();
  /* DP-180: RESTRICTIONS 45 s; pozostałe EE_FEED_TIMEOUT_MS (30 s). */
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (Date.now() - started > EE_FEED_BUDGET_MS) {
      return {
        code: feed.code, ok: false,
        warning: `niepobrany ${feed.code} (budżet czasu)`,
        per: 'budget', format: '', events: [], ms: Math.max(0, Date.now() - t0),
      };
    }
    const res = await deps.fetch(url, { headers, signal: ctrl.signal });
    const ct = res.headers.get('content-type');
    if (!res.ok) {
      return {
        code: feed.code, ok: false,
        warning: `EE ${feed.code}: HTTP ${res.status}`,
        per: `http_${res.status}`, format: '', events: [],
        ms: Math.max(0, Date.now() - t0),
      };
    }
    /* DP-168: strumień 5 MB; DP-178: RESTRICTIONS do 20 MB (brak bbox w Tark Tee DATEX). */
    const maxBytes = feed.code === 'RESTRICTIONS'
      ? EE_RESTRICTIONS_MAX_BYTES
      : undefined;
    const body = await readBalticFeedBody(res, maxBytes);
    if (!body.ok) {
      const shape = balticFeedShapeObs(res.status, ct, body.bytes, '');
      return {
        code: feed.code, ok: false,
        warning: `nieczytelna odpowiedź ${feed.code}`,
        per: 'too_large', format: 'unknown', events: [],
        ms: Math.max(0, Date.now() - t0), shape,
      };
    }
    const localStats = {
      parsed: 0, skipped: 0, swapped: 0, roadFromPole: 0, roadFromOpis: 0,
      weatherBlocks: 0, weatherNoSite: 0,
    };
    const parsed = parseEeFeedBody(body.text, feed.code, feed.format, localStats, sites);
    parseStats.parsed += localStats.parsed;
    parseStats.skipped += localStats.skipped;
    parseStats.swapped += localStats.swapped;
    parseStats.roadFromPole += localStats.roadFromPole ?? 0;
    parseStats.roadFromOpis += localStats.roadFromOpis ?? 0;
    parseStats.weatherBlocks += localStats.weatherBlocks ?? 0;
    parseStats.weatherNoSite += localStats.weatherNoSite ?? 0;
    const recognized = parsed.format === 'datex-xml' || parsed.format === 'datex-json';
    if (!recognized) {
      /* DP-178: kształt nieczytelnej odpowiedzi (bez treści/URL). */
      const shape = balticFeedShapeObs(res.status, ct, body.bytes, body.text);
      return {
        code: feed.code, ok: false,
        warning: `nieczytelna odpowiedź ${feed.code}`,
        per: `bad:${parsed.format}`, format: parsed.format, events: [],
        ms: Math.max(0, Date.now() - t0), shape,
      };
    }
    /* DP-168 / F7 #733 B8 — ok:<rekordy>:<pominięte>:<format>:<swapped> */
    return {
      code: feed.code, ok: true, warning: null,
      per: balticFeedObsOk(
        parsed.events.length, localStats.skipped, parsed.format, localStats.swapped,
      ),
      format: parsed.format,
      events: parsed.events,
      sites: parsed.sites,
      ms: Math.max(0, Date.now() - t0),
      source: 'fetch',
    };
  } catch (e) {
    /* DP-169: klasa błędu + host bez ścieżki (klucz nie w warnings). */
    const klass = classifyBalticNetError(e);
    return {
      code: feed.code, ok: false,
      warning: balticNetWarning(`EE ${feed.code}`, url, e),
      per: klass === 'timeout' ? 'timeout' : `error:${klass}`,
      format: '', events: [],
      ms: Math.max(0, Date.now() - t0),
    };
  } finally {
    clearTimeout(timer);
  }
}

function eeDiagObservations(
  keyMeta: BalticKeyMeta,
  opts: { probe?: string; probeApi?: string } = {},
): Record<string, string> {
  const o: Record<string, string> = {
    key_header_sent: String(keyMeta.key_header_sent),
    key_len: String(keyMeta.key_len),
    key_trimmed: String(keyMeta.key_trimmed),
  };
  if (opts.probe) o.probe_ee = opts.probe;
  /* DP-170: ee_probe_api=<kod|klasa>:<ms>:<bajty> (45 s, gzip, animalObstacle). */
  if (opts.probeApi) o.ee_probe_api = opts.probeApi;
  return o;
}

export async function runRoadEe(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const warnings: string[] = [];
  const keyMeta = eeDatexApiKeyMeta(deps.env as Record<string, string | undefined>);
  const apiKey = keyMeta.key;
  if (!apiKey) {
    return {
      job: 'road-ee', mode: 'LIVE', ok: true, risks: 0,
      warnings: ['EE: brak TARKTEE_DATEX_TOKEN / TARKTEE_DATEX_PASSWORD'],
      observations: {
        source: 'tarktee_datex',
        fetched_ok: '0',
        expected_fetches: '0',
        configured: '0',
        header: EE_DATEX_KEY_HEADER,
        key_env_first: 'TARKTEE_DATEX_TOKEN',
        ...eeDiagObservations(keyMeta),
      },
    };
  }

  /* F7 #736 B1 — sonda tarktee.ee raz przed zbiorami (bez klucza). */
  const probeEe = await probeBalticHost(deps.fetch, 'tarktee.ee', EE_UA);
  /* F7 #739 B1 — próba API 45 s równolegle z pulą usług (nie przed), by ≤ ~65 s + kilka. */
  const probeApiP = probeEeDatexApi(deps.fetch, apiKey, EE_UA);

  const expectedFetches = EE_DATEX_FEEDS.length;
  const started = Date.now();
  const parseStats = {
    parsed: 0, skipped: 0, swapped: 0, roadFromPole: 0, roadFromOpis: 0,
    weatherBlocks: 0, weatherNoSite: 0,
  };
  const sites = new Map<string, [number, number]>();
  const parts: EeFeedPart[] = [];
  let sitesSource: 'fetch' | 'cache' | 'miss' = 'miss';

  /* F7 #733 B5 — measurementSites najpierw; DP-171: raz na dobę z cache. */
  const sitesFeed = EE_DATEX_FEEDS.find((f) => f.code === 'MEASUREMENT_SITES');
  const otherFeeds = EE_DATEX_FEEDS.filter((f) => f.code !== 'MEASUREMENT_SITES');
  const cachedSites = getEeSitesCache(started);
  if (sitesFeed && cachedSites) {
    for (const [id, ll] of cachedSites) sites.set(id, ll);
    sitesSource = 'cache';
    parts.push({
      code: sitesFeed.code, ok: true, warning: null,
      per: balticFeedObsOk(0, 0, 'cache', 0),
      format: 'cache', events: [], sites: cachedSites, ms: 0,
    });
  } else if (sitesFeed) {
    const sitePart = await fetchEeFeedPart(
      deps, sitesFeed, apiKey, started, sites, parseStats,
    );
    parts.push(sitePart);
    if (sitePart.sites && sitePart.sites.size > 0) {
      for (const [id, v] of sitePart.sites) {
        sites.set(id, Array.isArray(v) ? v : [v.lat, v.lon]);
      }
      setEeSitesCache(sitePart.sites, started);
      sitesSource = 'fetch';
    } else {
      const stale = getEeSitesCache(started, Number.POSITIVE_INFINITY);
      if (stale) {
        for (const [id, ll] of stale) sites.set(id, ll);
        sitesSource = 'cache';
        if (!sitePart.ok) {
          parts[parts.length - 1] = {
            ...sitePart,
            ok: true,
            warning: sitePart.warning
              ? `${sitePart.warning}; użyto cache stacji`
              : 'EE MEASUREMENT_SITES: użyto cache stacji',
            per: balticFeedObsOk(0, 0, 'cache-stale', 0),
            format: 'cache',
            sites: stale,
          };
        }
      }
    }
  }
  /*
   * DP-180 + DP-186: RESTRICTIONS/SAFETY co 60 min — pamięć procesu, potem baza
   * (cold start); świeża kopia → OK + ee_*_source=cache (liczy się do complete);
   * timeout 45 s tylko RESTRICTIONS; budżet 120 s bez zmian.
   */
  const feedsToFetch: (typeof EE_DATEX_FEEDS)[number][] = [];
  for (const feed of otherFeeds) {
    if (isEeHeavyFeedCode(feed.code)) {
      const mem = getEeHeavyFeedCache(feed.code, started, EE_HEAVY_FEED_CACHE_TTL_MS);
      if (mem) {
        parts.push({
          code: feed.code, ok: true, warning: null,
          per: balticFeedObsOk(mem.length, 0, 'cache', 0),
          format: 'cache', events: mem, ms: 0, source: 'cache',
        });
        continue;
      }
      const dbHit = deps.store.getEeHeavyFeedDbCache
        ? await deps.store.getEeHeavyFeedDbCache(
          feed.code, started, EE_HEAVY_FEED_CACHE_TTL_MS,
        )
        : null;
      if (dbHit) {
        setEeHeavyFeedCache(feed.code, dbHit.events, dbHit.fetchedAt);
        parts.push({
          code: feed.code, ok: true, warning: null,
          per: balticFeedObsOk(dbHit.events.length, 0, 'cache', 0),
          format: 'cache', events: dbHit.events, ms: 0, source: 'cache',
        });
        continue;
      }
    }
    feedsToFetch.push(feed);
  }
  const rest = await mapPoolLimit(feedsToFetch, EE_FEED_CONCURRENCY, (feed) =>
    fetchEeFeedPart(
      deps, feed, apiKey, started, sites, parseStats,
      feed.code === 'RESTRICTIONS' ? EE_RESTRICTIONS_TIMEOUT_MS : EE_FEED_TIMEOUT_MS,
    ));
  for (const part of rest) {
    if (part.ok && isEeHeavyFeedCode(part.code)) {
      setEeHeavyFeedCache(part.code, part.events, started);
      if (deps.store.setEeHeavyFeedDbCache) {
        try {
          await deps.store.setEeHeavyFeedDbCache(part.code, part.events, started);
        } catch (e) {
          warnings.push(
            `EE ${part.code}: zapis cache bazy nieudany (${e instanceof Error ? e.message : 'błąd'})`,
          );
        }
      }
      parts.push({ ...part, source: part.source ?? 'fetch' });
      continue;
    }
    if (!part.ok && isEeHeavyFeedCode(part.code)) {
      let stale = getEeHeavyFeedCache(part.code, started, Number.POSITIVE_INFINITY);
      if (!stale && deps.store.getEeHeavyFeedDbCache) {
        const dbStale = await deps.store.getEeHeavyFeedDbCache(
          part.code, started, Number.POSITIVE_INFINITY,
        );
        if (dbStale) {
          setEeHeavyFeedCache(part.code, dbStale.events, dbStale.fetchedAt);
          stale = dbStale.events;
        }
      }
      if (stale) {
        parts.push({
          ...part,
          ok: true,
          warning: part.warning
            ? `${part.warning}; użyto cache ${part.code}`
            : `EE ${part.code}: użyto cache`,
          per: balticFeedObsOk(stale.length, 0, 'cache-stale', 0),
          format: 'cache',
          events: stale,
          source: 'cache',
        });
        continue;
      }
    }
    parts.push(part);
  }

  const probeSettled = await Promise.allSettled([probeApiP]);
  const probeApi = probeSettled[0]!.status === 'fulfilled'
    ? probeSettled[0].value
    : `error:0:0`;
  const diag = eeDiagObservations(keyMeta, { probe: probeEe, probeApi });

  let fetchedOk = 0;
  const allEvents: BalticRoadEvent[] = [];
  const perCode: Record<string, string> = {};
  const perMs: Record<string, string> = {};
  const perShape: Record<string, string> = {};
  const perSource: Record<string, string> = {};
  for (const p of parts) {
    perCode[p.code] = p.per;
    /* DP-171: ee_<usługa>_ms */
    perMs[p.code] = String(p.ms);
    /* DP-178: ee_<usługa>_shape przy nieczytelnej odpowiedzi */
    if (p.shape) perShape[p.code] = p.shape;
    /* DP-180: ee_<usługa>_source=cache|fetch */
    if (p.source) perSource[p.code] = p.source;
    if (p.warning) warnings.push(p.warning);
    if (p.ok) {
      fetchedOk++;
      for (const e of p.events) allEvents.push(e);
    }
  }

  const eePerObs = {
    ...Object.fromEntries(Object.entries(perCode).map(([k, v]) => [`ee_${k.toLowerCase()}`, v])),
    ...Object.fromEntries(Object.entries(perMs).map(([k, v]) => [`ee_${k.toLowerCase()}_ms`, v])),
    ...Object.fromEntries(Object.entries(perShape).map(([k, v]) => [`ee_${k.toLowerCase()}_shape`, v])),
    ...Object.fromEntries(
      Object.entries(perSource).map(([k, v]) => [`ee_${k.toLowerCase()}_source`, v]),
    ),
    ee_sites_source: sitesSource,
  };

  if (fetchedOk === 0) {
    const streak = await roadEeFailStreak(deps);
    if (streak >= 3) {
      await deps.store.raiseRisk(sourceDownRisk(
        'ROAD_EE',
        warnings.length ? warnings : ['Tark Tee DATEX niedostępne'],
        now,
        EE_SOURCE_REF,
      ));
      return {
        job: 'road-ee', mode: 'LIVE', ok: false, risks: 1, warnings,
        observations: {
          road_ee_fail_streak: String(streak),
          source: 'tarktee_datex',
          fetched_ok: '0',
          expected_fetches: String(expectedFetches),
          complete: '0',
          configured: '1',
          header: EE_DATEX_KEY_HEADER,
          key_env_first: 'TARKTEE_DATEX_TOKEN',
          ...diag,
          ...eePerObs,
        },
      };
    }
    return {
      job: 'road-ee', mode: 'LIVE', ok: false, risks: 0, warnings,
      observations: {
        road_ee_fail_streak: String(streak),
        source: 'tarktee_datex',
        fetched_ok: '0',
        expected_fetches: String(expectedFetches),
        complete: '0',
        configured: '1',
        header: EE_DATEX_KEY_HEADER,
        key_env_first: 'TARKTEE_DATEX_TOKEN',
        ...diag,
        ...eePerObs,
      },
    };
  }

  await deps.store.resolveRisks('SOURCE_DOWN:ROAD_EE:');
  const near = applyBalticCorridorRoadFilter('EE', filterInEeBboxes(allEvents));
  /* DP-172 / decyzja 99: DeepL EE także „obok trasy”. */
  await polishBalticCorridorEvents(deps, 'EE', near, now);
  /* F7 #733 r2 B2: 0 stacji albo >50% pomiarów bez stacji → pogoda niekompletna. */
  const wxBlocks = parseStats.weatherBlocks ?? 0;
  const wxNoSite = parseStats.weatherNoSite ?? 0;
  const noSiteRatio = wxBlocks > 0 ? wxNoSite / wxBlocks : 0;
  const weatherIncomplete = sites.size === 0 || noSiteRatio > 0.5;
  if (weatherIncomplete) {
    warnings.push('EE: brak stacji');
  }
  const complete = fetchedOk === expectedFetches && !weatherIncomplete;
  let risks = 0;
  const keep: string[] = [];
  let eeOffCorridor = 0;
  for (const e of near) {
    /* Decyzja 99: off → LOW „obok trasy”. */
    const raise = balticShouldRaiseRisk('EE', e);
    if (!raise) continue;
    if (e.corridorMatch === 'off' || raise === 'off') eeOffCorridor++;
    const raw = e.weightLimitT != null
      ? weightLimitRisk('EE', e, null, EE_SOURCE_REF, EE_ATTRIBUTION)
      : isDimensionLimitEvent(e)
        ? dimensionLimitRisk('EE', e, EE_SOURCE_REF, EE_ATTRIBUTION)
        : balticRoadRisk('EE', e, EE_SOURCE_REF, EE_ATTRIBUTION);
    const risk = finalizeBalticRaisedRisk(raw, e, raise);
    if (risk.detail && typeof risk.detail === 'object') {
      if (e.road) (risk.detail as Record<string, unknown>).droga = e.road;
      (risk.detail as Record<string, unknown>).korytarz_droga = e.corridorMatch;
      (risk.detail as Record<string, unknown>).zrodlo = EE_ATTRIBUTION;
    }
    keep.push(risk.dedup);
    if (await deps.store.raiseRisk(risk)) risks++;
  }
  if (complete && deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('ROAD_EE:', keep);
  }

  const slow = balticSlowdownMult(near.filter((e) => e.corridorMatch === 'on'));
  if (deps.store.saveCorridorCondition) {
    await deps.store.saveCorridorCondition({
      corridor: 'ROAD_EE',
      slowdownMult: slow.mult,
      reason: slow.reason,
      observedAt: now,
      detail: {
        events: near.length,
        events_corridor: near.filter((e) => e.corridorMatch === 'on').length,
        events_off_road: near.filter((e) => e.corridorMatch === 'off').length,
        zrodlo: EE_ATTRIBUTION,
        complete,
        records_skipped: parseStats.skipped,
        note: 'SRTI slippery/visibility — niedostępne w UI (#716)',
      },
    });
  }

  const safeWarnings = warnings.filter((w) => !apiKey || !w.includes(apiKey));

  return {
    job: 'road-ee', mode: 'LIVE', ok: complete && safeWarnings.length === 0,
    risks, warnings: safeWarnings,
    observations: {
      source: 'tarktee_datex',
      fetched_ok: String(fetchedOk),
      expected_fetches: String(expectedFetches),
      complete: complete ? '1' : '0',
      events_raw: String(allEvents.length),
      events_near: String(near.length),
      configured: '1',
      header: EE_DATEX_KEY_HEADER,
      key_env_first: 'TARKTEE_DATEX_TOKEN',
      records_skipped: String(parseStats.skipped),
      ee_swapped: String(parseStats.swapped),
      ee_off_corridor: String(eeOffCorridor),
      ee_road_from: `pole:${parseStats.roadFromPole},opis:${parseStats.roadFromOpis}`,
      measurement_sites: String(sites.size),
      ...diag,
      ...eePerObs,
    },
  };
}

async function roadEeFailStreak(deps: JobDeps): Promise<number> {
  let streak = 1;
  if (!deps.store.recentJobResults) return streak;
  const rows = await deps.store.recentJobResults('road-ee', 5);
  for (const row of rows) {
    const configured = Number(row.observations?.configured ?? NaN);
    if (Number.isFinite(configured) && configured === 0) break;
    const fo = Number(row.observations?.fetched_ok ?? NaN);
    if (fo === 0) streak++;
    else break;
  }
  return streak;
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

/**
 * #667 C — odświeżanie geometrii pomarańczowych dróg HERE przed purge 30 d.
 * Próg 6 d (DP-198); brak punktów → SOURCE_DOWN HERE_ROADS (JOB_FAILURE, sticky).
 */
export async function runHereRoads(deps: JobDeps): Promise<JobResult> {
  const now = deps.now();
  const nowIso = now.toISOString();
  const key = deps.env.HERE_API_KEY?.trim();
  if (!key) {
    return {
      job: 'here-roads', mode: 'DEMO', ok: true,
      reason: 'Brak HERE_API_KEY — cron nie odświeża geometrii (przeglądarka też nie)',
    };
  }
  if (!deps.store.listHereRoadGeometry || !deps.store.storeHereRoad) {
    return { job: 'here-roads', mode: 'DEMO', ok: false, reason: 'Magazyn bez geometrii HERE' };
  }
  const storeAdapter: RoadRefreshStore = {
    listLegs: deps.store.listHereRoadLegs
      ? () => deps.store.listHereRoadLegs!()
      : undefined,
    listGeometry: () => deps.store.listHereRoadGeometry!(),
    async storeRoad(leg, points, summary, nowIsoArg, meta) {
      await deps.store.storeHereRoad!(leg, points, summary, nowIsoArg, meta);
      return true;
    },
    async loadCorridor(code) {
      if (!deps.store.hereCorridorBundle) return { code, pts: [], via: [], updatedAt: 0 };
      return deps.store.hereCorridorBundle(code);
    },
    // F7 #673 r4 uwaga 3: brak hereMonthSpend → null (nie zakładaj 0 / nie wołaj HERE).
    monthSpend: () => (deps.store.hereMonthSpend ? deps.store.hereMonthSpend() : Promise.resolve(null)),
    async noteRouting() {
      if (deps.store.noteHereUsage) await deps.store.noteHereUsage('routing', 1);
    },
  };
  const result = await refreshRoadLegs(storeAdapter, {
    fetch: deps.fetch,
    hereApiKey: key,
    nowMs: now.getTime(),
    maxAgeMs: ROAD_CRON_REFRESH_MS,
  });
  let risks = 0;
  if (result.missingLegs.length > 0) {
    if (await deps.store.raiseRisk(sourceDownRisk(
      'HERE_ROADS',
      [
        `Brak geometrii: ${result.missingLegs.join(', ')}`,
        ...result.warnings.slice(0, 5),
      ],
      nowIso,
      'https://router.hereapi.com/v8/routes',
    ))) risks = 1;
    return {
      job: 'here-roads', mode: 'LIVE', ok: false, risks,
      warnings: result.warnings,
      reason: `Brak linii: ${result.missingLegs.join(', ')}`,
      observations: {
        stored: String(result.stored),
        attempted: String(result.attempted),
        missing: result.missingLegs.join(','),
        budget: result.skippedBudget ? 'stop' : 'ok',
        ...(result.observations ?? {}),
      },
    };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:HERE_ROADS');
  return {
    job: 'here-roads', mode: 'LIVE', ok: true, risks: 0,
    warnings: result.warnings,
    reason: result.skippedBudget
      ? 'Budżet HERE — legi świeże, bez odświeżenia'
      : `Odświeżono ${result.stored} legów (próby ${result.attempted})`,
    observations: {
      stored: String(result.stored),
      attempted: String(result.attempted),
      budget: result.skippedBudget ? 'stop' : 'ok',
      ...(result.observations ?? {}),
    },
  };
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
  /* DP-145: family_key ze słownika; DP-148: awaria odczytu → zapas w kodzie + ostrzeżenie (nie przerywa joba). */
  let familyByCode: Record<string, string> | null = null;
  if (deps.store.ferryRouteFamilies) {
    try {
      familyByCode = await deps.store.ferryRouteFamilies();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Słownik ferry_routes niedostępny (${msg}) — używam mapy w kodzie`);
      familyByCode = null;
    }
  }
  const fromIso = new Date(now.getTime() - 3 * 3600_000).toISOString();
  const toIso = new Date(now.getTime() + 72 * 3600_000).toISOString();
  const sailings = await deps.store.sailingsSince(fromIso);
  const upcoming = sailings.filter((s) => Date.parse(s.departure_at) <= Date.parse(toIso));
  const vessels = await deps.store.vessels();
  const vesselName = (id: string) => vessels.find((v) => v.id === id)?.name ?? id;
  const vesselById = new Map(
    vessels.map((v) => [v.id, { name: v.name, ice_class: v.ice_class ?? null }]),
  );

  // Okno pobrania: od teraz −6 h do najdalszego odejścia +6 h (max 72 h)
  let fetchFrom = new Date(now.getTime() - 6 * 3600_000);
  let fetchTo = new Date(now.getTime() + 18 * 3600_000);
  for (const s of upcoming) {
    const dep = Date.parse(s.departure_at);
    fetchFrom = new Date(Math.min(fetchFrom.getTime(), dep - 6 * 3600_000));
    fetchTo = new Date(Math.max(fetchTo.getTime(), dep + 6 * 3600_000));
  }
  const fFrom = fetchFrom.toISOString();
  /* DP-149: horyzont FMI WAM ~54 h — dalej i tak NaN; nie żądaj poza modelem. */
  const fmiCapIso = new Date(now.getTime() + 54 * 3600_000).toISOString();
  let fTo = fetchTo.toISOString();
  if (fTo > fmiCapIso) fTo = fmiCapIso;

  const samples: MarineSample[] = [];
  let fmiOk = 0;
  let dmiOk = 0;
  let smhiOk = 0;
  /* DP-149: NaN na końcu okna ≠ poza siatką.
   * DP-152: przycinaj do maksimum lastValid po punktach (nie minimum — przybrzeżny nie skraca DMI/window_to wszystkim). */
  const fHorizons: string[] = [];

  for (const code of Object.keys(MARINE_POINTS) as MarinePointCode[]) {
    const p = MARINE_POINTS[code];
    const wUrl = fmiWamUrl(p.lat, p.lon, fFrom, fTo);
    const gUrl = fmiHarmonieUrl(p.lat, p.lon, fFrom, fTo);
    const wRes = await readText(deps, wUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml' } });
    const gRes = await readText(deps, gUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml' } });
    if (wRes.ok) {
      const parsed = parseFmiTimeValuePair(wRes.text, code, 'wave');
      samples.push(...parsed.samples);
      if (fmiNanAllOffGrid(parsed)) {
        warnings.push(`FMI WAM ${code}: NaN poza siatką — punkt pominięty (${parsed.nanSkipped})`);
      } else if (parsed.samples.length) {
        fmiOk++;
        const last = fmiLastValidIso(parsed.samples);
        if (last) fHorizons.push(last);
      }
    } else warnings.push(`FMI WAM ${code}: ${wRes.warning}`);
    let gustOk = false;
    if (gRes.ok) {
      const parsed = parseFmiTimeValuePair(gRes.text, code, 'gust');
      samples.push(...parsed.samples);
      if (fmiNanAllOffGrid(parsed)) {
        warnings.push(`FMI Harmonie ${code}: NaN poza siatką — punkt pominięty (${parsed.nanSkipped})`);
      } else if (parsed.samples.length) {
        fmiOk++;
        gustOk = true;
        const last = fmiLastValidIso(parsed.samples);
        if (last) fHorizons.push(last);
      }
    } else warnings.push(`FMI Harmonie ${code}: ${gRes.warning}`);

    // BN5: SMHI snow1g — zapas wiatru gdy Harmonie bez próbek
    if (!gustOk) {
      const sUrl = smhiSnow1gUrl(p.lon, p.lat);
      const sRes = await readText(deps, sUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (sRes.ok) {
        try {
          const parsed = parseSmhiSnow1g(JSON.parse(sRes.text), code);
          samples.push(...parsed);
          if (parsed.length) smhiOk++;
        } catch {
          warnings.push(`SMHI snow1g ${code}: nieczytelna odpowiedź`);
        }
      } else {
        warnings.push(`SMHI snow1g ${code}: ${sRes.warning}`);
      }
    }
  }

  if (fHorizons.length) {
    const fHorizonTo = fHorizons.reduce((a, b) => (a > b ? a : b));
    if (fHorizonTo < fTo) fTo = fHorizonTo;
  }

  /* DP-150: DMI — 1 punkt/korytarz, szeregowo z odstępem, cache 3 h, timeout 8 s.
   * DP-154: po 3 przebiegach bez odpowiedzi — pomiń 24 h (jedno ostrzeżenie). */
  let dmiSkipped = false;
  await hydrateDmiSkip(deps, now.getTime());
  if (now.getTime() < dmiSkipUntilMs) {
    dmiSkipped = true;
    warnings.push(
      `DMI pominięte do ${new Date(dmiSkipUntilMs).toISOString()} (po ${DMI_SKIP_AFTER_FAILS} przebiegach bez odpowiedzi)`,
    );
  } else {
    const dmiGapMs = Math.max(0, Number(deps.env.DMI_REQUEST_GAP_MS ?? DMI_DEFAULT_GAP_MS));
    const dmiTimeoutMs = Math.max(1_000, Number(deps.env.DMI_TIMEOUT_MS ?? DMI_READ_TIMEOUT_MS));
    const dmiCodes = dmiPointsUnique();
    for (let i = 0; i < dmiCodes.length; i++) {
      const code = dmiCodes[i]!;
      if (i > 0) await sleepMs(dmiGapMs);
      const p = MARINE_POINTS[code];
      const dUrl = dmiWamUrl(p.lon, p.lat, fFrom, fTo);
      const cacheKey = `${code}|${fFrom}|${fTo}`;
      const cached = dmiResponseCache.get(cacheKey);
      let dText: string | null = null;
      if (cached && now.getTime() - cached.fetchedAt < DMI_CACHE_TTL_MS) {
        dText = cached.text;
      } else {
        let dRes = await readText(deps, dUrl, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/prs.coverage+json,application/json' },
        }, dmiTimeoutMs);
        if (!dRes.ok && /HTTP 429/.test(dRes.warning)) {
          await sleepMs(dmiGapMs);
          dRes = await readText(deps, dUrl, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/prs.coverage+json,application/json' },
          }, dmiTimeoutMs);
        }
        if (dRes.ok) {
          dText = dRes.text;
          dmiResponseCache.set(cacheKey, { fetchedAt: now.getTime(), text: dRes.text });
        } else {
          warnings.push(`DMI ${code}: ${dRes.warning}`);
        }
      }
      if (dText == null) continue;
      try {
        const parsed = parseDmiCoverageJson(JSON.parse(dText), code);
        samples.push(...parsed);
        if (parsed.length) dmiOk++;
      } catch {
        warnings.push(`DMI ${code}: nieczytelny CoverageJSON`);
      }
    }
    if (dmiOk > 0) {
      dmiSkipUntilMs = 0;
    } else {
      const streak = (await dmiFailStreak(deps)) + 1;
      if (streak >= DMI_SKIP_AFTER_FAILS) {
        dmiSkipUntilMs = now.getTime() + DMI_SKIP_MS;
        warnings.push(
          `DMI: ${DMI_SKIP_AFTER_FAILS} przebiegi bez odpowiedzi — pomijam do ${new Date(dmiSkipUntilMs).toISOString()}`,
        );
      }
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

  // BN5: SOURCE_DOWN gdy brak FMI i DMI (SMHI ocobs nie zastępuje prognoz).
  if (fmiOk === 0 && dmiOk === 0) {
    await deps.store.raiseRisk(sourceDownRisk('MARINE_WEATHER', warnings, nowIso, 'https://en.ilmatieteenlaitos.fi/open-data'));
    return {
      job: 'ferry-weather', mode: 'LIVE', ok: false, risks: 1, warnings,
      ...(dmiSkipUntilMs > now.getTime()
        ? { dmi_skip_until: new Date(dmiSkipUntilMs).toISOString() }
        : {}),
      observations: {
        fmi: String(fmiOk), dmi: String(dmiOk), smhi: String(smhiOk),
        ...(dmiSkipped ? { dmi_skipped: '1' } : {}),
      },
    };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:MARINE_WEATHER:');

  /* BN5 cz.3 / F7 #777: horyzont = koniec doby UTC najpóźniejszego przypłynięcia. */
  let iceUntilMs = Date.parse(nowIso) + 72 * 3600_000;
  for (const s of upcoming) {
    const arrMs = Date.parse(s.delayed_arrival_at ?? s.arrival_at);
    if (Number.isFinite(arrMs)) iceUntilMs = Math.max(iceUntilMs, utcDayEndMs(arrMs));
  }
  const iceSnap = await fetchWinterNavIceSnapshot(deps, nowIso, iceUntilMs);
  warnings.push(...iceSnap.warnings);

  const nearTo = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const evalByCorridor = new Map<string, ReturnType<typeof evaluateMarineWindow>>();
  for (const corridor of MARINE_CORRIDORS) {
    const pts = new Set(marinePointsForCorridor(corridor));
    const slice = samplesInWindow(samples.filter((s) => pts.has(s.point)), nowIso, nearTo);
    const ev = evaluateMarineWindow(slice.length ? slice : samples.filter((s) => pts.has(s.point)), thr.waveM, thr.gustKn);
    evalByCorridor.set(corridor, ev);
    if (deps.store.saveMarineCondition && (slice.length || ev.sources.length)) {
      const attr = iceSnap.attribution
        ? `${ev.attribution} · ${iceSnap.attribution}`
        : ev.attribution;
      await deps.store.saveMarineCondition({
        corridor,
        maxWaveM: ev.maxWaveM,
        maxGustKn: ev.maxGustKn,
        risk: ev.risk,
        waveThrM: thr.waveM,
        gustThrKn: thr.gustKn,
        sources: ev.sources.join('+'),
        attribution: attr,
        windowFrom: fFrom,
        windowTo: fTo,
        detail: {
          fmi: fmiOk, dmi: dmiOk, smhi: smhiOk,
          samples: slice.length, sailings: upcoming.length,
          warnings: warnings.slice(0, 24),
          punkty: [...pts],
          ice: {
            ok: iceSnap.ok,
            /* F7 #777: okna w horyzoncie (do końca doby najpóźniejszego przypłynięcia), nie tylko „teraz”. */
            horizon: 'do końca doby UTC najpóźniejszego przypłynięcia',
            hits: iceSnap.hits.map((h) => ({
              locode: h.locode, kind: h.kind, summary: h.summary,
              start: h.startTime, end: h.endTime,
            })),
            atrybucja: iceSnap.attribution,
          },
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
    const routePts = marinePointsForRoute(s.route, familyByCode);
    if (!routePts?.length) continue; // BN5: trasa bez mapy — bez oceny / bez GDN-NYN
    const pts = new Set(routePts);
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

  risks += await raiseFerryIceRisks(deps, upcoming, vesselById, nowIso, iceSnap.hits);

  return {
    job: 'ferry-weather', mode: 'LIVE', ok: true, risks, warnings,
    /* DP-154: okno pominięcia DMI — zimny start Edge czyta recentJobResults. */
    ...(dmiSkipUntilMs > now.getTime()
      ? { dmi_skip_until: new Date(dmiSkipUntilMs).toISOString() }
      : {}),
    observations: {
      wave: globalEval.maxWaveM != null ? String(globalEval.maxWaveM) : '',
      gust: globalEval.maxGustKn != null ? String(globalEval.maxGustKn) : '',
      risk: globalEval.risk,
      sources: globalEval.sources.join('+'),
      fmi: String(fmiOk), dmi: String(dmiOk), smhi: String(smhiOk),
      ...(dmiSkipped ? { dmi_skipped: '1' } : {}),
      attribution: iceSnap.attribution
        ? `${globalEval.attribution} · ${iceSnap.attribution}`
        : globalEval.attribution,
      ...(iceSnap.hits.length ? { ice_hits: String(iceSnap.hits.length) } : {}),
    },
  };
}

type WinterNavIceSnapshot = {
  ok: boolean;
  hits: ReturnType<typeof parseWinterNavigationLocations>['hits'];
  warnings: string[];
  attribution: string | null;
};

/** BN5 cz.3 — GET winter-nav (gzip + Digitraffic-User); pusto = OK. */
async function fetchWinterNavIceSnapshot(
  deps: JobDeps,
  nowIso: string,
  untilMs: number,
): Promise<WinterNavIceSnapshot> {
  const page = await readText(deps, WINTER_NAV_LOCATIONS_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Digitraffic-User': DIGITRAFFIC_USER,
    },
  });
  if (!page.ok) {
    return {
      ok: false, hits: [],
      warnings: [`winter-nav (FERRY_ICE): ${page.warning}`],
      attribution: null,
    };
  }
  let json: unknown;
  try { json = JSON.parse(page.text); } catch {
    return {
      ok: false, hits: [],
      warnings: ['winter-nav (FERRY_ICE): nieczytelny JSON'],
      attribution: null,
    };
  }
  /* F7 #777: untilMs = koniec doby najpóźniejszego przypłynięcia (filtr dnia w raiseFerryIceRisks). */
  const parsed = parseWinterNavigationLocations(json, nowIso, {
    mode: 'open_until', untilMs,
  });
  if (parsed.warnings.some((w) => /struktura/i.test(w))) {
    return {
      ok: false, hits: [],
      warnings: parsed.warnings.map((w) => `winter-nav (FERRY_ICE): ${w}`),
      attribution: null,
    };
  }
  return {
    ok: true,
    hits: parsed.hits,
    warnings: parsed.warnings,
    attribution: FERRY_ICE_ATTRIBUTION,
  };
}

type IceSailing = {
  id: string;
  vessel_id: string;
  route: string;
  departure_at: string;
  arrival_at: string;
  delayed_departure_at?: string | null;
  delayed_arrival_at?: string | null;
};

/**
 * BN5 cz.3 / DP-120 / F7 #777 — FERRY_ICE per rejs:
 * port wyjścia wg dnia odejścia, docelowy wg dnia przypłynięcia;
 * porównanie klasy lodowej; dwa okna → najsurowsze.
 */
async function raiseFerryIceRisks(
  deps: JobDeps,
  upcoming: IceSailing[],
  vesselById: Map<string, { name: string; ice_class?: string | null }>,
  nowIso: string,
  hits: WinterNavIceSnapshot['hits'],
): Promise<number> {
  const byLocode = new Map<string, WinterNavIceSnapshot['hits']>();
  for (const hit of hits) {
    const list = byLocode.get(hit.locode) ?? [];
    list.push(hit);
    byLocode.set(hit.locode, list);
  }
  const keep: string[] = [];
  let risks = 0;
  for (const s of upcoming) {
    const ends = winterLocodeEndsForRoute(s.route);
    if (!ends.length) continue;
    const depMs = Date.parse(s.delayed_departure_at ?? s.departure_at);
    const arrMs = Date.parse(s.delayed_arrival_at ?? s.arrival_at);
    const v = vesselById.get(s.vessel_id);
    const vesselLabel = v?.name ?? s.vessel_id;
    const iceClass = v?.ice_class ?? null;

    /* Per locode: zawieszenia wszystkie; ograniczenia → jedno najsurowsze. */
    const locodes = [...new Set(ends.map((e) => e.locode))];
    for (const locode of locodes) {
      const dayMsFor = (end: 'dep' | 'arr') => (end === 'dep' ? depMs : arrMs);
      const activeHits = (byLocode.get(locode) ?? []).filter((hit) => {
        /* Ten sam LOCODE na obu końcach (np. pętla) — wystarczy przecięcie któregoś dnia. */
        const roles = ends.filter((e) => e.locode === locode).map((e) => e.end);
        return roles.some((role) =>
          isWinterNavWindowActiveOnSailingDay(hit.startTime, hit.endTime, dayMsFor(role))
        );
      });
      if (!activeHits.length) continue;

      const suspensions = activeHits.filter((h) => h.kind === 'SUSPENSION');
      const restrictions = activeHits.filter((h) => h.kind === 'RESTRICTION');

      for (const hit of suspensions) {
        const risk = ferryIceRisk({
          hit,
          sailingId: s.id,
          vessel: vesselLabel,
          route: s.route,
          departureUtc: s.departure_at,
          nowIso,
          vesselIceClass: iceClass,
        });
        keep.push(risk.dedup);
        if (await deps.store.raiseRisk(risk)) risks += 1;
      }

      if (restrictions.length) {
        let best = restrictions[0]!;
        let bestScore = ibnetRestrictionStrictness(parseIbnetRestriction(best.summary));
        for (let i = 1; i < restrictions.length; i++) {
          const cand = restrictions[i]!;
          const score = ibnetRestrictionStrictness(parseIbnetRestriction(cand.summary));
          if (score > bestScore) {
            best = cand;
            bestScore = score;
          }
        }
        const req = parseIbnetRestriction(best.summary);
        if (!vesselMeetsIbnetIceClass(iceClass, req)) {
          const risk = ferryIceRisk({
            hit: best,
            sailingId: s.id,
            vessel: vesselLabel,
            route: s.route,
            departureUtc: s.departure_at,
            nowIso,
            vesselIceClass: iceClass,
          });
          keep.push(risk.dedup);
          if (await deps.store.raiseRisk(risk)) risks += 1;
        }
      }
    }
  }
  if (deps.store.resolveStaleRisks) {
    await deps.store.resolveStaleRisks('FERRY_ICE:', keep);
  } else if (!keep.length) {
    await deps.store.resolveRisks('FERRY_ICE:');
  }
  return risks;
}

/**
 * emtrack-web / TELM-EMTRACK-WEB — odczyt pozycji naczepy (D-36 zapas).
 * Tylko odczyt WS; zero zapisu do emtrack. Wymaga flagi TELM_EMTRACK_WEB + sekretów EMTRACK_*.
 */

/**
 * H-12 (zakazy czasowe) + mostek do E49 wiatru (żywa seria = corridor-wind / corridor_wind_forecast).
 * Korekta ETA i sprawy Z2 — kolejne kroki DP-205 (basis.weather).
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
  const gustEnv = deps.env.H10_TEST_GUST_MS;
  const windKeep: string[] = [];
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
    const fresh = deps.store.corridorWindFreshCount
      ? await deps.store.corridorWindFreshCount(120)
      : 0;
    if (fresh > 0) {
      warnings.push(`E49: żywa seria wiatru — ${fresh} punktów < 2 h (próg ${WIND_GUST_MS_THRESHOLD} m/s)`);
      /*
       * Z2 (F7 #785 r1 pkt 5): JEDNA otwarta sprawa na transport i korytarz (E49_WIND:{load}:{korytarz}),
       * tylko korytarze tego transportu, tylko odcinek bieżący, tylko punkty przed autem; poryw ≥ WIND_SLOW_MS
       * w 24 h niezależnie od kierunku; ≥ WIND_HOLD_MS = wyższa waga na tym samym kluczu (aktualizacja w miejscu);
       * zamknięcie z histerezą (poniżej progu − 2 m/s). Progi z ops_thresholds. Odbiorcy: HHL + SCX.
       */
      if (deps.store.listCorridorWindForecast && deps.store.e49WindLoadCorridors) {
        const legs = await deps.store.e49WindLoadCorridors();
        const thr = deps.store.e49WindThresholds
          ? await deps.store.e49WindThresholds()
          : { ...E49_WIND_DEFAULTS };
        const openKeys = new Set(
          deps.store.openRiskDedups ? await deps.store.openRiskDedups('E49_WIND:') : [],
        );
        const statusById = new Map(loads.map((l) => [l.id, l.status ?? ''] as const));
        // DP-212: jedno listCorridorWindForecast na przebieg (nie N+1 per korytarz).
        const seen = new Set<string>();
        const activeLegs = legs.filter((leg) => {
          if (!leg.currentLeg) return false; // odcinek SE/FI dla auta jeszcze w PL liczy tylko ETA (Z1)
          const st = statusById.get(leg.loadId) ?? '';
          if (st === 'AT_SITE' || st === 'FERRY') return false; // nie na placu budowy / promie
          const dedup = windCaseDedup(leg.loadId, leg.code);
          if (seen.has(dedup)) return false;
          seen.add(dedup);
          return true;
        });
        const codes = [...new Set(activeLegs.map((l) => l.code))];
        const allWind = codes.length
          ? await deps.store.listCorridorWindForecast(codes, 180)
          : [];
        const byCorr = new Map<string, CorridorWindRow[]>();
        for (const row of allWind) {
          const list = byCorr.get(row.corridor) ?? [];
          list.push(row);
          byCorr.set(row.corridor, list);
        }
        for (const leg of activeLegs) {
          const dedup = windCaseDedup(leg.loadId, leg.code);
          const plan = planWindCase({
            loadId: leg.loadId,
            corridor: leg.code,
            rows: byCorr.get(leg.code) ?? [],
            fromKm: leg.fromKm,
            now: deps.now(),
            thr,
            isOpen: openKeys.has(dedup),
          });
          if (plan.action === 'raise') {
            windKeep.push(dedup);
            if (await deps.store.raiseRisk(plan.risk)) risks++;
          } else if (plan.action === 'keep') {
            windKeep.push(dedup);
          }
        }
        if (deps.store.resolveStaleRisks) {
          await deps.store.resolveStaleRisks('E49_WIND:', windKeep);
          await deps.store.resolveStaleRisks('E49_WIND_HOLD:', []); // stary klucz postoju (przed F7 r1)
        }
      }
    } else {
      /* Bez świeżej prognozy sprawy wiatrowe nie wiszą bez końca (F7 #785 r1 pkt 5h). */
      if (deps.store.resolveStaleRisks) {
        await deps.store.resolveStaleRisks('E49_WIND:', []);
        await deps.store.resolveStaleRisks('E49_WIND_HOLD:', []);
      }
      warnings.push('E49: brak żywej serii wiatru drogowego — próg 20 m/s (ops_thresholds WIND_SLOW_MS); job corridor-wind');
    }
  }
  /* E49-b Z3: zamknięcie drogi/mostu on-route → sprawa SCX + HERE objazd. */
  let detourUpserts = 0;
  let detourHere = 0;
  if (deps.store.listOpenRoadClosures && deps.store.upsertE49DetourCase) {
    const det = await runDetourCases({
      store: deps.store,
      fetch: deps.fetch,
      now: deps.now(),
      hereApiKey: deps.env.HERE_API_KEY ?? null,
    });
    detourUpserts = det.upserts;
    detourHere = det.hereCalls;
    warnings.push(...det.warnings);
    if (det.candidates > 0) {
      warnings.push(
        `E49-b: zamknięcia ${det.candidates}, sprawy ${det.upserts}, HERE ${det.hereCalls}, zamknięte stale ${det.closed}`,
      );
    }
  }
  return {
    job: 'route-hazards', mode: 'LIVE', ok: true, risks,
    warnings, observations: {
      loads: String(loads.length),
      thrMs: String(WIND_GUST_MS_THRESHOLD),
      windCases: String(windKeep.length),
      detourCases: String(detourUpserts),
      detourHere: String(detourHere),
    },
  };
}

/** E49-a cz.2: prognoza SMHI/FMI na punktach korytarza (co 25 km). */
export async function runCorridorWind(deps: JobDeps): Promise<JobResult> {
  const core = await runCorridorWindCore({
    store: deps.store,
    fetch: deps.fetch,
    now: deps.now(),
  });
  return {
    job: 'corridor-wind',
    mode: 'LIVE',
    ok: core.ok,
    reason: core.reason,
    warnings: core.warnings,
    observations: {
      corridors: String(core.corridors),
      points: String(core.points),
      fetched_ok: String(core.fetchedOk),
      smhi: String(core.sourceSmhi),
      fmi: String(core.sourceFmi),
    },
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
 * #837 — odczyt pozycji z linku sledz.monitorujpojazd.pl/share/<uuid>/.
 * Cron `tower-monitorujpojazd-poll` co 2 min. Job: `monitorujpojazd-poll`.
 * Token nigdy w logach (tylko 6 hex). Brak historii trasy w API — tylko bieżąca pozycja.
 */
export async function runMonitorujPojazdPoll(deps: JobDeps): Promise<JobResult> {
  const started = deps.now().getTime();
  const nowIso = new Date(started).toISOString();

  const enabled = deps.store.telmMonitorujPojazdPollEnabled
    ? await deps.store.telmMonitorujPojazdPollEnabled()
    : true;
  if (!enabled) {
    return {
      job: 'monitorujpojazd-poll', mode: 'LIVE', ok: true,
      disabled: true,
      reason: 'Flaga TELM_MONITORUJPOJAZD_POLL wyłączona — bez zapisu pozycji',
      observations: { flag: 'false', links: '0', disabled: 'true' },
    };
  }

  const lockToken = crypto.randomUUID();
  if (deps.store.monitorujpojazdPollLockTry) {
    const got = await deps.store.monitorujpojazdPollLockTry(90, lockToken);
    if (!got) {
      return {
        job: 'monitorujpojazd-poll', mode: 'LIVE', ok: true,
        reason: 'Nakładający się przebieg monitorujpojazd-poll — pominięto',
        observations: { links: '0', overlap: '1' },
      };
    }
  }

  try {
    const loads = deps.store.listMonitorujPojazdLoadsForPoll
      ? await deps.store.listMonitorujPojazdLoadsForPoll()
      : [];
    let queried = 0;
    let written = 0;
    let skippedWindow = 0;
    let skippedDup = 0;
    let invalid = 0;
    let down = 0;
    let noPosition = 0;
    const warnings: string[] = [];
    let risks = 0;

    for (const load of loads) {
      if (deps.now().getTime() - started > 40_000) break;

      const tip = load.monitorujpojazd_token.replace(/-/g, '').slice(-6);
      const matchRow = {
        id: load.id,
        trailer_plate: null as string | null,
        telematics_vehicle_id: load.telematics_vehicle_id ?? `mp:${tip}`,
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
      const safeUrl = monitorujpojazdUrlSafe(load.monitorujpojazd_token);
      const res = await fetchMonitorujPojazdPosition({
        token: load.monitorujpojazd_token,
        fetchImpl: deps.fetch,
        nowMs: started,
      });

      const apply = async (patch: MonitorujPojazdLoadPatch) => {
        if (!deps.store.updateMonitorujPojazdLoadState) return;
        await deps.store.updateMonitorujPojazdLoadState(load.id, patch);
        Object.assign(load, patch);
      };

      if (!res.ok) {
        const kind = res.kind;
        /* F7 #839: NOT_STARTED → pending, bez streak / sprawy (start przy załadunku). */
        if (kind === 'pending') {
          await apply({
            monitorujpojazd_check_state: 'pending',
            monitorujpojazd_check_at: nowIso,
          });
          warnings.push(scrubMonitorujPojazdToken(res.warning));
          continue;
        }
        const streak = (load.monitorujpojazd_error_streak ?? 0) + 1;
        if (kind === 'invalid') {
          invalid++;
          await apply({
            monitorujpojazd_check_state: 'invalid',
            monitorujpojazd_check_at: nowIso,
            monitorujpojazd_error_streak: streak,
          });
        } else if (kind === 'no_position') {
          noPosition++;
          down++;
          await apply({
            monitorujpojazd_check_state: 'down',
            monitorujpojazd_check_at: nowIso,
            monitorujpojazd_error_streak: streak,
          });
        } else {
          down++;
          await apply({
            monitorujpojazd_check_state: 'down',
            monitorujpojazd_check_at: nowIso,
            monitorujpojazd_error_streak: streak,
          });
        }
        warnings.push(scrubMonitorujPojazdToken(res.warning));
        if (streak >= 3) {
          if (await deps.store.raiseRisk({
            kind: 'RESOURCE_MISSING',
            severity: 'HIGH',
            title: 'Link śledzenia monitorujpojazd nie działa',
            titleKey: 'rk_monitorujpojazd_dead',
            params: {},
            detail: {
              zrodlo: 'MONITORUJPOJAZD', loadId: load.id, status: res.status,
              url: safeUrl, warning: scrubMonitorujPojazdToken(res.warning), streak,
            },
            dedup: `MONITORUJPOJAZD_DEAD:${load.id}`,
            sourceUrl: safeUrl,
            loadId: load.id,
          })) risks++;
        }
        continue;
      }

      const wasBad = load.monitorujpojazd_check_state === 'invalid'
        || load.monitorujpojazd_check_state === 'down';
      await apply({
        monitorujpojazd_check_state: 'ok',
        monitorujpojazd_check_at: nowIso,
        monitorujpojazd_last_fix_at: res.observedAt,
        monitorujpojazd_error_streak: 0,
      });
      if (wasBad) await deps.store.resolveRisks(`MONITORUJPOJAZD_DEAD:${load.id}`);

      const prevFix = deps.store.lastPositionFix
        ? await deps.store.lastPositionFix(load.id, 'MONITORUJPOJAZD')
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
          source: 'MONITORUJPOJAZD',
          speed: res.speedKmh,
          heading: res.heading,
          ignition: res.ignition,
          raw: {
            provider: 'MONITORUJPOJAZD',
            url: safeUrl,
            vehicleName: res.vehicleName,
          },
        });
        written++;
      }
      if (deps.store.inferPhaseFromPosition) {
        await deps.store.inferPhaseFromPosition(load.id, res.lat, res.lon, res.observedAt);
      }
    }

    const hadFault = invalid > 0 || down > 0;
    return {
      job: 'monitorujpojazd-poll',
      mode: 'LIVE',
      ok: !hadFault,
      risks,
      warnings: warnings.slice(0, 20),
      observations: {
        candidates: String(loads.length),
        links: String(loads.length),
        queried: String(queried),
        written: String(written),
        invalid: String(invalid),
        down: String(down),
        no_position: String(noPosition),
        skipped_window: String(skippedWindow),
        skipped_dup: String(skippedDup),
      },
    };
  } finally {
    if (deps.store.monitorujpojazdPollLockRelease) {
      await deps.store.monitorujpojazdPollLockRelease(lockToken);
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
  /* DP-204.5: rate_limit (DeepL 429) też w kolejce — bez oznaczania jako blad. */
  const rows = await store.translationListQueue(['blad', 'brak', 'limit', 'limit_przebiegu', 'rate_limit']);
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
  let runCalls = 0;
  for (const row of rows) {
    /* Nowy miesiąc = nowy wiersz deepl_usage (F7: bez !isFirstDay). */
    if (row.reason === 'limit' && usage.characters >= usage.limit) continue;
    const result = await translateFreeText({
      text: row.source,
      source: row.lang,
      used: usage.characters,
      limit: usage.limit || DEEPL_MONTHLY_LIMIT,
      runCalls,
      maxCallsPerRun: DEEPL_MAX_CALLS_PER_RUN,
      memoryGet: (hash) => store.translationGet!(hash),
      memoryPut: (hash, source, pl) => store.translationPut!(hash, source, pl, row.lang),
      enqueue: (hash, reason) => store.translationEnqueue!(hash, row.source, row.lang, reason),
      addUsage: async (n) => { usage = { ...usage, characters: await store.deeplAddUsage!(n) }; return usage.characters; },
      deepl: (text, source) => deeplTranslate(deps.fetch, key, text, source),
    });
    if (result.deeplCalls > 0) runCalls += result.deeplCalls;
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
  'road-se': runRoadSe, 'road-pl': runRoadPl, 'road-fi': runRoadFi, 'road-lt': runRoadLt,
  'road-lv': runRoadLv, 'road-ee': runRoadEe,
  'traffic-flow': runTrafficFlow,
  'here-roads': runHereRoads,
  'emtrack-web': runEmtrackWeb,
  'rio-links': runRioLinks,
  'safefleet-poll': runSafefleetPoll,
  'monitorujpojazd-poll': runMonitorujPojazdPoll,
  'route-hazards': runRouteHazards,
  'corridor-wind': runCorridorWind,
  'translate-retry': runTranslateRetry,
} as const;
export type JobName = keyof typeof JOBS;

/** Minimalny odstęp między przebiegami [min] — ferry-status: co 15 min, nie częściej (ZRODLA_DANYCH §1.1). */
export const MIN_INTERVAL_MIN: Record<JobName, number> = {
  'ferry-schedule': 60, 'ferry-status': 10, 'ferry-ais': 3, 'ferry-ais-listen': 0,
  'ferry-portnet': 15, 'ferry-weather': 60,
  // #667 F7 r2: 1380 min — dzienny cron (ran_at po zakończeniu) nie pomija kolejnego dnia.
  'road-se': 15, 'road-pl': 10, 'road-fi': 15, 'road-lt': 15, 'road-lv': 15, 'road-ee': 15,
  'traffic-flow': 15, 'here-roads': 1380,
  'emtrack-web': 2, 'rio-links': 2,
  // DP-223 (#816): cron `17,47 * * * *` — limit 30 min (było 60 → :47 skipped).
  'safefleet-poll': 2, 'monitorujpojazd-poll': 2, 'route-hazards': 30,
  'corridor-wind': 60,
  'translate-retry': 5,
};

/** Przebieg zadania z kontrolą częstotliwości i zapisem do dziennika (integration_runs). */
export async function runJob(name: JobName, deps: JobDeps): Promise<JobResult & { skipped?: boolean }> {
  const last = await deps.store.lastRun(name);
  const gapMin = last ? (deps.now().getTime() - Date.parse(last)) / 60000 : Infinity;
  // 1 min luzu na niedokładność harmonogramu pg_cron
  if (gapMin < MIN_INTERVAL_MIN[name] - 1) {
    const gapRounded = Math.round(gapMin * 10) / 10;
    // F7 #765 A: bez zapisu do integration_runs — wiersz skipped z ok=true psuje serie
    // SOURCE_DOWN (roadFi/Lt/Lv/Ee, Tallink) i panele stanu (zielone przy awarii).
    console.info(JSON.stringify({ job: name, skipped: true, skipped_gap_min: gapRounded }));
    return {
      job: name,
      mode: 'LIVE',
      ok: true,
      skipped: true,
      reason: `Poprzedni odczyt ${Math.round(gapMin)} min temu — limit co ${MIN_INTERVAL_MIN[name]} min`,
      observations: { skipped_gap_min: String(gapRounded) },
    };
  }
  const startedAt = deps.now().toISOString();
  let res: JobResult;
  try { res = await JOBS[name](deps); } catch (e) {
    res = { job: name, mode: 'LIVE', ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
  res = { ...res, started_at: startedAt };
  await deps.store.recordRun(name, res.ok, res);
  return res;
}
