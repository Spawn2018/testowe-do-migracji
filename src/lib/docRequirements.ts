/**
 * III-6 (SCOPE 6.1) — wymagalność i terminy dokumentów per kategoria.
 * Źródło w produkcji: tabela `doc_requirements` (0078) i `doc_requirements_status()`; tu: wartości startowe
 * (te same co seed migracji — PROPOZYCJA do potwierdzenia z SCX/KSH) i liczenie terminu dla trybu demo
 * według tej samej reguły co SQL.
 */
import type { DocCategory, Document, Load } from '../types';
import { TZ_LOAD_PL, TZ_UNLOAD_SE, wallLocalToIso } from './time';

export type DocAnchor = 'BEFORE_LOAD' | 'AT_LOAD' | 'BEFORE_FERRY' | 'AFTER_UNLOAD' | 'ORG';
export type DocResponsible = 'CARRIER' | 'CLIENT' | 'FORWARDER';
export const DOC_ANCHORS: DocAnchor[] = ['BEFORE_LOAD', 'AT_LOAD', 'BEFORE_FERRY', 'AFTER_UNLOAD', 'ORG'];

export interface DocRequirement {
  category: DocCategory;
  required: boolean;
  responsible: DocResponsible;
  anchor: DocAnchor;
  offsetHours: number;
}

export const DEFAULT_DOC_REQUIREMENTS: DocRequirement[] = [
  { category: 'PERMIT_PL', required: true, responsible: 'CARRIER', anchor: 'BEFORE_LOAD', offsetHours: 24 },
  { category: 'PERMIT_SE', required: true, responsible: 'CARRIER', anchor: 'BEFORE_FERRY', offsetHours: 24 },
  { category: 'CMR', required: true, responsible: 'CARRIER', anchor: 'AT_LOAD', offsetHours: 2 },
  { category: 'POD', required: true, responsible: 'CARRIER', anchor: 'AFTER_UNLOAD', offsetHours: 24 },
  { category: 'LASHING_PHOTOS', required: true, responsible: 'CARRIER', anchor: 'AT_LOAD', offsetHours: 2 },
  { category: 'INSURANCE', required: true, responsible: 'CARRIER', anchor: 'ORG', offsetHours: 0 },
  { category: 'DRAWING', required: true, responsible: 'CLIENT', anchor: 'BEFORE_LOAD', offsetHours: 72 },
];

export type DocState = 'OK' | 'MISSING' | 'OVERDUE';
export interface DocStatusRow { loadId: string; category: DocCategory; dueAt: string | null; state: DocState }

const H = 3600_000;
const wall = (day: string | null | undefined, hm: string, tz: typeof TZ_LOAD_PL | typeof TZ_UNLOAD_SE): number | null => {
  const m = String(day ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const iso = wallLocalToIso(`${m[1]}T${hm}:00`, tz);
  return iso ? Date.parse(iso) : null;
};
const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/** Termin dostarczenia dokumentu dla transportu (ta sama reguła co `doc_requirements_status`). */
export function docDueMs(load: Load, req: DocRequirement): number | null {
  const p = load.planDates;
  const off = req.offsetHours * H;
  switch (req.anchor) {
    case 'BEFORE_LOAD': {
      const t = ms(p?.loadFrom) ?? wall(load.plannedLoadDate, '06:00', TZ_LOAD_PL);
      return t === null ? null : t - off;
    }
    case 'AT_LOAD': {
      const t = ms(p?.loadTo) ?? ms(p?.loadFrom) ?? wall(load.plannedLoadDate, '18:00', TZ_LOAD_PL);
      return t === null ? null : t + off;
    }
    case 'BEFORE_FERRY': {
      const t = ms(load.ferry?.departureAt);
      return t === null ? null : t - off;
    }
    case 'AFTER_UNLOAD': {
      const t = ms(p?.deliveryTo) ?? ms(p?.deliveryFrom) ?? wall(load.plannedDeliverDate, '23:59', TZ_UNLOAD_SE);
      return t === null ? null : t + off;
    }
    default:
      return null;
  }
}

/** Stan wymagań per transport (tryb demo; produkcja: RPC). Dokumenty organizacyjne (ORG) pomijane. */
export function docStatusRows(loads: Load[], documents: Document[], reqs: DocRequirement[], nowMs: number): DocStatusRow[] {
  const have = new Set(
    documents.filter((d) => d.status === 'UPLOADED' || d.status === 'MISMATCH').map((d) => `${d.loadId}|${d.category}`),
  );
  const out: DocStatusRow[] = [];
  for (const r of reqs) {
    if (!r.required || r.anchor === 'ORG') continue;
    for (const l of loads) {
      const due = docDueMs(l, r);
      const ok = have.has(`${l.id}|${r.category}`);
      out.push({
        loadId: l.id, category: r.category, dueAt: due === null ? null : new Date(due).toISOString(),
        state: ok ? 'OK' : due !== null && due < nowMs ? 'OVERDUE' : 'MISSING',
      });
    }
  }
  return out;
}

/** Podsumowanie per kategoria: ile OK / po terminie / razem. */
export function docSummary(rows: DocStatusRow[]): Map<DocCategory, { ok: number; overdue: number; total: number }> {
  const m = new Map<DocCategory, { ok: number; overdue: number; total: number }>();
  for (const r of rows) {
    const s = m.get(r.category) ?? { ok: 0, overdue: 0, total: 0 };
    s.total += 1;
    if (r.state === 'OK') s.ok += 1;
    if (r.state === 'OVERDUE') s.overdue += 1;
    m.set(r.category, s);
  }
  return m;
}
