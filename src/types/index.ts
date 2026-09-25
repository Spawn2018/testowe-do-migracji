export type Locale = 'pl' | 'en' | 'sv';
export type OrgKind = 'HHL' | 'KSH' | 'SCX';
export type RoleId = 'HHL' | 'KSH' | 'SCX';

export type LoadStatus =
  | 'PLANNED'
  | 'RESOURCES_PENDING'
  | 'READY'
  | 'LOADING'
  | 'IN_TRANSIT_PL'
  | 'AT_PORT'
  | 'ON_FERRY'
  | 'IN_TRANSIT_SE'
  | 'APPROACHING_SITE'
  | 'UNLOADING'
  | 'DELIVERED'
  | 'DELAYED'
  | 'SILENT'
  | 'DOC_MISSING';

export type CorridorStage =
  | 'PLAN'
  | 'LOADING'
  | 'TO_PORT'
  | 'GDANSK'
  | 'FERRY'
  | 'APPROACH'
  | 'SE_ROAD'
  | 'SITE'
  | 'DELIVERED';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskType = 'FERRY' | 'ROAD_SE' | 'DOC' | 'OPS' | 'FORCE_MAJEURE';
export type DocCategory =
  | 'PERMIT_PL'
  | 'PERMIT_SE'
  | 'INSURANCE'
  | 'CMR'
  | 'POD'
  | 'LASHING_PHOTOS'
  | 'DRAWING'
  | 'INVOICE';

export type GeofenceType =
  | 'LOADING'
  | 'PORT_OUT'
  | 'PRE_PORT'
  | 'PORT_IN'
  | 'CHECKPOINT'
  | 'PRE_ARRIVAL'
  | 'SITE'
  | 'REST';

export interface Organization {
  id: string;
  kind: OrgKind;
  name: string;
}

export interface DemoUser {
  id: string;
  orgId: string;
  name: string;
  email: string;
  roleLabel: string;
}

export interface Dimensions {
  lengthM: number;
  widthM: number;
  heightM: number;
  weightT: number;
}

export interface LoadResources {
  driverName: string | null;
  driverPhone: string | null;
  tractorPlate: string | null;
  trailerPlate: string | null;
  escort: boolean;
  escortPlate: string | null;
  setLengthM: number | null;
  setWidthM: number | null;
  setHeightM: number | null;
  setWeightT: number | null;
}

export interface Awizacja {
  loadWindowStart: string | null;
  loadWindowEnd: string | null;
  unloadWindowStart: string | null;
  unloadWindowEnd: string | null;
  confirmed: boolean;
}

export interface FerryBooking {
  vessel: 'Wawel' | 'Nova Star' | null;
  departureAt: string | null;
  arrivalAt: string | null;
  bookingRef: string | null;
  status: 'NONE' | 'BOOKED' | 'CHECKED_IN' | 'ONBOARD' | 'LANDED' | 'CANCELLED' | 'DELAYED';
}

export interface LoadPricing {
  /** Road freight base (pre-SEFS) */
  costBase: number;
  revBase: number;
  /** SEFS component = roadWithSefs - roadBase (can be negative) */
  costSefs: number;
  revSefs: number;
  /** Legacy alias kept for UI: costSefs */
  costBaf: number;
  revBaf: number;
  costExtras: number;
  revExtras: number;
  ferryEco: number;
  costTotal: number;
  revTotal: number;
  margin: number;
  marginPct: number;
  belowThreshold: boolean;
  currency: 'EUR' | 'PLN';
  /** SEFS snapshot on load */
  baf_multiplier: number;
  baf_source_week: string;
  price_sek: number;
  price_pln: number;
  mult_sek: number;
  mult_pln: number;
  scxRateId?: string;
  scxPozycja?: string;
  scxUwagi?: string | null;
  scxPcsPerLoad?: number | string;
  scxTransportsScenario?: number;
  /** M2 — dane v2: poziom, obie wartości (wyliczona/fakturowana), migawki mnożnika i kursu */
  money?: import('../lib/money/loadMoney').LoadMoneyV2;
}

export type EtaConfidence = 'LOW' | 'MED' | 'HIGH';

