/** Seed data for WATCH TOWER makieta — loads from KSH_HARMONOGRAM.xlsx (50) + 22 extras (≥72) + corridor entities */
import { etaDuration } from '../lib/etaDuration';
import { getNowMs } from '../lib/frozenNow';
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
  LoadStatus,
} from '../types';
import { positionAlong, PROGRESS_OF, STATUS_TO_STAGE } from '../lib/status';
import rawLoads from './loads.json';
import { applySefsToRoadRate, sefsForLoadDate } from '../lib/sefs';
import { DEMO_FX_META, plnToEurDemo } from '../lib/money/demoFx';
export { DEMO_FX_META } from '../lib/money/demoFx';
import { seedOrders, seedResourcesForIndex } from './seedIdentity';
import { demoSymbolSpec } from '../lib/p7SymbolsDemo';
import { RISK_I18N } from '../i18n/risks';
/** I-0: logika bez danych demo — w lib/seedLogic.ts (używana też w buildzie produkcyjnym bez seed.ts). */
export { applyForceMajeureDelays, buildSeedExceptions } from '../lib/seedLogic';

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
  { id: 'gf-02', name: 'Polferries Gdańsk · Sucharskiego 70', type: 'PORT_OUT', shape: 'circle', lat: 54.40372, lng: 18.6813, radiusM: 800, hysteresisM: 200, samplesRequired: 2, dwellMin: 15, notifyHhl: true, notifyKsh: false, notifyScx: true, active: true, trigger: 'ENTER' },
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
    // ONE-MECH / D-29t: zastąpione silnikiem geofence + DEC-5 + macierz
    enabled: false,
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
    // ONE-MECH / D-29t: I-27 + decyzja + macierz
    enabled: false,
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
    // ONE-MECH / D-29t: detect_silent_vehicles (DB)
    enabled: false,
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
    // ONE-MECH / D-29t: jedno ryzyko FERRY → macierz + decyzja
    enabled: false,
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
    // ONE-MECH / D-29t: DATY-67 + decyzja + I-10
    enabled: false,
    runCount: 9,
  },
  {
    id: 'wf-6',
    name: 'Potwierdzenie dostawy',
    description: 'Rozładunek → zadanie dla przewoźnika: wgraj POD w 24 h, przypomnienie po 18 h',
    trigger: 'UNLOADED',
    condition: 'true',
    actions: ['task_pod_24h', 'remind_18h'],
    // ONE-MECH / D-29t: dokumenty + SMS 9
    enabled: false,
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
    // ONE-MECH / D-29t: macierz MONEY (faktury) — bez osobnego crona wf
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
    // ONE-MECH / D-29t: ryzyko FERRY + decyzja plan B
    enabled: false,
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
    // ONE-MECH / D-29t: ryzyko ROAD_SE + macierz (II-6)
    enabled: false,
    runCount: 3,
  },
  {
    id: 'wf-10',
    name: 'Akceptacja faktoringu',
    description:
      'HHL akceptuje ofertę faktoringu po zgodności faktury → wypłata zaplanowana, wpis w dzienniku i powiadomienie SCX',
    trigger: 'FACTORING_ACCEPTED',
    condition: '{"==":[{"var":"invoice.status"},"MATCHED"]}',
    actions: ['set_payout_scheduled', 'audit_factoring', 'notify_scx'],
    // ONE-MECH / D-29t: macierz MONEY + ścieżka faktoring w Finance
    enabled: false,
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
    // ONE-MECH / D-29t: macierz SYSTEM + resource_deadlines (0073)
    enabled: false,
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
    // ONE-MECH / D-29t: macierz MONEY (tylko HHL) — bez dubla wf
    enabled: false,
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

/**
 * Additional corridor movements deliberately cover operational failure modes in P7.
 * audyt-C C-12: `itemType` = symbol rodzaju jak w pliku KSH (prefiks kodu), bez opisów po angielsku.
 */
const EXTRA_LOAD_SPECS: ExtraLoadSpec[] = [
  {
    code: 'SG-31',
    itemType: 'SG',
    status: 'IN_TRANSIT_SE',
    dims: { lengthM: 20.4, widthM: 3.25, heightM: 4.15, weightT: 28.8 },
    plannedLoadDate: '2026-09-21',
    plannedDeliverDate: '2026-09-25',
    sequenceOrder: 63,
  },
  {
    code: 'SG-32',
    itemType: 'SG',
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
    itemType: 'T',
    status: 'IN_TRANSIT_SE',
    dims: { lengthM: 16.2, widthM: 3.35, heightM: 4.25, weightT: 31.2 },
    plannedLoadDate: '2026-09-22',
    plannedDeliverDate: '2026-09-25',
    sequenceOrder: 65,
  },
  {
    code: 'SG-33',
    itemType: 'SG',
    status: 'SILENT',
    dims: { lengthM: 19.6, widthM: 2.95, heightM: 3.7, weightT: 24.1 },
    plannedLoadDate: '2026-09-21',
    plannedDeliverDate: '2026-09-25',
    sequenceOrder: 66,
    silentMinutes: 194,
  },
  {
    code: 'SG-34',
    itemType: 'SG',
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
    itemType: 'T',
    status: 'APPROACHING_SITE',
    dims: { lengthM: 17.4, widthM: 2.9, heightM: 3.45, weightT: 22.7 },
    plannedLoadDate: '2026-09-21',
    plannedDeliverDate: '2026-09-25',
    sequenceOrder: 69,
    sequenceRisk: true,
  },
  {
    code: 'SG-35',
    itemType: 'SG',
    status: 'DELAYED',
    dims: { lengthM: 15.7, widthM: 3.0, heightM: 3.6, weightT: 19.5 },
    plannedLoadDate: '2026-09-18',
    plannedDeliverDate: '2026-09-23',
    sequenceOrder: 68,
    delayed: true,
  },
  {
    code: 'SG-36',
    itemType: 'SG',
    status: 'DOC_MISSING',
    dims: { lengthM: 18.1, widthM: 3.25, heightM: 4.05, weightT: 27.2 },
    plannedLoadDate: '2026-09-25',
    plannedDeliverDate: '2026-10-01',
    sequenceOrder: 70,
    docMissing: true,
  },
  {
    code: 'R-03',
    itemType: 'R',
    status: 'RESOURCES_PENDING',
    dims: { lengthM: 14.9, widthM: 3.15, heightM: 3.9, weightT: 25.8 },
    plannedLoadDate: '2026-09-28',
    plannedDeliverDate: '2026-10-02',
    sequenceOrder: 71,
  },
  {
    code: 'SS-08',
    itemType: 'SS',
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
    /* audyt-B B-06 (E33): w demo żadna dopłata nie jest jeszcze dodana — wiersz „Dopłaty” = 0 (suma listy dopłat) */
    const costExtras = 0;
    const revExtras = 0;
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

/**
 * audyt-B B-06 (E33, 08.10): „Dopłaty · postój, anulowanie” = suma dopłat z listy pod tabelą. W demo żadna dopłata
 * nie jest dodana ani przyjęta (lista tylko podpowiada), więc wiersz ma 0,00 po obu stronach; „Razem” bez tych kwot.
 */
/**
 * P11 pkt 7 partia 5 (paczka B: w panelu › Ceny wiersze nie sumowały się do „Razem”, a opłata paliwowa przy „×1,05”
 * wynosiła ok. 1 % frachtu): opłata paliwowa = fracht × (mnożnik − 1) z tej samej migawki co znacznik „t38 · ×1,05”
 * (tydzień dnia załadunku, `sefsForLoadDate` — jak w `buildLoadMoney`), a „Razem” = fracht + opłata paliwowa + dopłaty.
 * `marginBelow` (transporty „poniżej progu”): fracht kosztu dobrany tak, żeby marża wyszła ok. 9 %.
 */
function consistentDemoPricing(p: Load['pricing'], loadDate: string, marginBelow?: number): Load['pricing'] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const mult = sefsForLoadDate(loadDate).appliedMult;
  const fuelOf = (base: number) => r2(applySefsToRoadRate(base, mult) - base);
  const revSefs = fuelOf(p.revBase);
  const revTotal = r2(p.revBase + revSefs + (p.revExtras ?? 0));
  const costBase = marginBelow != null ? r2((revTotal * (1 - marginBelow) - (p.costExtras ?? 0)) / mult) : p.costBase;
  const costSefs = fuelOf(costBase);
  const costTotal = r2(costBase + costSefs + (p.costExtras ?? 0));
  const margin = r2(revTotal - costTotal);
  const marginPct = revTotal ? margin / revTotal : 0;
  return {
    ...p, costBase, costSefs, revSefs, costBaf: costSefs, revBaf: revSefs, costTotal, revTotal, margin, marginPct,
    belowThreshold: marginBelow != null ? true : p.belowThreshold,
  };
}

function withoutDemoExtras(p: Load['pricing']): Load['pricing'] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const costTotal = r2(p.costTotal - (p.costExtras ?? 0));
  const revTotal = r2(p.revTotal - (p.revExtras ?? 0));
  const margin = r2(revTotal - costTotal);
  return { ...p, costExtras: 0, revExtras: 0, costTotal, revTotal, margin, marginPct: revTotal ? margin / revTotal : 0 };
}

/**
 * wyglad/W-demo (audyt 17.10, sekcja 15 N6): daty transportów demo zgodne z dniem demo 23.09.2026.
 * Transporty w drodze, na placu i dostarczone z pierwotnego zestawu miały załadunek w październiku (w przyszłości),
 * np. „Śledzenie trwa od 01.10” przy statusie „Prom”. Załadunek liczony wstecz od 23.09 według etapu
 * (dzień załadunku = dzień 0), dostawa wg planu KSH: załadunek + 5 dni (dostarczone: + 4, już po dostawie);
 * dostawa w sobotę lub niedzielę przechodzi na piątek. Załadunki tylko w dni robocze (23.09 = środa):
 * w drodze PL i załadunek — dziś; port PL i prom — wczoraj (rejs dziś 18:00); Droga SE i brak GPS — poniedziałek;
 * opóźnione, na placu i rozładunek — piątek 18.09 (okno dostawy dziś); dostarczone — 04.09–18.09.
 * Transporty przed załadunkiem — bez zmian; dodatkowe (EXTRA_LOAD_SPECS) mają daty wpisane wprost.
 */
const DEMO_DAY_MS = Date.parse('2026-09-23T12:00:00Z');
const DAYS_SINCE_LOAD: Partial<Record<LoadStatus, readonly number[]>> = {
  LOADING: [0],
  IN_TRANSIT_PL: [0],
  AT_PORT: [1],
  ON_FERRY: [1],
  IN_TRANSIT_SE: [2],
  DELAYED: [5],
  SILENT: [2],
  APPROACHING_SITE: [5],
  UNLOADING: [5],
  DELIVERED: [19, 16, 13, 12, 9, 6, 5],
};
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Dostawa w sobotę lub niedzielę → piątek (plan KSH w dni robocze). */
const weekdayBack = (ms: number) => {
  const wd = new Date(ms).getUTCDay();
  return wd === 6 ? ms - 864e5 : wd === 0 ? ms - 2 * 864e5 : ms;
};

function withDemoDates(l: Load, nth: number): Load {
  const back = DAYS_SINCE_LOAD[l.status];
  if (!back) return l;
  const loadMs = DEMO_DAY_MS - back[nth % back.length] * 864e5;
  const deliverMs = weekdayBack(loadMs + (l.status === 'DELIVERED' ? 4 : 5) * 864e5);
  const load = isoDay(loadMs);
  const deliver = isoDay(deliverMs);
  return {
    ...l,
    plannedLoadDate: load,
    plannedDeliverDate: deliver,
    awizacja: {
      ...l.awizacja,
      loadWindowStart: `${load}T06:00:00Z`,
      loadWindowEnd: `${load}T14:00:00Z`,
      unloadWindowStart: `${deliver}T07:00:00Z`,
      unloadWindowEnd: `${deliver}T15:00:00Z`,
    },
    etaBoden: null,
    /* dostarczone: rozładunek w dniu planu (co trzeci — następnego dnia rano, po terminie; terminowość w Kokpicie KSH);
       rozładunek (UNLOADING, kafelek „Dostarczone”): dziś 13:50, przed zegarem demo 16:32 */
    ...(l.status === 'DELIVERED'
      ? { unloadedAt: nth % 3 === 2 ? `${isoDay(deliverMs + 864e5)}T09:40:00+02:00` : `${deliver}T11:20:00+02:00` }
      : l.status === 'UNLOADING' ? { unloadedAt: `${deliver}T13:50:00+02:00` } : {}),
  };
}

/** Pierwotny zestaw z datami zgodnymi z dniem demo (licznik osobno dla każdego statusu). */
function redatedRawLoads(): Load[] {
  const seen = new Map<LoadStatus, number>();
  return (rawLoads as unknown as Load[]).map((l) => {
    const n = seen.get(l.status) ?? 0;
    seen.set(l.status, n + 1);
    return withDemoDates(l, n);
  });
}

export function buildSeedLoads(): Load[] {
  /* audyt 17.10 (N6): kolejność jak w pliku KSH — po dacie załadunku (przy tej samej dacie — pozycja w pliku) */
  const sourceLoads = [...redatedRawLoads(), ...buildExtraLoads()]
    .sort((a, b) => a.plannedLoadDate.localeCompare(b.plannedLoadDate) || (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
  return sourceLoads.map((l, idx) => {
    const progress = PROGRESS_OF[l.status] ?? l.progress;
    const pos = positionAlong(progress);
    // Stress: force a few READY seeds that lack cover to DOC_MISSING / keep TRIP gaps
    let status = l.status;
    let docMissing = l.docMissing;
    let permit = l.permit ? { ...l.permit } : undefined;
    // Below-threshold stress (≥3 loads) — actionable in Finance; partia 5: wiersze sumują się do „Razem”
    const pricing = consistentDemoPricing(withoutDemoExtras(l.pricing), l.plannedLoadDate,
      ['SG-15', 'SG-22', 'SS-02', 'SG-08'].includes(l.code) ? 0.09 : undefined);

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

    /* audyt-B B-13 (16.10, 01:13 pkt 1; E32 pkt 7): zestaw z ładunkiem z tabeli symboli — jedno źródło z oknem Awizacja.
       Wymiary przy transporcie = wiersz tabeli (Przegląd pokazuje „z tabeli HHL (SG)”), zezwolenie wystawione na ten zestaw
       (ten sam wynik sprawdzenia zezwolenia co wcześniej). Symbole spoza tabeli (R, D) — bez zmian. */
    const sym = demoSymbolSpec(l);
    let resources = sym ? { ...l.resources, setLengthM: sym.set.l, setWidthM: sym.set.w, setHeightM: sym.set.h } : l.resources;
    /* audyt-B B-14 (E6, E32 pkt 5; 16.10 13:34–13:58): jeden transport w Szwecji z przepięciem naczepy — odcinek PL
       (Śrem → prom) i odcinek SE (prom → Boden), dwóch kierowców z numerami i dwa ciągniki; naczepa jedna. T-01 jest
       na „Drodze SE”, więc „Zadzwoń”, karta na telefonie i kolumna „Telefon kierowcy” pokazują kierowcę SE. */
    if (l.code === 'T-01') {
      resources = {
        ...resources,
        trailerSwap: true,
        driverPhoneCountry: 'PL',
        driverDeliveryName: 'Henrik Lund',
        driverDeliveryPhone: '+46701740615',
        driverDeliveryPhoneCountry: 'SE',
        tractorDeliveryPlate: 'BDN 417',
      };
    }
    if (sym && permit) permit = { ...permit, zestaw: { ...permit.zestaw, L: sym.set.l, W: sym.set.w, H: sym.set.h } };

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
      resources,
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

/**
 * Zdarzenia demo w kolejności i przed zegarem demo 23.09, 16:32 (audyt 17.10, N6): import pliku KSH 01.09 (wersja 1),
 * zasoby 2 dni przed załadunkiem (najpóźniej 22.09), załadunek, rejs wieczorem w dniu załadunku (prom dziś — 15:30),
 * rozładunek z `unloadedAt`, brak pingu 90 min po ostatniej pozycji, brak zezwolenia 2 dni przed załadunkiem.
 */
const DEMO_CLOCK_MS = Date.parse('2026-09-23T14:32:00Z');
const atLocal = (day: string, hm: string) => `${day}T${hm}:00+02:00`;
const notAfter = (iso: string, capIso: string) => (Date.parse(iso) > Date.parse(capIso) ? capIso : iso);
const dayBefore = (day: string, n: number) => isoDay(Date.parse(`${day}T12:00:00Z`) - n * 864e5);
const hmOf = (ms: number) => new Date(ms + 2 * 3600e3).toISOString().slice(11, 16);

export function buildSeedEvents(loads: Load[]): LoadEvent[] {
  const events: LoadEvent[] = [];
  let n = 0;
  for (const l of loads) {
    events.push({
      id: `ev-${++n}`,
      loadId: l.id,
      type: 'SCHEDULE_IMPORTED',
      at: '2026-09-01T09:00:00+02:00',
      actor: 'system',
      note: `KSH import ${l.code}`,
    });
    if (!['PLANNED', 'RESOURCES_PENDING'].includes(l.status)) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'RESOURCES_ASSIGNED',
        at: notAfter(atLocal(dayBefore(l.plannedLoadDate, 2), '10:00'), '2026-09-22T10:00:00+02:00'),
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
        /* audyt-B B-08 (E17): automat ze źródłem pozycji — w Historii „GPS emtrack”, nie „Kierowca (aplikacja)” */
        actor: 'system',
        payload: { source: 'GPS', provider: 'emtrack' },
      });
    }
    if (
      ['ON_FERRY', 'AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING', 'DELIVERED', 'DELAYED', 'SILENT'].includes(
        l.status,
      )
    ) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'ON_FERRY',
        at: l.status === 'ON_FERRY' ? '2026-09-23T15:30:00+02:00' : atLocal(l.plannedLoadDate, '18:00'),
        actor: 'system',
        payload: { source: 'AIS' },
      });
    }
    if (['UNLOADING', 'DELIVERED'].includes(l.status)) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'UNLOADED',
        at: l.unloadedAt ?? atLocal(l.plannedDeliverDate, '12:00'),
        actor: 'system',
        payload: { source: 'GPS', provider: 'emtrack' },
      });
    }
    if (l.status === 'SILENT') {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'POSITION_STALE',
        /* 90 min po ostatniej pozycji (zegar demo − `silentMinutes`) */
        at: atLocal('2026-09-23', hmOf(DEMO_CLOCK_MS - ((l.silentMinutes ?? 95) - 90) * 60_000)),
        actor: 'system',
        note: 'Brak pingu >90 min',
      });
    }
    if (l.docMissing) {
      events.push({
        id: `ev-${++n}`,
        loadId: l.id,
        type: 'DOC_MISSING',
        at: notAfter(atLocal(dayBefore(l.plannedLoadDate, 2), '06:05'), '2026-09-23T06:05:00+02:00'),
        actor: 'workflow:wf-2',
        note: 'Brak zezwolenia PL',
      });
    }
  }
  return events;
}

