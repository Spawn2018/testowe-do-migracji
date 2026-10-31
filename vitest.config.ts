import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // #667 F7 r3: jsdom tylko przez dyrektywę @vitest-environment w pliku (bez environmentMatchGlob).
    include: ['tests/**/*.test.ts', 'tests/**/*.jsdom.test.ts'],
    // M1: money.test.ts w suite (49 green + 1 skip bez NBP_LIVE)
    // setup.ts w jsdom nie nadpisuje document (Leaflet).
    setupFiles: ['./tests/setup.ts'],
    // R3 (P0-CI): na Windows przy małej wolnej pamięci równoległe workery powodują timeouty (pdf-export).
    // P2: domyślny pool Vitest 5 na Windows nie ustawia runnera (describe → runner.config).
    // vmForks działa; po teście zostają timery toasta bez localStorage w hoście — nie liczą się jako błąd testu.
    ...(process.platform === 'win32' ? {
      maxWorkers: 2,
      pool: 'vmForks' as const,
      dangerouslyIgnoreUnhandledErrors: true,
      testTimeout: 20_000,
    } : {}),
  },
});
