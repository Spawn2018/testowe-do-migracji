/**
 * wyglad/E49 — skąd biorą się sprawy „Objazd czy postój?” i linie wiatru w ETA (D-20261016-0230-01 Z1, Z3, Z4).
 * Produkcja: brak spraw (`[]`), zapis `null` (przyciski zablokowane), linie ETA z `load.etaDetail.weather`
 * (serwer: `eta_basis.causes.weather`). Demo: przykład z `e49Demo.ts`. Warunek `import.meta.env.VITE_AUTH_MODE`
 * wpisany wprost (strażnik I-0). Bez zapytań.
 */
import type { Load, OrgKind } from '../types';
import type { DetourCase, DetourDecision, DetourLine } from './e49Detour';
import type { EtaWx } from './e49Wx';
import { demoClosureLoad, demoDetourCase, demoDetourDecide, demoDetourLines, demoEtaWx, subscribeDemoDetours } from './e49Demo';

/** Transport demo ze sprawą: pierwszy w drodze przez Szwecję, który ma już kartę w „Do zrobienia” (liczba E7-2 bez zmian). */
export function demoDetourLoadId(loads: readonly Load[], cardLoads: ReadonlySet<string> | null): string | null {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return null;
  const se = loads.filter((l) => l.status === 'IN_TRANSIT_SE' && (!cardLoads || cardLoads.has(l.id)));
  return (se.find(demoClosureLoad) ?? se[0])?.id ?? null;
}

/** Sprawy „Objazd czy postój?” bez decyzji (po decyzji sprawa się zamyka). KSH — nic (E7: sprawy SCX). */
export function detourCasesOf(role: OrgKind, loads: readonly Load[], nowIso: string, cardLoads: ReadonlySet<string>): DetourCase[] {
  if (role === 'KSH') return [];
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return [];
  const id = demoDetourLoadId(loads, cardLoads);
  const load = id ? loads.find((l) => l.id === id) : undefined;
  if (!load) return [];
  const c = demoDetourCase(load, nowIso);
  return c.decision ? [] : [c];
}

/** Zapis decyzji SCX (wpis w Historii, powiadomienie HHL, ETA według wyboru — serwer). null = nie podłączone. */
export function detourDecideOf(): ((id: string, d: DetourDecision) => Promise<{ ok: boolean }>) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDetourDecide : null;
}

/** Linie wiatru, postoju, śliskości i objazdu w szczegółach ETA. */
export function etaWxOf(load: Load, loads: readonly Load[], nowIso: string): EtaWx[] {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return load.etaDetail?.weather ?? [];
  return demoEtaWx(load, nowIso, demoDetourLoadId(loads, null));
}

/**
 * Linie objazdu na mapie (E45; D-20261016-0230-01 Z3 pkt 8) — transporty z decyzją SCX „Jedziemy objazdem”, dopóki
 * decyzja obowiązuje. Produkcja: `[]` do podłączenia w P9 (pozycja E45) — serwer daje dla każdej obowiązującej decyzji
 * „objazd” `{ loadId, line, via, addKm, addMin }` (`line` = geometria HERE Routing z liczenia sprawy, `DetourOption.line`)
 * i wykonawca zmienia tylko tę gałąź (D-20261016-2130-01 pkt 3.2). Demo: decyzja zapisana w pamięci strony.
 */
export function detourLinesOf(loads: readonly Load[], nowIso: string): DetourLine[] {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return [];
  return demoDetourLines(loads, nowIso);
}

/** Nowa decyzja → mapa rysuje linie objazdu od nowa. Produkcja: przy odświeżeniu danych transportów (bez osobnego sygnału). */
export function subscribeDetourLines(f: () => void): () => void {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return () => {};
  return subscribeDemoDetours(f);
}
