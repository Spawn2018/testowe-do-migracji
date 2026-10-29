/**
 * A6 — konflikt zapisu WT→plik: wiersz w pliku zmienił się od ostatniego odczytu (D-1420).
 * F7 #560: daty/godziny + numery zleceń; brak expected_file → nie zapisuj (pomijaj).
 */

export type FileDateSnap = {
  ld: string | null;
  lt: string | null;
  dd: string | null;
  dt: string | null;
  /** Nr zlecenia HHL-Scan (carrier_order_no). */
  co?: string | null;
  /** Nr zlecenia HHL-KSH (hhl_order_no). */
  ho?: string | null;
};

/** true = brak expected → nie wolno pisać (F7: pomiń, nie konflikt). */
export function missingExpectedFile(
  expected: FileDateSnap | null | undefined,
): boolean {
  return expected == null;
}

function asExpectedSnap(v: unknown): FileDateSnap | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return {
    ld: typeof o.ld === 'string' ? o.ld : o.ld == null ? null : String(o.ld),
    lt: typeof o.lt === 'string' ? o.lt : o.lt == null ? null : String(o.lt),
    dd: typeof o.dd === 'string' ? o.dd : o.dd == null ? null : String(o.dd),
    dt: typeof o.dt === 'string' ? o.dt : o.dt == null ? null : String(o.dt),
    co: typeof o.co === 'string' ? o.co : o.co == null ? null : String(o.co),
    ho: typeof o.ho === 'string' ? o.ho : o.ho == null ? null : String(o.ho),
  };
}

/**
 * #637 (a) / 28C:A: w trybie `test` baseline konfliktu = migawka z **kopii**
 * odczytana w tym samym cyklu (nie `expected_file` z odczytów prod).
 * Na prod bez zmian — „nie nadpisuj edycji klienta”.
 */
export function resolveOutboundExpected(args: {
  fileMode?: 'test' | 'prod';
  expectedFile: unknown;
  fileSnapshot: Record<string, FileDateSnap | null | undefined>;
  codes: string[];
}): FileDateSnap | null {
  if (args.fileMode === 'test') {
    for (const c of args.codes) {
      const fromCopy = asExpectedSnap(args.fileSnapshot[c] ?? null);
      if (fromCopy) return fromCopy;
    }
  }
  return asExpectedSnap(args.expectedFile);
}

/** Kolejność jak w import_schedule (pending skip / file-changed). */
const CONFLICT_FIELD_ORDER = [
  'load_date',
  'load_time',
  'delivery_date',
  'delivery_time',
  'carrier_order_no',
  'hhl_order_no',
] as const;

type ConflictField = (typeof CONFLICT_FIELD_ORDER)[number];

