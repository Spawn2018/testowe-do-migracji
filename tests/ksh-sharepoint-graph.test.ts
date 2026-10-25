import { describe, expect, it } from 'vitest';
import { pickSharePointMode, shareUrlToShareId } from '../src/lib/kshSharePointGraph';

describe('A6 SharePoint Graph helpers', () => {
  it('shareId: base64url bez paddingu, prefiks u!', () => {
    const id = shareUrlToShareId('https://example.sharepoint.com/:x:/g/demo');
    expect(id.startsWith('u!')).toBe(true);
    expect(id.includes('=')).toBe(false);
    expect(id.includes('/')).toBe(false);
    expect(id.includes('+')).toBe(false);
  });

  it('ten sam URL → ten sam shareId', () => {
    const u = 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/a.xlsx';
    expect(shareUrlToShareId(u)).toBe(shareUrlToShareId(u));
  });

  it('tryb pliku: test vs prod', () => {
    expect(pickSharePointMode('test')).toBe('test');
    expect(pickSharePointMode('TEST')).toBe('test');
    expect(pickSharePointMode(undefined)).toBe('prod');
    expect(pickSharePointMode('')).toBe('prod');
  });
});
