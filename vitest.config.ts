import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // M1: money.test.ts w suite (49 green + 1 skip bez NBP_LIVE)
    setupFiles: ['./tests/setup.ts'],
    // R3 (P0-CI): na Windows przy małej wolnej pamięci równoległe workery powodują timeouty (pdf-export).
    ...(process.platform === 'win32' ? { maxWorkers: 2 } : {}),
  },
});
