/** #426 — import pliku KSH bez powiadomień (decyzja właściciela 22.10.2026 01:38): przełącznik tylko dla Administratora HHL. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I2_I18N } from '../src/i18n/i2';

const read = (p: string) => readFileSync(p, 'utf8');

describe('#426 import bez powiadomień', () => {
  it('RPC: p_quiet wysyłany tylko przy cichym imporcie', () => {
    const s = read('src/data/scheduleImportServer.ts');
    expect(s).toContain("...(quiet ? { p_quiet: true } : {})");
    expect(s).toMatch(/serverCommit\(d: ServerImportDraft, cancelCodes: string\[\], overwriteCodes: string\[\] = \[\], quiet = false\)/);
    expect(s).toContain('}, false, quiet);');
    /* podgląd (dry run) nigdy cichy; #590: p_file ze skipped_carrier_rows */
    expect(s).toMatch(/const preview = await call\(pid, rows, \[\], \{[\s\S]*?name: filename[\s\S]*?\}, true\);/);
    expect(s).toContain('skipped_carrier_rows: meta.skippedCarrierRows ?? []');
  });

  it('okno importu: przełącznik tylko dla HHL_ADMIN w trybie Supabase, reset przy nowym pliku', () => {
    const v = read('src/views/ScheduleView.tsx');
    expect(v).toContain("const canQuietImport = SERVER_IMPORT && accountRole(role) === 'HHL_ADMIN';");
    expect(v).toContain('{canQuietImport ? (');
    expect(v).toContain('data-import-quiet-toggle');
    expect(v).toContain('canQuietImport && quietImport,');
    /* F7 #432 r2 pkt 6: zmiany krytyczne po cichym zapisie jako wyciszone, nie „powiadomiono” */
    expect(v).toContain("canQuietImport && quietImport ? 'i426_crit_quiet' : 'i1_crit'");
    expect(v).toMatch(/setAllowRemovals\(false\);\n {4}setQuietImport\(false\);/);
  });

  it('teksty PL', () => {
    const pl = I2_I18N.pl;
    expect(pl.i426_quiet).toBe('Import bez powiadomień');
    expect(pl.i426_quiet_on).toContain('Nikt nie dostanie maila, dzwonka ani SMS');
    expect(pl.i426_quiet_off).toContain('Kto co dostaje');
    expect(pl.i426_crit_quiet).toContain('wyciszone');
  });
});
