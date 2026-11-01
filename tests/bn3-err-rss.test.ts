/**
 * BN3 decyzja 61 pkt 3 — RSS ERR (news.err.ee); Yle = W64 STOP.
 * Etap: BN3 / #573.
 */
import { describe, expect, it } from 'vitest';
import {
  ERR_RSS_URL,
  errRssCancelRisk,
  errRssEvidenceNote,
  filterErrFerryCancel,
  parseErrRss,
} from '../supabase/functions/_shared/ferry/errRss';
import { applyErrRssConfirmations, type JobDeps, type SyncStore } from '../supabase/functions/_shared/integrations/jobs';
import type { RiskInput } from '../supabase/functions/_shared/integrations/sync';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<title>news | ERR</title>
<item>
  <title><![CDATA[Tallink cancels MyStar trips on Monday due to a malfunction]]></title>
  <link>https://news.err.ee/1610177011/tallink-cancels-mystar-trips</link>
  <guid>https://news.err.ee/1610177011</guid>
  <description><![CDATA[Ferry operator Tallink has canceled the passenger ferry MyStar's sailings.]]></description>
  <pubDate>Mon, 26 Oct 2026 08:00:00 +0300</pubDate>
</item>
<item>
  <title><![CDATA[Viking Line XPRS schedule unchanged]]></title>
  <link>https://news.err.ee/999/viking-ok</link>
  <guid>https://news.err.ee/999</guid>
  <description><![CDATA[Viking Line says XPRS runs as planned.]]></description>
</item>
<item>
  <title><![CDATA[Storm prompts Eckerö and Viking to cancel Tallinn-Helsinki ferries]]></title>
  <link>https://news.err.ee/1135991/storm-cancel</link>
  <guid>https://news.err.ee/1135991</guid>
  <description><![CDATA[Eckerö and Viking cancelled many services after the storm.]]></description>
</item>
<item>
  <title><![CDATA[Prime minister speaks about Russia]]></title>
  <link>https://news.err.ee/1/politics</link>
  <guid>https://news.err.ee/1</guid>
  <description><![CDATA[Politics only — no ferry.]]></description>
</item>
</channel></rss>`;

function makeStore() {
  const risks: (RiskInput & { loadId?: string })[] = [];
  let notices = 0;
  const store = {
    risks,
    get notices() { return notices; },
    async raiseRisk(r: RiskInput & { loadId?: string }) {
      if (risks.some((x) => x.dedup === r.dedup)) return false;
      risks.push(r);
      return true;
    },
    async resolveRisks() {},
    async resolveStaleRisks() {},
    async insertOperatorNotice() {
      notices += 1;
      return 'n1';
    },
    async vessels() { return []; },
    async sailingsSince() { return []; },
  };
  return store as unknown as typeof store & SyncStore;
}

describe('BN3 ERR RSS', () => {
  it('parseErrRss wyciąga itemy z CDATA', () => {
    const { items, warnings } = parseErrRss(SAMPLE);
    expect(warnings).toEqual([]);
    expect(items).toHaveLength(4);
    expect(items[0]!.title).toContain('Tallink cancels MyStar');
    expect(items[0]!.link).toContain('1610177011');
  });

  it('filtr: armator+cancel; bez samego Viking bez cancel; bez polityki', () => {
    const { items } = parseErrRss(SAMPLE);
    const hits = filterErrFerryCancel(items);
    expect(hits.map((h) => h.item.guid)).toEqual([
      'https://news.err.ee/1610177011',
      'https://news.err.ee/1135991',
    ]);
    expect(hits[0]!.operators).toContain('TALLINK');
    expect(hits[1]!.operators).toEqual(expect.arrayContaining(['VIKING', 'ECKERO']));
  });

  it('ryzyko MEDIUM + sourceUrl artykułu; cytat ≤400', () => {
    const hit = filterErrFerryCancel(parseErrRss(SAMPLE).items)[0]!;
    const risk = errRssCancelRisk(hit);
    expect(risk.severity).toBe('MEDIUM');
    expect(risk.titleKey).toBe('rk_ferry_err_rss_cancel');
    expect(risk.sourceUrl).toBe(hit.item.link);
    expect(risk.dedup).toBe(`FERRY_ERR_RSS:${hit.item.guid}`);
    expect(errRssEvidenceNote(hit).length).toBeLessThanOrEqual(400);
    expect(errRssEvidenceNote(hit)).toContain(hit.item.link);
  });

  it('struktura zła → SOURCE_DOWN:ERR_RSS; bez notice ODWOLANY', async () => {
    const store = makeStore();
    const deps: JobDeps = {
      now: () => new Date('2026-11-01T10:00:00Z'),
      store,
      env: {},
      fetch: async () => new Response('<html>not rss</html>', { status: 200 }),
    };
    const r = await applyErrRssConfirmations(deps, '2026-10-31T00:00:00Z');
    expect(r.hits).toBe(0);
    expect(r.risks).toBe(1);
    expect(store.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:ERR_RSS'))).toBe(true);
    expect(store.notices).toBe(0);
  });

  it('job: 2 ryzyka FERRY_ERR_RSS, 0 operator_notices (decyzja 69)', async () => {
    const store = makeStore();
    const deps: JobDeps = {
      now: () => new Date('2026-11-01T10:00:00Z'),
      store,
      env: {},
      fetch: async () => new Response(SAMPLE, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      }),
    };
    const r = await applyErrRssConfirmations(deps, '2026-10-31T00:00:00Z');
    expect(r.hits).toBe(2);
    expect(r.risks).toBe(2);
    expect(store.notices).toBe(0);
    expect(store.risks.every((x) => x.dedup.startsWith('FERRY_ERR_RSS:'))).toBe(true);
    expect(store.risks[0]!.detail).toMatchObject({ zrodlo: 'ERR_RSS' });
    expect(String((store.risks[0]!.detail as { cytat?: string }).cytat ?? '')).toContain('news.err.ee');
  });

  it('URL feedu = news.err.ee/rss (bez Yle)', () => {
    expect(ERR_RSS_URL).toBe('https://news.err.ee/rss');
    expect(ERR_RSS_URL).not.toMatch(/yle/i);
  });
});