export interface EtaSegment {
  id: string;
  label: string;
  hours: number;
  kind: 'PL_ROAD' | 'WAIT_FERRY' | 'CROSSING' | 'SE_ROAD' | 'BREAK';
  /** Heuristic band — makieta, nie ML */
  confidence: EtaConfidence;
  earliestHours: number;
  latestHours: number;
  reasons: string[];
}

export interface LoadEvent {
  id: string;
  loadId: string;
  type: string;
  at: string;
  actor: string;
  payload?: Record<string, unknown>;
  note?: string;
}

export interface LoadMessage {
  id: string;
  loadId: string;
  at: string;
  author: string;
  org: OrgKind;
  text: string;
}

export interface Document {
  id: string;
  loadId: string;
  category: DocCategory;
  name: string;
  uploadedAt: string | null;
  deadline: string | null;
  status: 'MISSING' | 'UPLOADED' | 'EXPIRED' | 'MISMATCH';
  permitFits: boolean | null;
  visibleTo: OrgKind[];
  /** Base64 data URL or blob: object URL — vault bytes for DocsView / localStorage persist */
  dataUrl?: string | null;
  mimeType?: string | null;
  bytes?: number | null;
  source?: 'driver' | 'tower' | 'seed';
  /** BK4: `<koszyk>/<ścieżka>` w Supabase Storage — plik pobierany linkiem podpisanym (15 min). */
  storagePath?: string | null;
}


export interface LoadPermit {
  pozycja: string;
  lp: number;
  zestaw: { L: number; W: number; H: number; masa_max_t: number };
  plStatus: string;
  plCategory: string;
  plCategoryLabel: string;
  plReason?: string | null;
  plCorridorHint?: string | null;
  plPilot?: string | null;
  plPilotsRequired: number;
  plOver: string[];
  sePath: string;
  sePathLabel?: string | null;
  seDispens?: string | null;
  seNotes: string[];
  /** PERIOD = firm/time file; TRIP = per transport; NONE/REGULATION = no file */
  attachmentKind?: 'PERIOD' | 'TRIP' | 'NONE' | 'REGULATION';
}

export interface Load {
  id: string;
  code: string; // SG-01 etc
  itemType: string;
  dims: Dimensions;
  qty: number;
  status: LoadStatus;
  stage: CorridorStage;
  progress: number; // 0..1 along corridor
  plannedLoadDate: string;
  plannedDeliverDate: string;
  carrierId: string;
  resources: LoadResources;
  awizacja: Awizacja;
  ferry: FerryBooking;
  pricing: LoadPricing;
  etaSegments: EtaSegment[];
  etaBoden: string | null;
  /** Rollup M12 */
  etaConfidence: EtaConfidence;
  etaEarliestHours: number;
  etaLatestHours: number;
  etaReasons: string[];
  etaMethod: string;
  etaUpdatedAt: string;
  lat: number;
  lng: number;
  heading: number;
  silentMinutes: number | null;
  sequenceOrder: number;
  sequenceRisk: boolean;
  delayed: boolean;
  docMissing: boolean;
  permitFits: boolean | null;
  permit?: LoadPermit;
  /** KSH order no from schedule import ("Nr zlecenia") */
  orderNo?: string | null;
  /** HHL internal order number */
  hhlOrderNo?: string | null;
  /** SCX / carrier order number */
  carrierOrderNo?: string | null;
  /** M2 — rzeczywisty rozładunek (UTC ISO); realizacja = rozładunek (W5) */
  unloadedAt?: string | null;
}

export interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  shape: 'circle' | 'polygon';
  lat: number;
  lng: number;
  radiusM: number;
  hysteresisM: number;
  dwellMin: number;
  /** GPS samples required to confirm enter/dwell (L8). */
  samplesRequired: number;
  notifyHhl: boolean;
  notifyKsh: boolean;
  notifyScx: boolean;
  active: boolean;
  trigger: 'ENTER' | 'EXIT' | 'DWELL_EXCEEDED';
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  condition: string; // JSONLogic-ish string
  actions: string[];
  enabled: boolean;
  runCount: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  at: string;
  status: 'OK' | 'SKIPPED' | 'ERROR';
  note: string;
  loadId?: string;
}

