/**
 * A6 / #650 — zapis WT→plik: konflikt dat, 6 pól WT nadpisuje, workbook PATCH (bez PUT).
 */
import { describe, expect, it, vi } from 'vitest';
import { shareUrlToShareId, type GraphEnv } from '../supabase/functions/_shared/ksh/graph';
import {
  conflictFieldFromSnaps,
  fileAlreadyHasPatch,
  fileRowChangedSinceRead,
  missingExpectedFile,
  pickOutboundConflictNote,
  resolveOutboundExpected,
} from '../supabase/functions/_shared/ksh/writeConflict';
import { ackPayload } from '../supabase/functions/_shared/ksh/ackPayload';
import {
  excelDateFromIso,
  excelTimeFromHm,
  excelSerialFromIso,
  formatDateTextFromIso,
  normalizeHm,
} from '../supabase/functions/_shared/ksh/xlsxPatchTime';
import { COLUMN_MAP_DEFAULT } from '../supabase/functions/_shared/ksh/importColumnMap';
import { outboundWriteProdGate } from '../supabase/functions/_shared/ksh/outboundWriteGate';
import { processOutboundWrites } from '../supabase/functions/_shared/ksh/outboundWrite';
import {
  cellAlreadyHasTarget,
  cellMatchesExpected,
  columnHasDateFormat,
  formatLooksLikeDate,
  indexToColLetters,
  layoutFromValuesForTest,
  parseUsedRangeOrigin,
  stripLeadingApostrophe,
  textValueForPatch,
  writePatchesViaWorkbook,
} from '../supabase/functions/_shared/ksh/workbookCellWrite';
import {
  isOutboundTransientReason,
  outboundTransientRetryDelayMinutes,
} from '../supabase/functions/_shared/ksh/outboundTransient';
import { WORKBOOK_AUTH_REASON } from '../supabase/functions/_shared/ksh/graphWorkbook';

const env = (): GraphEnv => ({
  SHAREPOINT_TENANT_ID: 't',
  SHAREPOINT_CLIENT_ID: 'c',
  SHAREPOINT_CLIENT_SECRET: 's',
  SHAREPOINT_FILE_URL: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/a.xlsx',
  SHAREPOINT_TEST_FILE_URL: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/test.xlsx',
  SHAREPOINT_FILE_MODE: 'test',
});

describe('A6 outboundWriteProdGate (#637 F7)', () => {
  it('prod bez writeTestOkAt → write_test_required', () => {
    expect(outboundWriteProdGate({ fileMode: 'prod', writeTestOkAt: null }))
      .toEqual({ block: true, write_reason: 'write_test_required' });
  });

  it('test / prod z writeTestOkAt → bez bloku (kolejka; import off nie bramkuje)', () => {
    expect(outboundWriteProdGate({ fileMode: 'test', writeTestOkAt: null }))
      .toEqual({ block: false });
    expect(outboundWriteProdGate({ fileMode: 'prod', writeTestOkAt: '2026-10-29T12:00:00Z' }))
      .toEqual({ block: false });
  });
});

describe('A6 resolveOutboundExpected (#637 a — próba na kopii)', () => {
  const prodSnap = {
    ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: null, co: 'P1', ho: 'H1',
  };
  const copySnap = {
    ld: '2026-10-01', lt: '07:00', dd: '2026-10-05', dt: null, co: 'C1', ho: 'H1',
  };

  it('prod → expected_file z kolejki (bez podmiany na kopię)', () => {
    expect(resolveOutboundExpected({
      fileMode: 'prod',
      expectedFile: prodSnap,
      fileSnapshot: { 'SG-01': copySnap },
      codes: ['SG-01'],
    })).toEqual(prodSnap);
  });

  it('test → migawka z kopii w cyklu (nie prod)', () => {
    expect(resolveOutboundExpected({
      fileMode: 'test',
      expectedFile: prodSnap,
      fileSnapshot: { 'SG-01': copySnap },
      codes: ['SG-01'],
    })).toEqual(copySnap);
  });

  it('test bez wiersza w kopii → spadnij na expected_file', () => {
    expect(resolveOutboundExpected({
      fileMode: 'test',
      expectedFile: prodSnap,
      fileSnapshot: {},
      codes: ['SG-01'],
    })).toEqual(prodSnap);
  });
});

describe('A6 ackPayload (F7 r4)', () => {
  it('z sent: id/rev/patch; bez sent: tylko id/rev', () => {
    const items = [{
      id: 42, load_id: 'x', code: 'SG-01', rev: 3,
      patch: { carrier_order_no: 'H1' },
    }];
    expect(ackPayload(items, true)).toEqual([{
      id: 42, rev: 3, sent: { carrier_order_no: 'H1' },
    }]);
    expect(ackPayload(items, false)).toEqual([{ id: 42, rev: 3 }]);
    expect(ackPayload([{ ...items[0], rev: undefined }], true)[0].rev).toBe(1);
  });
});