/**
 * Dokumenty demo (E31, E41; audyt-C C-03…C-06):
 * - przy transporcie tylko zezwolenia PL i SE oraz „CMR z podpisem odbiorcy” — ten dopiero po „Dostarczone”
 *   (bez CMR z załadunku, POD, rysunku i zdjęć mocowania; decyzja 1 B 08.10, 19:11, 19:51);
 * - nazwa pliku z kodem transportu: „SG-01_Zezwolenie_PL.pdf”, „SG-01_CMR_podpisany.pdf”;
 * - polisy to pliki firmy („cała firma”), dodawane raz: polisa SCX (widzą HHL i SCX) i Polisa HHL (widzą HHL i KSH)
 *   — pytanie 3 B: KSH widzi Polisę HHL, SCX swoją, HHL obie.
 */
export function buildSeedDocuments(loads: Load[]): Document[] {
  const docs: Document[] = [];
  let n = 0;
  const cats = [
    { cat: 'PERMIT_PL' as const, file: 'Zezwolenie_PL' },
    { cat: 'PERMIT_SE' as const, file: 'Zezwolenie_SE' },
    { cat: 'CMR' as const, file: 'CMR_podpisany' },
  ];
  /* jeden dostarczony transport bez podpisanego CMR — przykład braku po „Dostarczone” */
  const delivered = loads.filter((l) => ['DELIVERED', 'READY_TO_INVOICE', 'INVOICED'].includes(l.status));
  const cmrMissing = delivered.length > 1
    ? [...delivered].sort((a, b) => (a.plannedDeliverDate ?? '').localeCompare(b.plannedDeliverDate ?? '') || a.code.localeCompare(b.code)).at(-1)!.id
    : null;
  for (const l of loads) {
    for (const c of cats) {
      const late = ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING'].includes(l.status);
      let status: Document['status'] = 'MISSING';
      let uploaded: string | null = null;
      let permitFits: boolean | null = null;
      let deadline = `${l.plannedLoadDate}T06:00:00+02:00`;
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
      } else {
        /* CMR z podpisem odbiorcy: po „Dostarczone”, termin 24 h (Opcje › Terminy dokumentów) */
        deadline = `${l.plannedDeliverDate}T23:59:00+02:00`;
        if (delivered.some((d) => d.id === l.id) && l.id !== cmrMissing) {
          /* wyglad/W-naprawy (F7, A4): CMR wgrany 2 h po rozładunku — jak w automacie C17 (CMR po „Dostarczone”);
             wcześniej godzina z planu (16:30 dnia planowej dostawy), czasem przed rozładunkiem albo po zegarze demo */
          const at = l.unloadedAt ? Date.parse(l.unloadedAt) + 2 * 3600e3 : Date.parse(`${l.plannedDeliverDate}T16:30:00+02:00`);
          if (at <= getNowMs()) {
            status = 'UPLOADED';
            uploaded = new Date(at).toISOString();
          }
        }
      }
      docs.push({
        id: `doc-${++n}`,
        loadId: l.id,
        category: c.cat,
        name: `${l.code}_${c.file}.pdf`,
        uploadedAt: uploaded,
        deadline,
        status,
        permitFits,
        visibleTo: ['HHL', 'KSH', 'SCX'],
      });
    }
  }
  docs.push(
    {
      id: 'doc-policy-scx',
      loadId: '',
      category: 'INSURANCE',
      name: 'Polisa_OCP_SCX.pdf',
      uploadedAt: '2026-08-01T10:00:00+02:00',
      deadline: null,
      status: 'UPLOADED',
      permitFits: null,
      visibleTo: ['HHL', 'SCX'],
    },
    {
      id: 'doc-policy-hhl',
      loadId: '',
      category: 'INSURANCE',
      name: 'Polisa_HHL.pdf',
      uploadedAt: '2026-08-01T10:00:00+02:00',
      deadline: null,
      status: 'UPLOADED',
      permitFits: null,
      visibleTo: ['HHL', 'KSH'],
    },
  );
  return docs;
}

