/**
 * B-5 (część B, 02.10): „Automatyzacje — brak przycisku tworzącego nową automatyzację”.
 * Decyzja 05.10: przycisku NOWEJ automatyzacji ma nie być — w produkcji widok to tylko historia reguł
 * (ONE-MECH, D-29: jeden mechanizm w bazie). Test renderuje widok z PROD_BUILD = true.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prodFacade', async (orig) => ({ ...(await orig<typeof import('../src/lib/prodFacade')>()), PROD_BUILD: true }));

describe('B-5: Automatyzacje bez przycisku nowej automatyzacji (produkcja)', () => {
  it('widok produkcyjny: brak „Nowa reguła”, kreatora i „Uruchom”, włączniki wyłączone', async () => {
    const { WorkflowsView } = await import('../src/views/WorkflowsView');
    const { t } = await import('../src/i18n/messages');
    const html = renderToStaticMarkup(createElement(WorkflowsView));
    for (const loc of ['pl', 'en', 'sv'] as const) expect(html).not.toContain(`>${t(loc, 'wf_new')}<`);
    expect(html).not.toContain('wf-creator');
    expect(html).not.toContain('wf-run');
    expect(html).toContain('data-page="workflows"');
    const switches = [...html.matchAll(/<button[^>]*class="sw"[^>]*>/g)].map((m) => m[0]);
    for (const s of switches) expect(s).toContain('disabled');
  });

  it('kod: przycisk i kreator tylko poza produkcją (historyOnly = PROD_BUILD)', () => {
    const src = readFileSync(new URL('../src/views/WorkflowsView.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/const historyOnly = PROD_BUILD;/);
    expect(src).toMatch(/\{historyOnly \? null : <button[^\n]*openCreator/);
    expect(src).toMatch(/\{!historyOnly && creating \?/);
  });

  it('Opcje: podgląd automatyzacji bez przycisku tworzenia', () => {
    const src = readFileSync(new URL('../src/views/OptionsView.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/createWorkflow|wf_new/);
  });
});
