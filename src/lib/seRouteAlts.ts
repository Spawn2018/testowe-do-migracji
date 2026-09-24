/**
 * D25 / L1 — SE road route alternatives (RisksView).
 * Choosing an option mutates ROAD_SE risk + linked load (not toast-only).
 */
export const SE_ROUTE_ALTS = [
  {
    id: 'e18',
    title: 'E4 → E18 via Västerås / Uppsala',
    detail: 'Omija roboty E4 Gävle–Söderhamn · +45–70 min · zalecane przy wysokim ryzyku',
    delayMin: 60,
  },
  {
    id: 'rv83',
    title: 'E4 → Rv 83 / Rv 84 (Ljusdal – Ånge)',
    detail: 'Objazd śnieżycy środkowego Norrland · +90–120 min · zima',
    delayMin: 105,
  },
  {
    id: 'rail',
    title: 'Kolej + ostatnia mila (Boden rail terminal)',
    detail: 'Gdy siła wyższa na E4 północ · przeładunek SE · +1–2 doby',
    delayMin: 24 * 60,
  },
  {
    id: 'pause',
    title: 'Pauza w Gävle / Sundsvall + nowy slot Boden',
    detail: 'Gdy okno Stegra nie dotrzymane · unikaj nocnego podejścia placu',
    delayMin: 8 * 60,
  },
] as const;

export type SeRouteAlt = (typeof SE_ROUTE_ALTS)[number];
