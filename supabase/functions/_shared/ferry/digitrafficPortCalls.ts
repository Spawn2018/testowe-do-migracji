/**
 * BN2 — rzeczywiste ETA/ATA/ETD/ATD z Digitraffic Portnet (Fintraffic).
 *
 * GET https://meri.digitraffic.fi/api/port-call/v1/port-calls
 * Nagłówki: Digitraffic-User, Accept-Encoding: gzip (jak AIS). Bez klucza.
 * Licencja CC BY 4.0 — atrybucja jak Digitraffic AIS.
 *
 * Porty FI: FIHEL (Helsinki), FIVUO (Vuosaari). EE nie jest w Portnecie —
 * Tallinn / Paldiski / Muuga: osobno Port of Tallinn (BN2).
 */
import type { FerryRoute } from './polferries.ts';

export const DIGITRAFFIC_PORT_CALLS_URL = 'https://meri.digitraffic.fi/api/port-call/v1/port-calls';
export const DIGITRAFFIC_PORTCALL_ATTRIBUTION =
  'Godziny portowe: Fintraffic Digitraffic Portnet, licencja CC BY 4.0';

/** UN/LOCODE → nasz port. Trasa TLL↔HEL zależy od statku (F7 #660: Terminal A → TLLA-HEL). */
const FI_PORTS: Record<string, { code: string }> = {
  FIHEL: { code: 'HEL' },
  FIVUO: { code: 'VUO' },
};

/** Terminal A (Viking / Eckerö Finlandia) vs D (Tallink) — F7 #660 następny PR BN2. */
const TERMINAL_A_VESSELS = new Set([
  'M/F Viking XPRS',
  'M/F Finlandia',
]);

function routesForPort(
  portCode: string,
  vessel: string,
): { fromEe: FerryRoute; toEe: FerryRoute } | null {
  if (portCode === 'VUO') return { fromEe: 'MUU-VUO', toEe: 'VUO-MUU' };
  if (portCode === 'HEL') {
    if (TERMINAL_A_VESSELS.has(vessel)) {
      return { fromEe: 'TLLA-HEL', toEe: 'HELA-TLL' };
    }
    return { fromEe: 'TLL-HEL', toEe: 'HEL-TLL' };
  }
  return null;
}

const VESSEL_BY_NAME: Record<string, string> = {
  megastar: 'M/F Megastar',
  mystar: 'M/F MyStar',
  'victoria i': 'M/F Victoria I',
  'victoria 1': 'M/F Victoria I',
  victoria: 'M/F Victoria I',
  'baltic queen': 'M/F Baltic Queen',
  'viking xprs': 'M/F Viking XPRS',
  finlandia: 'M/F Finlandia',
  'finbo cargo': 'M/F Finbo Cargo',
  'sirena seaways': 'M/F Sirena Seaways',
};

export interface PortCallActual {
  vessel: string;
  mmsi: number | null;
  imo: number | null;
  portToVisit: string;
  /** ATA w porcie FI → dopłynięcie trasy z EE (np. TLL-HEL). */
  actualArrivalUtc: string | null;
  /** ATD z portu FI → wypłynięcie trasy do EE (np. HEL-TLL). */
  actualDepartureUtc: string | null;
  etaUtc: string | null;
  etdUtc: string | null;
  arrivalRoute: FerryRoute | null;
  departureRoute: FerryRoute | null;
  prevPort: string | null;
  nextPort: string | null;
}

export interface PortCallParseResult {
  calls: PortCallActual[];
  warnings: string[];
}

function mapVessel(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/^m\/?s\s+/i, '');
  return VESSEL_BY_NAME[n] ?? null;
}

function eePartner(prevOrNext: string | null | undefined): boolean {
  const p = (prevOrNext ?? '').toUpperCase();
  return p === 'EETLL' || p === 'EEMUU' || p === 'EEPLD' || p.startsWith('EE');
}

/**
 * Parser Portnet port-calls. Puste portCalls przy poprawnej ramce = OK (brak ruchu).
 * Brak ramki / zła struktura → ostrzeżenie awarii.
 */
