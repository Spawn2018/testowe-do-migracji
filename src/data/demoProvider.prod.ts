/**
 * I-0 — build produkcyjny: zamiennik `src/data/demoProvider.ts` bez danych demo (wtyczka `i0-demo-swap`).
 */
import { emptySnapshot, type DataProvider, type DataSnapshot } from './provider';

export const DEMO_TODAY_LOCAL = '';

export function buildDemoSnapshot(): DataSnapshot {
  return emptySnapshot();
}

export const demoProvider: DataProvider = {
  kind: 'demo',
  loadSnapshot: async () => emptySnapshot(),
  apply: async () => undefined,
};
