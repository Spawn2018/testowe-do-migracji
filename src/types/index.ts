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
  | 'AT_PORT_SE'
  | 'IN_TRANSIT_SE'
  | 'APPROACHING_SITE'
  | 'UNLOADING'
  | 'DELIVERED'
  | 'READY_TO_INVOICE'
  | 'INVOICED'
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
  /** I-2C: STANDARD = ładunek normatywny bez wymiarów w harmonogramie (w bazie wymiary NULL; tu 0 — nie wyświetlać). */
  cargoClass?: 'STANDARD' | 'DIMENSIONED';
}

export interface LoadResources {
  driverName: string | null;
  driverPhone: string | null;
  /** TEL-1 — kraj numeru (tylko SMS); niewidoczny w tabelach. */
  driverPhoneCountry?: 'PL' | 'SE';
  tractorPlate: string | null;
  trailerPlate: string | null;
  /** C-SEP — kierowca dostarczający (drugi). */
  driverDeliveryName?: string | null;
  driverDeliveryPhone?: string | null;
  driverDeliveryPhoneCountry?: 'PL' | 'SE';
  tractorDeliveryPlate?: string | null;
  /** C-SEP — Przepięcie naczepy → separator „|” w Watch Tower. */
  trailerSwap?: boolean;
  escort: boolean;
  escortPlate: string | null;
  setLengthM: number | null;
  setWidthM: number | null;
  setHeightM: number | null;
  setWeightT: number | null;
  /** AWIZ-4 — link śledzenia / id emtrack → `loads.telematics_vehicle_id` */
  trackingRef?: string | null;
}

export interface Awizacja {
  loadWindowStart: string | null;
  loadWindowEnd: string | null;
  unloadWindowStart: string | null;
  unloadWindowEnd: string | null;
  confirmed: boolean;
}

/** M10 — rejs z rozkładu (`sailings`); jedno źródło prawdy o statku i godzinach. */
export type FerryRoute = 'GDN-NYN' | 'NYN-GDN' | 'GDY-KAA' | 'KAA-GDY';
export type SailingStatus = 'ZAPLANOWANY' | 'OPOZNIONY' | 'ODWOLANY';
export interface Sailing {
  id: string;
  vessel: string;
  /** Armator z vessels.operator (Polferries / Stena Line). */
  operator?: string;
  route: FerryRoute;
  departureAt: string;
  arrivalAt: string;
  delayedDepartureAt: string | null;
  delayedArrivalAt: string | null;
  status: SailingStatus;
  source: 'DANE_STARTOWE' | 'RECZNIE' | 'POLFERRIES' | 'STENA';
}

export interface FerryBooking {
  vessel: string | null;
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
  /** M8 — wyliczenie przerwane (niezmiennik „ten sam mechanizm” albo brak danych) — komunikat zamiast cichej wartości */
  moneyError?: string | null;
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
  /** B-10g: kto odczytał (podgląd); puste = jeszcze nikt poza autorem */
  reads?: { userId: string; name: string; org?: string; at: string }[];
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
  /** III-6 (0078): numer wersji; `superseded` = zastąpiony nowszą wersją (poza sejfem). */
  version?: number;
  superseded?: boolean;
  /** III-6: plik zapisany, ale oznaczenie wersji odrzucone (komunikat serwera). */
  versionError?: string;
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
  /** I-18 (0061): status dat planu — tylko produkcja (demo: brak pola). */
  planDates?: { status: 'WSTEPNA' | 'POTWIERDZONA'; confirmedAt: string | null; loadFrom: string | null; loadTo: string | null; deliveryFrom: string | null; deliveryTo: string | null; preLoading: boolean };
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
  /** ETA-PRE-LOAD: przed wyjazdem ze Śremu pole ETA to sam „–”, bez tekstu. */
  etaPreLoad?: boolean;
  /** I-2d: ETA v1 z bazy — pasmo ± minut (eta_confidence_min); null = ETA liczone w kliencie (demo). */
  etaConfMin?: number | null;
  /** I-2d: `loads.delay_minutes` (ETA v1 vs koniec okna planu); undefined w demo. */
  delayMinutesDb?: number | null;
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
  /** M10 — przypisany rejs (`loads.sailing_id`) */
  sailingId?: string | null;
}

export type GeofenceCountry = 'PL' | 'SE' | 'LT' | 'DE';

