/**
 * BN9-a — katalog promów: jedno źródło prawdy o portach, armatorach i trasach promowych we froncie.
 *
 * Dziś działają Polferries (Gdańsk ⇄ Nynäshamn) i Stena Line (Gdynia ⇄ Karlskrona). Nowe przeprawy Estonia ⇄ Finlandia
 * i Estonia ⇄ Szwecja są w katalogu, żeby widoki pokazały je tak samo jak Stenę i Polferries, gdy tylko przyjdą dane
 * (rejsy w `sailings`). Bez rejsów nowych tras żaden widok nie rysuje dla nich nic nowego.
 *
 * KONTRAKT Z BAZĄ (BN1): tabele `ferry_ports` (kod, kraj, szer., dł.), `ferry_operators` (kod, nazwa) i `ferry_routes`
 * (kod `AAA-BBB`, port z, port do, armatorzy, kierunek wyjazdowy) mają mieć DOKŁADNIE te same kody co tutaj; kolumna
 * `sailings.route` przyjmuje kody tras z `FERRY_ROUTES`, a `sailings.source` — kody armatorów z `FERRY_OPERATORS`
 * (obok `DANE_STARTOWE` i `RECZNIE`). Zmiana kodu = zmiana po obu stronach.
 */

export type FerryCountry = 'PL' | 'SE' | 'EE' | 'FI';

export type FerryPortCode = 'GDN' | 'GDY' | 'NYN' | 'KAA' | 'TLL' | 'MUU' | 'PLD' | 'HEL' | 'VUO' | 'STO' | 'KPS';

export type FerryOperator = 'POLFERRIES' | 'STENA' | 'TALLINK' | 'VIKING' | 'ECKERO' | 'DFDS';

export type FerryRouteCode =
  | 'GDN-NYN' | 'NYN-GDN'
  | 'GDY-KAA' | 'KAA-GDY'
  | 'TLL-HEL' | 'HEL-TLL'
  | 'TLLA-HEL' | 'HELA-TLL'
  | 'MUU-VUO' | 'VUO-MUU'
  | 'TLL-STO' | 'STO-TLL'
  | 'PLD-KPS' | 'KPS-PLD';

/** Id toru wodnego na mapie (jeden tor na parę kierunków). */
export type WaterTrackId = 'GDN-NYN' | 'GDY-KAA' | 'TLL-HEL' | 'MUU-VUO' | 'TLL-STO' | 'PLD-KPS';

export interface FerryPortDef {
  code: FerryPortCode;
  country: FerryCountry;
  /** środek terminalu promowego */
  lat: number;
  lng: number;
  /** klucz nazwy w słowniku (`portName`) */
  nameKey: `p3a_port_${FerryPortCode}`;
  /** porty wyjazdowe: godziny „Śrem → port + odprawa” (awizacja, „zdąży na rejs”) */
  clearanceH?: number;
}

export interface FerryOperatorDef {
  code: FerryOperator;
  /** nazwa wyświetlana */
  name: string;
  /** słowa w `vessels.operator`, po których rozpoznajemy armatora (małe litery) */
  match: readonly string[];
}

export interface FerryRouteDef {
  code: FerryRouteCode;
  from: FerryPortCode;
  to: FerryPortCode;
  /** armatorzy przeprawy; pierwszy = domyślny, gdy rejs nie mówi, czyj jest */
  operators: readonly FerryOperator[];
  waterTrack: WaterTrackId;
  /** kierunek „wyjazdowy” (w stronę placu w Boden): PL → SE oraz z Estonii */
  outbound: boolean;
  /** port pośredni (tylko opis; tor wodny przez niego przechodzi) */
  via?: string;
}