/** Jak import (btrim + ''→null) — F7 #570. */
function normCell(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function snapVal(
  snap: FileDateSnap | null | undefined,
  field: ConflictField,
): string | null {
  if (!snap) return null;
  switch (field) {
    case 'load_date': return normCell(snap.ld);
    case 'load_time': return normCell(snap.lt);
    case 'delivery_date': return normCell(snap.dd);
    case 'delivery_time': return normCell(snap.dt);
    case 'carrier_order_no': return normCell(snap.co);
    case 'hhl_order_no': return normCell(snap.ho);
  }
}

/** true = plik ≠ oczekiwany → nie nadpisuj, sprawa HHL. */
export function fileRowChangedSinceRead(
  expected: FileDateSnap | null | undefined,
  current: FileDateSnap | null | undefined,
): boolean {
  if (!expected) return false;
  if (!current) return true;
  return (
    snapVal(expected, 'load_date') !== snapVal(current, 'load_date')
    || snapVal(expected, 'load_time') !== snapVal(current, 'load_time')
    || snapVal(expected, 'delivery_date') !== snapVal(current, 'delivery_date')
    || snapVal(expected, 'delivery_time') !== snapVal(current, 'delivery_time')
    || snapVal(expected, 'carrier_order_no') !== snapVal(current, 'carrier_order_no')
    || snapVal(expected, 'hhl_order_no') !== snapVal(current, 'hhl_order_no')
  );
}

/** F7 #570: nie wybieraj kodu bez wiersza w pliku, gdy jest inny obecny. */
function skipMissingWhenOtherPresent(
  remaining: string[],
  code: string,
  current: FileDateSnap | null | undefined,
  fileSnapshot: Record<string, FileDateSnap | null | undefined>,
): boolean {
  if (current != null) return false;
  return remaining.some((c) => c !== code && (fileSnapshot[c] ?? null) != null);
}

/**
 * #569 / F7 #570: kod i pole sprawy z wiersza konfliktu (nie z pierwszego kodu).
 * Najpierw wiersz różniący się polem **z łatki** (kolejność jak import);
 * dopiero gdy żaden — pierwszy rozjechany wiersz i dowolne pole.
 * Pomija kody bez wiersza w pliku, gdy jest inny obecny (uniknięcie 2 spraw).
 * Inaczej Edge (sprawa spoza łatki) ≠ import (tylko pola łatki) → 2 sprawy.
 */
export function pickOutboundConflictNote(
  remaining: string[],
  expected: FileDateSnap,
  fileSnapshot: Record<string, FileDateSnap | null | undefined>,
  patch: Record<string, unknown> | null | undefined,
): { code: string; field: ConflictField } | null {
  const patchKeys = patch && typeof patch === 'object' ? Object.keys(patch) : [];
  const fromPatch = patchKeys.length
    ? CONFLICT_FIELD_ORDER.filter((f) => patchKeys.includes(f))
    : [];
  for (const code of remaining) {
    const current = fileSnapshot[code] ?? null;
    if (skipMissingWhenOtherPresent(remaining, code, current, fileSnapshot)) continue;
    if (!fileRowChangedSinceRead(expected, current)) continue;
    for (const field of fromPatch) {
      if (snapVal(expected, field) !== snapVal(current, field)) {
        return { code, field };
      }
    }
  }
  for (const code of remaining) {
    const current = fileSnapshot[code] ?? null;
    if (skipMissingWhenOtherPresent(remaining, code, current, fileSnapshot)) continue;
    if (fileRowChangedSinceRead(expected, current)) {
      return {
        code,
        field: conflictFieldFromSnaps(expected, current, patchKeys),
      };
    }
  }
  return null;
}

/**
 * F7 r8/r9: pole sprawy jak import — najpierw różniące się pole **z łatki**
 * (ta sama kolejność co import), potem dowolne różniące się.
 */
export function conflictFieldFromSnaps(
  expected: FileDateSnap | null | undefined,
  current: FileDateSnap | null | undefined,
  patchKeys?: readonly string[] | null,
  fallback: ConflictField = 'carrier_order_no',
): ConflictField {
  const fromPatch = patchKeys?.length
    ? CONFLICT_FIELD_ORDER.filter((f) => patchKeys.includes(f))
    : [];
  for (const field of fromPatch) {
    if (snapVal(expected, field) !== snapVal(current, field)) return field;
  }
  for (const field of CONFLICT_FIELD_ORDER) {
    if (snapVal(expected, field) !== snapVal(current, field)) return field;
  }
  return fallback;
}

type PatchLike = {
  load_date?: string | null;
  load_time?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  carrier_order_no?: string | null;
  hhl_order_no?: string | null;
  driver?: string | null;
  driver_phone?: string | null;
  tractor?: string | null;
  trailer?: string | null;
};

/** #597: klucze awizacji poza snapshota dat/numerów (bez PII w migawce). */
const AWIZ_PATCH_KEYS = ['driver', 'driver_phone', 'tractor', 'trailer'] as const;

/** Plik już = expected+łatka (PUT udany, ack zgubiony) — F7 r2 / #597 F7 B1. */
export function fileAlreadyHasPatch(
  expected: FileDateSnap,
  patch: PatchLike,
  current: FileDateSnap | null | undefined,
): boolean {
  if (!current) return false;
  // B1: łatka z awizacją → nie alreadyDone (snapshot bez dr/ph/tr/tl) — wymagany PUT.
  for (const k of AWIZ_PATCH_KEYS) {
    if (k in patch) return false;
  }
  const want: FileDateSnap = {
    ld: expected.ld ?? null,
    lt: expected.lt ?? null,
    dd: expected.dd ?? null,
    dt: expected.dt ?? null,
    co: expected.co ?? null,
    ho: expected.ho ?? null,
  };
  if ('load_date' in patch && patch.load_date != null) want.ld = String(patch.load_date);
  if ('load_time' in patch && patch.load_time != null) want.lt = String(patch.load_time);
  if ('delivery_date' in patch && patch.delivery_date != null) want.dd = String(patch.delivery_date);
  if ('delivery_time' in patch && patch.delivery_time != null) want.dt = String(patch.delivery_time);
  if ('carrier_order_no' in patch && patch.carrier_order_no != null) {
    want.co = String(patch.carrier_order_no);
  }
  if ('hhl_order_no' in patch && patch.hhl_order_no != null) {
    want.ho = String(patch.hhl_order_no);
  }
  return !fileRowChangedSinceRead(want, current);
}
