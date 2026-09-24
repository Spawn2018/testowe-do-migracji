/**
 * D11/D19 — locale-aware labels for enums shown in UI.
 */
import type {
  DocCategory,
  GeofenceType,
  InvoicePayoutStatus,
  Locale,
  Severity,
} from '../types';
import { t } from '../i18n/messages';

type FerryStatus = 'NONE' | 'BOOKED' | 'CHECKED_IN' | 'ONBOARD' | 'LANDED' | 'CANCELLED' | 'DELAYED';

const FERRY_KEY: Record<FerryStatus, string> = {
  NONE: 'ferry_none',
  BOOKED: 'ferry_booked',
  CHECKED_IN: 'ferry_checked_in',
  ONBOARD: 'ferry_onboard',
  LANDED: 'ferry_landed',
  CANCELLED: 'ferry_cancelled',
  DELAYED: 'ferry_delayed',
};

const GEOFENCE_KEY: Record<GeofenceType, string> = {
  LOADING: 'gf_loading',
  PORT_OUT: 'gf_port_out',
  PRE_PORT: 'gf_pre_port',
  PORT_IN: 'gf_port_in',
  CHECKPOINT: 'gf_checkpoint',
  PRE_ARRIVAL: 'gf_pre_arrival',
  SITE: 'gf_site',
  REST: 'gf_rest',
};

const DOC_CATEGORY: Record<DocCategory, string> = {
  PERMIT_PL: 'Zezwolenie PL',
  PERMIT_SE: 'Zezwolenie SE',
  INSURANCE: 'Polisa OCP',
  CMR: 'CMR',
  POD: 'POD',
  LASHING_PHOTOS: 'docs_lashing',
  DRAWING: 'doc_cat_drawing',
  INVOICE: 'Faktura',
};

const DOC_CATEGORY_EN: Record<DocCategory, string> = {
  PERMIT_PL: 'PL permit',
  PERMIT_SE: 'SE permit',
  INSURANCE: 'Cargo insurance',
  CMR: 'CMR',
  POD: 'POD',
  LASHING_PHOTOS: 'docs_lashing',
  DRAWING: 'doc_cat_drawing',
  INVOICE: 'Invoice',
};

const ETA_KEY: Record<string, string> = {
  HIGH: 'eta_high',
  MED: 'eta_med',
  LOW: 'eta_low',
};

const PAY_KEY: Record<InvoicePayoutStatus, string> = {
  NONE: 'pay_none',
  SCHEDULED: 'pay_scheduled',
  PAID: 'pay_paid',
  FUNDED: 'pay_funded',
  REJECTED: 'pay_rejected',
};

const EVENT_TYPE: Record<string, Record<Locale, string>> = {
  SCHEDULE_IMPORTED: { pl: 'Import harmonogramu', en: 'Schedule import', sv: 'Schemaimport' },
  RESOURCES_ASSIGNED: { pl: 'Przypisano zasoby', en: 'Resources assigned', sv: 'Resurser tilldelade' },
  LOADED: { pl: 'Zaladowano', en: 'Loaded', sv: 'Lastad' },
  DEPARTED: { pl: 'Wyjazd', en: 'Departed', sv: 'Avrest' },
  AT_PORT: { pl: 'W porcie', en: 'At port', sv: 'I hamn' },
  ON_FERRY: { pl: 'Na promie', en: 'On ferry', sv: 'Pa farja' },
  OFF_FERRY: { pl: 'Z promu', en: 'Off ferry', sv: 'Av farja' },
  APPROACHING: { pl: 'Dojezdza', en: 'Approaching', sv: 'Narmar' },
  UNLOADED: { pl: 'Rozladowano', en: 'Unloaded', sv: 'Lossad' },
  DELIVERED: { pl: 'Dostarczono', en: 'Delivered', sv: 'Levererad' },
  DOC_UPLOADED: { pl: 'Wgrano dokument', en: 'Document uploaded', sv: 'Dokument uppladdat' },
  STATUS_CHANGED: { pl: 'Zmiana statusu', en: 'Status change', sv: 'Statusandring' },
  GEOFENCE: { pl: 'Strefa geograficzna', en: 'Geofence', sv: 'Geozon' },
  NOTE: { pl: 'Notatka', en: 'Note', sv: 'Anteckning' },
};

export function ferryStatusLabel(status: string, locale: Locale = 'pl'): string {
  const key = FERRY_KEY[status as FerryStatus];
  return key ? t(locale, key) : status;
}

