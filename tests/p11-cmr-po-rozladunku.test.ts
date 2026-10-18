/**
 * Decyzja właściciela 18.10.2026, 17:28 (wcześniej 08.10 B): w Watch Tower jest tylko CMR po rozładunku, z podpisem
 * odbiorcy — w każdym miejscu programu. Przed „Dostarczone” CMR nie jest brakiem ani „po terminie”, także gdy baza
 * ma jeszcze stare wymaganie „2 h po załadunku” (poprawka bazy: D-20261018-1740-01).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cmrAfterDelivery, cmrCounts, DEFAULT_DOC_REQUIREMENTS, type DocStatusRow } from '../src/lib/docRequirements';
import type { LoadStatus } from '../src/types';

describe('CMR tylko po rozładunku (decyzja 18.10, 17:28)', () => {
  it('wartość startowa: CMR po rozładunku, 24 h, z podpisem odbiorcy', () => {
    const cmr = DEFAULT_DOC_REQUIREMENTS.find((r) => r.category === 'CMR');
    expect(cmr).toMatchObject({ anchor: 'AFTER_UNLOAD', offsetHours: 24, required: true });
  });

  it('CMR liczy się dopiero od „Dostarczone”; inne dokumenty bez zmian', () => {
    const st: Record<string, LoadStatus> = { a: 'IN_TRANSIT_PL', b: 'PLANNED', c: 'DELIVERED', d: 'READY_TO_INVOICE', e: 'INVOICED', f: 'UNLOADING' };
    const rows: DocStatusRow[] = Object.keys(st).flatMap((id) => [
      { loadId: id, category: 'CMR', dueAt: '2026-10-01T16:00:00Z', state: 'OVERDUE' },
      { loadId: id, category: 'PERMIT_PL', dueAt: '2026-10-01T04:00:00Z', state: 'OVERDUE' },
    ]);
    const out = cmrAfterDelivery(rows, (id) => st[id]);
    expect(out.filter((r) => r.category === 'CMR').map((r) => r.loadId).sort()).toEqual(['c', 'd', 'e', 'f']);
    expect(out.filter((r) => r.category === 'PERMIT_PL')).toHaveLength(6);
    expect([cmrCounts('LOADING'), cmrCounts('APPROACHING_SITE'), cmrCounts('UNLOADING'), cmrCounts('DELIVERED'), cmrCounts(undefined)]).toEqual([false, false, true, true, false]);
  });

  it('w tekstach nie ma „CMR z załadunku” ani CMR „po załadunku”', () => {
    /* F7 #303 P4: wszystkie pliki tekstów, nie tylko p5 i p7 */
    /* F7 #303 r2 D2: także pomoc (`helpContent.ts`) */
    for (const f of [...readdirSync('src/i18n').filter((x) => x.endsWith('.ts')).map((x) => `src/i18n/${x}`), 'src/lib/helpContent.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/CMR z załadunku|CMR przy załadunku/i);
      expect(src, f).not.toMatch(/p7_doc_cmr_after:|p5_doc_r_CMR_LOAD|p5_doc_n_CMR_LOAD/);
    }
  });
});
