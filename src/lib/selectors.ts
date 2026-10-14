import type { Load, RoleId } from '../types';
import { stageTileOf, type StageTile } from './stageTiles';
import { filterLoadsForRole } from './permissions';
import { transportSearchBlob } from './transportName';

export function filterLoads(
  loads: Load[],
  role: RoleId,
  stageFilter: StageTile | null,
  search: string,
): Load[] {
  let list = filterLoadsForRole(loads, role);
  /* wyglad/P4 (E28): kafelek według statusu E25 (src/lib/stageTiles.ts), jeden filtr dla Harmonogramu i Mapy */
  if (stageFilter) list = list.filter((l) => stageTileOf(l) === stageFilter);
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