export function geofenceTypeLabel(type: string, locale: Locale = 'pl'): string {
  const key = GEOFENCE_KEY[type as GeofenceType];
  return key ? t(locale, key) : type;
}

export function docCategoryLabel(cat: string, locale: Locale = 'pl'): string {
  if (cat === 'LASHING_PHOTOS') return t(locale, 'docs_lashing');
  const map = locale === 'pl' ? DOC_CATEGORY : DOC_CATEGORY_EN;
  if (locale === 'sv') {
    const sv: Record<string, string> = {
      PERMIT_PL: 'PL-tillstand',
      PERMIT_SE: 'SE-tillstand',
      INSURANCE: 'Godsfordakring',
      CMR: 'CMR',
      POD: 'POD',
      INVOICE: 'Faktura',
    };
    if (cat in sv) return sv[cat];
  }
  return map[cat as DocCategory] ?? cat;
}

export function severityLabel(sev: string, locale: Locale = 'pl'): string {
  return t(locale, `sev_${sev}`);
}

export function etaConfidenceLabel(c: string, locale: Locale = 'pl'): string {
  const key = ETA_KEY[c];
  return key ? t(locale, key) : c;
}

export function payoutStatusLabel(s: string | null | undefined, locale: Locale = 'pl'): string {
  if (!s) return t(locale, 'pay_none');
  const key = PAY_KEY[s as InvoicePayoutStatus];
  return key ? t(locale, key) : s;
}

export function eventTypeLabel(type: string, locale: Locale = 'pl'): string {
  return EVENT_TYPE[type]?.[locale] ?? EVENT_TYPE[type]?.en ?? type;
}

export function riskTypeLabel(type: string, locale: Locale = 'pl'): string {
  const map: Record<string, Record<Locale, string>> = {
    FERRY: { pl: 'Prom', en: 'Ferry', sv: 'Farja' },
    ROAD_SE: { pl: 'Droga SE', en: 'SE road', sv: 'SE-vag' },
    DOC: { pl: 'Dokumenty', en: 'Documents', sv: 'Dokument' },
    OPS: { pl: 'Operacje', en: 'Operations', sv: 'Drift' },
    FORCE_MAJEURE: { pl: 'Sila wyzsza', en: 'Force majeure', sv: 'Force majeure' },
  };
  return map[type]?.[locale] ?? type;
}

export function readyGateReasonLabel(reason: string, locale: Locale = 'pl'): string {
  const map: Record<string, Record<Locale, string>> = {
    'Brak wymaganych dokumentow': {
      pl: 'Brak wymaganych dokumentow',
      en: 'Required documents missing',
      sv: 'Nodvandiga dokument saknas',
    },
    'Brak wymaganych dokumentów': {
      pl: 'Brak wymaganych dokumentów',
      en: 'Required documents missing',
      sv: 'Nodvandiga dokument saknas',
    },
    'Zezwolenie nie pasuje do wymiarow zestawu': {
      pl: 'Zezwolenie nie pasuje do wymiarow zestawu',
      en: 'Permit does not fit vehicle dimensions',
      sv: 'Tillstandet passar inte fordonsmatt',
    },
    'Zezwolenie nie pasuje do wymiarów zestawu': {
      pl: 'Zezwolenie nie pasuje do wymiarów zestawu',
      en: 'Permit does not fit vehicle dimensions',
      sv: 'Tillstandet passar inte fordonsmatt',
    },
    'Dokument zezwolenia niezgodny z zestawem': {
      pl: 'Dokument zezwolenia niezgodny z zestawem',
      en: 'Permit document does not match the set',
      sv: 'Tillstands dokument matchar inte ekipaget',
    },
    'permitFits=false': {
      pl: 'Zezwolenie nie pasuje do wymiarów zestawu',
      en: 'Permit does not fit vehicle dimensions',
      sv: 'Tillstandet passar inte fordonsmatt',
    },
    'MISMATCH document': {
      pl: 'Dokument zezwolenia niezgodny z zestawem',
      en: 'Permit document mismatch',
      sv: 'Tillstands dokument stammer inte',
    },
    'docMissing flag': {
      pl: 'Brak wymaganych dokumentów',
      en: 'Required documents missing',
      sv: 'Nodvandiga dokument saknas',
    },
  };
  return map[reason]?.[locale] ?? reason;
}
