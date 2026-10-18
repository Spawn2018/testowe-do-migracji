/**
 * wyglad/P4-b — oś statusów w panelu transportu (E25, img/e25-after, makieta E25/statusy.html).
 *
 * 14 statusów E25 w trzech grupach: Przygotowanie (bez śledzenia) · W trasie (śledzenie włączone) · Rozliczenie (bez śledzenia).
 * Godzina i źródło każdego statusu z dziennika zdarzeń transportu (`load_events`), bez nowych zapytań:
 * - `SCHEDULE_IMPORTED` → Zaplanowany (System // Watch Tower);
 * - `STATUS_<kod>` → ręcznie (przycisk albo okno „Zmień status”, `payload.manual`), autor z `actor`;
 * - `STATUS_AUTO` (`payload.to`) → automat, przyczyna z `payload.powod`;
 * - demo: `LOADED`, `ON_FERRY`, `UNLOADED`.
 * Statusy przed bieżącym bez zdarzenia są „pominięte” (E25: przeskoki pokazane jako pominięte).
 * Moduł czysty: bez zapisu i bez zapytań.
 */
import type { Geofence, GeofenceType, Load, LoadEvent, LoadStatus } from '../types';

export type AxisGroupKey = 'prep' | 'route' | 'after';

/** Kolejność E25 (14 statusów). Kody aplikacji. */
export const AXIS: readonly { status: LoadStatus; group: AxisGroupKey }[] = [
  { status: 'PLANNED', group: 'prep' },
  { status: 'RESOURCES_PENDING', group: 'prep' },
  { status: 'DOC_MISSING', group: 'prep' },
  { status: 'READY', group: 'prep' },
  { status: 'LOADING', group: 'route' },
  { status: 'IN_TRANSIT_PL', group: 'route' },
  { status: 'AT_PORT', group: 'route' },
  { status: 'ON_FERRY', group: 'route' },
  { status: 'AT_PORT_SE', group: 'route' },
  { status: 'IN_TRANSIT_SE', group: 'route' },
  { status: 'APPROACHING_SITE', group: 'route' },
  { status: 'DELIVERED', group: 'route' },
  { status: 'READY_TO_INVOICE', group: 'after' },
  { status: 'INVOICED', group: 'after' },
];

/* kody bazy i stare kody aplikacji → kod osi */
const ALIAS: Record<string, LoadStatus> = {
  DOCS_PENDING: 'DOC_MISSING',
  AT_LOADING: 'LOADING',
  AT_PORT_GDANSK: 'AT_PORT',
  FERRY: 'ON_FERRY',
  AT_PORT_NYNASHAMN: 'AT_PORT_SE',
  AT_SITE: 'APPROACHING_SITE',
  UNLOADED: 'DELIVERED',
  UNLOADING: 'DELIVERED',
};

/* DELAYED i SILENT to w E25 oznaczenia — miejsce na osi z etapu */
const BY_STAGE: Record<string, LoadStatus> = {
  PLAN: 'PLANNED', LOADING: 'LOADING', TO_PORT: 'IN_TRANSIT_PL', GDANSK: 'AT_PORT', FERRY: 'ON_FERRY',
  APPROACH: 'AT_PORT_SE', SE_ROAD: 'IN_TRANSIT_SE', SITE: 'APPROACHING_SITE', DELIVERED: 'DELIVERED',
};

const INDEX = new Map<LoadStatus, number>(AXIS.map((a, i) => [a.status, i]));

/** Kod osi dla dowolnego kodu statusu (baza, aplikacja); null = poza osią (Anulowany, nieznany). */
export function axisStatus(code: string | null | undefined): LoadStatus | null {
  if (!code) return null;
  const c = ALIAS[code] ?? code;
  return INDEX.has(c as LoadStatus) ? (c as LoadStatus) : null;
}

/** Indeks bieżącego statusu transportu na osi; -1 = Anulowany. */
export function currentAxisIndex(l: Pick<Load, 'status' | 'stage'>): number {
  const s = String(l.status);
  if (s === 'CANCELLED') return -1;
  if (s === 'DELAYED' || s === 'SILENT') return INDEX.get(BY_STAGE[l.stage] ?? 'PLANNED') ?? 0;
  const a = axisStatus(s);
  return a ? (INDEX.get(a) ?? 0) : 0;
}

export type AxisSource = 'auto' | 'manual' | 'import';

