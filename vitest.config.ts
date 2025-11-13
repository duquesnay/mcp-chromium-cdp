import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.ts'
      ],
      include: ['src/**/*.ts']
    },
    // Increase timeout for async operations
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
