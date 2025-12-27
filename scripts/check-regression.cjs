#!/usr/bin/env node
// ============================================
// Regression Check Script
// Quick local verification before commit/push
// ============================================

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, emoji, message) {
  console.log(`${colors[color]}${emoji} ${message}${colors.reset}`);
}

function error(message) {
  log('red', '❌', message);
}

function success(message) {
  log('green', '✅', message);
}

function warning(message) {
  log('yellow', '⚠️ ', message);
}

function info(message) {
  log('blue', '🔍', message);
}

let hasErrors = false;

// ============================================
// Check 1: Critical files exist
// ============================================
info('Checking critical files...');

const criticalFiles = [
  'src/api-lib/lib/logger.ts',
  'api/handlers/admin.ts',
  'api/handlers/sentinel.ts',
  '.gitignore',
  'package.json',
  'tsconfig.json',
];

criticalFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    error(`REGRESSION: Critical file missing: ${file}`);
    hasErrors = true;
  }
});

if (!hasErrors) {
  success('All critical files present');
}

// ============================================
// Check 2: Security fixes verification
// ============================================
info('Verifying security fixes...');

// Check for API key logging
const adminContent = fs.readFileSync('api/handlers/admin.ts', 'utf-8');
if (/console\.log.*key.*length/i.test(adminContent)) {
  error('REGRESSION: API key length logging detected in admin.ts!');
  hasErrors = true;
}

// Check .env is gitignored
const gitignoreContent = fs.readFileSync('.gitignore', 'utf-8');
if (!/^\.env$/m.test(gitignoreContent)) {
  error('REGRESSION: .env not in .gitignore!');
  hasErrors = true;
}

// Check production guard exists
if (!/isProduction/.test(adminContent)) {
  error('REGRESSION: Production guard missing in handleResetDb!');
  hasErrors = true;
}

// Check logger exists and exports correctly
const loggerContent = fs.readFileSync('src/api-lib/lib/logger.ts', 'utf-8');
if (!/export const logger/.test(loggerContent)) {
  error('REGRESSION: Logger not properly exported!');
  hasErrors = true;
}

if (!hasErrors) {
  success('All security fixes verified');
}

// ============================================
// Check 3: No secrets in code
// ============================================
info('Scanning for hardcoded secrets...');

function scanDirectory(dir, extensions) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && !['node_modules', 'dist', '.git'].includes(file.name)) {
      results.push(...scanDirectory(fullPath, extensions));
    } else if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
      results.push(fullPath);
    }
  });

  return results;
}

const sourceFiles = [
  ...scanDirectory('api', ['.ts', '.js']),
  ...scanDirectory('src', ['.ts', '.tsx', '.js', '.jsx']),
].filter(f => !f.includes('/tests/'));

sourceFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Check for API keys (but allow short test strings)
  if (/sk-[a-zA-Z0-9]{20,}/.test(content)) {
    warning(`Potential API key found in: ${file}`);
    hasErrors = true;
  }
  
  // Check for Bearer tokens
  if (/Bearer [a-zA-Z0-9]{20,}/.test(content)) {
    warning(`Potential Bearer token found in: ${file}`);
    hasErrors = true;
  }
  
  // Check for sensitive console.log
  if (/console\.log.*\b(api.*key|secret|password|token)\b/i.test(content)) {
    warning(`Potential sensitive data logging in: ${file}`);
    // Not a hard error, just a warning
  }
});

if (!hasErrors) {
  success('No secrets detected in code');
}

// ============================================
// Check 4: Package.json version
// ============================================
info('Checking package.json...');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
if (!packageJson.version) {
  error('package.json missing version field!');
  hasErrors = true;
} else {
  success(`Package version: ${packageJson.version}`);
}

// ============================================
// Final result
// ============================================
console.log('');
if (hasErrors) {
  error('Regression checks FAILED!');
  error('Please fix the issues above before committing.');
  process.exit(1);
} else {
  success('All regression checks PASSED!');
  success('Safe to commit and push.');
  process.exit(0);
}
