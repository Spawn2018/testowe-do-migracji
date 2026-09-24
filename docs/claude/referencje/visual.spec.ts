import { test, expect, type Page } from '@playwright/test';

/**
 * TOWER — test regresji wizualnej
 *
 * To jest jedyny mechanizm, który DOWODZI, że aplikacja wygląda identycznie
 * jak zatwierdzona makieta. Wszystko inne jest deklaracją.
 *
 * Jak działa:
 *   1. `npm run baseline` renderuje makietę (tower-makieta.html) i zapisuje
 *      zrzuty wzorcowe do tests/__baseline__/.
 *   2. Ten test renderuje aplikację w tych samych stanach i porównuje
 *      piksel po pikselu z progiem 0,1%.
 *   3. Czerwony test blokuje wdrożenie. Bez wyjątków.
 *
 * Kiedy wolno zaktualizować wzorce:
 *   TYLKO gdy zmienił się mockup i dostaliśmy nową wersję wzorcową
 *   z listą zmian. Nigdy po to, żeby „uciszyć" czerwony test.
 *
 * Liczba przypadków: widoki × role × języki × szerokości × motywy.
 * Przy obecnym zakresie to kilkaset zrzutów — i o to chodzi.
 */

const VIEWS = [
  { key: 'dash',  path: '/',                nazwa: 'kokpit' },
  { key: 'map',   path: '/mapa',            nazwa: 'mapa' },
  { key: 'sched', path: '/harmonogram',     nazwa: 'harmonogram' },
  { key: 'risk',  path: '/ryzyka',          nazwa: 'ryzyka' },
  { key: 'docs',  path: '/dokumenty',       nazwa: 'dokumenty' },
  { key: 'fin',   path: '/finanse',         nazwa: 'finanse' },
  { key: 'inv',   path: '/faktury',         nazwa: 'faktury',       role: ['HHL', 'SCX'] },
  { key: 'wf',    path: '/automatyzacje',   nazwa: 'automatyzacje', role: ['HHL'] },
  { key: 'geo',   path: '/strefy',          nazwa: 'strefy',        role: ['HHL'] },
  { key: 'tasks', path: '/zadania',         nazwa: 'zadania',       role: ['SCX'] },
] as const;

const ROLES  = ['HHL', 'KSH', 'SCX'] as const;
const LANGS  = ['pl', 'en', 'sv'] as const;
const THEMES = ['light', 'dark'] as const;

/** Szerokości z DESIGN_SYSTEM.md. 390 to telefon, 768 to granica jednej kolumny. */
const WIDTHS = [
  { w: 1920, h: 1080, nazwa: '1920' },
  { w: 1440, h: 900,  nazwa: '1440' },
  { w: 1280, h: 800,  nazwa: '1280' },
  { w: 768,  h: 1024, nazwa: '768'  },
  { w: 390,  h: 844,  nazwa: '390'  },
] as const;

/** Dane demonstracyjne są zamrożone, więc zrzuty są powtarzalne co do piksela. */
async function przygotuj(page: Page, rola: string, jezyk: string, motyw: string) {
  await page.addInitScript(
    ([r, l, t]) => {
      localStorage.setItem('tower.role', r);
      localStorage.setItem('tower.lang', l);
      localStorage.setItem('tower.theme', t);
      // Zegar zamrożony — inaczej odliczanie do promu zmienia zrzut co minutę.
      localStorage.setItem('tower.now', '2026-09-22T14:32:00Z');
    },
    [rola, jezyk, motyw]
  );
  await page.emulateMedia({ colorScheme: motyw as 'light' | 'dark', reducedMotion: 'reduce' });
}

async function ustabilizuj(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // Szkielety ładowania muszą zniknąć, inaczej złapiemy stan przejściowy.
  await page.waitForFunction(() => !document.querySelector('.skel'), null, { timeout: 5000 })
    .catch(() => { /* widok bez tabeli */ });
  await page.waitForTimeout(120);
}

const PROG = { maxDiffPixelRatio: 0.001, animations: 'disabled' as const };

test.describe('Wierność wizualna wobec makiety', () => {
  for (const motyw of THEMES) {
    for (const rola of ROLES) {
      for (const jezyk of LANGS) {
        for (const widok of VIEWS) {
          const dozwolone = (widok as any).role as readonly string[] | undefined;
          if (dozwolone && !dozwolone.includes(rola)) continue;

          for (const rozmiar of WIDTHS) {
            const nazwa =
              `${widok.nazwa}__${rola}__${jezyk}__${rozmiar.nazwa}__${motyw}.png`;

            test(nazwa, async ({ page }) => {
              await page.setViewportSize({ width: rozmiar.w, height: rozmiar.h });
              await przygotuj(page, rola, jezyk, motyw);
              await page.goto(widok.path);
              await ustabilizuj(page);
              await expect(page).toHaveScreenshot(nazwa, { fullPage: true, ...PROG });
            });
          }
        }
      }
    }
  }
});