export const FERRY_PORTS: readonly FerryPortDef[] = [
  { code: 'GDN', country: 'PL', lat: 54.4, lng: 18.67, nameKey: 'p3a_port_GDN', clearanceH: 14 },
  { code: 'GDY', country: 'PL', lat: 54.533, lng: 18.54, nameKey: 'p3a_port_GDY', clearanceH: 16 },
  { code: 'NYN', country: 'SE', lat: 58.903, lng: 17.948, nameKey: 'p3a_port_NYN' },
  { code: 'KAA', country: 'SE', lat: 56.155, lng: 15.62, nameKey: 'p3a_port_KAA' },
  /* Porty estońskie: odprawa 14 h jak Polferries — DO POTWIERDZENIA W BN8 */
  /* Tallinn, Old City Harbour (Vanasadam) — terminale A i D */
  { code: 'TLL', country: 'EE', lat: 59.443, lng: 24.77, nameKey: 'p3a_port_TLL', clearanceH: 14 },
  /* Muuga, terminal HHLA TK */
  { code: 'MUU', country: 'EE', lat: 59.497, lng: 24.96, nameKey: 'p3a_port_MUU', clearanceH: 14 },
  /* Paldiski, port południowy */
  { code: 'PLD', country: 'EE', lat: 59.335, lng: 24.083, nameKey: 'p3a_port_PLD', clearanceH: 14 },
  /* Helsinki, West Harbour (Länsisatama) T2; Katajanokka ok. 4 km dalej */
  { code: 'HEL', country: 'FI', lat: 60.153, lng: 24.915, nameKey: 'p3a_port_HEL' },
  { code: 'VUO', country: 'FI', lat: 60.206, lng: 25.19, nameKey: 'p3a_port_VUO' },
  /* Sztokholm, Värtahamnen */
  { code: 'STO', country: 'SE', lat: 59.35, lng: 18.105, nameKey: 'p3a_port_STO' },
  { code: 'KPS', country: 'SE', lat: 59.721, lng: 19.065, nameKey: 'p3a_port_KPS' },
];

/** Kolejność ma znaczenie przy rozpoznawaniu po nazwie: najpierw Stena, potem Polferries (jak dotąd), potem nowi. */
export const FERRY_OPERATORS: readonly FerryOperatorDef[] = [
  { code: 'POLFERRIES', name: 'Polferries', match: ['polferries'] },
  { code: 'STENA', name: 'Stena Line', match: ['stena'] },
  { code: 'TALLINK', name: 'Tallink Silja', match: ['tallink', 'silja'] },
  { code: 'VIKING', name: 'Viking Line', match: ['viking'] },
  { code: 'ECKERO', name: 'Eckerö Line', match: ['eckerö', 'eckero', 'finbo'] },
  { code: 'DFDS', name: 'DFDS', match: ['dfds'] },
];

/**
 * Trasy: najpierw dzisiejsze (kolejność jak w formularzu rejsu), potem nowe.
 * Nowe — wyjazdowe z Estonii; Paldiski ⇄ Kapellskär: DFDS, historycznie Tallink.
 */
export const FERRY_ROUTES: readonly FerryRouteDef[] = [
  { code: 'GDN-NYN', from: 'GDN', to: 'NYN', operators: ['POLFERRIES'], waterTrack: 'GDN-NYN', outbound: true },
  { code: 'GDY-KAA', from: 'GDY', to: 'KAA', operators: ['STENA'], waterTrack: 'GDY-KAA', outbound: true },
  { code: 'NYN-GDN', from: 'NYN', to: 'GDN', operators: ['POLFERRIES'], waterTrack: 'GDN-NYN', outbound: false },
  { code: 'KAA-GDY', from: 'KAA', to: 'GDY', operators: ['STENA'], waterTrack: 'GDY-KAA', outbound: false },
  { code: 'TLL-HEL', from: 'TLL', to: 'HEL', operators: ['TALLINK', 'VIKING', 'ECKERO'], waterTrack: 'TLL-HEL', outbound: true },
  { code: 'MUU-VUO', from: 'MUU', to: 'VUO', operators: ['ECKERO'], waterTrack: 'MUU-VUO', outbound: true },
  { code: 'TLL-STO', from: 'TLL', to: 'STO', operators: ['TALLINK'], waterTrack: 'TLL-STO', outbound: true, via: 'Mariehamn' },
  { code: 'PLD-KPS', from: 'PLD', to: 'KPS', operators: ['DFDS', 'TALLINK'], waterTrack: 'PLD-KPS', outbound: true },
  { code: 'HEL-TLL', from: 'HEL', to: 'TLL', operators: ['TALLINK', 'VIKING', 'ECKERO'], waterTrack: 'TLL-HEL', outbound: false },
  { code: 'VUO-MUU', from: 'VUO', to: 'MUU', operators: ['ECKERO'], waterTrack: 'MUU-VUO', outbound: false },
  { code: 'STO-TLL', from: 'STO', to: 'TLL', operators: ['TALLINK'], waterTrack: 'TLL-STO', outbound: false, via: 'Mariehamn' },
  { code: 'KPS-PLD', from: 'KPS', to: 'PLD', operators: ['DFDS', 'TALLINK'], waterTrack: 'PLD-KPS', outbound: false },
];

/**
 * BN1 F7 #649: aliasy operator×terminal (AAA-BBB w FERRY_ROUTES zostaje).
 * Bez RPC: TLLA-HEL/HELA-TLL znane; nie spadają na GDN-NYN.
 */
