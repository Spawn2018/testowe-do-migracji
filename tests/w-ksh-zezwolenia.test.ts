// E31 pkt 9 (decyzja koordynatora 22.10.2026): KSH widzi zezwolenia swoich transportów — tylko do odczytu.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { permitsForRole, type PermitView } from '../src/lib/p5Source';

const p = (id: string, loads: number, scope: PermitView['scope'] = 'FIRMA'): PermitView => ({
  id, scope, country: 'PL', number: null, validFrom: null, validTo: null, limits: null, pilot: null, appliesTo: 'x', loads,
});

describe('permitsForRole', () => {
  const list = [p('a', 28), p('b', 0, 'TRASA'), p('c', 3, 'TRASA')];
  it('KSH: tylko zezwolenia przypięte do co najmniej jednego transportu', () => {
    expect(permitsForRole(list, 'KSH')?.map((x) => x.id)).toEqual(['a', 'c']);
  });
  it('HHL i SCX: lista bez zmian', () => {
    expect(permitsForRole(list, 'HHL')?.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(permitsForRole(list, 'SCX')?.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('nie podłączone (null) zostaje null', () => {
    expect(permitsForRole(null, 'KSH')).toBeNull();
  });
  it('Dokumenty: sekcja dla KSH, przycisk „+ Zezwolenie firmowe” tylko dla HHL i SCX', () => {
    const src = readFileSync('src/views/DocsView.tsx', 'utf8');
    expect(src).toContain("permitsForRole(permitsOf(loads), role)");
    expect(src).toContain("permits && (role !== 'KSH' || permits.length > 0)");
    expect(src).toContain("const canUpload = role === 'HHL' || role === 'SCX';");
    expect(src).toMatch(/\{canUpload \? <button[^>]*data-doc-permit-add/);
  });
});
