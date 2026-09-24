/** Seed data for WATCH TOWER makieta — loads from KSH_HARMONOGRAM.xlsx (50) + 22 extras (≥72) + corridor entities */
import type {
  BafParams,
  Document,
  DemoUser,
  ExceptionItem,
  Geofence,
  Invoice,
  Load,
  LoadEvent,
  LoadMessage,
  Notification,
  Organization,
  RateRule,
  Risk,
  ScheduleVersion,
  WorkflowRule,
  WorkflowRun,
} from '../types';
import { positionAlong, PROGRESS_OF, STATUS_TO_STAGE } from '../lib/status';
import rawLoads from './loads.json';
import { DEMO_FX_META, plnToEurDemo } from '../lib/money/demoFx';
export { DEMO_FX_META } from '../lib/money/demoFx';
import { seedOrders, seedResourcesForIndex } from './seedIdentity';

export const ORGS: Organization[] = [
  { id: 'org-hhl', kind: 'HHL', name: 'H&H Logistics' },
  { id: 'org-ksh', kind: 'KSH', name: 'KSH' },
  { id: 'org-scx', kind: 'SCX', name: 'Scandinavian Express' },
];

export const USERS: DemoUser[] = [
  { id: 'u-hhl-1', orgId: 'org-hhl', name: 'Sebastian Bożek', email: 'sebastian@hhl.pl', roleLabel: 'HHL Admin' },
  { id: 'u-hhl-2', orgId: 'org-hhl', name: 'Anna Ops', email: 'anna@hhl.pl', roleLabel: 'HHL Ops' },
  { id: 'u-ksh-1', orgId: 'org-ksh', name: 'Marek KSH', email: 'marek@ksh.pl', roleLabel: 'KSH Admin' },
  { id: 'u-ksh-2', orgId: 'org-ksh', name: 'Ewa Planner', email: 'ewa@ksh.pl', roleLabel: 'KSH User' },
  { id: 'u-scx-1', orgId: 'org-scx', name: 'Erik Dispatch', email: 'erik@scx.se', roleLabel: 'SCX Dispatch' },
  { id: 'u-scx-2', orgId: 'org-scx', name: 'Johan Lindqvist', email: 'johan@scx.se', roleLabel: 'SCX User' },
];

