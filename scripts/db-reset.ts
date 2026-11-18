import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || '';

function isLocalDatabase(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === 'postgres' // Docker container hostname
    );
  } catch {
    return false;
  }
}

console.log('🔍 Checking database URL safety before reset...');

if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

if (!isLocalDatabase(dbUrl)) {
  console.error('⛔ REFUSED: db:reset is strictly forbidden against non-local databases!');
  console.error(`Target host is: ${dbUrl}`);
  process.exit(1);
}

console.log('✅ Local database verified. Proceeding with Prisma migrate reset...');
try {
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
  console.log('🚀 Database successfully reset and re-migrated.');
} catch (error) {
  console.error('❌ Database reset failed:', error);
  process.exit(1);
}
