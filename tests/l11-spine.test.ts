import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CorridorSpine } from '../src/components/shell/CorridorSpine';
import { countLoadsByStage } from '../src/lib/corridorKpis';
import { t } from '../src/i18n/messages';
import { STAGE_ORDER } from '../src/lib/status';
import { useTowerStore } from '../src/store/useTowerStore';
describe('L-11 / B-9 górny pasek', () => {
  it('kafelek ma polską nazwę; bez cyfr w górnym prostokącie (B-9.2)', () => {
    const state = useTowerStore.getState();
    const counts = countLoadsByStage(state.loads);
    const html = renderToStaticMarkup(createElement(CorridorSpine));
    expect(html).not.toContain('class="kb"');

    const buttons = [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(STAGE_ORDER.length);

    STAGE_ORDER.forEach((stage, index) => {
      const button = buttons[index];
      const label = t('pl', `stage_${stage}`);
      expect(button).toContain(label);
      const english = t('en', `stage_${stage}`);
      if (english !== label) expect(button).not.toContain(english);
      // B-9.2 — górny prostokąt bez liczby transportów
      const nBlock = button.match(/class="n[^"]*"[^>]*>([^<]*)</);
      expect(nBlock?.[1] ?? '').toBe('');
    });

    const total = STAGE_ORDER.reduce((sum, stage) => sum + counts[stage], 0);
    expect(total).toBe(state.loads.length);
  });
});
