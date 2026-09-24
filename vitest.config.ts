import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // P0.2: money.test gated until Etap2 M1 (engine placed, suite not in default unit yet)
    exclude: ['tests/money.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
