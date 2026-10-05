/** Harmonogram column prefs — localStorage key watch-tower-schedule-cols-v1 */

export type SchedColId =
  | 'code'
  | 'ord_hhl'
  | 'ord_scx'
  | 'type'
  | 'dims'
  | 'weight'
  | 'load'
  | 'deliver'
  | 'status'
  | 'driver'
  | 'phone'
  | 'plate'
  | 'eta'
  | 'docs'
  | 'cost'
  | 'rev'
  | 'margin';

export type SchedColDef = {
  id: SchedColId;
  labelKey: string;
  defaultWidth: number;
  optional?: boolean;
  role?: 'cost' | 'rev' | 'margin';
};

export const SCHED_COLS: SchedColDef[] = [
  { id: 'code', labelKey: 'sched_col_code', defaultWidth: 90 },
  /* M5 — trzy numery zleceń obok kodu wysyłki (W12, Q9: widoczne dla wszystkich ról) */
  { id: 'ord_hhl', labelKey: 'sched_col_ord_hhl', defaultWidth: 100 },
  { id: 'ord_scx', labelKey: 'sched_col_ord_scx', defaultWidth: 100 },
  { id: 'type', labelKey: 'sched_col_type', defaultWidth: 70 },
  { id: 'dims', labelKey: 'sched_col_dims', defaultWidth: 150 },
  { id: 'weight', labelKey: 'sched_col_weight', defaultWidth: 70 },
  { id: 'load', labelKey: 's_loading', defaultWidth: 110 },
  { id: 'deliver', labelKey: 'sched_col_deliver', defaultWidth: 110 },
  { id: 'status', labelKey: 'status', defaultWidth: 140 },
  { id: 'driver', labelKey: 'driver', defaultWidth: 120 },
  { id: 'phone', labelKey: 'sched_col_phone', defaultWidth: 120 },
  { id: 'plate', labelKey: 'plate', defaultWidth: 100 },
  { id: 'eta', labelKey: 'eta', defaultWidth: 120 },
  { id: 'docs', labelKey: 'sched_col_docs', defaultWidth: 90 },
  { id: 'cost', labelKey: 'cost', defaultWidth: 90, role: 'cost' },
  { id: 'rev', labelKey: 'sched_col_rev', defaultWidth: 90, role: 'rev' },
  { id: 'margin', labelKey: 'sched_col_margin', defaultWidth: 100, role: 'margin' },
];

export type SchedColPrefs = {
  order: SchedColId[];
  hidden: SchedColId[];
  widths: Partial<Record<SchedColId, number>>;
};

const KEY = 'watch-tower-schedule-cols-v1';

export function defaultSchedPrefs(): SchedColPrefs {
  return {
    order: SCHED_COLS.map((c) => c.id),
    hidden: [],
    widths: Object.fromEntries(SCHED_COLS.map((c) => [c.id, c.defaultWidth])) as Record<
      SchedColId,
      number
    >,
  };
}

export function loadSchedPrefs(): SchedColPrefs {
  const base = defaultSchedPrefs();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SchedColPrefs>;
    const known = new Set(SCHED_COLS.map((c) => c.id));
    const order = (parsed.order ?? base.order).filter((id) => known.has(id));
    // nowe kolumny (np. M5 numery zleceń) wstaw za poprzednikiem z kolejności domyślnej, nie na koniec
    base.order.forEach((id, i) => {
      if (order.includes(id)) return;
      const prev = i > 0 ? order.indexOf(base.order[i - 1]) : -1;
      order.splice(prev + 1, 0, id);
    });
    return {
      order,
      hidden: (parsed.hidden ?? []).filter((id) => known.has(id)),
      widths: { ...base.widths, ...(parsed.widths ?? {}) },
    };
  } catch {
    return base;
  }
}

export function saveSchedPrefs(prefs: SchedColPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}
