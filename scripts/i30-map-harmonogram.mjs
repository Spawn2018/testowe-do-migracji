/**
 * I-30 — mapowanie transportów HH z pliku harmonogramu (poza repo) na symbole cennika.
 * Nie wypisuje danych osobowych ani kwot — tylko kody, rodziny, powody braku ceny.
 *
 * Użycie: node scripts/i30-map-harmonogram.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';

const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';

function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cellVal(c) {
  if (c == null) return null;
  let v = c.value;
  if (v && typeof v === 'object' && 'result' in v) v = v.result;
  if (v && typeof v === 'object' && 'text' in v) v = v.text;
  if (v && typeof v === 'object' && 'richText' in v) v = v.richText.map((t) => t.text).join('');
  return v;
}

function parseDims(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/,/g, '.').toLowerCase();
  if (s.includes('standard')) return null;
  const m = s.match(/([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)/);
  if (!m) return null;
  return { lengthM: num(m[1]), widthM: num(m[2]), heightM: num(m[3]) };
}

function family(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return null;
  if (/^TS([.-]|$)/.test(c)) return 'TS';
  if (/^SS([.-]|$)/.test(c)) return 'SS';
  if (/^SG([.-]|$)/.test(c)) return 'SG';
  if (/^BS([.-]|$)/.test(c)) return 'BS';
  if (/^KR([.-]|$)/.test(c)) return 'KR';
  if (/^PL([.-]|$)/.test(c)) return 'PL';
  if (/^T([.-]|$)/.test(c)) return 'T';
  return null;
}

function matchSymbol(input) {
  const fam = family(input.shipmentCode);
  if (!fam) return { matched: false, reason: 'NO_FAMILY' };
  let dims = input.dims;
  if (!dims) return { matched: false, reason: 'NO_DIMENSIONS' };
  let heightAdopted = false;
  const code = input.shipmentCode.trim().toUpperCase();
  if (fam === 'PL' && ['PL-1', 'PL-10.1', 'PL-17.1'].includes(code) && Math.abs(dims.heightM - 2.6) < 1e-9) {
    dims = { ...dims, heightM: 2.45 };
    heightAdopted = true;
  }
  let convoyCap = null;
  let convoyCapped = false;
  if (fam === 'KR') {
    const n = input.convoyCount;
    if (n == null || n < 1) return { matched: false, reason: 'NO_CONVOY' };
    if (n > 3) {
      convoyCap = 3;
      convoyCapped = true;
    } else convoyCap = n;
  }
  const pool = input.rules
    .filter((r) => r.family === fam)
    .filter((r) => fam !== 'KR' || r.convoyCars === convoyCap);
  const bySmall = (a, b) =>
    a.lengthTo - b.lengthTo || a.widthTo - b.widthTo || a.heightTo - b.heightTo || a.weightTo - b.weightTo;
  const full = pool
    .filter(
      (r) =>
        dims.lengthM <= r.lengthTo &&
        dims.widthM <= r.widthTo &&
        dims.heightM <= r.heightTo &&
        dims.weightT <= r.weightTo,
    )
    .sort(bySmall);
  if (full.length) return { matched: true, symbol: full[0].symbol, heightAdopted, convoyCapped };
  const ho = pool
    .filter(
      (r) =>
        dims.lengthM <= r.lengthTo &&
        dims.widthM <= r.widthTo &&
        dims.weightT <= r.weightTo &&
        dims.heightM > r.heightTo,
    )
    .sort(bySmall);
  if (ho.length) return { matched: true, symbol: ho[0].symbol, heightAdopted: true, convoyCapped };
  return { matched: false, reason: 'NO_PRICE' };
}

async function main() {
  const json = JSON.parse(readFileSync(resolve(DANE, 'CENNIK_STEGRA.json'), 'utf8'));
  const rules = (json.pozycje_cennika || []).map((p) => ({
    symbol: String(p.symbol).toUpperCase(),
    family: String(p.rodzina).toUpperCase(),
    lengthTo: Number(p.max_dlugosc_m),
    widthTo: Number(p.max_szerokosc_m),
    heightTo: Number(p.max_wysokosc_m),
    weightTo: Number(p.max_masa_t),
    convoyCars: p.auta_w_konwoju != null ? Number(p.auta_w_konwoju) : null,
  }));

  const path = process.env.TOWER_HARMONOGRAM || resolve(DANE, 'SCRAP_transporty_2026_09_23_REV_01.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  const header = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => {
    header[col] = String(cellVal(c) ?? '').trim().toLowerCase();
  });
  const col = (part) => header.findIndex((h) => h && h.includes(part));
  const iCode = col('wysył') >= 0 ? col('wysył') : col('wysyl');
  const iDim = col('rozmiar');
  const iWgt = header.findIndex((h) => h && h.includes('waga transport'));
  const iDate = col('data załad') >= 0 ? col('data załad') : col('data zalad');
  const iCarrier = col('przewo');

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const carrier = String(cellVal(row.getCell(iCarrier)) ?? '').trim().toUpperCase();
    if (carrier !== 'HH') continue;
    const code = String(cellVal(row.getCell(iCode)) ?? '').trim();
    const dims = parseDims(cellVal(row.getCell(iDim)));
    const wgt = num(cellVal(row.getCell(iWgt)));
    let loadDate = cellVal(row.getCell(iDate));
    if (loadDate instanceof Date) loadDate = loadDate.toISOString().slice(0, 10);
    else if (loadDate) loadDate = String(loadDate).slice(0, 10);
    else loadDate = null;
    if (!code || !dims || wgt == null) {
      rows.push({ code, family: family(code), ok: false, reason: 'NO_DIMENSIONS', loadDate });
      continue;
    }
    rows.push({
      code,
      family: family(code),
      ok: true,
      dims: { ...dims, weightT: wgt },
      loadDate,
    });
  }

  const krByDay = new Map();
  for (const r of rows) {
    if (r.family === 'KR' && r.loadDate) {
      krByDay.set(r.loadDate, (krByDay.get(r.loadDate) || 0) + 1);
    }
  }

  let withPrice = 0;
  let heightAdopted = 0;
  const noPrice = [];
  const bySymbol = {};
  for (const r of rows) {
    if (!r.ok) {
      noPrice.push({ code: r.code || '∅', reason: r.reason });
      continue;
    }
    const m = matchSymbol({
      shipmentCode: r.code,
      dims: r.dims,
      convoyCount: r.family === 'KR' ? krByDay.get(r.loadDate) ?? null : null,
      rules,
    });
    if (!m.matched) {
      noPrice.push({ code: r.code, reason: m.reason, family: r.family });
      continue;
    }
    withPrice++;
    if (m.heightAdopted) heightAdopted++;
    bySymbol[m.symbol] = (bySymbol[m.symbol] || 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        source: path.split(/[\\/]/).pop(),
        hh_rows: rows.length,
        with_price: withPrice,
        without_price: noPrice.length,
        height_adopted: heightAdopted,
        by_symbol: bySymbol,
        without_sample: noPrice.slice(0, 40),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e);
  process.exit(1);
});
