/**
 * wyglad/P7-a — przykłady demo Przeglądu i okna Awizacja (E32).
 * Tabela symboli — z tabeli właściciela z 07.10 (`WYMIARY_PILOT_ZEZWOLENIA.md`: zestaw z ładunkiem, pilot, rodzaj zezwolenia);
 * w demo „K” = Kratownice (KR), „P” = Płatwie (PL-A / PL-B po szerokości 3,40 m). Piloci i ich numery są zmyśleni (G-09).
 * Wywoływane wyłącznie z `p7Source.ts` za warunkiem trybu demo wpisanym wprost (strażnik I-0).
 */
import type { Load } from '../types';
import type { Pilots } from './p7Awiz';
import { useTowerStore } from '../store/useTowerStore';

export { demoSymbolSpec } from './p7SymbolsDemo';

/* tworzone przy pierwszym użyciu — bez kodu na poziomie modułu, który build produkcyjny musiałby zostawić (I-0) */
let pilots: Map<string, Pilots> | null = null;
function store(): Map<string, Pilots> {
  pilots ??= new Map<string, Pilots>([
    ['K-01', { pl: { plate: 'WX 00001', name: 'Piotr Nowicki' }, se: { plate: 'ABC 001', name: 'Karl Berg' } }],
    ['K-02', { pl: { plate: 'WX 00002', name: 'Adam Wolski' }, se: { plate: 'ABC 002', name: 'Erik Holm' } }],
  ]);
  return pilots;
}

/** Piloci w demo — po kodzie transportu (konwój: zapis dla wszystkich kodów konwoju, R1). */
export function demoPilots(load: Pick<Load, 'code'>): Pilots | null {
  return store().get(load.code) ?? null;
}

export function demoSavePilots(codes: readonly string[], p: Pilots): void {
  const m = store();
  for (const c of codes) m.set(c, { pl: { ...p.pl }, se: { ...p.se } });
}

/**
 * wyglad/P7-b — „Zmień” przy „Zestaw z ładunkiem” (E32 pkt 7, E9 D-83): w demo zapis do pamięci strony przez
 * `updateResources` (wpis „zasoby zmienione” w Historii jak przy awizacji). `null` = przywróć wymiary z tabeli symboli.
 */
export async function demoSaveSet(loadId: string, set: { l: number; w: number; h: number } | null): Promise<{ ok: boolean }> {
  const st = useTowerStore.getState();
  if (st.role !== 'HHL' || !st.loads.some((l) => l.id === loadId)) return { ok: false };
  const patch = set
    ? { setLengthM: set.l, setWidthM: set.w, setHeightM: set.h }
    : { setLengthM: null, setWidthM: null, setHeightM: null };
  /* tylko wymiary zestawu — bez komunikatu „Zasoby zapisane” i bez przeliczania kompletności awizacji */
  useTowerStore.setState((s) => ({ loads: s.loads.map((l) => (l.id === loadId ? { ...l, resources: { ...l.resources, ...patch } } : l)) }));
  st.appendEvent({ loadId, type: 'RESOURCES_UPDATED', at: new Date().toISOString(), actor: 'HHL', payload: patch });
  return { ok: true };
}
