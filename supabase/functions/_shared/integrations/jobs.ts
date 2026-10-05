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
import { DIGITRAFFIC_ATTRIBUTION, interpretFix, parseDigitrafficLocations, aisDepartureDelayMin, type VesselFix } from '../ferry/digitraffic.ts';
import { collectAisstreamFixes, type AisstreamStats } from '../ferry/aisstream.ts';
import {
  STENA_FERRIES_URL, STENA_IMO, STENA_MMSI, isTrackedMmsi, parseStenaFerries, pickNewerFix,
} from '../ferry/stenaAis.ts';
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
import { matchFixToLoad } from '../telematics/matchTrailer.ts';
import { unknownCodeRiskInput } from '../../../../src/lib/pl/describe.ts';
import { deeplTranslate, translateFreeText, usageLevel, DEEPL_MONTHLY_LIMIT } from '../../../../src/lib/pl/deepl.ts';
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
  listActiveLoadsForTelematics?(): Promise<{ id: string; trailer_plate: string | null; telematics_vehicle_id: string | null; status: string | null }[]>;
  /** TELM: zapis pozycji (process_position). */
  processPosition?(row: {
    loadId: string; lat: number; lon: number; ts: string;
    source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK';
    speed?: number | null; heading?: number | null; ignition?: boolean | null; raw?: unknown;
  }): Promise<void>;
  lastPositionAt?(loadId: string, source: string): Promise<string | null>;
  telmEmtrackWebEnabled?(): Promise<boolean>;
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
}
export interface JobResult {
  job: string; mode: 'LIVE' | 'DEMO'; ok: boolean; reason?: string;
  inserted?: number; updated?: number; manualKept?: number; unchanged?: number; unknown?: number; risks?: number;
  warnings?: string[]; observations?: Record<string, string>;
}

