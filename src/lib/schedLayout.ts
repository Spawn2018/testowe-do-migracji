/**
 * wyglad/P7-c — Harmonogram w układzie pliku KSH (E38 decyzja 1A, 08.10 12:50) i „Widok skrócony” = 8 kolumn E30;
 * filtry E30 pkt 3 (tydzień załadunku i dostawy, stan z liczbami); szerokości E20. Tu tylko obliczenia widoku —
 * bez zapisów. Układ kolumn zapisany w tej przeglądarce do czasu zapisu na koncie (E30 pkt 2, D-20261016-1020-01).
 */
import type { DocCategory, Load, RoleId } from '../types';
import type { DocRequirement, DocStatusRow } from './docRequirements';
import { isoWeekNumber } from './cockpitTiles';
import { fmtDate, fmtTime } from './time';

/* ── Kolumny ─────────────────────────────────────────────────────────────────────── */

/** Kolumny pliku KSH w kolejności z pliku (bez Lp., Przewoźnika i Komentarza), potem kolumny Watch Tower. */
export type FileColId =
  | 'type' | 'code' | 'dims' | 'elemWeight' | 'qty' | 'weight'
  | 'loadDate' | 'loadDay' | 'loadTime' | 'driver' | 'phone' | 'tractor' | 'trailer' | 'ordScx'
  | 'delivDate' | 'delivDay' | 'delivTime' | 'ordHhl'
  | 'status' | 'eta' | 'docs' | 'money';

export type FileColDef = { id: FileColId; key: string; group: 'file' | 'wt'; w: number; num?: boolean; fixed?: boolean };

export const FILE_COLS: readonly FileColDef[] = [
  { id: 'type', key: 's7_c_type', group: 'file', w: 118, fixed: true },
  { id: 'code', key: 's7_c_code', group: 'file', w: 92, fixed: true },
  { id: 'dims', key: 's7_c_dims', group: 'file', w: 150 },
  { id: 'elemWeight', key: 's7_c_elem', group: 'file', w: 100, num: true },
  { id: 'qty', key: 's7_c_qty', group: 'file', w: 54, num: true },
  { id: 'weight', key: 's7_c_weight', group: 'file', w: 68, num: true },
  { id: 'loadDate', key: 's7_c_load_date', group: 'file', w: 104 },
  { id: 'loadDay', key: 's7_c_day', group: 'file', w: 54 },
  { id: 'loadTime', key: 's7_c_time', group: 'file', w: 66 },
  { id: 'driver', key: 's7_c_driver', group: 'file', w: 160 },
  { id: 'phone', key: 's7_c_phone', group: 'file', w: 172 },
  { id: 'tractor', key: 's7_c_tractor', group: 'file', w: 168 },
  { id: 'trailer', key: 's7_c_trailer', group: 'file', w: 96 },
  { id: 'ordScx', key: 's7_c_ord_scx', group: 'file', w: 170 },
  { id: 'delivDate', key: 's7_c_deliv_date', group: 'file', w: 96 },
  { id: 'delivDay', key: 's7_c_day', group: 'file', w: 54 },
  { id: 'delivTime', key: 's7_c_time', group: 'file', w: 66 },
  { id: 'ordHhl', key: 's7_c_ord_hhl', group: 'file', w: 132 },
  { id: 'status', key: 's7_c_status', group: 'wt', w: 140, fixed: true },
  { id: 'eta', key: 's7_c_eta', group: 'wt', w: 100 },
  { id: 'docs', key: 's7_c_docs', group: 'wt', w: 170 },
  { id: 'money', key: 's7_c_money', group: 'wt', w: 250, num: true },
];

/** „Widok skrócony” — 8 kolumn E30 pkt 1 + „Telefon kierowcy” (właściciel 16.10, 13:58); „Kolumny” dodaje osobno numery, ciągnik, naczepę, rejs, koszt. */
export type ShortColId = 'transport' | 'cargo' | 'dates' | 'status' | 'crew' | 'phone' | 'eta' | 'docs' | 'money';
export type ShortExtraId = 'ordHhl' | 'ordScx' | 'tractor' | 'trailer' | 'sailing' | 'cost';

export const SHORT_COLS: readonly { id: ShortColId; key: string; num?: boolean }[] = [
  { id: 'transport', key: 's7_s_transport' },
  { id: 'cargo', key: 's7_s_cargo' },
  { id: 'dates', key: 's7_s_dates' },
  { id: 'status', key: 's7_c_status' },
  { id: 'crew', key: 's7_s_crew' },
  /* właściciel 16.10, 13:58: telefon kierowcy osobną kolumną w obu widokach (numer, nie ikonka) */
  { id: 'phone', key: 's7_c_phone' },
  { id: 'eta', key: 's7_c_eta' },
  { id: 'docs', key: 's7_c_docs' },
  { id: 'money', key: 's7_c_money', num: true },
];
export const SHORT_EXTRAS: readonly { id: ShortExtraId; key: string }[] = [
  { id: 'ordHhl', key: 's7_c_ord_hhl' },
  { id: 'ordScx', key: 's7_c_ord_scx' },
  { id: 'tractor', key: 's7_c_tractor' },
  { id: 'trailer', key: 's7_c_trailer' },
  { id: 'sailing', key: 's7_x_sailing' },
  { id: 'cost', key: 's7_x_cost' },
];

