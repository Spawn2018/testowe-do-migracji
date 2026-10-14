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
    /* przepisane w wyglad/P5 (E31): wiersz „Polisa OCP przewoźnika” — liczba transportów z ważną polisą z insuranceCover */
    expect(src).toMatch(/key === 'INSURANCE' && insuranceCover/);
    expect(src).toMatch(/loadInsuranceCover/);
  });
  /* przepisane w wyglad/P5 (E31 pkt 5): polisa przewoźnika w zakładce „Dokumenty” jako wiersz z numerem i ważnością (podpięta sama) */
  it('LoadDrawer shows auto-attached policy in the Documents tab', () => {
    const src = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(src).toMatch(/insAuto=\{insAuto\}/);
    const tab = readFileSync('src/components/drawer/PanelDocs.tsx', 'utf8');
    expect(tab).toMatch(/prod\?\.covered && prod\.policyNo/);
  });
});
