import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.deploy.test.ts'],
    passWithNoTests: true,
  },
});
