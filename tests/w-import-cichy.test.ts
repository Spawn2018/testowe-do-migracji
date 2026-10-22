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
    /* podgląd (dry run) nigdy cichy */
    expect(s).toContain("const preview = await call(pid, rows, [], { name: filename }, true);");
  });

  it('okno importu: przełącznik tylko dla HHL_ADMIN w trybie Supabase, reset przy nowym pliku', () => {
    const v = read('src/views/ScheduleView.tsx');
    expect(v).toContain("const canQuietImport = SERVER_IMPORT && accountRole(role) === 'HHL_ADMIN';");
    expect(v).toContain('{canQuietImport ? (');
    expect(v).toContain('data-import-quiet-toggle');
    expect(v).toContain('canQuietImport && quietImport,');
    expect(v).toMatch(/setAllowRemovals\(false\);\n {4}setQuietImport\(false\);/);
  });

  it('teksty PL', () => {
    const pl = I2_I18N.pl;
    expect(pl.i426_quiet).toBe('Import bez powiadomień');
    expect(pl.i426_quiet_on).toContain('Nikt nie dostanie maila, dzwonka ani SMS');
    expect(pl.i426_quiet_off).toContain('Kto co dostaje');
  });
});