const SEED_ROUTE_ALIASES: ReadonlyMap<string, {
  operators: readonly FerryOperator[];
  outbound: boolean;
  waterTrack: WaterTrackId;
}> = new Map([
  ['TLLA-HEL', { operators: ['VIKING', 'ECKERO'], outbound: true, waterTrack: 'TLL-HEL' }],
  ['HELA-TLL', { operators: ['VIKING', 'ECKERO'], outbound: false, waterTrack: 'TLL-HEL' }],
]);

/** Przeprawy działające przed BN9 (Polferries, Stena) — ich wygląd ma zostać bez zmian. */
export const LEGACY_OPERATORS: readonly FerryOperator[] = ['POLFERRIES', 'STENA'];

const ROUTE_BY_CODE = new Map<string, FerryRouteDef>(FERRY_ROUTES.map((r) => [r.code, r]));
const PORT_BY_CODE = new Map<string, FerryPortDef>(FERRY_PORTS.map((p) => [p.code, p]));
const OPERATOR_BY_CODE = new Map<string, FerryOperatorDef>(FERRY_OPERATORS.map((o) => [o.code, o]));

/** BN1: kody / armatorzy / porty z `ferry_dict_snapshot` (poza seedem UI). */
let rpcRouteCodes = new Set<string>();
let rpcOperatorsByRoute = new Map<string, readonly FerryOperator[]>();
let rpcFamilyByRoute = new Map<string, string>();
let rpcOperatorNames = new Map<string, string>();
/** port_from / port_to → country z snapshotu (isOutbound jak SQL ferry_route_is_outbound). */
let rpcPortCountry = new Map<string, string>();
let rpcRoutePorts = new Map<string, { from: string; to: string }>();

export type FerryDictSnapshot = {
  operators: { code: string; name: string }[];
  ports: { code: string; name: string; terminal: string | null; country: string; lat: number; lon: number }[];
  routes: {
    code: string;
    port_from: string;
    port_to: string;
    family_key: string;
    operators: string[];
  }[];
};

/** Wgraj snapshot RPC — rozszerza isKnownRoute / operatorsForRoute / isOutbound (seed zostaje). */
export function applyFerryDictSnapshot(snap: FerryDictSnapshot): void {
  const codes = new Set<string>();
  const ops = new Map<string, readonly FerryOperator[]>();
  const fam = new Map<string, string>();
  const routePorts = new Map<string, { from: string; to: string }>();
  for (const r of snap.routes ?? []) {
    if (!r?.code) continue;
    codes.add(r.code);
    fam.set(r.code, r.family_key || r.code);
    if (r.port_from && r.port_to) routePorts.set(r.code, { from: r.port_from, to: r.port_to });
    const list = (r.operators ?? []).filter(isFerryOperator);
    if (list.length) ops.set(r.code, list);
  }
  rpcRouteCodes = codes;
  rpcOperatorsByRoute = ops;
  rpcFamilyByRoute = fam;
  rpcRoutePorts = routePorts;
  const names = new Map<string, string>();
  for (const o of snap.operators ?? []) {
    if (o?.code && o.name) names.set(o.code, o.name);
  }
  rpcOperatorNames = names;
  const countries = new Map<string, string>();
  for (const p of snap.ports ?? []) {
    if (p?.code && p.country) countries.set(p.code, p.country);
  }
  rpcPortCountry = countries;
}

/** Testy / demo: wróć do samego seeda. */
export function resetFerryDictRpc(): void {
  rpcRouteCodes = new Set();
  rpcOperatorsByRoute = new Map();
  rpcFamilyByRoute = new Map();
  rpcOperatorNames = new Map();
  rpcPortCountry = new Map();
  rpcRoutePorts = new Map();
}

export const FERRY_ROUTE_CODES: readonly FerryRouteCode[] = FERRY_ROUTES.map((r) => r.code);
export const FERRY_OPERATOR_CODES: readonly FerryOperator[] = FERRY_OPERATORS.map((o) => o.code);

export function isKnownRoute(code: unknown): code is FerryRouteCode {
  return typeof code === 'string'
    && (ROUTE_BY_CODE.has(code) || SEED_ROUTE_ALIASES.has(code) || rpcRouteCodes.has(code));
}

export function isFerryOperator(code: unknown): code is FerryOperator {
  return typeof code === 'string' && OPERATOR_BY_CODE.has(code);
}

export function routeByCode(code: string | null | undefined): FerryRouteDef | null {
  return code ? ROUTE_BY_CODE.get(code) ?? null : null;
}

export function portByCode(code: string | null | undefined): FerryPortDef | null {
  return code ? PORT_BY_CODE.get(code) ?? null : null;
}

export function operatorByCode(code: string | null | undefined): FerryOperatorDef | null {
  return code ? OPERATOR_BY_CODE.get(code) ?? null : null;
}

