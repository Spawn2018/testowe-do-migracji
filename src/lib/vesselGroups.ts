/**
 * DP-8 (F7 #670): lista statków do „Dodaj rejs” z tabeli `vessels` (nowy statek armatora pojawia się sam).
 * Nazwy bez przedrostka „M/F”, armator rozpoznany z tekstu (`operatorFromText`). Zapas: stała lista BN9-b
 * (tryb demo, błąd odczytu, pusta tabela).
 */
import { FERRY_OPERATOR_CODES, operatorFromText, type FerryOperator } from './ferryCatalog';

export interface VesselGroup { op: FerryOperator; names: readonly string[] }

/** BN9-b — statki wszystkich armatorów (zapas, gdy baza nie odpowie). */
export const VESSELS_FALLBACK: readonly VesselGroup[] = [
  { op: 'POLFERRIES', names: ['Wawel', 'Nova Star'] },
  { op: 'STENA', names: ['Stena Spirit', 'Stena Estelle', 'Stena Ebba'] },
  { op: 'TALLINK', names: ['Megastar', 'MyStar', 'Victoria I', 'Baltic Queen'] },
  { op: 'VIKING', names: ['Viking XPRS'] },
  { op: 'ECKERO', names: ['Finlandia', 'Finbo Cargo'] },
  { op: 'DFDS', names: ['Sirena Seaways'] },
];

/** Wiersze `vessels(name, operator)` → grupy armatorów w kolejności katalogu; statki bez rozpoznanego armatora pomijane. */
export function groupVessels(rows: readonly { name: string | null; operator: string | null }[]): VesselGroup[] {
  const by = new Map<FerryOperator, string[]>();
  for (const r of rows) {
    const name = (r.name ?? '').replace(/^M\/F\s+/i, '').trim();
    const op = operatorFromText(r.operator) ?? operatorFromText(name);
    if (!name || !op) continue;
    const list = by.get(op) ?? [];
    if (!list.includes(name)) list.push(name);
    by.set(op, list);
  }
  /* U4: kolejność armatorów jak w katalogu (Polferries, Stena, potem nowi) — także dla listy z bazy */
  return FERRY_OPERATOR_CODES.filter((op) => by.has(op)).map((op) => ({ op, names: by.get(op)! }));
}

/** Armator statku z listy (ręczny rejs zapamiętuje armatora statku, nie pierwszego armatora trasy). */
export function vesselOperator(groups: readonly VesselGroup[], vessel: string): FerryOperator | undefined {
  /* U7: bez względu na wielkość liter i przedrostek „M/F” (NOVA STAR → Polferries) */
  const key = vesselKeyOf(vessel);
  return groups.find((g) => g.names.some((n) => vesselKeyOf(n) === key))?.op;
}

/** Klucz nazwy statku: bez „M/F”, małe litery, pojedyncze spacje. */
export function vesselKeyOf(name: string | null | undefined): string {
  return (name ?? '').replace(/^M\/F\s+/i, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * DP-4: trasa auta na promie bez przypisanego rejsu — z armatora statku.
 * U8: auto bez rejsu dostaje trasę wyjazdową armatora — to zachowanie jak dotąd dla Polferries (dawne domyślne
 * Gdańsk → Nynäshamn), teraz także dla Steny (Gdynia → Karlskrona).
 * B1: tylko armatorzy sprzed Korytarza bałtyckiego (Polferries, Stena). Nowi armatorzy (Viking: Terminal A,
 * Tallink: kilka tras, Eckerö, DFDS) i statek nieznany → null, bez zgadywania terminala i trasy.
 * DP-14 (F7 r2 #672): trasa wpisana wprost — druga trasa armatora w słowniku z bazy (np. Świnoujście–Ystad)
 * nie może po cichu zabrać autu trasy.
 */
export const LEGACY_VESSEL_ROUTE: Readonly<Partial<Record<FerryOperator, string>>> = {
  POLFERRIES: 'GDN-NYN',
  STENA: 'GDY-KAA',
};

export function routeOfVessel(vessel: string | null | undefined, groups: readonly VesselGroup[] = currentVesselGroups()): string | null {
  if (!vessel) return null;
  const op = vesselOperator(groups, vessel) ?? operatorFromText(vessel);
  if (!op) return null;
  return LEGACY_VESSEL_ROUTE[op] ?? null;
}

/* DP-16, DP-17: jedna lista statków na sesję — Rejsy i mapy. Loader wstrzykiwany (testy, paczka demo bez Supabase). */
/**
 * N8: stan sesji modułu — ostatnia lista statków pobrana z bazy (null = jeszcze nie pobrano albo błąd).
 * Wspólny dla wszystkich widoków; zmiana podmienia referencję listy i powiadamia subskrybentów (B1) —
 * `useVesselGroups()` zwraca nową referencję, która jest zależnością efektów i memo map (DP-25).
 */
let lastGroups: readonly VesselGroup[] | null = null;
const listeners = new Set<() => void>();

export function subscribeVesselGroups(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function setLastGroups(g: readonly VesselGroup[] | null): void {
  lastGroups = g;
  for (const fn of listeners) fn();
}

/** Ostatnio pobrana lista z bazy albo lista zapasowa (DP-17: mapy widzą statki dopisane w bazie). */
export function currentVesselGroups(): readonly VesselGroup[] {
  return lastGroups ?? VESSELS_FALLBACK;
}

export interface VesselsLoader {
  /** Jedno pobranie na sesję; po błędzie pamięć się czyści i następne wywołanie próbuje ponownie. */
  load(): Promise<VesselGroup[]>;
  /** Tylko testy. */
  reset(): void;
}

/** DP-27: komunikat przy błędzie odczytu listy statków — jeden na sesję (nie przy każdym montowaniu mapy). */
export const VESSELS_WARN = '[Statki] lista statków z bazy niedostępna — lista zapasowa';

export function createVesselsLoader(
  fetchGroups: () => Promise<VesselGroup[]>,
  warn: (msg: string) => void = (msg) => { console.warn(msg); },
): VesselsLoader {
  let cache: Promise<VesselGroup[]> | null = null;
  let warned = false;
  return {
    load() {
      cache ??= fetchGroups().then((g) => {
        if (g.length) setLastGroups(g);
        return g;
      }).catch((e: unknown) => {
        cache = null;
        if (!warned) { warned = true; warn(VESSELS_WARN); }
        throw e;
      });
      return cache;
    },
    reset() {
      cache = null;
      warned = false;
      setLastGroups(null);
    },
  };
}

/** DP-19: domyślny statek formularza — „Wawel” bez względu na wielkość liter i „M/F”; inaczej pierwszy z listy. */
export function defaultVessel(groups: readonly VesselGroup[], want = 'Wawel'): string | undefined {
  const key = vesselKeyOf(want);
  for (const g of groups) for (const n of g.names) if (vesselKeyOf(n) === key) return n;
  return groups[0]?.names[0];
}