export const GEOFENCES: Geofence[] = [
  { id: 'gf-01', name: 'KSH Śrem · Grunwaldzka 27C', type: 'LOADING', shape: 'circle', lat: 52.07391, lng: 17.0246, radiusM: 600, hysteresisM: 120, samplesRequired: 2, dwellMin: 10, notifyHhl: true, notifyKsh: true, notifyScx: true, active: true, trigger: 'ENTER' },
  { id: 'gf-02', name: 'Polferries Gdańsk · Sucharskiego 70', type: 'PORT_OUT', shape: 'circle', lat: 54.382, lng: 18.715, radiusM: 800, hysteresisM: 200, samplesRequired: 2, dwellMin: 15, notifyHhl: true, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' },
  { id: 'gf-03', name: 'Bufor 20 km · przed portem Gdańsk', type: 'PRE_PORT', shape: 'circle', lat: 54.3, lng: 18.55, radiusM: 20000, hysteresisM: 500, samplesRequired: 1, dwellMin: 0, notifyHhl: true, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' },
  { id: 'gf-04', name: 'Terminal Nynäshamn', type: 'PORT_IN', shape: 'circle', lat: 58.903, lng: 17.948, radiusM: 900, hysteresisM: 200, samplesRequired: 2, dwellMin: 10, notifyHhl: true, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' },
  { id: 'gf-05', name: 'E4 checkpoint · Södertälje', type: 'CHECKPOINT', shape: 'circle', lat: 59.195, lng: 17.625, radiusM: 1500, hysteresisM: 300, samplesRequired: 1, dwellMin: 0, notifyHhl: true, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER' },
  { id: 'gf-06', name: 'E4 checkpoint · Gävle', type: 'CHECKPOINT', shape: 'circle', lat: 60.674, lng: 17.141, radiusM: 1500, hysteresisM: 300, samplesRequired: 1, dwellMin: 0, notifyHhl: true, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER' },
  { id: 'gf-07', name: 'E4 checkpoint · Sundsvall', type: 'CHECKPOINT', shape: 'circle', lat: 62.39, lng: 17.306, radiusM: 1500, hysteresisM: 300, samplesRequired: 1, dwellMin: 0, notifyHhl: true, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER' },
  { id: 'gf-08', name: 'E4 checkpoint · Umeå', type: 'CHECKPOINT', shape: 'circle', lat: 63.825, lng: 20.263, radiusM: 1500, hysteresisM: 300, samplesRequired: 1, dwellMin: 0, notifyHhl: true, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER' },
  { id: 'gf-09', name: 'E4 checkpoint · Luleå', type: 'CHECKPOINT', shape: 'circle', lat: 65.584, lng: 22.154, radiusM: 1500, hysteresisM: 300, samplesRequired: 1, dwellMin: 0, notifyHhl: true, notifyKsh: false, notifyScx: false, active: true, trigger: 'ENTER' },
  { id: 'gf-10', name: 'Bufor 50 km · przed Boden (Stalverket 20)', type: 'PRE_ARRIVAL', shape: 'circle', lat: 65.70, lng: 21.90, radiusM: 50000, hysteresisM: 800, samplesRequired: 2, dwellMin: 0, notifyHhl: true, notifyKsh: true, notifyScx: true, active: true, trigger: 'ENTER' },
  { id: 'gf-11', name: 'Stegra · Stalverket 20, Boden', type: 'SITE', shape: 'circle', lat: 65.80539, lng: 21.75914, radiusM: 1200, hysteresisM: 200, samplesRequired: 3, dwellMin: 15, notifyHhl: true, notifyKsh: true, notifyScx: true, active: true, trigger: 'DWELL_EXCEEDED' },
  { id: 'gf-12', name: 'Parking REST · ponadgab. · Gävle N', type: 'REST', shape: 'circle', lat: 60.82, lng: 17.2, radiusM: 400, hysteresisM: 100, samplesRequired: 2, dwellMin: 20, notifyHhl: false, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' },
  { id: 'gf-13', name: 'Parking REST · ponadgab. · Umeå S', type: 'REST', shape: 'circle', lat: 63.7, lng: 20.1, radiusM: 400, hysteresisM: 100, samplesRequired: 2, dwellMin: 20, notifyHhl: false, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' },
];

export const WORKFLOWS: WorkflowRule[] = [
  {
    id: 'wf-1',
    name: 'Powiadomienie 40 min przed placem',
    description:
      'Wjazd w strefę Bufor 50 km · Boden → e-mail do KSH i Scandinavian Express, status Dojazd na plac',
    trigger: 'GEOFENCE_ENTER',
    condition: '{"==":[{"var":"geofence.type"},"PRE_ARRIVAL"]}',
    actions: ['notify_ksh', 'notify_scx', 'set_status:APPROACHING_SITE'],
    enabled: true,
    runCount: 38,
  },
  {
    id: 'wf-2',
    name: 'Brak zezwolenia na 48 h przed',
    description:
      'Codziennie 06:00 → jeśli brak zezwolenia, e-mail do przewoźnika; po 12 h bez reakcji eskalacja do Ciebie',
    trigger: 'CRON_DAILY_06',
    condition: '{"and":[{"missing":["permit_pl"]},{"<=":[{"var":"hours_to_load"},48]}]}',
    actions: ['mail_scx', 'escalate_hhl_12h'],
    enabled: true,
    runCount: 11,
  },
  {
    id: 'wf-3',
    name: 'Cichy pojazd',
    description:
      'Brak pozycji > 90 min w godz. 06–22 → ryzyko i e-mail do dyspozytora, eskalacja po 60 min',
    trigger: 'POSITION_STALE',
    condition: '{">":[{"var":"silent_min"},90]}',
    actions: ['flag_silent', 'mail_scx', 'escalate_hhl_60m'],
    enabled: true,
    runCount: 6,
  },
  {
    id: 'wf-4',
    name: 'Ryzyko promowe',
    description:
      'Poziom czerwony na rejsie w ciągu 24 h → e-mail do trzech stron, panel alternatyw, zadanie „potwierdź plan B”',
    trigger: 'FERRY_STATUS',
    condition: '{"!=":[{"var":"ferry.status"},"ON_TIME"]}',
    actions: ['notify_hhl', 'notify_scx', 'open_risk_ferry'],
    enabled: true,
    runCount: 4,
  },
  {
    id: 'wf-5',
    name: 'Zmiana daty na transporcie awizowanym',
    description:
      'Import harmonogramu zmienia datę dostawy → e-mail do przewoźnika z porównaniem przed/po, wymagane potwierdzenie',
    trigger: 'SCHEDULE_IMPORTED',
    condition: '{"==":[{"var":"criticalDateChange"},true]}',
    actions: ['mail_scx_diff', 'require_ack'],
    enabled: true,
    runCount: 9,
  },
  {
    id: 'wf-6',
    name: 'Potwierdzenie dostawy',
    description: 'Rozładunek → zadanie dla przewoźnika: wgraj POD w 24 h, przypomnienie po 18 h',
    trigger: 'UNLOADED',
    condition: 'true',
    actions: ['task_pod_24h', 'remind_18h'],
    enabled: true,
    runCount: 17,
  },
  {
    id: 'wf-7',
    name: 'Otwarcie fakturowania',
    description:
      'Piątek 14:00 → e-mail do przewoźnika z listą transportów gotowych do faktury zbiorczej',
    trigger: 'CRON_FRI_14',
    condition: 'true',
    actions: ['mail_scx_invoice_list'],
    enabled: false,
    runCount: 2,
  },
  {
    id: 'wf-8',
    name: 'Zdążenie na rejs · przed portem',
    description:
      'Wjazd w Bufor 20 km · przed portem Gdańsk + ETA po zamknięciu boarding → ryzyko promowe wysokie, toast Plan B, zadanie potwierdź rejs',
    trigger: 'GEOFENCE_ENTER',
    condition: '{"and":[{"==":[{"var":"geofence.type"},"PRE_PORT"]},{"==":[{"var":"at_risk_ferry_cutoff"},true]}]}',
    actions: ['open_risk_ferry', 'toast_plan_b', 'task_confirm_sailing'],
    enabled: true,
    runCount: 5,
  },
  {
    id: 'wf-9',
    name: 'Sytuacja Trafikverket E4',
    description:
      'Sytuacja wysoka/krytyczna na E4 przy transporcie na drodze SE → ryzyko drogi SE lub siła wyższa, pin na mapie, e-mail HHL+SCX, opóźnienie ładunku',
    trigger: 'TRAFIKVERKET_SITUATION',
    condition: '{"and":[{"in":[{"var":"situation.severity"},["HIGH","CRITICAL"]]},{"==":[{"var":"stage"},"SE_ROAD"]}]}',
    actions: ['open_risk_road_se_or_fm', 'map_pin', 'mark_load_delayed', 'notify_hhl', 'notify_scx'],
    enabled: true,
    runCount: 3,
  },
  {
    id: 'wf-10',
    name: 'Akceptacja factoringu',
    description:
      'HHL Accept oferty factoringu po MATCHED → payoutStatus SCHEDULED, audit + powiadomienie SCX',
    trigger: 'FACTORING_ACCEPTED',
    condition: '{"==":[{"var":"invoice.status"},"MATCHED"]}',
    actions: ['set_payout_scheduled', 'audit_factoring', 'notify_scx'],
    enabled: true,
    runCount: 2,
  },
  {
    id: 'wf-11',
    name: 'Wygaśnięcie PERIOD ≤14 dni',
    description:
      'Codziennie 07:00 → PERIOD kończy się ≤14 d i aktywne loady bez TRIP cover → alert SCX/HHL, banner docs',
    trigger: 'CRON_DAILY_07',
    condition: '{"and":[{"<=":[{"var":"period.days_left"},14]},{">":[{"var":"loads_needing_cover"},0]}]}',
    actions: ['alert_period_expiry', 'banner_docs', 'notify_scx', 'notify_hhl'],
    enabled: true,
    runCount: 7,
  },
  {
    id: 'wf-12',
    name: 'Marża poniżej progu',
    description:
      'Snapshot wyceny: marża < próg SEFS → flaga HHL only, KPI marża poniżej, wpis audit (bez wycieku do SCX/KSH)',
    trigger: 'PRICING_SNAPSHOT',
    condition: '{"<":[{"var":"margin_pct"},{"var":"threshold_pct"}]}',
    actions: ['flag_margin_below', 'kpi_hhl', 'audit_margin'],
    enabled: true,
    runCount: 4,
  },
];

/** P6 — baseRate EUR (PLN ÷ 4,3900 · tabela 186/A/NBP/2026 · 2026-09-24). Metadane: DEMO_FX_META. */
export const RATE_COST: RateRule[] = [
  { id: 'rc1', side: 'COST', lengthFrom: 0, lengthTo: 14, widthFrom: 0, widthTo: 2.6, heightFrom: 0, heightTo: 3.0, weightFrom: 0, weightTo: 22, baseRate: 3758.54 },
  { id: 'rc2', side: 'COST', lengthFrom: 14, lengthTo: 17, widthFrom: 0, widthTo: 2.7, heightFrom: 0, heightTo: 3.2, weightFrom: 0, weightTo: 24, baseRate: 4373.58 },
  { id: 'rc3', side: 'COST', lengthFrom: 17, lengthTo: 22, widthFrom: 0, widthTo: 3.2, heightFrom: 0, heightTo: 3.5, weightFrom: 0, weightTo: 30, baseRate: 5193.62 },
];

export const RATE_REV: RateRule[] = [
  { id: 'rr1', side: 'REVENUE', lengthFrom: 0, lengthTo: 14, widthFrom: 0, widthTo: 2.6, heightFrom: 0, heightTo: 3.0, weightFrom: 0, weightTo: 22, baseRate: 4669.7 },
  { id: 'rr2', side: 'REVENUE', lengthFrom: 14, lengthTo: 17, widthFrom: 0, widthTo: 2.7, heightFrom: 0, heightTo: 3.2, weightFrom: 0, weightTo: 24, baseRate: 5421.41 },
  { id: 'rr3', side: 'REVENUE', lengthFrom: 17, lengthTo: 22, widthFrom: 0, widthTo: 3.2, heightFrom: 0, heightTo: 3.5, weightFrom: 0, weightTo: 30, baseRate: 6355.35 },
];

/** D25/F2.4-c — PORZUCONE/FASADA: legacy BAF_PARAMS UI only. Real fuel = SEFS (`lib/sefs.ts` / SEFS_WEEKLY). Does not feed computeSefs. */
export const BAF_PARAMS: BafParams = {
  indexSource: 'SEFS_HYBRID_OKQ8_ORLEN',
  baseValue: 19.47,
  baseDate: 'contract-base',
  currentValue: 19.68,
  valueDate: '2026-09-20',
  fuelShare: 0,
  triggerThreshold: 0,
  roundingStep: 0.01,
  floorPct: 0,
  capPct: 2,
  sourceUrl: 'https://www.okq8.se/foretag/priser/',
};

type ExtraLoadSpec = {
  code: string;
  itemType: string;
  status: Load['status'];
  dims: Load['dims'];
  plannedLoadDate: string;
  plannedDeliverDate: string;
  sequenceOrder: number;
  sequenceRisk?: boolean;
  silentMinutes?: number | null;
  delayed?: boolean;
  docMissing?: boolean;
  ferry?: Load['ferry'];
  permitPatch?: Partial<NonNullable<Load['permit']>>;
};

/** Additional corridor movements deliberately cover operational failure modes in P7. */
const EXTRA_LOAD_SPECS: ExtraLoadSpec[] = [
  {
    code: 'SG-31',
    itemType: 'Segment ramy · weather hold',
    status: 'IN_TRANSIT_SE',
    dims: { lengthM: 20.4, widthM: 3.25, heightM: 4.15, weightT: 28.8 },
    plannedLoadDate: '2026-09-23',
    plannedDeliverDate: '2026-09-28',
    sequenceOrder: 63,
  },
  {
    code: 'SG-32',
    itemType: 'Moduł mostowy · ferry cancel',
    status: 'AT_PORT',
    dims: { lengthM: 18.8, widthM: 3.1, heightM: 3.8, weightT: 26.4 },
    plannedLoadDate: '2026-09-23',
    plannedDeliverDate: '2026-09-29',
    sequenceOrder: 64,
    ferry: {
      vessel: 'Nova Star',
      departureAt: '2026-09-24T20:00:00+02:00',
      arrivalAt: '2026-09-25T11:00:00+02:00',
      bookingRef: 'PF-SG-32',
      status: 'CANCELLED',
    },
  },
  {
    code: 'T-17',
    itemType: 'Transformator · E4 closure',
    status: 'IN_TRANSIT_SE',
    dims: { lengthM: 16.2, widthM: 3.35, heightM: 4.25, weightT: 31.2 },
    plannedLoadDate: '2026-09-22',
    plannedDeliverDate: '2026-09-27',
    sequenceOrder: 65,
  },
  {
    code: 'SG-33',
    itemType: 'Segment stalowy · silent GPS',
    status: 'SILENT',
    dims: { lengthM: 19.6, widthM: 2.95, heightM: 3.7, weightT: 24.1 },
    plannedLoadDate: '2026-09-21',
    plannedDeliverDate: '2026-09-27',
    sequenceOrder: 66,
    silentMinutes: 194,
  },
  {
    code: 'SG-34',
    itemType: 'Kratownica · permit mismatch',
    // Deliberate P9 READY-gate fixture: visible MISMATCH docs keep this load blocked.
    status: 'DOC_MISSING',
    docMissing: true,
    dims: { lengthM: 21.8, widthM: 3.6, heightM: 4.55, weightT: 33.6 },
    plannedLoadDate: '2026-09-24',
    plannedDeliverDate: '2026-09-30',
    sequenceOrder: 67,
    permitPatch: { plOver: ['W', 'H'], attachmentKind: 'TRIP' },
  },
  {
    code: 'T-18',
    itemType: 'Belka dachowa · sequence',
    status: 'APPROACHING_SITE',
    dims: { lengthM: 17.4, widthM: 2.9, heightM: 3.45, weightT: 22.7 },
    plannedLoadDate: '2026-09-20',
    plannedDeliverDate: '2026-09-26',
    sequenceOrder: 69,
    sequenceRisk: true,
  },
  {
    code: 'SG-35',
    itemType: 'Płyta fasadowa · wind window',
    status: 'DELAYED',
    dims: { lengthM: 15.7, widthM: 3.0, heightM: 3.6, weightT: 19.5 },
    plannedLoadDate: '2026-09-22',
    plannedDeliverDate: '2026-09-28',
    sequenceOrder: 68,
    delayed: true,
  },
  {
    code: 'SG-36',
    itemType: 'Element konstrukcji · missing permit',
    status: 'DOC_MISSING',
    dims: { lengthM: 18.1, widthM: 3.25, heightM: 4.05, weightT: 27.2 },
    plannedLoadDate: '2026-09-25',
    plannedDeliverDate: '2026-10-01',
    sequenceOrder: 70,
    docMissing: true,
  },
  {
    code: 'R-03',
    itemType: 'Reaktor · escort gap',
    status: 'RESOURCES_PENDING',
    dims: { lengthM: 14.9, widthM: 3.15, heightM: 3.9, weightT: 25.8 },
    plannedLoadDate: '2026-09-26',
    plannedDeliverDate: '2026-10-02',
    sequenceOrder: 71,
  },
  {
    code: 'SS-08',
    itemType: 'Steel skid · frost route',
    status: 'IN_TRANSIT_SE',
    dims: { lengthM: 16.8, widthM: 2.85, heightM: 3.5, weightT: 23.4 },
    plannedLoadDate: '2026-09-22',
    plannedDeliverDate: '2026-09-28',
    sequenceOrder: 72,
  },
];

function buildExtraLoads(): Load[] {
  const template = (rawLoads as unknown as Load[])[0];
  return EXTRA_LOAD_SPECS.map((spec, index) => {
    const progress = PROGRESS_OF[spec.status] ?? 0;
    const pos = positionAlong(progress);
    /* P6 — PLN→EUR via DEMO_FX (186/A/NBP/2026 @ 4,3900) */
    const costBase = plnToEurDemo(18200 + index * 430);
    const revBase = plnToEurDemo(22400 + index * 520);
    const costExtras = plnToEurDemo(1250);
    const revExtras = plnToEurDemo(1950);
    const costTotal = costBase + costExtras;
    const revTotal = revBase + revExtras;
    const margin = revTotal - costTotal;
    return {
      ...template,
      id: `load-${String(63 + index).padStart(3, '0')}`,
      code: spec.code,
      itemType: spec.itemType,
      dims: spec.dims,
      qty: 1,
      status: spec.status,
      stage: STATUS_TO_STAGE[spec.status],
      progress,
      plannedLoadDate: spec.plannedLoadDate,
      plannedDeliverDate: spec.plannedDeliverDate,
      resources: {
        ...template.resources,
        ...seedResourcesForIndex(62 + index, {
          pending: spec.status === 'RESOURCES_PENDING',
          escort: Boolean(template.resources.escort),
        }),
        setLengthM: spec.dims.lengthM,
        setWidthM: spec.dims.widthM,
        setHeightM: spec.dims.heightM,
        setWeightT: spec.dims.weightT,
      },
      ...seedOrders(spec.sequenceOrder),
      awizacja: {
        ...template.awizacja,
        loadWindowStart: `${spec.plannedLoadDate}T06:00:00+02:00`,
        loadWindowEnd: `${spec.plannedLoadDate}T14:00:00+02:00`,
        unloadWindowStart: `${spec.plannedDeliverDate}T07:00:00+02:00`,
        unloadWindowEnd: `${spec.plannedDeliverDate}T15:00:00+02:00`,
        confirmed: spec.status !== 'RESOURCES_PENDING' && spec.status !== 'DOC_MISSING',
      },
      ferry: spec.ferry ?? { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
      pricing: {
        ...template.pricing,
        costBase,
        revBase,
        costSefs: Math.round(costBase * 0.01),
        revSefs: Math.round(revBase * 0.01),
        costBaf: Math.round(costBase * 0.01),
        revBaf: Math.round(revBase * 0.01),
        costExtras,
        revExtras,
        costTotal,
        revTotal,
        margin,
        marginPct: margin / revTotal,
        belowThreshold: false,
        currency: 'EUR',
      },
      etaSegments: [],
      etaBoden: null,
      lat: pos.lat,
      lng: pos.lng,
      heading: pos.heading,
      silentMinutes: spec.silentMinutes ?? null,
      sequenceOrder: spec.sequenceOrder,
      sequenceRisk: spec.sequenceRisk ?? false,
      delayed: spec.delayed ?? false,
      docMissing: spec.docMissing ?? false,
      permit: template.permit ? { ...template.permit, zestaw: { ...template.permit.zestaw, L: spec.dims.lengthM, W: spec.dims.widthM, H: spec.dims.heightM, masa_max_t: spec.dims.weightT }, ...spec.permitPatch } : undefined,
    };
  });
}

export function buildSeedLoads(): Load[] {
  const sourceLoads = [...(rawLoads as unknown as Load[]), ...buildExtraLoads()];
  return sourceLoads.map((l, idx) => {
    const progress = PROGRESS_OF[l.status] ?? l.progress;
    const pos = positionAlong(progress);
    // Stress: force a few READY seeds that lack cover to DOC_MISSING / keep TRIP gaps
    let status = l.status;
    let docMissing = l.docMissing;
    let permit = l.permit ? { ...l.permit } : undefined;
    let pricing = { ...l.pricing };

    // Below-threshold stress (≥3 loads) — actionable in Finance
    if (['SG-15', 'SG-22', 'SS-02', 'SG-08'].includes(l.code)) {
      const rev = pricing.revTotal;
      const margin = Math.round(rev * 0.09);
      const costTotal = rev - margin;
      pricing = {
        ...pricing,
        costTotal,
        margin,
        marginPct: 0.09,
        belowThreshold: true,
      };
    }

    // Uncovered TRIP kratownice that block READY (K-03 already TRIP+RESOURCES_PENDING)
    // Promote SG-09 / SG-18 to TRIP gaps mid-pipeline stress
    if (l.code === 'SG-09') {
      status = 'RESOURCES_PENDING';
      docMissing = true;
      if (permit) permit = { ...permit, attachmentKind: 'TRIP' };
    }
    if (l.code === 'SG-18' && permit) {
      // was READY without cover — force gap
      status = 'RESOURCES_PENDING';
      docMissing = true;
      permit = { ...permit, attachmentKind: 'TRIP' };
    }
    if (l.code === 'K-03' && permit) {
      permit = { ...permit, attachmentKind: 'TRIP' };
      docMissing = true;
    }
    // SG-34: permit MISMATCH must not sit in READY (READY gate / P9)
    if (l.code === 'SG-34') {
      status = 'DOC_MISSING';
      docMissing = true;
      if (permit) permit = { ...permit, attachmentKind: 'TRIP' };
    }

    const permitFits =
      l.code === 'SG-07' || l.code === 'SG-34' ? false : l.docMissing || docMissing ? null : true;
    const orders = seedOrders(l.sequenceOrder);
    const base = {
      ...l,
      orderNo: l.orderNo ?? orders.orderNo,
      hhlOrderNo: l.hhlOrderNo ?? orders.hhlOrderNo,
      carrierOrderNo: l.carrierOrderNo ?? orders.carrierOrderNo,
      status,
      docMissing,
      permitFits,
      permit,
      pricing,
      progress,
      stage: STATUS_TO_STAGE[status],
      lat: pos.lat,
      lng: pos.lng,
      heading: pos.heading,
      etaSegments: l.etaSegments ?? [],
      etaBoden: l.etaBoden ?? null,
      etaConfidence: 'MED' as const,
      etaEarliestHours: 0,
      etaLatestHours: 0,
      etaReasons: [] as string[],
      etaMethod: '',
      etaUpdatedAt: '2026-09-23T00:00:00+02:00',
    };
    // ETA applied lazily in store init via applyEtaToLoad — keep placeholders here
    void idx;
    return base as Load;
  });
}

export function buildSeedEvents(loads: Load[]): LoadEvent[] {
  const events: LoadEvent[] = [];
  let n = 0;
  for (const l of loads) {
    events.push({
      id: `ev-${++n}`,
      loadId: l.id,
      type: 'SCHEDULE_IMPORTED',
      at: '2026-09-10T08:00:00+02:00',
      actor: 'system',
      note: `KSH import ${l.code}`,
    });
    if (!['PLANNED', 'RESOURCES_PENDING'].includes(l.status)) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'RESOURCES_ASSIGNED',
        at: '2026-09-18T10:00:00+02:00',
        actor: 'Erik Dispatch',
        payload: { driver: l.resources.driverName },
      });
    }
    if (
      [
        'LOADING',
        'IN_TRANSIT_PL',
        'AT_PORT',
        'ON_FERRY',
        'IN_TRANSIT_SE',
        'APPROACHING_SITE',
        'UNLOADING',
        'DELIVERED',
        'DELAYED',
        'SILENT',
      ].includes(l.status)
    ) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'LOADED',
        at: `${l.plannedLoadDate}T08:30:00+02:00`,
        actor: 'driver-pwa',
        note: 'Załadowany',
      });
    }
    if (
      ['ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED', 'DELAYED', 'SILENT'].includes(
        l.status,
      )
    ) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'ON_FERRY',
        at: `${l.plannedLoadDate}T11:15:00+02:00`,
        actor: 'driver-pwa',
        note: 'Na promie',
      });
    }
    if (['UNLOADING', 'DELIVERED'].includes(l.status)) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'UNLOADED',
        at: `${l.plannedDeliverDate}T12:00:00+02:00`,
        actor: 'driver-pwa',
        note: 'Rozładowany',
      });
    }
    if (l.status === 'SILENT') {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'POSITION_STALE',
        at: '2026-09-22T14:20:00+02:00',
        actor: 'system',
        note: 'Brak pingu >90 min',
      });
    }
    if (l.docMissing) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'DOC_MISSING',
        at: '2026-09-21T06:05:00+02:00',
        actor: 'workflow:wf-2',
        note: 'Brak zezwolenia PL',
      });
    }
  }
  return events;
}