/** Nazwa wyświetlana armatora („Stena Line”); nieznany kod zostaje bez zmian. */
export function operatorName(code: string): string {
  return OPERATOR_BY_CODE.get(code)?.name ?? rpcOperatorNames.get(code) ?? code;
}

/** Armatorzy trasy (pusta lista dla nieznanego kodu). */
export function operatorsForRoute(code: string | null | undefined): readonly FerryOperator[] {
  if (!code) return [];
  return routeByCode(code)?.operators
    ?? SEED_ROUTE_ALIASES.get(code)?.operators
    ?? rpcOperatorsByRoute.get(code)
    ?? [];
}

/** Kierunek wyjazdowy (PL/EE → SE/FI). Seed / alias; inaczej kraje portów ze snapshotu (jak SQL). */
export function isOutbound(code: string | null | undefined): boolean {
  if (!code) return false;
  const seed = routeByCode(code);
  if (seed) return seed.outbound;
  const alias = SEED_ROUTE_ALIASES.get(code);
  if (alias) return alias.outbound;
  const ports = rpcRoutePorts.get(code);
  if (!ports) return false;
  const fromC = rpcPortCountry.get(ports.from);
  const toC = rpcPortCountry.get(ports.to);
  if (!fromC || !toC) return false;
  return (fromC === 'PL' || fromC === 'EE') && (toC === 'SE' || toC === 'FI');
}

/** Porty trasy `[z, do]`; nieznana trasa — null. */
export function routePorts(code: string | null | undefined): [FerryPortDef, FerryPortDef] | null {
  const r = routeByCode(code);
  if (!r) return null;
  const a = PORT_BY_CODE.get(r.from);
  const b = PORT_BY_CODE.get(r.to);
  return a && b ? [a, b] : null;
}

/** Trasy wyjazdowe armatora (Polferries: GDN-NYN; Stena: GDY-KAA; Tallink: TLL-HEL, TLL-STO, PLD-KPS). */
export function outboundRoutesOf(operator: FerryOperator): readonly string[] {
  return FERRY_ROUTES.filter((r) => r.outbound && r.operators.includes(operator)).map((r) => r.code);
}

/** Pierwsza trasa wyjazdowa armatora (porty w wierszu „Sytuacja na trasie”). */
export function primaryRouteOf(operator: FerryOperator): FerryRouteDef {
  return FERRY_ROUTES.find((r) => r.outbound && r.operators.includes(operator)) ?? FERRY_ROUTES[0];
}

/** Domyślna odprawa portu wyjazdowego bez wpisu (jak Gdańsk). */
const DEFAULT_CLEARANCE_H = 14;

/**
 * Godziny „Śrem → port + odprawa” dla armatora: z portu wyjazdowego jego pierwszej trasy wyjazdowej
 * (Polferries: Gdańsk 14 h, Stena: Gdynia 16 h; porty estońskie 14 h — do potwierdzenia w BN8).
 */
export function clearanceHoursFor(operator: FerryOperator): number {
  return PORT_BY_CODE.get(primaryRouteOf(operator).from)?.clearanceH ?? DEFAULT_CLEARANCE_H;
}

/**
 * Armator z tekstu `vessels.operator` („Stena Line” → STENA). Kolejność sprawdzania: Stena, Polferries, potem nowi —
 * tak jak dotąd („stena” wygrywa).
 */
export function operatorFromText(text: string | null | undefined): FerryOperator | null {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return null;
  for (const code of MATCH_ORDER) {
    const o = OPERATOR_BY_CODE.get(code)!;
    if (o.match.some((w) => t.includes(w))) return code;
  }
  return null;
}
const MATCH_ORDER: readonly FerryOperator[] = ['STENA', 'POLFERRIES', 'TALLINK', 'VIKING', 'ECKERO', 'DFDS'];

/** Kolejność armatorów do rozpoznawania i list „Stena, potem Polferries, potem nowi”. */
export const OPERATOR_MATCH_ORDER = MATCH_ORDER;

/**
 * Czy rejs należy do armatora (wybór rejsu w awizacji i szufladzie).
 * Polferries i Stena — reguły sprzed BN9 bez zmian; nowi: nazwa armatora albo (bez nazwy innego) jego trasa.
 */
export function sailingOfOperator(s: { route?: string | null; operator?: string | null }, operator: FerryOperator): boolean {
  const named = operatorFromText(s.operator);
  const served = !!s.route && operatorsForRoute(s.route).includes(operator);
  if (operator === 'POLFERRIES') return named !== 'STENA' && (served || !s.route);
  if (operator === 'STENA') return named === 'STENA' || served;
  return named === operator || (!named && served);
}
