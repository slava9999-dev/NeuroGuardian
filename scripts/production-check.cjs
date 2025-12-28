/**
 * NeuroGUARDIAN Production Readiness Checklist
 * Validates environment, security, and integrity before deployment.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🚀 Starting NeuroGUARDIAN Production Readiness Check...\n');

let errors = 0;
let warnings = 0;

// Helper to log status
const check = (name, status, message) => {
  const symbol = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  console.log(`${symbol} [${name}]: ${message}`);
  if (status === 'fail') errors++;
  if (status === 'warn') warnings++;
};

// 1. Environment Variables Check
const envPath = path.resolve(process.cwd(), '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('TEST_MODE=true')) {
    check('Env', 'fail', 'TEST_MODE is enabled in .env.production!');
  } else {
    check('Env', 'pass', 'TEST_MODE is disabled.');
  }

  if (envContent.includes('MOCK_MODE=true')) {
    check('Env', 'fail', 'MOCK_MODE is enabled in .env.production!');
  }

  if (!envContent.includes('TELEGRAM_BOT_TOKEN') || envContent.includes('TELEGRAM_BOT_TOKEN=')) { // check non-empty
     // Simple check, might need better parsing if multi-line or empty
     check('Env', 'warn', 'Verify TELEGRAM_BOT_TOKEN is set.');
  }

  check('Env', 'pass', '.env.production exists.');
} else {
  // Check if we are in CI or Vercel where env might be injected
  if (process.env.CI || process.env.VERCEL) {
     check('Env', 'pass', 'Assuming environment variables checks handled by CI/Vercel.');
  } else {
     check('Env', 'warn', '.env.production missing (might be using system env).');
  }
}

// 2. npm audit check
try {
  console.log('   Running npm audit...');
  // Only high/critical in production
  execSync('npm audit --audit-level=high', { stdio: 'ignore' });
  check('Security', 'pass', 'No High/Critical vulnerabilities found.');
} catch (e) {
  check('Security', 'fail', 'High/Critical vulnerabilities found! Run `npm audit`.');
}

// 3. Type Check
try {
  console.log('   Running type check...');
  execSync('npm run typecheck', { stdio: 'ignore' });
  check('Types', 'pass', 'TypeScript compilation successful.');
} catch (e) {
  check('Types', 'fail', 'TypeScript errors found! Run `npm run typecheck`.');
}

// 4. Critical Files Presence
const criticalFiles = [
  'src/lib/productionGuard.ts',
  'src/api-lib/lib/constants.ts',
  'src/api-lib/services/ops-logger.ts',
  'migrations/012_ops_events.sql'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(path.resolve(process.cwd(), file))) {
    check('Files', 'pass', `${file} exists.`);
  } else {
    check('Files', 'fail', `${file} is MISSING!`);
  }
});

// 5. Code pattern scan (Mock data in sensitive files)
const sensitiveFiles = [
    'src/lib/agentApi.ts',
    'src/api-lib/lib/constants.ts'
];

sensitiveFiles.forEach(file => {
    const filePath = path.resolve(process.cwd(), file);
    if(fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('getMockResponse') && !content.includes('throw new Error')) {
            // Very basic heuristic
             check('Code', 'warn', `Verify mock usage in ${file}.`);
        } else {
             check('Code', 'pass', `${file} passed mock check.`);
        }
    }
});


console.log('\n============================================');
if (errors > 0) {
  console.error(`🛑 FAILED: ${errors} errors, ${warnings} warnings.`);
  console.error('Fix critical errors before deploying to production.');
  process.exit(1);
} else {
  console.log(`✅ PASSED: Ready for Production! (${warnings} warnings)`);
  process.exit(0);
}