export interface AxisHit {
  status: LoadStatus;
  at: string;
  source: AxisSource;
  /** autor („Imię Nazwisko // Firma” albo „System // Watch Tower”) */
  actor: string | null;
  note: string | null;
  /** przyczyna automatu (`payload.powod`) */
  why: string | null;
  /** faza ustalona z pierwszej pozycji (TELM_PHASE_INFER) */
  phaseInfer: boolean;
  geofenceId: string | null;
  /** B4: `payload.tracker_on` (NACZEPA / CIAGNIK_*) */
  trackerOn: string | null;
  /** wyglad/P6-c (E17): skąd automat wziął status — GPS (lokalizator) albo AIS (prom); null = nie wiadomo */
  channel: 'GPS' | 'AIS' | null;
  /** wyglad/W-naprawy · B5: zapis w Podglądzie — „jako <osoba // firma>” (`payload.preview_as`) */
  previewAs?: string | null;
}

/** E17: źródło automatu z `payload.source` (GPS / AIS — dane wykonawcy), a bez niego z rodzaju zdarzenia. */
export function hitChannel(type: string, p: Record<string, unknown>, status: LoadStatus | null): 'GPS' | 'AIS' | null {
  /* całe słowa, nie fragmenty („PRIORITY” to nie RIO, „RAISE” to nie AIS) */
  const words = new Set(['source', 'kanal', 'channel', 'zrodlo', 'provider']
    .flatMap((k) => (typeof p[k] === 'string' ? (p[k] as string).toUpperCase().split(/[^A-Z0-9]+/) : [])));
  const has = (...w: string[]) => w.some((x) => words.has(x));
  /* pozycja statku (AIS, Digitraffic, Stena) — przed sprawdzeniem `lat`, bo pozycja promu też ma współrzędne */
  if (has('AIS', 'AISSTREAM', 'DIGITRAFFIC', 'STENA')) return 'AIS';
  if (has('GPS', 'EMTRACK', 'RIO', 'TELM', 'GEOFENCE') || typeof p.geofence_id === 'string' || typeof p.lat === 'number') return 'GPS';
  /* Tylko demo (I-0): zdarzenia przykładowe bez `source`. Na produkcji bez `source` znacznik zostaje „AUTO” —
     wykonawca zapisuje `payload.source` przy statusie z automatu (dopisek P6-c). */
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    if (type === 'ON_FERRY') return 'AIS';
    if (type === 'LOADED' || type === 'MILESTONE_LOADED' || type === 'UNLOADED') return 'GPS';
    if (status === 'ON_FERRY') return 'AIS';
  }
  return null;
}

/** Czas zdarzenia w ms (porównania po czasie, nie po tekście: „+02:00” i „Z”). */
export function isoMs(iso: string | null | undefined): number {
  const v = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(v) ? v : 0;
}
const ms = isoMs;

const isSystemActor = (a: string | null | undefined) =>
  !a || a === 'system' || a.startsWith('workflow:') || a === 'driver-pwa';

/** Zdarzenia, które ustawiły status (od najstarszego). */
export function statusHits(events: readonly LoadEvent[]): AxisHit[] {
  const out: AxisHit[] = [];
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : null);
    let status: LoadStatus | null = null;
    let source: AxisSource = 'manual';
    if (e.type === 'SCHEDULE_IMPORTED') {
      status = 'PLANNED';
      source = 'import';
    } else if (e.type === 'STATUS_AUTO') {
      const to = axisStatus(str('to'));
      const from = axisStatus(str('from'));
      if (!to || to === from) continue;
      status = to;
      source = 'auto';
    } else if (e.type.startsWith('STATUS_')) {
      status = axisStatus(e.type.slice('STATUS_'.length));
      source = p.manual === true || !isSystemActor(e.actor) ? 'manual' : 'auto';
    } else if (e.type === 'LOADED' || e.type === 'MILESTONE_LOADED') {
      status = 'LOADING';
      source = 'auto';
    } else if (e.type === 'ON_FERRY') {
      status = 'ON_FERRY';
      source = 'auto';
    } else if (e.type === 'UNLOADED') {
      status = 'DELIVERED';
      source = 'auto';
    }
    if (!status) continue;
    out.push({
      status,
      at: e.at,
      source,
      actor: isSystemActor(e.actor) ? null : e.actor,
      previewAs: str('preview_as'),
      note: e.note ?? str('note'),
      why: str('powod'),
      phaseInfer: str('zrodlo') === 'TELM_PHASE_INFER',
      geofenceId: str('geofence_id'),
      trackerOn: str('tracker_on') ?? str('trackerOn'),
      channel: source === 'auto' ? hitChannel(e.type, p, status) : null,
    });
  }
  /* porównanie po czasie, nie po tekście: zdarzenia z okna mają „+02:00”, z bazy „Z” */
  return out.sort((a, b) => ms(a.at) - ms(b.at));
}