export function parseDigitrafficPortCalls(json: unknown): PortCallParseResult {
  const warnings: string[] = [];
  const calls: PortCallActual[] = [];
  if (!json || typeof json !== 'object' || !('portCalls' in json)) {
    warnings.push('Struktura Portnet zmieniona: brak portCalls. Parser wymaga aktualizacji.');
    return { calls, warnings };
  }
  const list = (json as { portCalls?: unknown }).portCalls;
  if (!Array.isArray(list)) {
    warnings.push('Struktura Portnet zmieniona: portCalls nie jest tablicą.');
    return { calls, warnings };
  }
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || typeof row !== 'object') {
      warnings.push(`Portnet: nieczytelny wpis nr ${i + 1}.`);
      continue;
    }
    const r = row as Record<string, unknown>;
    const portToVisit = String(r.portToVisit ?? '').toUpperCase();
    const fi = FI_PORTS[portToVisit];
    if (!fi) continue;
    const vesselName = String(r.vesselName ?? '');
    const vessel = mapVessel(vesselName);
    if (!vessel) {
      // Nie-ferry / nieznany — pomijamy bez awarii źródła.
      continue;
    }
    const areas = Array.isArray(r.portAreaDetails) ? r.portAreaDetails : [];
    const area = (areas[0] && typeof areas[0] === 'object')
      ? areas[0] as Record<string, unknown>
      : {};
    const prevPort = r.prevPort != null ? String(r.prevPort) : null;
    const nextPort = r.nextPort != null ? String(r.nextPort) : null;
    const ata = area.ata ? new Date(String(area.ata)).toISOString() : null;
    const atd = area.atd ? new Date(String(area.atd)).toISOString() : null;
    const eta = area.eta ? new Date(String(area.eta)).toISOString() : null;
    const etd = area.etd ? new Date(String(area.etd)).toISOString() : null;
    const routes = routesForPort(fi.code, vessel);
    if (!routes) continue;
    const arrivalRoute = ata && eePartner(prevPort) ? routes.fromEe : null;
    const departureRoute = atd && eePartner(nextPort) ? routes.toEe : null;
    if (!arrivalRoute && !departureRoute && !eta && !etd) continue;
    calls.push({
      vessel,
      mmsi: r.mmsi != null ? Number(r.mmsi) : null,
      imo: r.imoLloyds != null ? Number(r.imoLloyds) : null,
      portToVisit,
      actualArrivalUtc: arrivalRoute ? ata : null,
      actualDepartureUtc: departureRoute ? atd : null,
      etaUtc: eta,
      etdUtc: etd,
      arrivalRoute,
      departureRoute,
      prevPort,
      nextPort,
    });
  }
  return { calls, warnings };
}

export function digitrafficPortCallsUrl(opts: {
  vesselName?: string;
  /** UN/LOCODE, np. FIHEL (#685-a). */
  locode?: string;
  mmsi?: number;
  /** Filtr po dacie otrzymania zgłoszenia (portCallTimestamp) — ATA/ATD / historia. */
  fromIso?: string;
  toIso?: string;
  /**
   * F7 #688 r1 B1: filtr po ETA/ETD (nie po porcieCallTimestamp).
   * `from`/`to` nie pobierają przyszłych rejsów zgłoszonych wcześniej.
   */
  etaFrom?: string;
  etaTo?: string;
  etdFrom?: string;
  etdTo?: string;
}): string {
  const q = new URLSearchParams();
  if (opts.fromIso) q.set('from', opts.fromIso);
  if (opts.toIso) q.set('to', opts.toIso);
  if (opts.etaFrom) q.set('etaFrom', opts.etaFrom);
  if (opts.etaTo) q.set('etaTo', opts.etaTo);
  if (opts.etdFrom) q.set('etdFrom', opts.etdFrom);
  if (opts.etdTo) q.set('etdTo', opts.etdTo);
  if (opts.vesselName) q.set('vesselName', opts.vesselName);
  if (opts.locode) q.set('locode', opts.locode);
  if (opts.mmsi != null) q.set('mmsi', String(opts.mmsi));
  return `${DIGITRAFFIC_PORT_CALLS_URL}?${q}`;
}

/** Prefiks `sailings.source_ref` dla Portnet (#685-a / decyzja 74). */
export const DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX = 'digitraffic:portcall:';
/**
 * Jeden Portnet `portCallId` → dwa rejsy (ETA=TLLA-HEL, ETD=HELA-TLL), więc ref ma też trasę
 * (unikalny indeks częściowy na `source_ref`). Prefiks `digitraffic:` — do zastąpienia w #685-b.
 */
export function digitrafficPortCallSourceRef(
  portCallId: number | string,
  route: FerryRoute,
): string {
  return `${DIGITRAFFIC_PORTCALL_SOURCE_REF_PREFIX}${portCallId}:${route}`;
}

/** Nagłówek Digitraffic-User — jeden ciąg dla AIS i Portnet (F7 #688 r1). */
export const DIGITRAFFIC_USER = 'LOGMAR/WatchTower';

/** #685-a / decyzja 63a — Viking XPRS (MMSI) w Eteläsatama (ES / Katajanokka). */
export const VIKING_XPRS_MMSI = 230705000;
export const VIKING_HEL_AREA_ES = 'ES';
/**
 * TLLA-HEL: `arrival_at` = ETA Helsinek (fakt Portnet), `departure_at` = ETA − 150 min.
 * Źródło: rozkład Viking Line Cargo (fixture `viking-cargo-helsinki-tallinn-sample.html`:
 * 07.00→09.30, 17.00→19.30). Nocny 04.00→06.45 (165 min) → odchylenie 15 min — akceptowalne (PLAN §8).
 * Decyzja koordynatora 73 / F7 #688 r1.
 */
