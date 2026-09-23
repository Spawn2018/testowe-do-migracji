/**
 * SCX rate card from Sebastian Excel SCX_CENNIK.xlsx.
 * USE ONLY cena_bazowa_EUR — never cena_aktualna (already includes SEFS ~×1.119).
 * Kratownice rows are convoy/packing VARIANTS (not additive volumes).
 * SEFS application: Word annex hybrid stepped table (lib/sefs.ts), not Excel Dodatek paliwowy continuous formula.
 */
import raw from '../data/scx-rates-base.json';
import { applySefsToRoadRate, sefsForLoadDate } from './sefs';

export interface ScxRateRow {
  id: string;
  excelRow: number;
  lp: number;
  pozycja: string;
  dimsLabel: string;
  pcsPerLoad: number | string;
  transportsScenario: number; // scenario count — do NOT sum alternatives
  weightT: number;
  baseEur: number;
  uwagi: string | null;
  escortCars: number | null; // parsed from uwagi when convoy
  packing: '3pcs' | '4pcs' | 'standard' | 'other';
  zestaw: { L: number; W: number; H: number; massT: number };
  variantGroup: string; // e.g. kratownice-3 / kratownice-4 — alternatives within group
}

export const SCX_COMMERCIAL = raw.commercial as {
  confirm_load_date_days_before: number;
  cancel_free_days_before: number;
  cancel_fees_pct: Record<string, number>;
  transit_days: string;
  free_load_unload_h: string;
  demurrage_EUR_per_day: { kratownice: number; other: number };
};

export const SCX_META = {
  source: raw.source as string,
  currency: 'EUR' as const,
  rule: raw.rule as string,
  fuelNote: raw.fuel_note as string,
};

function parseEscort(uwagi: string | null): number | null {
  if (!uwagi) return null;
  const m = uwagi.match(/(\d)\s+aut/);
  return m ? Number(m[1]) : null;
}

function packingOf(pcs: number | string, pozycja: string): ScxRateRow['packing'] {
  if (!pozycja.toLowerCase().includes('kratownic')) return 'standard';
  if (pcs === 3 || pcs === '3') return '3pcs';
  if (pcs === 4 || pcs === '4') return '4pcs';
  return 'other';
}

function variantGroup(pozycja: string, pcs: number | string): string {
  const slug = pozycja.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  if (pozycja.toLowerCase().includes('kratownic')) return `kratownice-${pcs}pcs`;
  return slug;
}

export const SCX_RATE_ROWS: ScxRateRow[] = (raw.rows as Array<Record<string, unknown>>).map((r, i) => {
  const pcs = r.ilosc_na_transport_szt as number | string;
  const poz = String(r.pozycja);
  return {
    id: `scx-${r.excel_row ?? i + 3}`,
    excelRow: Number(r.excel_row),
    lp: Number(r.lp),
    pozycja: poz,
    dimsLabel: String(r.wymiar_elementu_LxWxH_m),
    pcsPerLoad: pcs,
    transportsScenario: Number(r.ilosc_transportow),
    weightT: Number(r.waga_transportu_t),
    baseEur: Number(r.cena_bazowa_EUR),
    uwagi: (r.uwagi as string | null) ?? null,
    escortCars: parseEscort((r.uwagi as string | null) ?? null),
    packing: packingOf(pcs, poz),
    zestaw: {
      L: Number(r.zestaw_L_max_m),
      W: Number(r.zestaw_W_max_m),
      H: Number(r.zestaw_H_max_m),
      massT: Number(r.zestaw_masa_max_t),
    },
    variantGroup: variantGroup(poz, pcs),
  };
});

/** Default variant pick for seed: prefer Kratownice 3pcs / 2 escort when matching K, else by lp cycle. */
export function pickScxRowForSeed(index: number, itemType: string): ScxRateRow {
  const byType: Record<string, string[]> = {
    SG: ['Słupy skrajne', 'Słupy główne'],
    T: ['Tężnik (belka)', 'Belki podsuwnicowe'],
    K: ['Kratownice'],
    R: ['Element referencyjny'],
    P: ['Płatwie (długie)'],
    D: ['Stężenia międzysłupowe (długie)', 'Stężenia międzysłupowe (krótkie)'],
  };
  const names = byType[itemType] ?? ['Element referencyjny'];
  const candidates = SCX_RATE_ROWS.filter((r) => names.some((n) => r.pozycja.startsWith(n.split(' ')[0]) || r.pozycja === n || r.pozycja.includes(n.slice(0, 8))));
  // For Kratownice: pick ONE variant only — 3pcs / 2 escort cars as default demo (not sum 34+25)
  if (itemType === 'K') {
    const preferred =
      SCX_RATE_ROWS.find((r) => r.pozycja === 'Kratownice' && r.packing === '3pcs' && r.escortCars === 2) ??
      SCX_RATE_ROWS.find((r) => r.pozycja === 'Kratownice' && r.packing === '3pcs');
    if (preferred) return preferred;
  }
  if (candidates.length) return candidates[index % candidates.length];
  return SCX_RATE_ROWS[index % SCX_RATE_ROWS.length];
}

export function priceLoadEur(baseEur: number, loadDate: string) {
  const sefs = sefsForLoadDate(loadDate);
  const roadWithSefs = applySefsToRoadRate(baseEur, sefs.appliedMult);
  return { sefs, roadWithSefs, sefsDelta: Math.round((roadWithSefs - baseEur) * 100) / 100 };
}

/** Revenue = cost base × markup (HHL); SEFS applied to road side independently at same mult. */
export function revenueFromCost(costBaseEur: number, markup = 1.22) {
  return Math.round(costBaseEur * markup);
}
