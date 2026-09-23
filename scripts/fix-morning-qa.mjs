import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = '/workspace/watch-tower/qa-start/fix-morning';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0', timeout: 90000 });
// clear stage, force layers on via store persist merge is flaky — use UI
await page.evaluate(() => {
  localStorage.removeItem('watch-tower-ui-v6-ready-gate');
});
await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
await new Promise((r) => setTimeout(r, 1200));

async function clickNav(label) {
  await page.evaluate((lab) => {
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      (b.textContent || '').toLowerCase().includes(lab.toLowerCase()),
    );
    if (!btn) throw new Error('nav not found: ' + lab);
    btn.click();
  }, label);
  await new Promise((r) => setTimeout(r, 1000));
}

// ========== RISKS ==========
await clickNav('Ryzyka');
const risk = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('main .panel')];
  const rects = panels.map((p) => {
    const r = p.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  });
  let overlap = false;
  for (let i = 0; i < rects.length - 1; i++) {
    if (rects[i].bottom > rects[i + 1].top + 2) overlap = true;
  }
  return {
    hasRiskPage: !!document.querySelector('.risk-page'),
    panelCount: panels.length,
    panelsOverlap: overlap,
    exq: document.querySelectorAll('.exq li').length,
  };
});
await page.screenshot({ path: `${OUT}/01-risks.png` });
await page.evaluate(() => {
  [...document.querySelectorAll('h2')]
    .find((x) => /Warunki drogowe/i.test(x.textContent || ''))
    ?.scrollIntoView({ block: 'center' });
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/01b-risks-se-panel.png` });

// ========== SCHEDULE independent of spine ==========
await clickNav('Harmonogram');
const schedBase = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  const chips = [...document.querySelectorAll('.filters .chipbtn')].map((b) => b.textContent?.trim());
  const counter = [...document.querySelectorAll('.filters span')]
    .map((s) => s.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  return { n: rows.length, chips, counter };
});

// Activate spine stage (navigates to map by design)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.stage')].find((s) =>
    (s.textContent || '').includes('Przygotowanie'),
  );
  el?.click();
});
await new Promise((r) => setTimeout(r, 1200));
// Return to Harmonogram — stageFilter should still be PLAN in store, but schedule ignores it
await clickNav('Harmonogram');
const schedAfter = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  const counter = [...document.querySelectorAll('.filters span')]
    .map((s) => s.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  const stagePressed = [...document.querySelectorAll('.stage')].some(
    (s) => s.getAttribute('aria-pressed') === 'true' && (s.textContent || '').includes('Przygotowanie'),
  );
  return {
    n: rows.length,
    counter,
    stagePressed,
    showsSpineInCounter: /·\s*Przygotowanie/.test(counter),
  };
});
await page.screenshot({ path: `${OUT}/02-schedule-spine-ignored.png` });

// Dostarczone chip
const del = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.filters .chipbtn')].find((b) =>
    /Dostarczone/i.test(b.textContent || ''),
  );
  if (!btn) return { ok: false };
  btn.click();
  return { ok: true };
});
await new Promise((r) => setTimeout(r, 500));
const delState = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table tbody tr')];
  return {
    n: rows.length,
    allDone: rows.length > 0 && rows.every((r) => r.classList.contains('done')),
    codes: rows.slice(0, 5).map((r) => r.querySelector('.code')?.textContent),
  };
});
await page.screenshot({ path: `${OUT}/02b-schedule-delivered.png` });

// clear delivered filter / stage for map
await page.evaluate(() => {
  const all = [...document.querySelectorAll('.filters .chipbtn')].find((b) =>
    /Wszystkie/i.test(b.textContent || ''),
  );
  all?.click();
  const pressed = [...document.querySelectorAll('.stage')].find(
    (s) => s.getAttribute('aria-pressed') === 'true',
  );
  pressed?.click(); // clear spine
});
await new Promise((r) => setTimeout(r, 400));

// ========== MAP ==========
await clickNav('Mapa');
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  for (const lab of document.querySelectorAll('.maplayers label')) {
    const input = lab.querySelector('input');
    const t = (lab.textContent || '').trim();
    if (/Pojazdy|Trasa|Ryzyka/i.test(t) && input && !input.checked) input.click();
  }
});
await new Promise((r) => setTimeout(r, 2500));
const map = await page.evaluate(() => {
  const leaflet = document.querySelector('.leaflet-container');
  const svg = document.querySelector('.leaflet-overlay-pane svg');
  const paths = svg ? svg.querySelectorAll('path').length : 0;
  const circles = svg ? svg.querySelectorAll('circle').length : 0;
  // sample a path bbox — non-zero means visible geometry
  let pathBox = null;
  const p0 = svg?.querySelector('path');
  if (p0) {
    const b = p0.getBoundingClientRect();
    pathBox = { w: Math.round(b.width), h: Math.round(b.height), t: Math.round(b.top), l: Math.round(b.left) };
  }
  return {
    mapSize: leaflet ? { w: leaflet.clientWidth, h: leaflet.clientHeight } : null,
    paths,
    circles,
    svgW: svg ? getComputedStyle(svg).width : null,
    pathBox,
    listCount: document.querySelectorAll('.mlist li[data-load]').length,
  };
});
await page.screenshot({ path: `${OUT}/03-map-markers.png` });

const summary = {
  risk,
  schedule: {
    schedBase,
    schedAfter,
    independent: schedAfter.n === schedBase.n && schedAfter.n > 0,
    noSpineLabel: !schedAfter.showsSpineInCounter,
    delivered: { ...del, ...delState },
  },
  map,
  pass: {
    risks: risk.hasRiskPage && !risk.panelsOverlap,
    scheduleIndependent: schedAfter.n === schedBase.n && schedAfter.n > 0 && !schedAfter.showsSpineInCounter,
    deliveredChip: del.ok && delState.n > 0 && delState.allDone,
    mapMarkers: map.paths + map.circles > 5,
  },
};
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
const p = summary.pass;
process.exit(p.risks && p.scheduleIndependent && p.deliveredChip && p.mapMarkers ? 0 : 2);
