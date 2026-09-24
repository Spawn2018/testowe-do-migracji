/**
 * D11 — Polish labels for enums shown in UI (not full i18n / D19).
 * Internal codes stay English; only rendered text goes through these helpers.
 */
import type {
  DocCategory,
  GeofenceType,
  InvoicePayoutStatus,
  Severity,
} from '../types';

type FerryStatus = 'NONE' | 'BOOKED' | 'CHECKED_IN' | 'ONBOARD' | 'LANDED' | 'CANCELLED' | 'DELAYED';

const FERRY_STATUS: Record<FerryStatus, string> = {
  NONE: 'Brak',
  BOOKED: 'Zarezerwowany',
  CHECKED_IN: 'Check-in',
  ONBOARD: 'Na pokładzie',
  LANDED: 'W porcie docelowym',
  CANCELLED: 'Anulowany',
  DELAYED: 'Opóźniony',
};

const GEOFENCE_TYPE: Record<GeofenceType, string> = {
  LOADING: 'Załadunek',
  PORT_OUT: 'Port wyjścia',
  PRE_PORT: 'Przed portem',
  PORT_IN: 'Port wejścia',
  CHECKPOINT: 'Punkt kontrolny',
  PRE_ARRIVAL: 'Przed przyjazdem',
  SITE: 'Plac budowy',
  REST: 'Postój',
};

const DOC_CATEGORY: Record<DocCategory, string> = {
  PERMIT_PL: 'Zezwolenie PL',
  PERMIT_SE: 'Zezwolenie SE',
  INSURANCE: 'Polisa OCP',
  CMR: 'CMR',
  POD: 'POD',
  LASHING_PHOTOS: 'Zdjęcia mocowania',
  INVOICE: 'Faktura',
};

const SEVERITY: Record<Severity, string> = {
  CRITICAL: 'Krytyczne',
  HIGH: 'Wysokie',
  MEDIUM: 'Średnie',
  LOW: 'Niskie',
};

const ETA_CONFIDENCE: Record<string, string> = {
  HIGH: 'Wysoka',
  MED: 'Średnia',
  LOW: 'Niska',
};

const PAYOUT: Record<InvoicePayoutStatus, string> = {
  NONE: 'Brak',
  SCHEDULED: 'Zaplanowana',
  PAID: 'Wypłacona',
  FUNDED: 'Sfinansowana',
  REJECTED: 'Odrzucona',
};

const EVENT_TYPE: Record<string, string> = {
  SCHEDULE_IMPORTED: 'Import harmonogramu',
  RESOURCES_ASSIGNED: 'Przypisano zasoby',
  LOADED: 'Załadowano',
  DEPARTED: 'Wyjazd',
  AT_PORT: 'W porcie',
  ON_FERRY: 'Na promie',
  OFF_FERRY: 'Z promu',
  APPROACHING: 'Dojeżdża',
  UNLOADED: 'Rozładowano',
  DELIVERED: 'Dostarczono',
  DOC_UPLOADED: 'Wgrano dokument',
  STATUS_CHANGED: 'Zmiana statusu',
  GEOFENCE: 'Strefa geograficzna',
  NOTE: 'Notatka',
};

const RISK_TYPE: Record<string, string> = {
  FERRY: 'Prom',
  ROAD_SE: 'Droga SE',
  DOC: 'Dokumenty',
  OPS: 'Operacje',
  FORCE_MAJEURE: 'Siła wyższa',
};

export function ferryStatusLabel(status: string): string {
  return FERRY_STATUS[status as FerryStatus] ?? status;
}

export function geofenceTypeLabel(type: string): string {
  return GEOFENCE_TYPE[type as GeofenceType] ?? type;
}

export function docCategoryLabel(cat: string): string {
  return DOC_CATEGORY[cat as DocCategory] ?? cat;
}

export function severityLabel(sev: string): string {
  return SEVERITY[sev as Severity] ?? sev;
}

export function etaConfidenceLabel(c: string): string {
  return ETA_CONFIDENCE[c] ?? c;
}

export function payoutStatusLabel(s: string | null | undefined): string {
  if (!s) return PAYOUT.NONE;
  return PAYOUT[s as InvoicePayoutStatus] ?? s;
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE[type] ?? type;
}

export function riskTypeLabel(type: string): string {
  return RISK_TYPE[type] ?? type;
}

/** Tooltip / gate reasons — never expose debug keys like permitFits=false. */
export function readyGateReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    'docMissing flag': 'Brak wymaganych dokumentów',
    'permitFits=false': 'Zezwolenie nie pasuje do wymiarów zestawu',
    'MISMATCH document': 'Dokument zezwolenia niezgodny z zestawem',
  };
  return map[reason] ?? reason;
}
