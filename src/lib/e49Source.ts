/**
 * wyglad/E49 — skąd biorą się sprawy „Objazd czy postój?” i linie wiatru w ETA (D-20261016-0230-01 Z1, Z3, Z4).
 * Produkcja (DP-206 / DETOUR_E49): sprawy z `e49_detour_cases_open` (cache `e49Live`), zapis `e49_detour_decide`.
 * Demo: przykład z `e49Demo.ts`. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { getSupabase } from '../auth/client';
import type { Load, OrgKind } from '../types';
import type { DetourCase, DetourDecision, DetourLine } from './e49Detour';
import type { EtaWx } from './e49Wx';
import { liveDetourCases } from './e49Live';
import { demoClosureLoad, demoDetourCase, demoDetourDecide, demoDetourLines, demoEtaWx, subscribeDemoDetours } from './e49Demo';
import { serverRuleOn } from './serverRules';

/** Transport demo ze sprawą: pierwszy w drodze przez Szwecję, który ma już kartę w „Do zrobienia” (liczba E7-2 bez zmian). */
export function demoDetourLoadId(loads: readonly Load[], cardLoads: ReadonlySet<string> | null): string | null {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return null;
  const se = loads.filter((l) => l.status === 'IN_TRANSIT_SE' && (!cardLoads || cardLoads.has(l.id)));
  return (se.find(demoClosureLoad) ?? se[0])?.id ?? null;
}

/** Sprawy „Objazd czy postój?” bez decyzji (po decyzji sprawa się zamyka). KSH — nic (E7: sprawy SCX). */
export function detourCasesOf(role: OrgKind, loads: readonly Load[], nowIso: string, cardLoads: ReadonlySet<string>): DetourCase[] {
  if (role === 'KSH') return [];
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
    if (!serverRuleOn('DETOUR_E49')) return [];
    const loadIds = new Set(loads.map((l) => l.id));
    void cardLoads;
    return liveDetourCases().filter((c) => !c.decision && loadIds.has(c.loadId));
  }
  const id = demoDetourLoadId(loads, cardLoads);
  const load = id ? loads.find((l) => l.id === id) : undefined;
  if (!load) return [];
  const c = demoDetourCase(load, nowIso);
  return c.decision ? [] : [c];
}

async function liveDetourDecide(id: string, d: DetourDecision): Promise<{ ok: boolean }> {
  const sb = await getSupabase();
  if (!sb) return { ok: false };
  const r = await sb.rpc('e49_detour_decide', {
    p_case: id,
    p_pick: d.pick,
    p_note: d.note,
  });
  return { ok: !r.error && r.data === true };
}

/** Zapis decyzji SCX (wpis w Historii, powiadomienie HHL, ETA według wyboru — serwer). null = nie podłączone. */
export function detourDecideOf(): ((id: string, d: DetourDecision) => Promise<{ ok: boolean }>) | null {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
    return serverRuleOn('DETOUR_E49') ? liveDetourDecide : null;
  }
  return demoDetourDecide;
}

/** Linie wiatru, postoju, śliskości i objazdu w szczegółach ETA. */
export function etaWxOf(load: Load, loads: readonly Load[], nowIso: string): EtaWx[] {
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') return load.etaDetail?.weather ?? [];
  return demoEtaWx(load, nowIso, demoDetourLoadId(loads, null));
}

/**
 * Linie objazdu na mapie (E45; D-20261016-0230-01 Z3 pkt 8) — transporty z decyzją SCX „Jedziemy objazdem”.
 * Produkcja: geometria z payload po decyzji — na razie `[]` do E45/P9 (decyzja w Historii już jest).
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