export const VIKING_XPRS_TLLA_HEL_CROSSING_MS = 150 * 60_000;
/**
 * HELA-TLL: `departure_at` = ETD Helsinek (fakt), `arrival_at` = ETD + 160 min.
 * Źródło: ten sam fixture (10.30→13.10, 20.30→23.10). Decyzja 73 / F7 #688 r1.
 */
export const VIKING_XPRS_HELA_TLL_CROSSING_MS = 160 * 60_000;
/** Horyzont ETA/ETD z Portnetu → rozkład (najbliższe dni). */
export const VIKING_DIGITRAFFIC_HORIZON_DAYS = 3;

export interface DigitrafficVikingSailing {
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
  /** Portnet `portCallId` → `sailings.source_ref` (decyzja 74). */
  portCallId: number;
}

/**
 * #685-a — z Portnet FIHEL (obszar ES, Viking XPRS) buduje rejsy TLLA-HEL / HELA-TLL
 * z ETA/ETD w horyzoncie. Bez ATA/ATD (to actual_* w applyDigitrafficPortCallActuals).
 * Atrybucja: DIGITRAFFIC_PORTCALL_ATTRIBUTION (CC BY 4.0).
 * Decyzja 73: TLLA-HEL −150 min / HELA-TLL +160 min (nie symetryczne 120).
 */
export function vikingScheduleFromDigitrafficPortCalls(
  json: unknown,
  opts: { now: Date; horizonDays?: number },
): { sailings: DigitrafficVikingSailing[]; warnings: string[] } {
  const warnings: string[] = [];
  const sailings: DigitrafficVikingSailing[] = [];
  if (!json || typeof json !== 'object' || !('portCalls' in json)) {
    warnings.push('Struktura Portnet zmieniona: brak portCalls. Parser wymaga aktualizacji.');
    return { sailings, warnings };
  }
  const list = (json as { portCalls?: unknown }).portCalls;
  if (!Array.isArray(list)) {
    warnings.push('Struktura Portnet zmieniona: portCalls nie jest tablicą.');
    return { sailings, warnings };
  }
  const horizonDays = opts.horizonDays ?? VIKING_DIGITRAFFIC_HORIZON_DAYS;
  const nowMs = opts.now.getTime();
  const horizonEnd = nowMs + horizonDays * 864e5;
  const vessel = 'M/F Viking XPRS';
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || typeof row !== 'object') {
      warnings.push(`Portnet: nieczytelny wpis nr ${i + 1}.`);
      continue;
    }
    const r = row as Record<string, unknown>;
    if (String(r.portToVisit ?? '').toUpperCase() !== 'FIHEL') continue;
    const mmsi = r.mmsi != null ? Number(r.mmsi) : NaN;
    const name = String(r.vesselName ?? '').trim().toLowerCase();
    const isXprs = mmsi === VIKING_XPRS_MMSI || /viking\s*xprs/.test(name) || name === 'xprs';
    if (!isXprs) continue;
    const portCallId = r.portCallId != null ? Number(r.portCallId) : NaN;
    if (!Number.isFinite(portCallId)) {
      warnings.push(`Portnet: brak portCallId (wpis nr ${i + 1}).`);
      continue;
    }
    const areas = Array.isArray(r.portAreaDetails) ? r.portAreaDetails : [];
    const area = (areas[0] && typeof areas[0] === 'object')
      ? areas[0] as Record<string, unknown>
      : {};
    if (String(area.portAreaCode ?? '').toUpperCase() !== VIKING_HEL_AREA_ES) continue;
    const prevPort = r.prevPort != null ? String(r.prevPort) : null;
    const nextPort = r.nextPort != null ? String(r.nextPort) : null;
    const eta = area.eta ? new Date(String(area.eta)).toISOString() : null;
    const etd = area.etd ? new Date(String(area.etd)).toISOString() : null;
    if (eta && eePartner(prevPort)) {
      const arrMs = Date.parse(eta);
      const depMs = arrMs - VIKING_XPRS_TLLA_HEL_CROSSING_MS;
      if (depMs >= nowMs - 3600_000 && depMs <= horizonEnd) {
        sailings.push({
          route: 'TLLA-HEL',
          vessel,
          departureUtc: new Date(depMs).toISOString(),
          arrivalUtc: eta,
          portCallId,
        });
      }
    }
    if (etd && eePartner(nextPort)) {
      const depMs = Date.parse(etd);
      const arrMs = depMs + VIKING_XPRS_HELA_TLL_CROSSING_MS;
      if (depMs >= nowMs - 3600_000 && depMs <= horizonEnd) {
        sailings.push({
          route: 'HELA-TLL',
          vessel,
          departureUtc: etd,
          arrivalUtc: new Date(arrMs).toISOString(),
          portCallId,
        });
      }
    }
  }
  return { sailings, warnings };
}