export function buildSeedDocuments(loads: Load[]): Document[] {
  const docs: Document[] = [];
  let n = 0;
  const cats = [
    { cat: 'PERMIT_PL' as const },
    { cat: 'PERMIT_SE' as const },
    { cat: 'INSURANCE' as const },
    { cat: 'CMR' as const },
    { cat: 'POD' as const },
    { cat: 'LASHING_PHOTOS' as const },
    { cat: 'DRAWING' as const },
  ];
  for (const l of loads) {
    for (const c of cats) {
      const late = ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING'].includes(l.status);
      const delivered = l.status === 'DELIVERED' || l.status === 'UNLOADING';
      let status: Document['status'] = 'MISSING';
      let uploaded: string | null = null;
      let permitFits: boolean | null = null;
      if (c.cat === 'PERMIT_PL' || c.cat === 'PERMIT_SE') {
        if (['SG-07', 'SG-34'].includes(l.code)) {
          status = 'MISMATCH';
          uploaded = '2026-09-19T09:00:00+02:00';
          permitFits = false;
        } else if (!late && !l.docMissing) {
          status = 'UPLOADED';
          uploaded = '2026-09-18T12:00:00+02:00';
          permitFits = true;
        }
      } else if (
        c.cat === 'CMR' &&
        !['PLANNED', 'RESOURCES_PENDING', 'READY', 'DOC_MISSING'].includes(l.status)
      ) {
        status = 'UPLOADED';
        uploaded = `${l.plannedLoadDate}T09:00:00+02:00`;
      } else if (c.cat === 'POD' && delivered) {
        status = l.code === 'SG-02' ? 'MISSING' : 'UPLOADED';
        uploaded = status === 'UPLOADED' ? `${l.plannedDeliverDate}T14:00:00+02:00` : null;
      } else if (c.cat === 'INSURANCE' && !l.docMissing) {
        status = 'UPLOADED';
        uploaded = '2026-08-01T10:00:00+02:00';
      } else if (
        c.cat === 'LASHING_PHOTOS' &&
        [
          'LOADING',
          'IN_TRANSIT_PL',
          'AT_PORT',
          'ON_FERRY',
          'IN_TRANSIT_SE',
          'APPROACHING_SITE',
          'UNLOADING',
          'DELIVERED',
        ].includes(l.status) &&
        l.id !== 'load-015'
      ) {
        status = 'UPLOADED';
        uploaded = `${l.plannedLoadDate}T08:45:00+02:00`;
      } else if (c.cat === 'DRAWING') {
        /* L7 — from model: most loads have KSH drawing; not always 100% */
        if (!l.docMissing && l.status !== 'RESOURCES_PENDING' && !['SG-07', 'SG-34', 'R-03'].includes(l.code)) {
          status = 'UPLOADED';
          uploaded = '2026-09-10T11:00:00+02:00';
        }
      }
      docs.push({
        id: `doc-${++n}`,
        loadId: l.id,
        category: c.cat,
        name: `${c.cat}_${l.code}.pdf`,
        uploadedAt: uploaded,
        deadline: `${l.plannedLoadDate}T06:00:00+02:00`,
        status,
        permitFits,
        visibleTo: ['HHL', 'KSH', 'SCX'],
      });
    }
  }
  return docs;
}