describe('A6 writeConflict', () => {
  it('bez expected → missingExpected (nie zapisuj)', () => {
    expect(missingExpectedFile(null)).toBe(true);
    expect(fileRowChangedSinceRead(null, { ld: '2026-11-01', lt: null, dd: null, dt: null })).toBe(false);
  });

  it('brak wiersza w pliku przy expected → konflikt', () => {
    expect(fileRowChangedSinceRead(
      { ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: null },
      null,
    )).toBe(true);
  });

  it('ten sam snap → bez konfliktu; zmiana daty → konflikt; numer (#650) → bez konfliktu', () => {
    const a = {
      ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00', co: 'S1', ho: 'K1',
    };
    expect(fileRowChangedSinceRead(a, { ...a })).toBe(false);
    expect(fileRowChangedSinceRead(a, { ...a, ld: '2026-11-02' })).toBe(true);
    // #650: numery WT→plik bez kontroli konfliktu
    expect(fileRowChangedSinceRead(a, { ...a, co: 'S2' })).toBe(false);
  });

  it('F7 r8/r9 + #650: conflictFieldFromSnaps — tylko daty/godziny', () => {
    const a = {
      ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00', co: 'S1', ho: 'K1',
    };
    // same daty, różny numer → brak pola daty; fallback load_date
    expect(conflictFieldFromSnaps(a, { ...a, ho: 'K2' })).toBe('load_date');
    expect(conflictFieldFromSnaps(a, { ...a, co: 'S2', ho: 'K2' })).toBe('load_date');
    expect(conflictFieldFromSnaps(a, { ...a, ld: '2026-11-02', co: 'S2' })).toBe('load_date');
    expect(conflictFieldFromSnaps(a, { ...a })).toBe('load_date');
    // łatka {load_date} + rozjazd daty
    expect(conflictFieldFromSnaps(
      a, { ...a, ld: '2026-11-02', co: 'S2' }, ['load_date'],
    )).toBe('load_date');
    // łatka tylko numery (poza CONFLICT_FIELD_ORDER) → dowolna data różniąca się
    expect(conflictFieldFromSnaps(
      a, { ...a, ld: '2026-11-02', co: 'S1' }, ['carrier_order_no'],
    )).toBe('load_date');
  });

  it('#569/#650: pickOutboundConflictNote — tylko daty; numery bez konfliktu', () => {
    const expected = {
      ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00', co: 'S1', ho: 'K1',
    };
    // Różnica tylko w numerze → brak konfliktu (#650)
    const snap = {
      'SG-A': { ...expected },
      'SG-B': { ...expected, ho: 'K2' },
    };
    expect(pickOutboundConflictNote(
      ['SG-A', 'SG-B'],
      expected,
      snap,
      { carrier_order_no: 'S9' },
    )).toBeNull();
    // Data różna w SG-B → konflikt load_date (nie numer)
    expect(pickOutboundConflictNote(
      ['SG-A', 'SG-B'],
      expected,
      { 'SG-A': { ...expected }, 'SG-B': { ...expected, co: 'S2', ld: '2026-11-02' } },
      { carrier_order_no: 'S9', load_date: '2026-11-03' },
    )).toEqual({ code: 'SG-B', field: 'load_date' });
    expect(pickOutboundConflictNote(['SG-A'], expected, snap, { carrier_order_no: 'S9' })).toBeNull();
    // Pierwszy kod: data; drugi: tylko numer → wybierz pierwszy (data)
    expect(pickOutboundConflictNote(
      ['SG-A', 'SG-B'],
      expected,
      {
        'SG-A': { ...expected, ld: '2026-11-02' },
        'SG-B': { ...expected, co: 'S2' },
      },
      { carrier_order_no: 'S9', load_date: '2026-11-03' },
    )).toEqual({ code: 'SG-A', field: 'load_date' });
  });

  it('F7 #570/#650: brak wiersza + drugi tylko z numerem → bez konfliktu dat', () => {
    const expected = {
      ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00', co: 'S1', ho: 'K1',
    };
    expect(pickOutboundConflictNote(
      ['SG-01', 'SG-02'],
      expected,
      { 'SG-02': { ...expected, co: 'S2' } },
      { carrier_order_no: 'S9' },
    )).toBeNull();
    // SG-02 z rozjazdem daty → konflikt
    expect(pickOutboundConflictNote(
      ['SG-01', 'SG-02'],
      expected,
      { 'SG-01': null, 'SG-02': { ...expected, ld: '2026-11-02' } },
      { load_date: '2026-11-03' },
    )).toEqual({ code: 'SG-02', field: 'load_date' });
  });

  it('F7 #570/#650: puste vs null; numery bez konfliktu; zniknięty wiersz', () => {
    const expected = {
      ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00', co: 'S1', ho: 'K1',
    };
    expect(fileRowChangedSinceRead(expected, {
      ...expected, co: 'S1', ho: '  K1  ',
    })).toBe(false);
    expect(fileRowChangedSinceRead(
      { ...expected, co: null, ho: '' },
      { ...expected, co: '', ho: null },
    )).toBe(false);
    expect(fileRowChangedSinceRead(expected, { ...expected, co: ' S2 ' })).toBe(false);
    expect(pickOutboundConflictNote(
      ['SG-A'],
      expected,
      { 'SG-A': { ...expected, co: 'S2' } },
      { carrier_order_no: 'S9' },
    )).toBeNull();
    expect(pickOutboundConflictNote(
      ['SG-A'],
      expected,
      { 'SG-A': { ...expected, ho: 'K2' } },
      null,
    )).toBeNull();
    // kod ze spacją w kluczu snapu — brak wiersza; sam jeden kod → konflikt „zniknął”
    expect(pickOutboundConflictNote(
      ['SG-A'],
      expected,
      { ' SG-A ': { ...expected, co: 'S2' } },
      { carrier_order_no: 'S9' },
    )).toEqual({ code: 'SG-A', field: 'load_date' });
  });
});

describe('A6 xlsxPatchTime', () => {
  it('ISO → UTC północ / serial całkowity (F7 r2)', () => {
    const d = excelDateFromIso('2026-11-15');
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(10);
    expect(d?.getUTCDate()).toBe(15);
    expect(d?.getUTCHours()).toBe(0);
    expect(excelSerialFromIso('2026-10-26')).toBe(46321);
    expect(Number.isInteger(excelSerialFromIso('2026-10-26'))).toBe(true);
  });

  it('formatDateTextFromIso dd.mm.yyyy', () => {
    expect(formatDateTextFromIso('2026-10-26')).toBe('26.10.2026');
    expect(formatDateTextFromIso('2026-10-26', '2026-01-01')).toBe('2026-10-26');
  });

  it('HH:MM → 1899-12-30; normalizeHm', () => {
    const t = excelTimeFromHm('8:30');
    expect(t?.getUTCHours()).toBe(8);
    expect(t?.getUTCMinutes()).toBe(30);
    expect(excelTimeFromHm('bad')).toBeNull();
    expect(normalizeHm('8:05')).toBe('08:05');
    expect(normalizeHm(null)).toBeNull();
  });
});

