/**
 * L-4 — cele kliknięć (docs/handover/CELE_KLIKNIEC.md).
 * Ten sam cel z kokpitu, listy ryzyk, dzwonka i e-maila.
 * Nigdy ścieżka strony głównej. Typ spoza tabeli → Szczegóły wpisu.
 * SMS_FALLBACK i WORKFLOW_ALERT są w tabeli (sekcja E, 15:47).
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
  /** Id wiersza sms_outbox, gdy jest w payloadzie. */
  smsId?: string | null;
  /** Kod albo nazwa reguły automatyzacji. */
  ruleId?: string | null;
  status?: string | null;
  recipient?: string | null;
  email?: string | null;
  /** Rola widoku albo rola konta. Puste = nie sprawdzaj (ukrycie robi lista). */
  role?: string | null;
}

export interface ClickTarget {
  kind: 'decision' | 'transport' | 'form' | 'system' | 'invoice' | 'options' | 'entry' | 'denied' | 'sms' | 'workflow';
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
  'BACKUP_FAILED', 'DECISION_OPEN', 'DECISION_ESCALATED', 'DECISION_ESCALATED_BATCH', 'DECISION',
], (i) => i.type === 'DECISION_ESCALATED_BATCH'
  ? { kind: 'entry' as const, path: '/ryzyka' }
  : decision(i.decisionId));

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
put(['ROAD_RISK'], () => system('integracje'));
put(['ROUTE_OBSTACLE'], (i) => transport(i.loadCode, 'status'));
put(['WEATHER'], (i) => (i.tab === 'storm' ? decision(i.decisionId) : transport(i.loadCode, 'status')));

put(['USAGE_LIMIT'], () => system('zuzycie'));
put(['JOB_FAILURE', 'SOURCE_DOWN', 'SOURCE_DOWN_AIS'], (i) => (
  (i.resource ?? '').toLowerCase() === 'backup' ? decision(i.decisionId) : system('integracje')
));
put(['FUEL_READING_MISSING'], () => ({ kind: 'options', path: '/opcje/cennik' }));
put(['SMS_GATEWAY_SILENT', 'SMS_UNDELIVERED'], () => system('bramka-sms'));
put(['ZONE_LIMIT'], () => ({ kind: 'options', path: '/opcje/odbiorcy-sms' }));

put(['INVOICE_NEW', 'INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED', 'PAYMENT_REMINDER', 'INVOICE', 'INVOICE_OVERDUE', 'INVOICE_UPDATED', 'INVOICE_CORRECTED'], (i) => invoice(i.invoiceId));

put(['FEE_PROPOSED'], (i) => transport(i.loadCode, 'ceny'));
put(['FEE_DECIDED'], (i) => transport(i.loadCode, 'ceny'));
put(['MESSAGE', 'USTALENIA', 'LOAD_CHAT_MESSAGE'], (i) => transport(i.loadCode, 'ustalenia'));
put(['RATE_CHANGE', 'SEFS_CHANGE'], () => ({ kind: 'options', path: '/opcje/cennik' }));
put(['CLIENT', 'BROADCAST', 'BANNER'], () => entry());
// AUD-02: szablony powiadomień bez rozpoznanego zdarzenia źródłowego (noticeType) — karta transportu / decyzji.
put(['RISK_OPEN', 'RISK_RESOLVED', 'RISK_SEVERITY', 'ZONE_ENTER', 'ZONE_EXIT', 'LOAD_STATUS_CHANGED'], (i) => transport(i.loadCode, 'status'));
/* C3: nowe zdarzenia macierzy (E35, E49, E23, E47) — transport albo Stan systemu, nigdy strona główna. */
put(['PRE_ARRIVAL', 'PRE_PORT', 'SCX_DETOUR_CHOICE'], (i) => transport(i.loadCode, 'status'));
put(['SOURCE_BACK'], () => system('integracje'));
put(['APP_ERROR'], () => system('bledy-aplikacji'));
put(['DECISION_RESOLVED'], (i) => decision(i.decisionId));

function realCode(code?: string | null): string {
  const c = (code ?? '').trim();
  if (!c || c === '—' || c === '-') return '';
  return c;
}

/** HHL i administrator. Inna firma nie widzi wpisu SMS_FALLBACK. */
export function smsFallbackVisible(role?: string | null): boolean {
  if (!role) return true;
  const r = role.trim().toUpperCase();
  return r === 'HHL' || r === 'HHL_ADMIN' || r === 'HHL_OPS' || r === 'ADMIN' || r === 'ADMINISTRATOR';
}

