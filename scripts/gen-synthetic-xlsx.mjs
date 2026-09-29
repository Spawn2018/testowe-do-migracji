/**
 * Generuje syntetyczne XLSX do tests/fixtures/ (zmyślone dane, ten sam układ kolumn).
 * Uruchom: node scripts/gen-synthetic-xlsx.mjs
 */
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests', 'fixtures');
mkdirSync(out, { recursive: true });

const KSH_HEADERS = [
  'Lp.',
  'Typ',
  'Wysyłka',
  'Rozmiar L x W x H',
  'Waga elementu',
  'Ilość elementów',
  'Waga transport [t]',
  'Data załadunku',
  'Dzień (załadunek)',
  'Godzina (załadunek)',
  'Imię i nazwisko kierowcy',
  'Nr tel. kierowcy',
  'Nr zlecenia',
  'Data dostawy na budowę',
  'Dzień (rozładunek)',
  'Godzina (rozładunek)',
];

const QA_SCHED_HEADERS = [
  'Wysyłka',
  'Typ',
  'Rozmiar L x W x H',
  'Waga elementu',
  'Ilość elementów',
  'Waga transport [t]',
  'Data załadunku',
  'Godzina (załadunek)',
  'Imię i nazwisko kierowcy',
  'Nr tel. kierowcy',
  'Nr zlecenia',
  'Data dostawy na budowę',
  'Godzina (rozładunek)',
  'Kolejność montażu',
];

function addHeader(ws, headers) {
  const row = ws.addRow(headers);
  row.font = { bold: true };
}

async function writeKsh() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  addHeader(ws, KSH_HEADERS);

  // 5 wierszy bez Wysyłki (odrzucane) + 5 DIMENSIONED + 3 STANDARD = układ jak test
  for (let i = 1; i <= 5; i++) {
    ws.addRow([i, 'KR', '', '10,00 x 2,00 x 2,00', '', 1, 5.0, '01.10.2026', '', '08:00', '', '', '', '06.10.2026', '', '']);
  }
  const dim = [
    ['QA-01', '18,21 x 2,45 x 2,45', 7, 20.74, '30.09.2026', '05.10.2026'],
    ['QA-02', '16,50 x 2,50 x 2,40', 4, 18.2, '01.10.2026', '06.10.2026'],
    ['QA-03', '15,00 x 2,45 x 2,45', 6, 19.5, '02.10.2026', '07.10.2026'],
    ['QA-04', '14,00 x 2,40 x 2,40', 8, 17.8, '03.10.2026', '08.10.2026'],
    ['QA-05', '12,50 x 2,45 x 2,45', 5, 16.1, '04.10.2026', '09.10.2026'],
  ];
  let lp = 6;
  for (const [code, dims, qty, wt, load, del] of dim) {
    ws.addRow([
      lp++,
      'KR',
      code,
      dims,
      '',
      qty,
      wt,
      load,
      '',
      '07:30',
      'Jan Testowy',
      '500100200',
      `Z-${code}`,
      del,
      '',
      '12:00',
    ]);
  }
  const std = ['STD-01', 'STD-02', 'STD-03'];
  for (const code of std) {
    ws.addRow([
      lp++,
      'T',
      code,
      'Standard',
      '',
      20 + lp,
      15.5,
      '05.10.2026',
      '',
      '09:00',
      'Anna Demo',
      '600700800',
      `Z-${code}`,
      '10.10.2026',
      '',
      '14:00',
    ]);
  }
  // dopełnienie pustymi wierszami jak w oryginale (wiele bez kodu) — łącznie ~20 wierszy danych + nagłówek
  for (let i = 0; i < 7; i++) {
    ws.addRow([lp++, 'KR', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  }

  await wb.xlsx.writeFile(join(out, 'ksh-harmonogram-synthetic.xlsx'));
}

async function writeQaSchedule(name, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('QA');
  addHeader(ws, QA_SCHED_HEADERS);
  for (const r of rows) ws.addRow(r);
  await wb.xlsx.writeFile(join(out, name));
}

async function writeShipUnique() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('QA');
  addHeader(ws, ['Code', 'Status', 'Load', 'Deliver', 'Cost', 'Rev', 'Margin']);
  // zmyślone liczby — nie z cennika
  ws.addRow(['QA-UNIQUE-742', 'PLANNED', '2026-10-01', '2026-10-06', 111, 222, 111]);
  await wb.xlsx.writeFile(join(out, 'ship-qa-unique.xlsx'));
}

async function writeP9rValid() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  addHeader(ws, QA_SCHED_HEADERS);
  // kilka wierszy bazowych + jeden nowy QA-RECLICK-923
  const base = [
    ['QA-10', 'KR', '18,00 x 2,45 x 2,45', 1.1, 5, 18.5, '01.10.2026', '08:00', 'Demo Kierowca', '501502503', 'Z-QA-10', '06.10.2026', '12:00', 1],
    ['QA-11', 'KR', '17,00 x 2,45 x 2,45', 1.0, 4, 17.0, '02.10.2026', '08:00', 'Demo Kierowca', '501502503', 'Z-QA-11', '07.10.2026', '12:00', 2],
  ];
  for (const r of base) ws.addRow(r);
  ws.addRow([
    'QA-RECLICK-923',
    'KR',
    '16,00 x 2,45 x 2,45',
    0.9,
    3,
    15.0,
    '03.10.2026',
    '08:00',
    'Demo Kierowca',
    '501502503',
    'Z-QA-923',
    '08.10.2026',
    '12:00',
    3,
  ]);
  await wb.xlsx.writeFile(join(out, 'p9r-merge-plus1-valid.xlsx'));
}

await writeKsh();
await writeQaSchedule('ship-qa-schedule.xlsx', [
  [
    'QA-SHIP-1',
    'KR',
    '18,00 x 2,45 x 2,45',
    '1',
    '5',
    '18.5',
    '01.10.2026',
    '08:00',
    'Demo Kierowca',
    '501502503',
    'Z-SHIP-1',
    '06.10.2026',
    '12:00',
    '1',
  ],
]);
await writeShipUnique();
await writeP9rValid();
console.log('OK fixtures in', out);
