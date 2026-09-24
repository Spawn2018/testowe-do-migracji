import { defineConfig, devices } from '@playwright/test'

/**
 * C2.4 — brama pixel-diff (smoke). Pełna matryca ~720 = C2.3 / scripts/baseline.mjs.
 * HashRouter + zamrożony zegar: #/?now=2026-09-23T14:32:00Z
 */
const FROZEN_NOW = '2026-09-23T14:32:00Z'
const BASE_ORIGIN = 'http://127.0.0.1:4177'

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
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
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