describe('#645 workbook transient backoff', () => {
  it('5 → 15 → 30 → 60 min', () => {
    expect(outboundTransientRetryDelayMinutes(1)).toBe(5);
    expect(outboundTransientRetryDelayMinutes(2)).toBe(15);
    expect(outboundTransientRetryDelayMinutes(3)).toBe(30);
    expect(outboundTransientRetryDelayMinutes(4)).toBe(60);
  });
  it('429/503/423 = transient; auth 403 nie', () => {
    expect(isOutboundTransientReason('workbook_http_429')).toBe(true);
    expect(isOutboundTransientReason('workbook_http_503')).toBe(true);
    expect(isOutboundTransientReason('upload_http_423')).toBe(true);
    expect(isOutboundTransientReason('network_workbook_patch')).toBe(true);
    expect(isOutboundTransientReason('upload_http_403')).toBe(false);
    expect(isOutboundTransientReason(WORKBOOK_AUTH_REASON)).toBe(false);
  });
});

describe('#645 cellMatchesExpected / layout / B2 / B8', () => {
  it('layout: kod → wiersz po nagłówku Wysyłka', () => {
    const layout = layoutFromValuesForTest([
      [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo, COLUMN_MAP_DEFAULT.driverName],
      ['SG-01', 'OLD', 'Jan'],
      ['SG-02', 'X', ''],
    ]);
    expect('error' in layout).toBe(false);
    if (!('error' in layout)) {
      expect(layout.codeRow.get('SG-01')).toBe(2);
      expect(layout.headerCol.get(COLUMN_MAP_DEFAULT.scxOrderNo)).toBe(2);
    }
  });
  it('B8: usedRange z przesunięciem kolumn; nagłówek nie w wierszu 1 → no_code_col', () => {
    expect(parseUsedRangeOrigin("Harmonogram!C1:E3")).toEqual({ row0: 0, col0: 2 });
    const shifted = layoutFromValuesForTest(
      [
        [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo],
        ['SG-01', 'OLD'],
      ],
      'Harmonogram!C1:D2',
    );
    expect('error' in shifted).toBe(false);
    if (!('error' in shifted)) {
      expect(shifted.headerCol.get(COLUMN_MAP_DEFAULT.shipmentCode)).toBe(3);
      expect(shifted.codeRow.get('SG-01')).toBe(2);
      expect(indexToColLetters(27)).toBe('AA');
    }
    const bad = layoutFromValuesForTest(
      [[COLUMN_MAP_DEFAULT.shipmentCode], ['SG-01']],
      'Sheet1!A2:A3',
    );
    expect(bad).toEqual({ error: 'no_code_col' });
  });
  it('B2: apostrof / formuła / wiodące zero / +tel / PL/SE', () => {
    expect(textValueForPatch('=1+1')).toBe("'=1+1");
    expect(stripLeadingApostrophe("'0701234567")).toBe('0701234567');
    expect(cellMatchesExpected("'0701234567", '0701234567', 'text')).toBe(true);
    expect(cellMatchesExpected("'+46701234567", '+46701234567', 'text')).toBe(true);
    expect(cellMatchesExpected("'PL / SE", 'PL / SE', 'text')).toBe(true);
    expect(cellAlreadyHasTarget("'NEW", 'NEW', 'text')).toBe(true);
  });
  it('data serial vs ISO', () => {
    expect(cellMatchesExpected(46321, '2026-10-26', 'date')).toBe(true);
    expect(cellMatchesExpected('26.10.2026', '2026-10-26', 'date')).toBe(true);
    expect(cellMatchesExpected(46322, '2026-10-26', 'date')).toBe(false);
  });
});

