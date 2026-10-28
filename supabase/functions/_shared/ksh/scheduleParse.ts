/**
 * TOWER — import harmonogramu KSH z XLSX.
 *
 * Ten plik istnieje, bo próbka z SharePointa KSH ma realne wady,
 * które cicho przyjęte zatrują cały system:
 *
 *   SG-01 | 18,21 x 2,45 x 2,45 | waga elementu: PUSTA | ilość: 7,00 | waga transportu: 20,74
 *   T-01  | 14,62 x 2,45 x 2,45 | waga elementu: PUSTA | ilość: 55,00 | waga transportu: 20,17
 *
 * 55 elementów po 14,62 m przy 20,17 t łącznie jest fizycznie niemożliwe —
 * kolumny są przesunięte. Jedno z narzędzi AI, którym to dałem, odczytało
 * "55,00" jako masę i zbudowało na tym cały poziom cennika z ekspertyzą
 * mostową. Walidator poniżej ma temu zapobiec.
 *
 * ZASADY:
 *  - klucz naturalny = kolumna "Wysyłka" (SG-01, T-01). "Lp." jest
 *    niestabilne przy re-imporcie i celowo go nie używamy;
 *  - nic nie trafia do bazy przed pokazaniem DIFFU użytkownikowi;
 *  - wiersz, który nie przejdzie walidacji, jest ODRZUCANY z powodem,
 *    nie naprawiany zgadywaniem.
 */

import { z } from 'npm:zod@3';
import { toNationalPhone } from './phoneNational.ts';
import { formatPlNumber } from './formatPl.ts';
export { standardSkipMessage } from './standardSkipMessage.ts';

/* --------------------------------------------------------------- */
/* Parsowanie wartości w formacie polskim                           */
/* --------------------------------------------------------------- */

