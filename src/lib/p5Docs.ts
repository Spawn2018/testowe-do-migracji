/**
 * wyglad/P5 — Dokumenty (E31, img/e31-after): czyste funkcje widoku.
 * Wymagania przy transporcie liczą tylko transporty, którym termin minął albo mija w ciągu 7 dni (nie „0 / 94”);
 * rysunku, POD i zdjęć mocowania nie ma na liście (19:11, 19:51). CMR nazywa się według terminu z bazy:
 * po rozładunku = „CMR z podpisem odbiorcy” (decyzja 1B; zmianę wymagania robi wykonawca).
 * Pliki: filtry tydzień / transport / rodzaj, kolumna „Widzą”. Bez zapisu i bez nowych zapytań.
 */
import type { DocCategory, Document, Load, OrgKind } from '../types';
import type { DocRequirement, DocResponsible, DocStatusRow } from './docRequirements';
import { loadWeekKey } from './docWeek';

export const DAY_MS = 86_400_000;

/** Wiersze tabeli wymagań: zezwolenia, CMR, polisa przewoźnika, Polisa HHL (decyzja 16.10, 13:58 · 2). */
export type ReqKey = 'PERMIT_PL' | 'PERMIT_SE' | 'CMR' | 'INSURANCE' | 'OCS';
export const REQ_KEYS: ReqKey[] = ['PERMIT_PL', 'PERMIT_SE', 'CMR', 'INSURANCE', 'OCS'];

/** Kto widzi który wiersz: KSH — polisa HHL, bez polisy przewoźnika; SCX — swoja polisa, bez polisy HHL (pytanie 3). */
export function reqVisible(key: ReqKey, role: OrgKind): boolean {
  if (key === 'INSURANCE') return role !== 'KSH';
  if (key === 'OCS') return role !== 'SCX';
  return true;
}

export const responsibleOrg = (r: DocResponsible): OrgKind => (r === 'CARRIER' ? 'SCX' : r === 'CLIENT' ? 'KSH' : 'HHL');

/** Decyzja właściciela 18.10, 17:28: tylko CMR po rozładunku (z podpisem odbiorcy) — niezależnie od kotwicy w bazie
    (stare wymaganie „przy załadunku” poprawia D-20261018-1740-01). Zostaje jako funkcja dla zgodności wywołań. */
export const cmrKind = (_req?: DocRequirement | null): 'SIGNED' => 'SIGNED';

export interface ReqCount { overdue: DocStatusRow[]; soon: DocStatusRow[] }

/** Po terminie i w ciągu 7 dni (bez terminu i bez braku — nie liczy się). */
export function reqCount(rows: readonly DocStatusRow[], category: DocCategory, nowMs: number): ReqCount {
  const overdue: DocStatusRow[] = [];
  const soon: DocStatusRow[] = [];
  for (const r of rows) {
    if (r.category !== category || r.state === 'OK') continue;
    if (r.state === 'OVERDUE') { overdue.push(r); continue; }
    const due = r.dueAt ? Date.parse(r.dueAt) : NaN;
    if (Number.isFinite(due) && due >= nowMs && due - nowMs <= 7 * DAY_MS) soon.push(r);
  }
  const byDue = (a: DocStatusRow, b: DocStatusRow) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '');
  return { overdue: overdue.sort(byDue), soon: soon.sort(byDue) };
}

/** Kody do pokazania i liczba wszystkich, gdy lista jest dłuższa niż `max` (wspólne dla tekstu i widoku). */
export function codesParts(codes: readonly string[], max = 6): { shown: string[]; total: number | null } {
  return codes.length <= max ? { shown: [...codes], total: null } : { shown: codes.slice(0, max), total: codes.length };
}

/** „SG-01, SG-03” albo „SG-01 – SG-21 (18)” przy długiej liście. */
export function codesText(codes: readonly string[], max = 6): string {
  const { shown, total } = codesParts(codes, max);
  return total == null ? shown.join(', ') : `${shown.join(', ')} … (${total})`;
}

/** Rodzaje do wyboru w oknie „Wgraj dokument”: najpierw braki tego transportu (po terminie, potem reszta). */
export interface KindOption { category: DocCategory; state: 'OVERDUE' | 'MISSING' | 'OK' | null }
export function kindOptions(loadId: string, rows: readonly DocStatusRow[], allowed: readonly DocCategory[]): KindOption[] {
  const st = new Map(rows.filter((r) => r.loadId === loadId).map((r) => [r.category, r.state]));
  const rank = (s: KindOption['state']) => (s === 'OVERDUE' ? 0 : s === 'MISSING' ? 1 : 2);
  return allowed
    .map((c) => ({ category: c, state: (st.get(c) ?? null) as KindOption['state'] }))
    .sort((a, b) => rank(a.state) - rank(b.state));
}

/** Transporty do wyboru: kod lub numer zlecenia (HHL / SCX) zawiera szukany tekst. */
export function searchLoads<T extends Pick<Load, 'code' | 'hhlOrderNo' | 'carrierOrderNo'>>(loads: readonly T[], q: string): T[] {
  const s = q.trim().toLocaleLowerCase('pl-PL');
  if (!s) return [...loads];
  return loads.filter((l) => [l.code, l.hhlOrderNo, l.carrierOrderNo].some((v) => (v ?? '').toLocaleLowerCase('pl-PL').includes(s)));
}

export interface FileFilter { week: string; loadId: string; category: DocCategory | '' }

/** Pliki z filtrami; plik bez transportu (polisa, zezwolenie „Firma”) przechodzi tylko bez filtra transportu i tygodnia. */
export function filterFiles(docs: readonly Document[], loads: readonly Load[], f: FileFilter): Document[] {
  const byId = new Map(loads.map((l) => [l.id, l]));
  return docs.filter((d) => {
    if (d.status !== 'UPLOADED' && d.status !== 'MISMATCH') return false;
    if (d.superseded) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.loadId && d.loadId !== f.loadId) return false;
    if (f.week) {
      const l = d.loadId ? byId.get(d.loadId) : undefined;
      if (!l || loadWeekKey(l) !== f.week) return false;
    }
    return true;
  });
}

/** Kolejność w kolumnie „Widzą”. */
export const seenBy = (v: readonly OrgKind[]): string => (['HHL', 'KSH', 'SCX'] as OrgKind[]).filter((o) => v.includes(o)).join(', ');
