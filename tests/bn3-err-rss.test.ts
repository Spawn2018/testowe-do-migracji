/**
 * BN3 decyzja 61 pkt 3 / F7 #699 r2 — RSS ERR (news.err.ee); Yle = W64 STOP.
 * Decyzja 80: domyślnie włączone (zgoda ERR); env=0 → wyłącznik awaryjny.
 * Etap: BN3 / #573.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ERR_RSS_URL,
  errRssCancelRisk,
  errRssEvidenceNote,
  filterErrFerryCancel,
  isErrRssEnabled,
  isErrRssItemFresh,
  parseErrRss,
} from '../supabase/functions/_shared/ferry/errRss';
import { applyErrRssConfirmations, type JobDeps, type SyncStore } from '../supabase/functions/_shared/integrations/jobs';
import type { RiskInput } from '../supabase/functions/_shared/integrations/sync';

const NOW = new Date('2026-11-01T10:00:00Z');
const FRESH_PUB = 'Sun, 01 Nov 2026 08:00:00 +0200';
const ARCHIVE_PUB = 'Mon, 26 Oct 2026 08:00:00 +0300';

function itemXml(opts: {
  title: string; link: string; guid: string; description: string; pubDate?: string | null;
}): string {
  const pub = opts.pubDate === null
    ? ''
    : `<pubDate>${opts.pubDate ?? FRESH_PUB}</pubDate>`;
  return `<item>
  <title><![CDATA[${opts.title}]]></title>
  <link>${opts.link}</link>
  <guid>${opts.guid}</guid>
  <description><![CDATA[${opts.description}]]></description>
  ${pub}
</item>`;
}

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<title>news | ERR</title>
${itemXml({
  title: 'Tallink cancels MyStar trips on Monday due to a malfunction',
  link: 'https://news.err.ee/1610177011/tallink-cancels-mystar-trips',
  guid: 'https://news.err.ee/1610177011',
  description: 'Ferry operator Tallink has canceled the passenger ferry MyStar\'s sailings.',
})}
${itemXml({
  title: 'Viking Line XPRS schedule unchanged',
  link: 'https://news.err.ee/999/viking-ok',
  guid: 'https://news.err.ee/999',
  description: 'Viking Line says XPRS runs as planned.',
})}
${itemXml({
  title: 'Storm prompts Eckerö and Viking to cancel Tallinn-Helsinki ferries',
  link: 'https://news.err.ee/1135991/storm-cancel',
  guid: 'https://news.err.ee/1135991',
  description: 'Eckerö and Viking cancelled many ferry services after the storm.',
})}
${itemXml({
  title: 'Prime minister speaks about Russia',
  link: 'https://news.err.ee/1/politics',
  guid: 'https://news.err.ee/1',
  description: 'Politics only — no ferry.',
})}
</channel></rss>`;

function makeStore(opts?: { knownDedup?: Set<string> }) {
  const risks: (RiskInput & { loadId?: string })[] = [];
  const closed = new Set<string>(opts?.knownDedup ?? []);
  let notices = 0;
  let staleCalls: { prefix: string; keep: string[] }[] = [];
  const store = {
    risks,
    staleCalls,
    get notices() { return notices; },
    async raiseRisk(r: RiskInput & { loadId?: string }) {
      if (risks.some((x) => x.dedup === r.dedup && !(x as { resolved?: boolean }).resolved)) return false;
      risks.push(r);
      return true;
    },
    async hasRiskDedup(dedup: string) {
      return closed.has(dedup) || risks.some((x) => x.dedup === dedup);
    },
    async resolveRisks(prefix: string) {
      for (const r of risks) {
        if (r.dedup.startsWith(prefix.replace(/%$/, ''))) {
          (r as { resolved?: boolean }).resolved = true;
        }
      }
    },
    async resolveStaleRisks(prefix: string, keep: string[]) {
      staleCalls.push({ prefix, keep: [...keep] });
      const keepSet = new Set(keep);
      for (const r of risks) {
        if (r.dedup.startsWith(prefix) && !keepSet.has(r.dedup)) {
          (r as { resolved?: boolean }).resolved = true;
        }
      }
      return 0;
    },
    async insertOperatorNotice() {
      notices += 1;
      return 'n1';
    },
    async vessels() { return []; },
    async sailingsSince() { return []; },
  };
  return store as unknown as typeof store & SyncStore;
}

function depsOf(store: SyncStore, fetchImpl: typeof fetch, env: Record<string, string | undefined> = {}): JobDeps {
  return {
    now: () => NOW,
    store,
    env,
    fetch: fetchImpl,
  };
}

describe('BN3 ERR RSS', () => {
  it('parseErrRss wyciąga itemy z CDATA; strip HTML w tytule', () => {
    const dirty = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>&lt;b&gt;Tallink&lt;/b&gt; cancels</title><link>https://news.err.ee/x</link><guid>g</guid><description>d</description></item>
</channel></rss>`;
    const { items, warnings } = parseErrRss(SAMPLE);
    expect(warnings).toEqual([]);
    expect(items).toHaveLength(4);
    expect(items[0]!.title).toContain('Tallink cancels MyStar');
    const stripped = parseErrRss(dirty).items[0]!;
    expect(stripped.title).toBe('Tallink cancels');
    expect(stripped.title).not.toMatch(/</);
  });

  it('filtr AND: armator + cancel + kontekst promowy; bez polityki', () => {
    const { items } = parseErrRss(SAMPLE);
    const hits = filterErrFerryCancel(items);
    expect(hits.map((h) => h.item.guid)).toEqual([
      'https://news.err.ee/1610177011',
      'https://news.err.ee/1135991',
    ]);
    expect(hits[0]!.operators).toContain('TALLINK');
    expect(hits[1]!.operators).toEqual(expect.arrayContaining(['VIKING', 'ECKERO']));
  });

  it('M1: OR zamiast AND nie przechodzi — sam cancel bez armatora / bez kontekstu', () => {
    const items = parseErrRss(`<?xml version="1.0"?><rss version="2.0"><channel>
${itemXml({
  title: 'Government cancels holiday ferry subsidy',
  link: 'https://news.err.ee/sub',
  guid: 'sub',
  description: 'Budget news about ferry subsidy cancellation.',
})}
${itemXml({
  title: 'Tallink reports Q3 results',
  link: 'https://news.err.ee/q3',
  guid: 'q3',
  description: 'Tallink ferry operator earnings — sailings as planned.',
})}
</channel></rss>`).items;
    /* pierwsze: cancel+ferry, ale brak armatora/statku z listy */
    expect(filterErrFerryCancel([items[0]!])).toEqual([]);
    /* drugie: Tallink+ferry, brak cancel */
    expect(filterErrFerryCancel([items[1]!])).toEqual([]);
  });

  it('B5/M2: Peru/Superuser bez trafienia (także z armatorem+kontekstem); Finlandia=Eckerö; trip/cancellations', () => {
    const cases = parseErrRss(`<?xml version="1.0"?><rss version="2.0"><channel>
${itemXml({
  title: 'Peru cancels trade summit with Finland',
  link: 'https://news.err.ee/peru',
  guid: 'peru',
  description: 'Diplomatic news from Peru.',
})}
${itemXml({
  title: 'Tallink ferry passengers fly to Peru for the summit',
  link: 'https://news.err.ee/peru2',
  guid: 'peru2',
  description: 'Tallink ferry passengers on a tourism trip to Peru.',
})}
${itemXml({
  title: 'Superuser cancelled account after breach',
  link: 'https://news.err.ee/su',
  guid: 'su',
  description: 'IT security note.',
})}
${itemXml({
  title: 'Tallink ferry portal Superuser login guide',
  link: 'https://news.err.ee/su2',
  guid: 'su2',
  description: 'How a Tallink ferry booking Superuser account works online.',
})}
${itemXml({
  title: 'Tallink cancels share buyback programme',
  link: 'https://news.err.ee/buy',
  guid: 'buy',
  description: 'Corporate finance — Tallink share buyback cancelled.',
})}
${itemXml({
  title: 'Viking ship museum cancelled exhibition',
  link: 'https://news.err.ee/museum',
  guid: 'museum',
  description: 'Culture: Viking ship museum cancelled the show.',
})}
${itemXml({
  title: 'Vikings cancelled the ferry crossing to Helsinki',
  link: 'https://news.err.ee/vikings',
  guid: 'vikings',
  description: 'History exhibit about Norse Vikings — museum ferry crossing story.',
})}
${itemXml({
  title: 'Finlandia ferry cancels evening departure',
  link: 'https://news.err.ee/fin',
  guid: 'fin',
  description: 'Eckerö Line vessel Finlandia cancels sailing to Helsinki.',
})}
${itemXml({
  title: 'Tallink announces cancellations of morning trips to Helsinki',
  link: 'https://news.err.ee/ok',
  guid: 'ok',
  description: 'Ferry cancellations on the Tallinn route.',
})}
${itemXml({
  title: 'Tallink will not cancel tonight ferry sailing',
  link: 'https://news.err.ee/neg',
  guid: 'neg',
  description: 'Operator confirms Tallink will not cancel the ferry sailing.',
})}
</channel></rss>`).items;
    expect(filterErrFerryCancel([cases[0]!])).toEqual([]);
    expect(filterErrFerryCancel([cases[1]!])).toEqual([]); /* M2c Peru + Tallink + ferry */
    expect(filterErrFerryCancel([cases[2]!])).toEqual([]);
    expect(filterErrFerryCancel([cases[3]!])).toEqual([]); /* M2 Superuser + Tallink */
    expect(filterErrFerryCancel([cases[4]!])).toEqual([]);
    expect(filterErrFerryCancel([cases[5]!])).toEqual([]);
    expect(filterErrFerryCancel([cases[6]!])).toEqual([]); /* M2b Vikings ≠ Viking */
    const fin = filterErrFerryCancel([cases[7]!]);
    expect(fin).toHaveLength(1);
    expect(fin[0]!.operators).toEqual(['ECKERO']);
    expect(filterErrFerryCancel([cases[8]!])).toHaveLength(1); /* cancellations + trips */
    expect(filterErrFerryCancel([cases[9]!])).toEqual([]); /* will not cancel */
  });

  it('B1: detail i evidence — tylko tytuł + link + pubDate (bez opisu)', () => {
    const hit = filterErrFerryCancel(parseErrRss(SAMPLE).items)[0]!;
    const risk = errRssCancelRisk(hit);
    expect(risk.severity).toBe('MEDIUM');
    expect(risk.titleKey).toBe('rk_ferry_err_rss_cancel');
    expect(risk.sourceUrl).toBe(hit.item.link);
    expect(risk.dedup).toBe(`FERRY_ERR_RSS:${hit.item.guid}`);
    const d = risk.detail as Record<string, unknown>;
    expect(d.tytul).toBe(hit.item.title);
    expect(d.link).toBe(hit.item.link);
    expect(d.pubDate).toBeTruthy();
    expect(d.cytat).toBeUndefined();
    expect(d.opis).toBeUndefined();
    expect(d.fragment).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain('Ferry operator Tallink has canceled');
    const note = errRssEvidenceNote(hit);
    expect(note.length).toBeLessThanOrEqual(400);
    expect(note).toContain(hit.item.link);
    expect(note).not.toContain('Ferry operator Tallink has canceled');
  });

  it('B3: świeżość 24 h; bez pubDate → pomiń; archiwum nie daje ryzyka', () => {
    const fresh = parseErrRss(SAMPLE).items[0]!;
    expect(isErrRssItemFresh(fresh, NOW)).toBe(true);
    const archive = { ...fresh, pubDate: ARCHIVE_PUB };
    expect(isErrRssItemFresh(archive, NOW)).toBe(false);
    expect(isErrRssItemFresh({ ...fresh, pubDate: null }, NOW)).toBe(false);

    const store = makeStore();
    const archiveFeed = `<?xml version="1.0"?><rss version="2.0"><channel>
${itemXml({
  title: 'Tallink cancels MyStar trips on Monday due to a malfunction',
  link: 'https://news.err.ee/1610177011/tallink-cancels-mystar-trips',
  guid: 'https://news.err.ee/1610177011',
  description: 'Ferry operator Tallink has canceled the passenger ferry MyStar\'s sailings.',
  pubDate: ARCHIVE_PUB,
})}
</channel></rss>`;
    return applyErrRssConfirmations(
      depsOf(store, async () => new Response(archiveFeed, { status: 200 })),
    ).then((r) => {
      expect(r.hits).toBe(0);
      expect(r.risks).toBe(0);
      expect(store.risks.filter((x) => x.dedup.startsWith('FERRY_ERR_RSS:'))).toHaveLength(0);
    });
  });

  it('decyzja 80: domyślnie włączone; env=0 → 0 zapytań, 0 ryzyk', async () => {
    expect(isErrRssEnabled({})).toBe(true);
    expect(isErrRssEnabled({ ERR_RSS_ENABLED: '1' })).toBe(true);
    const store = makeStore();
    const fetchSpy = vi.fn(async () => new Response(SAMPLE, { status: 200 }));
    const r = await applyErrRssConfirmations(
      depsOf(store, fetchSpy, { ERR_RSS_ENABLED: '0' }),
    );
    expect(isErrRssEnabled({ ERR_RSS_ENABLED: '0' })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r).toEqual({ enabled: false, items: 0, hits: 0, risks: 0, warnings: [] });
    expect(store.risks).toHaveLength(0);
  });

  it('DP-127: liczniki enabled/items/hits (włączony + wyłączony)', async () => {
    const off = await applyErrRssConfirmations(
      depsOf(makeStore(), async () => new Response(SAMPLE, { status: 200 }), { ERR_RSS_ENABLED: '0' }),
    );
    expect(off).toMatchObject({ enabled: false, items: 0, hits: 0 });

    const on = await applyErrRssConfirmations(
      depsOf(makeStore(), async () => new Response(SAMPLE, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })),
    );
    expect(on.enabled).toBe(true);
    expect(on.items).toBeGreaterThan(0);
    expect(on.hits).toBe(2);
  });

  it('struktura zła → SOURCE_DOWN sticky; bez notice ODWOLANY', async () => {
    const store = makeStore();
    const r = await applyErrRssConfirmations(
      depsOf(store, async () => new Response('<html>not rss</html>', { status: 200 })),
    );
    expect(r.hits).toBe(0);
    expect(r.risks).toBe(1);
    expect(store.risks.some((x) => x.dedup === 'SOURCE_DOWN:ERR_RSS')).toBe(true);
    expect(store.notices).toBe(0);
  });

  it('M9/B4: HTTP≠200 → SOURCE_DOWN sticky; awaria nie zamyka istniejącego', async () => {
    const fresh = makeStore();
    const r1 = await applyErrRssConfirmations(
      depsOf(fresh, async () => new Response('nope', { status: 503 })),
    );
    expect(r1.risks).toBe(1);
    expect(fresh.risks.some((x) => x.dedup === 'SOURCE_DOWN:ERR_RSS')).toBe(true);

    const store = makeStore();
    store.risks.push({
      kind: 'FERRY',
      severity: 'MEDIUM',
      title: 'stare',
      titleKey: 'rk_source_down',
      params: {},
      detail: {},
      dedup: 'SOURCE_DOWN:ERR_RSS',
      sourceUrl: null,
    });
    const resolveSpy = vi.spyOn(store, 'resolveRisks');
    const r = await applyErrRssConfirmations(
      depsOf(store, async () => new Response('nope', { status: 503 })),
    );
    expect(r.risks).toBe(0); /* dedup już jest — raiseRisk false */
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(store.risks.filter((x) => x.dedup === 'SOURCE_DOWN:ERR_RSS')).toHaveLength(1);
  });

  it('job (włączony): 2 ryzyka FERRY_ERR_RSS; resolveStale przy niepustym kanale (także 0 trafień)', async () => {
    const store = makeStore();
    const r = await applyErrRssConfirmations(
      depsOf(store, async () => new Response(SAMPLE, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })),
    );
    expect(r.hits).toBe(2);
    expect(r.risks).toBe(2);
    expect(store.notices).toBe(0);
    expect(store.risks.every((x) => x.dedup.startsWith('FERRY_ERR_RSS:'))).toBe(true);
    expect(store.risks[0]!.detail).toMatchObject({ zrodlo: 'ERR_RSS' });
    expect(store.staleCalls).toHaveLength(1);
    expect(store.staleCalls[0]!.prefix).toBe('FERRY_ERR_RSS:');
    expect(store.staleCalls[0]!.keep).toHaveLength(2);

    /* niepusty kanał, 0 trafień po filtrze → resolveStale z keep=[] */
    const noHitFeed = `<?xml version="1.0"?><rss version="2.0"><channel>
${itemXml({
  title: 'Prime minister speaks about Russia',
  link: 'https://news.err.ee/1/politics',
  guid: 'https://news.err.ee/1',
  description: 'Politics only — no ferry.',
})}
</channel></rss>`;
    const storeNoHit = makeStore();
    await applyErrRssConfirmations(depsOf(storeNoHit, async () => new Response(noHitFeed, { status: 200 })));
    expect(storeNoHit.staleCalls).toEqual([{ prefix: 'FERRY_ERR_RSS:', keep: [] }]);
  });

  it('R2-B1: pusty kanał nie woła resolveStaleRisks (nie zamyka ryzyk ERR)', async () => {
    const emptyOk = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>`;
    const store = makeStore();
    store.risks.push({
      kind: 'FERRY',
      severity: 'MEDIUM',
      title: 'stare ERR',
      titleKey: 'rk_ferry_err_rss_cancel',
      params: {},
      detail: {},
      dedup: 'FERRY_ERR_RSS:https://news.err.ee/old',
      sourceUrl: null,
    });
    const r = await applyErrRssConfirmations(depsOf(store, async () => new Response(emptyOk, { status: 200 })));
    expect(r.hits).toBe(0);
    expect(store.staleCalls).toEqual([]);
    expect((store.risks[0] as { resolved?: boolean }).resolved).toBeUndefined();
  });

  it('B2: po ręcznym zamknięciu guid nie wraca; B2c validUntil = pubDate+24h', async () => {
    const guid = 'https://news.err.ee/1610177011';
    const store = makeStore({ knownDedup: new Set([`FERRY_ERR_RSS:${guid}`]) });
    const r = await applyErrRssConfirmations(
      depsOf(store, async () => new Response(SAMPLE, { status: 200 })),
    );
    expect(r.hits).toBe(2);
    /* jedno guid znane → tylko drugie ryzyko */
    expect(r.risks).toBe(1);
    expect(store.risks.map((x) => x.dedup)).toEqual(['FERRY_ERR_RSS:https://news.err.ee/1135991']);

    const hit = filterErrFerryCancel(parseErrRss(SAMPLE).items)[0]!;
    const risk = errRssCancelRisk(hit, NOW.toISOString());
    expect(risk.validUntil).toBe(
      new Date(Date.parse(hit.item.pubDate!) + 24 * 3600_000).toISOString(),
    );
  });

  it('M5: HTTP 503 → resolveStaleRisks nie wywołane', async () => {
    const store = makeStore();
    const staleSpy = vi.spyOn(store, 'resolveStaleRisks');
    await applyErrRssConfirmations(
      depsOf(store, async () => new Response('nope', { status: 503 })),
    );
    expect(staleSpy).not.toHaveBeenCalled();
  });

  it('B4a/B4c: zły XML przy otwartym SOURCE_DOWN zostaje; sukces zamyka', async () => {
    const store = makeStore();
    store.risks.push({
      kind: 'FERRY',
      severity: 'MEDIUM',
      title: 'stare',
      titleKey: 'rk_source_down',
      params: {},
      detail: {},
      dedup: 'SOURCE_DOWN:ERR_RSS',
      sourceUrl: null,
    });
    const resolveSpy = vi.spyOn(store, 'resolveRisks');
    await applyErrRssConfirmations(
      depsOf(store, async () => new Response('<html>not rss</html>', { status: 200 })),
    );
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(store.risks.some((x) => x.dedup === 'SOURCE_DOWN:ERR_RSS' && !(x as { resolved?: boolean }).resolved)).toBe(true);

    const storeOk = makeStore();
    storeOk.risks.push({
      kind: 'FERRY',
      severity: 'MEDIUM',
      title: 'stare',
      titleKey: 'rk_source_down',
      params: {},
      detail: {},
      dedup: 'SOURCE_DOWN:ERR_RSS',
      sourceUrl: null,
    });
    await applyErrRssConfirmations(
      depsOf(storeOk, async () => new Response(SAMPLE, { status: 200 })),
    );
    expect(storeOk.risks.some((x) => x.dedup === 'SOURCE_DOWN:ERR_RSS' && (x as { resolved?: boolean }).resolved)).toBe(true);
  });

  it('T1: wyjątek ze store łapany jak w runFerryStatus (nie przerywa joba)', async () => {
    const store = makeStore();
    store.raiseRisk = async () => {
      throw new Error('boom-store');
    };
    let errRss: { enabled: boolean; items: number; hits: number; risks: number; warnings: string[] } = {
      enabled: true, items: 0, hits: 0, risks: 0, warnings: [],
    };
    try {
      errRss = await applyErrRssConfirmations(
        depsOf(store, async () => new Response(SAMPLE, { status: 200 })),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errRss = {
        enabled: true, items: 0, hits: 0, risks: 0,
        warnings: [`ERR RSS: wyjątek — ${msg.slice(0, 160)}`],
      };
    }
    expect(errRss.warnings[0]).toMatch(/boom-store/);
    expect(errRss.risks).toBe(0);
  });

  it('T2: za duża odpowiedź → SOURCE_DOWN', async () => {
    const store = makeStore();
    const huge = 'x'.repeat(1_500_001);
    const r = await applyErrRssConfirmations(
      depsOf(store, async () => new Response(huge, { status: 200 })),
    );
    expect(r.risks).toBe(1);
    expect(store.risks.some((x) => x.dedup === 'SOURCE_DOWN:ERR_RSS')).toBe(true);
    expect(r.warnings.some((w) => /za duża/i.test(w))).toBe(true);
  });

  it('URL feedu = news.err.ee/rss (bez Yle)', () => {
    expect(ERR_RSS_URL).toBe('https://news.err.ee/rss');
    expect(ERR_RSS_URL).not.toMatch(/yle/i);
  });
});
