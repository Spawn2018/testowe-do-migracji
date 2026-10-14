/**
 * E15 / D-20261014-0640-01 H3.1 — `Load.etaDetail` z `eta_basis` (causes + segment).
 */
import type { EtaDetail, LoadStatus } from '../types';
import type { EtaBasis } from '../data/mappers';

type Causes = {
  drive_h?: number | null;
  rest_h?: number | null;
  remaining_km?: number | null;
  progress?: string | null;
};

export function etaDetailFromBasis(
  basis: EtaBasis | null | undefined,
  status: LoadStatus,
): EtaDetail | null {
  if (!basis) return null;
  const causes = (basis as EtaBasis & { causes?: Causes }).causes;
  const segment = (basis.segment ?? '').toUpperCase();
  const detail: EtaDetail = {};

  if (status === 'APPROACHING_SITE' || /WAIT|SITE|YARD/i.test(segment)) detail.phase = 'WAIT_SITE';
  else if (status === 'ON_FERRY' || segment.includes('FERRY') || segment.includes('CROSSING')) detail.phase = 'FERRY';
  else if (causes?.rest_h != null && Number(causes.rest_h) > 0 && /REST/i.test(segment)) detail.phase = 'REST';
  else if (
    ['LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'DELAYED', 'SILENT', 'READY'].includes(status)
  ) {
    detail.phase = 'DRIVE';
  }

  if (causes?.remaining_km != null && Number.isFinite(Number(causes.remaining_km))) {
    detail.distanceKm = Math.round(Number(causes.remaining_km));
  }
  if (causes?.drive_h != null && Number.isFinite(Number(causes.drive_h))) {
    detail.driveMin = Math.round(Number(causes.drive_h) * 60);
  }
  if (causes?.rest_h != null && Number.isFinite(Number(causes.rest_h))) {
    detail.restHours = Number(causes.rest_h);
    detail.restNeeded = Number(causes.rest_h) > 0;
  }

  return detail.phase != null || detail.distanceKm != null || detail.driveMin != null || detail.restHours != null
    ? detail
    : null;
}
