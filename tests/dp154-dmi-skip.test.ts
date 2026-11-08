/**
 * DP-154 — DMI 0/5 (429/timeout/502): po 3 przebiegach bez odpowiedzi
 * pomijaj DMI 24 h z jednym ostrzeżeniem (persist dmi_skip_until).
 * Etap: C1 / BN5; źródło #762.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  clearDmiResponseCache,
  clearDmiSkip,
  DMI_SKIP_AFTER_FAILS,
  DMI_SKIP_MS,
  runFerryWeather,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const FMI_WAM = fx('fmi-wam-mid-2026-10-02.xml');
const FMI_GUST = fx('fmi-harmonie-gust-2026-10-02.xml');
const SMHI = fx('smhi-ocobs-knolls-latest.json');
const WX_NOW = new Date('2026-10-02T04:00:00Z');

class MemStore implements SyncStore {
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  marine: { maxWaveM: number | null; maxGustKn: number | null; risk: string; sources: string } | null = null;
  thr = { waveM: 3.8, gustKn: 40 };
  async projectId() { return 'p1'; }
  async vessels() { return [{ id: 'v1', name: 'M/F Wawel', mmsi: null }]; }
  async sailingsSince() { return [] as DbSailing[]; }
  async insertSailings(_rows: SailingInsert[]) { /* no-op */ }
  async updateSailing(_id: string, _patch: SailingPatch) { return false; }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r);
    return true;
  }
  async resolveRisks(prefix: string) {
    const n = this.risks.filter((r) => r.dedup.startsWith(prefix)).length;
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return n;
  }
  async latestPositions() { return []; }
  async lastRun(job: string) {
    return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null;
  }
  async recentJobResults(job: string, limit: number) {
    return this.runs.filter((r) => r.job === job).slice(-limit).reverse().map((r) => r.result);
  }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: WX_NOW.toISOString(), ok, result });
  }
  async opsThresholds() { return this.thr; }
  async saveMarineCondition(row: {
    maxWaveM: number | null; maxGustKn: number | null; risk: string; sources: string;
    detail?: { warnings?: string[] };
  }) {
    this.marine = {
      maxWaveM: row.maxWaveM, maxGustKn: row.maxGustKn, risk: row.risk, sources: row.sources,
    };
  }
}

function deps(
  store: MemStore,
  dmiStatus: number,
  now = WX_NOW,
): { d: JobDeps; dmiHits: { n: number } } {
  const dmiHits = { n: 0 };
  const d: JobDeps = {
    store,
    now: () => now,
    env: { DMI_REQUEST_GAP_MS: '0' },
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('forecast::wam')) {
        return new Response(FMI_WAM, { status: 200 });
      }
      if (url.includes('forecast::harmonie')) {
        return new Response(FMI_GUST, { status: 200 });
      }
      if (url.includes('forecastedr/collections/wam_nsb')) {
        dmiHits.n += 1;
        return new Response('busy', { status: dmiStatus });
      }
      if (url.includes('ocobs.smhi.se')) {
        return new Response(SMHI, { status: 200 });
      }
      if (url.includes('snow1g')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('winter-navigation') || url.includes('digitraffic')) {
        return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch,
  };
  return { d, dmiHits };
}

describe('DP-154 — DMI skip 24 h po 3 przebiegach bez odpowiedzi', () => {
  beforeEach(() => {
    clearDmiResponseCache();
    clearDmiSkip();
  });

  it('eksportuje próg 3 i okno 24 h', () => {
    expect(DMI_SKIP_AFTER_FAILS).toBe(3);
    expect(DMI_SKIP_MS).toBe(24 * 3600_000);
  });

  it('3× DMI 429 → dmi_skip_until; 4. przebieg bez HTTP DMI (jedno ostrzeżenie)', async () => {
    const st = new MemStore();
    let lastUntil: string | undefined;
    for (let i = 0; i < 3; i++) {
      const { d, dmiHits } = deps(st, 429);
      const r = await runFerryWeather(d);
      expect(r.ok).toBe(true);
      expect(dmiHits.n).toBeGreaterThan(0);
      expect(r.observations?.dmi).toBe('0');
      await st.recordRun('ferry-weather', r.ok, r);
      if (i < 2) {
        expect(r.dmi_skip_until).toBeUndefined();
      } else {
        lastUntil = r.dmi_skip_until;
        expect(lastUntil).toBe(new Date(WX_NOW.getTime() + DMI_SKIP_MS).toISOString());
        expect(r.warnings?.some((w) => /3 przebiegi bez odpowiedzi/.test(w))).toBe(true);
      }
    }

    clearDmiSkip();
    const fourth = deps(st, 429);
    const r4 = await runFerryWeather(fourth.d);
    expect(fourth.dmiHits.n).toBe(0);
    expect(r4.observations?.dmi_skipped).toBe('1');
    expect(r4.dmi_skip_until).toBe(lastUntil);
    expect(r4.warnings?.filter((w) => /DMI pominięte/.test(w))).toHaveLength(1);
    expect(r4.warnings?.some((w) => /DMI MID:/.test(w))).toBe(false);
  });

  it('sukces DMI czyści okno pominięcia', async () => {
    const st = new MemStore();
    for (let i = 0; i < 3; i++) {
      const { d } = deps(st, 429);
      const r = await runFerryWeather(d);
      await st.recordRun('ferry-weather', r.ok, r);
    }
    expect(st.runs.at(-1)?.result.dmi_skip_until).toBeTruthy();

    clearDmiSkip();
    const dmiBody = fx('dmi-wam-nsb-2026-10-02.json');
    const okHits = { n: 0 };
    const d: JobDeps = {
      store: st,
      now: () => WX_NOW,
      env: { DMI_REQUEST_GAP_MS: '0' },
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('forecast::wam')) return new Response(FMI_WAM, { status: 200 });
        if (url.includes('forecast::harmonie')) return new Response(FMI_GUST, { status: 200 });
        if (url.includes('forecastedr/collections/wam_nsb')) {
          okHits.n += 1;
          return new Response(dmiBody, { status: 200 });
        }
        if (url.includes('ocobs.smhi.se')) return new Response(SMHI, { status: 200 });
        if (url.includes('winter-navigation') || url.includes('digitraffic')) {
          return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
        }
        return new Response('missing', { status: 404 });
      }) as typeof fetch,
    };
    /* Po wygaśnięciu okna — wymuś nowy czas poza skip. */
    const after = new Date(WX_NOW.getTime() + DMI_SKIP_MS + 60_000);
    d.now = () => after;
    clearDmiSkip();
    /* Wyczyść skip_until z historii, żeby hydrate nie przywrócił okna. */
    st.runs = st.runs.map((x) => ({
      ...x,
      result: { ...x.result, dmi_skip_until: undefined },
    }));
    const r = await runFerryWeather(d);
    expect(okHits.n).toBeGreaterThan(0);
    expect(r.observations?.dmi).not.toBe('0');
    expect(r.dmi_skip_until).toBeUndefined();
  });
});
