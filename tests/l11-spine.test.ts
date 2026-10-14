/**
 * Przepisane w wyglad/P4 — E28 (decyzja 07.10 20:57): pasek ma 10 kafelków według statusów E25 i na każdym liczbę
 * (wcześniej B-9.2: 9 kafelków bez cyfr). Nazwy po polsku, liczby sumują się do transportów bez anulowanych.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StageBar } from '../src/components/shell/StageBar';
import { countByTile, STAGE_TILES } from '../src/lib/stageTiles';
import { filterLoadsForRole } from '../src/lib/permissions';
import { t } from '../src/i18n/messages';
import { useTowerStore } from '../src/store/useTowerStore';

describe('E28 pasek etapów (wcześniej L-11 / B-9)', () => {
  it('10 kafelków z polską nazwą i liczbą; trzy grupy; suma = transporty bez anulowanych', () => {
    const state = useTowerStore.getState();
    const counts = countByTile(filterLoadsForRole(state.loads, state.role));
    const html = renderToStaticMarkup(createElement(StageBar, { variant: 'global' }));
    expect(html).not.toContain('class="kb"');
    expect(html).toContain(t('pl', 'p4_grp_prep'));
    expect(html).toContain(t('pl', 'p4_grp_route'));
    expect(html).toContain(t('pl', 'p4_grp_after'));

    const buttons = [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(STAGE_TILES.length);
    STAGE_TILES.forEach((tile, index) => {
      const button = buttons[index];
      expect(button).toContain(`data-tile="${tile}"`);
      expect(button).toContain(t('pl', `p4_tile_${tile}`));
      const n = button.match(/class="n">(\d+)</);
      expect(Number(n?.[1])).toBe(counts[tile]);
      expect(button.includes(' zero')).toBe(counts[tile] === 0);
    });
    const total = STAGE_TILES.reduce((sum, tile) => sum + counts[tile], 0);
    expect(total).toBe(filterLoadsForRole(state.loads, state.role).filter((l) => String(l.status) !== 'CANCELLED').length);
  });
});