/** "20,74" -> 20.74 ; "1 234,50" -> 1234.5 ; "" -> null */
export function parsePlNumber(v: unknown): number | null {
  if (v == null || v === '' || v === '-') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\u00A0|\s/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "18,21 x 2,45 x 2,45" -> { lengthM, widthM, heightM } */
export function parseDimensions(v: unknown): { lengthM: number; widthM: number; heightM: number } | null {
  if (v == null) return null;
  const parts = String(v)
    .replace(/[×*]/g, 'x')
    .split(/\s*x\s*/i)
    .map((p) => parsePlNumber(p));
  if (parts.length !== 3 || parts.some((p) => p == null || p! <= 0)) return null;
  return { lengthM: parts[0]!, widthM: parts[1]!, heightM: parts[2]! };
}

/** Excel serial date albo "30.09.2026" albo Date -> ISO yyyy-mm-dd */
export function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    // Excel serial (1900 system). Offset 25569 dni do epoki Unix.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const m = String(v).trim().match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

/** "07:30" / "7:30" / Excel fraction -> "HH:MM" */
export function parseTime(v: unknown): string | null {
  if (v == null || v === '') return null;
  const hm = (mins: number) => {
    const m = ((Math.round(mins) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  /* Właściciel 20.10, 11:35: komórka „Godzina (…)” w formacie czasu — ExcelJS podaje datę (1899-12-30 08:00 UTC),
     a nie tekst; godzina = czas zegarowy komórki (składowe UTC, jak przy datach z pliku) */
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return hm(v.getUTCHours() * 60 + v.getUTCMinutes() + v.getUTCSeconds() / 60);
  }
  /* ułamek doby; liczba seryjna Excela z datą (> 1000) — godzina to część ułamkowa */
  if (typeof v === 'number' && v >= 0 && v < 1) return hm(v * 24 * 60);
  if (typeof v === 'number' && v > 1000) return hm((v % 1) * 24 * 60);
  const m = String(v).trim().match(/^(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Normalizacja do numeru krajowego (TEL-1). Zastępuje E.164. */
export function normalizePhone(v: unknown, defaultCountry: 'PL' | 'SE' = 'PL'): string | null {
  if (v == null || v === '') return null;
  // Excel często daje liczbę — SE 070… traciłoby zero; trzymamy jako tekst gdy string.
  const raw = typeof v === 'number' ? String(Math.trunc(v)) : String(v);
  const { national } = toNationalPhone(raw, defaultCountry);
  return national || null;
}

/** A6/E38: „...” / „-” / puste = brak wartości (nie tekst do zapisu). */
export function emptyCell(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'number' && !Number.isFinite(v)) return true;
  const s = String(v).replace(/\u00A0/g, ' ').trim();
  return s === '' || s === '-' || s === '...' || s === '…';
}

/** Tekst komórki po trim; puste / „...” / „-” → null. */
export function cellText(v: unknown): string | null {
  if (emptyCell(v)) return null;
  return String(v).replace(/\u00A0/g, ' ').trim();
}

/**
 * E6 / E38: w SharePoint separator „ / ” (PL / SE). Pierwsza część = odcinek PL, druga = SE.
 * Brak drugiej części → se = null (awizacja SE niekompletna — liczy baza E32).
 */
export function splitAb(v: unknown): { pl: string | null; se: string | null } {
  const t = cellText(v);
  if (!t) return { pl: null, se: null };
  const parts = t.split(/\s*\/\s*/).map((p) => {
    const x = p.trim();
    return x === '' || x === '-' || x === '...' || x === '…' ? null : x;
  });
  if (parts.length === 1) return { pl: parts[0], se: null };
  return { pl: parts[0] ?? null, se: parts[1] ?? null };
}

/** Filtr „Przewoźnik = HH” (E38): HH / HHL / H&H. Inni (NTG…) → pominięcie. */
export function isHhCarrier(v: unknown): boolean {
  const t = cellText(v);
  if (!t) return true; /* brak kolumny / pusto — nie filtruj (stare pliki) */
  const n = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');
  return n === 'HH' || n === 'HHL' || n === 'H&H' || n === 'HANDH' || n.startsWith('HHLOG');
}

/* --------------------------------------------------------------- */
/* Mapowanie kolumn — szablon zapisywany po pierwszym imporcie      */
/* --------------------------------------------------------------- */

// D15: stała w lekkim module (widok harmonogramu nie ładuje zod przy starcie).
import { COLUMN_MAP_DEFAULT } from './importColumnMap';
export { COLUMN_MAP_DEFAULT };

export type ColumnMap = Record<keyof typeof COLUMN_MAP_DEFAULT, string>;

/* --------------------------------------------------------------- */
/* Wiersz po walidacji                                              */
/* --------------------------------------------------------------- */

/** I-2C: klasa ładunku. STANDARD = ładunek normatywny („Standard” w kolumnie wymiarów), bez zezwolenia —
 *  wymiary celowo NULL. DIMENSIONED = wymiary L × W × H wymagane (także ponadnormatywne). */
export const CARGO_CLASSES = ['STANDARD', 'DIMENSIONED'] as const;
export type CargoClass = (typeof CARGO_CLASSES)[number];
/** "Standard" (dowolna wielkość liter, spacje) w kolumnie wymiarów. */
export const isStandardDims = (v: unknown): boolean => typeof v === 'string' && /^\s*standard\s*$/i.test(v);

export const ParsedRow = z.object({
  shipmentCode: z.string().min(1),
  itemType: z.string().nullable(),
  cargoClass: z.enum(CARGO_CLASSES),
  lengthM: z.number().positive().nullable(),
  widthM: z.number().positive().nullable(),
  heightM: z.number().positive().nullable(),
  unitWeightT: z.number().positive().nullable(),
  qty: z.number().int().positive(),
  totalWeightT: z.number().positive().nullable(),
  loadDate: z.string().nullable(),
  loadTime: z.string().nullable(),
  deliveryDate: z.string().nullable(),
  deliveryTime: z.string().nullable(),
  /** A6: numer SCX z „Nr zlecenia HHL-Scan” (nie stary orderNo). */
  scxOrderNo: z.string().nullable(),
  hhlOrderNo: z.string().nullable(),
  driverName: z.string().nullable(),
  driverPhone: z.string().nullable(),
  driverNameSe: z.string().nullable(),
  driverPhoneSe: z.string().nullable(),
  tractorPlate: z.string().nullable(),
  tractorPlateSe: z.string().nullable(),
  trailerPlate: z.string().nullable(),
  comment: z.string().nullable(),
  assemblySeq: z.number().int().nullable(),
  /** A6 L31: dostawa < załadunek / ten sam dzień / > 14 dni — sprawa KSH_DATES_CHECK, nie odrzucenie. */
  datesToCheck: z.boolean().optional(),
}).superRefine((r, ctx) => {
  const dims = [r.lengthM, r.widthM, r.heightM];
  if (r.cargoClass === 'STANDARD' && dims.some((d) => d != null)) {
    ctx.addIssue({ code: 'custom', path: ['lengthM'], message: 'klasa STANDARD: wymiary muszą być puste' });
  }
  if (r.cargoClass !== 'STANDARD' && dims.some((d) => d == null)) {
    ctx.addIssue({ code: 'custom', path: ['lengthM'], message: 'wymiary L × W × H wymagane (klasa inna niż STANDARD)' });
  }
});
export type ParsedRow = z.infer<typeof ParsedRow>;

export interface RowIssue {
  rowIndex: number;
  shipmentCode: string | null;
  severity: 'ERROR' | 'WARN';
  code: string;
  message: string;
  values?: Record<string, unknown>;
}

/* --------------------------------------------------------------- */
/* Limity wymiarowe — do POTWIERDZENIA, nie zaszywaj w kodzie       */
/* --------------------------------------------------------------- */

export interface CountryLimits {
  country: 'PL' | 'SE';
  maxComboLengthM: number;
  maxWidthM: number;
  maxHeightM: number;
  maxWeightT: number;
}

/**
 * UWAGA: to są wartości STARTOWE do konfiguracji, nie źródło prawdy.
 * Limity dla zestawów, dopuszczenia dla pojazdów i sieci dróg różnią się
 * i zmieniają. Potwierdź u przewoźnika i w organie wydającym zezwolenia,
 * a potem trzymaj je w tabeli konfiguracyjnej, nie w kodzie.
 */
export const LIMITS_TO_CONFIRM: CountryLimits[] = [
  { country: 'PL', maxComboLengthM: 16.5, maxWidthM: 2.55, maxHeightM: 4.0, maxWeightT: 40 },
  { country: 'SE', maxComboLengthM: 24.0, maxWidthM: 2.60, maxHeightM: 4.5, maxWeightT: 64 },
];

export function classifyOversize(
  dims: { lengthM: number; widthM: number; heightM: number; weightT: number },
  limits: CountryLimits[] = LIMITS_TO_CONFIRM
): string[] {
  const flags: string[] = [];
  for (const l of limits) {
    if (dims.lengthM > l.maxComboLengthM) flags.push(`LENGTH_${l.country}`);
    if (dims.widthM  > l.maxWidthM)       flags.push(`WIDTH_${l.country}`);
    if (dims.heightM > l.maxHeightM)      flags.push(`HEIGHT_${l.country}`);
    if (dims.weightT > l.maxWeightT)      flags.push(`WEIGHT_${l.country}`);
  }
  return flags;
}

/* --------------------------------------------------------------- */
/* Główny parser                                                    */
/* --------------------------------------------------------------- */

/** #590: wiersze pominięte z powodu innego przewoźnika (bez pełnych danych wiersza). */
export type SkippedCarrierRow = { code: string; carrier_text: string };

export interface ParseResult {
  rows: ParsedRow[];
  issues: RowIssue[];
  stats: {
    total: number;
    accepted: number;
    rejected: number;
    warnings: number;
    skippedStandard: number;
    skippedCarrier: number;
    skippedCarrierRows: SkippedCarrierRow[];
    skippedEmpty: number;
    datesToCheck: number;
  };
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Math.round(ms / 86_400_000);
}

export function parseSchedule(
  raw: Array<Record<string, unknown>>,
  map: ColumnMap = COLUMN_MAP_DEFAULT as unknown as ColumnMap
): ParseResult {
  const rows: ParsedRow[] = [];
  const issues: RowIssue[] = [];
  const seen = new Set<string>();
  let skippedStandard = 0;
  let skippedCarrier = 0;
  const skippedCarrierRows: SkippedCarrierRow[] = [];
  let skippedEmpty = 0;
  let datesToCheck = 0;
  const hasCarrierCol = Boolean(map.carrier && map.carrier !== `\u0000brak:carrier`);

  raw.forEach((r, i) => {
    const rowIndex = i + 2; // +1 nagłówek, +1 indeks od 1 (jak w Excelu)
    const codeRaw = cellText(r[map.shipmentCode]);

    /* A6: wiersz tylko z Lp. / pusty — pomiń bez błędu NO_SHIPMENT_CODE. */
    if (!codeRaw) {
      const anyData = Object.entries(r).some(([k, v]) => {
        if (/^lp\.?$/i.test(k.trim())) return false;
        return !emptyCell(v);
      });
      if (!anyData) {
        skippedEmpty += 1;
        return;
      }
      issues.push({ rowIndex, shipmentCode: null, severity: 'ERROR',
        code: 'NO_SHIPMENT_CODE',
        message: 'Brak kodu w kolumnie "Wysyłka" — to jest klucz naturalny, wiersz odrzucony' });
      return;
    }

    /* E38: filtr Przewoźnik = HH (gdy kolumna jest w mapie). Pusty = HH (WARN po STANDARD). */
    if (hasCarrierCol) {
      const carrierRaw = r[map.carrier];
      if (!emptyCell(carrierRaw) && !isHhCarrier(carrierRaw)) {
        skippedCarrier += 1;
        /* #590: lista kodów+przewoźnik do decyzji KSH_CARRIER_CHANGED (nie pełny wiersz). */
        if (!isStandardDims(r[map.dimensions])) {
          skippedCarrierRows.push({
            code: codeRaw,
            carrier_text: cellText(carrierRaw) ?? '—',
          });
        }
        /* E38 pkt 2: NTG (i inni) z wymiarami — WARN w podglądzie, nie cicho. */
        if (!isStandardDims(r[map.dimensions])) {
          issues.push({ rowIndex, shipmentCode: codeRaw, severity: 'WARN',
            code: 'CARRIER_SKIP',
            message: `Przewoźnik spoza HH (${cellText(carrierRaw) ?? '—'}) — wiersz pominięty; sprawdź plik KSH`,
            values: { carrier: cellText(carrierRaw) } });
        }
        return;
      }
    }

    // B-8-IMP / D-8: TYP = STANDARD (kolumna Typ albo „Standard” w wymiarach) to ładunek NTG.
    // Pomijamy wiersz. To nie jest błąd i nie trafia do odrzuconych.
    const typCell = r[map.itemType];
    const typStandard = typeof typCell === 'string' && /^\s*standard\s*$/i.test(typCell);
    if (typStandard || isStandardDims(r[map.dimensions])) {
      skippedStandard += 1;
      return;
    }
    /* F7 A6: pusty Przewoźnik przy obecnej kolumnie = HH z WARN (tylko dla wierszy, które wchodzą). */
    if (hasCarrierCol && emptyCell(r[map.carrier])) {
      issues.push({ rowIndex, shipmentCode: codeRaw, severity: 'WARN',
        code: 'CARRIER_EMPTY',
        message: 'Pusty „Przewoźnik” — traktowany jako HH (wiersz wchodzi)' });
    }
    const code = codeRaw;

    if (seen.has(code)) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'ERROR',
        code: 'DUPLICATE_CODE',
        message: `Kod ${code} występuje więcej niż raz w pliku` });
      return;
    }

    const dims = parseDimensions(r[map.dimensions]);
    if (!dims) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'ERROR',
        code: 'BAD_DIMENSIONS',
        message: 'Nie da się sparsować wymiarów (oczekiwany format "L x W x H")',
        values: { raw: r[map.dimensions] } });
      return;
    }

    const unitWeightT  = emptyCell(r[map.unitWeight]) ? null : parsePlNumber(r[map.unitWeight]);
    const qtyRaw       = emptyCell(r[map.qty]) ? null : parsePlNumber(r[map.qty]);
    const totalWeightT = emptyCell(r[map.totalWeight]) ? null : parsePlNumber(r[map.totalWeight]);
    const qty = qtyRaw == null ? 1 : Math.round(qtyRaw);

    // ---- WALIDATOR PRZESUNIĘTYCH KOLUMN ----
    // To jest reguła, która wyłapuje błąd z próbki KSH.
    if (unitWeightT != null && totalWeightT != null && qty > 0) {
      const expected = qty * unitWeightT;
      const tol = Math.max(0.05 * totalWeightT, 0.10);
      if (Math.abs(totalWeightT - expected) > tol) {
        issues.push({ rowIndex, shipmentCode: code, severity: 'ERROR',
          code: 'WEIGHT_INCONSISTENT',
          message: `Waga transportu (${formatPlNumber(totalWeightT, 2)} t) nie zgadza się z ilość × waga elementu (${formatPlNumber(expected, 2)} t). Najczęstsza przyczyna: przesunięte kolumny w arkuszu.`,
          values: { unitWeightT, qty, totalWeightT } });
        return;
      }
    }

    // Gęstość absurdalna => prawie na pewno zła kolumna.
    if (dims && totalWeightT != null && qty > 3 && totalWeightT / qty < 0.5 && dims.lengthM > 5) {
      // Known KSH sheet quirk (T-* qty vs transport weight). WARN, do not drop row —
      // otherwise dry-run would falsely mark them as removals.
      issues.push({ rowIndex, shipmentCode: code, severity: 'WARN',
        code: 'IMPLAUSIBLE_QTY',
        message: `${qty} elementów o długości ${dims.lengthM} m przy łącznej masie ${totalWeightT} t jest fizycznie nieprawdopodobne. Sprawdź mapowanie kolumny "Ilość elementów".`,
        values: { qty, totalWeightT, lengthM: dims.lengthM } });
    }

    if (unitWeightT == null && totalWeightT == null) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'WARN',
        code: 'NO_WEIGHT',
        message: 'Brak jakiejkolwiek masy — nie da się wycenić ani zweryfikować zezwolenia' });
    }

    const loadDate = parseDate(r[map.loadDate]);
    const deliveryDate = parseDate(r[map.deliveryDate]);
    /* A6 L31 / E38 12:50: zła kolejność dat nie odrzuca — sprawa KSH_DATES_CHECK. */
    let rowDatesCheck = false;
    if (loadDate && deliveryDate) {
      const span = daysBetween(loadDate, deliveryDate);
      if (span < 0 || span === 0 || span > 14) {
        rowDatesCheck = true;
        datesToCheck += 1;
        issues.push({ rowIndex, shipmentCode: code, severity: 'WARN',
          code: 'KSH_DATES_CHECK',
          message: span < 0
            ? `Data dostawy (${deliveryDate}) jest wcześniejsza niż data załadunku (${loadDate}) — transport wchodzi ze sprawą „Daty KSH do sprawdzenia”`
            : span === 0
              ? `Dostawa w dniu załadunku (${loadDate}) — sprawa „Daty KSH do sprawdzenia”`
              : `Dostawa ${span} dni po załadunku (> 14) — sprawa „Daty KSH do sprawdzenia”`,
          values: { loadDate, deliveryDate, span } });
      }
    }

    // I-2C: STANDARD = ładunek normatywny — walidator wymiarów / zezwoleń go pomija
    const flags = dims ? classifyOversize({ ...dims, weightT: totalWeightT ?? 0 }) : [];
    if (flags.length > 0) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'WARN',
        code: 'OVERSIZE',
        message: `Ładunek ponadnormatywny: ${flags.join(', ')}. Wymagane zezwolenie przed załadunkiem.`,
        values: { flags } });
    }

    const driver = splitAb(r[map.driverName]);
    const phonePl = splitAb(r[map.driverPhone]);
    const tractor = splitAb(r[map.tractorPlate]);

    const parsed = ParsedRow.safeParse({
      shipmentCode: code,
      itemType: cellText(r[map.itemType]),
      cargoClass: 'DIMENSIONED',
      lengthM: dims?.lengthM ?? null, widthM: dims?.widthM ?? null, heightM: dims?.heightM ?? null,
      unitWeightT, qty, totalWeightT,
      loadDate, loadTime: emptyCell(r[map.loadTime]) ? null : parseTime(r[map.loadTime]),
      deliveryDate, deliveryTime: emptyCell(r[map.deliveryTime]) ? null : parseTime(r[map.deliveryTime]),
      scxOrderNo: cellText(r[map.scxOrderNo]),
      hhlOrderNo: cellText(r[map.hhlOrderNo]),
      driverName: driver.pl,
      driverPhone: normalizePhone(phonePl.pl ?? undefined, 'PL'),
      driverNameSe: driver.se,
      driverPhoneSe: normalizePhone(phonePl.se ?? undefined, 'SE'),
      tractorPlate: tractor.pl,
      tractorPlateSe: tractor.se,
      trailerPlate: cellText(r[map.trailerPlate]),
      comment: cellText(r[map.comment]),
      assemblySeq: (() => {
        if (!map.assemblySeq || emptyCell(r[map.assemblySeq])) return null;
        const n = parsePlNumber(r[map.assemblySeq]);
        return n == null ? null : Math.round(n);
      })(),
      datesToCheck: rowDatesCheck || undefined,
    });

    if (!parsed.success) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'ERROR',
        code: 'SCHEMA', message: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ') });
      return;
    }

    seen.add(code);
    rows.push(parsed.data);
  });

  return {
    rows,
    issues,
    stats: {
      total: raw.length,
      accepted: rows.length,
      rejected: issues.filter((i) => i.severity === 'ERROR').length,
      warnings: issues.filter((i) => i.severity === 'WARN').length,
      skippedStandard,
      skippedCarrier,
      skippedCarrierRows,
      skippedEmpty,
      datesToCheck,
    },
  };
}

