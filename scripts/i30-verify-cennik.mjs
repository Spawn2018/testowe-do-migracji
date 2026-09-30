/**
 * I-30 — niezależna transkrypcja cennika z xlsx vs CENNIK_STEGRA.json.
 * Czyta wyłącznie D:\Watch Tower\dane\ (poza repo). NIE wypisuje kwot.
 * Exit 0 = zgodne; exit 2 = różnica (STOP); exit 1 = błąd techniczny.
 *
 * Użycie: node scripts/i30-verify-cennik.mjs
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
  if (v && typeof v === 'object' && 'richText' in v) {
    v = v.richText.map((t) => t.text).join('');
  }
  return v;
}

function parseDims(raw) {
  if (raw == null || raw === '') return { dl: null, sz: null, wys: null };
  const s = String(raw).replace(/,/g, '.').toLowerCase();
  const m = s.match(/([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)/);
  if (!m) return { dl: null, sz: null, wys: null };
  return { dl: num(m[1]), sz: num(m[2]), wys: num(m[3]) };
}

function parseKonwoj(uwagi) {
  if (uwagi == null || uwagi === '') return null;
  const s = String(uwagi).toLowerCase();
  const m = s.match(/(\d+)\s*aut/);
  return m ? num(m[1]) : null;
}

function eqNum(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < 1e-9;
}

async function sheetRows(path) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];

  let headerRow = 0;
  const header = [];
  for (let r = 1; r <= Math.min(10, ws.rowCount || 10); r++) {
    const row = ws.getRow(r);
    const vals = [];
    row.eachCell({ includeEmpty: false }, (c, col) => {
      vals[col] = String(cellVal(c) ?? '').trim();
    });
    const joined = vals.filter(Boolean).join('|').toLowerCase();
    if (joined.includes('symbol') && (joined.includes('cena') || joined.includes('pozycja'))) {
      headerRow = r;
      for (let col = 1; col < vals.length; col++) header[col] = vals[col] || '';
      break;
    }
  }
  if (!headerRow) {
    return { sheet: ws.name, headerRow: 0, headers: [], rows: [] };
  }

  const col = (namePart) => {
    const needle = namePart.toLowerCase();
    for (let i = 1; i < header.length; i++) {
      if ((header[i] || '').toLowerCase().includes(needle)) return i;
    }
    return -1;
  };

  const iLp = col('lp');
  const iPoz = col('pozycja');
  const iSym = col('symbol');
  const iDim = col('wymiar') >= 0 ? col('wymiar') : col('l x') >= 0 ? col('l x') : col('max wy');
  const iMasa = col('waga') >= 0 ? col('waga') : col('masa');
  const iCena = col('cena');
  const iUwagi = col('uwagi');

  const rows = [];
  for (let r = headerRow + 1; r <= (ws.rowCount || 0); r++) {
    const row = ws.getRow(r);
    const symbol = String(cellVal(row.getCell(iSym)) ?? '').trim();
    if (!symbol || !/^[A-Z]{1,3}(-[A-Z])?$/i.test(symbol)) continue;
    const pozycja = String(cellVal(row.getCell(iPoz)) ?? '').trim();
    const dims = parseDims(cellVal(row.getCell(iDim)));
    const masa = num(cellVal(row.getCell(iMasa)));
    const cena = num(cellVal(row.getCell(iCena)));
    const uwagi = String(cellVal(row.getCell(iUwagi)) ?? '').trim();
    const konwoj = parseKonwoj(uwagi);
    const lp = num(cellVal(row.getCell(iLp)));
    rows.push({
      lp,
      symbol: symbol.toUpperCase(),
      pozycja,
      ...dims,
      masa,
      cena,
      konwoj,
      uwagi,
    });
  }

  return {
    sheet: ws.name,
    headerRow,
    headers: header.filter(Boolean),
    rows,
  };
}

function rowKey(r) {
  const k = r.konwoj != null && r.konwoj !== '' ? String(r.konwoj) : '';
  return `${r.symbol}|${k}`;
}

async function main() {
  const scxPath = resolve(DANE, 'CENY_PODSTAWOWE_-_SCANDINAVIAN_EXPRESS.xlsx');
  const hhlPath = resolve(DANE, 'CENY_PODSTAWOWE_-_hhl.xlsx');
  const jsonPath = resolve(DANE, 'CENNIK_STEGRA.json');

  const [scx, hhl] = await Promise.all([sheetRows(scxPath), sheetRows(hhlPath)]);
  const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pozycje = Array.isArray(json.pozycje_cennika) ? json.pozycje_cennika : null;
  if (!pozycje) {
    console.error('JSON: brak tablicy pozycje_cennika');
    process.exit(1);
  }

  console.log(
    'struktura:',
    JSON.stringify({
      scx: { sheet: scx.sheet, headerRow: scx.headerRow, headers: scx.headers, rows: scx.rows.length },
      hhl: { sheet: hhl.sheet, headerRow: hhl.headerRow, headers: hhl.headers, rows: hhl.rows.length },
      json: { pozycje: pozycje.length, keys: Object.keys(pozycje[0] || {}) },
    }),
  );

  if (scx.rows.length === 0 || hhl.rows.length === 0) {
    console.error('STOP: nie udało się zmapować wierszy cenowych');
    process.exit(1);
  }

  const diffs = [];
  const byKey = (list) => {
    const m = new Map();
    for (const r of list) {
      const k = rowKey(r);
      if (m.has(k)) diffs.push(`duplikat klucza w xlsx: ${k}`);
      m.set(k, r);
    }
    return m;
  };
  const scxMap = byKey(scx.rows);
  const hhlMap = byKey(hhl.rows);

  if (scxMap.size !== hhlMap.size) {
    diffs.push(`liczba pozycji SCX≠HHL: ${scxMap.size} vs ${hhlMap.size}`);
  }
  for (const k of scxMap.keys()) {
    if (!hhlMap.has(k)) diffs.push(`brak po stronie HHL: ${k}`);
  }
  for (const k of hhlMap.keys()) {
    if (!scxMap.has(k)) diffs.push(`brak po stronie SCX: ${k}`);
  }

  const jsonKeys = new Set();
  for (const p of pozycje) {
    const mapped = {
      symbol: String(p.symbol ?? '').toUpperCase(),
      konwoj: p.auta_w_konwoju != null && p.auta_w_konwoju !== '' ? num(p.auta_w_konwoju) : null,
    };
    const k = rowKey(mapped);
    jsonKeys.add(k);
    const s = scxMap.get(k);
    const h = hhlMap.get(k);
    if (!s) diffs.push(`JSON ma pozycję poza SCX xlsx: ${k}`);
    if (!h) diffs.push(`JSON ma pozycję poza HHL xlsx: ${k}`);
    if (s && h) {
      const dims = [
        ['dl', s.dl, h.dl, p.max_dlugosc_m],
        ['sz', s.sz, h.sz, p.max_szerokosc_m],
        ['wys', s.wys, h.wys, p.max_wysokosc_m],
        ['masa', s.masa, h.masa, p.max_masa_t],
      ];
      for (const [name, a, b, j] of dims) {
        if (!eqNum(a, b)) diffs.push(`wymiary SCX≠HHL ${k} ${name}`);
        if (j != null && !eqNum(a, Number(j))) diffs.push(`wymiary JSON≠xlsx ${k} ${name}`);
      }
      if (s.pozycja && p.pozycja && s.pozycja !== p.pozycja) {
        diffs.push(`nazwa pozycji JSON≠SCX ${k}`);
      }
      const kosztJ = num(p.koszt_scx_eur);
      const przyJ = num(p.przychod_ksh_eur);
      if (s.cena == null) diffs.push(`brak ceny SCX: ${k}`);
      if (h.cena == null) diffs.push(`brak ceny HHL: ${k}`);
      if (s.cena != null && kosztJ != null && !eqNum(s.cena, kosztJ)) {
        diffs.push(`KOSZT różnica JSON≠SCX: ${k}`);
      }
      if (h.cena != null && przyJ != null && !eqNum(h.cena, przyJ)) {
        diffs.push(`PRZYCHÓD różnica JSON≠HHL: ${k}`);
      }
    }
  }
  for (const k of scxMap.keys()) {
    if (!jsonKeys.has(k)) diffs.push(`xlsx SCX poza JSON: ${k}`);
  }

  const ratios = [];
  for (const k of scxMap.keys()) {
    const s = scxMap.get(k);
    const h = hhlMap.get(k);
    if (s?.cena && h?.cena) ratios.push(h.cena / s.cena);
  }
  if (ratios.length) {
    const r0 = ratios[0];
    const bad = ratios.filter((r) => Math.abs(r - r0) > 1e-9).length;
    if (bad) diffs.push(`narzut niejednolity: ${bad}/${ratios.length} pozycji odbiega`);
    else console.log('narzut: jednolity na', ratios.length, 'pozycjach (wartość nie wypisana)');

    const narzutJson = num(json.weryfikacja?.narzut_przychod_nad_koszt);
    if (narzutJson != null && Math.abs(r0 - narzutJson) > 1e-9) {
      diffs.push('narzut JSON≠xlsx');
    }
  }

  const v = json.weryfikacja || {};
  if (pozycje.length !== 12) diffs.push(`oczekiwano 12 pozycji, jest ${pozycje.length}`);
  if (v.pozycje != null && Number(v.pozycje) !== 12) diffs.push(`weryfikacja.pozycje≠12`);
  if (Array.isArray(json.sefs?.tabela_sek) && json.sefs.tabela_sek.length !== 51) {
    diffs.push(`SEFS SEK progi: ${json.sefs.tabela_sek.length} (oczek. 51)`);
  }
  if (Array.isArray(json.sefs?.tabela_pln) && json.sefs.tabela_pln.length !== 51) {
    diffs.push(`SEFS PLN progi: ${json.sefs.tabela_pln.length} (oczek. 51)`);
  }
  if (v.sefs_sek_progi != null && Number(v.sefs_sek_progi) !== 51) {
    diffs.push('weryfikacja.sefs_sek_progi≠51');
  }
  if (v.sefs_pln_progi != null && Number(v.sefs_pln_progi) !== 51) {
    diffs.push('weryfikacja.sefs_pln_progi≠51');
  }

  console.log('pozycje JSON:', pozycje.length, '| SCX:', scxMap.size, '| HHL:', hhlMap.size);
  if (diffs.length) {
    console.error('STOP — różnice:', diffs.length);
    for (const d of diffs.slice(0, 40)) console.error(' -', d);
    if (diffs.length > 40) console.error(' … +', diffs.length - 40);
    process.exit(2);
  }
  console.log('OK — transkrypcja xlsx ≡ JSON (symbole, wymiary, kwoty, narzut, SEFS progi)');
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e);
  process.exit(1);
});
