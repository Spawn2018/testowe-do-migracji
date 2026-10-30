/**
 * B1/N1 (F7 #674): lista statków sesji (DP-17) jako stan zewnętrzny — Mapa i Kokpit przeliczają dymki
 * po pobraniu listy z bazy (zmiana referencji = zależność efektów i memo).
 */
import { useSyncExternalStore } from 'react';
import { currentVesselGroups, subscribeVesselGroups, type VesselGroup } from './vesselGroups';

export function useVesselGroups(): readonly VesselGroup[] {
  return useSyncExternalStore(subscribeVesselGroups, currentVesselGroups, currentVesselGroups);
}
