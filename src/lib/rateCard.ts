/** I-19 — pomocnicze funkcje formularza cennika HHL (walidacja ostateczna w bazie: rate_card_save, 0065). */
export const DIM_KEYS = ['length_from', 'length_to', 'width_from', 'width_to', 'height_from', 'height_to', 'weight_from', 'weight_to'] as const;
export type DimKey = (typeof DIM_KEYS)[number];
export type FormRow = Record<DimKey | 'base_rate' | 'note', string>;
export const EMPTY_ROW: FormRow = { length_from: '', length_to: '', width_from: '', width_to: '', height_from: '', height_to: '', weight_from: '', weight_to: '', base_rate: '', note: '' };

/** „12,5” → 12.5; puste lub nie-liczba → null. */
export function num(s: string): number | null {
  const v = s.trim().replace(/\s/g, '').replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Wiersze formularza → pozycje dla rate_card_save; null + numer wiersza przy błędzie. */
export function buildRules(rows: readonly FormRow[], standard: string): { rules: Array<Record<string, unknown>> } | { bad: number } {
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
  if (standard.trim() !== '') {
    const v = num(standard);
    if (v === null || v < 0) return { bad: 0 };
    rules.push({ cargo_class: 'STANDARD', base_rate: v });
  }
  return { rules };
}

