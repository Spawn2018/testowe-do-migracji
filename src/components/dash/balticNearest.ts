/** BN9-c6 — czysty pomocnik Kokpitu: najbliższy rejs armatorów bałtyckich z `CrossingMap` (widok `BalticFerries`). */
import type { Sailing } from '../../types';
import { LEGACY_OPERATORS, catalogOperators, operatorName } from '../../lib/ferryCatalog';
import { effDeparture, type CrossingMap } from '../../lib/sailings';

export type BalticFerry = { op: string; name: string; sailing: Sailing };

/** Najbliższy rejs każdego armatora spoza Polska – Szwecja (kolejność słownika: seed, potem armatorzy z bazy). */
export function balticNearest(near: CrossingMap): BalticFerry[] {
  const out: BalticFerry[] = [];
  for (const o of catalogOperators()) {
    if (LEGACY_OPERATORS.includes(o.code)) continue;
    const s = near[o.code]?.[0];
    if (s) out.push({ op: o.code, name: o.name || operatorName(o.code), sailing: s });
  }
  return out.sort((a, b) => Date.parse(effDeparture(a.sailing)) - Date.parse(effDeparture(b.sailing)));
}

/** BN9-c6: najbliższy rejs Polska – Szwecja (Polferries / Stena) do kafelka „Najbliższy prom”; brak — null. */
export function plSeNearest(near: CrossingMap): Sailing | null {
  return LEGACY_OPERATORS.map((op) => near[op]?.[0]).filter((x): x is Sailing => !!x)
    .sort((a, b) => Date.parse(effDeparture(a)) - Date.parse(effDeparture(b)))[0] ?? null;
}
