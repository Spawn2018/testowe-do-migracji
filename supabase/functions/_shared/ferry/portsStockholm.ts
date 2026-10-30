/**
 * BN2 — Ports of Stockholm: anlopy (Värtahamnen, Kapellskär).
 *
 * GET https://www.portsofstockholm.com/api/stm/portentry/Get/ (JSON, bez klucza).
 * calculatedArrival/Departure* = plan (lokalny Europe/Stockholm);
 * arrivalDateTime / departureDateTime = rzeczywiste (gdy ustawione).
 * User-Agent uczciwy; awaria struktury → SOURCE_DOWN:PORTS_STOCKHOLM.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';

export const PORTS_STOCKHOLM_PORTENTRY_URL =
  'https://www.portsofstockholm.com/api/stm/portentry/Get/';
export const PORTS_STOCKHOLM_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const PORTS_STOCKHOLM_ATTRIBUTION = 'Ruch portowy: Ports of Stockholm';

const SHIP: Record<string, string> = {
  'sirena seaways': 'M/F Sirena Seaways',
  sirena: 'M/F Sirena Seaways',
  'baltic queen': 'M/F Baltic Queen',
};

const EE_PALDISKI = /EEPL[DN]|PALDISKI/i;
const EE_TALLINN = /EETLL|TALLINN|VANASADAM/i;

export interface PortsStockholmCall {
  vessel: string;
  jetty: string;
  /** Planowane (UTC). */
  plannedArrivalUtc: string | null;
  plannedDepartureUtc: string | null;
  /** Rzeczywiste (UTC), gdy API podało arrivalDateTime / departureDateTime. */
  actualArrivalUtc: string | null;
  actualDepartureUtc: string | null;
  /** Trasa przy dopłynięciu do SE (np. PLD-KPS, TLL-STO). */
  arrivalRoute: FerryRoute | null;
  /** Trasa przy wypłynięciu z SE (np. KPS-PLD, STO-TLL). */
  departureRoute: FerryRoute | null;
  partnerHarbor: string | null;
}

export interface PortsStockholmParseResult {
  calls: PortsStockholmCall[];
  warnings: string[];
}

function mapShip(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/^m\/?s\s+/i, '').replace(/^m\/f\s+/i, '');
  return SHIP[n] ?? null;
}

/** API podaje lokalny czas Sztokholmu bez strefy (np. 2026-10-30T19:00:00). */
function stockholmLocalToUtc(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!m) return null;
  return localToUtc(m[1]!, m[2]!, 0, 'Europe/Stockholm');
}

function jettyKind(jetty: string): 'KPS' | 'STO' | null {
  // NFC + usunięcie znaków po zepsutej dwukrotnej UTF-8 (KapellskÃ¤r / VÃ¤rtahamnen).
  const j = jetty.normalize('NFC').toLowerCase()
    .replace(/Ã¤/g, 'ä').replace(/Ã¶/g, 'ö').replace(/Ã¥/g, 'å');
  if (/kapellsk/.test(j)) return 'KPS';
  if (/värta|varta|norvik/.test(j)) return 'STO';
  return null;
}

function routesFor(
  jetty: string,
  partner: string | null,
): { arrivalRoute: FerryRoute | null; departureRoute: FerryRoute | null } {
  const kind = jettyKind(jetty);
  if (!kind) return { arrivalRoute: null, departureRoute: null };
  const p = partner ?? '';
  if (kind === 'KPS' && (EE_PALDISKI.test(p) || p === '')) {
    return { arrivalRoute: 'PLD-KPS', departureRoute: 'KPS-PLD' };
  }
  if (kind === 'STO' && (EE_TALLINN.test(p) || p === '')) {
    return { arrivalRoute: 'TLL-STO', departureRoute: 'STO-TLL' };
  }
  if (kind === 'KPS') return { arrivalRoute: 'PLD-KPS', departureRoute: 'KPS-PLD' };
  if (kind === 'STO') return { arrivalRoute: 'TLL-STO', departureRoute: 'STO-TLL' };
  return { arrivalRoute: null, departureRoute: null };
}