export function buildSeedMessages(loads: Load[]): LoadMessage[] {
  /* audyt 17.10 (N6, F7): te same transporty co dotąd (pierwsze w pliku), rozmowa o awizacji przed załadunkiem —
     2 dni przed załadunkiem, najpóźniej 21.09 11:00 */
  return [...loads].sort((a, b) => fileOrderOf(a.code) - fileOrderOf(b.code)).slice(0, 12).map((l, i) => ({
    id: `msg-${i + 1}`,
    loadId: l.id,
    at: notAfter(atLocal(dayBefore(l.plannedLoadDate, 2), '11:00'), '2026-09-21T11:00:00+02:00'),
    author: i % 2 === 0 ? 'Anna Ops' : 'Erik Dispatch',
    org: (i % 2 === 0 ? 'HHL' : 'SCX') as LoadMessage['org'],
    text:
      i % 2 === 0
        ? `Proszę potwierdzić awizację dla ${l.code}.`
        : `Awizacja potwierdzona, rejs ${l.ferry.vessel ?? 'TBD'}.`,
  }));
}

/** Pozycja transportu w pliku demo (przed sortowaniem po dacie załadunku, N6). */
let fileOrder: Map<string, number> | null = null;
function fileOrderOf(code: string): number {
  if (!fileOrder) fileOrder = new Map([...(rawLoads as unknown as Load[]), ...buildExtraLoads()].map((l, i) => [l.code, i]));
  return fileOrder.get(code) ?? Number.MAX_SAFE_INTEGER;
}

