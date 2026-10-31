/**
 * M12 — rdzeń integracji danych zewnętrznych (ZRODLA_DANYCH.md). Czyste funkcje — wspólne dla
 * funkcji Edge (Deno) i testów (vitest, bez sieci). Zasady (ZLECENIE_FINAL AN2 · M12):
 *  - pierwszeństwo źródeł rejsu: RECZNIE > armatorzy (POLFERRIES/STENA/TALLINK/…) > DANE_STARTOWE — zmiany ręcznej HHL odczyt nie nadpisuje
 *  - status NIEZNANY → bez zmiany rejsu, ryzyko dla HHL
 *  - awaria źródła albo zmiana struktury strony → ryzyko „źródło niedostępne”, nigdy cicha pustka
 *  - ryzyka drogowe w rodzajach ROAD_SE / ROAD_PL
 */
import type { FerryRoute, FerryStatus } from '../ferry/polferries.ts';

export type SailingSource =
  | 'DANE_STARTOWE' | 'RECZNIE'
  | 'POLFERRIES' | 'STENA'
  | 'TALLINK' | 'VIKING' | 'ECKERO' | 'DFDS';
export type AutoSailingSource =
  | 'POLFERRIES' | 'STENA'
  | 'TALLINK' | 'VIKING' | 'ECKERO' | 'DFDS';
export type DbSailingStatus = 'ZAPLANOWANY' | 'OPOZNIONY' | 'ODWOLANY' | 'W_REJSIE' | 'DOPLYNAL';
export const SOURCE_RANK: Record<SailingSource, number> = {
  DANE_STARTOWE: 1,
  POLFERRIES: 2, STENA: 2, TALLINK: 2, VIKING: 2, ECKERO: 2, DFDS: 2,
  RECZNIE: 3,
};

export interface VesselRow { id: string; name: string; mmsi: number | null; imo?: number | null }
export interface DbSailing {
  id: string; vessel_id: string; route: FerryRoute; departure_at: string; arrival_at: string;
  delayed_departure_at: string | null; delayed_arrival_at: string | null;
  /** #421 F7: rzeczywiste wypłynięcie/dopłynięcie z AIS — ferry-status nie nadpisuje. */
  actual_departure_at?: string | null; actual_arrival_at?: string | null;
  status: DbSailingStatus; source: SailingSource;
}
export interface IncomingSailing {
  route: FerryRoute; vessel: string; departureUtc: string; arrivalUtc: string;
  /** tylko odczyt komunikatów (ferry-status); rozkład (ferry-schedule) nie zmienia statusu */
  status?: FerryStatus; expectedDepartureUtc?: string; expectedArrivalUtc?: string;
}
export type SailingPatch = Partial<Pick<DbSailing, 'vessel_id' | 'arrival_at' | 'delayed_departure_at' | 'delayed_arrival_at' | 'actual_departure_at' | 'actual_arrival_at' | 'status' | 'source'>>;
export interface SailingInsert {
  project_id: string; vessel_id: string; route: FerryRoute; departure_at: string; arrival_at: string;
  delayed_departure_at: string | null; delayed_arrival_at: string | null; status: DbSailingStatus; source: AutoSailingSource;
}
export type RiskKind = 'FERRY' | 'ROAD_SE' | 'ROAD_PL' | 'WEATHER' | 'JOB_FAILURE' | 'SILENT_VEHICLE' | 'RESOURCE_MISSING';
export type RiskSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface RiskInput {
  kind: RiskKind; severity: RiskSeverity; title: string; detail: Record<string, unknown>;
  /** A6-T1 — klucz słownika PL/EN/SV (src/i18n/risks.ts) i parametry; title zostaje po polsku dla dziennika. */
  titleKey: string; params: Record<string, string | number>;
  dedup: string; sourceUrl?: string | null; validUntil?: string | null;
}

const iso = (s: string | null | undefined) => (s ? new Date(s).toISOString() : null);
const key = (route: string, depIso: string) => `${route}|${new Date(depIso).toISOString()}`;

export interface SyncPlan {
  inserts: SailingInsert[];
  updates: { id: string; patch: SailingPatch }[];
  manualKept: number;
  unchanged: number;
  unknown: IncomingSailing[];
  unknownVessels: string[];
}

