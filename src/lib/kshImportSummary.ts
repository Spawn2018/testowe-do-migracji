/**
 * #594 B1 (właściciel 27.10, 14:55) — zbiorcze powiadomienie po imporcie pliku KSH i okno ze szczegółami.
 * Baza (#601): w dzwonku jedno, najnowsze powiadomienie `KSH_IMPORT_SUMMARY` na konto (HHL, SCX, KSH);
 * payload niesie `summary_id`, okno pobiera migawkę zmian RPC `ksh_import_summary_get(p_id)` — już przefiltrowaną
 * wg roli w bazie. Kształt wierszy jak w `ksh_sync_preview_get` (W-567), więc model i lista są wspólne.
 */
import { kshPreviewFromRpc, previewCounts, type KshPreviewChange, type KshPreviewCounts } from './kshPreviewView';

export const KSH_IMPORT_SUMMARY = 'KSH_IMPORT_SUMMARY';

export interface KshImportSummary {
  id: string;
  importedAt: string | null;
  fileName: string | null;
  changes: KshPreviewChange[];
  /** liczniki z widocznych wierszy (po filtrze roli w bazie), nie z całego importu */
  counts: KshPreviewCounts;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** Odpowiedź `ksh_import_summary_get` → model okna; null — migawka niedostępna (brak, retencja, brak uprawnień). */
export function kshImportSummaryFromRpc(raw: unknown): KshImportSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  const base = kshPreviewFromRpc({ changes: o.changes, n: o.n });
  if (!id || !base) return null;
  return {
    id,
    importedAt: str(o.imported_at),
    fileName: str(o.file_name),
    changes: base.changes,
    counts: previewCounts(base.changes),
  };
}

/** `summary_id` z payloadu powiadomienia (tylko szablon KSH_IMPORT_SUMMARY). */
export function summaryIdOf(template: string | null | undefined, payload: Record<string, unknown> | null | undefined): string | undefined {
  if (template !== KSH_IMPORT_SUMMARY || !payload) return undefined;
  return str(payload.summary_id) ?? undefined;
}

/**
 * Tytuł i treść w dzwonku (dzwonek tylko po polsku — decyzja 8A, 17.10). Powiadomienie jest wyłącznie IN_APP,
 * więc tekst powstaje tu, a nie w szablonach e-maili (`notifyTemplates.ts`, spis wiadomości w Opcjach).
 * Czas importu w Europe/Warsaw; liczby z payloadu (#601).
 */
export function importSummaryNotice(p: Record<string, unknown>): { subject: string; body: string } {
  const at = Date.parse(String(p.imported_at ?? ''));
  const when = Number.isFinite(at)
    ? new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      .format(new Date(at)).replace(/,?\s+/, ', ')
    : '';
  const keys = ['transports', 'fields', 'added', 'cancelled'] as const;
  const has = keys.some((k) => p[k] != null && Number.isFinite(Number(p[k])));
  const n = (k: string) => (Number.isFinite(Number(p[k])) ? Number(p[k]) : 0);
  return {
    subject: `Zmiany z pliku KSH${when ? ` — ${when}` : ''}`,
    /* bez liczb w payloadzie (np. liczone dopiero w oknie wg roli) — zdanie zamiast „0” */
    body: has
      ? `Transporty: ${n('transports')} · pola: ${n('fields')} · nowe: ${n('added')} · anulowane/usunięte: ${n('cancelled')}`
      : 'Otwórz, aby zobaczyć zmiany z ostatniego importu.',
  };
}