describe('#645 writePatchesViaWorkbook (mock Graph)', () => {
  function mockFetch(opts?: {
    conflictCo?: boolean;
    http429?: boolean;
    http403?: boolean;
    alreadyNew?: boolean;
    patch429After?: number;
    usedAddress?: string;
    throwOnUsedRange?: boolean;
    numberFormat?: unknown[][];
    values?: unknown[][];
    secondCodeConflict?: boolean;
  }) {
    const calls: { method: string; url: string; headers?: HeadersInit; body?: string }[] = [];
    let patchCount = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ method, url: u, headers: init?.headers, body: typeof init?.body === 'string' ? init.body : undefined });
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/content')) {
        return new Response('PUT forbidden in #645', { status: 500 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook') && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'item1',
          parentReference: { driveId: 'drive1' },
          name: 'a.xlsx',
          size: 100,
        }), { status: 200 });
      }
      if (u.includes('createSession')) {
        if (opts?.http403) return new Response('{"error":{}}', { status: 403 });
        if (opts?.http429) return new Response('{"error":{}}', { status: 429 });
        return new Response(JSON.stringify({ id: 'sess-1', persistChanges: true }), { status: 201 });
      }
      if (u.includes('closeSession')) {
        return new Response('{}', { status: 204 });
      }
      if (u.includes('/worksheets') && !u.includes('range') && !u.includes('usedRange')) {
        return new Response(JSON.stringify({
          value: [{ id: 'sheet1', name: 'Harmonogram', position: 0 }],
        }), { status: 200 });
      }
      if (u.includes('usedRange')) {
        if (opts?.throwOnUsedRange) throw new TypeError('boom-used');
        const co = opts?.alreadyNew ? 'NEW' : (opts?.conflictCo ? 'OTHER' : 'OLD');
        const values = opts?.values ?? [
          [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo, COLUMN_MAP_DEFAULT.driverPhone],
          ['SG-01', co, ''],
          ...(opts?.secondCodeConflict
            ? [['SG-02', 'OTHER', ''] as unknown[]]
            : []),
        ];
        return new Response(JSON.stringify({
          address: opts?.usedAddress ?? 'Harmonogram!A1:C2',
          values,
          numberFormat: opts?.numberFormat ?? [
            ['General', 'General', 'General'],
            ['General', 'General', 'General'],
            ...(opts?.secondCodeConflict ? [['General', 'General', 'General']] : []),
          ],
        }), { status: 200 });
      }
      if (u.includes("range(address=") && method === 'PATCH') {
        patchCount += 1;
        if (opts?.patch429After != null && patchCount > opts.patch429After) {
          return new Response('{"error":{}}', { status: 429 });
        }
        const body = init?.body ? JSON.parse(String(init.body)) as { values: unknown[][] } : null;
        // B2: tekst (apostrof) vs data/godzina tekstowa / serial — bez wymuszania ' na datach.
        if (body?.values?.[0]?.[0] != null && typeof body.values[0][0] === 'string') {
          const s = String(body.values[0][0]);
          const dateOrTime = /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s) || /^\d{1,2}:\d{2}$/.test(s);
          if (!dateOrTime) expect(s.startsWith("'")).toBe(true);
        }
        return new Response(JSON.stringify({ values: body?.values ?? [['x']] }), { status: 200 });
      }
      return new Response(`unhandled ${method} ${u}`, { status: 404 });
    }) as unknown as typeof fetch;
    return { fetchFn, calls };
  }

  it('sesja → zapis carrier_order_no; closeSession; brak PUT /content; nagłówek sesji', async () => {
    const { fetchFn, calls } = mockFetch();
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.writtenCodes).toContain('SG-01');
      expect(r.conflicts).toEqual([]);
    }
    expect(calls.some((c) => c.url.includes('/content'))).toBe(false);
    expect(calls.some((c) => c.url.includes('closeSession'))).toBe(true);
    const withSession = calls.filter((c) =>
      c.url.includes('workbook') && !c.url.includes('createSession')
    );
    for (const c of withSession) {
      const h = c.headers as Record<string, string> | undefined;
      expect(h?.['workbook-session-id'] ?? (h as Headers | undefined)?.get?.('workbook-session-id'))
        .toBeTruthy();
    }
  });

  it('B1: komórka już = docelowa → bez PATCH, written', async () => {
    const { fetchFn, calls } = mockFetch({ alreadyNew: true });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.writtenCodes).toContain('SG-01');
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(0);
  });

  // #650: komplet 6 pól już w pliku → 0 PATCH (skip_applied), ack written
  it('#650: komplet WT=plik → 0 PATCH (skip_applied)', async () => {
    const { fetchFn, calls } = mockFetch({
      usedAddress: 'Harmonogram!A1:G2',
      values: [
        [
          COLUMN_MAP_DEFAULT.shipmentCode,
          COLUMN_MAP_DEFAULT.scxOrderNo,
          COLUMN_MAP_DEFAULT.hhlOrderNo,
          COLUMN_MAP_DEFAULT.driverName,
          COLUMN_MAP_DEFAULT.driverPhone,
          COLUMN_MAP_DEFAULT.tractorPlate,
          COLUMN_MAP_DEFAULT.trailerPlate,
        ],
        ['SG-01', 'SCAN-1', 'KSH-1', 'Jan', '600111222', 'TR1', 'TL1'],
      ],
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{
        code: 'SG-01',
        carrier_order_no: 'SCAN-1',
        hhl_order_no: 'KSH-1',
        driver: 'Jan',
        driver_phone: '600111222',
        tractor: 'TR1',
        trailer: 'TL1',
      }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'SCAN-1', ho: 'KSH-1' },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.writtenCodes).toContain('SG-01');
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(0);
  });

  it('#650: numer w pliku ≠ WT → nadpisanie, 0 konfliktów + overwritten_n', async () => {
    const { fetchFn, calls } = mockFetch({ conflictCo: true });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.writtenCodes).toContain('SG-01');
      expect(r.conflicts).toEqual([]);
      expect(r.overwritten_n).toBe(1);
    }
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(1);
  });

  it('#650: inny kierowca + numer w pliku → oba nadpisane, 0 konfliktów', async () => {
    const { fetchFn, calls } = mockFetch({
      values: [
        [
          COLUMN_MAP_DEFAULT.shipmentCode,
          COLUMN_MAP_DEFAULT.scxOrderNo,
          COLUMN_MAP_DEFAULT.driverName,
        ],
        ['SG-01', 'OTHER', 'JanKsh'],
      ],
      usedAddress: 'Harmonogram!A1:C2',
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW', driver: 'JanWt' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.conflicts).toEqual([]);
      expect(r.overwritten_n).toBe(2);
      expect(r.writtenCodes).toContain('SG-01');
    }
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(2);
  });

  it('#650: konflikt daty blokuje daty, nie 6 pól WT', async () => {
    const { fetchFn, calls } = mockFetch({
      values: [
        [
          COLUMN_MAP_DEFAULT.shipmentCode,
          COLUMN_MAP_DEFAULT.loadDate,
          COLUMN_MAP_DEFAULT.scxOrderNo,
          COLUMN_MAP_DEFAULT.driverName,
        ],
        // data w pliku ≠ expected → konflikt; numer/kierowca ≠ WT → nadpisanie
        ['SG-01', '03.11.2026', 'OTHER', 'JanKsh'],
      ],
      usedAddress: 'Harmonogram!A1:D2',
      numberFormat: [
        ['General', 'General', 'General', 'General'],
        ['General', 'General', 'General', 'General'],
      ],
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{
        code: 'SG-01',
        itemKey: 'pos-1',
        load_date: '2026-11-05',
        carrier_order_no: 'NEW',
        driver: 'JanWt',
      }],
      expectedByCode: {
        'SG-01': {
          ld: '2026-11-01', lt: null, dd: null, dt: null, co: 'OLD', ho: null,
        },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.conflicts.some((c) => c.field === 'load_date')).toBe(true);
      expect(r.overwritten_n).toBeGreaterThanOrEqual(2);
      expect(r.writtenCodes).toContain('SG-01');
    }
    // 2 PATCH (kierowca + numer); data zablokowana konfliktem
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(2);
  });

  it('429 createSession → workbook_http_429 + closeSession nie (brak sesji)', async () => {
    const { fetchFn, calls } = mockFetch({ http429: true });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('workbook_http_429');
    expect(calls.some((c) => c.url.includes('closeSession'))).toBe(false);
  });

  it('B7: 403 createSession → workbook_auth_403 + permission', async () => {
    const { fetchFn } = mockFetch({ http403: true });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(WORKBOOK_AUTH_REASON);
      expect(r.permission).toMatch(/Files\.ReadWrite/);
    }
  });

  it('test → shareId z SHAREPOINT_TEST_FILE_URL', async () => {
    const { fetchFn, calls } = mockFetch();
    const e = env();
    e.SHAREPOINT_FILE_MODE = 'test';
    await writePatchesViaWorkbook({
      env: e,
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    const want = shareUrlToShareId(e.SHAREPOINT_TEST_FILE_URL!);
    const shareCalls = calls.filter((c) => c.url.includes('/shares/'));
    expect(shareCalls.some((c) => c.url.includes(want))).toBe(true);
    expect(shareCalls.every((c) => !c.url.includes(shareUrlToShareId(e.SHAREPOINT_FILE_URL!)))).toBe(true);
  });

  it('strażnik test_url_equals_prod', async () => {
    const { fetchFn } = mockFetch();
    const e = env();
    e.SHAREPOINT_FILE_MODE = 'test';
    e.SHAREPOINT_FILE_URL = e.SHAREPOINT_TEST_FILE_URL;
    const r = await writePatchesViaWorkbook({
      env: e,
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('test_url_equals_prod');
  });

  it('B2: telefon z wiodącym zerem jako tekst z apostrofem', async () => {
    const { fetchFn, calls } = mockFetch();
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', driver_phone: '0701234567' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: null, ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toContain("'0701234567");
  });

  it('R1: 429 w środku pętli → writtenCodes tylko pełne kody; closeSession', async () => {
    const { fetchFn, calls } = mockFetch({ patch429After: 1 });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW', driver_phone: '0701234567' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('workbook_http_429');
      expect(r.writtenCodes).toEqual([]);
    }
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(2);
    expect(calls.some((c) => c.url.includes('closeSession'))).toBe(true);
  });

  it('R1: ponowienie po częściowym — skip_applied + dokończenie drugiego pola', async () => {
    const { fetchFn, calls } = mockFetch({
      alreadyNew: true,
      values: [
        [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo, COLUMN_MAP_DEFAULT.driverPhone],
        ['SG-01', 'NEW', ''],
      ],
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW', driver_phone: '0701234567' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.writtenCodes).toEqual(['SG-01']);
    const patches = calls.filter((c) => c.method === 'PATCH');
    expect(patches.length).toBe(1);
    expect(patches[0].body).toContain("'0701234567");
  });

  it('closeSession po wyjątku w trakcie sesji (usedRange)', async () => {
    const { fetchFn, calls } = mockFetch({ throwOnUsedRange: true });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network_workbook_used');
    expect(calls.some((c) => c.url.includes('closeSession'))).toBe(true);
  });

  it('B8 e2e: usedRange C1 → PATCH na D2 (scx)', async () => {
    const { fetchFn, calls } = mockFetch({ usedAddress: 'Harmonogram!C1:E2' });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', carrier_order_no: 'NEW' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toMatch(/range\(address='D2'\)/);
  });

  it('R2/#650: konflikt daty kodu B blokuje daty A+B pozycji; numery WT nadal PATCH', async () => {
    const { fetchFn, calls } = mockFetch({
      usedAddress: 'Harmonogram!A1:C3',
      values: [
        [
          COLUMN_MAP_DEFAULT.shipmentCode,
          COLUMN_MAP_DEFAULT.loadDate,
          COLUMN_MAP_DEFAULT.scxOrderNo,
        ],
        ['SG-01', '01.11.2026', 'OLD'],
        ['SG-02', '02.11.2026', 'OTHER'],
      ],
      numberFormat: [
        ['General', 'General', 'General'],
        ['General', 'General', 'General'],
        ['General', 'General', 'General'],
      ],
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [
        { code: 'SG-01', itemKey: 'pos-1', load_date: '2026-11-05', carrier_order_no: 'NEW' },
        { code: 'SG-02', itemKey: 'pos-1', load_date: '2026-11-05', carrier_order_no: 'NEW' },
      ],
      expectedByCode: {
        'SG-01': { ld: '2026-11-01', lt: null, dd: null, dt: null, co: 'OLD', ho: null },
        'SG-02': { ld: '2026-11-01', lt: null, dd: null, dt: null, co: 'OLD', ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.conflicts.some((c) => c.field === 'load_date')).toBe(true);
      // numery nadpisane mimo konfliktu dat
      expect(calls.filter((c) => c.method === 'PATCH').length).toBe(2);
      expect(r.overwritten_n).toBeGreaterThanOrEqual(1);
    }
  });

  it('R3/R4: pusta komórka + General → tekst daty; format daty → serial; [Red] ≠ data', () => {
    expect(formatLooksLikeDate('General')).toBe(false);
    expect(formatLooksLikeDate('dd.mm.yyyy')).toBe(true);
    expect(formatLooksLikeDate('[Red]0.00')).toBe(false);
    expect(formatLooksLikeDate('0.00;[Red]-0.00')).toBe(false);
    expect(formatLooksLikeDate('"yd"0.00')).toBe(false);
    expect(columnHasDateFormat(
      [['General', 'dd.mm.yyyy'], ['General', 'dd.mm.yyyy']],
      2,
      { row0: 0, col0: 0 },
    )).toBe(true);
    expect(columnHasDateFormat(
      [['General', 'General'], ['General', 'General']],
      2,
      { row0: 0, col0: 0 },
    )).toBe(false);
  });

  it('R3: pusta data przy General → PATCH tekstem dd.mm.yyyy (nie serial)', async () => {
    const { fetchFn, calls } = mockFetch({
      values: [
        [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.loadDate],
        ['SG-01', ''],
      ],
      numberFormat: [
        ['General', 'General'],
        ['General', 'General'],
      ],
      usedAddress: 'Harmonogram!A1:B2',
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', load_date: '2026-10-26' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: null, ho: null },
      },
      fetchFn,
    });
    expect(r.ok).toBe(true);
    const patch = calls.find((c) => c.method === 'PATCH');
    const body = patch?.body ? JSON.parse(patch.body) as { values: unknown[][] } : null;
    expect(body?.values?.[0]?.[0]).toBe('26.10.2026');
  });
});

describe('#645 processOutboundWrites (R1 ack / note_423 / 403)', () => {
  const snap = { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null };
  const item = {
    id: 7,
    load_id: 'load-1',
    code: 'SG-01',
    codes: ['SG-01'],
    rev: 1,
    attempts: 0,
    patch: { carrier_order_no: 'NEW' },
    expected_file: snap,
  };

  function mockSb(opts?: { upsertFail?: boolean }) {
    const rpcs: { name: string; args: Record<string, unknown> }[] = [];
    const sb = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        rpcs.push({ name, args });
        if (name === 'ksh_sync_outbound_list') {
          return { data: [item], error: null };
        }
        if (name === 'ksh_sync_state_upsert' && opts?.upsertFail) {
          return { data: null, error: { message: 'upsert fail' } };
        }
        return { data: true, error: null };
      }),
    };
    return { sb: sb as never, rpcs };
  }

  it('403 → failed + jedna sprawa l1b_note_outbound_failed; bez note_423', async () => {
    const { sb, rpcs } = mockSb();
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook')) {
        return new Response(JSON.stringify({
          id: 'item1', parentReference: { driveId: 'drive1' }, name: 'a.xlsx', size: 1,
        }), { status: 200 });
      }
      if (u.includes('createSession')) return new Response('{}', { status: 403 });
      if (u.includes('closeSession')) return new Response('{}', { status: 204 });
      return new Response('no', { status: 404 });
    }) as unknown as typeof fetch;

    const r = await processOutboundWrites({
      sb,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': snap },
      fileMode: 'test',
      fetchFn,
    });
    expect(r.write_reason).toBe('workbook_auth_403');
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'failed')).toBe(true);
    expect(rpcs.filter((c) => c.name === 'l1b_note_outbound_failed').length).toBe(1);
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_note_423')).toBe(false);
  });

  it('429 częściowy → note_423 bez ack done (brak pełnego kodu)', async () => {
    const { sb, rpcs } = mockSb();
    let patchCount = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook')) {
        return new Response(JSON.stringify({
          id: 'item1', parentReference: { driveId: 'drive1' }, name: 'a.xlsx', size: 1,
        }), { status: 200 });
      }
      if (u.includes('createSession')) {
        return new Response(JSON.stringify({ id: 'sess-1', persistChanges: true }), { status: 201 });
      }
      if (u.includes('closeSession')) return new Response('{}', { status: 204 });
      if (u.includes('/worksheets') && !u.includes('range') && !u.includes('usedRange')) {
        return new Response(JSON.stringify({
          value: [{ id: 'sheet1', name: 'Harmonogram', position: 0 }],
        }), { status: 200 });
      }
      if (u.includes('usedRange')) {
        return new Response(JSON.stringify({
          address: 'Harmonogram!A1:C2',
          values: [
            [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo, COLUMN_MAP_DEFAULT.driverPhone],
            ['SG-01', 'OLD', ''],
          ],
          numberFormat: [['General', 'General', 'General'], ['General', 'General', 'General']],
        }), { status: 200 });
      }
      if (u.includes("range(address=") && method === 'PATCH') {
        patchCount += 1;
        if (patchCount > 1) return new Response('{}', { status: 429 });
        return new Response('{}', { status: 200 });
      }
      return new Response(`unhandled ${u}`, { status: 404 });
    }) as unknown as typeof fetch;

    const item2fields = {
      ...item,
      patch: { carrier_order_no: 'NEW', driver_phone: '0701234567' },
    };
    const sb2 = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        rpcs.push({ name, args });
        if (name === 'ksh_sync_outbound_list') return { data: [item2fields], error: null };
        return { data: true, error: null };
      }),
    };

    const r = await processOutboundWrites({
      sb: sb2 as never,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': snap },
      fileMode: 'test',
      fetchFn,
    });
    expect(r.write_reason).toBe('workbook_http_429');
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_note_423')).toBe(true);
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'done')).toBe(false);
  });

  it('sukces → ack done + clear_423', async () => {
    const { sb, rpcs } = mockSb();
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook')) {
        return new Response(JSON.stringify({
          id: 'item1', parentReference: { driveId: 'drive1' }, name: 'a.xlsx', size: 1,
        }), { status: 200 });
      }
      if (u.includes('createSession')) {
        return new Response(JSON.stringify({ id: 'sess-1', persistChanges: true }), { status: 201 });
      }
      if (u.includes('closeSession')) return new Response('{}', { status: 204 });
      if (u.includes('/worksheets') && !u.includes('range') && !u.includes('usedRange')) {
        return new Response(JSON.stringify({
          value: [{ id: 'sheet1', name: 'Harmonogram', position: 0 }],
        }), { status: 200 });
      }
      if (u.includes('usedRange')) {
        return new Response(JSON.stringify({
          address: 'Harmonogram!A1:C2',
          values: [
            [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo, COLUMN_MAP_DEFAULT.driverPhone],
            ['SG-01', 'OLD', ''],
          ],
          numberFormat: [['General', 'General', 'General'], ['General', 'General', 'General']],
        }), { status: 200 });
      }
      if (u.includes("range(address=") && method === 'PATCH') {
        return new Response('{}', { status: 200 });
      }
      return new Response(`unhandled ${u}`, { status: 404 });
    }) as unknown as typeof fetch;

    const r = await processOutboundWrites({
      sb,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': snap },
      fileMode: 'test',
      fetchFn,
    });
    expect(r.write_reason).toBe('ok');
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'done')).toBe(true);
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_clear_423')).toBe(true);
  });

  it('R4: wielokod SG-01+SG-99 (SG-99 bez wiersza) → done + clear_423', async () => {
    const rpcs: { name: string; args: Record<string, unknown> }[] = [];
    const multi = {
      ...item,
      codes: ['SG-01', 'SG-99'],
      patch: { carrier_order_no: 'NEW' },
    };
    const sb = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        rpcs.push({ name, args });
        if (name === 'ksh_sync_outbound_list') return { data: [multi], error: null };
        return { data: true, error: null };
      }),
    };
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook')) {
        return new Response(JSON.stringify({
          id: 'item1', parentReference: { driveId: 'drive1' }, name: 'a.xlsx', size: 1,
        }), { status: 200 });
      }
      if (u.includes('createSession')) {
        return new Response(JSON.stringify({ id: 'sess-1', persistChanges: true }), { status: 201 });
      }
      if (u.includes('closeSession')) return new Response('{}', { status: 204 });
      if (u.includes('/worksheets') && !u.includes('range') && !u.includes('usedRange')) {
        return new Response(JSON.stringify({
          value: [{ id: 'sheet1', name: 'Harmonogram', position: 0 }],
        }), { status: 200 });
      }
      if (u.includes('usedRange')) {
        // Tylko SG-01 w pliku — SG-99 bez wiersza (#570 skipMissingWhenOtherPresent).
        return new Response(JSON.stringify({
          address: 'Harmonogram!A1:B2',
          values: [
            [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo],
            ['SG-01', 'OLD'],
          ],
          numberFormat: [['General', 'General'], ['General', 'General']],
        }), { status: 200 });
      }
      if (u.includes("range(address=") && method === 'PATCH') {
        return new Response('{}', { status: 200 });
      }
      return new Response(`unhandled ${u}`, { status: 404 });
    }) as unknown as typeof fetch;

    const r = await processOutboundWrites({
      sb: sb as never,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': snap },
      fileMode: 'test',
      fetchFn,
    });
    expect(r.write_reason).toBe('ok');
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'done')).toBe(true);
    expect(rpcs.some((c) =>
      c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'skipped'
    )).toBe(false);
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_clear_423')).toBe(true);
  });

  it('R4: upsertFail → write_reason state_upsert (bez clear_423)', async () => {
    const { sb, rpcs } = mockSb({ upsertFail: true });
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook')) {
        return new Response(JSON.stringify({
          id: 'item1', parentReference: { driveId: 'drive1' }, name: 'a.xlsx', size: 1,
        }), { status: 200 });
      }
      if (u.includes('createSession')) {
        return new Response(JSON.stringify({ id: 'sess-1', persistChanges: true }), { status: 201 });
      }
      if (u.includes('closeSession')) return new Response('{}', { status: 204 });
      if (u.includes('/worksheets') && !u.includes('range') && !u.includes('usedRange')) {
        return new Response(JSON.stringify({
          value: [{ id: 'sheet1', name: 'Harmonogram', position: 0 }],
        }), { status: 200 });
      }
      if (u.includes('usedRange')) {
        return new Response(JSON.stringify({
          address: 'Harmonogram!A1:B2',
          values: [
            [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo],
            ['SG-01', 'OLD'],
          ],
          numberFormat: [['General', 'General'], ['General', 'General']],
        }), { status: 200 });
      }
      if (u.includes("range(address=") && method === 'PATCH') {
        return new Response('{}', { status: 200 });
      }
      return new Response(`unhandled ${u}`, { status: 404 });
    }) as unknown as typeof fetch;

    const r = await processOutboundWrites({
      sb,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': snap },
      fileMode: 'test',
      fetchFn,
    });
    expect(r.write_reason).toBe('state_upsert');
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'done')).toBe(true);
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_clear_423')).toBe(false);
  });
});