/* --------------------------------------------------------------- */
/* DIFF — nic nie zapisujemy, dopóki człowiek nie zatwierdzi        */
/* --------------------------------------------------------------- */

export interface DiffResult {
  added: ParsedRow[];
  changed: Array<{ code: string; before: Partial<ParsedRow>; after: Partial<ParsedRow>; fields: string[] }>;
  removed: string[];
  unchanged: number;
  /** Zmiany dat na transportach, które są już awizowane —
   *  wymagają osobnego powiadomienia przewoźnika. */
  criticalDateChanges: Array<{ code: string; field: string; before: unknown; after: unknown }>;
}

/* Demo dry-run: tylko plan (wymiary/daty). Zasoby i numery A6 porównuje `import_schedule` w bazie. */
const COMPARED: (keyof ParsedRow)[] = [
  'itemType', 'cargoClass', 'lengthM', 'widthM', 'heightM', 'unitWeightT', 'qty', 'totalWeightT',
  'loadDate', 'loadTime', 'deliveryDate', 'deliveryTime', 'assemblySeq',
];

export function diffSchedule(
  incoming: ParsedRow[],
  existing: Array<ParsedRow & { hasAwizacja?: boolean }>
): DiffResult {
  const byCode = new Map(existing.map((e) => [e.shipmentCode, e]));
  const incomingCodes = new Set(incoming.map((r) => r.shipmentCode));

  const added: ParsedRow[] = [];
  const changed: DiffResult['changed'] = [];
  const criticalDateChanges: DiffResult['criticalDateChanges'] = [];
  let unchanged = 0;

  for (const row of incoming) {
    const prev = byCode.get(row.shipmentCode);
    if (!prev) { added.push(row); continue; }

    const fields = COMPARED.filter((f) => prev[f] !== row[f]);
    if (fields.length === 0) { unchanged++; continue; }

    changed.push({
      code: row.shipmentCode,
      before: Object.fromEntries(fields.map((f) => [f, prev[f]])),
      after: Object.fromEntries(fields.map((f) => [f, row[f]])),
      fields: fields as string[],
    });

    if (prev.hasAwizacja) {
      for (const f of ['loadDate', 'loadTime', 'deliveryDate', 'deliveryTime'] as const) {
        if (fields.includes(f)) {
          criticalDateChanges.push({ code: row.shipmentCode, field: f, before: prev[f], after: row[f] });
        }
      }
    }
  }

  const removed = existing.map((e) => e.shipmentCode).filter((c) => !incomingCodes.has(c));
  return { added, changed, removed, unchanged, criticalDateChanges };
}