export function buildSeedMessages(loads: Load[]): LoadMessage[] {
  return loads.slice(0, 12).map((l, i) => ({
    id: `msg-${i + 1}`,
    loadId: l.id,
    at: '2026-09-21T11:00:00+02:00',
    author: i % 2 === 0 ? 'Anna Ops' : 'Erik Dispatch',
    org: (i % 2 === 0 ? 'HHL' : 'SCX') as LoadMessage['org'],
    text:
      i % 2 === 0
        ? `Proszę potwierdzić awizację dla ${l.code}.`
        : `Awizacja potwierdzona, rejs ${l.ferry.vessel ?? 'TBD'}.`,
  }));
}

export function buildSeedRisks(loads: Load[]): Risk[] {
  const OWNER: Record<'HHL' | 'KSH' | 'SCX', string> = {
    HHL: 'H&H Logistics',
    KSH: 'KSH',
    SCX: 'Scandinavian Express',
  };
  const odp = (o: 'HHL' | 'KSH' | 'SCX') => `Odpowiada: ${OWNER[o]}`;

  const docsPending = loads.filter((l) => l.docMissing || l.status === 'DOC_MISSING').slice(0, 3);
  const resPending = loads.filter((l) => l.status === 'RESOURCES_PENDING').slice(0, 2);
  const silent = loads.find((l) => l.status === 'SILENT') ?? loads.find((l) => l.status === 'IN_TRANSIT_SE');
  const delayed = loads.filter((l) => l.delayed || l.status === 'DELAYED');
  const ferry = loads.find((l) => l.status === 'ON_FERRY' || l.status === 'AT_PORT');
  const inSe = loads.find((l) => l.status === 'IN_TRANSIT_SE');
  const seqA = loads[31] ?? loads[loads.length - 2];
  const seqB = loads[27] ?? loads[loads.length - 5];
  const sg07 = loads.find((l) => l.code === 'SG-07');

  const R: Risk[] = [];

  docsPending.forEach((l, i) => {
    R.push({
      id: `risk-permit-${i + 1}`,
      type: 'DOC',
      severity: i === 0 ? 'CRITICAL' : 'HIGH',
      title: `Brak zezwolenia — załadunek za ${18 + i * 14} h`,
      detail: `Do załadunku <${18 + i * 14} h, brak zezwolenia obejmującego wymiary zestawu`,
      loadId: l.id,
      owner: 'SCX',
      meta: odp('SCX'),
      nextAction: 'Wgraj zezwolenie',
      ageHours: 2 + i,
    });
  });

  resPending.forEach((l, i) => {
    R.push({
      id: `risk-res-${i + 1}`,
      type: 'OPS',
      severity: 'MEDIUM',
      title: 'Brak kierowcy i numerów rejestracyjnych',
      detail: 'Termin uzupełnienia minął 4 h temu',
      loadId: l.id,
      owner: 'SCX',
      meta: 'Termin uzupełnienia minął 4 h temu',
      nextAction: 'Uzupełnij zasoby',
      ageHours: 4,
    });
  });

  if (silent) {
    R.push({
      id: 'risk-silent',
      type: 'OPS',
      severity: 'HIGH',
      title: 'Brak pozycji od 2 h 14 min',
      detail: 'Ostatni sygnał: E4 na północ od Umeå',
      loadId: silent.id,
      owner: 'SCX',
      meta: 'Ostatni sygnał: E4 na północ od Umeå',
      nextAction: 'Zadzwoń do kierowcy',
      ageHours: 2,
    });
  }

  delayed.slice(0, 2).forEach((l, i) => {
    const mins = Math.max(95, Math.round((l.etaLatestHours ?? 4) * 20) + i * 40);
    R.push({
      id: `risk-eta-${i + 1}`,
      type: 'OPS',
      severity: mins > 300 ? 'HIGH' : 'MEDIUM',
      title: `Prognoza przyjazdu poza oknem o ${Math.floor(mins / 60)} h ${mins % 60} min`,
      detail: 'Ekipa montażowa powiadomiona automatycznie',
      loadId: l.id,
      owner: 'HHL',
      meta: 'Ekipa montażowa powiadomiona automatycznie',
      nextAction: 'Przelicz ETA i poinformuj KSH',
      ageHours: 1,
    });
  });

  R.push({
    id: 'risk-ferry',
    type: 'FERRY',
    severity: 'HIGH',
    title: 'Rejs 24.09 · prognoza fali 2,9 m, porywy 19 m/s',
    detail: '3 transporty na tym rejsie. Alternatywa: Gdynia–Karlskrona',
    loadId: ferry?.id,
    owner: 'HHL',
    meta: '3 transporty na tym rejsie. Alternatywa: Gdynia–Karlskrona',
    nextAction: 'Włącz Plan B / powiadom SCX',
    ageHours: 0.67,
    ferryPlanB: ['Nova Star jutro 11:00', 'Gdynia–Karlskrona', 'Hold w Gdańsku +12h'],
  });

  R.push({
    id: 'risk-road',
    type: 'ROAD_SE',
    severity: 'HIGH',
    title: 'E4 Gävle — roboty drogowe · +35 min',
    detail: 'Źródło: Trafikverket · seed-sit-1 · ograniczenie przepustowości na północ',
    loadId: inSe?.id,
    owner: 'HHL',
    meta: 'Odpowiada: H&H Logistics · Trafikverket E4 Gävle',
    nextAction: 'Śledź checkpoint / objazd',
    ageHours: 0.2,
    delayImpactHours: 0.6,
    situationId: 'seed-sit-1',
    causeCategory: 'roadworks',
  });

  R.push({
    id: 'risk-road-sund',
    type: 'ROAD_SE',
    severity: 'HIGH',
    title: 'E4 Sundsvall — wypadek · +55 min',
    detail: 'Źródło: Trafikverket · seed-sit-2 · korek po kolizji',
    loadId: inSe?.id,
    owner: 'SCX',
    meta: 'Odpowiada: Scandinavian Express · przyczyna: wypadek',
    nextAction: 'Potwierdź ETA z kierowcą',
    ageHours: 1.1,
    delayImpactHours: 0.9,
    situationId: 'seed-sit-2',
    causeCategory: 'accident',
  });

  const ferryLoad = ferry;
  const seLoad2 =
    loads.filter((l) => l.status === 'IN_TRANSIT_SE' || l.stage === 'SE_ROAD')[1] ?? inSe;
  const approaching = loads.find((l) => l.status === 'APPROACHING_SITE');

  R.push({
    id: 'risk-fm-snow',
    type: 'FORCE_MAJEURE',
    severity: 'CRITICAL',
    title: 'Siła wyższa — zamknięcie E4 (śnieżyca) · +4 h',
    detail: 'Odcinek Luleå–Boden zamknięty dla ponadgabarytu; kolumna za pługiem. Przyczyna: pogoda.',
    loadId: inSe?.id ?? seLoad2?.id,
    owner: 'HHL',
    meta: 'Odpowiada: H&H Logistics · przyczyna: śnieżyca / zamknięcie E4',
    nextAction: 'Wymaga decyzji — hold lub okno objazdu',
    ageHours: 1.5,
    delayImpactHours: 4,
    situationId: 'seed-sit-boden',
    causeCategory: 'weather',
  });

  R.push({
    id: 'risk-fm-storm',
    type: 'FORCE_MAJEURE',
    severity: 'HIGH',
    title: 'Siła wyższa — sztorm Bałtyk · rejs 24.09 · +12 h',
    detail: 'Armator wstrzymuje odejście przy fali >3 m. Transporty w oknie promu.',
    loadId: ferryLoad?.id,
    owner: 'HHL',
    meta: 'Odpowiada: H&H Logistics · przyczyna: sztorm / force majeure promu',
    nextAction: 'Plan B / nowego slotu na 25.09',
    ageHours: 0.8,
    delayImpactHours: 12,
    causeCategory: 'storm',
    ferryPlanB: ['Nova Star jutro 11:00', 'Gdynia–Karlskrona', 'Hold w Gdańsku +12h'],
  });

  R.push({
    id: 'risk-fm-strike',
    type: 'FORCE_MAJEURE',
    severity: 'HIGH',
    title: 'Siła wyższa — akcja związkowa port Nynäshamn · +6 h',
    detail: 'Opóźnienie wyładunku HGV; kolejka na rampach. Dotyczy transportów SE_ROAD.',
    loadId: seLoad2?.id ?? inSe?.id,
    owner: 'SCX',
    meta: 'Odpowiada: Scandinavian Express · przyczyna: akcja związkowa',
    nextAction: 'Przelicz ETA Boden i powiadom KSH',
    ageHours: 3,
    delayImpactHours: 6,
    causeCategory: 'industrial',
  });

  R.push({
    id: 'risk-fm-border',
    type: 'FORCE_MAJEURE',
    severity: 'CRITICAL',
    title: 'Siła wyższa — kontrola graniczna / kolejka · +3 h',
    detail: 'Wzmożone kontrole na odcinku podejścia do Boden; ponadgabaryt wstrzymany.',
    loadId: approaching?.id ?? inSe?.id,
    owner: 'HHL',
    meta: 'Odpowiada: H&H Logistics · przyczyna: opóźnienie graniczne',
    nextAction: 'Wymaga decyzji — nowy slot rozładunku',
    ageHours: 2.2,
    delayImpactHours: 3,
    causeCategory: 'border',
  });

  if (seqA && seqB) {
    R.push({
      id: 'risk-seq',
      type: 'OPS',
      severity: 'HIGH',
      title: `Rozjazd kolejności montażu: ${seqA.code} przyjedzie po ${seqB.code}`,
      detail: 'Pozycja montażowa wymaga odwrotnej kolejności',
      loadId: seqA.id,
      owner: 'HHL',
      meta: 'Pozycja montażowa wymaga odwrotnej kolejności',
      nextAction: 'Przesuń slot dostawy',
      ageHours: 3,
    });
  }

  if (sg07) {
    R.push({
      id: 'risk-mismatch',
      type: 'DOC',
      severity: 'HIGH',
      title: 'Zezwolenie nie obejmuje wymiarów zestawu',
      detail: 'Zestaw ponad limity zezwolenia PL/SE',
      loadId: sg07.id,
      owner: 'SCX',
      meta: odp('SCX'),
      nextAction: 'Zmień zestaw albo wgraj nowe zezwolenie',
      ageHours: 9,
    });
  }

  R.push({
    id: 'risk-ins',
    type: 'OPS',
    severity: 'MEDIUM',
    title: 'Polisa OCP Scandinavian Express wygasa za 11 dni',
    detail: 'Wymagany nowy certyfikat przed 03.10',
    owner: 'SCX',
    meta: 'Wymagany nowy certyfikat przed 03.10',
    nextAction: 'Poproś o nową polisę',
    ageHours: 24,
  });

  R.push({
    id: 'risk-inv',
    type: 'OPS',
    severity: 'MEDIUM',
    title: 'Faktura zbiorcza tydzień 38 — rozbieżność 1 840 PLN',
    detail: '2 pozycje rozliczone poza cennikiem',
    owner: 'HHL',
    meta: '2 pozycje rozliczone poza cennikiem',
    nextAction: 'Uzgodnij pozycje',
    ageHours: 6,
  });

  const byCode = (code: string) => loads.find((l) => l.code === code);
  const extraRisk = (
    risk: Omit<Risk, 'loadId'> & { loadCode?: string },
  ): Risk => {
    const { loadCode, ...rest } = risk;
    return { ...rest, loadId: loadCode ? byCode(loadCode)?.id : undefined };
  };

  // P7 expansion: each new movement has a visible, actionable exception.
  R.push(
    extraRisk({
      id: 'risk-weather-ice',
      type: 'FORCE_MAJEURE',
      severity: 'CRITICAL',
      title: 'Siła wyższa — oblodzenie E4 Gävle–Sundsvall · +5 h',
      detail: 'Wstrzymano przejazd ponadgabarytu do czasu przejazdu pługosolarek; przyczyna: pogoda.',
      loadCode: 'SG-31',
      owner: 'HHL',
      meta: 'Odpowiada: H&H Logistics · przyczyna: oblodzenie / pogoda',
      nextAction: 'Wymaga decyzji — hold lub okno konwoju',
      ageHours: 0.6,
      delayImpactHours: 5,
      causeCategory: 'weather',
    }),
    extraRisk({
      id: 'risk-ferry-cancel',
      type: 'FERRY',
      severity: 'CRITICAL',
      title: 'Prom anulowany — M/F Nova Star · 24.09',
      detail: 'Armator anulował odejście; 1 transport bez potwierdzonego slotu na Nynäshamn.',
      loadCode: 'SG-32',
      owner: 'HHL',
      meta: 'Odpowiada: H&H Logistics · status armatora: anulowany',
      nextAction: 'Przenieś na Wawel / potwierdź Plan B',
      ageHours: 1.2,
      ferryPlanB: ['Wawel 25.09 20:00', 'Gdynia–Karlskrona', 'Hold w Gdańsku +24 h'],
    }),
    extraRisk({
      id: 'risk-e4-closure',
      type: 'ROAD_SE',
      severity: 'CRITICAL',
      title: 'E4 zamknięta — Luleå północ · objazd +120 min',
      detail: 'Pełne zamknięcie E4 po kolizji; objazd dla zestawów ponadgabarytowych przez drogę 97.',
      loadCode: 'T-17',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · E4 CLOSED · źródło: Trafikverket',
      nextAction: 'Potwierdź objazd i nową ETA Boden',
      ageHours: 0.4,
      delayImpactHours: 2,
      situationId: 'seed-sit-e4-closure',
      causeCategory: 'closure',
    }),
    extraRisk({
      id: 'risk-gps-silent-33',
      type: 'OPS',
      severity: 'HIGH',
      title: 'Cichy GPS — SG-33 bez pingu od 3 h 14 min',
      detail: 'Ostatnia pozycja: E4 na południe od Umeå; brak potwierdzenia postoju i kierowcy.',
      loadCode: 'SG-33',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · ostatni ping: E4 Umeå',
      nextAction: 'Zadzwoń do kierowcy i wymuś pozycję',
      ageHours: 3.2,
    }),
    extraRisk({
      id: 'risk-permit-mismatch-34',
      type: 'DOC',
      severity: 'CRITICAL',
      title: 'Permit mismatch — SG-34 przekracza wysokość i szerokość',
      detail: 'Dokument TRIP nie obejmuje zestawu 21,8 × 3,6 × 4,55 m; READY nie może wyjechać.',
      loadCode: 'SG-34',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · zezwolenie nie pasuje do wymiarów',
      nextAction: 'Wgraj nowe zezwolenie albo zmień zestaw',
      ageHours: 5.5,
    }),
    extraRisk({
      id: 'risk-sequence-18-35',
      type: 'OPS',
      severity: 'HIGH',
      title: 'Sekwencja montażu — T-18 przed SG-35',
      detail: 'T-18 jest na podejściu, ale slot wymaga najpierw dostawy SG-35; grozi przeładunek na placu.',
      loadCode: 'T-18',
      owner: 'HHL',
      meta: 'Odpowiada: H&H Logistics · sekwencja montażu: 35 → 18',
      nextAction: 'Przesuń slot T-18 lub przyspiesz SG-35',
      ageHours: 2.8,
    }),
    extraRisk({
      id: 'risk-weather-wind-35',
      type: 'OPS',
      severity: 'MEDIUM',
      title: 'Okno pogodowe — wiatr boczny 17 m/s dla SG-35',
      detail: 'Załadunek ponadgabarytu możliwy tylko do 18:00; po zmianie prognozy wymagany hold.',
      loadCode: 'SG-35',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · pogoda: wiatr 17 m/s',
      nextAction: 'Potwierdź okno załadunku z placem',
      ageHours: 1.7,
      causeCategory: 'weather',
    }),
    extraRisk({
      id: 'risk-doc-missing-36',
      type: 'DOC',
      severity: 'HIGH',
      title: 'Brak zezwolenia SE — SG-36 T-48',
      detail: 'Brak potwierdzonej ścieżki BK dla masy 27,2 t; załadunek zaplanowany na 25.09.',
      loadCode: 'SG-36',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · dokument PERMIT_SE missing',
      nextAction: 'Wgraj zezwolenie SE i potwierdź trasę',
      ageHours: 4.3,
    }),
    extraRisk({
      id: 'risk-escort-03',
      type: 'OPS',
      severity: 'MEDIUM',
      title: 'Brak eskorty — R-03 niekompletne zasoby',
      detail: 'Do załadunku pozostały 52 h; brak kierowcy, ciągnika i tablicy naczepy.',
      loadCode: 'R-03',
      owner: 'SCX',
      meta: 'Termin uzupełnienia: 24.09 · wymagany pilot',
      nextAction: 'Uzupełnij zasoby i numer pilota',
      ageHours: 2.1,
    }),
  );

  return R;
}

