/**
 * M12 — zadania integracji (jedno na funkcję Edge). Wejście: magazyn (`SyncStore`), pobieranie (`fetch`),
 * sekrety (`env`) i czas — dzięki temu każde zadanie ma test jednostkowy na zapisanych danych, bez sieci.
 * Funkcje Edge (`supabase/functions/<nazwa>/index.ts`) podają prawdziwy magazyn (service role) i fetch.
 */
import {
  POLFERRIES_SCHEDULE_URL, POLFERRIES_STATUS_URL, parsePolferriesSchedule, parsePolferriesStatus,
} from '../ferry/polferries.ts';
import { DIGITRAFFIC_ATTRIBUTION, interpretFix, parseDigitrafficLocations } from '../ferry/digitraffic.ts';
import {
  flowRisk, integrationMode, parseDatexSituations, parseTomTomFlow, parseTrafikverketSituations, roadRisk,
  tomtomFlowUrl, trafikverketSituationQuery, TRAFIKVERKET_URL,
} from './road.ts';
import {
  isSourceFailure, planSailingSync, sourceDownRisk, unknownStatusRisk,
  type DbSailing, type IncomingSailing, type RiskInput, type SailingInsert, type SailingPatch, type VesselRow,
} from './sync.ts';

/** Wyłącznie ASCII (nagłówek HTTP) — test pilnuje. */
export const USER_AGENT = 'TOWER-WatchTower/1.0 (+https://log-mar.pl; H&H Logistics; read max every 15 min)';
export const DIGITRAFFIC_USER = 'TOWER-WatchTower/HHL';

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
  recordRun(job: string, ok: boolean, result: JobResult): Promise<void>;
}
export interface JobDeps {
  store: SyncStore;
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now: () => Date;
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

async function applySailings(deps: JobDeps, incoming: IncomingSailing[], sinceIso: string) {
  const { store } = deps;
  const [projectId, vessels, existing] = await Promise.all([store.projectId(), store.vessels(), store.sailingsSince(sinceIso)]);
  const plan = planSailingSync({ existing, vessels, incoming, projectId, sinceUtc: sinceIso });
  if (plan.inserts.length) await store.insertSailings(plan.inserts);
  let updated = 0; let raced = 0;
  for (const u of plan.updates) { if (await store.updateSailing(u.id, u.patch)) updated++; else raced++; }
  return { plan, updated, manualKept: plan.manualKept + raced };
}

/** ferry-schedule — rozkład cargo → sailings (raz w tygodniu + ręcznie HHL). */
export async function runFerrySchedule(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const page = await readText(deps, POLFERRIES_SCHEDULE_URL, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } });
  const parsed = page.ok ? parsePolferriesSchedule(page.text) : { sailings: [], warnings: [page.warning] };
  if (isSourceFailure({ warnings: parsed.warnings, count: parsed.sailings.length })) {
    await deps.store.raiseRisk(sourceDownRisk('POLFERRIES_SCHEDULE', parsed.warnings, now, POLFERRIES_SCHEDULE_URL));
    return { job: 'ferry-schedule', mode: 'LIVE', ok: false, risks: 1, warnings: parsed.warnings };
  }
  const since = new Date(Date.parse(now) - 864e5).toISOString();
  const incoming: IncomingSailing[] = parsed.sailings.map((s) => ({ route: s.route, vessel: s.vessel, departureUtc: s.departureUtc, arrivalUtc: s.arrivalUtc }));
  const { plan, updated, manualKept } = await applySailings(deps, incoming, since);
  await deps.store.resolveRisks('SOURCE_DOWN:POLFERRIES_SCHEDULE:');
  return {
    job: 'ferry-schedule', mode: 'LIVE', ok: true, inserted: plan.inserts.length, updated, manualKept, unchanged: plan.unchanged,
    risks: 0, warnings: [...parsed.warnings, ...plan.unknownVessels.map((v) => `Statek spoza rejestru: ${v}`)],
  };
}

