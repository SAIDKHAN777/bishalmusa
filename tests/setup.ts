import dotenv from 'dotenv';

dotenv.config();

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('FATAL: TEST_DATABASE_URL is not set in environment.');
}

if (!testDbUrl.includes('test') && !testDbUrl.includes('portfolio_test_db')) {
  throw new Error(
    `SAFETY REFUSAL: TEST_DATABASE_URL ("${testDbUrl}") does not appear to be a test database! Refusing to run tests.`
  );
}

// Force process.env.DATABASE_URL to TEST_DATABASE_URL for all test workers
process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;