/**
 * Plan zapisu rejsów z odczytu. Dopasowanie po trasie i planowej godzinie odejścia (ten sam statek
 * albo wiersz DANE_STARTOWE — wtedy poprawiany także statek). Rejsy starsze niż `sinceUtc` pomijane.
 */
export function planSailingSync(o: {
  existing: DbSailing[]; vessels: VesselRow[]; incoming: IncomingSailing[]; projectId: string; sinceUtc?: string;
  source?: AutoSailingSource;
}): SyncPlan {
  const src: AutoSailingSource = o.source ?? 'POLFERRIES';
  const plan: SyncPlan = { inserts: [], updates: [], manualKept: 0, unchanged: 0, unknown: [], unknownVessels: [] };
  const byName = new Map(o.vessels.map((v) => [v.name, v.id]));
  const byKey = new Map<string, DbSailing[]>();
  for (const s of o.existing) { const k = key(s.route, s.departure_at); byKey.set(k, [...(byKey.get(k) ?? []), s]); }
  const since = o.sinceUtc ? Date.parse(o.sinceUtc) : -Infinity;
  for (const inc of o.incoming) {
    if (Date.parse(inc.departureUtc) < since) continue;
    const vesselId = byName.get(inc.vessel);
    if (!vesselId) { if (!plan.unknownVessels.includes(inc.vessel)) plan.unknownVessels.push(inc.vessel); continue; }
    if (inc.status === 'NIEZNANY') { plan.unknown.push(inc); continue; }
    const cands = byKey.get(key(inc.route, inc.departureUtc)) ?? [];
    const cur = cands.find((s) => s.vessel_id === vesselId) ?? cands.find((s) => s.source === 'DANE_STARTOWE');
    const status: DbSailingStatus = inc.status === 'ODWOLANY' ? 'ODWOLANY' : inc.status === 'OPOZNIONY' ? 'OPOZNIONY' : 'ZAPLANOWANY';
    const expDep = iso(inc.expectedDepartureUtc ?? inc.departureUtc);
    const expArr = iso(inc.expectedArrivalUtc ?? inc.arrivalUtc);
    const timesDiffer = Boolean(inc.status) && (expDep !== iso(inc.departureUtc) || expArr !== iso(inc.arrivalUtc));
    const delayed = (inc.status === 'OPOZNIONY' || (inc.status === 'ZAPLANOWANY' && timesDiffer))
      ? { dep: expDep, arr: expArr }
      : { dep: null, arr: null };
    if (!cur) {
      plan.inserts.push({
        project_id: o.projectId, vessel_id: vesselId, route: inc.route,
        departure_at: new Date(inc.departureUtc).toISOString(), arrival_at: new Date(inc.arrivalUtc).toISOString(),
        delayed_departure_at: inc.status ? delayed.dep : null, delayed_arrival_at: inc.status ? delayed.arr : null,
        status: inc.status ? status : 'ZAPLANOWANY', source: src,
      });
      continue;
    }
    if (SOURCE_RANK[cur.source] > SOURCE_RANK[src]) { plan.manualKept += 1; continue; }
    const want: SailingPatch = { source: src };
    if (cur.vessel_id !== vesselId) want.vessel_id = vesselId;
    if (iso(cur.arrival_at) !== iso(inc.arrivalUtc)) want.arrival_at = new Date(inc.arrivalUtc).toISOString();
    if (inc.status) {
      // #446: W_REJSIE/DOPLYNAL (albo actual_*) nie cofamy do ZAPLANOWANY z rozkładu; ODWOLANY wygrywa.
      // ETA (compute_load_eta): po W_REJSIE „opóźniony” = delayed_departure_at (tu ustawiane z OPOZNIONY).
      const inTrip = cur.status === 'W_REJSIE' || cur.status === 'DOPLYNAL'
        || cur.actual_departure_at != null || cur.actual_arrival_at != null;
      if (status === 'ODWOLANY' || !inTrip) want.status = status;
      want.delayed_departure_at = delayed.dep;
      want.delayed_arrival_at = delayed.arr;
    }
    const patch: SailingPatch = {};
    for (const [k, v] of Object.entries(want) as [keyof SailingPatch, unknown][]) {
      const before = (cur as unknown as Record<string, unknown>)[k];
      const same = k.endsWith('_at') ? iso(before as string | null) === iso(v as string | null) : before === v;
      if (!same) (patch as Record<string, unknown>)[k] = v;
    }
    if (Object.keys(patch).length === 0) plan.unchanged += 1; else plan.updates.push({ id: cur.id, patch });
  }
  return plan;
}