/** ferry-status — komunikaty armatora (co 15 min, nie częściej): opóźnienie, odwołanie, NIEZNANY. */
export async function runFerryStatus(deps: JobDeps): Promise<JobResult> {
  const now = deps.now().toISOString();
  const page = await readText(deps, POLFERRIES_STATUS_URL, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } });
  const parsed = page.ok ? parsePolferriesStatus(page.text) : { sailings: [], warnings: [page.warning] };
  if (isSourceFailure({ warnings: parsed.warnings, count: parsed.sailings.length })) {
    await deps.store.raiseRisk(sourceDownRisk('POLFERRIES_STATUS', parsed.warnings, now, POLFERRIES_STATUS_URL));
    return { job: 'ferry-status', mode: 'LIVE', ok: false, risks: 1, warnings: parsed.warnings };
  }
  const since = new Date(Date.parse(now) - 864e5).toISOString();
  const incoming: IncomingSailing[] = parsed.sailings.map((s) => ({
    route: s.route, vessel: s.vessel, departureUtc: s.plannedDepartureUtc, arrivalUtc: s.plannedArrivalUtc,
    status: s.status, expectedDepartureUtc: s.expectedDepartureUtc, expectedArrivalUtc: s.expectedArrivalUtc,
  }));
  const { plan, updated, manualKept } = await applySailings(deps, incoming, since);
  await deps.store.resolveRisks('SOURCE_DOWN:POLFERRIES_STATUS:');
  let risks = 0;
  for (const u of plan.unknown) {
    const raw = parsed.sailings.find((p) => p.vessel === u.vessel && p.plannedDepartureUtc === u.departureUtc);
    if (await deps.store.raiseRisk(unknownStatusRisk(u, `${raw?.rawStatusClass ?? ''} / ${raw?.rawBadge ?? ''}`))) risks++;
  }
  return {
    job: 'ferry-status', mode: 'LIVE', ok: true, inserted: plan.inserts.length, updated, manualKept,
    unchanged: plan.unchanged, unknown: plan.unknown.length, risks, warnings: parsed.warnings,
  };
}

/** ferry-ais — Digitraffic dla statków z rejsem w toku (co 10 min). Potwierdza wyłącznie stronę szwedzką. */
export async function runFerryAis(deps: JobDeps): Promise<JobResult> {
  const nowD = deps.now(); const now = nowD.toISOString();
  const [vessels, sailings] = await Promise.all([deps.store.vessels(), deps.store.sailingsSince(new Date(nowD.getTime() - 2 * 864e5).toISOString())]);
  const eff = (s: DbSailing) => ({ dep: Date.parse(s.delayed_departure_at ?? s.departure_at), arr: Date.parse(s.delayed_arrival_at ?? s.arrival_at) });
  const inProgress = sailings.filter((s) => s.status !== 'ODWOLANY' && eff(s).dep <= nowD.getTime() && nowD.getTime() <= eff(s).arr + 3 * 36e5);
  const observations: Record<string, string> = {};
  const warnings: string[] = [];
  let risks = 0;
  for (const s of inProgress) {
    const v = vessels.find((x) => x.id === s.vessel_id);
    if (!v) continue;
    if (!v.mmsi) { observations[v.name] = 'BRAK_MMSI'; continue; }
    const r = await readText(deps, `https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${v.mmsi}`, { headers: { 'Accept-Encoding': 'gzip', 'Digitraffic-User': DIGITRAFFIC_USER } });
    if (!r.ok) { warnings.push(r.warning); continue; }
    let fix = null;
    try { fix = parseDigitrafficLocations(JSON.parse(r.text), v.mmsi); } catch { warnings.push('Digitraffic: nieczytelna odpowiedź (zmiana formatu?)'); continue; }
    if (!fix) { observations[v.name] = 'BRAK_SWIEZEGO_SYGNALU'; continue; }
    const obs = interpretFix(fix, now);
    observations[v.name] = obs;
    if (obs === 'W_PORCIE_NYNASHAMN' && s.route === 'GDN-NYN') {
      const ok = await deps.store.raiseRisk({
        kind: 'FERRY', severity: 'INFO', title: `AIS: ${v.name} w porcie Nynäshamn — potwierdzenie przypłynięcia (informacja)`,
        detail: { sailing_id: s.id, statek: v.name, pozycja: [fix.lat, fix.lon], sygnal: fix.timestampUtc, atrybucja: DIGITRAFFIC_ATTRIBUTION },
        dedup: `AIS_NYN:${s.id}`, sourceUrl: 'https://www.digitraffic.fi/en/marine-traffic/',
      });
      if (ok) risks++;
    }
  }
  if (warnings.length && inProgress.some((s) => vessels.find((x) => x.id === s.vessel_id)?.mmsi)) {
    await deps.store.raiseRisk(sourceDownRisk('DIGITRAFFIC', warnings, now, 'https://meri.digitraffic.fi'));
    risks++;
  }
  return { job: 'ferry-ais', mode: 'LIVE', ok: warnings.length === 0, risks, warnings, observations };
}

