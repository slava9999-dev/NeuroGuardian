#!/usr/bin/env node

/**
 * ============================================
 * Security Agent - Secret Scanner
 * ============================================
 * Scans code for potential secrets before commit
 * Run: node scripts/scan-secrets.js [files...]
 * ============================================
 */

const fs = require('fs');
const path = require('path');

// Secret patterns to detect (only high-confidence patterns)
const SECRET_PATTERNS = [
  // API Keys - specific, high-confidence patterns
  { name: 'OpenAI API Key', pattern: /sk-(?:proj-)?[a-zA-Z0-9]{20,}/g },
  { name: 'Groq API Key', pattern: /gsk_[a-zA-Z0-9]{20,}/g },
  
  // Cloud providers - specific patterns only
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  
  // Telegram - specific format
  { name: 'Telegram Bot Token', pattern: /\d{9,10}:[a-zA-Z0-9_-]{35}/g },
  
  // Private keys - very specific
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g },
  
  // Connection strings with credentials
  { name: 'Database URL with Password', pattern: /(postgres|mysql|mongodb):\/\/[^:]+:[^@\s]+@[^\s]+/gi },
  
  // JWT tokens (only if assigned to variable)
  { name: 'JWT Token', pattern: /['"]eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}['"]/g },
];

// Files to ignore
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /\.env\.example/,
  /\.md$/,
  /scan-secrets\.(js|cjs)$/,
  /init-vault\.(js|cjs)$/,
  /\.test\.ts$/,
  /tests\//,
  /package-lock\.json$/,   // Contains SHA hashes, not secrets
  /yarn\.lock$/,           // Same
  /pnpm-lock\.yaml$/,      // Same
];

// Allowed false positives (e.g., placeholder values)
const ALLOWED_VALUES = [
  'your_',
  'replace_',
  'xxx',
  'test-',
  'dev-',
  'example',
  'placeholder',
  'CHANGE_ME',
];

function calculateEntropy(str) {
  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isAllowedValue(match) {
  const lower = match.toLowerCase();
  return ALLOWED_VALUES.some(allowed => lower.includes(allowed));
}

function scanFile(filePath) {
  const findings = [];
  
  // Check if file should be ignored
  if (IGNORE_PATTERNS.some(pattern => pattern.test(filePath))) {
    return findings;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const { name, pattern, minEntropy } of SECRET_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const matchValue = match[0];
        
        // Skip allowed values
        if (isAllowedValue(matchValue)) continue;
        
        // Check entropy if required
        if (minEntropy) {
          const entropy = calculateEntropy(matchValue);
          if (entropy < minEntropy) continue;
        }
        
        // Find line number
        const lineIndex = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineIndex - 1] || '';
        
        findings.push({
          file: filePath,
          line: lineIndex,
          type: name,
          preview: lineContent.substring(0, 100).trim(),
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning ${filePath}: ${error.message}`);
  }

  return findings;
}

function scanDirectory(dir) {
  const findings = [];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (IGNORE_PATTERNS.some(pattern => pattern.test(fullPath))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const fileFindings = scanFile(fullPath);
        findings.push(...fileFindings);
      }
    }
  }
  
  walk(dir);
  return findings;
}

function main() {
  console.log('🔍 Scanning for secrets...\n');
  
  const args = process.argv.slice(2);
  let findings = [];
  
  if (args.length > 0) {
    // Scan specific files
    for (const file of args) {
      findings.push(...scanFile(file));
    }
  } else {
    // Scan current directory
    findings = scanDirectory(process.cwd());
  }
  
  if (findings.length === 0) {
    console.log('✅ No secrets detected!\n');
    process.exit(0);
  }
  
  console.log('❌ POTENTIAL SECRETS DETECTED:\n');
  console.log('=' .repeat(80));
  
  for (const finding of findings) {
    console.log(`
📁 File: ${finding.file}
📍 Line: ${finding.line}
🏷️  Type: ${finding.type}
📝 Preview: ${finding.preview}
`);
    console.log('-'.repeat(80));
  }
  
  console.log(`
⚠️  Found ${findings.length} potential secret(s)!

Please review each finding:
1. If it's a real secret - remove it and use Vault
2. If it's a placeholder - add it to ALLOWED_VALUES
3. If it's a false positive - add pattern to IGNORE_PATTERNS

To use Vault instead:
  const apiKey = await SecurityAgent.secrets.get({
    userId: 'your_user_id',
    key: 'your_secret_key',
    purpose: 'your_purpose',
    ttl: 300
  });
`);
  
  process.exit(1);
}

main();
