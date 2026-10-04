/**
 * L-4 — cele kliknięć (docs/handover/CELE_KLIKNIEC.md).
 * Ten sam cel z kokpitu, listy ryzyk, dzwonka i e-maila.
 * Nigdy ścieżka strony głównej. Typ spoza tabeli → Szczegóły wpisu.
 */
export type ClickSource = 'cockpit' | 'risk' | 'bell' | 'email';

export interface ClickInput {
  source?: ClickSource;
  type: string;
  decisionId?: string | null;
  loadCode?: string | null;
  invoiceId?: string | null;
  section?: string | null;
  tab?: string | null;
  resource?: string | null;
  allowed?: boolean;
}

export interface ClickTarget {
  kind: 'decision' | 'transport' | 'form' | 'system' | 'invoice' | 'options' | 'entry' | 'denied';
  path: string;
  message?: string;
}

const HOME = new Set(['', '/', '/#', '/#/', '#/', '#']);

/** Typy z tabeli CELE. Klucz = kod w kodzie. */
const TABLE: Record<string, (i: ClickInput) => ClickTarget> = {};

function decision(id?: string | null): ClickTarget {
  const x = id && id.length ? id : 'brak';
  return { kind: 'decision', path: `/decyzje/${x}` };
}
function transport(code?: string | null, tab = 'status'): ClickTarget {
  const c = encodeURIComponent(code && code.length ? code : 'brak');
  return { kind: 'transport', path: `/transport/${c}?zakladka=${encodeURIComponent(tab)}` };
}
function invoice(id?: string | null): ClickTarget {
  const x = id && id.length ? id : 'brak';
  return { kind: 'invoice', path: `/finanse/faktury/${x}` };
}
function system(section: string): ClickTarget {
  return { kind: 'system', path: `/opcje/stan-systemu#${section}` };
}
function form(code: string | null | undefined, tab: string): ClickTarget {
  const t = transport(code, tab);
  return { kind: 'form', path: t.path };
}
function entry(): ClickTarget {
  return { kind: 'entry', path: '/szczegoly-wpisu' };
}

function put(keys: string[], fn: (i: ClickInput) => ClickTarget) {
  for (const k of keys) TABLE[k] = fn;
}

put([
  'FERRY_CANCELLED', 'ETA_AFTER_LATEST', 'KSH_DATE_LT_5D', 'NO_AWIZACJA', 'DOC_MISSING',
  'KSH_ROW_GONE', 'TOWER_KSH_CONFLICT', 'KSH_FILE_ERROR', 'NO_POSITION', 'ROUTE_DEVIATION',
  'SEFS_OUT_OF_TABLE', 'SEFS_INVOICE_DIFF', 'KR_OVER_3', 'INSURANCE_EXPIRING', 'DWELL_OVER_FREE',
  'BACKUP_FAILED', 'DECISION_OPEN', 'DECISION_ESCALATED', 'DECISION',
], (i) => decision(i.decisionId));

put(['FERRY', 'SAILING_CANCELLED', 'MISSED_SAILING', 'FERRY_OVERDUE'], (i) => decision(i.decisionId));
put(['ETA_BREACH'], (i) => decision(i.decisionId));
put(['LATE_DATE_CHANGE', 'SCHEDULE_DATE_CRITICAL'], (i) => decision(i.decisionId));
put(['SILENT_VEHICLE'], (i) => decision(i.decisionId));
put(['INVOICE_MISMATCH'], (i) => decision(i.decisionId));
put(['INSURANCE_EXPIRY', 'INSURANCE'], (i) => decision(i.decisionId));
put(['PERMIT', 'DOC'], (i) => decision(i.decisionId));

