import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('B-4b: załącznik faktury = samo CMR', () => {
  it('Faktury: lista i wgrywanie tylko CMR', () => {
    const src = read('src/views/InvoicesView.tsx');
    expect(src).not.toMatch(/category === 'POD'/);
    expect(src).not.toMatch(/\? 'POD' : 'CMR'/);
    expect(src).toMatch(/attachDocumentFile\(f, attachLoadId, 'CMR'\)/);
  });
  it('Panel faktury: dokumenty tylko CMR', () => {
    const src = read('src/views/BillsPanel.tsx');
    expect(src).not.toMatch(/d\.category === 'POD'/);
  });
  it('etykiety PL bez POD', () => {
    expect(read('src/i18n/d19Extra.ts')).toMatch(/inv_attachments: 'Załączniki CMR',/);
    expect(read('src/i18n/etap4.ts')).toMatch(/bill_sub_ksh: 'PDF faktury i CMR/);
  });
});
