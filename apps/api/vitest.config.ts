import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], hookTimeout: 240_000, testTimeout: 240_000, fileParallelism: false },
});
