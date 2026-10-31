/**
 * BN3 — Tallink Alert + Lisainfo ts.ee (decyzje 57, 59).
 * F7 #683 B1–B5: pełna pula, data/HH:MM z treści, negacja, >1 statek, job AUTO.
 *
 * Fixture `tallink-alert-cancel-mystar.html` — treść odwołania **syntetyczna**
 * (przeróbka pod test; nie jest żywym Alertem z produkcji).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decodeTallinkCmsHtml,
  departureMatchesAlert,
  matchTallinkAlertSailings,
  parseAlertContentDates,
  parseTallinkAlerts,
} from '../src/lib/ferry/tallinkAlert';
import { parsePortTallinnHtml } from '../src/lib/ferry/portTallinn';
import {
  runFerryPortnet,
  runFerryStatus,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const FIX = readFileSync(new URL('./fixtures/tallink-alert-cancel-mystar.html', import.meta.url), 'utf8');
const NOW = new Date('2026-10-31T12:00:00Z');
const MYST = 'v-myst';

describe('BN3 Tallink Alert', () => {
  it('dekoduje escapes CMS i wyciąga Alert (bez kampanii); data z treści', () => {
    const decoded = decodeTallinkCmsHtml(FIX);
    expect(decoded).toContain('data-analytics-group="Alert"');
    expect(decoded).toContain('MyStar');
    const { alerts, warnings } = parseTallinkAlerts(FIX, 'https://www.tallink.com/', NOW);
    expect(warnings).toEqual([]);
    expect(alerts.length).toBe(1);
    expect(alerts[0]!.kind).toBe('ODWOLANY');
    expect(alerts[0]!.vessel).toBe('M/F MyStar');
    expect(alerts[0]!.routes).toEqual(expect.arrayContaining(['TLL-HEL', 'HEL-TLL']));
    // F7 B2: data z treści („on 2 November”), nie tylko Scheduler.
    expect(alerts[0]!.contentStartYmd).toBe('2026-11-02');
    expect(alerts[0]!.contentEndYmd).toBe('2026-11-02');
  });

  it('F7 B1: jednoznaczność na pełnej puli — 5× ODWOLANY + 1 płynący → ambiguous', () => {
    const alert = parseTallinkAlerts(FIX, TALLINK_HOME(), NOW).alerts[0]!;
    const pool = [
      ...[0, 1, 2, 3, 4].map((i) => ({
        id: `od${i}`, vesselName: 'M/F MyStar', route: 'TLL-HEL' as const,
        departureAt: `2026-11-0${1 + (i % 2)}T0${5 + i}:30:00.000Z`,
        status: 'ODWOLANY', source: 'TALLINK',
      })),
      {
        id: 's5', vesselName: 'M/F MyStar', route: 'TLL-HEL',
        departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    ];
    // Wszyscy w oknie 2.11 (Tallinn) albo poza — ustaw daty w oknie treści 2.11.
    const inWin = pool.map((s, i) => ({
      ...s,
      departureAt: i < 5
        ? `2026-11-02T0${4 + (i % 3)}:00:00.000Z`
        : '2026-11-02T07:30:00.000Z',
    }));
    const r = matchTallinkAlertSailings(alert, inWin);
    expect(r.kind).toBe('ambiguous');
    expect(r.kind === 'ambiguous' && r.candidates.length).toBe(6);
  });

  it('F7 B1: jedyne trafienie ODWOLANY → already_cancelled; RECZNIE → manual_only', () => {
    const alert = parseTallinkAlerts(FIX, TALLINK_HOME(), NOW).alerts[0]!;
    const cancelled = matchTallinkAlertSailings(alert, [{
      id: 's1', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T05:30:00.000Z', status: 'ODWOLANY', source: 'TALLINK',
    }]);
    expect(cancelled.kind).toBe('already_cancelled');

    const recznie = matchTallinkAlertSailings(alert, [{
      id: 's3', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'RECZNIE',
    }]);
    expect(recznie.kind).toBe('manual_only');

    const one = matchTallinkAlertSailings(alert, [{
      id: 's1', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
    }]);
    expect(one.kind).toBe('match');
    expect(one.kind === 'match' && one.sailing.id).toBe('s1');
  });

  it('F7 B1: okno poza ostatnim rejsem statku → beyond_horizon', () => {
    const alert = parseTallinkAlerts(FIX, TALLINK_HOME(), NOW).alerts[0]!;
    const r = matchTallinkAlertSailings(alert, [{
      id: 'old', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-10-20T05:30:00.000Z', status: 'DOPLYNAL', source: 'TALLINK',
    }]);
    expect(r.kind).toBe('beyond_horizon');
  });

  it('F7 B2: data/HH:MM z treści; porównanie Tallinn; ±30 min; po północy', () => {
    const d = parseAlertContentDates(
      'MyStar departure at 00:30 on 2 November is cancelled',
      2026,
    );
    expect(d).toMatchObject({ startYmd: '2026-11-02', endYmd: '2026-11-02', hm: '00:30' });
    const alert = {
      kind: 'ODWOLANY' as const,
      text: 'x', vessel: 'M/F MyStar', multiVessel: false, routes: ['TLL-HEL' as const],
      contentStartYmd: '2026-11-02', contentEndYmd: '2026-11-02', contentHm: '00:30',
      windowStartYmd: '2026-10-26', windowEndYmd: '2026-10-28', // Scheduler = okno wyświetlania
      sourceUrl: 'https://www.tallink.com/',
    };
    // 00:30 EET 2.11 ≈ 22:30Z 1.11 (zimowy EET=UTC+2) — slice UTC 1.11 NIE w oknie Scheduler.
    expect(departureMatchesAlert('2026-11-01T22:30:00.000Z', alert)).toBe(true);
    expect(departureMatchesAlert('2026-11-01T22:00:00.000Z', alert)).toBe(true); // −30 min
    expect(departureMatchesAlert('2026-11-01T23:05:00.000Z', alert)).toBe(false); // >30 min
    // Zmiana czasu: treść „from Tallinn to Helsinki” (bez myślnika).
    const fromTo = parseTallinkAlerts(
      wrapAlert('The Megastar sailing from Tallinn to Helsinki on 2 November at 19:30 is cancelled.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    // B2: „from … to …” = jeden kierunek (myślnik = oba).
    expect(fromTo.routes).toEqual(['TLL-HEL']);
    expect(fromTo.contentHm).toBe('19:30');
  });

  it('F7 B2: wygasłe okno pomijane', () => {
    const html = wrapAlert(
      'MyStar on the Tallinn–Helsinki route on 10 October is cancelled.',
      '2026-10-10',
    );
    const { alerts } = parseTallinkAlerts(html, TALLINK_HOME(), NOW);
    expect(alerts).toHaveLength(0);
  });

  it('F7 B3: negacja / wznowienie → INFO (nie ODWOLANY)', () => {
    const notCancel = parseTallinkAlerts(
      wrapAlert('MyStar on Tallinn–Helsinki on 2 November is not cancelled and operates as planned.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    expect(notCancel.kind).toBe('INFO');

    const resume = parseTallinkAlerts(
      wrapAlert('MyStar returns to the Tallinn–Helsinki route and will resume operating on 2 November.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    expect(resume.kind).toBe('INFO');

    const tickets = parseTallinkAlerts(
      wrapAlert('Ticket sales suspended on our website. Book by phone.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    );
    // bez kontekstu rejsu — nie ODWOLANY
    expect(tickets.alerts.every((a) => a.kind !== 'ODWOLANY')).toBe(true);
  });

  it('F7 B4: kilka statków → multiVessel; samo queen nie łapie', () => {
    const multi = parseTallinkAlerts(
      wrapAlert('Megastar sailing cancelled; passengers rebooked to MyStar on Tallinn–Helsinki on 2 November.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    expect(multi.multiVessel).toBe(true);
    expect(multi.vessel).toBeNull();
    expect(matchTallinkAlertSailings(multi, [{
      id: 's1', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T05:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
    }]).kind).toBe('ambiguous');

    const queen = parseTallinkAlerts(
      wrapAlert('The queen of the seas event on Tallinn–Helsinki on 2 November is cancelled.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    expect(queen.vessel).toBeNull();
  });
});

describe('BN3 Tallink Alert — runFerryStatus (F7 B5)', () => {
  it('jednoznaczny → ODWOLANY + 1 AUTO; drugi przebieg 0 nowych; niejednoznaczny → ryzyko bez statusu', async () => {
    const st = new MemStore();
    st.sailings.push({
      id: 's-ok', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T05:30:00.000Z', arrival_at: '2026-11-02T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      actual_departure_at: null, actual_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    // Polferries/Stena/DFDS 503 → job.ok może być false; Tallink Alert i tak działa.
    const pages = { 'tallink.com': FIX, 'ts.ee': 503, portsofstockholm: 503, 'port-calls': 503 };
    await runFerryStatus(deps(st, pages, NOW));
    expect(st.sailings.find((s) => s.id === 's-ok')!.status).toBe('ODWOLANY');
    expect(st.notices).toHaveLength(1);
    expect(st.notices[0]).toMatchObject({ sailingId: 's-ok', kind: 'ODWOLANY', source: 'AUTO' });

    await runFerryStatus(deps(st, pages, NOW));
    expect(st.notices).toHaveLength(1); // already_cancelled → bez nowego AUTO

    // Niejednoznaczny: dwa rejsy w oknie → ryzyko, bez zmiany statusu drugiego.
    const amb = new MemStore();
    amb.sailings.push(
      {
        id: 'a1', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-02T05:30:00.000Z', arrival_at: '2026-11-02T07:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 'a2', vessel_id: MYST, route: 'HEL-TLL',
        departure_at: '2026-11-02T14:00:00.000Z', arrival_at: '2026-11-02T16:00:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    );
    await runFerryStatus(deps(amb, pages, NOW));
    expect(amb.sailings.every((s) => s.status === 'ZAPLANOWANY')).toBe(true);
    expect(amb.notices).toHaveLength(0);
    expect(amb.risks.some((r) => String(r.titleKey).includes('tallink_alert'))).toBe(true);
  });

  it('mutacja (b): negacja nie ustawia ODWOLANY', async () => {
    const html = wrapAlert(
      'MyStar on the Tallinn–Helsinki route on 2 November is not cancelled and operates as planned.',
      '2026-11-02',
    );
    const st = new MemStore();
    st.sailings.push({
      id: 's1', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T05:30:00.000Z', arrival_at: '2026-11-02T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st, { 'tallink.com': html, 'ts.ee': 503, portsofstockholm: 503 }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
  });
});

describe('BN3 Port of Tallinn Lisainfo', () => {
  it('Lisainfo z odwołaniem ustawia cancelled + treść', () => {
    const html = `
<table id="passenger-lines-outbound">
<tr data-terminal="d" data-from_to="helsinki" data-company="tallink">
<td data-sort_value="13:30">13:30</td>
<td data-sort_value="Megastar">Megastar</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="D">Terminal D</td>
<td data-sort_value="Tallink">Tallink</td>
<td data-sort_value="cancelled">Cancelled — technical reasons</td>
</tr>
</table>
<table id="passenger-lines-inbound"></table>`;
    const r = parsePortTallinnHtml(html, '2026-11-02');
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.cancelled).toBe(true);
    expect(r.events[0]!.lisainfo).toMatch(/Cancelled/i);
    expect(r.events[0]!.vessel).toBe('M/F Megastar');
    expect(r.events[0]!.route).toBe('TLL-HEL');
  });

  it('F7 B5: ts.ee cancelled → AUTO notice + dedup przy drugim przebiegu', async () => {
    const tllHtml = `
<table id="passenger-lines-outbound">
<tr data-terminal="d" data-from_to="helsinki" data-company="tallink">
<td data-sort_value="07:30">07:30</td>
<td data-sort_value="MyStar">MyStar</td>
<td data-sort_value="Tallinn">Tallinn</td>
<td data-sort_value="Helsinki">Helsinki</td>
<td data-sort_value="D">D</td>
<td data-sort_value="Tallink">Tallink</td>
<td data-sort_value="cancelled">Cancelled — Lisainfo test</td>
</tr>
</table>
<table id="passenger-lines-inbound"></table>`;
    const st = new MemStore();
    // 07:30 Tallinn 31.10 ≈ 05:30Z (EET+2)
    st.sailings.push({
      id: 't1', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-10-31T05:30:00.000Z', arrival_at: '2026-10-31T07:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    // ts.ee jest w ferry-portnet (applyPortTallinn), nie w ferry-status.
    const pages = {
      'ts.ee': tllHtml,
      portsofstockholm: 503,
      'port-calls': 503,
    };
    await runFerryPortnet(deps(st, pages, NOW));
    expect(st.sailings[0]!.status).toBe('ODWOLANY');
    expect(st.notices).toHaveLength(1);
    expect(st.notices[0]!.source).toBe('AUTO');
    await runFerryPortnet(deps(st, pages, NOW));
    expect(st.notices).toHaveLength(1);
  });
});

function TALLINK_HOME() {
  return 'https://www.tallink.com/';
}

function wrapAlert(text: string, ymd: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Syntetyczny Alert CMS (jak fixture MyStar).
  const inner =
    `<Scheduler dateStart="${ymd}" timeStart="00:01" dateEnd="${ymd}" timeEnd="23:59">` +
    `<CwsSection data-analytics-group="Alert"><CwsP>${esc}</CwsP></CwsSection></Scheduler>`;
  const json = JSON.stringify({ page: { content: { rendered: inner } } })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return `<!DOCTYPE html><html><body><script id="__CMS__">${json}</script></body></html>`;
}

class MemStore implements SyncStore {
  sailings: DbSailing[] = [];
  risks: (RiskInput & { loadId?: string })[] = [];
  notices: Array<{ sailingId: string; kind: string; source: string; note?: string | null }> = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  n = 0;
  async projectId() { return 'p1'; }
  async vessels() {
    return [
      { id: MYST, name: 'M/F MyStar', mmsi: 276817000 },
      { id: 'v-mega', name: 'M/F Megastar', mmsi: 276829000 },
    ];
  }
  async sailingsSince(from: string) {
    return this.sailings.filter((s) => s.departure_at >= from).map((s) => ({ ...s }));
  }
  async insertSailings(rows: SailingInsert[]) {
    for (const r of rows) {
      if (!this.sailings.some((s) => s.vessel_id === r.vessel_id && s.departure_at === r.departure_at)) {
        this.sailings.push({ id: `s${++this.n}`, ...r });
      }
    }
  }
  async updateSailing(id: string, patch: SailingPatch) {
    const s = this.sailings.find((x) => x.id === id);
    if (!s) return false;
    if (s.source === 'RECZNIE' && patch.status) return false;
    Object.assign(s, patch);
    return true;
  }
  async insertOperatorNotice(row: {
    sailingId: string; operator: string; kind: 'ODWOLANY' | 'OPOZNIONY' | 'ZMIANA_GODZINY';
    note?: string | null; sourceUrl?: string | null;
  }) {
    this.notices.push({
      sailingId: row.sailingId, kind: row.kind, source: 'AUTO', note: row.note,
    });
    return `n${this.notices.length}`;
  }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r); return true;
  }
  async resolveRisks(prefix: string) {
    const hit = this.risks.filter((r) => r.dedup.startsWith(prefix));
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return hit.length;
  }
  async latestPositions() { return []; }
  async lastRun(job: string) { return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null; }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: NOW.toISOString(), ok, result });
  }
  async saveVesselPosition() { /* no-op */ }
}

function deps(store: MemStore, pages: Record<string, string | number>, now = NOW): JobDeps {
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = Object.entries(pages).find(([k]) => url.includes(k));
    if (hit) {
      return typeof hit[1] === 'number'
        ? new Response('err', { status: hit[1] })
        : new Response(hit[1], { status: 200 });
    }
    if (url.includes('komunikaty') || url.includes('stena') || url.includes('dfds')) {
      return new Response('err', { status: 503 });
    }
    throw new Error(`nieoczekiwane: ${url}`);
  }) as typeof fetch;
  return { store, fetch: f, env: {}, now: () => now };
}
