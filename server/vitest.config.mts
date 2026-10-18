import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    
    env: {
      LLM_API_KEY: 'test-api-key',
      LLM_MODEL: 'test-model',
    },
  },
});