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
import { dictEntry, hasKey, t, tRaw } from '../i18n/messages';

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
  SCHEDULE_IMPORTED: dictEntry('a6_event_type_schedule_imported'),
  RESOURCES_ASSIGNED: dictEntry('a6_event_type_resources_assigned'),
  LOADED: dictEntry('a6_event_type_loaded'),
  DEPARTED: dictEntry('a6_event_type_departed'),
  AT_PORT: dictEntry('a6_event_type_at_port'),
  ON_FERRY: dictEntry('a6_event_type_on_ferry'),
  OFF_FERRY: dictEntry('a6_event_type_off_ferry'),
  APPROACHING: dictEntry('a6_event_type_approaching'),
  UNLOADED: dictEntry('a6_event_type_unloaded'),
  DELIVERED: dictEntry('a6_event_type_delivered'),
  DOC_UPLOADED: dictEntry('a6_event_type_doc_uploaded'),
  STATUS_CHANGED: dictEntry('a6_event_type_status_changed'),
  GEOFENCE: dictEntry('a6_event_type_geofence'),
  NOTE: dictEntry('a6_event_type_note'),
  /* AUD-03: edycja dat przez KSH */
  PLAN_DATES_CHANGED: dictEntry('b_ksh_ev_dates'),
  SCHEDULE_DATE_CRITICAL: dictEntry('b_ksh_ev_crit'),
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
  if (cat === 'DRAWING') return t(locale, 'doc_cat_drawing');
  return hasKey(locale, `a6_doccat_${cat}`) ? t(locale, `a6_doccat_${cat}`) : cat;
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
    FERRY: dictEntry('a6_map_ferry'),
    ROAD_SE: dictEntry('a6_map_road_se'),
    DOC: dictEntry('a6_map_doc'),
    OPS: dictEntry('a6_map_ops'),
    FORCE_MAJEURE: dictEntry('a6_map_force_majeure'),
  };
  return map[type]?.[locale] ?? type;
}

export function readyGateReasonLabel(reason: string, locale: Locale = 'pl'): string {
  const map: Record<string, Record<Locale, string>> = {
    'Brak wymaganych dokumentow': dictEntry('a6_map_brak_wymaganych_dokumentow'),
    'Brak wymaganych dokumentów': dictEntry('a6_map_brak_wymaganych_dokument_w'),
    'Zezwolenie nie pasuje do wymiarow zestawu': dictEntry('a6_map_zezwolenie_nie_pasuje_do_wymiarow_zestawu'),
    'Zezwolenie nie pasuje do wymiarów zestawu': dictEntry('a6_map_zezwolenie_nie_pasuje_do_wymiar_w_zestawu'),
    'Dokument zezwolenia niezgodny z zestawem': dictEntry('a6_map_dokument_zezwolenia_niezgodny_z_zestawem'),
    'permitfits_false': dictEntry('a6_map_permitfits_false'),
    'MISMATCH document': dictEntry('a6_map_mismatch_document'),
    'docMissing flag': dictEntry('a6_map_docmissing_flag'),
  };
  return map[reason]?.[locale] ?? reason;
}

/* D19 (26.09.2026) — nazwy danych startowych, które mają odpowiednik w słowniku: wyświetlane w języku użytkownika.
   Nazwa zmieniona przez użytkownika (inna niż wartość PL ze słownika) zostaje bez zmian. */
const SEED_WORKFLOW_KEY: Record<string, string> = { 'wf-4': 'kpi_ferry_risk', 'wf-12': 'fin_margin_below' };
export function workflowDisplayName(w: { id: string; name: string }, locale: Locale = 'pl'): string {
  const key = SEED_WORKFLOW_KEY[w.id];
  return key && w.name === tRaw('pl', key) ? t(locale, key) : w.name;
}
export function geofenceDisplayName(name: string, locale: Locale = 'pl'): string {
  return name === tRaw('pl', 'loading_site') ? t(locale, 'loading_site') : name;
}
