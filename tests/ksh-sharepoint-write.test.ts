/**
 * A6 — zapis WT→plik: konflikt, format dat/godzin, Graph upload + If-Match, JSZip łatka.
 */
import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { uploadSharePointFile, type GraphEnv } from '../supabase/functions/_shared/ksh/graph';
import {
  fileAlreadyHasPatch,
  fileRowChangedSinceRead,
  missingExpectedFile,
} from '../supabase/functions/_shared/ksh/writeConflict';
import {
  excelDateFromIso,
  excelTimeFromHm,
  excelSerialFromIso,
  formatDateTextFromIso,
  normalizeHm,
} from '../supabase/functions/_shared/ksh/xlsxPatchTime';
import { patchWorkbookBytes } from '../supabase/functions/_shared/ksh/xlsxPatch';
import { COLUMN_MAP_DEFAULT } from '../supabase/functions/_shared/ksh/importColumnMap';

const env = (): GraphEnv => ({
  SHAREPOINT_TENANT_ID: 't',
  SHAREPOINT_CLIENT_ID: 'c',
  SHAREPOINT_CLIENT_SECRET: 's',
  SHAREPOINT_FILE_URL: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/a.xlsx',
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

  it('ten sam snap → bez konfliktu; zmiana daty lub numeru → konflikt', () => {
    const a = {
      ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00', co: 'S1', ho: 'K1',
    };
    expect(fileRowChangedSinceRead(a, { ...a })).toBe(false);
    expect(fileRowChangedSinceRead(a, { ...a, ld: '2026-11-02' })).toBe(true);
    expect(fileRowChangedSinceRead(a, { ...a, co: 'S2' })).toBe(true);
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

describe('A6 Graph upload If-Match', () => {
  it('upload OK z If-Match', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/content') && init?.method === 'PUT') {
        const h = init.headers as Record<string, string>;
        expect(h['If-Match']).toBe('"etag-1"');
        return new Response('{}', { status: 200 });
      }
      return new Response('no', { status: 404 });
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), body, fetchFn, { ifMatch: '"etag-1"' });
    expect(r.ok).toBe(true);
  });

  it('upload 412 → etag_mismatch', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response('precondition', { status: 412 });
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), new Uint8Array([1]), fetchFn, { ifMatch: '"x"' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('etag_mismatch');
  });

  it('upload OK — bez URL/tokenu w meta', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/content') && init?.method === 'PUT') {
        expect((init.body as Uint8Array).byteLength).toBe(3);
        return new Response('{}', { status: 200 });
      }
      return new Response('no', { status: 404 });
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), body, fetchFn, { ifMatch: '"e"' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.bytes).toBe(3);
      expect(JSON.stringify(r)).not.toMatch(/tempauth|tok|contoso/);
    }
  });

  it('upload bez If-Match → no_etag (F7 r2)', async () => {
    const fetchFn = vi.fn(async () => new Response('no', { status: 404 })) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), new Uint8Array([1]), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_etag');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('upload network → network_upload', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      throw new TypeError('reset');
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), new Uint8Array([1]), fetchFn, { ifMatch: '"e"' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network_upload');
  });

  it('upload HTTP 403 → upload_http_403', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response('denied', { status: 403 });
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), new Uint8Array([1]), fetchFn, { ifMatch: '"e"' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('upload_http_403');
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
});

/** Minimalny XLSX (arkusz + sharedStrings + drugi arkusz formuły) — round-trip JSZip. */
async function fixtureXlsx(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Harmonogram" sheetId="1" r:id="rId1"/>
    <sheet name="Inny" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`);
  const h = COLUMN_MAP_DEFAULT;
  // A1..: nagłówki jako shared strings 0..; wiersz 2: SG-99 + data liczba + godzina tekst + numer tekst
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="8" uniqueCount="8">
  <si><t>${h.shipmentCode}</t></si>
  <si><t>${h.loadDate}</t></si>
  <si><t>${h.loadTime}</t></si>
  <si><t>${h.deliveryDate}</t></si>
  <si><t>${h.deliveryTime}</t></si>
  <si><t>${h.scxOrderNo}</t></si>
  <si><t>${h.hhlOrderNo}</t></si>
  <si><t>SG-99</t></si>
</sst>`);
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
      <c r="F1" t="s"><v>5</v></c>
      <c r="G1" t="s"><v>6</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>7</v></c>
      <c r="B2" s="3"><v>46000</v></c>
      <c r="C2" t="inlineStr"><is><t>08:00</t></is></c>
      <c r="D2"><v>46005</v></c>
      <c r="E2" t="inlineStr"><is><t>14:00</t></is></c>
      <c r="F2" t="inlineStr"><is><t>OLD-SCAN</t></is></c>
      <c r="G2" t="inlineStr"><is><t>OLD-KSH</t></is></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>SG-99</t></is></c>
      <c r="B3"><v>1</v></c>
    </row>
  </sheetData>