export function buildSeedRisks(sortedLoads: Load[]): Risk[] {
  /* audyt 17.10 (N6): sprawy demo przy tych samych transportach co przed sortowaniem po dacie (decyzje demo SG-09, SG-18,
     SG-10 mają kartę; liczba w menu = liczba kart) — przydział według pozycji w pliku, nie według kolejności Harmonogramu */
  const loads = [...sortedLoads].sort((a, b) => fileOrderOf(a.code) - fileOrderOf(b.code));
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
      title: `Brak zezwolenia — załadunek za ${18 + i * 14}\u00a0h`,
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
      title: `Prognoza przyjazdu poza oknem o ${etaDuration(mins)}`,
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
    title: 'Rejs 24.09.2026 · prognoza fali 2,9 m, porywy 19 m/s',
    detail: '3 transporty na tym rejsie. Alternatywa: Gdynia–Karlskrona',
    loadId: ferry?.id,
    owner: 'HHL',
    meta: '3 transporty na tym rejsie. Alternatywa: Gdynia–Karlskrona',
    nextAction: 'Włącz Plan B / powiadom SCX',
    ageHours: 0.67,
    ferryPlanB: ['Nova Star jutro 11:00', 'Gdynia–Karlskrona', 'Postój w Gdańsku +12 h'],
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
    title: 'Siła wyższa — sztorm Bałtyk · rejs 24.09.2026 · +12 h',
    detail: 'Armator wstrzymuje odejście przy fali >3 m. Transporty w oknie promu.',
    loadId: ferryLoad?.id,
    owner: 'HHL',
    meta: 'Odpowiada: H&H Logistics · przyczyna: sztorm / force majeure promu',
    nextAction: 'Plan B / nowego slotu na 25.09.2026',
    ageHours: 0.8,
    delayImpactHours: 12,
    causeCategory: 'storm',
    ferryPlanB: ['Nova Star jutro 11:00', 'Gdynia–Karlskrona', 'Postój w Gdańsku +12 h'],
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
    detail: 'Wymagany nowy certyfikat przed 03.10.2026',
    owner: 'SCX',
    meta: 'Wymagany nowy certyfikat przed 03.10.2026',
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
      title: 'Prom anulowany — M/F Nova Star · 24.09.2026',
      detail: 'Armator anulował odejście; 1 transport bez potwierdzonego slotu na Nynäshamn.',
      loadCode: 'SG-32',
      owner: 'HHL',
      meta: 'Odpowiada: H&H Logistics · status armatora: anulowany',
      nextAction: 'Przenieś na Wawel / potwierdź Plan B',
      ageHours: 1.2,
      ferryPlanB: ['Wawel 25.09.2026, 20:00', 'Gdynia–Karlskrona', 'Postój w Gdańsku +24 h'],
    }),
    extraRisk({
      id: 'risk-e4-closure',
      type: 'ROAD_SE',
      severity: 'CRITICAL',
      title: 'Högakustenbron (E4) zamknięty — porywy 31 m/s',
      detail: 'Trafikverket zamknął most na E4; SCX wybiera objazd przez Kramfors i Sandöbron albo postój do końca zamknięcia.',
      loadCode: 'T-17',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · Högakustenbron (E4) zamknięty · źródło: Trafikverket',
      nextAction: 'Zdecyduj: objazd czy postój',
      ageHours: 0.4,
      delayImpactHours: 2,
      situationId: 'seed-sit-e4-closure',
      causeCategory: 'closure',
    }),
    extraRisk({
      id: 'risk-gps-silent-33',
      type: 'OPS',
      severity: 'HIGH',
      title: 'Cichy GPS — bez pingu od 3 h 14 min',
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
      /* audyt-A A-07 (E41): nazwę transportu wstawia ekran przed tytułem — w tytule bez kodu */
      title: 'Zezwolenie niezgodne z zestawem — przekroczona wysokość i szerokość',
      detail: 'Zezwolenie „Trasa” nie obejmuje zestawu 21,8 × 3,6 × 4,55 m; transport nie przejdzie do „Gotowy”.',
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
      title: 'Okno pogodowe — wiatr boczny 17 m/s',
      detail: 'Załadunek ponadgabarytu możliwy tylko do 18:00; po zmianie prognozy wymagany postój.',
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
      title: 'Brak zezwolenia SE',
      detail: 'Brak potwierdzonej ścieżki BK dla masy 27,2 t; załadunek zaplanowany na 25.09.2026.',
      loadCode: 'SG-36',
      owner: 'SCX',
      meta: 'Odpowiada: Scandinavian Express · brak zezwolenia SE',
      nextAction: 'Wgraj zezwolenie SE i potwierdź trasę',
      ageHours: 4.3,
    }),
    extraRisk({
      id: 'risk-escort-03',
      type: 'OPS',
      severity: 'MEDIUM',
      title: 'Brak eskorty — niekompletne zasoby',
      detail: 'Do załadunku pozostały 52 h; brak kierowcy, ciągnika i tablicy naczepy.',
      loadCode: 'R-03',
      owner: 'SCX',
      meta: 'Termin uzupełnienia: 24.09.2026 · wymagany pilot',
      nextAction: 'Uzupełnij zasoby i numer pilota',
      ageHours: 2.1,
    }),
  );

  return R.map(withSeedRiskKeys);
}