put(['LOADING_UNCONFIRMED', 'AUTO_STATUS', 'DATES_UNCONFIRMED', 'SEQUENCE'], (i) => transport(i.loadCode, 'status'));
put(['STATUS_CHANGE', 'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'GEOFENCE_DWELL', 'ZONE', 'AWIZACJA', 'MILESTONE_LOADED', 'MILESTONE_UNLOADED'], (i) => transport(i.loadCode, 'status'));

put(['PLAN_DATES_CHANGED'], (i) => (i.tab === 'critical' ? decision(i.decisionId) : transport(i.loadCode, 'status')));

put(['RESOURCE_MISSING', 'RESOURCE_DEADLINE'], (i) => {
  const r = (i.resource ?? '').toUpperCase();
  if (r === 'DOC' || r === 'DOCS' || r === 'DOKUMENTY') return transport(i.loadCode, 'dokumenty');
  if (r === 'ESCORT' || r === 'PILOT') return form(i.loadCode, 'awizacja-pilot');
  return form(i.loadCode, 'awizacja');
});
put(['ORDER_NO_MISSING'], (i) => form(i.loadCode, i.resource === 'CARRIER' ? 'numer-przewoznika' : 'numer-hhl'));
put(['HHL_ORDER_MISSING'], (i) => form(i.loadCode, 'numer-hhl'));
put(['CARRIER_ORDER_MISSING'], (i) => form(i.loadCode, 'numer-przewoznika'));

put(['ROAD_PL', 'ROAD_SE'], (i) => (i.tab === 'deviation' ? decision(i.decisionId) : transport(i.loadCode, 'status')));
put(['WEATHER'], (i) => (i.tab === 'storm' ? decision(i.decisionId) : transport(i.loadCode, 'status')));

put(['USAGE_LIMIT'], () => system('zuzycie'));
put(['JOB_FAILURE', 'SOURCE_DOWN', 'SOURCE_DOWN_AIS'], (i) => (
  (i.resource ?? '').toLowerCase() === 'backup' ? decision(i.decisionId) : system('integracje')
));
put(['SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED'], () => system('bramka-sms'));
put(['ZONE_LIMIT'], () => ({ kind: 'options', path: '/opcje/odbiorcy-sms' }));

put(['INVOICE_NEW', 'INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED', 'PAYMENT_REMINDER', 'INVOICE'], (i) => invoice(i.invoiceId));

put(['FEE_PROPOSED'], (i) => transport(i.loadCode, 'ceny'));
put(['FEE_DECIDED'], (i) => transport(i.loadCode, 'ceny'));
put(['MESSAGE', 'USTALENIA'], (i) => transport(i.loadCode, 'ustalenia'));
put(['RATE_CHANGE', 'SEFS_CHANGE'], () => ({ kind: 'options', path: '/opcje/cennik' }));
put(['CLIENT', 'BROADCAST', 'BANNER'], () => entry());

/** Typ jest w kodzie, ale nie ma wiersza w CELE_KLIKNIEC.md — nie zgadujemy celu. */
export const STOPPED_TYPES = ['SMS_FALLBACK', 'WORKFLOW_ALERT'] as const;

export function isHomePath(path: string): boolean {
  const p = path.split('?')[0];
  return HOME.has(path) || HOME.has(p) || p === '/dash' || p === '/kokpit';
}

export function clickTarget(input: ClickInput): ClickTarget {
  const type = (input.type ?? '').trim();
  const stopped = (STOPPED_TYPES as readonly string[]).includes(type);
  const fn = TABLE[type];
  const base = !type || stopped || !fn ? entry() : fn(input);
  if (isHomePath(base.path)) {
    return entry();
  }
  if (input.allowed === false) {
    return { kind: 'denied', path: '/brak-dostepu', message: 'Brak dostępu' };
  }
  return base;
}

export function emailUrl(appUrl: string, input: ClickInput): string {
  const base = appUrl.replace(/\/$/, '');
  if (!base) return '';
  const t = clickTarget({ ...input, source: 'email', allowed: true });
  if (isHomePath(t.path)) return '';
  return `${base}/#${t.path}`;
}

export function tableTypes(): string[] {
  return Object.keys(TABLE).sort();
}
