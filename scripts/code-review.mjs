import { execSync } from 'node:child_process';

console.log('====================================================');
console.log('  Claint_B Full-Stack Open-Source Code Review Suite');
console.log('====================================================\n');

const checks = [
  {
    name: 'TypeScript (Backend)',
    cmd: 'npx tsc --noEmit',
  },
  {
    name: 'TypeScript (Frontend)',
    cmd: 'npm --prefix frontend exec -- tsc -b --noEmit',
  },
  {
    name: 'Prisma Schema Validation',
    cmd: 'npx prisma validate',
  },
  {
    name: 'ESLint (Backend + Frontend — Strict 0 Warnings)',
    cmd: 'npx eslint src/ frontend/src/ --max-warnings=0',
  },
  {
    name: 'Prettier (Code Formatting Check)',
    cmd: 'npx prettier --check "src/services/portfolio.service.ts" "src/pages/api/portfolio/**/*.ts" "src/pages/api/admin/portfolio/**/*.ts" "src/pages/api/uploads/**/*.ts" "src/lib/error-utils.ts" "frontend/src/**/*.{ts,tsx}"',
  },
  {
    name: 'Secretlint (Credential & API Key Leak Audit)',
    cmd: 'npx secretlint "src/**/*" "frontend/src/**/*" "prisma/schema.prisma"',
  },
  {
    name: 'CSpell (Spelling & Identifier Check)',
    cmd: 'npx cspell "src/services/portfolio.service.ts" "src/pages/api/portfolio/**/*.ts" "src/pages/api/admin/portfolio/**/*.ts" "src/pages/api/uploads/**/*.ts" "src/lib/error-utils.ts" "frontend/src/**/*.{ts,tsx}" --no-progress',
  },
  {
    name: 'Depcheck (Frontend Dependencies)',
    cmd: 'npx depcheck frontend --ignore-dirs=dist --ignores="@tailwindcss/vite,@types/*,tailwindcss,typescript,vite"',
  },
];

let failedCount = 0;

for (const check of checks) {
  process.stdout.write(`-> Running ${check.name}... `);
  try {
    execSync(check.cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('PASS');
  } catch (err) {
    failedCount += 1;
    console.log('ISSUES FOUND');
    const out = `${err.stdout || ''}\n${err.stderr || ''}`.trim();
    if (out) {
      const lines = out.split('\n').slice(0, 12);
      console.log('   ' + lines.join('\n   '));
      if (out.split('\n').length > 12) {
        console.log('   ... (truncated — run tool directly for full output)');
      }
    }
  }
}

console.log('\n====================================================');
console.log(`  Review Complete: ${checks.length - failedCount}/${checks.length} checks passed`);
console.log('====================================================');
if (failedCount > 0) process.exit(1);
