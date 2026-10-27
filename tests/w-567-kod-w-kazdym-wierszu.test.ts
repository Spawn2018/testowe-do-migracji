import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Zgłoszenie właściciela 27.10, 14:24: w liście zmian z pliku KSH drugi wiersz tego samego transportu (BS-06)
 * nie pokazywał kodu — kod był ukryty klasą „tylko dla czytnika ekranu”. Każdy wiersz ma mieć widoczny kod.
 */
describe('W-567 lista zmian KSH — kod transportu w każdym wierszu', () => {
  const panel = readFileSync('src/components/schedule/KshPreviewPanel.tsx', 'utf8');
  const css = readFileSync('src/components/schedule/sched7.css', 'utf8');

  it('panel nie warunkuje wyświetlenia kodu numerem wiersza i nie używa ukrytej klasy', () => {
    expect(panel).not.toMatch(/s7-kp-rep/);
    expect(panel).not.toMatch(/i === 0 \? \(\s*g\.loadId/);
    expect(panel).toMatch(/s7-kp-code-cont/);
  });

  it('CSS nie ukrywa kodu (brak clip-path/1px dla kodu w wierszu)', () => {
    expect(css).not.toMatch(/\.s7-kp-rep\{/);
    expect(css).toMatch(/\.s7-kp-code-cont/);
  });
});
