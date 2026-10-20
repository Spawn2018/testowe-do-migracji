/**
 * D-20261020-1118-01 (właściciel 20.10.2026, 11:18): zezwolenie „Firma” albo „Trasa” według tabeli symboli.
 * Firma (BS-A, BS-B, BS-C, PL-A, PL-B, SG, SS, T, TS) — jedno zezwolenie firmowe, podpięte samo;
 * Trasa (KR) — zezwolenie PL i zezwolenie SE przy transporcie, jak dotąd.
 */
import type { DocCategory, Load } from '../types';
import type { PermitView } from './p5Source';
import { symbolSpecOf } from './p7Source';

/** Transport z zezwoleniem firmowym (tabela symboli); bez symbolu w tabeli — jak dotąd (PL i SE). */
export function firmPermitLoad(load: Load): boolean {
  return symbolSpecOf(load)?.permit === 'FIRMA';
}

const ROUTE_PERMITS: ReadonlySet<DocCategory> = new Set<DocCategory>(['PERMIT_PL', 'PERMIT_SE']);

/** Przy zezwoleniu firmowym wiersze „Zezwolenie PL / SE” nie należą do transportu. */
export function withoutRoutePermits<T extends { category: DocCategory }>(rows: readonly T[], firm: boolean): T[] {
  return firm ? rows.filter((r) => !ROUTE_PERMITS.has(r.category)) : [...rows];
}

/** Zezwolenie firmowe ważne w dniu załadunku (najdłużej ważne pierwsze); null — brak. */
export function firmPermitFor(load: Pick<Load, 'plannedLoadDate'>, permits: readonly PermitView[] | null): PermitView | null {
  if (!permits) return null;
  const day = (load.plannedLoadDate ?? '').slice(0, 10);
  const firm = permits.filter((p) => p.scope === 'FIRMA' && p.number);
  const valid = firm.filter((p) => (!p.validFrom || !day || p.validFrom.slice(0, 10) <= day) && (!p.validTo || !day || day <= p.validTo.slice(0, 10)));
  const pick = (valid.length ? valid : []).sort((a, b) => ((b.validTo ?? '') < (a.validTo ?? '') ? -1 : 1));
  return pick[0] ?? null;
}
