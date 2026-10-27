/**
 * W-567 (decyzja 23B) — lista zmian z pliku harmonogramu KSH do przejrzenia przed włączeniem importu.
 * Źródło: RPC `ksh_sync_preview_get()` (PR #577): dla każdego transportu i pola — wartość w Watch Tower i w pliku,
 * znacznik `manual_after_import` (pole poprawione ręcznie po ostatnim imporcie) i opcjonalnie `pending_write`
 * (pole czeka na zapis do pliku — nie zostanie nadpisane). Czyste funkcje widoku: odczyt, grupowanie, liczniki, format.
 */
import { fmtDate, fmtDateTime, fmtTime, formatCalendarDay } from './time';

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

/**
 * Wartość do porównania WT ↔ plik — ściśle, jak import (`is distinct from`, bez zmiany wielkości liter i spacji);
 * jedyna normalizacja: brak = pusty tekst (serwer i tak zwraca `nullif(…, '')`). Inaczej panel ukryłby zmianę,
 * którą import zapisze (np. `0035/10/s/2026` w pliku).
 */
export function sameValueKey(v: string | null | undefined): string {
  return v ?? '';
}

/**
 * #583 — „zmiana” z tą samą wartością w Watch Tower i w pliku nie jest zmianą (np. numer HHL–KSH 0035/10/S/2026
 * po obu stronach). Osłona ekranu niezależna od poprawki po stronie bazy.
 */
export function isNoopChange(c: Pick<KshPreviewChange, 'kind' | 'wt' | 'file'>): boolean {
  return c.kind === 'changed' && sameValueKey(c.wt) === sameValueKey(c.file);
}

/** Odpowiedź RPC → model widoku; null — brak danych (konto spoza HHL albo niepoprawny kształt). */
export function kshPreviewFromRpc(raw: unknown): KshPreview | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.changes)) return null;
  const changes: KshPreviewChange[] = [];
  let dropped = 0;
  for (const c of o.changes) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    const code = str(r.code);
    const kind: KshPreviewKind = r.kind === 'added' || r.kind === 'missing' ? r.kind : 'changed';
    const field = str(r.field) ?? '';
    if (!code || (kind === 'changed' && !field)) continue;
    if (isNoopChange({ kind, wt: str(r.wt), file: str(r.file) })) {
      dropped += 1;
      continue;
    }
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
    n: dropped > 0 || !Number.isFinite(n) ? changes.length : n,
    changes,
  };
}

/**
 * Błąd „funkcji nie ma w bazie” (baza bez PR #577) — panel się chowa, bez komunikatu.
 * Rozpoznanie po kodzie PostgREST `PGRST202`; zapasowo po komunikacie „Could not find the function”.
 * Inne błędy (np. „permission denied for function ksh_sync_preview_get”) dają komunikat w panelu.
 */
export function isMissingRpc(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === 'PGRST202') return true;
  return /Could not find the function/i.test(err.message ?? '');
}

const RE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_TIME = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const RE_STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Wartość komórki: pusta → „—”; dzień `RRRR-MM-DD` → `DD.MM.RRRR`; godzina `GG:MM[:SS]` → `GG:MM`;
 * znacznik czasu ISO ze strefą → `DD.MM.RRRR, GG:MM` (Europe/Warsaw), bez strefy — godzina ścienna bez przesunięcia.
 * Nazwa pola zawęża wynik: `*_date` → sama data, `*_time` → sama godzina. Inne wartości bez zmian.
 */
export function previewValue(v: string | null | undefined, field?: string | null): string {
  const s = v == null ? '' : String(v).trim();
  if (s === '') return '—';
  const f = (field ?? '').toLowerCase();
  const isDateField = /(^|_)date$/.test(f);
  const isTimeField = /(^|_)time$/.test(f);
  if (RE_DAY.test(s)) return formatCalendarDay(s);
  const tm = s.match(RE_TIME);
  if (tm) return `${tm[1].padStart(2, '0')}:${tm[2]}`;
  const st = s.match(RE_STAMP);
  if (st) {
    if (st[6]) {
      if (isDateField) return fmtDate(s);
      if (isTimeField) return fmtTime(s);
      return fmtDateTime(s);
    }
    const day = `${st[3]}.${st[2]}.${st[1]}`;
    const hm = `${st[4]}:${st[5]}`;
    if (isDateField) return day;
    if (isTimeField) return hm;
    return `${day}, ${hm}`;
  }
  return s;
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
