import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, '**/*.deploy.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.deploy.test.ts', 'src/test/**', 'src/**/*.d.ts'],
    },
  },
});