const warsaw = (utc: string) => new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(utc));

/** Ryzyko dla HHL: status rejsu nierozpoznany — rejs bez zmian, do weryfikacji. */
export function unknownStatusRisk(s: IncomingSailing, raw: string, source: AutoSailingSource = 'POLFERRIES'): RiskInput {
  return {
    kind: 'FERRY', severity: 'MEDIUM',
    title: `Nieznany status rejsu ${s.vessel} ${warsaw(s.departureUtc)} — bez zmiany, do weryfikacji HHL`,
    titleKey: 'rk_ferry_status_unknown', params: { vessel: s.vessel, dep: warsaw(s.departureUtc) },
    detail: { zrodlo: source, statek: s.vessel, odejscie: s.departureUtc, surowy_status: raw },
    dedup: `FERRY_UNKNOWN:${s.vessel}:${new Date(s.departureUtc).toISOString()}`,
  };
}

export type SourceId =
  | 'POLFERRIES_STATUS' | 'POLFERRIES_SCHEDULE'
  | 'STENA_STATUS' | 'STENA_SCHEDULE'
  | 'TALLINK_SCHEDULE' | 'TALLINK_STATUS' | 'VIKING_SCHEDULE' | 'ECKERO_SCHEDULE' | 'ECKERO_STATUS'
  | 'DFDS_SCHEDULE' | 'DFDS_STATUS'
  | 'DIGITRAFFIC' | 'DIGITRAFFIC_PORTCALL' | 'PORT_TALLINN' | 'PORTS_STOCKHOLM'
  | 'STENA_IRM' | 'TRAFIKVERKET' | 'KPD_GDDKIA' | 'TOMTOM'
  | 'FMI' | 'DMI' | 'SMHI' | 'MARINE_WEATHER'
  | 'HERE_TRAFFIC_PL' | 'HERE_ROADS' | 'EMTRACK_WEB' | 'RIO' | 'KSH_SHAREPOINT';
const SOURCE_LABEL: Record<SourceId, string> = {
  POLFERRIES_STATUS: 'status promów (Polferries)', POLFERRIES_SCHEDULE: 'rozkład promów (Polferries)',
  STENA_STATUS: 'status promów (Stena Line)', STENA_SCHEDULE: 'rozkład promów (Stena Line)',
  TALLINK_SCHEDULE: 'rozkład promów (Tallink)', TALLINK_STATUS: 'status promów (Tallink)',
  VIKING_SCHEDULE: 'rozkład promów (Viking Line)',
  ECKERO_SCHEDULE: 'rozkład promów (Eckerö/Finbo)', ECKERO_STATUS: 'status promów (Eckerö/Finbo)',
  DFDS_SCHEDULE: 'rozkład promów (DFDS)', DFDS_STATUS: 'status promów (DFDS)',
  DIGITRAFFIC: 'AIS promów (Digitraffic)', DIGITRAFFIC_PORTCALL: 'godziny portowe (Digitraffic Portnet)',
  PORT_TALLINN: 'odjazdy/przyjazdy (Port of Tallinn)', PORTS_STOCKHOLM: 'odjazdy/przyjazdy (Ports of Stockholm)',
  STENA_IRM: 'pozycje promów Stena (IRM)', TRAFIKVERKET: 'utrudnienia drogowe SE (Trafikverket)',
  KPD_GDDKIA: 'utrudnienia drogowe PL (KPD GDDKiA)', TOMTOM: 'prędkość ruchu (TomTom — wycofane)',
  FMI: 'pogoda morska (FMI)', DMI: 'pogoda morska (DMI)', SMHI: 'pogoda morska (SMHI)',
  MARINE_WEATHER: 'pogoda morska (FMI+DMI+SMHI)',
  HERE_TRAFFIC_PL: 'utrudnienia drogowe PL (HERE)',
  HERE_ROADS: 'geometria tras drogowych (HERE)',
  EMTRACK_WEB: 'telematyka naczep (emtrack web)',
  RIO: 'RIO',
  KSH_SHAREPOINT: 'Plik KSH (SharePoint)',
};
const SOURCE_KIND: Record<SourceId, RiskKind> = {
  POLFERRIES_STATUS: 'FERRY', POLFERRIES_SCHEDULE: 'FERRY',
  STENA_STATUS: 'FERRY', STENA_SCHEDULE: 'FERRY',
  TALLINK_SCHEDULE: 'FERRY', TALLINK_STATUS: 'FERRY', VIKING_SCHEDULE: 'FERRY',
  ECKERO_SCHEDULE: 'FERRY', ECKERO_STATUS: 'FERRY', DFDS_SCHEDULE: 'FERRY', DFDS_STATUS: 'FERRY',
  DIGITRAFFIC: 'FERRY', DIGITRAFFIC_PORTCALL: 'FERRY', PORT_TALLINN: 'FERRY', PORTS_STOCKHOLM: 'FERRY',
  STENA_IRM: 'FERRY', TRAFIKVERKET: 'ROAD_SE', KPD_GDDKIA: 'ROAD_PL', TOMTOM: 'ROAD_SE',
  FMI: 'FERRY', DMI: 'FERRY', SMHI: 'FERRY', MARINE_WEATHER: 'FERRY',
  HERE_TRAFFIC_PL: 'ROAD_PL', HERE_ROADS: 'JOB_FAILURE',
  EMTRACK_WEB: 'JOB_FAILURE', RIO: 'JOB_FAILURE',
  KSH_SHAREPOINT: 'JOB_FAILURE',
};

