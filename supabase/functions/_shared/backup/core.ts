/**
 * ANEKS 4 PR2 — kopie zapasowe: wspólna logika (Deno: funkcja Edge backup-export; Node: testy).
 * Bez importów zależnych od środowiska — szyfrowanie wstrzykiwane (age X25519, klucz publiczny).
 */

/**
 * I-2B — tabele w kopii wyliczane z KATALOGU bazy (schemat public, tabele zwykłe i partycjonowane,
 * bez obiektów rozszerzeń) minus jawna lista wyłączeń. Nowa tabela trafia do kopii automatycznie;
 * pominięcie wymaga świadomego wpisu w EXCLUDED_TABLES z uzasadnieniem.
 */
export const CATALOG_TABLES_SQL = `select c.relname::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e')
  order by 1`;

/** Wyłączenia (jawne, z powodem). */
export const EXCLUSION_REASONS = {
  positions: 'surowe pozycje GPS — dane osobowe, retencja 30 dni; zdarzenia biznesowe są w load_events',
  driver_tokens: 'skróty tokenów kierowców, ważne ≤ 14 dni — po odtworzeniu wydaje się nowe',
  spatial_ref_sys: 'tabela PostGIS (rozszerzenie)',
  account_relink_pending: 'stan przejściowy po odtworzeniu do nowego projektu (0045)',
  sms_outbox_secret: 'treść SMS z linkiem kierowcy (token) — tylko do chwili wysłania, potem kasowana (0069); w kopii sms_outbox.body bez linku',
} as const;
export const EXCLUDED_TABLES = Object.keys(EXCLUSION_REASONS) as readonly (keyof typeof EXCLUSION_REASONS)[];

/** Tabele, bez których kopia jest bezwartościowa — brak w katalogu = błąd przebiegu (np. zła baza). */
export const REQUIRED_TABLES = [
  'organizations', 'app_users', 'projects', 'loads', 'shipment_items', 'load_events', 'documents',
  'invoices', 'invoice_lines', 'schedule_imports', 'audit_log',
] as const;

/** Lista tabel do kopii: katalog − wyłączenia (posortowana, bez duplikatów, tylko bezpieczne nazwy). */
export function backupTables(catalog: readonly string[]): string[] {
  const excluded = new Set<string>(EXCLUDED_TABLES);
  const bad = catalog.filter((t) => !/^[a-z_][a-z0-9_]*$/.test(t));
  if (bad.length) throw new Error(`kopia: niedozwolone nazwy tabel w katalogu: ${bad.join(', ')}`);
  const tables = [...new Set(catalog)].filter((t) => !excluded.has(t)).sort();
  const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
  if (missing.length) throw new Error(`kopia: brak wymaganych tabel w katalogu: ${missing.join(', ')}`);
  return tables;
}

/**
 * I-2B — kubełki Storage kopiowane W CAŁOŚCI (przyrostowo, po created_at obiektu), niezależnie od tabeli documents.
 * harmonogramy: archiwum plików źródłowych importu (I-1, SCOPE 3.6) — ścieżki w schedule_imports.file_path.
 * Dokumenty (dokumenty/zdjecia/faktury) nadal przez tabelę documents (pomijane zarchiwizowane — PR7).
 */
export const BACKUP_BUCKETS = ['harmonogramy'] as const;
export const BUCKET_OBJECTS_SQL = `select o.id::text as id, o.bucket_id || '/' || o.name as storage_path from storage.objects o
  where o.bucket_id = any($1::text[]) and o.name not like '%/.emptyFolderPlaceholder'
    and o.created_at > coalesce($2::timestamptz, 'epoch') order by o.created_at`;

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
  files: { key: string; document_id?: string; object_id?: string; bytes: number; size?: number; sha256?: string }[];
  excluded: readonly string[];
  buckets?: readonly string[];
  note: string;
}

export function manifest(prefix: string, recipient: string, tables: Record<string, number>, files: Manifest['files'], at = new Date()): Manifest {
  return {
    created_at: at.toISOString(), prefix, recipient, tables, files, excluded: EXCLUDED_TABLES, buckets: BACKUP_BUCKETS,
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
