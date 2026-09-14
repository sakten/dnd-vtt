import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.deploy.test.ts'],
    passWithNoTests: true,
  },
});