export function buildSeedExceptions(loads: Load[], risks: Risk[]): ExceptionItem[] {
  return risks.map((r) => ({
    id: `ex-${r.id}`,
    severity: r.severity,
    title: r.title,
    owner: r.owner,
    meta: r.meta,
    nextAction: r.nextAction,
    ageHours: r.ageHours,
    loadId: r.loadId,
    code: r.loadId ? loads.find((l) => l.id === r.loadId)?.code : undefined,
  }));
}

export function buildSeedInvoices(loads: Load[]): Invoice[] {
  const delivered = loads.filter((l) => l.status === 'DELIVERED' || l.status === 'UNLOADING').slice(0, 8);
  const linesMatched = delivered.slice(0, 4).map((l) => ({
    loadId: l.id,
    code: l.code,
    expected: l.pricing.costTotal,
    billed: l.pricing.costTotal,
    diff: 0,
  }));
  // Historical submitted bills with real variances (carrier billed ≠ rate card) — diffs computed, not UI-hardcoded.
  const linesDisputed = delivered.slice(4, 8).map((l, i) => {
    const expected = l.pricing.costTotal;
    const billed = expected + (i === 0 ? plnToEurDemo(850) : i === 1 ? -plnToEurDemo(200) : plnToEurDemo(120));
    return { loadId: l.id, code: l.code, expected, billed, diff: billed - expected };
  });
  const sum = (xs: { expected: number; billed: number }[]) => ({
    e: xs.reduce((a, x) => a + x.expected, 0),
    b: xs.reduce((a, x) => a + x.billed, 0),
  });
  const m = sum(linesMatched);
  const d = sum(linesDisputed);
  const feePct = 2.5;
  const feeAmt = Math.round((m.b * feePct) / 100 * 100) / 100;
  const net = Math.round((m.b - feeAmt) * 100) / 100;
  const linesW36 = delivered.slice(0, 3).map((l) => ({
    loadId: l.id,
    code: l.code,
    expected: l.pricing.costTotal,
    billed: l.pricing.costTotal,
    diff: 0,
  }));
  const w36 = sum(linesW36);
  const fee36 = Math.round((w36.b * 2.0) / 100 * 100) / 100;
  const net36 = Math.round((w36.b - fee36) * 100) / 100;
  const linesW39 = delivered.slice(1, 5).map((l) => ({
    loadId: l.id,
    code: l.code,
    expected: l.pricing.costTotal,
    billed: l.pricing.costTotal,
    diff: 0,
  }));
  const w39 = sum(linesW39);
  const fee39 = Math.round((w39.b * feePct) / 100 * 100) / 100;
  const net39 = Math.round((w39.b - fee39) * 100) / 100;
  return [
    {
      id: 'inv-0',
      weekLabel: '2026-W36',
      status: 'MATCHED',
      createdAt: '2026-09-05T15:00:00+02:00',
      expectedTotal: w36.e,
      billedTotal: w36.b,
      lines: linesW36,
      note: 'Factoring wypłacony',
      factoring: {
        selected: true,
        feePercent: 2.0,
        feeAmount: fee36,
        netPayout: net36,
        payoutAt: '2026-09-07T12:00:00+02:00',
        delayValue: 48,
        delayUnit: 'hours',
      },
      payoutStatus: 'FUNDED',
    },
    {
      id: 'inv-1',
      weekLabel: '2026-W37',
      status: 'MATCHED',
      createdAt: '2026-09-12T15:00:00+02:00',
      expectedTotal: m.e,
      billedTotal: m.b,
      lines: linesMatched,
      note: 'Zgodność OK · factoring zaplanowany',
      factoring: {
        selected: true,
        feePercent: feePct,
        feeAmount: feeAmt,
        netPayout: net,
        payoutAt: '2026-09-14T15:00:00+02:00',
        delayValue: 48,
        delayUnit: 'hours',
      },
      payoutStatus: 'SCHEDULED',
    },
    {
      id: 'inv-2',
      weekLabel: '2026-W38',
      status: 'DISPUTED',
      createdAt: '2026-09-19T15:10:00+02:00',
      expectedTotal: d.e,
      billedTotal: d.b,
      lines: linesDisputed,
      note: 'Różnice linia po linii · bez factoringu',
      payoutStatus: 'NONE',
    },
    {
      id: 'inv-3',
      weekLabel: '2026-W39',
      status: 'SUBMITTED',
      createdAt: '2026-09-22T14:00:00+02:00',
      expectedTotal: w39.e,
      billedTotal: w39.b,
      lines: linesW39,
      note: 'SCX wysłał · factoring, czeka na akceptację HHL',
      factoring: {
        selected: true,
        feePercent: feePct,
        feeAmount: fee39,
        netPayout: net39,
        payoutAt: '2026-09-24T14:00:00+02:00',
        delayValue: 48,
        delayUnit: 'hours',
      },
      payoutStatus: 'NONE',
    },
  ];
}

