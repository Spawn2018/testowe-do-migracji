import { describe, expect, it } from 'vitest';
import { shouldSkipUnchangedImport } from '../src/lib/kshSharePointSkipUnchanged';

describe('A6 F7 — skip unchanged tylko po udanym przebiegu', () => {
  const hash = 'abc';

  // #567 23B / etap A6: przy wyłączonym imporcie zawsze przeliczaj listę zmian.
  it('po udanym dry_run + ten sam hash + import wyłączony → NIE skip (lista 23B)', () => {
    expect(shouldSkipUnchangedImport({
      prevHash: hash,
      hash,
      importEnabled: false,
      prevDryOnly: true,
      sourceOk: true,
      lastError: null,
    })).toBe(false);
  });

  it('po udanym imporcie + ten sam hash + import włączony → skip', () => {
    expect(shouldSkipUnchangedImport({
      prevHash: hash,
      hash,
      importEnabled: true,
      prevDryOnly: false,
      sourceOk: true,
      lastError: null,
    })).toBe(true);
  });

  it('po błędzie importu (source_ok false / last_error) → NIE skip — ponów', () => {
    expect(shouldSkipUnchangedImport({
      prevHash: hash,
      hash,
      importEnabled: false,
      prevDryOnly: false,
      sourceOk: false,
      lastError: 'import:err',
    })).toBe(false);
    expect(shouldSkipUnchangedImport({
      prevHash: null, // failed_hash zamiast hash
      hash,
      importEnabled: false,
      prevDryOnly: false,
      sourceOk: false,
      lastError: 'import:err',
    })).toBe(false);
  });

  it('włączono import po samym dry_run → NIE skip', () => {
    expect(shouldSkipUnchangedImport({
      prevHash: hash,
      hash,
      importEnabled: true,
      prevDryOnly: true,
      sourceOk: true,
      lastError: null,
    })).toBe(false);
  });

  it('inny hash → NIE skip', () => {
    expect(shouldSkipUnchangedImport({
      prevHash: 'stary',
      hash,
      importEnabled: false,
      prevDryOnly: true,
      sourceOk: true,
      lastError: null,
    })).toBe(false);
  });
});
