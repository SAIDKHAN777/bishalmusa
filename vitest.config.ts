import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('FATAL: TEST_DATABASE_URL is not configured in environment.');
}

if (!testDbUrl.includes('test') && !testDbUrl.includes('portfolio_test_db')) {
  throw new Error(
    `SAFETY REFUSAL: TEST_DATABASE_URL ("${testDbUrl}") does not appear to be a test database! Refusing to run tests.`
  );
}

// Point process.env.DATABASE_URL to TEST_DATABASE_URL
process.env.DATABASE_URL = testDbUrl;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: testDbUrl,
      NODE_ENV: 'test',
    },
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.ts'],
      reporter: ['text', 'json', 'html'],
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