export function parsePortsStockholmPortEntry(json: unknown): PortsStockholmParseResult {
  const warnings: string[] = [];
  const calls: PortsStockholmCall[] = [];
  if (!json || typeof json !== 'object' || !('items' in json)) {
    warnings.push('Struktura Ports of Stockholm zmieniona: brak items.');
    return { calls, warnings };
  }
  const list = (json as { items?: unknown }).items;
  if (!Array.isArray(list)) {
    warnings.push('Struktura Ports of Stockholm zmieniona: items nie jest tablicą.');
    return { calls, warnings };
  }
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || typeof row !== 'object') {
      warnings.push(`Ports of Stockholm: nieczytelny wpis nr ${i + 1}.`);
      continue;
    }
    const r = row as Record<string, unknown>;
    const vesselName = String(r.vesselName ?? (r.vessel as { name?: string } | undefined)?.name ?? '');
    const vessel = mapShip(vesselName);
    if (!vessel) continue;
    const jetty = String(r.jettyName ?? '');
    const partner = r.arrivalHarbor != null
      ? String(r.arrivalHarbor)
      : (r.departureHarbor != null ? String(r.departureHarbor) : null);
    const { arrivalRoute, departureRoute } = routesFor(jetty, partner);
    if (!arrivalRoute && !departureRoute) continue;
    calls.push({
      vessel,
      jetty,
      plannedArrivalUtc: stockholmLocalToUtc(r.calculatedArrivalDateTime as string | null),
      plannedDepartureUtc: stockholmLocalToUtc(r.calculatedDepartureDateTime as string | null),
      actualArrivalUtc: stockholmLocalToUtc(r.arrivalDateTime as string | null),
      actualDepartureUtc: stockholmLocalToUtc(r.departureDateTime as string | null),
      arrivalRoute,
      departureRoute,
      partnerHarbor: partner,
    });
  }
  return { calls, warnings };
}

export function portsStockholmToSailings(calls: PortsStockholmCall[]): Array<{
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
}> {
  const out: Array<{ route: FerryRoute; vessel: string; departureUtc: string; arrivalUtc: string }> = [];
  for (const c of calls) {
    // Wypłynięcie SE → EE: plan dep w SE, plan arr ≈ dep + typowy czas (z calculated pair).
    if (c.departureRoute && c.plannedDepartureUtc && c.plannedArrivalUtc) {
      // Para calculated: arrival=przyjazd do SE, departure=wypłynięcie z SE (kolejny leg).
      // Dla rozkładu KPS-PLD / STO-TLL używamy plannedDeparture jako dep;
      // arrival po stronie EE ≈ plannedDeparture + (plannedDeparture - plannedArrival) gdy dep > arr,
      // inaczej +9.5 h (DFDS) / +16 h (Tallink noc).
      const depMs = Date.parse(c.plannedDepartureUtc);
      const arrSeMs = Date.parse(c.plannedArrivalUtc);
      const gap = depMs > arrSeMs ? (depMs - arrSeMs) : (
        c.departureRoute === 'KPS-PLD' ? 10 * 3600_000 : 16 * 3600_000
      );
      out.push({
        route: c.departureRoute,
        vessel: c.vessel,
        departureUtc: c.plannedDepartureUtc,
        arrivalUtc: new Date(depMs + gap).toISOString(),
      });
    }
    if (c.arrivalRoute && c.plannedArrivalUtc && c.plannedDepartureUtc) {
      // Przyjazd do SE: dep z EE ≈ arrival - gap postoju przed kolejnym dep, min. typowy crossing.
      const arrMs = Date.parse(c.plannedArrivalUtc);
      const cross = c.arrivalRoute === 'PLD-KPS' ? 10 * 3600_000 : 16 * 3600_000;
      out.push({
        route: c.arrivalRoute,
        vessel: c.vessel,
        departureUtc: new Date(arrMs - cross).toISOString(),
        arrivalUtc: c.plannedArrivalUtc,
      });
    }
  }
  return out;
}