/** E41 1A: KSH bez kolumn numerów; koszt (stawka SCX) obok przychodu tylko u HHL (E16). */
export function fileColsFor(role: RoleId, hidden: readonly FileColId[]): FileColDef[] {
  return FILE_COLS.filter((c) => {
    if (role === 'KSH' && (c.id === 'ordScx' || c.id === 'ordHhl')) return false;
    return c.fixed || !hidden.includes(c.id);
  });
}

export function shortExtrasFor(role: RoleId): ShortExtraId[] {
  return SHORT_EXTRAS.map((x) => x.id).filter((id) => !(role === 'KSH' && (id === 'ordHhl' || id === 'ordScx')) && !(id === 'cost' && role !== 'HHL'));
}

/** Nazwa kolumny kwoty według firmy (E30 pkt 1, E16): HHL przychód, KSH „Twoja cena”, SCX „Moja stawka”. */
export function moneyKey(role: RoleId): string {
  return role === 'HHL' ? 's7_m_hhl' : role === 'KSH' ? 's7_m_ksh' : 's7_m_scx';
}

/* ── Układ na koncie (E30 pkt 2) ─────────────────────────────────────────────────── */

export type SchedLayout = { view: 'file' | 'short'; fileHidden: FileColId[]; shortExtras: ShortExtraId[] };
const KEY = 'watch-tower-schedule-v2';
export const DEFAULT_LAYOUT: SchedLayout = { view: 'file', fileHidden: [], shortExtras: [] };

export function loadSchedLayout(): SchedLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const p = JSON.parse(raw) as Partial<SchedLayout>;
    const fileIds = new Set<string>(FILE_COLS.filter((c) => !c.fixed).map((c) => c.id));
    const extraIds = new Set<string>(SHORT_EXTRAS.map((c) => c.id));
    return {
      view: p.view === 'short' ? 'short' : 'file',
      fileHidden: (p.fileHidden ?? []).filter((x) => fileIds.has(x)),
      shortExtras: (p.shortExtras ?? []).filter((x) => extraIds.has(x)),
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveSchedLayout(l: SchedLayout): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* tryb prywatny — układ do końca karty */ }
}

/* ── Daty ────────────────────────────────────────────────────────────────────────── */

const DAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];

/** „2026-10-05” → „05.10.2026” (rok zawsze — właściciel 16.10.2026); chwila ISO → dzień w strefie (domyślnie Polska). */
export function dmy(ymdOrIso: string | null | undefined, tz?: string): string {
  const v = (ymdOrIso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return '–';
  const out = fmtDate(v, tz);
  return out === '—' ? '–' : out;
}

/** Dzień tygodnia po polsku (plik ma „Monday”…, E21). */
export function dayPl(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  if (!m) return '–';
  return DAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
}

/** Godzina „08:05” z okna planu w strefie miejsca (załadunek — Polska, dostawa — Szwecja). */
export function hmIn(iso: string | null | undefined, tz: string): string {
  if (!iso) return '–';
  const out = fmtTime(iso, tz);
  return out === '—' ? '–' : out;
}

/** Dzisiejsza data w Polsce (RRRR-MM-DD). */
export function todayPl(nowIso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.parse(nowIso));
}

const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Tydzień pon–nd (jak E39): `offset` 0 = bieżący. */
export function weekOf(nowIso: string, offset = 0): { from: string; to: string; n: number } {
  const today = todayPl(nowIso);
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const from = addDays(today, -((dow + 6) % 7) + offset * 7);
  return { from, to: addDays(from, 6), n: isoWeekNumber(`${from}T12:00:00Z`) };
}

export type WeekPick = { id: string; label: string; from: string; to: string } | null;

/** Wybór tygodnia (E30 pkt 3): poprzedni, bieżący, bieżący i następny, następny. `null` = wszystkie. */
export function weekPicks(nowIso: string): NonNullable<WeekPick>[] {
  const p = weekOf(nowIso, -1);
  const c = weekOf(nowIso, 0);
  const n = weekOf(nowIso, 1);
  return [
    { id: `t${p.n}`, label: `t${p.n}`, from: p.from, to: p.to },
    { id: `t${c.n}`, label: `t${c.n}`, from: c.from, to: c.to },
    { id: `t${c.n}-t${n.n}`, label: `t${c.n}–t${n.n}`, from: c.from, to: n.to },
    { id: `t${n.n}`, label: `t${n.n}`, from: n.from, to: n.to },
  ];
}