async function readText(deps: JobDeps, url: string, init?: RequestInit): Promise<{ ok: true; text: string } | { ok: false; warning: string }> {
  try {
    const res = await deps.fetch(url, init);
    if (!res.ok) return { ok: false, warning: `HTTP ${res.status} ${url}` };
    return { ok: true, text: await res.text() };
  } catch (e) {
    return { ok: false, warning: `Błąd sieci ${url}: ${e instanceof Error ? e.message : String(e)}` };
  }
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

/** Pobiera JSON rozkładu Stena na kilka dni × 2 trasy. */
async function fetchStenaDays(deps: JobDeps, days: number): Promise<{
  sailings: StenaSailing[]; warnings: string[]; http403: boolean; fetchedOk: number;
}> {
  const warnings: string[] = [];
  const sailings: StenaSailing[] = [];
  let http403 = false;
  let fetchedOk = 0;
  const dates = dateRangeYmd(deps.now(), days);
  for (const routeCode of ['GDKA', 'KAGD'] as const) {
    for (const date of dates) {
      const url = stenaTimetableUrl(routeCode, date);
      const page = await readText(deps, url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!page.ok) {
        warnings.push(page.warning);
        if (/HTTP 403/.test(page.warning)) http403 = true;
        continue;
      }
      fetchedOk += 1;
      let json: unknown;
      try { json = JSON.parse(page.text); } catch {
        warnings.push(`Stena ${routeCode} ${date}: nieczytelny JSON`);
        continue;
      }
      const parsed = parseStenaTimetable(json, { routeCode, dateYmd: date });
      // pusty dzień (HTTP 200 + []) — OK, bez ostrzeżenia o awarii
      sailings.push(...parsed.sailings);
      for (const w of parsed.warnings) {
        if (/brak rejsów na/i.test(w)) continue;
        warnings.push(w);
      }
    }
  }
  return { sailings, warnings, http403, fetchedOk };
}

/** ferry-schedule — rozkład cargo Polferries + rozkład Stena (JSON AEM). */
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

  const stena = await fetchStenaDays(deps, 14);
  warnings.push(...stena.warnings);
  const stFail = stena.http403 || stena.fetchedOk === 0
    || stena.warnings.some((w) => /Struktura|HTTP|nieczytelny JSON/i.test(w));
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

  return {
    job: 'ferry-schedule', mode: 'LIVE', ok: !(pfFail && stFail),
    inserted, updated, manualKept, unchanged, risks, warnings,
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

  return {
    job: 'ferry-status', mode: 'LIVE', ok: !(pfFail && stFail),
    inserted, updated, manualKept, unchanged, unknown, risks, warnings,
  };
}

/** ferry-ais — AIS-SRC. Stena IRM (3 statki, co 3 min), aisstream (5 MMSI), Digitraffic jako zapas.
 *  Nowsza pozycja wygrywa, źródło jest zapisane. Q-18 (kierunek) nie filtruje zapisu.
 *  II-9 i ETA biorą pełne dane, także gdy prom byłby niewidoczny na mapie. */
let stenaIrmCache: { at: number; text: string } | null = null;
export function resetStenaIrmCache(): void { stenaIrmCache = null; }

async function readStenaIrm(deps: JobDeps, nowMs: number): Promise<{ fixes: VesselFix[]; warning: string | null }> {
  if (stenaIrmCache && nowMs - stenaIrmCache.at < 3 * 60_000) {
    return parseStenaFerries(JSON.parse(stenaIrmCache.text));
  }
  const r = await readText(deps, STENA_FERRIES_URL, { headers: { 'User-Agent': STENA_IRM_UA, Accept: 'application/json' } });
  if (!r.ok) return { fixes: [], warning: r.warning };
  try {
    const parsed = parseStenaFerries(JSON.parse(r.text));
    if (!parsed.warning) stenaIrmCache = { at: nowMs, text: r.text };
    return parsed;
  } catch {
    return { fixes: [], warning: 'Stena IRM: nieczytelna odpowiedź (zmiana formatu?)' };
  }
}

export async function runFerryAis(deps: JobDeps): Promise<JobResult> {
  const nowD = deps.now(); const now = nowD.toISOString();
  const [vessels, sailings] = await Promise.all([deps.store.vessels(), deps.store.sailingsSince(new Date(nowD.getTime() - 2 * 864e5).toISOString())]);
  const tracked = vessels.filter((v) => isTrackedMmsi(v.mmsi) || (v.imo != null && STENA_IMO.has(v.imo)));
  const eff = (s: DbSailing) => ({ dep: Date.parse(s.delayed_departure_at ?? s.departure_at), arr: Date.parse(s.delayed_arrival_at ?? s.arrival_at) });
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
      await deps.store.raiseRisk(sourceDownRisk('STENA_IRM', [stena.warning], now, STENA_FERRIES_URL));
      risks++;
    } else {
      await deps.store.resolveRisks('SOURCE_DOWN:STENA_IRM:');
    }
    for (const fix of stena.fixes) {
      const v = tracked.find((x) => (fix.imo != null && x.imo === fix.imo) || x.mmsi === fix.mmsi);
      if (v) pushFix(v.id, fix);
    }
  }

  // AIS-POLF (05.10): WebSocket słucha osobna funkcja ferry-ais-listen (co minutę, ~50 s).
  // Tu tylko jej ostatnie pozycje z bazy (≤ 10 min) — porównanie „nowsza wygrywa” i ryzyka mają pełny obraz.
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
        if (tracked.some((v) => v.id === r.vesselId)) pushFix(r.vesselId, { ...r.fix, source: 'AISSTREAM' });
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
    const stenaEta = list.find((f) => f.source === 'STENA' && f.etaAt)?.etaAt ?? null;
    const win = pickNewerFix(list);
    if (!win) continue;
    const fix = stenaEta && !win.etaAt ? { ...win, etaAt: stenaEta } : win;
    chosen.set(v.id, fix);
    await deps.store.saveVesselPosition(v.id, fix);
  }

  for (const s of inProgress) {
    const v = vessels.find((x) => x.id === s.vessel_id);
    if (!v) continue;
    if (!v.mmsi && !(v.imo != null && STENA_IMO.has(v.imo))) { observations[v.name] = 'BRAK_MMSI'; continue; }
    const fix = chosen.get(v.id);
    if (!fix) { observations[v.name] = 'BRAK_SWIEZEGO_SYGNALU'; continue; }
    const port = (s.route === 'GDY-KAA' || s.route === 'KAA-GDY') ? 'KAA' : 'NYN';
    const obs = interpretFix(fix, now, 60, port);
    observations[v.name] = obs;
    if (obs === 'W_PORCIE_NYNASHAMN' && s.route === 'GDN-NYN') {
      const ok = await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'INFO', title: `AIS: ${v.name} w porcie Nynäshamn — potwierdzenie przypłynięcia (informacja)`,
        titleKey: 'rk_ais_arrived', params: { vessel: v.name },
        detail: { sailing_id: s.id, statek: v.name, pozycja: [fix.lat, fix.lon], sygnal: fix.timestampUtc, zrodlo: fix.source ?? 'DIGITRAFFIC', atrybucja: DIGITRAFFIC_ATTRIBUTION },
        dedup: `AIS_NYN:${s.id}`, sourceUrl: 'https://www.digitraffic.fi/en/marine-traffic/',
      });
      if (ok) risks++;
    }
    if (obs === 'W_PORCIE_KARLSKRONA' && (s.route === 'GDY-KAA' || s.route === 'KAA-GDY')) {
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
    const delayMin = aisDepartureDelayMin(fix, now, s.delayed_departure_at ?? s.departure_at, s.route);
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

  const latest = deps.store.latestVesselObserved ? await deps.store.latestVesselObserved() : [];
  const latestById = new Map(latest.map((r) => [r.vesselId, r.observedAt]));
  for (const v of tracked) {
    if (!v.mmsi) continue;
    const saved = chosen.get(v.id);
    const cands = [saved?.timestampUtc, latestById.get(v.id)].filter((x): x is string => !!x && Number.isFinite(Date.parse(x)));
    const obsAt = cands.length ? cands.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null;
    const ageMin = obsAt ? (nowD.getTime() - Date.parse(obsAt)) / 60000 : Infinity;
    if (ageMin > 60) {
      const ok = await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'MEDIUM',
        title: `Brak pozycji AIS: ${v.name} — ostatni sygnał starszy niż godzina`,
        titleKey: 'rk_ais_gap', params: { vessel: v.name },
        detail: { statek: v.name, mmsi: v.mmsi, ostatni: obsAt, zrodlo: 'AIS-SRC' },
        dedup: `AIS_GAP:${v.mmsi}:${now.slice(0, 10)}`,
      });
      if (ok) risks++;
    } else {
      await deps.store.resolveRisks(`AIS_GAP:${v.mmsi}:`);
    }
  }
  return { job: 'ferry-ais', mode: 'LIVE', ok: true, risks, warnings, observations };
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
export async function runEmtrackWeb(deps: JobDeps): Promise<JobResult> {
  const login = deps.env.EMTRACK_LOGIN?.trim();
  const password = deps.env.EMTRACK_PASSWORD?.trim();
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

  let version = '';
  const verRes = await readText(deps, 'https://emtrack.eu/app/', { headers: { 'User-Agent': EMTRACK_UA } });
  if (verRes.ok) {
    const m = verRes.text.match(/<meta\s+name=["']version["']\s+content=["']([^"']+)["']/i);
    version = m?.[1] ?? '';
  }
  const expected = deps.env.EMTRACK_EXPECTED_VERSION?.trim() || EMTRACK_EXPECTED_VERSION;
  if (version && version !== expected) {
    await deps.store.raiseRisk(sourceDownRisk(
      'EMTRACK_WEB',
      [`meta version ${version} ≠ oczekiwane ${expected}`],
      deps.now().toISOString(),
      'https://emtrack.eu/app/',
    ));
  }

  let objects: Awaited<ReturnType<typeof fetchTrackingObjectsReadOnly>>['objects'] = [];
  let sentLog: Awaited<ReturnType<typeof fetchTrackingObjectsReadOnly>>['sentLog'] = [];
  let loginOk = false;
  try {
    const r = await fetchTrackingObjectsReadOnly({
      login,
      password,
      auth: (deps.env.EMTRACK_AUTH_TYPE as 'INTERNAL' | 'DIRECT' | undefined) ?? 'INTERNAL',
      WebSocketImpl: (deps as JobDeps & { WebSocketImpl?: typeof WebSocket }).WebSocketImpl,
    });
    objects = r.objects;
    sentLog = r.sentLog;
    loginOk = r.loginOk;
  } catch (e) {
    const w = e instanceof Error ? e.message : String(e);
    await deps.store.raiseRisk(sourceDownRisk('EMTRACK_WEB', [w], deps.now().toISOString(), 'https://emtrack.eu/app/'));
    return {
      job: 'emtrack-web', mode: 'LIVE', ok: false, risks: 1, warnings: [w],
      observations: { sentTypes: sentLog.map((s) => s.type).join(',') },
    };
  }
  if (!loginOk) {
    await deps.store.raiseRisk(sourceDownRisk('EMTRACK_WEB', ['login_failed'], deps.now().toISOString(), 'https://emtrack.eu/app/'));
    return {
      job: 'emtrack-web', mode: 'LIVE', ok: false, risks: 1, warnings: ['login_failed'],
      observations: { sentTypes: sentLog.map((s) => s.type).join(',') },
    };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:EMTRACK_WEB:');

  const loads = deps.store.listActiveLoadsForTelematics ? await deps.store.listActiveLoadsForTelematics() : [];
  const moveSec = Number(deps.env.TELM_WEB_MOVE_SEC ?? 120);
  const stopSec = Number(deps.env.TELM_WEB_STOP_SEC ?? 900);
  let written = 0;
  let matched = 0;
  let skippedInterval = 0;
  const trailers = objects.filter((o) => String(o.type).toUpperCase() === 'TRAILER');
  for (const fix of trailers) {
    if (fix.lat == null || fix.lon == null || !fix.observedAt) continue;
    const load = matchFixToLoad(fix, loads);
    if (!load) continue;
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
        raw: {
          provider: 'EMTRACK_WEB',
          trackingObjectId: fix.trackingObjectId,
          textId: fix.textId,
          name: fix.name,
          type: fix.type,
          sentFrameTypes: sentLog.map((s) => s.type),
        },
      });
      written++;
    }
  }

  return {
    job: 'emtrack-web', mode: 'LIVE', ok: true,
    observations: {
      version,
      objects: String(objects.length),
      trailers: String(trailers.length),
      matched: String(matched),
      written: String(written),
      skippedInterval: String(skippedInterval),
      sentTypes: sentLog.map((s) => s.type).join(','),
    },
  };
}

export const JOBS = {
  'ferry-schedule': runFerrySchedule, 'ferry-status': runFerryStatus, 'ferry-ais': runFerryAis,
  'ferry-ais-listen': runFerryAisListen,
  'ferry-weather': runFerryWeather,
  'road-se': runRoadSe, 'road-pl': runRoadPl, 'traffic-flow': runTrafficFlow,
  'emtrack-web': runEmtrackWeb,
} as const;
export type JobName = keyof typeof JOBS;

/** Minimalny odstęp między przebiegami [min] — ferry-status: co 15 min, nie częściej (ZRODLA_DANYCH §1.1). */
export const MIN_INTERVAL_MIN: Record<JobName, number> = {
  'ferry-schedule': 60, 'ferry-status': 10, 'ferry-ais': 3, 'ferry-ais-listen': 0, 'ferry-weather': 60,
  'road-se': 15, 'road-pl': 10, 'traffic-flow': 15, 'emtrack-web': 2,
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
