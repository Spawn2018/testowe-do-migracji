// BK2: test przeglądarkowy trybu Supabase (bez wysyłki e-maili).
// logowanie hasłem — 0099; tekst sprzed zmiany: «Wyślij link do logowania»
// Wymaga buildu z VITE_AUTH_MODE=supabase serwowanego pod BASE (domyślnie 127.0.0.1:4178).
// Magic link: generate_link (admin, nie wysyła) → Location z #access_token → otwarcie w aplikacji.
// Użycie: node scripts/auth/e2e-browser.mjs   (zrzuty do /tmp/bk2-e2e-*.png; nie commitować)
import { chromium } from '@playwright/test';
import { loadEnvLocal, TEST_ACCOUNTS, ensureLiveFiveRoles, accountEmail } from './env.mjs';
import { FIVE_ROLE_LIVE_PASSWORD } from './env.mjs';

const env = loadEnvLocal();
const host = await ensureLiveFiveRoles(env);
const BASE = process.env.BK2_BASE ?? 'http://127.0.0.1:4178/';
let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

async function passwordLogin(page, email) {
  await page.goto(BASE);
  await page.waitForSelector('[data-auth="login"]', { timeout: 15000 });
  await page.locator('input[type=email]').fill(email);
  await page.locator('#auth-pw').fill(FIVE_ROLE_LIVE_PASSWORD);
  await page.locator('[data-auth="login"] form button[type=submit]').click();
  await page.waitForSelector('[data-auth="session"]', { timeout: 20000 });
}

const browser = await chromium.launch();
try {
  { // ekran logowania + adres bez zaproszenia
    const page = await (await browser.newContext()).newPage();
    await page.goto(BASE);
    await page.waitForSelector('[data-auth="login"]', { timeout: 15000 });
    check('Ekran logowania (PL) widoczny bez sesji', await page.getByRole('button', { name: 'Zaloguj' }).isVisible());
    await page.screenshot({ path: '/tmp/bk2-e2e-login.png' });
    await page.locator('input[type=email]').fill(`bk2-noinvite-${Date.now()}@example.test`);
    await page.locator('#auth-pw').fill('WrongPassword12!');
    await page.locator('[data-auth="login"] form button[type=submit]').click();
    const err = page.locator('.auth-msg.err');
    await err.waitFor({ timeout: 15000 });
    check('Adres bez zaproszenia → komunikat PL', /zaproszenia|Zbyt wiele|Nieprawidłow|credentials/i.test(await err.textContent()));
  }
  for (const a of TEST_ACCOUNTS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await passwordLogin(page, accountEmail(env, a));
    check(`${a.org}: logowanie hasłem`, true);
    const session = await page.locator('[data-auth="session"]').textContent();
    check(`${a.org}: zalogowany, sesja widoczna`, Boolean(session));
    check(`${a.org}: token usunięty z adresu`, !page.url().includes('access_token'));
    if (a.org === 'HHL') {
      await page.locator('nav button[data-view="options"]').click();
      await page.locator('details[data-section="users"] summary').click();
      const panel = page.locator('[data-auth="users-admin"]');
      await panel.waitFor({ state: 'visible', timeout: 15000 });
      await panel.locator('.auth-admin-row select').nth(2).waitFor({ timeout: 15000 }).catch(() => {});
      const rows = await panel.locator('.auth-admin-row select').count();
      await panel.scrollIntoViewIfNeeded();
      check('HHL: panel „Użytkownicy i role” z ≥3 kontami', rows >= 3);
      await page.screenshot({ path: '/tmp/bk2-e2e-hhl-admin.png', fullPage: false });
    } else {
      const opt = await page.locator('nav').getByText(/Opcje/).count();
      check(`${a.org}: brak Opcji / panelu użytkowników`, opt === 0 && (await page.locator('[data-auth="users-admin"]').count()) === 0);
    }
    await page.keyboard.press('Shift+R'); await page.waitForTimeout(300);
    const role = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('tower') && !k.startsWith('sb-')) ?? '') || '{}')?.state?.role ?? null);
    check(`${a.org}: rola widoku zablokowana na ${a.org} (Shift+R)`, role === null || role === a.org);
    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await page.waitForSelector('[data-auth="login"]', { timeout: 15000 });
    check(`${a.org}: wylogowanie → ekran logowania`, true);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(`\nBK2 e2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
