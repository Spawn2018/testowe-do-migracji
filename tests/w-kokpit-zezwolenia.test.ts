/* Właściciel 21.10.2026 20:14: Kokpit HHL „Zezwolenia 7 dni” pokazywał 0 z 10 mimo zezwoleń podpiętych automatycznie (D-1118). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Kokpit — Zezwolenia 7 dni', () => {
  it('liczy z load_permit_status (permitComplete), dokumenty PL+SE tylko bez danych z bazy', () => {
    const c = readFileSync(new URL('../src/lib/cockpitE9.ts', import.meta.url), 'utf8');
    expect(c).toMatch(/l\.permitComplete != null\s*\?\s*l\.permitComplete/);
    const p = readFileSync(new URL('../src/data/supabaseProvider.ts', import.meta.url), 'utf8');
    expect(p).toContain("p.permits_linked > 0 && p.ok === true && (p.missing_countries ?? []).length === 0");
    expect(p).toContain('permitComplete: permitDone.get(l.id) ?? null');
  });
});
