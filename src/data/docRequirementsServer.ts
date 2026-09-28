/**
 * III-6 — wymagalność dokumentów w trybie Supabase (chunk leniwy; paczka demo go nie zawiera).
 * Odczyt: `doc_requirements` (RLS: aktywne konto) + `doc_requirements_status()` (security invoker — tylko
 * transporty widoczne dla konta). Zapis: `doc_requirement_set` (wyłącznie HHL, audit_log).
 */
import { getSupabase } from '../auth/client';
import { DOC_CAT_TO_DB } from './mappers';
import type { DocCategory } from '../types';
import type { DocAnchor, DocRequirement, DocResponsible, DocState, DocStatusRow } from '../lib/docRequirements';

const PROJECT_CODE = 'STEGRA_BODEN';
const FROM_DB = new Map(Object.entries(DOC_CAT_TO_DB).map(([app, db]) => [db, app as DocCategory]));

interface ReqRow { category: string; required: boolean; responsible: string; anchor: string; offset_hours: number }
interface StatusRow { load_id: string; category: string; due_at: string | null; state: string }

export interface ServerDocRequirements { projectId: string; reqs: DocRequirement[]; status: DocStatusRow[] }

export async function loadDocRequirements(): Promise<ServerDocRequirements> {
  const sb = await getSupabase();
  const p = await sb.from('projects').select('id').eq('code', PROJECT_CODE).maybeSingle();
  if (p.error) throw new Error(p.error.message);
  const projectId = (p.data as { id: string } | null)?.id;
  if (!projectId) throw new Error('Brak projektu w bazie');
  const [r, s] = await Promise.all([
    sb.from('doc_requirements').select('category,required,responsible,anchor,offset_hours').eq('project_id', projectId),
    sb.rpc('doc_requirements_status', { p_project: projectId }),
  ]);
  if (r.error) throw new Error(r.error.message);
  if (s.error) throw new Error(s.error.message);
  const reqs = ((r.data ?? []) as ReqRow[]).flatMap((x) => {
    const category = FROM_DB.get(x.category);
    return category ? [{ category, required: x.required, responsible: x.responsible as DocResponsible, anchor: x.anchor as DocAnchor, offsetHours: x.offset_hours }] : [];
  });
  const status = ((s.data ?? []) as StatusRow[]).flatMap((x) => {
    const category = FROM_DB.get(x.category);
    return category ? [{ loadId: x.load_id, category, dueAt: x.due_at, state: x.state as DocState }] : [];
  });
  return { projectId, reqs, status };
}

export async function saveDocRequirement(projectId: string, r: DocRequirement): Promise<void> {
  const sb = await getSupabase();
  const res = await sb.rpc('doc_requirement_set', {
    p_project: projectId, p_category: DOC_CAT_TO_DB[r.category], p_required: r.required,
    p_responsible: r.responsible, p_anchor: r.anchor, p_offset_hours: r.offsetHours,
  });
  if (res.error) throw new Error(res.error.message);
}
