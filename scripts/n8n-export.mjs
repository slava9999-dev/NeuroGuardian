#!/usr/bin/env node
// ============================================
// NeuroGUARDIAN — n8n Workflow Export Script
// Exports all workflows from local n8n to n8n-workflows/
// Usage: node scripts/n8n-export.mjs
// ============================================

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, '..', 'n8n-workflows');

// n8n API Configuration
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || 'neuroguardian-n8n-api-2024';

console.log('🔄 Starting n8n Workflow Export...');
console.log(`📍 n8n URL: ${N8N_URL}`);
console.log(`📁 Output: ${WORKFLOWS_DIR}`);

async function fetchWithAuth(endpoint) {
  const response = await fetch(`${N8N_URL}/api/v1${endpoint}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text}`);
  }

  return response.json();
}

async function exportWorkflows() {
  try {
    // 1. Fetch all workflows
    console.log('\n📋 Fetching workflows list...');
    const { data: workflows } = await fetchWithAuth('/workflows');
    
    console.log(`Found ${workflows.length} workflows\n`);

    // 2. Ensure output directory exists
    await fs.mkdir(WORKFLOWS_DIR, { recursive: true });

    // 3. Export each workflow
    let exported = 0;
    for (const wf of workflows) {
      try {
        // Fetch full workflow with nodes
        const fullWorkflow = await fetchWithAuth(`/workflows/${wf.id}`);
        
        // Create filename from workflow name
        const safeName = wf.name
          .toLowerCase()
          .replace(/[^a-z0-9\-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        const filename = `${safeName}-workflow.json`;
        const filepath = path.join(WORKFLOWS_DIR, filename);

        // Write to file
        await fs.writeFile(
          filepath,
          JSON.stringify(fullWorkflow, null, 2),
          'utf-8'
        );

        console.log(`✅ ${wf.name} → ${filename}`);
        exported++;
      } catch (err) {
        console.error(`❌ Failed to export "${wf.name}": ${err.message}`);
      }
    }

    // 4. Summary
    console.log(`\n🎉 Exported ${exported}/${workflows.length} workflows`);
    console.log(`📁 Location: ${WORKFLOWS_DIR}`);

    // 5. Update README
    await updateReadme(workflows);

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure n8n is running: docker ps | grep n8n');
    console.log('2. Check N8N_API_KEY is correct in docker/.env');
    console.log('3. Enable API in n8n: N8N_API_ENABLED=true');
    process.exit(1);
  }
}

async function updateReadme(workflows) {
  const readmePath = path.join(WORKFLOWS_DIR, 'README.md');
  
  const content = `# n8n Workflows

**Exported:** ${new Date().toISOString()}
**Count:** ${workflows.length}

## Workflows

| Name | Status | ID |
|------|--------|-----|
${workflows.map(w => `| ${w.name} | ${w.active ? '🟢 Active' : '⚪ Inactive'} | ${w.id} |`).join('\n')}

## Import

\`\`\`bash
# Import all workflows to a fresh n8n instance
node scripts/n8n-import.mjs
\`\`\`

## Manual Import

1. Open n8n UI
2. Workflows → Import from File
3. Select JSON file from this directory
`;

  await fs.writeFile(readmePath, content, 'utf-8');
  console.log('📝 Updated README.md');
}

// Run
exportWorkflows();
