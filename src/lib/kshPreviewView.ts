/**
 * W-567 (decyzja 23B) — lista zmian z pliku harmonogramu KSH do przejrzenia przed włączeniem importu.
 * Źródło: RPC `ksh_sync_preview_get()` (PR #577): dla każdego transportu i pola — wartość w Watch Tower i w pliku,
 * znacznik `manual_after_import` (pole poprawione ręcznie po ostatnim imporcie) i opcjonalnie `pending_write`
 * (pole czeka na zapis do pliku — nie zostanie nadpisane). Czyste funkcje widoku: odczyt, grupowanie, liczniki, format.
 */
import { fmtDateTime } from './time';

/** `changed` — różnica pola; `added` — kod w pliku, brak w Watch Tower; `missing` — kod w Watch Tower, brak w pliku. */
export type KshPreviewKind = 'changed' | 'added' | 'missing';

export interface KshPreviewChange {
  kind: KshPreviewKind;
  code: string;
  loadId: string | null;
  field: string;
  fieldLabel: string;
  wt: string | null;
  file: string | null;
  manualAfterImport: boolean;
  pendingWrite: boolean;
}

export interface KshPreview {
  readAt: string | null;
  bytes: number;
  hash: string;
  n: number;
  changes: KshPreviewChange[];
}

export interface KshPreviewGroup {
  code: string;
  loadId: string | null;
  rows: KshPreviewChange[];
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : v == null ? null : String(v));

/** Odpowiedź RPC → model widoku; null — brak danych (konto spoza HHL albo niepoprawny kształt). */
export function kshPreviewFromRpc(raw: unknown): KshPreview | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.changes)) return null;
  const changes: KshPreviewChange[] = [];
  for (const c of o.changes) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    const code = str(r.code);
    const kind: KshPreviewKind = r.kind === 'added' || r.kind === 'missing' ? r.kind : 'changed';
    const field = str(r.field) ?? '';
    if (!code || (kind === 'changed' && !field)) continue;
    changes.push({
      kind,
      code,
      loadId: str(r.load_id),
      field,
      fieldLabel: str(r.field_label) || field,
      wt: str(r.wt),
      file: str(r.file),
      manualAfterImport: r.manual_after_import === true,
      pendingWrite: r.pending_write === true,
    });
  }
  const n = Number(o.n);
  return {
    readAt: typeof o.read_at === 'string' ? o.read_at : null,
    bytes: Number.isFinite(Number(o.bytes)) ? Number(o.bytes) : 0,
    hash: typeof o.hash === 'string' ? o.hash : '',
    n: Number.isFinite(n) ? n : changes.length,
    changes,
  };
}

/** Błąd „funkcji nie ma w bazie” (baza bez PR #577) — panel się nie pokazuje, bez komunikatu. */
export function isMissingRpc(message: string | null | undefined): boolean {
  return /ksh_sync_preview_get|PGRST202|schema cache|Could not find the function/i.test(message ?? '');
}

/** Pusta wartość jako „—”. */
export function previewValue(v: string | null | undefined): string {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? '—' : s;
}

/** Porównanie kodów „naturalnie” (SG-7 przed SG-10). */
const cmp = (a: string, b: string) => a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' });

/**
 * Grupy po kodzie transportu (kod raz, potem jego pola). Kolejność: kody naturalnie, w grupie pola w kolejności
 * z RPC (kolejność kolumn pliku), a przy braku — po etykiecie. `onlyManual` — tylko pola poprawione ręcznie.
 */
export function groupPreview(changes: readonly KshPreviewChange[], onlyManual = false): KshPreviewGroup[] {
  const map = new Map<string, KshPreviewGroup>();
  changes.forEach((c) => {
    if (c.kind !== 'changed') return;
    if (onlyManual && !c.manualAfterImport) return;
    let g = map.get(c.code);
    if (!g) { g = { code: c.code, loadId: c.loadId, rows: [] }; map.set(c.code, g); }
    if (!g.loadId && c.loadId) g.loadId = c.loadId;
    g.rows.push(c);
  });
  return [...map.values()].sort((a, b) => cmp(a.code, b.code));
}

/** Kody transportów nowych w pliku (`added`) albo brakujących w pliku (`missing`) — bez powtórzeń, naturalnie. */
export function previewKindCodes(changes: readonly KshPreviewChange[], kind: Exclude<KshPreviewKind, 'changed'>): Array<{ code: string; loadId: string | null }> {
  const map = new Map<string, string | null>();
  changes.forEach((c) => {
    if (c.kind !== kind) return;
    if (!map.has(c.code) || (!map.get(c.code) && c.loadId)) map.set(c.code, c.loadId);
  });
  return [...map.entries()].map(([code, loadId]) => ({ code, loadId })).sort((a, b) => cmp(a.code, b.code));
}

/** Liczniki: `transports`/`fields`/`manual`/`pending` tylko dla zmian pól; `added`/`missing` — kody osobno. */
export interface KshPreviewCounts {
  transports: number;
  fields: number;
  manual: number;
  pending: number;
  added: number;
  missing: number;
}

export function previewCounts(changes: readonly KshPreviewChange[]): KshPreviewCounts {
  const ch = changes.filter((c) => c.kind === 'changed');
  return {
    transports: new Set(ch.map((c) => c.code)).size,
    fields: ch.length,
    manual: ch.filter((c) => c.manualAfterImport).length,
    pending: ch.filter((c) => c.pendingWrite).length,
    added: previewKindCodes(changes, 'added').length,
    missing: previewKindCodes(changes, 'missing').length,
  };
}

/** Liczba w tytule panelu: pola do przejrzenia + nowe + brakujące kody. */
export function previewTotal(c: KshPreviewCounts): number {
  return c.fields + c.added + c.missing;
}

/** Znaczniki w kolumnie „Uwagi” (klucze tekstów). */
export function previewNotes(c: KshPreviewChange): Array<'manual' | 'pending'> {
  const out: Array<'manual' | 'pending'> = [];
  if (c.manualAfterImport) out.push('manual');
  if (c.pendingWrite) out.push('pending');
  return out;
}

/** Czas odczytu pliku „DD.MM.RRRR, GG:MM” (Europe/Warsaw, ta sama postać co linia „Plik KSH: …”); brak — „—”. */
export function previewReadAt(iso: string | null | undefined): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—';
  return fmtDateTime(iso);
}
