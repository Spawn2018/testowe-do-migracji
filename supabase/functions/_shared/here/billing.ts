/**
 * D-78 / H-2-PL — koszt HERE tylko ponad darmową pulę (tiles / routing / traffic).
 * koszt = max(0, zapytania − pula) × stawka. Budżet 100 USD i progi 50/80/100%
 * liczą wyłącznie ten koszt ponad pule. Stawki i pule są w app_parameters (nie w kodzie).
 */
export interface HereBillingParams {
  budgetUsd: number;
  tilesFree: number;
  routesFree: number;
  trafficFree: number;
  tilesRateUsd: number;
  routesRateUsd: number;
  trafficRateUsd: number;
}

/** Wartości wstępne do potwierdzenia właściciela (05.10). */
export const HERE_BILLING_DEFAULTS: HereBillingParams = {
  budgetUsd: 100,
  tilesFree: 30000,
  routesFree: 5000,
  trafficFree: 5000,
  tilesRateUsd: 0.0002,
  routesRateUsd: 0.00275,
  trafficRateUsd: 0.00292,
};

export type HereService = 'tiles' | 'routing' | 'matching' | 'attributes' | 'traffic';

export function overPoolCost(requests: number, freePool: number, rateUsd: number): number {
  const n = Math.max(0, Number(requests) || 0);
  const free = Math.max(0, Number(freePool) || 0);
  const rate = Math.max(0, Number(rateUsd) || 0);
  return Math.max(0, n - free) * rate;
}

export function poolFor(service: HereService, p: HereBillingParams): number {
  if (service === 'tiles') return p.tilesFree;
  if (service === 'traffic') return p.trafficFree;
  // matching i historyczne attributes liczą się w puli tras (jedna stawka trasy)
  return p.routesFree;
}

export function rateFor(service: HereService, p: HereBillingParams): number {
  if (service === 'tiles') return p.tilesRateUsd;
  if (service === 'traffic') return p.trafficRateUsd;
  return p.routesRateUsd;
}

export function serviceOverCost(service: HereService, requests: number, p: HereBillingParams): number {
  return overPoolCost(requests, poolFor(service, p), rateFor(service, p));
}

/** Przyrost kosztu ponad pulę po dodaniu `more` zapytań danej usługi. */
export function marginalOverCost(
  service: HereService,
  currentRequests: number,
  more: number,
  p: HereBillingParams,
): number {
  const before = serviceOverCost(service, currentRequests, p);
  const after = serviceOverCost(service, currentRequests + Math.max(0, more), p);
  return Math.max(0, after - before);
}

export function budgetLevel(
  overUsd: number,
  enabled: boolean,
  budgetUsd = HERE_BILLING_DEFAULTS.budgetUsd,
): 'off' | 'ok' | 'warn' | 'high' | 'stop' {
  if (!enabled) return 'off';
  const budget = budgetUsd > 0 ? budgetUsd : HERE_BILLING_DEFAULTS.budgetUsd;
  const pct = (overUsd / budget) * 100;
  if (pct >= 100) return 'stop';
  if (pct >= 80) return 'high';
  if (pct >= 50) return 'warn';
  return 'ok';
}

/** Kafelki → zapas od 80% kosztu ponad pule. */
export function tilesOpen(overUsd: number, budgetUsd = HERE_BILLING_DEFAULTS.budgetUsd): boolean {
  const budget = budgetUsd > 0 ? budgetUsd : HERE_BILLING_DEFAULTS.budgetUsd;
  return overUsd < budget * 0.8;
}

/** Czy wolno dodać `more` zapytań routing/matching (stop przy 100%). */
export function routingAllows(
  currentOverUsd: number,
  service: Exclude<HereService, 'tiles'>,
  currentRequests: number,
  more: number,
  p: HereBillingParams,
): boolean {
  if (currentOverUsd >= p.budgetUsd - 1e-9) return false;
  const add = marginalOverCost(service, currentRequests, more, p);
  return currentOverUsd + add <= p.budgetUsd + 1e-9;
}
