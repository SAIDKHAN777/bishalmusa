import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

export async function setup() {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    throw new Error('FATAL: TEST_DATABASE_URL is not configured in environment.');
  }

  // Refusal guard: Ensure URL contains 'test' or 'portfolio_test_db'
  if (!testDbUrl.includes('test') && !testDbUrl.includes('portfolio_test_db')) {
    throw new Error(
      `SAFETY REFUSAL: TEST_DATABASE_URL ("${testDbUrl}") does not appear to be a test database! Refusing to run tests.`
    );
  }

  process.env.DATABASE_URL = testDbUrl;
  process.env.DIRECT_URL = testDbUrl;

  console.log('\n[Vitest Global Setup] Running migrations on test database...');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl },
    stdio: 'inherit',
  });

  console.log('[Vitest Global Setup] Ensuring baseline seed exists on test database...');
  execSync('npx tsx prisma/seed.ts', {
    env: { ...process.env, DATABASE_URL: testDbUrl, DIRECT_URL: testDbUrl, NODE_ENV: 'development', SEED_SAMPLE_DATA: 'true' },
    stdio: 'inherit',
  });
}
