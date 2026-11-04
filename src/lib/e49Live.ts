/**
 * E49-b (DP-206): cache spraw „Objazd czy postój?” z RPC `e49_detour_cases_open`
 * — wypełniany przy odświeżeniu sklepu (supabaseProvider). Bez zapytań w renderze.
 */
import type { DetourCase, DetourDecision, DetourOption, HoldOption, NoDetour } from './e49Detour';

let liveCases: DetourCase[] = [];

export function setLiveDetourCases(cases: readonly DetourCase[]): void {
  liveCases = [...cases];
}

export function liveDetourCases(): readonly DetourCase[] {
  return liveCases;
}

type Row = {
  id: string;
  load_id: string;
  place: string;
  reason: string;
  reason_detail: string | null;
  source: string;
  notice_at: string;
  until_at: string | null;
  decide_by: string;
  payload: Record<string, unknown> | null;
  decision: Record<string, unknown> | null;
};

function asRisks(raw: unknown): HoldOption['risks'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as { kind?: string; level?: string; text?: string };
      if (!o.kind || !o.text) return null;
      const level = o.level === 'ok' ? 'ok' as const : 'warn' as const;
      return { kind: o.kind as HoldOption['risks'][number]['kind'], level, text: String(o.text) };
    })
    .filter((x): x is HoldOption['risks'][number] => !!x);
}

function mapHold(p: Record<string, unknown> | null | undefined, decideBy: string): HoldOption {
  const h = (p?.hold && typeof p.hold === 'object') ? p.hold as Record<string, unknown> : {};
  return {
    untilIso: h.untilIso != null ? String(h.untilIso) : null,
    etaIso: h.etaIso != null ? String(h.etaIso) : decideBy,
    addMin: Number(h.addMin ?? 0) || 0,
    risks: asRisks(h.risks),
  };
}

function mapDetour(p: Record<string, unknown> | null | undefined): DetourOption | NoDetour {
  const d = (p?.detour && typeof p.detour === 'object') ? p.detour as Record<string, unknown> : {};
  if (d.none === true) {
    return { none: true, why: String(d.why ?? 'Brak objazdu dla tego zestawu — tylko postój') };
  }
  const lineRaw = d.line;
  const line = Array.isArray(lineRaw)
    ? lineRaw
      .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2
        && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])))
      .map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number])
    : null;
  return {
    addKm: Number(d.addKm ?? 0) || 0,
    addMin: Number(d.addMin ?? 0) || 0,
    etaIso: String(d.etaIso ?? ''),
    via: String(d.via ?? 'objazd'),
    risks: asRisks(d.risks),
    line,
  };
}

export function detourCaseFromRow(row: Row): DetourCase | null {
  if (!row?.id || !row.load_id) return null;
  const reason = ['WIND', 'ACCIDENT', 'WORKS', 'OTHER'].includes(row.reason)
    ? row.reason as DetourCase['reason']
    : 'OTHER';
  const sourceOk = [
    'TRAFIKVERKET', 'HERE', 'EISMOINFO', 'LVC', 'TARKTEE', 'DIGITRAFFIC',
  ].includes(row.source);
  const decision = row.decision && typeof row.decision === 'object'
    ? {
        pick: (row.decision.pick === 'DETOUR' ? 'DETOUR' : 'HOLD') as DetourDecision['pick'],
        by: String(row.decision.by ?? ''),
        atIso: String(row.decision.atIso ?? ''),
        note: row.decision.note != null ? String(row.decision.note) : null,
      }
    : null;
  return {
    id: String(row.id),
    loadId: String(row.load_id),
    place: String(row.place ?? ''),
    reason,
    reasonDetail: row.reason_detail,
    source: (sourceOk ? row.source : 'HERE') as DetourCase['source'],
    noticeIso: String(row.notice_at),
    untilIso: row.until_at,
    decideByIso: String(row.decide_by),
    hold: mapHold(row.payload, String(row.decide_by)),
    detour: mapDetour(row.payload),
    decision,
  };
}
