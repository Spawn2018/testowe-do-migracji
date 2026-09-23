/** Harmonogram column prefs — localStorage key watch-tower-schedule-cols-v1 */

export type SchedColId =
  | 'code'
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
  label: string;
  defaultWidth: number;
  optional?: boolean;
  role?: 'cost' | 'rev' | 'margin';
};

export const SCHED_COLS: SchedColDef[] = [
  { id: 'code', label: 'Wysyłka', defaultWidth: 90 },
  { id: 'type', label: 'Typ', defaultWidth: 70 },
  { id: 'dims', label: 'Wymiary L×W×H', defaultWidth: 150 },
  { id: 'weight', label: 'Masa', defaultWidth: 70 },
  { id: 'load', label: 'Załadunek', defaultWidth: 110 },
  { id: 'deliver', label: 'Dostawa', defaultWidth: 110 },
  { id: 'status', label: 'Status', defaultWidth: 140 },
  { id: 'driver', label: 'Kierowca', defaultWidth: 120 },
  { id: 'phone', label: 'Telefon', defaultWidth: 120 },
  { id: 'plate', label: 'Nr rej.', defaultWidth: 100 },
  { id: 'eta', label: 'ETA Boden', defaultWidth: 120 },
  { id: 'docs', label: 'Dok.', defaultWidth: 90 },
  { id: 'cost', label: 'Koszt', defaultWidth: 90, role: 'cost' },
  { id: 'rev', label: 'Przychód', defaultWidth: 90, role: 'rev' },
  { id: 'margin', label: 'Marża', defaultWidth: 100, role: 'margin' },
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
    for (const id of base.order) if (!order.includes(id)) order.push(id);
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
