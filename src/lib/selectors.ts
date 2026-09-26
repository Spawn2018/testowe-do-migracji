import type { Load, RoleId, CorridorStage } from '../types';
import { filterLoadsForRole } from './permissions';

export function filterLoads(
  loads: Load[],
  role: RoleId,
  stageFilter: CorridorStage | null,
  search: string,
): Load[] {
  let list = filterLoadsForRole(loads, role);
  if (stageFilter) list = list.filter((l) => l.stage === stageFilter);
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        (l.resources.driverName ?? '').toLowerCase().includes(q) ||
        (l.resources.tractorPlate ?? '').toLowerCase().includes(q) ||
        /* M5 — wyszukiwanie po numerach zleceń KSH / HHL / SCX */
        [l.orderNo, l.hhlOrderNo, l.carrierOrderNo].some((n) => (n ?? '').toLowerCase().includes(q)),
    );
  }
  return list;
}