export interface NotificationHref {
  view?: string;
  tab?: string;
  entityId?: string;
  loadId?: string;
}

export interface Notification {
  id: string;
  at: string;
  title: string;
  body: string;
  severity: Severity;
  loadId?: string;
  read: boolean;
  /** Roles that see this notification; empty/undefined = all */
  roleScope?: RoleId[];
  href?: NotificationHref;
}

export interface Risk {
  id: string;
  type: RiskType;
  severity: Severity;
  title: string;
  detail: string;
  loadId?: string;
  owner: OrgKind;
  /** Operator meta line, e.g. "Odpowiada: Scandinavian Express" */
  meta: string;
  nextAction: string;
  ageHours: number;
  ferryPlanB?: string[];
  /** Extra delay impact in hours (force majeure / road SE). */
  delayImpactHours?: number;
  /** Linked Trafikverket situation id when sourced from TV. */
  situationId?: string;
  /** Cause category for FM / road, e.g. weather | strike | border | industrial. */
  causeCategory?: string;
}

export interface RateRule {
  id: string;
  side: 'COST' | 'REVENUE';
  lengthFrom: number;
  lengthTo: number;
  widthFrom: number;
  widthTo: number;
  heightFrom: number;
  heightTo: number;
  weightFrom: number;
  weightTo: number;
  baseRate: number;
}

/** @deprecated generic % BAF — use SEFS weekly snapshots in lib/sefs.ts */
export interface BafParams {
  indexSource: string;
  baseValue: number;
  baseDate: string;
  currentValue: number;
  valueDate: string;
  fuelShare: number;
  triggerThreshold: number;
  roundingStep: number;
  floorPct: number;
  capPct: number;
  sourceUrl: string;
}

export interface SefsEditorState {
  weekLabel: string;
  priceSek: number;
  pricePln: number;
}

export interface InvoiceLine {
  loadId: string;
  code: string;
  expected: number;
  billed: number;
  diff: number;
}

/** HHL-configured factoring offer (SCX can select on invoice submit). */
export type PayoutDelayUnit = 'hours' | 'days';

export interface FactoringOffer {
  enabled: boolean;
  feePercent: number;
  payoutDelayValue: number;
  payoutDelayUnit: PayoutDelayUnit;
  label?: string;
  notes?: string;
}

/** Snapshot of HHL rates at the moment SCX selected factoring. */
export interface InvoiceFactoring {
  selected: boolean;
  feePercent: number;
  feeAmount: number;
  netPayout: number;
  payoutAt: string;
  delayValue: number;
  delayUnit: PayoutDelayUnit;
}

export type InvoicePayoutStatus = 'NONE' | 'SCHEDULED' | 'PAID' | 'FUNDED' | 'REJECTED';
/** UX_MAP factoring pipeline label (derived in UI from payout + selected). */
export type FactoringPipelineState =
  | 'NOT_OFFERED'
  | 'OFFERED'
  | 'SUBMITTED'
  | 'FUNDED'
  | 'REJECTED';

export interface Invoice {
  id: string;
  weekLabel: string;
  status: 'DRAFT' | 'SUBMITTED' | 'MATCHED' | 'DISPUTED';
  createdAt: string;
  billedTotal: number;
  expectedTotal: number;
  lines: InvoiceLine[];
  note?: string;
  /** Factoring choice + rate snapshot (undefined = standard payment). */
  factoring?: InvoiceFactoring;
  /** Set to SCHEDULED on HHL Accept when factoring was selected. */
  payoutStatus?: InvoicePayoutStatus;
}

export interface ScheduleVersion {
  id: string;
  at: string;
  by: string;
  filename: string;
  added: number;
  changed: number;
  removed: number;
  rejected: number;
}

export interface ExceptionItem {
  id: string;
  severity: Severity;
  title: string;
  owner: OrgKind;
  /** Claude voice: "Odpowiada: Scandinavian Express" */
  meta: string;
  nextAction: string;
  ageHours: number;
  loadId?: string;
  /** Operator-facing load code (SG-07), never raw load-010 */
  code?: string;
}

export interface AppToast {
  id: string;
  message: string;
  severity: Severity;
  loadId?: string;
}