export const SCHEDULE_VERSIONS: ScheduleVersion[] = [
  {
    id: 'sv-ksh-1',
    at: '2026-09-23T00:30:00+02:00',
    by: 'KSH (import)',
    filename: 'KSH_HARMONOGRAM.xlsx',
    added: 50,
    changed: 0,
    removed: 0,
    rejected: 0,
  },
  {
    id: 'sv-1',
    at: '2026-09-01T09:00:00+02:00',
    by: 'Marek KSH',
    filename: 'harmonogram_stegra_v1.xlsx',
    added: 40,
    changed: 0,
    removed: 0,
    rejected: 2,
  },
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    at: '2026-09-22T22:10:00+02:00',
    title: 'Prom Wawel poza planem',
    body: 'Możliwa zmiana godziny odejścia. Plan B: Nova Star.',
    severity: 'CRITICAL',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'risk', entityId: 'risk-1' },
  },
  {
    id: 'n2',
    at: '2026-09-22T18:00:00+02:00',
    title: 'T-48 bez zezwolenia PL',
    body: '2 transporty bez zezwolenia — wgraj przed załadunkiem.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'docs' },
  },
  {
    id: 'n3',
    at: '2026-09-22T16:40:00+02:00',
    title: 'Bufor 50 km Boden',
    body: 'Wjazd w strefę przed placem — odświeżono ETA.',
    severity: 'MEDIUM',
    read: false,
    roleScope: ['HHL', 'KSH', 'SCX'],
    href: { view: 'geo', loadId: 'load-020' },
  },
  {
    id: 'n4',
    at: '2026-09-22T15:12:00+02:00',
    title: 'ETA mniej pewne · SG-12',
    body: 'Brak sygnału 40 min — zakres ETA poszerzony.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'map', loadId: 'load-012' },
  },
  {
    id: 'n5',
    at: '2026-09-22T14:05:00+02:00',
    title: 'Faktura w sporze · W38',
    body: 'Różnica >50 PLN na linii SG-04.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'inv' },
  },
  {
    id: 'n6',
    at: '2026-09-22T12:30:00+02:00',
    title: 'Brak CMR · SG-07',
    body: 'Wgraj CMR przed READY.',
    severity: 'CRITICAL',
    read: false,
    roleScope: ['HHL', 'SCX', 'KSH'],
    href: { view: 'docs', loadId: 'load-007' },
  },
  {
    id: 'n7',
    at: '2026-09-22T11:00:00+02:00',
    title: 'Marża poniżej 12% · SG-15',
    body: 'Sprawdź rozbicie kosztów w finansach.',
    severity: 'MEDIUM',
    read: false,
    roleScope: ['HHL'],
    href: { view: 'fin', tab: 'margin' },
  },
  {
    id: 'n8',
    at: '2026-09-22T09:45:00+02:00',
    title: 'Prom opóźniony · Nova Star',
    body: 'Check-in przesunięty o +2 h.',
    severity: 'MEDIUM',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'risk', entityId: 'risk-1', loadId: 'load-014' },
  },
  {
    id: 'n9',
    at: '2026-09-22T08:20:00+02:00',
    title: 'Brak sygnału · SG-12',
    body: 'Brak pozycji GPS ponad 90 min.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'wf', loadId: 'load-012' },
  },
  {
    id: 'n10',
    at: '2026-09-21T22:00:00+02:00',
    title: 'Import harmonogramu zatwierdzony',
    body: 'harmonogram_stegra_v2.xlsx · +3 / ~2 / −0',
    severity: 'LOW',
    read: false,
    roleScope: ['HHL', 'KSH'],
    href: { view: 'sched' },
  },
  {
    id: 'n11',
    at: '2026-09-21T19:30:00+02:00',
    title: 'Za długi postój na placu',
    body: 'Stegra · Stalverket 20 — przekroczono okno rozładunku.',
    severity: 'MEDIUM',
    read: false,
    roleScope: ['HHL', 'KSH', 'SCX'],
    href: { view: 'geo', entityId: 'gf-11' },
  },
  {
    id: 'n12',
    at: '2026-09-21T16:00:00+02:00',
    title: 'Faktura zaakceptowana · W37',
    body: 'Zgodność OK · factoring zaplanowany.',
    severity: 'LOW',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'inv' },
  },
  {
    id: 'n13',
    at: '2026-09-21T10:15:00+02:00',
    title: 'Brak naczepy · SG-09',
    body: 'Uzupełnij zasoby do T-24.',
    severity: 'HIGH',
    read: false,
    roleScope: ['SCX', 'HHL'],
    href: { view: 'tasks', loadId: 'load-009' },
  },
];


