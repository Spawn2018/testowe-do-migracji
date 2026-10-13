import type { Load, RoleId, CorridorStage } from '../types';
import { filterLoadsForRole } from './permissions';
import { transportSearchBlob } from './transportName';

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
        /* E41 (P2): HHL kod + oba numery, SCX kod + swój i HHL, KSH tylko kod. */
        transportSearchBlob(l, role).includes(q) ||
        (l.resources.driverName ?? '').toLowerCase().includes(q) ||
        (l.resources.tractorPlate ?? '').toLowerCase().includes(q),
    );
  }
  return list;
}