</worksheet>`);
  zip.file('xl/worksheets/sheet2.xml', `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1"><f>SUM(1,2)</f><v>3</v></c></row>
  </sheetData>
</worksheet>`);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('A6 xlsxPatch JSZip', () => {
  it('round-trip: zmienia tylko docelowe komórki; drugi arkusz/formuła zostaje; pierwszy SG-99', async () => {
    const bytes = await fixtureXlsx();
    const r = await patchWorkbookBytes(
      bytes,
      [{
        code: 'SG-99',
        load_date: '2026-12-01',
        load_time: '09:15',
        carrier_order_no: 'NEW-SCAN',
        delivery_time: null, // F7: null nie czyści
      }],
      (b) => JSZip.loadAsync(b),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.written).toBe(1);
    expect(r.writtenCodes).toEqual(['SG-99']);

    const out = await JSZip.loadAsync(r.bytes);
    const sheet1 = await out.files['xl/worksheets/sheet1.xml']!.async('string');
    const sheet2 = await out.files['xl/worksheets/sheet2.xml']!.async('string');
    expect(sheet2).toContain('SUM(1,2)');
    expect(sheet1).toContain('NEW-SCAN');
    expect(sheet1).toContain('09:15');
    // F7 r2: styl s="3" zachowany na B2
    expect(sheet1).toMatch(/<c r="B2"[^>]*\ss="3"/);
    // drugi wiersz SG-99 (A3) nietknięty jako „pierwszy wygrywa”
    expect(sheet1).toMatch(/<c r="A3"[^>]*>[\s\S]*?SG-99/);
    // godzina rozładunku nie wyczyszczona
    expect(sheet1).toContain('14:00');
  });

  it('nieznany kod → skipped', async () => {
    const bytes = await fixtureXlsx();
    const r = await patchWorkbookBytes(
      bytes,
      [{ code: 'NOPE', load_date: '2026-12-01' }],
      (b) => JSZip.loadAsync(b),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.written).toBe(0);
      expect(r.skipped).toBe(1);
    }
  });

  it('F7 r2b N2: data na komórce z ułamkiem zachowuje godzinę', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
    zip.file('xl/workbook.xml', `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="H" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
    const h = COLUMN_MAP_DEFAULT;
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>${h.shipmentCode}</t></is></c>
      <c r="B1" t="inlineStr"><is><t>${h.loadDate}</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>SG-DT</t></is></c>
      <c r="B2"><v>46000.333</v></c>
    </row>
  </sheetData>
</worksheet>`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const r = await patchWorkbookBytes(
      bytes,
      [{ code: 'SG-DT', load_date: '2026-12-01' }],
      (b) => JSZip.loadAsync(b),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = await JSZip.loadAsync(r.bytes);
    const sheet1 = await out.files['xl/worksheets/sheet1.xml']!.async('string');
    // 2026-12-01 serial = 46357; +0.333 z poprzedniej godziny
    expect(sheet1).toMatch(/<c r="B2"[^>]*><v>46357\.333<\/v>/);
  });

  it('F7 r3: serial+frac zaokrąglony do 1e-9 (bez ogona float)', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
    zip.file('xl/workbook.xml', `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="H" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
    const h = COLUMN_MAP_DEFAULT;
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>${h.shipmentCode}</t></is></c>
      <c r="B1" t="inlineStr"><is><t>${h.loadDate}</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>SG-FL</t></is></c>
      <c r="B2"><v>46000.3333333</v></c>
    </row>
  </sheetData>
</worksheet>`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const r = await patchWorkbookBytes(
      bytes,
      [{ code: 'SG-FL', load_date: '2026-12-01' }],
      (b) => JSZip.loadAsync(b),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = await JSZip.loadAsync(r.bytes);
    const sheet1 = await out.files['xl/worksheets/sheet1.xml']!.async('string');
    const m = sheet1.match(/<c r="B2"[^>]*><v>([^<]+)<\/v>/);
    expect(m).toBeTruthy();
    const n = Number(m![1]);
    expect(n).toBe(Math.round(n * 1e9) / 1e9);
    expect(String(n)).not.toMatch(/99999|00001/);
  });

  it('F7 r2b N2: godzina na komórce całkowitej dokłada ułamek', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
    zip.file('xl/workbook.xml', `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="H" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
    const h = COLUMN_MAP_DEFAULT;
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>${h.shipmentCode}</t></is></c>
      <c r="B1" t="inlineStr"><is><t>${h.loadTime}</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>SG-TM</t></is></c>
      <c r="B2"><v>46357</v></c>
    </row>
  </sheetData>
</worksheet>`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const r = await patchWorkbookBytes(
      bytes,
      [{ code: 'SG-TM', load_time: '08:00' }],
      (b) => JSZip.loadAsync(b),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = await JSZip.loadAsync(r.bytes);
    const sheet1 = await out.files['xl/worksheets/sheet1.xml']!.async('string');
    // 8/24 = 0.333...
    expect(sheet1).toMatch(/<c r="B2"[^>]*><v>46357\.3/);
  });
});
