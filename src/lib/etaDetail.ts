/**
 * E15 / D-20261014-0640-01 H3.1 — `Load.etaDetail` z `eta_basis` (causes + segment).
 */
import type { EtaDetail, LoadStatus } from '../types';
import type { EtaBasis } from '../data/mappers';
import { etaWxFromCauses } from './e49Wx';

type Causes = {
  drive_h?: number | null;
  rest_h?: number | null;
  remaining_km?: number | null;
  progress?: string | null;
  /** wyglad/E49 (D-20261016-0230-01 Z1 pkt 4): [{ kind, addMin, where, gustMs, side, atIso, fromIso, untilIso, source }] */
  weather?: unknown;
};

type BasisExtra = EtaBasis & {
  causes?: Causes;
  ferry_eta_at?: string | null;
  ais_eta_at?: string | null;
  wait_ais?: boolean | null;
};

export function etaDetailFromBasis(
  basis: EtaBasis | null | undefined,
  status: LoadStatus,
): EtaDetail | null {
  if (!basis) return null;
  const b = basis as BasisExtra;
  const causes = b.causes;
  const segment = (basis.segment ?? '').toUpperCase();
  const detail: EtaDetail = {};

  if (status === 'APPROACHING_SITE' || /WAIT|SITE|YARD/i.test(segment)) detail.phase = 'WAIT_SITE';
  else if (status === 'ON_FERRY' || segment.includes('FERRY') || segment.includes('CROSSING')) {
    /* B7 / E15 pkt 8: faza prom — ETA z AIS albo „czeka na pozycję AIS” */
    detail.phase = 'FERRY';
    const ais = b.ferry_eta_at ?? b.ais_eta_at ?? null;
    if (ais) detail.ferryEtaAt = ais;
    else detail.waitAis = b.wait_ais !== false;
  } else if (causes?.rest_h != null && Number(causes.rest_h) > 0 && /REST/i.test(segment)) detail.phase = 'REST';
  else if (
    ['LOADING', 'IN_TRANSIT_PL', 'AT_PORT', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'DELAYED', 'SILENT', 'READY'].includes(status)
  ) {
    detail.phase = 'DRIVE';
  }

  if (causes?.remaining_km != null && Number.isFinite(Number(causes.remaining_km))) {
    detail.distanceKm = Math.round(Number(causes.remaining_km));
    /* W-eta-czas (20.10, SG-17): baza liczy remaining_km po korytarzu bieżącego odcinka —
       na odcinku PL to km do portu wypłynięcia, nie do placu w Boden. */
    /* segment z bazy = status z chwili liczenia ETA; status frontu tylko gdy segmentu brak */
    const seSegments = ['AT_PORT_NYNASHAMN', 'IN_TRANSIT_SE', 'AT_SITE'];
    const seStatuses: LoadStatus[] = ['AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE'];
    detail.distanceTo = (segment ? seSegments.includes(segment) || segment.startsWith('SE_') : seStatuses.includes(status)) ? 'SITE' : 'PORT';
  }
  if (causes?.drive_h != null && Number.isFinite(Number(causes.drive_h))) {
    detail.driveMin = Math.round(Number(causes.drive_h) * 60);
  }
  if (causes?.rest_h != null && Number.isFinite(Number(causes.rest_h))) {
    detail.restHours = Number(causes.rest_h);
    detail.restNeeded = Number(causes.rest_h) > 0;
  }

  const wx = etaWxFromCauses(causes?.weather);
  if (wx.length) detail.weather = wx;

  return detail.phase != null || detail.distanceKm != null || detail.driveMin != null
    || detail.restHours != null || detail.waitAis || detail.ferryEtaAt || !!detail.weather
    ? detail
    : null;
}
