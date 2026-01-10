import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Exclude E2E tests - they require real LLM and should run separately via npm run test:agent:pro
    exclude: [
      '**/node_modules/**',
      '**/viktor-e2e.test.ts',
      '**/viktor-local-e2e.test.ts',
      '**/viktor-safe-e2e.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['api/**/*.ts', 'src/**/*.ts'],
      exclude: ['node_modules', 'dist', 'tests'],
    },
    testTimeout: 10000,
  },
});
