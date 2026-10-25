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

import { z } from 'zod';
import { toNationalPhone } from './phoneNational';
import { formatPlNumber } from './format';
export { standardSkipMessage } from './standardSkipMessage';

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
  orderNo: z.string().nullable(),
  driverName: z.string().nullable(),
  driverPhone: z.string().nullable(),
  assemblySeq: z.number().int().nullable(),
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

export interface ParseResult {
  rows: ParsedRow[];
  issues: RowIssue[];
  stats: { total: number; accepted: number; rejected: number; warnings: number; skippedStandard: number };
}

export function parseSchedule(
  raw: Array<Record<string, unknown>>,
  map: ColumnMap = COLUMN_MAP_DEFAULT as unknown as ColumnMap
): ParseResult {
  const rows: ParsedRow[] = [];
  const issues: RowIssue[] = [];
  const seen = new Set<string>();
  let skippedStandard = 0;

  raw.forEach((r, i) => {
    const rowIndex = i + 2; // +1 nagłówek, +1 indeks od 1 (jak w Excelu)
    // B-8-IMP / D-8: TYP = STANDARD (kolumna Typ albo „Standard” w wymiarach) to ładunek NTG.
    // Pomijamy wiersz. To nie jest błąd i nie trafia do odrzuconych.
    const typCell = r[map.itemType];
    const typStandard = typeof typCell === 'string' && /^\s*standard\s*$/i.test(typCell);
    if (typStandard || isStandardDims(r[map.dimensions])) {
      skippedStandard += 1;
      return;
    }
    const code = String(r[map.shipmentCode] ?? '').trim();

    if (!code) {
      issues.push({ rowIndex, shipmentCode: null, severity: 'ERROR',
        code: 'NO_SHIPMENT_CODE',
        message: 'Brak kodu w kolumnie "Wysyłka" — to jest klucz naturalny, wiersz odrzucony' });
      return;
    }
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

    const unitWeightT  = parsePlNumber(r[map.unitWeight]);
    const qtyRaw       = parsePlNumber(r[map.qty]);
    const totalWeightT = parsePlNumber(r[map.totalWeight]);
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
    if (loadDate && deliveryDate && deliveryDate < loadDate) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'ERROR',
        code: 'DATE_ORDER',
        message: `Data dostawy (${deliveryDate}) jest wcześniejsza niż data załadunku (${loadDate})` });
      return;
    }

    // I-2C: STANDARD = ładunek normatywny — walidator wymiarów / zezwoleń go pomija
    const flags = dims ? classifyOversize({ ...dims, weightT: totalWeightT ?? 0 }) : [];
    if (flags.length > 0) {
      issues.push({ rowIndex, shipmentCode: code, severity: 'WARN',
        code: 'OVERSIZE',
        message: `Ładunek ponadnormatywny: ${flags.join(', ')}. Wymagane zezwolenie przed załadunkiem.`,
        values: { flags } });
    }

    const parsed = ParsedRow.safeParse({
      shipmentCode: code,
      itemType: (r[map.itemType] as string) ?? null,
      cargoClass: 'DIMENSIONED',
      lengthM: dims?.lengthM ?? null, widthM: dims?.widthM ?? null, heightM: dims?.heightM ?? null,
      unitWeightT, qty, totalWeightT,
      loadDate, loadTime: parseTime(r[map.loadTime]),
      deliveryDate, deliveryTime: parseTime(r[map.deliveryTime]),
      orderNo: (r[map.orderNo] as string)?.toString().trim() || null,
      driverName: (r[map.driverName] as string)?.toString().trim() || null,
      driverPhone: normalizePhone(r[map.driverPhone]),
      assemblySeq: (() => { const n = parsePlNumber(r[map.assemblySeq]); return n == null ? null : Math.round(n); })(),
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

const COMPARED: (keyof ParsedRow)[] = [
  'itemType', 'cargoClass', 'lengthM', 'widthM', 'heightM', 'unitWeightT', 'qty', 'totalWeightT',
  'loadDate', 'loadTime', 'deliveryDate', 'deliveryTime', 'orderNo', 'assemblySeq',
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
