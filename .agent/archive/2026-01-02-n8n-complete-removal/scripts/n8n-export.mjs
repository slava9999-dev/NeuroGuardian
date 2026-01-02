#!/usr/bin/env node
// ============================================
// NeuroGUARDIAN — n8n Workflow Export Script
// Exports all workflows from local n8n to n8n-workflows/
// Usage: node scripts/n8n-export.mjs
// 
// Methods:
// 1. Docker CLI (default) - uses n8n export:workflow inside container
// 2. REST API - requires N8N_API_KEY created in n8n UI
// ============================================

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, '..', 'n8n-workflows');

// Configuration
const N8N_CONTAINER = process.env.N8N_CONTAINER || 'ng_n8n';
const USE_API = process.env.N8N_USE_API === 'true';
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔄 Starting n8n Workflow Export...');
console.log(`📁 Output: ${WORKFLOWS_DIR}`);

async function exportViaDocker() {
  console.log(`🐳 Using Docker CLI (container: ${N8N_CONTAINER})`);
  
  try {
    // Export all workflows to temp file inside container
    const tempFile = '/tmp/n8n-export.json';
    const exportCmd = `docker exec ${N8N_CONTAINER} n8n export:workflow --all --output=${tempFile}`;
    
    console.log('\n📋 Exporting workflows...');
    const output = execSync(exportCmd, { encoding: 'utf-8' });
    console.log(output.trim());
    
    // Copy from container to host
    const localFile = path.join(WORKFLOWS_DIR, 'all-workflows-export.json');
    const cpCmd = `docker cp ${N8N_CONTAINER}:${tempFile} "${localFile}"`;
    execSync(cpCmd, { encoding: 'utf-8' });
    
    // Parse and split into individual files
    const content = await fs.readFile(localFile, 'utf-8');
    const workflows = JSON.parse(content);
    
    console.log(`\nFound ${workflows.length} workflows\n`);
    
    // Export each workflow as separate file
    let exported = 0;
    for (const wf of workflows) {
      const safeName = wf.name
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const filename = `${safeName}-workflow.json`;
      const filepath = path.join(WORKFLOWS_DIR, filename);
      
      await fs.writeFile(filepath, JSON.stringify(wf, null, 2), 'utf-8');
      console.log(`✅ ${wf.name} → ${filename}`);
      exported++;
    }
    
    // Update README
    await updateReadme(workflows);
    
    console.log(`\n🎉 Exported ${exported} workflows`);
    console.log(`📁 Location: ${WORKFLOWS_DIR}`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure n8n container is running: docker ps | grep n8n');
    console.log(`2. Check container name: ${N8N_CONTAINER}`);
    console.log('3. Or use API method: N8N_USE_API=true N8N_API_KEY=xxx npm run n8n:export');
    process.exit(1);
  }
}

async function exportViaAPI() {
  console.log(`🌐 Using REST API: ${N8N_URL}`);
  
  if (!N8N_API_KEY) {
    console.error('❌ N8N_API_KEY required for API method');
    console.log('Create API key in n8n: Settings → API → Create API Key');
    process.exit(1);
  }
  
  try {
    const response = await fetch(`${N8N_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }
    
    const { data: workflows } = await response.json();
    console.log(`Found ${workflows.length} workflows\n`);
    
    await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
    
    let exported = 0;
    for (const wf of workflows) {
      const fullResponse = await fetch(`${N8N_URL}/api/v1/workflows/${wf.id}`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY },
      });
      const fullWorkflow = await fullResponse.json();
      
      const safeName = wf.name
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const filename = `${safeName}-workflow.json`;
      const filepath = path.join(WORKFLOWS_DIR, filename);
      
      await fs.writeFile(filepath, JSON.stringify(fullWorkflow, null, 2), 'utf-8');
      console.log(`✅ ${wf.name} → ${filename}`);
      exported++;
    }
    
    await updateReadme(workflows);
    
    console.log(`\n🎉 Exported ${exported} workflows`);
    
  } catch (error) {
    console.error('\n❌ API Export failed:', error.message);
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
${workflows.map(w => `| ${w.name} | ${w.active ? '🟢 Active' : '⚪ Inactive'} | ${w.id || 'local'} |`).join('\n')}

## Export

\`\`\`bash
# Export via Docker CLI (default)
npm run n8n:export

# Export via REST API
N8N_USE_API=true N8N_API_KEY=xxx npm run n8n:export
\`\`\`

## Import

\`\`\`bash
# Import all workflows to a fresh n8n instance
npm run n8n:import
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
if (USE_API) {
  exportViaAPI();
} else {
  exportViaDocker();
}
