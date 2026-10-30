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

/** UN/LOCODE → nasz port / trasa względem EETLL / EEMUU / EEPLD. */
const FI_PORTS: Record<string, { code: string; fromEe: FerryRoute; toEe: FerryRoute }> = {
  FIHEL: { code: 'HEL', fromEe: 'TLL-HEL', toEe: 'HEL-TLL' },
  FIVUO: { code: 'VUO', fromEe: 'MUU-VUO', toEe: 'VUO-MUU' },
};

const VESSEL_BY_NAME: Record<string, string> = {
  megastar: 'M/F Megastar',
  mystar: 'M/F MyStar',
  'victoria i': 'M/F Victoria I',
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
    const arrivalRoute = ata && eePartner(prevPort) ? fi.fromEe : null;
    const departureRoute = atd && eePartner(nextPort) ? fi.toEe : null;
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
  fromIso: string;
  toIso: string;
}): string {
  const q = new URLSearchParams({
    from: opts.fromIso,
    to: opts.toIso,
  });
  if (opts.vesselName) q.set('vesselName', opts.vesselName);
  return `${DIGITRAFFIC_PORT_CALLS_URL}?${q}`;
}
