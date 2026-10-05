import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('0182 insurance auto-attach', () => {
  it('migration defines load_insurance_cover', () => {
    const sql = readFileSync('supabase/migrations/0182_insurance_auto_attach.sql', 'utf8');
    expect(sql).toMatch(/load_insurance_cover/);
    expect(sql).toMatch(/approval_status = 'APPROVED'/);
    expect(sql).toMatch(/security definer/i);
  });
  it('DocsView uses insuranceCover for INSURANCE row', () => {
    const src = readFileSync('src/views/DocsView.tsx', 'utf8');
    expect(src).toMatch(/c\.key === 'INSURANCE' && insuranceCover/);
    expect(src).toMatch(/loadInsuranceCover/);
  });
  it('LoadDrawer shows auto note', () => {
    const src = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(src).toMatch(/data-ins-auto/);
    expect(src).toMatch(/b32_ins_auto/);
  });
});
