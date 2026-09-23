/**
 * P4 smoke: open RESOURCES_PENDING load → Ustalenia → fill resources + awizacja → assert status.
 * Screenshot /tmp/wt-p4-ustalenia.png
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const URL = process.env.WT_URL || 'http://127.0.0.1:4177/';
const OUT = '/tmp/wt-p4-ustalenia.png';

const chromePaths = [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const executablePath = chromePaths.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('no chrome');

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

// Clear persisted store so seed RESOURCES_PENDING is fresh
await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('watch-tower'));
  keys.forEach((k) => localStorage.removeItem(k));
});
await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });

// Ensure HHL role (can edit)
await page.evaluate(() => {
  const st = window.__WT_STORE__;
});

// Find store via React — use zustand persist in page
const info = await page.evaluate(() => {
  // Access zustand from localStorage after hydrate, or click UI
  return { href: location.href, title: document.title };
});
console.log('page', info);

// Navigate Schedule, find SG-19 (Brak auta)
await page.evaluate(() => {
  // Click nav Harmonogram if present
  const nav = [...document.querySelectorAll('nav button, .nav button, [class*="nav"] button, aside button')];
  const btn = nav.find((b) => /Harmonogram|Schedule/i.test(b.textContent || ''));
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 500));

// Try select via store mutation exposed? Look for code cell
const clicked = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.code, td .code, [data-load]')];
  const el = cells.find((c) => (c.textContent || '').includes('SG-19'));
  if (el) {
    (el.closest('tr') || el).click();
    return 'clicked-SG-19';
  }
  // fallback: any Brak auta row
  const pills = [...document.querySelectorAll('.pill, span')].filter((s) =>
    /Brak auta/i.test(s.textContent || ''),
  );
  if (pills[0]) {
    pills[0].closest('tr')?.click();
    return 'clicked-brak-auta';
  }
  return null;
});
console.log('select', clicked);

await new Promise((r) => setTimeout(r, 600));

// Switch to Ustalenia tab
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('button, .tab, [role="tab"]')];
  const t = tabs.find((b) => /Ustalenia/i.test(b.textContent || ''));
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 400));

// Fill resources form
const fillRes = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    /Zapisz zasoby/i.test(f.textContent || ''),
  );
  if (!form) return { ok: false, reason: 'no resources form' };
  const set = (name, val) => {
    const inp = form.querySelector(`[name="${name}"]`);
    if (!inp) return false;
    inp.focus();
    inp.value = val;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  set('driverName', 'Jan Kowalski');
  set('driverPhone', '+48 600 111 222');
  set('tractorPlate', 'WWL 4P40');
  set('trailerPlate', 'WWL N4P0');
  const btn = [...form.querySelectorAll('button')].find((b) => /Zapisz zasoby/i.test(b.textContent || ''));
  btn?.click();
  return { ok: true };
});
console.log('fillRes', fillRes);
await new Promise((r) => setTimeout(r, 800));

// Status after resources
const afterRes = await page.evaluate(() => {
  const pill = document.querySelector('.wb-hd .pill, .drawer .pill, header .pill, .wb-fields .pill');
  const toast = [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).slice(0, 3);
  const hd = document.querySelector('.wb-code, .drawer-hd, .wb-hd')?.textContent;
  // Scan all pills near drawer
  const pills = [...document.querySelectorAll('.pill')].map((p) => p.textContent?.trim()).filter(Boolean).slice(0, 12);
  return { hd, toast, pills };
});
console.log('afterRes', JSON.stringify(afterRes));

// Fill awizacja
const fillAwi = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    /Zapisz awizację/i.test(f.textContent || ''),
  );
  if (!form) return { ok: false, reason: 'no awi form' };
  const set = (name, val) => {
    const inp = form.querySelector(`[name="${name}"]`);
    if (!inp) return false;
    inp.focus();
    inp.value = val;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  set('loadWindowStart', '2026-10-17T08:00');
  set('loadWindowEnd', '2026-10-17T16:00');
  const conf = form.querySelector('[name="confirmed"]');
  if (conf && !conf.checked) conf.click();
  const btn = [...form.querySelectorAll('button')].find((b) => /Zapisz awizację/i.test(b.textContent || ''));
  btn?.click();
  return { ok: true, types: [...form.querySelectorAll('input')].map((i) => `${i.name}:${i.type}`) };
});
console.log('fillAwi', fillAwi);
await new Promise((r) => setTimeout(r, 800));

const afterAwi = await page.evaluate(() => {
  const pills = [...document.querySelectorAll('.pill')].map((p) => p.textContent?.trim()).filter(Boolean).slice(0, 16);
  const toasts = [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent?.trim()).slice(0, 5);
  const overviewDriver = [...document.querySelectorAll('dt')].find((d) => d.textContent === 'Kierowca');
  // Switch to Przegląd to see kv
  const tabs = [...document.querySelectorAll('button')].find((b) => /Przegląd/i.test(b.textContent || ''));
  tabs?.click();
  return { pills, toasts };
});
await new Promise((r) => setTimeout(r, 400));

const overview = await page.evaluate(() => {
  const kv = {};
  document.querySelectorAll('dl.kv dt').forEach((dt) => {
    const dd = dt.nextElementSibling;
    kv[dt.textContent?.trim() || ''] = dd?.textContent?.trim()?.slice(0, 80);
  });
  const pills = [...document.querySelectorAll('.pill')].map((p) => p.textContent?.trim()).filter(Boolean).slice(0, 10);
  // timeline events
  const tabs = [...document.querySelectorAll('button')].find((b) => /Timeline|Oś|Zdarzenia/i.test(b.textContent || ''));
  tabs?.click();
  return { kv, pills };
});
await new Promise((r) => setTimeout(r, 300));

const events = await page.evaluate(() => {
  return [...document.querySelectorAll('.tl .w, ul.tl li')].map((li) => li.textContent?.trim()).slice(0, 8);
});

// Back to Ustalenia for screenshot of filled forms
await page.evaluate(() => {
  const t = [...document.querySelectorAll('button')].find((b) => /Ustalenia/i.test(b.textContent || ''));
  t?.click();
});
await new Promise((r) => setTimeout(r, 400));

await page.screenshot({ path: OUT, fullPage: false });
console.log('screenshot', OUT);

const result = { afterRes, afterAwi, overview, events, fillRes, fillAwi };
fs.writeFileSync('/tmp/wt-p4-smoke.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await browser.close();
