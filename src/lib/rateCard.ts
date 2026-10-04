/** I-30 — formularz cennika według symbolu / wariantu / konwoju (walidacja ostateczna w rate_card_save). */
export type SymbolFormRow = {
  symbol: string;
  family: string;
  convoy_cars: string;
  length_to: string;
  width_to: string;
  height_to: string;
  weight_to: string;
  base_rate: string;
  note: string;
};

export const EMPTY_SYMBOL_ROW: SymbolFormRow = {
  symbol: '',
  family: '',
  convoy_cars: '',
  length_to: '',
  width_to: '',
  height_to: '',
  weight_to: '',
  base_rate: '',
  note: '',
};

/** „12,5” → 12.5; puste lub nie-liczba → null. */
export function num(s: string): number | null {
  const v = s.trim().replace(/\s/g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Prefiks symbolu → rodzina (TS≠T, SS≠SG). */
export function familyFromSymbol(symbol: string): string | null {
  const c = symbol.trim().toUpperCase();
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

/** Wiersze formularza SYMBOL → payload rate_card_save. */
export function buildSymbolRules(rows: readonly SymbolFormRow[]): { rules: Array<Record<string, unknown>> } | { bad: number } {
  const rules: Array<Record<string, unknown>> = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const symbol = r.symbol.trim().toUpperCase();
    const family = (r.family.trim().toUpperCase() || familyFromSymbol(symbol) || '');
    const length_to = num(r.length_to);
    const width_to = num(r.width_to);
    const height_to = num(r.height_to);
    const weight_to = num(r.weight_to);
    const base_rate = num(r.base_rate);
    if (!symbol || !family || length_to == null || width_to == null || height_to == null || weight_to == null || base_rate == null) {
      return { bad: i + 1 };
    }
    if (length_to <= 0 || width_to <= 0 || height_to <= 0 || weight_to <= 0 || base_rate < 0) return { bad: i + 1 };
    const out: Record<string, unknown> = {
      cargo_class: 'SYMBOL',
      symbol,
      family,
      length_to,
      width_to,
      height_to,
      weight_to,
      base_rate,
      note: r.note.trim() || null,
    };
    if (family === 'KR') {
      const c = num(r.convoy_cars);
      if (c == null || c < 1 || c > 3) return { bad: i + 1 };
      out.convoy_cars = c;
    }
    rules.push(out);
  }
  return { rules };
}

/* --- I-19 (legacy DIMENSIONED) — nadal używane w testach jednostkowych --- */
export const DIM_KEYS = ['length_from', 'length_to', 'width_from', 'width_to', 'height_from', 'height_to', 'weight_from', 'weight_to'] as const;
export type DimKey = (typeof DIM_KEYS)[number];
export type FormRow = Record<DimKey | 'base_rate' | 'note', string>;
export const EMPTY_ROW: FormRow = {
  length_from: '', length_to: '', width_from: '', width_to: '',
  height_from: '', height_to: '', weight_from: '', weight_to: '', base_rate: '', note: '',
};

export function buildRules(rows: readonly FormRow[]): { rules: Array<Record<string, unknown>> } | { bad: number } {
  const rules: Array<Record<string, unknown>> = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const out: Record<string, unknown> = { cargo_class: 'DIMENSIONED', note: r.note.trim() || null };
    for (const k of [...DIM_KEYS, 'base_rate'] as const) {
      const v = num(r[k]);
      if (v === null || v < 0) return { bad: i + 1 };
      out[k] = v;
    }
    rules.push(out);
  }
  return { rules };
}
