/** #437 E44 — wiersz „Pozycje z linku RIO” w Opcje › Stan systemu (job `rio-links`, cron tower-rio-links). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIVE_SOURCES } from '../src/auth/LiveStatus';
import { P3C_I18N } from '../src/i18n/p3c';

describe('Stan systemu: RIO', () => {
  it('źródło telematics-rio czyta job rio-links, próg 10 min, zaraz po emtrack', () => {
    const i = LIVE_SOURCES.findIndex((s) => s.id === 'telematics-rio');
    expect(i).toBe(LIVE_SOURCES.findIndex((s) => s.id === 'telematics') + 1);
    expect(LIVE_SOURCES[i]).toMatchObject({ jobs: ['rio-links'], maxMin: 10 });
  });

  it('teksty PL i job na liście przebiegów', () => {
    const pl = P3C_I18N.pl;
    expect(pl.ol2_src_telematics_rio).toBe('Pozycje z linku RIO');
    expect(pl.ol2_src_telematics_rio_cad).toContain('co 2 min');
    expect(pl.ol2_src_telematics_rio_feeds).toContain('podwykonawców');
    expect(readFileSync('src/auth/SystemStatusPanel.tsx', 'utf8')).toContain("'rio-links'");
  });
});
