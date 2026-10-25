import { describe, expect, it } from 'vitest';
import { shouldSkipUnchangedImport } from '../src/lib/kshSharePointSkipUnchanged';

describe('A6 F7 — skip unchanged tylko po udanym przebiegu', () => {
  const hash = 'abc';

  it('po udanym dry_run + ten sam hash + import wyłączony → skip', () => {
    expect(shouldSkipUnchangedImport({
      prevHash: hash,
      hash,
      importEnabled: false,
      prevDryOnly: true,
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
