/**
 * III-10 — parser EU Weekly Oil Bulletin („Prices with taxes, latest prices”, XLSX, KE DG ENER).
 * Źródło publiczne i bezpłatne. Plik: jeden arkusz; wiersz nagłówka z kolumną „Automotive gas oil”,
 * pod nim wiersz z datą cen (liczba seryjna Excela) i jednostkami („1000 l”), dalej wiersze państw
 * (kolumna A: nazwa po angielsku). Ceny w EUR za 1000 l, z podatkami.
 * Wynik: olej napędowy PL i SE w EUR/l (4 miejsca) — kody WOB_DIESEL_PL / WOB_DIESEL_SE w fuel_index_readings,
 * okres = tydzień ISO daty cen (YYYY-Www). Zmiana układu pliku = wyjątek (nic nie zapisujemy po cichu).
 * Czysty TypeScript bez zależności — ten sam kod w funkcji Edge (Deno) i w testach (vitest).
 */
export const WOB_LATEST_URL = 'https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en';

export type WobCode = 'WOB_DIESEL_PL' | 'WOB_DIESEL_SE';
export type WobReading = { index_code: WobCode; period: string; reading_date: string; value: number; eur_per_1000l: number };
export type WobParsed = { priceDate: string; readings: WobReading[] };

const COUNTRIES: Array<[string, WobCode]> = [['Poland', 'WOB_DIESEL_PL'], ['Sweden', 'WOB_DIESEL_SE']];

function decode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
}

export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const parts = [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1]));
    out.push(parts.join(''));
  }
  return out;
}

type Cell = string | number | null;
export function parseSheet(xml: string, shared: string[]): Map<number, Map<string, Cell>> {
  const rows = new Map<number, Map<string, Cell>>();
  for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, col, rowS, attrs, body = ''] = m;
    const t = /\st="([^"]+)"/.exec(attrs)?.[1];
    let val: Cell = null;
    if (t === 'inlineStr') val = decode([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
    else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (v !== undefined) val = t === 's' ? (shared[Number(v)] ?? null) : t === 'str' ? decode(v) : Number(v);
    }
    const row = Number(rowS);
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row)!.set(col, val);
  }
  return rows;
}

/** liczba seryjna Excela (system 1900) → YYYY-MM-DD */
export function excelSerialToIso(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10);
}

/** tydzień ISO 8601 → 'YYYY-Www' */
export function isoWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const norm = (v: Cell) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

export function parseWobPricesWithTaxes(sheetXml: string, sharedStringsXml: string): WobParsed {
  const rows = parseSheet(sheetXml, parseSharedStrings(sharedStringsXml));
  const nums = [...rows.keys()].sort((a, b) => a - b);
  let headRow = -1, dieselCol = '';
  for (const r of nums) {
    for (const [col, v] of rows.get(r)!) if (/automotive gas oil/i.test(norm(v))) { headRow = r; dieselCol = col; break; }
    if (headRow > 0) break;
  }
  if (headRow < 0) throw new Error('WOB: brak kolumny „Automotive gas oil” — zmienił się układ pliku');
  const head = rows.get(headRow)!;
  if (![...head.values()].some((v) => /^in EUR$/i.test(norm(v)))) throw new Error('WOB: plik nie jest w EUR („in EUR”)');
  const unitRow = rows.get(headRow + 1);
  if (!unitRow || norm(unitRow.get(dieselCol) ?? null) !== '1000 l') throw new Error('WOB: jednostka oleju napędowego inna niż „1000 l”');
  const serial = [...unitRow.values()].find((v): v is number => typeof v === 'number' && v > 40000 && v < 80000);
  if (serial === undefined) throw new Error('WOB: brak daty cen pod nagłówkiem');
  const priceDate = excelSerialToIso(serial);
  const period = isoWeek(priceDate);
  const readings: WobReading[] = [];
  for (const [name, code] of COUNTRIES) {
    const r = nums.find((n) => n > headRow && norm(rows.get(n)!.get('A') ?? null) === name);
    if (r === undefined) throw new Error(`WOB: brak wiersza „${name}”`);
    const raw = rows.get(r)!.get(dieselCol);
    if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`WOB: brak ceny oleju napędowego dla „${name}”`);
    const value = Math.round((raw / 1000) * 10000) / 10000; // EUR/1000 l → EUR/l (numeric(10,4) w bazie)
    if (!(value >= 0.5 && value <= 5)) throw new Error(`WOB: cena ${name} ${value} EUR/l poza zakresem 0,5–5`);
    readings.push({ index_code: code, period, reading_date: priceDate, value, eur_per_1000l: Math.round(raw * 100) / 100 });
  }
  return { priceDate, readings };
}

type ZipLike = { files: Record<string, { async(type: 'string'): Promise<string> }> };
export async function readWobXlsx(bytes: Uint8Array | ArrayBuffer, loadAsync: (b: Uint8Array | ArrayBuffer) => Promise<ZipLike>): Promise<WobParsed> {
  const zip = await loadAsync(bytes);
  const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  if (!sheets.length) throw new Error('WOB: plik bez arkusza (to nie XLSX biuletynu)');
  const shared = zip.files['xl/sharedStrings.xml'] ? await zip.files['xl/sharedStrings.xml'].async('string') : '';
  return parseWobPricesWithTaxes(await zip.files[sheets[0]].async('string'), shared);
}

/** adres dowodowy: stały link KE + nazwa pliku z datą cen (tak nazywa plik sama KE) */
export function wobSourceUrl(priceDate: string): string {
  return `${WOB_LATEST_URL}?filename=${encodeURIComponent(`Weekly Oil Bulletin Weekly prices with Taxes - ${priceDate}.xlsx`)}`;
}