export function inRange(ymd: string | null | undefined, r: { from: string; to: string } | null): boolean {
  if (!r) return true;
  const d = (ymd ?? '').slice(0, 10);
  if (!d) return false;
  return (!r.from || d >= r.from) && (!r.to || d <= r.to);
}

/* ── Komórki ─────────────────────────────────────────────────────────────────────── */

/** „A / B” z pliku: odcinek PL → odcinek SE (E6); brak drugiej części przy przepięciu = „?” (w pliku „...”). */
export function pair(a: string | null | undefined, b: string | null | undefined, swap: boolean): { a: string | null; b: string | null; missingB: boolean } {
  const pa = (a ?? '').trim() || null;
  const pb = (b ?? '').trim() || null;
  if (!swap) return { a: pa, b: null, missingB: false };
  return { a: pa, b: pb, missingB: !pb };
}

/** Status po rozładunku: „dostarczono”; na placu: „na placu”; przed wyjazdem „–” (E15). */
export function etaText(l: Pick<Load, 'status' | 'stage' | 'etaBoden' | 'etaPreLoad'>): 'done' | 'site' | 'none' | 'eta' {
  if (['DELIVERED', 'READY_TO_INVOICE', 'INVOICED'].includes(l.status) || l.stage === 'DELIVERED') return 'done';
  if (l.status === 'UNLOADING' || l.stage === 'SITE') return 'site';
  if (l.status === 'CANCELLED' || l.etaPreLoad || !l.etaBoden || l.stage === 'PLAN') return 'none';
  return 'eta';
}

const DOC_LABEL: Partial<Record<DocCategory, string>> = {
  CMR: 's7_d_CMR', PERMIT_PL: 's7_d_PERMIT_PL', PERMIT_SE: 's7_d_PERMIT_SE', DRAWING: 's7_d_DRAWING',
};
const WHO: Record<DocRequirement['responsible'], string> = { CARRIER: 's7_d_who_SCX', CLIENT: 's7_d_who_KSH', FORWARDER: 's7_d_who_HHL' };

export type DocCell =
  | { tone: 'bad'; keys: string[]; whoKey: string | null }
  | { tone: 'due'; keys: string[]; due: string }
  | { tone: 'ok' }
  | { tone: 'none' };

/**
 * Dokumenty (E31): po terminie — „brak: …” i kto wgrywa; przed terminem — „… do dd.mm.rrrr”; komplet; bez wymagań — „–”.
 * Stan wymagań ten sam co na stronie Dokumenty i w panelu (`doc_requirements_status`).
 */
export function docCell(rows: readonly DocStatusRow[], reqs: readonly DocRequirement[]): DocCell {
  if (!rows.length) return { tone: 'none' };
  const over = rows.filter((r) => r.state === 'OVERDUE' && DOC_LABEL[r.category]);
  if (over.length) {
    const req = reqs.find((q) => q.category === over[0].category);
    return { tone: 'bad', keys: over.map((r) => DOC_LABEL[r.category]!), whoKey: req ? WHO[req.responsible] : null };
  }
  const miss = rows.filter((r) => r.state === 'MISSING' && DOC_LABEL[r.category] && r.dueAt).sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1));
  if (miss.length) return { tone: 'due', keys: miss.slice(0, 2).map((r) => DOC_LABEL[r.category]!), due: miss[0].dueAt! };
  return rows.every((r) => r.state === 'OK') ? { tone: 'ok' } : { tone: 'none' };
}

/* ── Filtry stanu (E28 pkt 2 + E30 pkt 3 „Anulowane”) ───────────────────────────── */

export type Quick = 'all' | 'late' | 'nodocs' | 'nodriver' | 'notractor' | 'cancelled';
export const QUICKS: readonly Exclude<Quick, 'all'>[] = ['late', 'nodocs', 'nodriver', 'notractor', 'cancelled'];

export function quickMatch(l: Load, q: Quick): boolean {
  if (q === 'late') return l.delayed || l.status === 'DELAYED';
  if (q === 'nodocs') return l.docMissing || l.status === 'DOC_MISSING';
  if (q === 'nodriver') return !(l.resources.driverName ?? '').trim();
  if (q === 'notractor') return !(l.resources.tractorPlate ?? '').trim();
  if (q === 'cancelled') return l.status === 'CANCELLED';
  return true;
}

/** Nazwa pliku eksportu (E30 pkt 4): „Harmonogram_HHL_t40-t41_2026-10-08.xlsx”. */
export function exportName(role: RoleId, weekLabel: string | null, todayYmd: string, ext: 'xlsx' | 'pdf'): string {
  const w = weekLabel ? `_${weekLabel.replace('–', '-')}` : '';
  return `Harmonogram_${role}${w}_${todayYmd}.${ext}`;
}
