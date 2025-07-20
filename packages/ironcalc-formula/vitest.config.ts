import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['ts/**/*.ts'],
      exclude: ['ts/**/*.d.ts', 'tests/**/*']
    }
  }
});