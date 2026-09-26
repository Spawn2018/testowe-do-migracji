import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Encrypter } from 'age-encryption';
import { BACKUP_TABLES, EXCLUDED_TABLES, csvRowCount, gzip, retentionDeletes, sealTable } from '../supabase/functions/_shared/backup/core';

const hasAge = (() => { try { execFileSync('age', ['--version']); return true; } catch { return false; } })();

describe('ANEKS 4 PR2 — logika kopii', () => {
  it('surowe pozycje GPS i tokeny poza kopią; load_events (zdarzenia biznesowe) w kopii', () => {
    expect(BACKUP_TABLES).not.toContain('positions' as never);
    expect(EXCLUDED_TABLES).toContain('positions');
    expect(BACKUP_TABLES).toContain('load_events');
    expect(new Set(BACKUP_TABLES).size).toBe(BACKUP_TABLES.length);
  });

  it('liczba wierszy CSV z nagłówkiem, także z nową linią w polu', () => {
    expect(csvRowCount('a,b\n1,2\n3,"x\ny"\n')).toBe(2);
    expect(csvRowCount('a,b\n')).toBe(0);
    expect(csvRowCount('')).toBe(0);
  });

  it('retencja: dzienne > 30 dni i miesięczne ≥ 12 miesięcy do usunięcia; pliki zostają', () => {
    const today = new Date('2026-09-26T01:00:00Z');
    const del = retentionDeletes([
      'daily/2026-09-26/loads.csv.gz.age', 'daily/2026-08-27/loads.csv.gz.age', 'daily/2026-08-26/loads.csv.gz.age',
      'monthly/2025-10/loads.csv.gz.age', 'monthly/2025-09/loads.csv.gz.age', 'files/dokumenty/p/l/d/a.pdf.age',
    ], today);
    expect(del).toEqual(['daily/2026-08-26/loads.csv.gz.age', 'monthly/2025-09/loads.csv.gz.age']);
  });

  it.skipIf(!hasAge)('format zgodny z restore.sh: JS gzip + age (X25519) → `age -d | gunzip`; zły klucz odrzucony', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wt-age-'));
    try {
    execFileSync('age-keygen', ['-o', join(dir, 'k.txt')], { stdio: 'ignore' });
    const recipient = execFileSync('age-keygen', ['-y', join(dir, 'k.txt')]).toString().trim();
    expect(recipient).toMatch(/^age1[0-9a-z]+$/);
    const csv = 'id,order_no\n1,"KSH/1"\n2,"Zażółć gęślą jaźń"\n';
    const sealed = await sealTable(new TextEncoder().encode(csv), async (p) => { const e = new Encrypter(); e.addRecipient(recipient); return await e.encrypt(p); });
    expect(Buffer.from(sealed).includes(Buffer.from('KSH/1'))).toBe(false);
    writeFileSync(join(dir, 't.csv.gz.age'), sealed);
    const out = execFileSync('bash', ['-c', `age -d -i ${dir}/k.txt ${dir}/t.csv.gz.age | gunzip`]).toString();
    expect(out).toBe(csv);
    execFileSync('age-keygen', ['-o', join(dir, 'zly.txt')], { stdio: 'ignore' });
    expect(() => execFileSync('age', ['-d', '-i', join(dir, 'zly.txt'), join(dir, 't.csv.gz.age')], { stdio: 'pipe' })).toThrow();
    expect((await gzip(new Uint8Array(10_000))).byteLength).toBeLessThan(200);
    } finally {
      rmSync(dir, { recursive: true, force: true });   // klucze testowe nie zostają na dysku
    }
  });
});