describe('A6 fileAlreadyHasPatch', () => {
  it('plik = expected+łatka → true', () => {
    const exp = { ld: '2026-11-01', lt: null, dd: null, dt: null, co: 'A', ho: null };
    expect(fileAlreadyHasPatch(exp, { code: 'X', load_date: '2026-11-02' }, {
      ...exp, ld: '2026-11-02',
    })).toBe(true);
    expect(fileAlreadyHasPatch(exp, { code: 'X', load_date: '2026-11-02' }, exp)).toBe(false);
  });

  // #597 F7 B1: patch tylko-awizacja → false (toWrite, nie alreadyDone) — etap #597.
  it('#597: awizacja poza snapshota → false (workbook, nie alreadyDone)', () => {
    const exp = { ld: '2026-11-01', lt: null, dd: null, dt: null, co: 'A', ho: null };
    expect(fileAlreadyHasPatch(exp, { code: 'X', driver: 'Jan / Erik' }, exp)).toBe(false);
    expect(fileAlreadyHasPatch(exp, { code: 'X', driver_phone: '600111222' }, exp)).toBe(false);
    expect(fileAlreadyHasPatch(exp, { code: 'X', tractor: 'WGM1A6' }, exp)).toBe(false);
    expect(fileAlreadyHasPatch(exp, { code: 'X', trailer: 'WWW1A6' }, exp)).toBe(false);
    // ścieżka outboundWrite: remaining = codes.filter(!alreadyHas) → toWrite
    const codes = ['SG-01'];
    const patch = { code: 'SG-01', driver: 'A / B' };
    const remaining = codes.filter((code) =>
      !fileAlreadyHasPatch(exp, { code, ...patch }, exp)
    );
    expect(remaining).toEqual(['SG-01']);
  });
});

