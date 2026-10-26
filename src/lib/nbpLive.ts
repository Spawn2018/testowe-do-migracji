/**
 * Finanse › Kurs NBP — aktualny kurs EUR z tabeli A (`fx_rates`, cron `tower-kurs-nbp` 10:30/14:30 UTC).
 * Właściciel 25.10.2026 21:33: karta pokazywała 199/A/NBP/2026 z 13.10 (najnowszy kurs zapisany przy jakimś transporcie),
 * a ma zawsze podawać kurs bieżący. Transporty dostarczone nadal liczą się kursem z dnia przed rozładunkiem (zapisanym przy transporcie).
 * Demo / brak sesji → null (widok wraca do kursu z transportów). Warunek `import.meta.env.VITE_AUTH_MODE` wprost (strażnik I-0).
 */
import { useEffect, useState } from 'react';
import type { FinNbp } from './p5Finance';

type Row = { rate_date: string; rate_pln: number | string; table_no: string | null };

let cache: FinNbp | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const TTL_MS = 30 * 60_000;

/** Wiersz `fx_rates` → kurs do karty; null przy brakach. */
export function nbpFromRow(r: Row | null | undefined): FinNbp | null {
  if (!r) return null;
  const mid = Number(r.rate_pln);
  if (!(mid > 0) || !r.rate_date) return null;
  return { tableNo: r.table_no ?? '—', date: r.rate_date.slice(0, 10), mid };
}

async function load(): Promise<void> {
  try {
    const { getSupabase } = await import('../auth/client');
    const sb = await getSupabase();
    const q = await sb.from('fx_rates').select('rate_date,rate_pln,table_no')
      .eq('currency', 'EUR').order('rate_date', { ascending: false }).limit(1).maybeSingle();
    if (q.error) return;
    cache = nbpFromRow(q.data as Row | null);
    loadedAt = Date.now();
    subs.forEach((f) => f());
  } catch {
    /* brak sesji — karta zostaje przy kursie z transportów */
  }
}

/** Aktualny kurs EUR (NBP, tabela A) albo null; odświeża co 30 min. */
export function useLatestNbp(): FinNbp | null {
  const [v, setV] = useState<FinNbp | null>(cache);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return undefined;
    const f = () => setV(cache);
    subs.add(f);
    const tick = () => { if (!loading && Date.now() - loadedAt > TTL_MS) loading = load().finally(() => { loading = null; }); };
    tick();
    const id = window.setInterval(tick, 5 * 60_000);
    return () => { subs.delete(f); window.clearInterval(id); };
  }, []);
  return v;
}
