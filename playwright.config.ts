import { defineConfig, devices } from '@playwright/test'

/**
 * C2.4 — brama pixel-diff (smoke). Pełna matryca ~720 = C2.3 / scripts/baseline.mjs.
 * HashRouter + zamrożony zegar: #/?now=2026-09-23T14:32:00Z
 */
const FROZEN_NOW = '2026-09-23T14:32:00Z'
/* chore(BK6): PW_BASE_URL ustawia scripts/ci/fresh-smoke.sh (świeży build HEAD, :4179). Domyślnie :4177 (ręcznie). */
const BASE_ORIGIN = (process.env.PW_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '')

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  testIgnore: [/.*\.test\.ts/, /setup\.ts/],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  /* Snapshoty Playwright (po pierwszym update) — nie mylić z pełnym shots-baseline z baseline.mjs */
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: {
    /* F2.2: maxDiffPixels 60 (was ratio 0.001). threshold 0.28 — 4 kokpit AA fringes at 0.15 (tiny ~18px glyph edge, 107→60 px); not maxDiffPixels */
    toHaveScreenshot: {
      fullPage: true,
      maxDiffPixels: 60,
      threshold: 0.28,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: BASE_ORIGIN,
    /* HashRouter: query `now` żyje w hashu */
    /* viewport ustawiany per-test; deviceScaleFactor 1 = spójność z baseline.mjs */
    deviceScaleFactor: 1,
    locale: 'pl-PL',
    colorScheme: 'dark',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 1,
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: ['--disable-dev-shm-usage'],
        },
      },
    },
  ],
  /* Preview musi już działać na 4177 (nie startujemy serwera tutaj — unika kolizji). */
  /* URL zamrożenia używany w teście: `${BASE_ORIGIN}/#/?now=${FROZEN_NOW}` */
  metadata: {
    frozenNow: FROZEN_NOW,
    frozenUrl: `${BASE_ORIGIN}/#/?now=${encodeURIComponent(FROZEN_NOW)}`,
  },
})