/** A6-T1: klucze słownika (src/i18n/risks.ts) dla ryzyk demo; PL z klucza == dotychczasowy `title`/`meta`. */
function withSeedRiskKeys(r: Risk): Risk {
  const PL = RISK_I18N.pl;
  const owner = (m: string | undefined) => {
    const hit = /^Odpowiada: ([^·]+)$/.exec(m ?? '');
    return hit ? { metaKey: 'risk_meta_owner', metaParams: { name: hit[1] } } : {};
  };
  let k: Partial<Risk> = {};
  const n = (re: RegExp) => re.exec(r.title) ?? [];
  if (r.id.startsWith('risk-permit-') && !r.id.startsWith('risk-permit-mismatch')) {
    k = { titleKey: 'rk_seed_permit', titleParams: { h: Number(n(/za (\d+)[ \u00a0]h/)[1]) }, ...owner(r.meta) };
  } else if (r.id.startsWith('risk-eta-')) {
    k = { titleKey: 'rk_seed_eta', titleParams: { d: n(/poza oknem o (.+)$/)[1] ?? '' } };
  } else if (r.id === 'risk-ferry') {
    k = { titleKey: 'rk_seed_ferry', titleParams: { wave: 2.9, gust: 19 } };
  } else if (r.id === 'risk-seq') {
    const m = n(/: (\S+) przyjedzie po (\S+)$/);
    k = { titleKey: 'rk_seed_seq', titleParams: { a: m[1], b: m[2] } };
  } else {
    const slug = r.id.replace(/^risk-/, '').replace(/-\d+$/, (x) => (/^risk-(permit|res|eta)-\d+$/.test(r.id) ? '' : x)).replace(/-/g, '_');
    if (PL[`rk_seed_${slug}`] !== undefined) k = { titleKey: `rk_seed_${slug}` };
  }
  if (!k.metaKey && r.meta) {
    const slug = (k.titleKey ?? '').replace(/^rk_seed_/, '');
    if (slug && PL[`rk_seed_${slug}_meta`] !== undefined) k.metaKey = `rk_seed_${slug}_meta`;
    else Object.assign(k, owner(r.meta));
  }
  return { ...r, ...k };
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
      note: 'Zgodność OK · faktoring zaplanowany',
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
      note: 'Różnice pozycja po pozycji · bez faktoringu',
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
      note: 'SCX wysłał · faktoring, czeka na akceptację HHL',
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

/**
 * Powiadomienia demo (E41, E5; audyt-A A-01, A-02, F-02, F-03): tytuł to „co się stało” bez kodu transportu —
 * nazwę według firmy wstawia dzwonek z `loadId` (HHL „kod · nr HHL”, SCX „kod · nr SCX”, KSH sam kod).
 * Każdy wpis prowadzi do transportu, którego dotyczy: brak CMR — dostarczony bez podpisanego CMR (SG-23),
 * brak sygnału — T-05 (cisza 95 min), brak naczepy — SG-09 (zasoby niekompletne), marża — SG-15.
 * KSH nie dostaje zadań przewoźnika (CMR); wpis Stref tylko dla HHL (E34 — Strefy ma tylko HHL).
 */
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
    title: 'Brak zezwolenia PL',
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
    href: { view: 'sched', loadId: 'load-020' },
  },
  {
    id: 'n4',
    at: '2026-09-22T15:12:00+02:00',
    title: 'ETA mniej pewne',
    body: 'Brak sygnału 40 min — zakres ETA poszerzony.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'map', loadId: 'load-015' },
  },
  {
    id: 'n5',
    at: '2026-09-22T14:05:00+02:00',
    title: 'Faktura w sporze · t38',
    body: 'Różnica ponad 50 EUR na pozycji SG-04.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'inv' },
  },
  {
    id: 'n6',
    at: '2026-09-22T12:30:00+02:00',
    title: 'Brak CMR',
    body: 'Wgraj CMR z podpisem odbiorcy — potem „Gotowe do fakturowania”.',
    severity: 'CRITICAL',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'docs', loadId: 'load-034' },
  },
  {
    id: 'n7',
    at: '2026-09-22T11:00:00+02:00',
    title: 'Marża poniżej progu 4%',
    body: 'Sprawdź rozbicie kosztów w finansach.',
    severity: 'MEDIUM',
    read: false,
    roleScope: ['HHL'],
    loadId: 'load-022',
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
    title: 'Brak sygnału',
    body: 'Brak pozycji GPS ponad 90 min.',
    severity: 'HIGH',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'wf', loadId: 'load-015' },
  },
  {
    id: 'n10',
    at: '2026-09-21T22:00:00+02:00',
    title: 'Import harmonogramu zatwierdzony',
    kind: 'SCHEDULE_IMPORTED',
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
    roleScope: ['HHL'],
    href: { view: 'geo', entityId: 'gf-11' },
  },
  {
    id: 'n12',
    at: '2026-09-21T16:00:00+02:00',
    title: 'Faktura zaakceptowana · t37',
    kind: 'INVOICE_ACCEPTED',
    body: 'Zgodność OK · faktoring zaplanowany.',
    severity: 'LOW',
    read: false,
    roleScope: ['HHL', 'SCX'],
    href: { view: 'inv' },
  },
  {
    id: 'n13',
    at: '2026-09-21T10:15:00+02:00',
    title: 'Brak naczepy',
    body: 'Uzupełnij zasoby przed załadunkiem.',
    severity: 'HIGH',
    read: false,
    roleScope: ['SCX', 'HHL'],
    href: { view: 'tasks', loadId: 'load-013' },
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
    loadId: 'load-015',
  },
];

export const DRIVER_TOKENS: Record<string, string> = {
  'demo-sg14': 'load-020',
  'demo-active': 'load-020',
  'demo-k01': 'load-051',
};
