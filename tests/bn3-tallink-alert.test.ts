/**
 * BN3 — Tallink Alert + Lisainfo ts.ee (decyzje 57, 59, 68, 69, 71, 72).
 * F7 #683 B1–B5 + R2–R10: allowlista zdań (68) + allowlista HTML (71) + najnowszy Alert (72).
 *
 * Fixture `tallink-alert-cancel-mystar.html` — forma jak prawdziwy Alert
 * („due to a technical fault”; CwsSpan / hideSpacing / timeStart); treść pod test.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  alertHtmlAllowsAutoCancel,
  autoCancelFromCancelSentence,
  decodeTallinkCmsHtml,
  departureMatchesAlert,
  finalizeTallinkAlertsForStatus,
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
    // R11: kampania zostaje w puli rankingu (isCampaign); auto tylko z Alertu serwisowego.
    expect(alerts.some((a) => a.isCampaign)).toBe(true);
    const service = alerts.find((a) => a.kind === 'ODWOLANY')!;
    expect(service.vessel).toBe('M/F MyStar');
    expect(service.routes).toEqual(['TLL-HEL']);
    expect(service.autoCancelOk).toBe(true);
    // F7 B2/R5: data+HH:MM+trasa ze ścisłego wzorca, nie Scheduler.
    expect(service.contentStartYmd).toBe('2026-11-02');
    expect(service.contentEndYmd).toBe('2026-11-02');
    expect(service.contentHm).toBe('07:30');
  });

  it('F7 B1: jednoznaczność na pełnej puli — 5× ODWOLANY + 1 płynący → ambiguous', () => {
    const alert = parseTallinkAlerts(FIX, TALLINK_HOME(), NOW).alerts[0]!;
    // R4: contentHm 07:30 Tallinn ≈ 05:30Z — wszystkie w ±30 min, żeby pełna pula w match.
    const inWin = [0, 1, 2, 3, 4, 5].map((i) => ({
      id: i < 5 ? `od${i}` : 's5',
      vesselName: 'M/F MyStar',
      route: 'TLL-HEL' as const,
      departureAt: `2026-11-02T05:${String(10 + i * 4).padStart(2, '0')}:00.000Z`,
      status: i < 5 ? 'ODWOLANY' : 'ZAPLANOWANY',
      source: 'TALLINK',
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
      text: 'x', vessel: 'M/F MyStar', multiVessel: false, multiTime: false, autoCancelOk: true,
      routes: ['TLL-HEL' as const],
      contentStartYmd: '2026-11-02', contentEndYmd: '2026-11-02', contentHm: '00:30',
      windowStartYmd: '2026-10-26', windowEndYmd: '2026-10-28', // Scheduler = tylko wygaśnięcie
      windowTimeStart: null, ordinal: 0, isCampaign: false, fromLoose: false, rawFull: '',
      filterReject: null, suppressedByNewer: false,
      sourceUrl: 'https://www.tallink.com/',
    };
    // 00:30 EET 2.11 ≈ 22:30Z 1.11 (zimowy EET=UTC+2) — slice UTC 1.11 NIE w oknie Scheduler.
    expect(departureMatchesAlert('2026-11-01T22:30:00.000Z', alert)).toBe(true);
    expect(departureMatchesAlert('2026-11-01T22:00:00.000Z', alert)).toBe(true); // −30 min
    expect(departureMatchesAlert('2026-11-01T23:05:00.000Z', alert)).toBe(false); // >30 min
    // R5 allowlist: HH:MM przed departure/sailing + from/to + on date.
    const fromTo = parseTallinkAlerts(
      wrapAlert('The Megastar 19:30 sailing from Tallinn to Helsinki on 2 November is cancelled.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    expect(fromTo.routes).toEqual(['TLL-HEL']);
    expect(fromTo.contentHm).toBe('19:30');
    expect(fromTo.autoCancelOk).toBe(true);
  });

  it('F7 B2: wygasłe okno — filterReject expired (w puli, bez auto)', () => {
    const html = wrapAlert(
      'MyStar on the Tallinn–Helsinki route on 10 October is cancelled.',
      '2026-10-10',
    );
    const { alerts } = parseTallinkAlerts(html, TALLINK_HOME(), NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.filterReject).toBe('expired');
    expect(alerts[0]!.autoCancelOk).toBe(false);
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

  it('F7 B4 / R7-B3: kilka statków → ambiguous (!autoCancelOk); samo queen nie łapie', () => {
    // R7-B3: multiVessel nie z vesselsIn — reguła zdań → !autoCancelOk → ambiguous.
    const multi = parseTallinkAlerts(
      wrapAlert('Megastar sailing cancelled; passengers rebooked to MyStar on Tallinn–Helsinki on 2 November.', '2026-11-02'),
      TALLINK_HOME(),
      NOW,
    ).alerts[0]!;
    expect(multi.autoCancelOk).toBe(false);
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
    expect(queen.autoCancelOk).toBe(false);
  });

  it('F7 R2-B2: >1 HH:MM w treści → multiTime / ambiguous (nie ODWOLANY na pierwszej godzinie)', () => {
    // Syntetyczna treść z F7 r2 — dwie godziny; pierwsza to rejs który płynie.
    const text =
      'The MyStar 10:30 departure from Tallinn to Helsinki will operate; the 13:30 departure on 2 November is cancelled.';
    const d = parseAlertContentDates(text, 2026);
    expect(d?.multiTime).toBe(true);
    expect(d?.hm).toBeNull();

    const alert = parseTallinkAlerts(wrapAlert(text, '2026-11-02'), TALLINK_HOME(), NOW).alerts[0]!;
    expect(alert.kind).toBe('ODWOLANY');
    expect(alert.multiTime).toBe(true);
    expect(alert.contentHm).toBeNull();
    // 10:30 Tallinn 2.11 ≈ 08:30Z (EET+2)
    const hit = matchTallinkAlertSailings(alert, [{
      id: 's-1030', vesselName: 'M/F MyStar', route: 'TLL-HEL',
      departureAt: '2026-11-02T08:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
    }]);
    expect(hit.kind).toBe('ambiguous');
  });

  it('F7 R3-B1: nierozpoznana data w treści → ambiguous (nie ODWOLANY na dacie okna Schedulera)', () => {
    // Probe F7 r3: okno wyświetlania 1.11; treść z datą w formacie, którego parser nie zna.
    const windowYmd = '2026-11-01';
    const sailings = [
      {
        id: 's-1030', vesselName: 'M/F MyStar', route: 'TLL-HEL',
        departureAt: '2026-11-01T08:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's-1630', vesselName: 'M/F MyStar', route: 'TLL-HEL',
        departureAt: '2026-11-01T14:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's-2230', vesselName: 'M/F MyStar', route: 'TLL-HEL',
        departureAt: '2026-11-01T20:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    ];
    for (const text of [
      'MyStar 16:30 departure from Tallinn to Helsinki is cancelled tomorrow',
      'MyStar 16:30 departure from Tallinn to Helsinki is cancelled on Monday',
      'MyStar 16:30 departure from Tallinn to Helsinki is cancelled from 2 to 3 November',
      'MyStar 16:30 departure from Tallinn to Helsinki is cancelled on November 2',
      'MyStar 16:30 departure from Tallinn to Helsinki is cancelled on 2nd November',
    ]) {
      const alert = parseTallinkAlerts(wrapAlert(text, windowYmd), TALLINK_HOME(), NOW).alerts[0]!;
      expect(alert.kind).toBe('ODWOLANY');
      expect(alert.contentStartYmd).toBeNull();
      expect(alert.windowStartYmd).toBe(windowYmd);
      // Mutacja: contentStartYmd ?? windowStartYmd → match na 1.11 16:30 — ten test pada.
      expect(departureMatchesAlert('2026-11-01T14:30:00.000Z', alert)).toBe(false);
      const hit = matchTallinkAlertSailings(alert, sailings);
      expect(hit.kind).toBe('ambiguous');
    }
  });

  it('F7 R4-B1: data ogłoszenia / względny dzień → ambiguous (nie ODWOLANY na dniu ogłoszenia)', () => {
    // Probe F7 r4: okno 1.11; publikacja 1.11 + tomorrow/Monday → fałszywy match na 1.11 16:30.
    const windowYmd = '2026-11-01';
    const sailings = [
      {
        id: 's-1630', vesselName: 'M/F MyStar', route: 'TLL-HEL',
        departureAt: '2026-11-01T14:30:00.000Z', status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    ];
    for (const text of [
      'Updated on 1 November: the MyStar 16:30 departure from Tallinn to Helsinki tomorrow is cancelled.',
      'Today, 1 November, we inform that the MyStar 16:30 departure from Tallinn to Helsinki on Monday is cancelled.',
      // Data w innym zdaniu niż cancel → bez trio w zdaniu odwołania.
      'On 2 November the notice was published. The MyStar 16:30 departure from Tallinn to Helsinki is cancelled.',
    ]) {
      const alert = parseTallinkAlerts(wrapAlert(text, windowYmd), TALLINK_HOME(), NOW).alerts[0]!;
      expect(alert.kind).toBe('ODWOLANY');
      expect(alert.contentStartYmd).toBeNull();
      expect(alert.multiTime).toBe(true);
      // Mutacja: wyłączenie „to samo zdanie” / OPAQUE → match na 1.11 16:30 — ten test pada.
      const hit = matchTallinkAlertSailings(alert, sailings);
      expect(hit.kind).toBe('ambiguous');
    }
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

    // Niejednoznaczny: dwa rejsy TLL-HEL w ±30 min od 07:30 → ryzyko, bez ODWOLANY.
    const amb = new MemStore();
    amb.sailings.push(
      {
        id: 'a1', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-02T05:30:00.000Z', arrival_at: '2026-11-02T07:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 'a2', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-02T05:45:00.000Z', arrival_at: '2026-11-02T07:45:00.000Z',
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

  it('F7 R2-B2: dwie godziny w Alertcie → ryzyko, bez ODWOLANY na 10:30', async () => {
    const html = wrapAlert(
      'The MyStar 10:30 departure from Tallinn to Helsinki will operate; the 13:30 departure on 2 November is cancelled.',
      '2026-11-02',
    );
    const st = new MemStore();
    st.sailings.push({
      id: 's-1030', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T08:30:00.000Z', arrival_at: '2026-11-02T10:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st, { 'tallink.com': html, 'ts.ee': 503, portsofstockholm: 503 }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
  });

  it('F7 R3-B1: okno 1.11 + nierozpoznana data → ryzyko, status bez zmian', async () => {
    const html = wrapAlert(
      'MyStar 16:30 departure from Tallinn to Helsinki is cancelled on November 2',
      '2026-11-01',
    );
    const st = new MemStore();
    st.sailings.push(
      {
        id: 's-1030', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-01T08:30:00.000Z', arrival_at: '2026-11-01T10:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-01T14:30:00.000Z', arrival_at: '2026-11-01T16:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's-2230', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-01T20:30:00.000Z', arrival_at: '2026-11-01T22:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    );
    await runFerryStatus(deps(st, { 'tallink.com': html, 'ts.ee': 503, portsofstockholm: 503 }, NOW));
    expect(st.sailings.every((s) => s.status === 'ZAPLANOWANY')).toBe(true);
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
  });

  it('F7 R4-B1: Updated/tomorrow + Today/Monday + data w innym zdaniu → ryzyko; mutacja same-sentence', async () => {
    for (const text of [
      'Updated on 1 November: the MyStar 16:30 departure from Tallinn to Helsinki tomorrow is cancelled.',
      'Today, 1 November, we inform that the MyStar 16:30 departure from Tallinn to Helsinki on Monday is cancelled.',
      'On 2 November at 07:30 the weather looks fine. MyStar sailing from Tallinn to Helsinki is cancelled.',
    ]) {
      const st = new MemStore();
      st.sailings.push({
        id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-01T14:30:00.000Z', arrival_at: '2026-11-01T16:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-01'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
      expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
    }
    // Mutacja: bez „to samo zdanie” / allowlist — data+HH:MM w treści, ale nie auto.
    const other =
      'On 2 November at 07:30 the weather looks fine. MyStar sailing from Tallinn to Helsinki is cancelled.';
    expect(autoCancelFromCancelSentence(other, 2026)).toBeNull();
    expect(parseAlertContentDates(other, 2026)).toMatchObject({
      startYmd: '2026-11-02', hm: '07:30',
    });
  });

  it('F7 R5: may / buffet / car deck / trasa z innego zdania → ryzyko; allowlist → ODWOLANY', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    for (const text of [
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November may be cancelled.',
      'On the MyStar 16:30 departure from Tallinn to Helsinki on 2 November, the onboard buffet is cancelled.',
      'Car deck bookings for the MyStar 16:30 departure from Tallinn to Helsinki on 2 November are cancelled.',
      'Megastar is in dry dock. The MyStar 16:30 departure on 2 November is cancelled. Passengers can use the sailing from Helsinki to Tallinn.',
      // Mutacja: dowolny tekst przed/po ścisłym wzorcu → nie auto.
      'Please note: The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.',
    ]) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
      expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
      expect(autoCancelFromCancelSentence(text, 2026)).toBeNull();
    }

    // Allowlist + wariant „today, …”.
    for (const text of [
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.',
      'today, 2 November, the MyStar 16:30 departure from Tallinn to Helsinki is cancelled.',
    ]) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ODWOLANY');
      expect(st.notices).toHaveLength(1);
      expect(st.notices[0]).toMatchObject({ sailingId: 's-1630', source: 'AUTO' });
      expect(autoCancelFromCancelSentence(text, 2026)).toMatchObject({
        startYmd: '2026-11-02', hm: '16:30', vessel: 'M/F MyStar', routes: ['TLL-HEL'],
      });
    }
  });

  it('F7 R6-B1: treść z archiwum/korektą/cofnięciem → ryzyko; wzorzec+przeprosiny / due to → ODWOLANY', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const pattern =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    for (const text of [
      'Correction to our earlier notice. The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled. The above information was published in error.',
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled. The cancellation has been revoked and the departure will operate.',
      'Reminder. The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled. The departure was reinstated.',
      'Archive of notices from 2025. The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.',
      // Wzorzec + zdanie spoza listy przeprosin → ryzyko.
      `${pattern} Passengers will be rebooked.`,
      // Sufiks z dodatkowym tekstem po due-to → nie `$` → ryzyko.
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled due to a technical fault, please check later.',
    ]) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
      expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
      expect(autoCancelFromCancelSentence(text, 2026)).toBeNull();
    }

    for (const text of [
      `${pattern} We apologise for any inconvenience.`,
      `${pattern} We apologize for the inconvenience.`,
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled due to a technical fault.',
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled due to weather conditions.',
    ]) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ODWOLANY');
      expect(st.notices).toHaveLength(1);
      expect(st.notices[0]).toMatchObject({ sailingId: 's-1630', source: 'AUTO' });
      expect(autoCancelFromCancelSentence(text, 2026)).toMatchObject({
        startYmd: '2026-11-02', hm: '16:30', vessel: 'M/F MyStar', routes: ['TLL-HEL'],
      });
    }
    // Mutacja: bez warunku „jedno zdanie (+ neutralne)” → korekta/archiwum dałoby auto — ten expect pada.
    expect(autoCancelFromCancelSentence(
      'Archive of notices from 2025. The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.',
      2026,
    )).toBeNull();
  });

  it('F7 R6-B2 / R7-B3: nie-neutralne zdania (may/resume/dwa wzorce/trasa) → ryzyko', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const pattern =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    for (const text of [
      // Drugie zdanie nie-neutralne (may) — reguła zdań, bez CONDITIONAL_RE.
      `${pattern} Conditions may change.`,
      `${pattern} Service resumes operating as planned.`,
      `${pattern} The Megastar 10:30 departure from Tallinn to Helsinki on 2 November is cancelled.`,
      `${pattern} Passengers can use the sailing from Helsinki to Tallinn.`,
    ]) {
      expect(autoCancelFromCancelSentence(text, 2026)).toBeNull();
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
    }
  });

  it('F7 R7-B1: treść poza CwsP (H3/List/Text/goły) → ryzyko', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const cancelP =
      '<CwsP>The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.</CwsP>';
    const inners = [
      `<CwsH3>Correction: the notice below was published in error and the departure will operate</CwsH3>${cancelP}`,
      `<CwsList><CwsLi>The cancellation has been revoked.</CwsLi></CwsList>${cancelP}`,
      `<CwsText>The departure was reinstated.</CwsText>${cancelP}`,
      `The cancellation was revoked. ${cancelP}`,
    ];
    for (const inner of inners) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlertInner(inner, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
      expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
    }
  });

  it('F7 R7-B2: Scheduler 2025 wygasły → bez fallbacku na rok bieżący', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const st = new MemStore();
    st.sailings.push({ ...sailingsOk });
    await runFerryStatus(deps(st, {
      'tallink.com': wrapAlert(
        'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.',
        '2025-11-02',
      ),
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(false);
  });

  it('F7 R7-B3: przeprosiny/due-to poza listą → ryzyko; May ≠ may → ODWOLANY', async () => {
    const sailingsNov = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const riskTexts = [
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled. We apologise for any inconvenience and the departure will operate.',
      'Sorry, we apologise for any inconvenience. The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.',
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled. We apologise for all inconvenience.',
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled due to a strike.',
      'The MyStar 16:30 departure on 2 November from Tallinn to Helsinki is cancelled due to a technical fault, please check later.',
      'Today, 2 November, the MyStar 16:30 departure from Tallinn to Helsinki is cancelled due to a technical fault, please check later.',
    ];
    for (const text of riskTexts) {
      expect(autoCancelFromCancelSentence(text, 2026)).toBeNull();
      const st = new MemStore();
      st.sailings.push({ ...sailingsNov });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
    }

    // R7-B3: miesiąc May nie jest CONDITIONAL may → ODWOLANY.
    const mayText =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 May is cancelled.';
    expect(autoCancelFromCancelSentence(mayText, 2026)).toMatchObject({
      startYmd: '2026-05-02', hm: '16:30', vessel: 'M/F MyStar', routes: ['TLL-HEL'],
    });
    const stMay = new MemStore();
    stMay.sailings.push({
      id: 's-may', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-05-02T13:30:00.000Z', arrival_at: '2026-05-02T15:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(stMay, {
      'tallink.com': wrapAlert(mayText, '2026-05-02'),
      'ts.ee': 503, portsofstockholm: 503,
    }, new Date('2026-04-30T10:00:00.000Z')));
    expect(stMay.sailings[0]!.status).toBe('ODWOLANY');
    expect(stMay.notices).toHaveLength(1);
  });

  it('F7 R8-B1: zagnieżdżony Scheduler ucinał Alert → ryzyko (nie ODWOLANY)', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const nested =
      `<Scheduler dateStart="2026-11-01" dateEnd="2026-11-03">` +
      `<CwsSection data-analytics-group="Alert">` +
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsP>The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.</CwsP>` +
      `</Scheduler>` +
      `<CwsP>Correction: the departure will operate.</CwsP>` +
      `</CwsSection></Scheduler>`;
    const json = JSON.stringify({ page: { content: { rendered: nested } } })
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e');
    const html = `<!DOCTYPE html><html><body><script id="__CMS__">${json}</script></body></html>`;
    const st = new MemStore();
    st.sailings.push({ ...sailingsOk });
    await runFerryStatus(deps(st, {
      'tallink.com': html,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
  });

  it('F7 R8-B2: bez ^ we wzorcach 1 i 2 → fałszywy match; z ^ → ryzyko', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const riskTexts = [
      // Wzorzec 1 (on date from/to): bez ^ łapałby od „the MyStar…”.
      'It is not true that the MyStar 16:30 departure on 2 November from Tallinn to Helsinki is cancelled.',
      // Wzorzec 2 (today, date, ship…): bez ^ łapałby od „today, 2 November…”.
      'Correction: today, 2 November, the MyStar 16:30 departure from Tallinn to Helsinki is cancelled.',
    ];
    for (const text of riskTexts) {
      expect(autoCancelFromCancelSentence(text, 2026)).toBeNull();
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlert(text, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
    }
  });

  it('F7 R8 decyzja 70: atrybuty / komentarze HTML / from Tallinn to Tallinn → ryzyko', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const attrCases = [
      `<CwsAlert title="Correction: the departure will operate as planned"><CwsP>${cancel}</CwsP></CwsAlert>`,
      `<CwsLink text="Departure reinstated - details"/><CwsP>${cancel}</CwsP>`,
    ];
    for (const inner of attrCases) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlertInner(inner, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
      expect(st.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
    }

    // Komentarz HTML z wzorcem → brak ODWOLANY.
    const commented = `<!--<CwsP>${cancel}</CwsP><x-->`;
    const stComment = new MemStore();
    stComment.sailings.push({ ...sailingsOk });
    await runFerryStatus(deps(stComment, {
      'tallink.com': wrapAlertInner(commented, '2026-11-02'),
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(stComment.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(stComment.notices).toHaveLength(0);
    expect(stComment.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(false);

    // from Tallinn to Tallinn → trasa nierozpoznana → ryzyko.
    const samePort =
      'The MyStar 16:30 departure from Tallinn to Tallinn on 2 November is cancelled.';
    expect(autoCancelFromCancelSentence(samePort, 2026)).toBeNull();
    const stSame = new MemStore();
    stSame.sailings.push({ ...sailingsOk });
    await runFerryStatus(deps(stSame, {
      'tallink.com': wrapAlert(samePort, '2026-11-02'),
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(stSame.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(stSame.notices).toHaveLength(0);
    expect(stSame.risks.some((r) => r.titleKey === 'rk_tallink_alert_ambiguous')).toBe(true);
  });

  it('F7 R9 / decyzja 71: allowlista HTML — obejścia R9-B1..B4 → ryzyko; fixture → ODWOLANY', async () => {
    const sailingsOk = {
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL' as const,
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null as string | null, delayed_arrival_at: null as string | null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    };
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';

    // Fixture (CwsSpan / hideSpacing / timeStart) mieści się w allowliście → ODWOLANY.
    expect(parseTallinkAlerts(FIX, TALLINK_HOME(), NOW).alerts[0]!.autoCancelOk).toBe(true);

    const riskInners = [
      // R9-B1: </Scheduler> w komentarzu ucinał blok.
      `<CwsP>${C}</CwsP><!--</Scheduler>--><CwsP>Correction: the departure will operate as planned.</CwsP>`,
      // R9-B2: atrybut z &nbsp; (title niedozwolony + encje w wartości).
      `<CwsAlert title="Correction:&nbsp;the&nbsp;departure&nbsp;will&nbsp;operate"><CwsP>${C}</CwsP></CwsAlert>`,
      // R9-B3: znaczniki komentarza w atrybutach img.
      `<CwsP>${C}</CwsP><img alt="<!--"><CwsP>Correction: the departure will operate.</CwsP><img alt="-->">`,
      // CwsLink / nieznany atrybut / zagnieżdżony Scheduler / nieznana encja.
      `<CwsLink text="Departure reinstated - details"/><CwsP>${C}</CwsP>`,
      `<CwsP foo="bar">${C}</CwsP>`,
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02"><CwsP>${C}</CwsP></Scheduler>`,
      `<CwsP>${C}&#x3C;</CwsP>`,
      // Sam komentarz z wzorcem.
      `<!--<CwsP>${C}</CwsP>-->`,
    ];
    for (const inner of riskInners) {
      const st = new MemStore();
      st.sailings.push({ ...sailingsOk });
      await runFerryStatus(deps(st, {
        'tallink.com': wrapAlertInner(inner, '2026-11-02'),
        'ts.ee': 503, portsofstockholm: 503,
      }, NOW));
      expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
      expect(st.notices).toHaveLength(0);
    }

    // Mutacje allowlisty (jednostkowe): poluzowanie → true na wejściu, które musi padać.
    const badFull =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP><!--x--></CwsSection></Scheduler>`;
    expect(alertHtmlAllowsAutoCancel(badFull)).toBe(false);
    const okFull =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    expect(alertHtmlAllowsAutoCancel(okFull)).toBe(true);
    const imgFull =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><img alt="x"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    expect(alertHtmlAllowsAutoCancel(imgFull)).toBe(false);
  });

  it('F7 R10-B1/B2/B3: każda mutacja łamie dokładnie jedną regułę allowlisty', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const ok =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    expect(alertHtmlAllowsAutoCancel(ok)).toBe(true);

    // R10-B3: każdy przypadek łamie dokładnie jedną regułę.
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsAlert><CwsP>${C}</CwsP></CwsAlert></CwsSection></Scheduler>`,
    )).toBe(false); // tag CwsAlert
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsLink/><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // tag CwsLink
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP title="x">${C}</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // attr title
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP text="x">${C}</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // attr text
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP alt="x">${C}</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // attr alt
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP class="a&amp;b">${C}</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // & w wartości atrybutu
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02" title="x">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // attr title na Scheduler
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}&lt;</CwsP></CwsSection></Scheduler>`,
    )).toBe(false); // niedozwolona encja
    // R10-B1: goły `<` bez litery tagu.
    for (const leak of [
      `<CwsP>${C} <- correction</CwsP>`,
      `< CwsP Correction: planned>`,
      `<1 Correction: planned>`,
      `<= Correction: planned>`,
    ]) {
      expect(alertHtmlAllowsAutoCancel(
        `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
        `<CwsSection data-analytics-group="Alert">${leak}</CwsSection></Scheduler>`,
      )).toBe(false);
    }
    // R10-B2: niezbalansowane tagi (Scheduler zamyka przed CwsSection).
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></Scheduler>` +
      `<CwsP>Correction: the departure will operate as planned.</CwsP></CwsSection></Scheduler>`,
    )).toBe(false);
    // R10-B2 reguła 3: surowy `-->` w bloku → brak auto.
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C} --></CwsP></CwsSection></Scheduler>`,
    )).toBe(false);
    // Fallback bez Schedulera → brak auto.
    expect(alertHtmlAllowsAutoCancel(
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection>`,
    )).toBe(false);
  });

  it('F7 / decyzja 72: remis dateStart+timeStart → ryzyko (nie ODWOLANY)', async () => {
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const correction =
      'Correction: the MyStar 16:30 departure will operate as planned.';
    // Ten sam timeStart → remis (mutacja: traktowanie remisu jako najnowszy → pada).
    const html = wrapTwoAlertsTimed(
      `<CwsP>${cancel}</CwsP>`,
      '00:01',
      `<CwsP>${correction}</CwsP>`,
      '00:01',
      '2026-11-02',
    );
    const alerts = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(html, TALLINK_HOME(), NOW).alerts,
    );
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.every((a) => a.autoCancelOk === false)).toBe(true);

    const st = new MemStore();
    st.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st, {
      'tallink.com': html,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(true);
  });

  it('F7 / decyzja 72: starszy C + nowszy Correction → brak ODWOLANY', async () => {
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const correction =
      'Correction: the MyStar 16:30 departure will operate as planned.';
    const html = wrapTwoAlertsTimed(
      `<CwsP>${cancel}</CwsP>`,
      '08:00',
      `<CwsP>${correction}</CwsP>`,
      '12:00',
      '2026-11-02',
    );
    const alerts = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(html, TALLINK_HOME(), NOW).alerts,
    );
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    const cancelAlert = alerts.find((a) => /cancelled/i.test(a.text))!;
    const corrAlert = alerts.find((a) => /correction/i.test(a.text))!;
    expect(cancelAlert.autoCancelOk).toBe(false);
    expect(corrAlert.kind).toBe('INFO');
    // Mutacja: wybór najstarszego → cancel.autoCancelOk true → pada.
    expect(alerts.filter((a) => a.autoCancelOk).length).toBe(0);

    const st = new MemStore();
    st.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st, {
      'tallink.com': html,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(true);
  });

  it('F7 / decyzja 72: starszy Correction + nowszy C → ODWOLANY', async () => {
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const correction =
      'Correction: the MyStar 16:30 departure will operate as planned.';
    // Mutacja: ignorowanie timeStart (oba 00:00) → remis / brak ODWOLANY → pada.
    const html = wrapTwoAlertsTimed(
      `<CwsP>${correction}</CwsP>`,
      '08:00',
      `<CwsP>${cancel}</CwsP>`,
      '14:00',
      '2026-11-02',
    );
    const alerts = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(html, TALLINK_HOME(), NOW).alerts,
    );
    const cancelAlert = alerts.find((a) => /cancelled/i.test(a.text) && !/correction/i.test(a.text))!;
    expect(cancelAlert.autoCancelOk).toBe(true);
    expect(cancelAlert.windowTimeStart).toBe('14:00');

    const st = new MemStore();
    st.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st, {
      'tallink.com': html,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ODWOLANY');
    expect(st.notices).toHaveLength(1);
    expect(st.notices[0]!.source).toBe('AUTO');
  });

  it('F7 R11-B1: atrybut title na Scheduler → ZAPLANOWANY (ścieżka runFerryStatus)', async () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    // Mutacja: alertHtmlAllowsAutoCancel tylko na body bez attrs → ten test pada.
    const inner =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02" title="Correction: the departure will operate as planned">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const html = wrapRendered(inner);
    const st = new MemStore();
    st.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st, {
      'tallink.com': html,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
  });

  it('F7 R11 / decyzja 72: cancel HOME + Correction HEL-TLL → brak ODWOLANY', async () => {
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const correction =
      'Correction: the MyStar 16:30 departure will operate as planned. Book now.';
    const home = wrapAlertTimed(cancel, '2026-11-02', '08:00');
    const hel = wrapAlertTimed(correction, '2026-11-02', '12:00');
    const st = new MemStore();
    st.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    // Mutacja: wybór per strona → cancel z HOME nadal ODWOLANY.
    await runFerryStatus(deps(st, {
      'helsinki-tallinn': hel,
      'tallink.com': home,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st.notices).toHaveLength(0);
    expect(st.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(true);
  });

  it('F7 R11 / decyzja 72: zła data Schedulera → ryzyko bez wyjątku', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const inner =
      `<Scheduler dateStart="2026-13-01" dateEnd="2026-13-01" timeStart="10:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const alerts = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(inner), TALLINK_HOME(), NOW).alerts,
    );
    expect(alerts[0]!.filterReject).toBe('invalid_date');
    expect(alerts[0]!.autoCancelOk).toBe(false);
  });

  it('F7 R11 / decyzja 72: kampania strukturalna obok C → ODWOLANY', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const camp =
      `<Scheduler dateStart="2026-11-02" timeStart="18:00" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsAlert type="campaign"><CwsP>Book now</CwsP></CwsAlert></CwsSection></Scheduler>`;
    const cancel =
      `<Scheduler dateStart="2026-11-02" timeStart="10:00" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const alerts = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(camp + cancel), TALLINK_HOME(), NOW).alerts,
    );
    const win = alerts.find((a) => /cancelled/i.test(a.text))!;
    expect(win.autoCancelOk).toBe(true);
    expect(alerts.some((a) => a.isCampaign)).toBe(true);
  });

  it('F7 / decyzja 72: jeden Alert → nadal ODWOLANY', () => {
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const one = parseTallinkAlerts(wrapAlert(cancel, '2026-11-02'), TALLINK_HOME(), NOW).alerts[0]!;
    expect(one.autoCancelOk).toBe(true);
  });

  it('F7 R12-B1: zła/brakująca data lub godzina → brak auto (także length=1)', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const cases = [
      `<Scheduler dateStart="2026-11-2" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-13-01" dateEnd="2026-13-01"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart='2026-11-02' dateEnd='2026-11-02'><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-11-02" timeStart="16.30" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-11-02" timeStart="25:00" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-11-02" timeStart="24:00" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-11-02" timeStart="7:5" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-11-03" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
      `<Scheduler dateStart="2026-11-02" dateStart="2026-11-03" dateEnd="2026-11-02"><CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`,
    ];
    // Pojedyncze cudzysłowy są OK (R12-B1) — ten wariant ma auto.
    const singleOk = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(cases[3]!), TALLINK_HOME(), NOW).alerts,
      NOW,
    );
    expect(singleOk[0]!.autoCancelOk).toBe(true);

    for (const [i, inner] of cases.entries()) {
      if (i === 3) continue;
      const alerts = finalizeTallinkAlertsForStatus(
        parseTallinkAlerts(wrapRendered(inner), TALLINK_HOME(), NOW).alerts,
        NOW,
      );
      expect(alerts.every((a) => a.autoCancelOk === false), `case ${i}`).toBe(true);
    }

    // Nowsze sprostowanie ze złą datą nie może wygrać — oba bez auto.
    const badCorr =
      `<Scheduler dateStart="2026-11-2" timeStart="18:00" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>Correction: operates as planned.</CwsP></CwsSection></Scheduler>`;
    const goodC =
      `<Scheduler dateStart="2026-11-02" timeStart="10:00" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const mixed = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(goodC + badCorr), TALLINK_HOME(), NOW).alerts,
      NOW,
    );
    expect(mixed.every((a) => a.autoCancelOk === false)).toBe(true);
  });

  it('F7 R12-B2: bez grupowania po dniach; ogromne okno bez OOM', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const corr = 'Correction: the MyStar 16:30 departure will operate as planned.';
    // C 30.10 + sprostowanie 31.10 → sprostowanie nowsze → brak ODWOLANY.
    const a =
      `<Scheduler dateStart="2026-10-30" timeStart="10:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>` +
      `<Scheduler dateStart="2026-10-31" timeStart="10:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${corr}</CwsP></CwsSection></Scheduler>`;
    expect(finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(a), TALLINK_HOME(), NOW).alerts, NOW,
    ).every((x) => !x.autoCancelOk)).toBe(true);

    // C 29–30.10 + sprostowanie 31.10–2.11 → brak ODWOLANY.
    const b =
      `<Scheduler dateStart="2026-10-29" dateEnd="2026-10-30" timeStart="10:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>` +
      `<Scheduler dateStart="2026-10-31" dateEnd="2026-11-02" timeStart="10:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${corr}</CwsP></CwsSection></Scheduler>`;
    expect(finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(b), TALLINK_HOME(), NOW).alerts, NOW,
    ).every((x) => !x.autoCancelOk)).toBe(true);

    const t0 = Date.now();
    const huge =
      `<Scheduler dateStart="2026-10-31" dateEnd="9999-12-31" timeStart="00:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const h = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(huge), TALLINK_HOME(), NOW).alerts, NOW,
    );
    expect(Date.now() - t0).toBeLessThan(100);
    // Bez pętli dni: ogromne dateEnd nie wybucha; sam C → auto.
    expect(h[0]!.autoCancelOk).toBe(true);
  });

  it('F7 R12-B3: dedupe rawFull — title/komentarz na HEL nie zostawia czystego HOME', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const home = wrapAlertTimed(C, '2026-11-02', '10:00');
    const helTitle =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02" timeStart="10:00" title="Correction: the departure will operate as planned">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const merged = finalizeTallinkAlertsForStatus([
      ...parseTallinkAlerts(home, TALLINK_HOME(), NOW).alerts,
      ...parseTallinkAlerts(wrapRendered(helTitle), 'https://www.tallink.com/en/helsinki-tallinn', NOW).alerts,
    ], NOW);
    // Różne rawFull → remis tego samego klucza czasu → brak auto.
    expect(merged.every((a) => a.autoCancelOk === false)).toBe(true);
  });

  it('F7 R12 / 72a: przyszły C nie wygrywa nad aktywnym sprostowaniem', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const corr = 'Correction: the MyStar 16:30 departure will operate as planned.';
    const html =
      `<Scheduler dateStart="2026-11-01" timeStart="08:00" dateEnd="2026-11-01">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>` +
      `<Scheduler dateStart="2026-10-31" dateEnd="2026-11-02" timeStart="12:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${corr}</CwsP></CwsSection></Scheduler>`;
    const alerts = finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(html), TALLINK_HOME(), NOW).alerts, NOW,
    );
    expect(alerts.every((a) => a.autoCancelOk === false)).toBe(true);
  });

  it('F7 R12 / 72b: pojedynczy cudzysłów Alert; kampania data-type nie liczy; luźny → brak auto', () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const quoted =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group='Alert'><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    expect(finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(quoted), TALLINK_HOME(), NOW).alerts, NOW,
    )[0]!.autoCancelOk).toBe(true);

    // data-type="campaign" nie jest kampanią strukturalną — treść serwisowa w „fałszywej” kampanii.
    const fakeCamp =
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsAlert data-type="campaign"><CwsP>${C}</CwsP></CwsAlert></CwsSection></Scheduler>`;
    // allowlista HTML: data-type niedozwolony → brak auto z HTML; finalize bez trucizny kampanii.
    expect(finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(fakeCamp), TALLINK_HOME(), NOW).alerts, NOW,
    )[0]!.autoCancelOk).toBe(false);

    // Jawna kampania z treścią cancel → trucizna 72b (brak auto dla wszystkich).
    const poison =
      `<Scheduler dateStart="2026-11-02" timeStart="18:00" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsAlert type="campaign"><CwsP>${C}</CwsP></CwsAlert></CwsSection></Scheduler>` +
      `<Scheduler dateStart="2026-11-02" timeStart="10:00" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    expect(finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(wrapRendered(poison), TALLINK_HOME(), NOW).alerts, NOW,
    ).every((a) => !a.autoCancelOk)).toBe(true);

    // Luźny Alert poza Schedulerem.
    const loose = wrapRendered(`<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection>`);
    expect(finalizeTallinkAlertsForStatus(
      parseTallinkAlerts(loose, TALLINK_HOME(), NOW).alerts, NOW,
    ).every((a) => !a.autoCancelOk)).toBe(true);
  });

  it('F7 R12 / 72c: zdegradowany Alert podnosi ryzyko mimo auto-zwycięzcy', async () => {
    const cancel =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const older =
      'The Megastar 07:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    const html = wrapTwoAlertsTimed(
      `<CwsP>${older}</CwsP>`,
      '08:00',
      `<CwsP>${cancel}</CwsP>`,
      '14:00',
      '2026-11-02',
    );
    const st = new MemStore();
    st.sailings.push(
      {
        id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
        departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
      {
        id: 's-0730', vessel_id: 'v-mega', route: 'TLL-HEL',
        departure_at: '2026-11-02T05:30:00.000Z', arrival_at: '2026-11-02T07:30:00.000Z',
        delayed_departure_at: null, delayed_arrival_at: null,
        status: 'ZAPLANOWANY', source: 'TALLINK',
      },
    );
    await runFerryStatus(deps(st, {
      'tallink.com': html,
      'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st.sailings.find((s) => s.id === 's-1630')!.status).toBe('ODWOLANY');
    // Mutacja: hasAutoWinner pomija zdegradowane → brak ryzyka dla starszego Megastar.
    expect(st.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(true);
  });

  it('F7 R12: brakujące testy — Update on…, br, C>correction, zła data runFerryStatus', async () => {
    const C =
      'The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.';
    // Update on 30 October nowsze → brak ODWOLANY.
    const upd =
      wrapTwoAlertsTimed(
        `<CwsP>${C}</CwsP>`,
        '08:00',
        `<CwsP>Update on 30 October: the MyStar 16:30 departure will operate as planned.</CwsP>`,
        '18:00',
        '2026-11-02',
      );
    const st1 = new MemStore();
    st1.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st1, { 'tallink.com': upd, 'ts.ee': 503, portsofstockholm: 503 }, NOW));
    expect(st1.sailings[0]!.status).toBe('ZAPLANOWANY');

    // br w poprawnym komunikacie → ODWOLANY.
    const withBr = wrapAlertInner(
      `<CwsP>The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.<br></CwsP>` +
      `<CwsP>We apologise for any inconvenience.</CwsP>`,
      '2026-11-02',
    );
    const st2 = new MemStore();
    st2.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st2, { 'tallink.com': withBr, 'ts.ee': 503, portsofstockholm: 503 }, NOW));
    expect(st2.sailings[0]!.status).toBe('ODWOLANY');

    // C > correction (goły `>`) → brak allowlisty HTML / brak auto → ryzyko.
    const gt = wrapAlertInner(`<CwsP>${C} > correction</CwsP>`, '2026-11-02');
    expect(alertHtmlAllowsAutoCancel(
      `<Scheduler dateStart="2026-11-02" dateEnd="2026-11-02">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C} > correction</CwsP></CwsSection></Scheduler>`,
    )).toBe(false);
    const st3 = new MemStore();
    st3.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st3, { 'tallink.com': gt, 'ts.ee': 503, portsofstockholm: 503 }, NOW));
    expect(st3.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st3.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(true);

    // Zła data przez runFerryStatus.
    const bad =
      `<Scheduler dateStart="2026-13-01" dateEnd="2026-13-01" timeStart="10:00">` +
      `<CwsSection data-analytics-group="Alert"><CwsP>${C}</CwsP></CwsSection></Scheduler>`;
    const st4 = new MemStore();
    st4.sailings.push({
      id: 's-1630', vessel_id: MYST, route: 'TLL-HEL',
      departure_at: '2026-11-02T14:30:00.000Z', arrival_at: '2026-11-02T16:30:00.000Z',
      delayed_departure_at: null, delayed_arrival_at: null,
      status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    await runFerryStatus(deps(st4, {
      'tallink.com': wrapRendered(bad), 'ts.ee': 503, portsofstockholm: 503,
    }, NOW));
    expect(st4.sailings[0]!.status).toBe('ZAPLANOWANY');
    expect(st4.risks.some((r) => String(r.titleKey).startsWith('rk_tallink_alert_'))).toBe(true);
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
  return wrapAlertInner(`<CwsP>${esc}</CwsP>`, ymd);
}

/** R7-B1: dowolna treść wewnątrz CwsSection Alert (H3/List/Text/goły + CwsP). */
function wrapAlertInner(sectionInner: string, ymd: string): string {
  const inner =
    `<Scheduler dateStart="${ymd}" timeStart="00:01" dateEnd="${ymd}" timeEnd="23:59">` +
    `<CwsSection data-analytics-group="Alert">${sectionInner}</CwsSection></Scheduler>`;
  return wrapRendered(inner);
}

function wrapAlertTimed(text: string, ymd: string, hm: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const inner =
    `<Scheduler dateStart="${ymd}" timeStart="${hm}" dateEnd="${ymd}" timeEnd="23:59">` +
    `<CwsSection data-analytics-group="Alert"><CwsP>${esc}</CwsP></CwsSection></Scheduler>`;
  return wrapRendered(inner);
}

/** F7 / decyzja 72: dwa bloki Scheduler/Alert z osobnym timeStart (najnowszy wygrywa). */
function wrapTwoAlertsTimed(
  inner1: string,
  time1: string,
  inner2: string,
  time2: string,
  ymd: string,
): string {
  const block = (sectionInner: string, hm: string) =>
    `<Scheduler dateStart="${ymd}" timeStart="${hm}" dateEnd="${ymd}" timeEnd="23:59">` +
    `<CwsSection data-analytics-group="Alert">${sectionInner}</CwsSection></Scheduler>`;
  return wrapRendered(block(inner1, time1) + block(inner2, time2));
}

function wrapRendered(inner: string): string {
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
