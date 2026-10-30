/**
 * DP-8, DP-16, DP-17: odczyt `vessels` tylko w paczce produkcyjnej (I-2: paczka demo bez klienta Supabase).
 * Jedna pamięć podręczna dla Rejsów i map.
 */
import { SUPABASE_AUTH_ENABLED } from '../auth/config';
import { createVesselsLoader, type VesselsLoader } from './vesselGroups';

export const vesselsLoader: VesselsLoader | null = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED
  ? createVesselsLoader(() => import('../data/vesselsServer').then((m) => m.loadVesselGroups()))
  : null;
