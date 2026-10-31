import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/Lanternfall_Games/',
  test: { include: ['tests/**/*.test.ts'] },
});

