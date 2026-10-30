import { defineConfig } from 'vitest/config';

const winOpts = process.platform === 'win32' ? {
  maxWorkers: 2,
  pool: 'vmForks' as const,
  dangerouslyIgnoreUnhandledErrors: true,
  testTimeout: 20_000,
} : {};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.jsdom.test.ts'],
          // M1: money.test.ts w suite (49 green + 1 skip bez NBP_LIVE)
          setupFiles: ['./tests/setup.ts'],
          // R3 (P0-CI): na Windows przy małej wolnej pamięci równoległe workery powodują timeouty (pdf-export).
          // P2: domyślny pool Vitest 5 na Windows nie ustawia runnera (describe → runner.config).
          // vmForks działa; po teście zostają timery toasta bez localStorage w hoście — nie liczą się jako błąd testu.
          ...winOpts,
        },
      },
      {
        // #667 F7 r2: jsdom bez tests/setup.ts (setup stubuje document i psuje Leaflet).
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/**/*.jsdom.test.ts'],
          setupFiles: [],
          ...winOpts,
        },
      },
    ],
  },
});
