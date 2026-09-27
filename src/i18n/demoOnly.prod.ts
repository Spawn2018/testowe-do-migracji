/** I-0 — build produkcyjny: puste słowniki zamiast `demoOnly.ts` (wtyczka Vite `i0-demo-swap`). */
import type { Locale } from '../types';

type Dict = Record<string, string>;
const empty = (): Record<Locale, Dict> => ({ pl: {}, en: {}, sv: {} });

export const DEMO_ONLY_I18N: { RISK: Record<Locale, Dict>; ETAP4: Record<Locale, Dict> } = { RISK: empty(), ETAP4: empty() };