const warsawStamp = (utc: string) => new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date(utc));

/** Awaria źródła albo zmiana struktury → ryzyko widoczne w kolejce, nigdy cicha pustka.
 *  Emtrack (A8) i RIO (E44): jeden klucz bez daty, w tytule „od kiedy”. Reszta: jeden klucz na dzień.
 *  F7 #661 Decyzja 50: VIKING_SCHEDULE = MEDIUM (Imperva 403 — bez obchodzenia; HHL, bez push/e-mail). */
export function sourceDownRisk(src: SourceId, warnings: string[], nowIso: string, url?: string): RiskInput {
  const sticky = src === 'EMTRACK_WEB' || src === 'RIO' || src === 'KSH_SHAREPOINT' || src === 'HERE_ROADS';
  const when = warsawStamp(nowIso);
  return {
    kind: SOURCE_KIND[src],
    // BN3 decyzja 50/61: TALLINK/DFDS/ECKERO/DIGITRAFFIC/VIKING_SCHEDULE = MEDIUM; Polferries/Stena = HIGH.
    severity: /^(POLFERRIES|STENA)_/.test(src) ? 'HIGH' : 'MEDIUM',
    title: sticky
      ? `Źródło niedostępne: ${SOURCE_LABEL[src]} od ${when} — HHL weryfikuje ręcznie`
      : `Źródło niedostępne: ${SOURCE_LABEL[src]} — HHL weryfikuje ręcznie`,
    titleKey: 'rk_source_down', params: { source: SOURCE_LABEL[src], source_key: `rk_src_${src}` },
    detail: sticky
      ? { zrodlo: src, ostrzezenia: warnings.slice(0, 10), czas: nowIso, od_kiedy: nowIso }
      : { zrodlo: src, ostrzezenia: warnings.slice(0, 10), czas: nowIso },
    dedup: sticky ? `SOURCE_DOWN:${src}` : `SOURCE_DOWN:${src}:${nowIso.slice(0, 10)}`,
    sourceUrl: url ?? null,
  };
}

/** Czy odczyt jest „awarią”: brak danych albo ostrzeżenia o strukturze/HTTP. Ostrzeżenia o pojedynczych wpisach — nie. */
export function isSourceFailure(r: { warnings: string[]; count: number }): boolean {
  if (r.count === 0) return true;
  return r.warnings.some((w) => /Struktura|HTTP|brak rejsów Gdańsk|brak tabel|Brak rejsów|Cloudflare|Stena.*zmieniona/i.test(w));
}
