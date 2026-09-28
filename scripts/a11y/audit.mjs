#!/usr/bin/env node
/**
 * III-12 / SCOPE 11.5 — audyt dostępności (klawiatura, kontrast, czytniki ekranu) na buildzie demo.
 * Użycie: A11Y_URL=http://127.0.0.1:4189 node scripts/a11y/audit.mjs [plik-wyniku.json]
 * Dla każdej roli (HHL, KSH, SCX) × motyw (jasny, ciemny) × każdy widok z menu: axe-core (reguły WCAG 2.0/2.1 A i AA)
 * + test klawiatury: elementy klikalne (cursor:pointer / onclick) nieosiągalne klawiszem Tab i bez roli.
 * Zamrożony zegar jak w bramie wizualnej. Tylko odczyt — nic nie zmienia w aplikacji.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = (process.env.A11Y_URL || 'http://127.0.0.1:4189').replace(/\/$/, '');
const OUT = process.argv[2] || '/tmp/a11y-report.json';
const URL0 = `${BASE}/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`;
const ROLES = ['HHL', 'KSH', 'SCX'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'pl-PL' });
await page.goto(URL0, { waitUntil: 'networkidle', timeout: 120000 });
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('#roleSeg', { timeout: 30000 });

const results = [];
for (const role of ROLES) {
  await page.evaluate((id) => document.querySelector(`#roleSeg button[data-role="${id}"]`)?.click(), role);
  await page.waitForTimeout(500);
  for (const theme of ['dark', 'light']) {
    const cur = await page.evaluate(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'));
    for (let i = 0; i < 3 && (await page.evaluate(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'))) !== theme; i++) {
      await page.click('#themeBtn'); await page.waitForTimeout(300);
    }
    void cur;
    const views = await page.evaluate(() => [...document.querySelectorAll('nav button[data-view]')].map((b) => b.getAttribute('data-view')));
    for (const view of views) {
      await page.evaluate((k) => document.querySelector(`nav button[data-view="${k}"]`)?.click(), view);
      await page.waitForTimeout(700);
      if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE });
      const axe = await page.evaluate(async () => {
        // @ts-ignore
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
      const kbd = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.cursor !== 'pointer' || cs.visibility === 'hidden' || cs.display === 'none') continue;
          if (el.closest('button, a[href], input, select, textarea, summary, label, [tabindex], [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [role="radio"]')) continue;
          const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
          if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer' && !el.parentElement.closest('button, a[href], [tabindex], [role]')) continue; // licz tylko najwyższy element
          bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`);
        }
        return bad;
      });
      results.push({ role, theme, view, axe, keyboard: { count: kbd.length, sample: [...new Set(kbd)].slice(0, 5) } });
      process.stdout.write(`${role} ${theme} ${view}: axe ${axe.reduce((s, v) => s + v.nodes, 0)} węzłów / ${axe.length} reguł, klawiatura ${kbd.length}\n`);
    }
  }
}
await browser.close();
writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
console.log(`zapisano ${OUT}`);