export interface Geofence {
  id: string;
  name: string;
  type: GeofenceType;
  shape: 'circle' | 'polygon';
  lat: number;
  lng: number;
  /** Kraj strefy. SMS załadunku i placu czyta tę wartość, nie sam środek koła. */
  country?: GeofenceCountry;
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
  /** kod reguły z bazy (START-1…7 = reguły startowe 0094; kreator — brak) */
  code?: string | null;
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
  /** L-4 — ścieżka celu, nigdy strona główna */
  path?: string;
  allowed?: boolean;
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
  /** AUD-02: rodzaj zdarzenia (szablon) — tylko do grupowania w dzwonku, nigdy nie wyświetlany. */
  kind?: string;
  /** AUD-02: kod transportu z ładunku powiadomienia (gdy brak transportu w magazynie). */
  code?: string;
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
  /** M10 — rodzaj ryzyka automatu / rejsu (AUTO_STATUS, LOADING_UNCONFIRMED, MISSED_SAILING, SAILING_CANCELLED, FERRY_OVERDUE). */
  code?: string;
  /** A6-T1 — klucz słownika tytułu + parametry (baza: risk_signals.title_key, detail.params); title = PL (dziennik). */
  titleKey?: string;
  titleParams?: Record<string, unknown>;
  metaKey?: string;
  metaParams?: Record<string, unknown>;
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

/* ---------- M6 — faktury, model trzech stron (MECHANIZM_PIENIEDZY §6) ---------- */
export type BillDirection = 'KOSZT' | 'PRZYCHOD';
export type BillVerification = 'DO_WERYFIKACJI' | 'ZGODNA' | 'SPORNA' | 'ZAAKCEPTOWANA';
export type BillPayment = 'NIEOPLACONA' | 'PO_TERMINIE' | 'OPLACONA';
export type BillFlag =
  | 'ZLY_TYDZIEN' | 'NIEZREALIZOWANY' | 'KWOTA' | 'OPLATA_PALIWOWA'
  | 'TABELA_NBP' | 'KURS_NBP' | 'DATA_KURSU' | 'BRAK_KURSU';
export interface BillLineFx { tableNo: string; mid: number; effectiveDate: string }
export interface BillLine {
  loadId: string;
  /** Netto pozycji w walucie faktury (przepisane z dokumentu). */
  invoicedNet: number;
  invoicedFuel?: number | null;
  /** Kurs pozycji (faktura PLN) — podpowiedź W3, potwierdzona / poprawiona przez wystawcę. */
  fx?: BillLineFx | null;
  /** Oczekiwana kwota w walucie faktury (wyliczenie × kurs reguły). */
  expectedNet?: number | null;
  flags: BillFlag[];
}
export interface Bill {
  id: string;
  direction: BillDirection;
  issuer: OrgKind;
  recipient: OrgKind;
  number: string;
  issueDate: string;
  receiptDate?: string | null;
  weekKey: string;
  currency: 'EUR' | 'PLN';
  /** Netto / VAT / brutto przepisane z dokumentu — system nie liczy VAT. */
  net: number;
  vat: number;
  gross: number;
  dueDate: string;
  dueFromDocument: boolean;
  verification: BillVerification;
  disputeNote?: string | null;
  payment: BillPayment;
  paidAt?: string | null;
  pdfDocId?: string | null;
  pdfName?: string | null;
  /** Tryb Supabase: ścieżka pliku PDF w Storage (link podpisany 15 min). */
  pdfStoragePath?: string | null;
  lines: BillLine[];
  /** Kontrole nagłówka: BRAK_NA_FAKTURZE + pominięte transporty tygodnia. */
  headerFlags: string[];
  missingLoadIds: string[];
  createdAt: string;
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
  /** B-8-IMP: pominięte wiersze TYP = STANDARD */
  skippedStandard?: number;
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
  /** M10 — etykieta rodzaju ryzyka automatu / rejsu (PL/EN/SV) */
  tag?: string;
  /** A6-T1 — klucze słownika (jak Risk) */
  titleKey?: string;
  titleParams?: Record<string, unknown>;
  metaKey?: string;
  metaParams?: Record<string, unknown>;
}

export interface AppToast {
  id: string;
  message: string;
  severity: Severity;
  loadId?: string;
}

/** AUD-03 — KSH: jedyne pola edycji w panelu zlecenia (data + okno załadunku i rozładunku, ISO). */
export interface KshPlanDatesPatch {
  loadDate: string;
  deliveryDate: string;
  loadFrom: string;
  loadTo: string;
  deliveryFrom: string;
  deliveryTo: string;
}
