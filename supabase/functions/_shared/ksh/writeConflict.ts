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

function snapVal(
  snap: FileDateSnap | null | undefined,
  field: ConflictField,
): string | null {
  if (!snap) return null;
  switch (field) {
    case 'load_date': return snap.ld ?? null;
    case 'load_time': return snap.lt ?? null;
    case 'delivery_date': return snap.dd ?? null;
    case 'delivery_time': return snap.dt ?? null;
    case 'carrier_order_no': return snap.co ?? null;
    case 'hhl_order_no': return snap.ho ?? null;
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
    (expected.ld ?? null) !== (current.ld ?? null)
    || (expected.lt ?? null) !== (current.lt ?? null)
    || (expected.dd ?? null) !== (current.dd ?? null)
    || (expected.dt ?? null) !== (current.dt ?? null)
    || (expected.co ?? null) !== (current.co ?? null)
    || (expected.ho ?? null) !== (current.ho ?? null)
  );
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
};

/** Plik już = expected+łatka (PUT udany, ack zgubiony) — F7 r2. */
export function fileAlreadyHasPatch(
  expected: FileDateSnap,
  patch: PatchLike,
  current: FileDateSnap | null | undefined,
): boolean {
  if (!current) return false;
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