test.describe('Stany interakcji', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('najechanie na wiersz tabeli', async ({ page }) => {
    await przygotuj(page, 'HHL', 'pl', 'light');
    await page.goto('/harmonogram');
    await ustabilizuj(page);
    await page.locator('tbody tr').nth(3).hover();
    await expect(page).toHaveScreenshot('stan__hover-wiersz.png', PROG);
  });

  test('fokus klawiatury na szukajce', async ({ page }) => {
    await przygotuj(page, 'HHL', 'pl', 'light');
    await page.goto('/harmonogram');
    await ustabilizuj(page);
    await page.keyboard.press('/');
    await expect(page).toHaveScreenshot('stan__fokus-szukajka.png', PROG);
  });

  test('szuflada transportu, wszystkie zakładki', async ({ page }) => {
    await przygotuj(page, 'HHL', 'pl', 'light');
    await page.goto('/harmonogram');
    await ustabilizuj(page);
    await page.locator('tbody tr').nth(7).click();
    for (const zakladka of ['over', 'tl', 'docs', 'money', 'chat']) {
      await page.locator(`[data-dtab="${zakladka}"]`).click();
      await page.waitForTimeout(80);
      await expect(page).toHaveScreenshot(`stan__szuflada-${zakladka}.png`, PROG);
    }
  });

  test('stan pusty po filtrze bez wyników', async ({ page }) => {
    await przygotuj(page, 'HHL', 'pl', 'light');
    await page.goto('/harmonogram');
    await ustabilizuj(page);
    await page.locator('#q').fill('xxxxxx');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('stan__pusty.png', PROG);
  });

  test('szkielet ładowania', async ({ page }) => {
    await przygotuj(page, 'HHL', 'pl', 'light');
    await page.route('**/rest/v1/**', r => setTimeout(() => r.continue(), 3000));
    await page.goto('/harmonogram');
    await page.locator('.skel').first().waitFor();
    await expect(page).toHaveScreenshot('stan__ladowanie.png', PROG);
  });

  test('panel skrótów klawiszowych', async ({ page }) => {
    await przygotuj(page, 'HHL', 'pl', 'light');
    await page.goto('/');
    await ustabilizuj(page);
    await page.keyboard.press('?');
    await expect(page).toHaveScreenshot('stan__skroty.png', PROG);
  });
});

/**
 * Test twardy: rozdzielenie widoczności cen.
 *
 * Nie jest wizualny, ale stoi tutaj, bo pilnuje tej samej obietnicy —
 * że rola widzi dokładnie to, co ma widzieć. Ukrycie kolumny w interfejsie
 * to nie zabezpieczenie; sprawdzamy odpowiedź serwera, nie ekran.
 */
test.describe('Rozdzielenie dostępu do cen', () => {
  test('klient nie otrzymuje kosztu ani marży w odpowiedzi API', async ({ page }) => {
    const podejrzane: string[] = [];
    page.on('response', async res => {
      if (!res.url().includes('/rest/v1/')) return;
      const body = await res.text().catch(() => '');
      for (const pole of ['total_cost', 'base_cost', 'margin_pln', 'margin_pct', 'load_cost']) {
        if (body.includes(pole)) podejrzane.push(`${pole} @ ${res.url()}`);
      }
    });
    await przygotuj(page, 'KSH', 'pl', 'light');
    await page.goto('/finanse');
    await ustabilizuj(page);
    expect(podejrzane, `Klient dostał dane kosztowe: ${podejrzane.join(', ')}`).toHaveLength(0);
  });

  test('przewoźnik nie otrzymuje przychodu ani marży w odpowiedzi API', async ({ page }) => {
    const podejrzane: string[] = [];
    page.on('response', async res => {
      if (!res.url().includes('/rest/v1/')) return;
      const body = await res.text().catch(() => '');
      for (const pole of ['total_revenue', 'base_revenue', 'margin_pln', 'margin_pct', 'load_revenue']) {
        if (body.includes(pole)) podejrzane.push(`${pole} @ ${res.url()}`);
      }
    });
    await przygotuj(page, 'SCX', 'pl', 'light');
    await page.goto('/finanse');
    await ustabilizuj(page);
    expect(podejrzane, `Przewoźnik dostał dane przychodowe: ${podejrzane.join(', ')}`).toHaveLength(0);
  });
});
