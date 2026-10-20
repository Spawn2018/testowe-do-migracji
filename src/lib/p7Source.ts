/**
 * wyglad/P7-a — skąd Przegląd i okno Awizacja (E32) biorą dane, których aplikacja jeszcze nie ma.
 * Produkcja: `null` / `false` = nie podłączone (sekcje i przyciski ukryte; zestaw — z pól transportu; piloci — dzisiejsza
 * lista pilotów z bazy w Przeglądzie); demo: przykłady z `p7Demo.ts`. Warunek `import.meta.env.VITE_AUTH_MODE`
 * wpisany wprost (strażnik I-0). Bez zapytań i zapisów do bazy. Co podłącza wykonawca — dopisek do PR wyglad/P7-a.
 */
import type { Load, OrgKind } from '../types';
import type { Pilots } from './p7Awiz';
import { demoPilots, demoSavePilots, demoSaveSet, demoSymbolSpec } from './p7Demo';
import { accountRole } from './accountRole';
import { serverRuleOn } from './serverRules';
import { isPreviewReadOnly } from './prodFacade';

/** Wiersz tabeli właściciela według symbolu (E32 pkt 7): zestaw z ładunkiem, wymóg pilotów, rodzaj zezwolenia. */
export interface SymbolSpec {
  symbol: string;
  kind: string;
  set: { l: number; w: number; h: number };
  /** „PL + SE” — pilot PL i pilot SE wymagani; „BRAK” — piloci nie pojawiają się w transporcie */
  pilots: boolean;
  permit: 'FIRMA' | 'TRASA';
}

/** Wiersz `symbol_specs` z bazy (A7, 0237). */
export interface SymbolSpecRow {
  symbol: string;
  position_name: string | null;
  combo_length_m: number | string | null;
  combo_width_m: number | string | null;
  combo_height_m: number | string | null;
  pilot: string | null;
  permit_kind: string | null;
}
let prodSpecs: Map<string, SymbolSpec> | null = null;
const numOr0 = (v: number | string | null) => (v == null || v === '' ? 0 : Number(v));
/** D-20261020-1118-01: tabela symboli z bazy; `null` = brak odczytu (widok jak bez tabeli). */
export function setSymbolSpecsFromServer(rows: readonly SymbolSpecRow[] | null): void {
  prodSpecs = rows
    ? new Map(rows.map((r) => [r.symbol, {
      symbol: r.symbol,
      kind: r.position_name ?? r.symbol,
      set: { l: numOr0(r.combo_length_m), w: numOr0(r.combo_width_m), h: numOr0(r.combo_height_m) },
      pilots: r.pilot === 'PL_SE',
      permit: r.permit_kind === 'TRASA' ? 'TRASA' as const : 'FIRMA' as const,
    }]))
    : null;
}

/**
 * Tabela symboli (E32 pkt 7, D-83). Produkcja (A7, D-20261020-1118-01): symbol transportu z `loads.symbol`
 * i wiersz `symbol_specs`; rodzaj zezwolenia z `loads.permit_kind`, gdy baza go podała.
 */
export function symbolSpecOf(load: Load): SymbolSpec | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoSymbolSpec(load) : prodSymbolSpec(load);
}
function prodSymbolSpec(load: Load): SymbolSpec | null {
  const spec = load.symbol ? prodSpecs?.get(load.symbol) ?? null : null;
  if (!spec) return null;
  return load.permitKind && load.permitKind !== spec.permit ? { ...spec, permit: load.permitKind } : spec;
}

/** Piloci z bazy (`load_escorts` PL / SE + imię i nazwisko z `load_escort_contacts`). */
let prodPilots: Map<string, Pilots> | null = null;
export function setPilotsFromServer(rows: readonly { loadId: string; scope: string; plate: string | null; name: string | null }[] | null): void {
  if (!rows) { prodPilots = null; return; }
  const m = new Map<string, Pilots>();
  /* najpierw wpisy z zakresem PL / SE (awizacja), potem starsze `load_escorts_set` z zakresem PL_SE na wolne miejsca:
     pierwszy wolny — PL, potem SE (F7 #355 P3, #360 P5 — PL_SE nie zajmuje strony, którą ma wpis PL lub SE) */
  const ordered = [...rows.filter((r) => r.scope !== 'PL_SE'), ...rows.filter((r) => r.scope === 'PL_SE')];
  for (const r of ordered) {
    const cur = m.get(r.loadId) ?? { pl: { plate: null, name: null }, se: { plate: null, name: null } };
    const side = r.scope === 'SE' ? 'se' : r.scope === 'PL' ? 'pl'
      : r.scope === 'PL_SE' ? (!cur.pl.plate ? 'pl' : !cur.se.plate ? 'se' : null) : null;
    if (!side) continue;
    cur[side] = { plate: r.plate || null, name: r.name || null };
    m.set(r.loadId, cur);
  }
  prodPilots = m;
}

/** Piloci z awizacji (D-20261009-1233-01: numer rejestracyjny, imię i nazwisko). */
export function pilotsOf(load: Load): Pilots | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPilots(load) : prodPilotsOf(load);
}
function prodPilotsOf(load: Load): Pilots | null {
  return prodPilots ? prodPilots.get(load.id) ?? { pl: { plate: null, name: null }, se: { plate: null, name: null } } : null;
}

/**
 * Zapis pilotów z okna Awizacja — demo: w pamięci strony; produkcja: `awiz_pilots_set` (D-20261020-1118-01, #353)
 * po włączeniu `AWIZ_PILOTS` przez wykonawcę. Puste pola są dozwolone (zapis awizacji nie wymaga pilotów).
 */
export function savePilotsOf(): ((codes: readonly string[], p: Pilots) => void) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoSavePilots : serverRuleOn('AWIZ_PILOTS') ? savePilotsProd : null;
}
/** Produkcja: zapis w `src/data/pilotsServer.ts` (moduł leniwy — tu bez zapytań do bazy, F8). */
function savePilotsProd(codes: readonly string[], p: Pilots): void {
  void import('../data/pilotsServer').then((m) => m.savePilotsServer(codes, p));
}

/**
 * E32 pkt 6 + D-20261020-1501-01 (właściciel 15:01): Administrator HHL awizuje tak samo jak SCX; Operacje HHL i KSH
 * tylko oglądają (E9; 09.10 12:33). Demo: według rodzaju konta (audyt-F F-07). Produkcja: konto HHL_ADMIN we własnym
 * widoku HHL (baza przyjmuje zapis HHL — `loads_update_hhl`, `guard_load_update`); w Podglądzie nigdy.
 */
export function canFixAwizOf(role: OrgKind): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? role === 'HHL' && accountRole(role) !== 'HHL_OPS' : role === 'HHL' && accountRole(role) === 'HHL_ADMIN' && !isPreviewReadOnly({ viewRole: role });
}

/** Wymiary zestawu z ładunkiem w metrach. */
export interface SetDims { l: number; w: number; h: number }

/**
 * wyglad/P7-b — E32 pkt 7, E9 (D-83; „Kto co widzi i zmienia”: HHL Administrator i HHL Operacje zmieniają zestaw):
 * zapis „Zestaw z ładunkiem” przy transporcie; `null` = przywróć z tabeli symboli. Produkcja — po funkcji bazy
 * z wpisem w Historii (wykonawca, P7; dopisek do PR wyglad/P7-b); do tego czasu przycisk „Zmień” ukryty.
 */
export function saveSetOf(role: OrgKind): ((loadId: string, set: SetDims | null) => Promise<{ ok: boolean; error?: string }>) | null {
  if (role !== 'HHL') return null;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoSaveSet : null;
}
