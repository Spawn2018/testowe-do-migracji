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

  it('3b: retencja nigdy nie kasuje obiektu pod blokadą R2 (docs/handover/r2/bucket-lock.json)', async () => {
    const { readFileSync } = await import('node:fs');
    const lock = JSON.parse(readFileSync('docs/handover/r2/bucket-lock.json', 'utf8')) as { rules: { prefix: string; condition: { maxAgeSeconds: number } }[] };
    const lockMs = (k: string) => (lock.rules.find((r) => k.startsWith(r.prefix))?.condition.maxAgeSeconds ?? 0) * 1000;
    const created = new Map<string, number>();
    let checked = 0;
    for (let t = Date.UTC(2026, 0, 1, 2, 30); t < Date.UTC(2028, 6, 1); t += 86_400_000) {
      const now = new Date(t);
      created.set(`daily/${now.toISOString().slice(0, 10)}/m.age`, t);
      if (now.getUTCDate() === 1) created.set(`monthly/${now.toISOString().slice(0, 7)}/m.age`, t);
      for (const k of retentionDeletes([...created.keys()], now)) {
        expect(t - created.get(k)!, k).toBeGreaterThanOrEqual(lockMs(k));
        created.delete(k); checked++;
      }
    }
    expect(checked).toBeGreaterThan(800);
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

describe('PR2 — zapis przez Worker (tylko dopisywanie)', async () => {
  const { writerClient, rerunPrefix } = await import('../supabase/functions/_shared/backup/core');
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (status: number) => (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('', { status }); }) as unknown as typeof fetch;
  it('PUT z nagłówkiem sekretu; 201 → CREATED, 409 → EXISTS, inny → błąd', async () => {
    expect(await writerClient('https://w.example/', 's3cret', fake(201))('daily/2026-09-27/a b.csv.gz.age', new Uint8Array([1]))).toBe('CREATED');
    expect(calls[0].url).toBe('https://w.example/daily/2026-09-27/a%20b.csv.gz.age');
    expect(calls[0].init.method).toBe('PUT');
    expect((calls[0].init.headers as Record<string, string>)['x-backup-secret']).toBe('s3cret');
    expect(await writerClient('https://w.example', 's', fake(409))('daily/x', new Uint8Array())).toBe('EXISTS');
    await expect(writerClient('https://w.example', 's', fake(401))('daily/x', new Uint8Array())).rejects.toThrow(/401/);
  });
  it('ponowny przebieg → katalog z godziną UTC', () => {
    expect(rerunPrefix('daily/2026-09-27/', new Date('2026-09-27T01:02:03Z'))).toBe('daily/2026-09-27-010203/');
  });
});