export const INITIAL_WORKFLOW_RUNS: WorkflowRun[] = [
  {
    id: 'wr-1',
    workflowId: 'wf-1',
    at: '2026-09-22T16:40:00+02:00',
    status: 'OK',
    note: 'Mail KSH+SCX — bufor Boden',
    loadId: 'load-020',
  },
  {
    id: 'wr-2',
    workflowId: 'wf-3',
    at: '2026-09-22T14:20:00+02:00',
    status: 'OK',
    note: 'Oznaczono brak sygnału',
    loadId: 'load-012',
  },
];

export const DRIVER_TOKENS: Record<string, string> = {
  'demo-sg14': 'load-020',
  'demo-active': 'load-020',
  'demo-k01': 'load-051',
};


/** Mark loads linked to active FORCE_MAJEURE as delayed and bump ETA by impact hours. */
export function applyForceMajeureDelays(loads: Load[], risks: Risk[]): Load[] {
  const fm = risks.filter(
    (r) =>
      r.type === 'FORCE_MAJEURE' &&
      (r.severity === 'CRITICAL' || r.severity === 'HIGH') &&
      r.loadId,
  );
  if (!fm.length) return loads;
  const byLoad = new Map<string, number>();
  for (const r of fm) {
    if (!r.loadId) continue;
    const h = r.delayImpactHours ?? (r.severity === 'CRITICAL' ? 4 : 2);
    byLoad.set(r.loadId, Math.max(byLoad.get(r.loadId) ?? 0, h));
  }
  return loads.map((l) => {
    const hours = byLoad.get(l.id);
    if (!hours) return l;
    let etaBoden = l.etaBoden;
    if (etaBoden) {
      const t0 = Date.parse(etaBoden);
      if (!Number.isNaN(t0)) {
        etaBoden = new Date(t0 + hours * 3600 * 1000).toISOString();
      }
    }
    return {
      ...l,
      delayed: true,
      status: l.status === 'DELIVERED' ? l.status : l.status === 'SILENT' ? l.status : 'DELAYED',
      etaBoden,
      etaLatestHours: (l.etaLatestHours ?? 0) + hours,
      etaReasons: [...(l.etaReasons ?? []), `Siła wyższa · +${hours} h`].slice(-6),
    };
  });
}
