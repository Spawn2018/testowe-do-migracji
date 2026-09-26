/**
 * M12 — rdzeń integracji danych zewnętrznych (ZRODLA_DANYCH.md). Czyste funkcje — wspólne dla
 * funkcji Edge (Deno) i testów (vitest, bez sieci). Zasady (ZLECENIE_FINAL AN2 · M12):
 *  - pierwszeństwo źródeł rejsu: RECZNIE > POLFERRIES > DANE_STARTOWE — zmiany ręcznej HHL odczyt nie nadpisuje
 *  - status NIEZNANY → bez zmiany rejsu, ryzyko dla HHL
 *  - awaria źródła albo zmiana struktury strony → ryzyko „źródło niedostępne”, nigdy cicha pustka
 *  - ryzyka drogowe w rodzajach ROAD_SE / ROAD_PL
 */
import type { FerryRoute, FerryStatus } from '../ferry/polferries.ts';

export type SailingSource = 'DANE_STARTOWE' | 'RECZNIE' | 'POLFERRIES';
export type DbSailingStatus = 'ZAPLANOWANY' | 'OPOZNIONY' | 'ODWOLANY';
export const SOURCE_RANK: Record<SailingSource, number> = { DANE_STARTOWE: 1, POLFERRIES: 2, RECZNIE: 3 };

export interface VesselRow { id: string; name: string; mmsi: number | null }
export interface DbSailing {
  id: string; vessel_id: string; route: FerryRoute; departure_at: string; arrival_at: string;
  delayed_departure_at: string | null; delayed_arrival_at: string | null; status: DbSailingStatus; source: SailingSource;
}
export interface IncomingSailing {
  route: FerryRoute; vessel: string; departureUtc: string; arrivalUtc: string;
  /** tylko odczyt komunikatów (ferry-status); rozkład (ferry-schedule) nie zmienia statusu */
  status?: FerryStatus; expectedDepartureUtc?: string; expectedArrivalUtc?: string;
}
export type SailingPatch = Partial<Pick<DbSailing, 'vessel_id' | 'arrival_at' | 'delayed_departure_at' | 'delayed_arrival_at' | 'status' | 'source'>>;
export interface SailingInsert {
  project_id: string; vessel_id: string; route: FerryRoute; departure_at: string; arrival_at: string;
  delayed_departure_at: string | null; delayed_arrival_at: string | null; status: DbSailingStatus; source: 'POLFERRIES';
}
export type RiskKind = 'FERRY' | 'ROAD_SE' | 'ROAD_PL';
export type RiskSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface RiskInput {
  kind: RiskKind; severity: RiskSeverity; title: string; detail: Record<string, unknown>;
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
}): SyncPlan {
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
    const delayed = inc.status === 'OPOZNIONY'
      ? { dep: iso(inc.expectedDepartureUtc ?? inc.departureUtc), arr: iso(inc.expectedArrivalUtc ?? inc.arrivalUtc) }
      : { dep: null, arr: null };
    if (!cur) {
      plan.inserts.push({
        project_id: o.projectId, vessel_id: vesselId, route: inc.route,
        departure_at: new Date(inc.departureUtc).toISOString(), arrival_at: new Date(inc.arrivalUtc).toISOString(),
        delayed_departure_at: inc.status ? delayed.dep : null, delayed_arrival_at: inc.status ? delayed.arr : null,
        status: inc.status ? status : 'ZAPLANOWANY', source: 'POLFERRIES',
      });
      continue;
    }
    if (SOURCE_RANK[cur.source] > SOURCE_RANK.POLFERRIES) { plan.manualKept += 1; continue; }
    const want: SailingPatch = { source: 'POLFERRIES' };
    if (cur.vessel_id !== vesselId) want.vessel_id = vesselId;
    if (iso(cur.arrival_at) !== iso(inc.arrivalUtc)) want.arrival_at = new Date(inc.arrivalUtc).toISOString();
    if (inc.status) {
      want.status = status;
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
export function unknownStatusRisk(s: IncomingSailing, raw: string): RiskInput {
  return {
    kind: 'FERRY', severity: 'MEDIUM',
    title: `Nieznany status rejsu ${s.vessel} ${warsaw(s.departureUtc)} — bez zmiany, do weryfikacji HHL`,
    detail: { zrodlo: 'POLFERRIES', statek: s.vessel, odejscie: s.departureUtc, surowy_status: raw },
    dedup: `FERRY_UNKNOWN:${s.vessel}:${new Date(s.departureUtc).toISOString()}`,
  };
}

export type SourceId = 'POLFERRIES_STATUS' | 'POLFERRIES_SCHEDULE' | 'DIGITRAFFIC' | 'TRAFIKVERKET' | 'KPD_GDDKIA' | 'TOMTOM';
const SOURCE_LABEL: Record<SourceId, string> = {
  POLFERRIES_STATUS: 'status promów (Polferries)', POLFERRIES_SCHEDULE: 'rozkład promów (Polferries)',
  DIGITRAFFIC: 'AIS promów (Digitraffic)', TRAFIKVERKET: 'utrudnienia drogowe SE (Trafikverket)',
  KPD_GDDKIA: 'utrudnienia drogowe PL (KPD GDDKiA)', TOMTOM: 'prędkość ruchu (TomTom)',
};
const SOURCE_KIND: Record<SourceId, RiskKind> = {
  POLFERRIES_STATUS: 'FERRY', POLFERRIES_SCHEDULE: 'FERRY', DIGITRAFFIC: 'FERRY', TRAFIKVERKET: 'ROAD_SE', KPD_GDDKIA: 'ROAD_PL', TOMTOM: 'ROAD_SE',
};

/** Awaria źródła albo zmiana struktury → ryzyko widoczne w kolejce (jedno na źródło i dzień), nigdy cicha pustka. */
export function sourceDownRisk(src: SourceId, warnings: string[], nowIso: string, url?: string): RiskInput {
  return {
    kind: SOURCE_KIND[src], severity: src.startsWith('POLFERRIES') ? 'HIGH' : 'MEDIUM',
    title: `Źródło niedostępne: ${SOURCE_LABEL[src]} — HHL weryfikuje ręcznie`,
    detail: { zrodlo: src, ostrzezenia: warnings.slice(0, 10), czas: nowIso },
    dedup: `SOURCE_DOWN:${src}:${nowIso.slice(0, 10)}`, sourceUrl: url ?? null,
  };
}

/** Czy odczyt jest „awarią”: brak danych albo ostrzeżenia o strukturze/HTTP. Ostrzeżenia o pojedynczych wpisach — nie. */
export function isSourceFailure(r: { warnings: string[]; count: number }): boolean {
  if (r.count === 0) return true;
  return r.warnings.some((w) => /Struktura|HTTP|brak rejsów Gdańsk|brak tabel|Brak rejsów/i.test(w));
}