function smsFallback(i: ClickInput): ClickTarget {
  const id = encodeURIComponent(i.smsId && i.smsId.length ? i.smsId : 'wpis');
  const q = new URLSearchParams();
  if (i.status) q.set('status', i.status);
  if (i.recipient) q.set('odbiorca', i.recipient);
  if (i.email) q.set('email', i.email);
  const code = realCode(i.loadCode);
  if (code) q.set('transport', code);
  const qs = q.toString();
  return { kind: 'sms', path: `/opcje/stan-systemu/bramka-sms/${id}${qs ? `?${qs}` : ''}` };
}

function workflowAlert(i: ClickInput): ClickTarget {
  const code = realCode(i.loadCode);
  if (code) return transport(code, 'status');
  const rule = encodeURIComponent(i.ruleId && i.ruleId.length ? i.ruleId : 'brak');
  return { kind: 'workflow', path: `/automatyzacje/${rule}` };
}

put(['SMS_FALLBACK'], smsFallback);
put(['WORKFLOW_ALERT'], workflowAlert);

/** Pusta: każdy typ z kodu musi być w tabeli. Brama odrzuca typ bez celu. */
export const STOPPED_TYPES = [] as const;

export function isHomePath(path: string): boolean {
  const p = path.split('?')[0];
  return HOME.has(path) || HOME.has(p) || p === '/dash' || p === '/kokpit';
}

export function clickTarget(input: ClickInput): ClickTarget {
  const type = (input.type ?? '').trim();
  const fn = TABLE[type];
  const base = !type || !fn ? entry() : fn(input);
  if (isHomePath(base.path)) {
    return entry();
  }
  if (type === 'SMS_FALLBACK' && !smsFallbackVisible(input.role)) {
    return { kind: 'denied', path: '/brak-dostepu', message: 'Brak dostępu' };
  }
  if (input.allowed === false) {
    return { kind: 'denied', path: '/brak-dostepu', message: 'Brak dostępu' };
  }
  return base;
}

/**
 * AUD-02: szablony powiadomień, które nie są typem zdarzenia z tabeli CELE — cel jak dla zdarzenia źródłowego
 * (ryzyko → jego rodzaj, wjazd/wyjazd ze strefy → GEOFENCE_*, zmiana statusu → STATUS_CHANGE, decyzja → karta decyzji).
 */
export function noticeType(template: string, p: Record<string, unknown>): string {
  if (template === 'RISK_OPEN' || template === 'RISK_RESOLVED' || template === 'RISK_SEVERITY') {
    const kind = typeof p.kind === 'string' ? p.kind : '';
    return kind && TABLE[kind] ? kind : template;
  }
  if (template === 'ZONE_ENTER') return 'GEOFENCE_ENTER';
  if (template === 'ZONE_EXIT') return 'GEOFENCE_EXIT';
  if (template === 'LOAD_STATUS_CHANGED') return 'STATUS_CHANGE';
  if (template === 'DECISION_RESOLVED') return 'DECISION';
  return template;
}

/** Ten sam zestaw pól z kokpitu, listy ryzyk, dzwonka i e-maila. */
export function clickFromPayload(
  template: string,
  payload: Record<string, unknown> | null | undefined,
  source?: ClickSource,
): ClickInput {
  const p = payload ?? {};
  const code = typeof p.code === 'string' ? p.code : null;
  return {
    source,
    type: noticeType(template, p),
    decisionId: typeof p.decision_id === 'string' ? p.decision_id : null,
    loadCode: code,
    invoiceId: typeof p.invoice_id === 'string' ? p.invoice_id : null,
    resource: typeof p.resource === 'string' ? p.resource : null,
    tab: typeof p.tab === 'string' ? p.tab : null,
    smsId: typeof p.sms_id === 'string' ? p.sms_id : null,
    ruleId: typeof p.rule_code === 'string' && p.rule_code
      ? p.rule_code
      : (typeof p.rule === 'string' ? p.rule : null),
    status: typeof p.status === 'string' ? p.status : null,
    recipient: typeof p.to_tail === 'string' ? p.to_tail : null,
    email: typeof p.fallback_email === 'string' ? p.fallback_email : null,
  };
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