/** road-se — Trafikverket Situation wzdłuż E4 (co 10 min). Bez klucza: tryb DEMO, bez pobierania. */
export async function runRoadSe(deps: JobDeps): Promise<JobResult> {
  const m = integrationMode(deps.env, 'TRAFIKVERKET_API_KEY');
  if (m.mode === 'DEMO') return { job: 'road-se', mode: 'DEMO', ok: true, reason: m.reason };
  const now = deps.now().toISOString();
  const r = await readText(deps, TRAFIKVERKET_URL, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: trafikverketSituationQuery(deps.env.TRAFIKVERKET_API_KEY!) });
  let events: ReturnType<typeof parseTrafikverketSituations> = [];
  let warn: string | null = r.ok ? null : r.warning;
  if (r.ok) { try { events = parseTrafikverketSituations(JSON.parse(r.text)); } catch { warn = 'Trafikverket: nieczytelna odpowiedź'; } }
  if (warn) { await deps.store.raiseRisk(sourceDownRisk('TRAFIKVERKET', [warn], now, TRAFIKVERKET_URL)); return { job: 'road-se', mode: 'LIVE', ok: false, risks: 1, warnings: [warn] }; }
  await deps.store.resolveRisks('SOURCE_DOWN:TRAFIKVERKET:');
  let risks = 0;
  for (const e of events) if (await deps.store.raiseRisk(roadRisk('SE', e, 'https://www.trafikverket.se/trafikinformation/'))) risks++;
  return { job: 'road-se', mode: 'LIVE', ok: true, risks, warnings: [] };
}

/** road-pl — KPD GDDKiA DATEX II (wg warunków KPD). Wymaga KPD_DATEX_URL (+ certyfikat klienta po stronie proxy). */
export async function runRoadPl(deps: JobDeps): Promise<JobResult> {
  const m = integrationMode(deps.env, 'KPD_DATEX_URL');
  if (m.mode === 'DEMO') return { job: 'road-pl', mode: 'DEMO', ok: true, reason: `${m.reason}; KPD wymaga rejestracji i certyfikatu klienta` };
  const now = deps.now().toISOString();
  const url = deps.env.KPD_DATEX_URL!;
  const headers: Record<string, string> = { Accept: 'application/xml' };
  if (deps.env.KPD_AUTH_HEADER) headers.Authorization = deps.env.KPD_AUTH_HEADER;
  const r = await readText(deps, url, { headers });
  if (!r.ok || !/situationRecord|d2LogicalModel|payload/i.test(r.text)) {
    const w = r.ok ? 'KPD: odpowiedź bez rekordów DATEX II (zmiana formatu?)' : r.warning;
    await deps.store.raiseRisk(sourceDownRisk('KPD_GDDKIA', [w], now, url));
    return { job: 'road-pl', mode: 'LIVE', ok: false, risks: 1, warnings: [w] };
  }
  await deps.store.resolveRisks('SOURCE_DOWN:KPD_GDDKIA:');
  let risks = 0;
  for (const e of parseDatexSituations(r.text)) if (await deps.store.raiseRisk(roadRisk('PL', e, 'https://kpd.gddkia.gov.pl'))) risks++;
  return { job: 'road-pl', mode: 'LIVE', ok: true, risks, warnings: [] };
}

/** traffic-flow — TomTom przy aktywnych autach (co 15 min na auto; budżet 2 500/dzień). */
export async function runTrafficFlow(deps: JobDeps): Promise<JobResult> {
  const m = integrationMode(deps.env, 'TOMTOM_API_KEY');
  if (m.mode === 'DEMO') return { job: 'traffic-flow', mode: 'DEMO', ok: true, reason: m.reason };
  const now = deps.now().toISOString();
  const cars = (await deps.store.latestPositions(30)).slice(0, 25);
  const warnings: string[] = [];
  let risks = 0;
  for (const c of cars) {
    const r = await readText(deps, tomtomFlowUrl(c.lat, c.lon, deps.env.TOMTOM_API_KEY!));
    if (!r.ok) { warnings.push(r.warning.replace(/key=[^&\s]+/, 'key=***')); continue; }
    let reading = null;
    try { reading = parseTomTomFlow(JSON.parse(r.text)); } catch { /* nieczytelna odpowiedź */ }
    if (!reading) { warnings.push(`TomTom: brak odcinka przy ${c.code}`); continue; }
    const risk = flowRisk(c.load_id, c.code, c.lat, c.lon, reading, now);
    if (risk && (await deps.store.raiseRisk(risk))) risks++;
  }
  if (cars.length && warnings.length === cars.length) {
    await deps.store.raiseRisk(sourceDownRisk('TOMTOM', warnings, now, 'https://developer.tomtom.com'));
    risks++;
  }
  return { job: 'traffic-flow', mode: 'LIVE', ok: warnings.length < cars.length || cars.length === 0, risks, warnings };
}

export const JOBS = {
  'ferry-schedule': runFerrySchedule, 'ferry-status': runFerryStatus, 'ferry-ais': runFerryAis,
  'road-se': runRoadSe, 'road-pl': runRoadPl, 'traffic-flow': runTrafficFlow,
} as const;
export type JobName = keyof typeof JOBS;

/** Minimalny odstęp między przebiegami [min] — ferry-status: co 15 min, nie częściej (ZRODLA_DANYCH §1.1). */
export const MIN_INTERVAL_MIN: Record<JobName, number> = {
  'ferry-schedule': 60, 'ferry-status': 15, 'ferry-ais': 10, 'road-se': 10, 'road-pl': 10, 'traffic-flow': 15,
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
