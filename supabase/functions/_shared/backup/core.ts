/**
 * ANEKS 4 PR2 — kopie zapasowe: wspólna logika (Deno: funkcja Edge backup-export; Node: testy).
 * Bez importów zależnych od środowiska — szyfrowanie wstrzykiwane (age X25519, klucz publiczny).
 */

/** Tabele biznesowe w kopii. Surowe pozycje GPS pomijane (dane osobowe, retencja 30 dni) —
 *  zdarzenia biznesowe są w load_events. Tokeny kierowców (skróty, ważne ≤ 14 dni) pomijane. */
export const BACKUP_TABLES = [
  'organizations', 'app_users', 'user_preferences', 'user_invites', 'projects', 'vessels', 'sailings',
  'loads', 'shipment_items', 'load_cost', 'load_revenue', 'load_events', 'load_messages', 'load_permits',
  'permits', 'insurance_policies', 'documents', 'invoices', 'invoice_lines', 'invoice_documents',
  'payment_terms', 'rate_cards', 'rate_rules', 'baf_definitions', 'baf_index_values', 'fx_rates',
  'geofences', 'geofence_states', 'risk_signals', 'notifications', 'workflows', 'workflow_runs',
  'schedule_imports', 'integration_runs', 'audit_log', 'system_heartbeat', 'backup_runs', 'usage_history',
] as const;
// account_relink_pending (0045): stan przejściowy po odtworzeniu do nowego projektu — nie należy do kopii.
export const EXCLUDED_TABLES = ['positions', 'driver_tokens', 'spatial_ref_sys', 'account_relink_pending'] as const;

export type Encrypt = (plain: Uint8Array) => Promise<Uint8Array>;

export async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** CSV → gzip → age: dokładnie ten format odczytuje scripts/restore.sh (`age -d | gunzip`). */
export async function sealTable(csv: Uint8Array, encrypt: Encrypt): Promise<Uint8Array> {
  return encrypt(await gzip(csv));
}

export const dailyPrefix = (d: Date) => `daily/${d.toISOString().slice(0, 10)}/`;
export const monthlyPrefix = (d: Date) => `monthly/${d.toISOString().slice(0, 7)}/`;

/** Liczba wierszy CSV z nagłówkiem (pola w cudzysłowach mogą zawierać nowe linie). */
export function csvRowCount(csv: string): number {
  let rows = 0, inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') inQ = !inQ;
    else if (c === '\n' && !inQ) rows++;
  }
  if (csv.length && csv[csv.length - 1] !== '\n') rows++;
  return Math.max(0, rows - 1);
}

/**
 * Retencja w R2: kopie dzienne 30 dni, miesięczne 12 miesięcy. Pliki (documents/…) nie wygasają
 * razem z kopią dzienną — są przyrostowe i potrzebne do każdego odtworzenia.
 * Zwraca klucze do usunięcia.
 */
export function retentionDeletes(keys: string[], today: Date): string[] {
  const dayMs = 86_400_000;
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const monthIdx = today.getUTCFullYear() * 12 + today.getUTCMonth();
  return keys.filter((k) => {
    const d = /^daily\/(\d{4})-(\d{2})-(\d{2})\//.exec(k);
    if (d) return (t0 - Date.UTC(+d[1], +d[2] - 1, +d[3])) / dayMs > 30;
    const m = /^monthly\/(\d{4})-(\d{2})\//.exec(k);
    if (m) return monthIdx - (+m[1] * 12 + (+m[2] - 1)) >= 12;
    return false;
  });
}

export interface Manifest {
  created_at: string;
  prefix: string;
  recipient: string;
  tables: Record<string, number>;
  /** bytes = rozmiar zaszyfrowanego obiektu; size i sha256 = plik PRZED szyfrowaniem (kontrola po odtworzeniu). */
  files: { key: string; document_id: string; bytes: number; size?: number; sha256?: string }[];
  excluded: readonly string[];
  note: string;
}

export function manifest(prefix: string, recipient: string, tables: Record<string, number>, files: Manifest['files'], at = new Date()): Manifest {
  return {
    created_at: at.toISOString(), prefix, recipient, tables, files, excluded: EXCLUDED_TABLES,
    note: 'CSV (nagłówek) → gzip → age X25519. Odtworzenie: scripts/restore.sh. Utrata danych w najgorszym razie: do 24 h.',
  };
}

/**
 * PR2 (27.09) — zapis przez Worker tower-backup-writer (wiązanie R2, tylko dopisywanie): PUT + X-Backup-Secret.
 * 201 → CREATED, 409 → EXISTS (nadpisanie zabronione), inne → błąd. Bez klucza R2, bez S3, bez LIST/DELETE.
 */
export type WriterPut = (key: string, body: Uint8Array) => Promise<'CREATED' | 'EXISTS'>;
export function writerClient(url: string, secret: string, fetchFn: typeof fetch = fetch): WriterPut {
  const base = url.replace(/\/+$/, '');
  return async (key, body) => {
    const res = await fetchFn(`${base}/${key.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT', body, headers: { 'x-backup-secret': secret, 'content-type': 'application/octet-stream' },
    });
    if (res.status === 201) return 'CREATED';
    if (res.status === 409) return 'EXISTS';
    throw new Error(`Worker PUT ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  };
}

/** Drugi przebieg tego samego dnia/miesiąca (klucze już są, nadpisanie zabronione) → osobny katalog z godziną UTC. */
export const rerunPrefix = (prefix: string, d: Date) => `${prefix.replace(/\/$/, '')}-${d.toISOString().slice(11, 19).replace(/:/g, '')}/`;

/** PR2-B — SHA-256 (hex) pliku przed szyfrowaniem; restore-files.sh porównuje po odszyfrowaniu. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