export type AxisRowKind = 'done' | 'current' | 'skipped' | 'pending';

export interface AxisRow {
  kind: AxisRowKind;
  /** jeden status, a dla „pominiętych” — kilka kolejnych */
  statuses: LoadStatus[];
  hit: AxisHit | null;
  /** „pominięte — …” */
  skipWhy: 'complete' | 'trackerSe' | 'trackerPl' | null;
  /** lokalizator przy pominięciu (z przyczyny automatu) */
  skipTracker: 'trailer' | 'tracker' | null;
}

export interface AxisGroup {
  key: AxisGroupKey;
  rows: AxisRow[];
}

export interface StatusAxis {
  groups: AxisGroup[];
  current: LoadStatus | null;
  /** chwila wejścia w bieżący status (ostatnie zdarzenie) */
  currentSince: string | null;
  cancelled: boolean;
  /** godzina pierwszego statusu z pozycji (start śladu) */
  firstFixAt: string | null;
  deliveredAt: string | null;
}

const SE_SIDE: ReadonlySet<LoadStatus> = new Set(['AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'DELIVERED']);

export function buildStatusAxis(
  l: Pick<Load, 'status' | 'stage' | 'unloadedAt'>,
  events: readonly LoadEvent[],
): StatusAxis {
  const hits = statusHits(events);
  const last = new Map<LoadStatus, AxisHit>();
  for (const h of hits) last.set(h.status, h);
  const cur = currentAxisIndex(l);
  const cancelled = cur < 0;
  const rows: { group: AxisGroupKey; row: AxisRow }[] = [];
  AXIS.forEach((a, i) => {
    const hit = last.get(a.status) ?? null;
    let kind: AxisRowKind;
    if (!cancelled && i === cur) kind = 'current';
    else if (!cancelled && i < cur) kind = hit ? 'done' : 'skipped';
    else kind = hit && cancelled ? 'done' : 'pending';
    const prev = rows[rows.length - 1];
    if (kind === 'skipped' && prev && prev.row.kind === 'skipped' && prev.group === a.group) {
      prev.row.statuses.push(a.status);
      return;
    }
    rows.push({ group: a.group, row: { kind, statuses: [a.status], hit, skipWhy: null, skipTracker: null } });
  });
  /* przyczyna przeskoku — z następnego osiągniętego statusu */
  rows.forEach((r, i) => {
    if (r.row.kind !== 'skipped') return;
    const next = rows.slice(i + 1).find((x) => x.row.hit)?.row;
    if (!next?.hit) return;
    if (r.group === 'prep' && next.statuses[0] === 'READY') r.row.skipWhy = 'complete';
    else if (r.group === 'route' && next.hit.phaseInfer) {
      r.row.skipWhy = SE_SIDE.has(next.statuses[0]) ? 'trackerSe' : 'trackerPl';
      /* B4 / H4.2: lokalizator z payload STATUS_AUTO.tracker_on — nie ze słowa „naczep” */
      r.row.skipTracker = (next.hit.trackerOn ?? '').toUpperCase() === 'NACZEPA' ? 'trailer' : 'tracker';
    }
  });
  const groups: AxisGroup[] = (['prep', 'route', 'after'] as const).map((key) => ({
    key,
    rows: rows.filter((r) => r.group === key).map((r) => r.row),
  }));
  const current = cancelled ? null : AXIS[cur].status;
  const currentSince = current ? (last.get(current)?.at ?? null) : null;
  /* początek śladu = pierwsze zdarzenie z pozycji (strefa, faza z pozycji albo zdarzenie oznaczone „GPS”, np. „Załadunek · GPS”
     w osi Status — uwaga F7 #304: bez tego ślad dostarczonego zaczynał się dopiero na placu) */
  let firstFix: string | null = null;
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const fromGps = e.type.startsWith('GEOFENCE_') || (e.type === 'STATUS_AUTO' && typeof p.lat === 'number') || p.source === 'GPS';
    if (fromGps && (!firstFix || ms(e.at) < ms(firstFix))) firstFix = e.at;
  }
  /* data realizacji usługi = `actual_delivery_at` (rozliczenie); zdarzenie — gdy jej brak (demo) */
  const delivered = l.unloadedAt ?? last.get('DELIVERED')?.at ?? null;
  return { groups, current, currentSince, cancelled, firstFixAt: firstFix, deliveredAt: delivered };
}

/* ---------- podpowiedź z GPS do okna „Zmień status” (E25: „Z GPS: wyjazd z placu 12:19 · Użyj”) ---------- */

export type GpsHintKind = 'siteExit' | 'siteEnter' | 'loadEnter' | 'loadExit' | 'portPlEnter' | 'portSeEnter' | 'portSeExit';

const HINT_RULE: Partial<Record<LoadStatus, { kind: GpsHintKind; ev: 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT'; zone: GeofenceType }>> = {
  LOADING: { kind: 'loadEnter', ev: 'GEOFENCE_ENTER', zone: 'LOADING' },
  IN_TRANSIT_PL: { kind: 'loadExit', ev: 'GEOFENCE_EXIT', zone: 'LOADING' },
  AT_PORT: { kind: 'portPlEnter', ev: 'GEOFENCE_ENTER', zone: 'PORT_OUT' },
  AT_PORT_SE: { kind: 'portSeEnter', ev: 'GEOFENCE_ENTER', zone: 'PORT_IN' },
  IN_TRANSIT_SE: { kind: 'portSeExit', ev: 'GEOFENCE_EXIT', zone: 'PORT_IN' },
  APPROACHING_SITE: { kind: 'siteEnter', ev: 'GEOFENCE_ENTER', zone: 'SITE' },
  DELIVERED: { kind: 'siteExit', ev: 'GEOFENCE_EXIT', zone: 'SITE' },
};

/** Ostatnie zdarzenie strefy pasujące do wybranego statusu (nie wcześniej niż bieżący status). */
export function gpsHint(
  target: LoadStatus,
  events: readonly LoadEvent[],
  geofences: readonly Pick<Geofence, 'id' | 'type'>[],
  notBefore: string | null,
): { kind: GpsHintKind; at: string } | null {
  const rule = HINT_RULE[target];
  if (!rule) return null;
  const types = new Map(geofences.map((g) => [g.id, g.type]));
  let best: string | null = null;
  for (const e of events) {
    if (e.type !== rule.ev) continue;
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const id = typeof p.geofence_id === 'string' ? p.geofence_id : null;
    const kind = (id && types.get(id)) ?? (typeof p.geofence_kind === 'string' ? p.geofence_kind : null);
    if (kind !== rule.zone) continue;
    /* strefa „wyjechał” dopisana przy ustaleniu fazy z pierwszej pozycji (0188, `synthetic`) — nie jest pomiarem */
    if (p.synthetic === true) continue;
    if (notBefore && ms(e.at) < ms(notBefore)) continue;
    if (!best || ms(e.at) > ms(best)) best = e.at;
  }
  return best ? { kind: rule.kind, at: best } : null;
}

/* ---------- autor ---------- */

const ORG_NAME: Record<string, string> = { HHL: 'H&H Logistics', SCX: 'Scandinavian Express', KSH: 'KSH' };

/** „Imię Nazwisko // Firma” (E25); stare wpisy z samym kodem firmy — nazwa firmy. */
export function axisActor(actor: string | null): string | null {
  const raw = (actor ?? '').trim();
  if (!raw) return null;
  if (raw.includes('//')) {
    const [left, ...rest] = raw.split('//');
    return `${left.trim()} // ${rest.join('//').trim()}`;
  }
  return ORG_NAME[raw] ?? raw;
}

/* ---------- czas polski „07.10.2026, 12:19” (rok zawsze — właściciel 16.10.2026) ---------- */

const TZ = 'Europe/Warsaw';
function parts(iso: string, tz = TZ) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { dd: o.day, mm: o.month, yyyy: o.year, hh: o.hour, mi: o.minute };
}
/** „07.10.2026, 12:19” */
export function dayTime(iso: string | null | undefined, tz = TZ): string {
  const p = iso ? parts(iso, tz) : null;
  return p ? `${p.dd}.${p.mm}.${p.yyyy}, ${p.hh}:${p.mi}` : '—';
}
/** „07.10.2026” */
export function dayOnly(iso: string | null | undefined, tz = TZ): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const p = iso ? parts(iso, tz) : null;
  return p ? `${p.dd}.${p.mm}.${p.yyyy}` : '—';
}
/** „12:19” */
export function timeOnly(iso: string | null | undefined, tz = TZ): string {
  const p = iso ? parts(iso, tz) : null;
  return p ? `${p.hh}:${p.mi}` : '—';
}
/** wartości pól okna: „2026-10-07”, „12:19” (czas polski) */
export function dateTimeFields(iso: string): { date: string; time: string } | null {
  const p = parts(iso);
  return p ? { date: `${p.yyyy}-${p.mm}-${p.dd}`, time: `${p.hh}:${p.mi}` } : null;
}
/** „3 h 44 min” */
export function hoursMinutes(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}