describe('#650 F7 r2 processOutboundWrites B1\'/PUT', () => {
  const expectedSnap = {
    ld: '2026-11-01', lt: null, dd: null, dt: null, co: 'OLD', ho: null,
  };
  const fileSnapMismatchDate = {
    ld: '2026-11-03', lt: null, dd: null, dt: null, co: 'OTHER', ho: 'KSH-OLD',
  };

  function mockSb(items: Record<string, unknown>[]) {
    const rpcs: { name: string; args: Record<string, unknown> }[] = [];
    const sb = {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        rpcs.push({ name, args });
        if (name === 'ksh_sync_outbound_list') {
          return { data: items, error: null };
        }
        return { data: true, error: null };
      }),
    };
    return { sb: sb as never, rpcs };
  }

  function workbookFetch(opts?: {
    values?: unknown[][];
    usedAddress?: string;
  }) {
    const calls: { method: string; url: string; body?: string }[] = [];
    const values = opts?.values ?? [
      [
        COLUMN_MAP_DEFAULT.shipmentCode,
        COLUMN_MAP_DEFAULT.loadDate,
        COLUMN_MAP_DEFAULT.driverName,
        COLUMN_MAP_DEFAULT.hhlOrderNo,
      ],
      ['SG-01', '03.11.2026', 'JanKsh', 'KSH-OLD'],
    ];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({
        method,
        url: u,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem') && !u.includes('workbook')) {
        return new Response(JSON.stringify({
          id: 'item1', parentReference: { driveId: 'drive1' }, name: 'a.xlsx', size: 1,
        }), { status: 200 });
      }
      if (u.includes('createSession')) {
        return new Response(JSON.stringify({ id: 'sess-1', persistChanges: true }), { status: 201 });
      }
      if (u.includes('closeSession')) return new Response('{}', { status: 204 });
      if (u.includes('/worksheets') && !u.includes('range') && !u.includes('usedRange')) {
        return new Response(JSON.stringify({
          value: [{ id: 'sheet1', name: 'Harmonogram', position: 0 }],
        }), { status: 200 });
      }
      if (u.includes('usedRange')) {
        const cols = values[0]?.length ?? 2;
        const nf = values.map(() => Array.from({ length: cols }, () => 'General'));
        return new Response(JSON.stringify({
          address: opts?.usedAddress ?? 'Harmonogram!A1:D2',
          values,
          numberFormat: nf,
        }), { status: 200 });
      }
      if (u.includes('range(address=') && method === 'PATCH') {
        return new Response('{}', { status: 200 });
      }
      return new Response(`unhandled ${u}`, { status: 404 });
    }) as unknown as typeof fetch;
    return { fetchFn, calls };
  }

  it("B1': migawka z rozjechaną datą + {driver,hhl} → PATCH + sprawa load_date", async () => {
    const item = {
      id: 42,
      load_id: 'load-1',
      code: 'SG-01',
      codes: ['SG-01'],
      rev: 1,
      attempts: 0,
      patch: { driver: 'JanWt', hhl_order_no: 'KSH-NEW' },
      expected_file: expectedSnap,
    };
    const { sb, rpcs } = mockSb([item]);
    const { fetchFn, calls } = workbookFetch();
    const r = await processOutboundWrites({
      sb,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': fileSnapMismatchDate },
      fileMode: 'prod',
      writeTestOkAt: '2026-10-29T00:00:00Z',
      fetchFn,
    });
    expect(r.upload_ok).toBe(true);
    expect(r.conflicts).toBeGreaterThanOrEqual(1);
    const patches = calls.filter((c) => c.method === 'PATCH' && c.url.includes('range(address='));
    expect(patches.length).toBe(2);
    expect(rpcs.some((c) =>
      c.name === 'l1b_note_file_changed' && c.args.p_field === 'load_date'
    )).toBe(true);
    expect(rpcs.some((c) => c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'done')).toBe(true);
    expect(rpcs.some((c) =>
      c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'conflict'
    )).toBe(false);
  });

  it('processOutboundWrites: zero PUT i zero /content', async () => {
    const item = {
      id: 7,
      load_id: 'load-1',
      code: 'SG-01',
      codes: ['SG-01'],
      rev: 1,
      attempts: 0,
      patch: { carrier_order_no: 'NEW' },
      expected_file: { ld: null, lt: null, dd: null, dt: null, co: 'OLD', ho: null },
    };
    const { sb } = mockSb([item]);
    const { fetchFn, calls } = workbookFetch({
      values: [
        [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.scxOrderNo],
        ['SG-01', 'OLD'],
      ],
      usedAddress: 'Harmonogram!A1:B2',
    });
    await processOutboundWrites({
      sb,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': item.expected_file },
      fileMode: 'test',
      fetchFn,
    });
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(calls.some((c) => c.url.includes('/content'))).toBe(false);
  });

  it('N5: pusta wartość WT przy niepustej komórce → 0 PATCH', async () => {
    const mock = workbookFetch({
      values: [
        [COLUMN_MAP_DEFAULT.shipmentCode, COLUMN_MAP_DEFAULT.driverName],
        ['SG-01', 'JanKsh'],
      ],
      usedAddress: 'Harmonogram!A1:B2',
    });
    const r = await writePatchesViaWorkbook({
      env: env(),
      patches: [{ code: 'SG-01', driver: '' }],
      expectedByCode: {
        'SG-01': { ld: null, lt: null, dd: null, dt: null, co: null, ho: null },
      },
      fetchFn: mock.fetchFn,
    });
    expect(r.ok).toBe(true);
    expect(mock.calls.filter((c) => c.method === 'PATCH').length).toBe(0);
  });

  it('#650: WT6 bez expected → przepuszczone (nie no_expected)', async () => {
    const item = {
      id: 9,
      load_id: 'load-1',
      code: 'SG-01',
      codes: ['SG-01'],
      rev: 1,
      attempts: 0,
      patch: { driver: 'JanWt', hhl_order_no: 'KSH-1' },
      expected_file: null,
    };
    const { sb, rpcs } = mockSb([item]);
    const { fetchFn, calls } = workbookFetch({
      values: [
        [
          COLUMN_MAP_DEFAULT.shipmentCode,
          COLUMN_MAP_DEFAULT.driverName,
          COLUMN_MAP_DEFAULT.hhlOrderNo,
        ],
        ['SG-01', 'JanKsh', 'OLD'],
      ],
      usedAddress: 'Harmonogram!A1:C2',
    });
    const r = await processOutboundWrites({
      sb,
      env: env(),
      projectId: 'p1',
      fileSnapshot: { 'SG-01': { ld: null, lt: null, dd: null, dt: null, co: null, ho: null } },
      fileMode: 'prod',
      writeTestOkAt: '2026-10-29T00:00:00Z',
      fetchFn,
    });
    expect(rpcs.some((c) =>
      c.name === 'ksh_sync_outbound_ack' && c.args.p_status === 'skipped'
      && c.args.p_error === 'no_expected'
    )).toBe(false);
    expect(calls.filter((c) => c.method === 'PATCH').length).toBe(2);
    expect(r.upload_ok).toBe(true);
  });
});
