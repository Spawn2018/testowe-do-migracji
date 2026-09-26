/**
 * ANEKS 4 PR2 — ten sam potok co funkcja Edge backup-export (COPY → gzip → age X25519 + manifest),
 * uruchamiany na dowolnej bazie (BACKUP_SRC_DB_URL) do katalogu BACKUP_OUT — bez R2.
 * Wywołuje go tests/db/backup.sh (lokalnie i na projekcie TESTOWYM); samodzielnie pomijany.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Encrypter } from 'age-encryption';
import { BACKUP_TABLES, csvRowCount, dailyPrefix, manifest, sealTable } from '../supabase/functions/_shared/backup/core';

const SRC = process.env.BACKUP_SRC_DB_URL;
const OUT = process.env.BACKUP_OUT;
const RECIPIENT = process.env.BACKUP_AGE_RECIPIENT;

describe.skipIf(!SRC || !OUT || !RECIPIENT)('PR2 — eksport kopii (potok funkcji Edge, bez R2)', () => {
  it('każda tabela biznesowa → <tabela>.csv.gz.age + manifest.json.age', async () => {
    mkdirSync(OUT!, { recursive: true });
    const encrypt = async (plain: Uint8Array) => { const e = new Encrypter(); e.addRecipient(RECIPIENT!); return await e.encrypt(plain); };
    const counts: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      const csv = execFileSync('psql', [SRC!, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', `\\copy public.${t} to stdout with (format csv, header true)`], { maxBuffer: 1 << 28 });
      counts[t] = csvRowCount(csv.toString('utf8'));
      writeFileSync(join(OUT!, `${t}.csv.gz.age`), await sealTable(new Uint8Array(csv), encrypt));
    }
    const man = manifest(dailyPrefix(new Date()), RECIPIENT!, counts, []);
    writeFileSync(join(OUT!, 'manifest.json.age'), await encrypt(new TextEncoder().encode(JSON.stringify(man, null, 2))));
    writeFileSync(join(OUT!, 'counts.txt'), Object.entries(counts).map(([k, v]) => `${k} ${v}`).join('\n') + '\n');
    expect(Object.keys(counts)).toHaveLength(BACKUP_TABLES.length);
  }, 300_000);
});
