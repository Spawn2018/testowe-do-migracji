/**
 * ANEKS 4 PR4 — logika kontroli limitów planu darmowego (czysta, testowana w Vitest).
 * Limity liczone dziesiętnie (500 MB = 500 000 000 B) — ostrożniej niż 1024², alarm wcześniej.
 */
export type UsageMetric = 'DB_BYTES' | 'STORAGE_BYTES' | 'EDGE_INVOCATIONS' | 'EGRESS_BYTES';
export const FREE_QUOTAS: Record<UsageMetric, number> = {
  DB_BYTES: 500_000_000,
  STORAGE_BYTES: 1_000_000_000,
  EDGE_INVOCATIONS: 500_000,
  EGRESS_BYTES: 5_000_000_000,
};
export const WARN_PCT = 70;
export const HIGH_PCT = 85;

export type UsageLevel = 'OK' | 'WARN' | 'HIGH';
export function levelFor(used: number, quota: number): { pct: number; level: UsageLevel } {
  const pct = Math.round((used * 10000) / quota) / 100;
  return { pct, level: pct >= HIGH_PCT ? 'HIGH' : pct >= WARN_PCT ? 'WARN' : 'OK' };
}

export interface Measure { db_bytes: number; storage_bytes: number; edge_invocations_approx: number }
/** Pomiary do zapisu. Wywołania Edge i transfer z API zarządzania (opcjonalne) mają pierwszeństwo przed przybliżeniem. */
export function measurements(m: Measure, mgmt?: { edge_invocations?: number; egress_bytes?: number }) {
  const out: { metric: UsageMetric; used: number; quota: number; source: string }[] = [
    { metric: 'DB_BYTES', used: m.db_bytes, quota: FREE_QUOTAS.DB_BYTES, source: 'pg_database_size' },
    { metric: 'STORAGE_BYTES', used: m.storage_bytes, quota: FREE_QUOTAS.STORAGE_BYTES, source: 'storage.objects' },
    mgmt?.edge_invocations != null
      ? { metric: 'EDGE_INVOCATIONS', used: mgmt.edge_invocations, quota: FREE_QUOTAS.EDGE_INVOCATIONS, source: 'management-api' }
      : { metric: 'EDGE_INVOCATIONS', used: m.edge_invocations_approx, quota: FREE_QUOTAS.EDGE_INVOCATIONS, source: 'integration_runs (przybliżenie)' },
  ];
  if (mgmt?.egress_bytes != null) out.push({ metric: 'EGRESS_BYTES', used: mgmt.egress_bytes, quota: FREE_QUOTAS.EGRESS_BYTES, source: 'management-api' });
  return out;
}

const fmt = (n: number) => new Intl.NumberFormat('pl-PL').format(n);
export function alertEmail(rows: { metric: string; pct: number; used: number; quota: number; title?: string }[]) {
  const lines = rows.map((r) => `• ${r.title ?? r.metric}: ${fmt(r.used)} z ${fmt(r.quota)}`);
  return {
    subject: `Watch Tower: przekroczone ${HIGH_PCT}% limitu planu darmowego`,
    text: ['Codzienna kontrola limitów (usage-check) wykryła:', ...lines, '',
      'Co zrobić: sprawdź panel Supabase i historię usage_history; przy plikach — archiwizacja (PR7).'].join('\n'),
  };
}
