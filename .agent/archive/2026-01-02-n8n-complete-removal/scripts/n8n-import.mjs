#!/usr/bin/env node
// ============================================
// NeuroGUARDIAN — n8n Workflow Import Script
// Imports all workflows from n8n-workflows/ to local n8n
// Usage: node scripts/n8n-import.mjs [--activate]
// ============================================

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, '..', 'n8n-workflows');

// n8n API Configuration
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || 'neuroguardian-n8n-api-2024';
const ACTIVATE = process.argv.includes('--activate');

console.log('📥 Starting n8n Workflow Import...');
console.log(`📍 n8n URL: ${N8N_URL}`);
console.log(`📁 Source: ${WORKFLOWS_DIR}`);
console.log(`🔌 Auto-activate: ${ACTIVATE ? 'YES' : 'NO'}`);

async function fetchWithAuth(endpoint, options = {}) {
  const response = await fetch(`${N8N_URL}/api/v1${endpoint}`, {
    ...options,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function importWorkflows() {
  try {
    // 1. Read all workflow JSON files
    console.log('\n📂 Reading workflow files...');
    
    const files = await fs.readdir(WORKFLOWS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('-workflow.json'));
    
    console.log(`Found ${jsonFiles.length} workflow files\n`);

    if (jsonFiles.length === 0) {
      console.log('⚠️ No workflows found. Run n8n-export.mjs first.');
      process.exit(0);
    }

    // 2. Get existing workflows to avoid duplicates
    const { data: existing } = await fetchWithAuth('/workflows');
    const existingNames = new Map(existing.map(w => [w.name, w.id]));

    // 3. Import each workflow
    let imported = 0;
    let updated = 0;
    let failed = 0;

    for (const file of jsonFiles) {
      try {
        const filepath = path.join(WORKFLOWS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const workflow = JSON.parse(content);

        // Remove id for clean import
        const { id, ...workflowData } = workflow;

        // Check if workflow already exists
        const existingId = existingNames.get(workflow.name);

        if (existingId) {
          // Update existing workflow
          await fetchWithAuth(`/workflows/${existingId}`, {
            method: 'PATCH',
            body: JSON.stringify(workflowData),
          });
          console.log(`🔄 Updated: ${workflow.name}`);
          updated++;

          // Activate if requested and was active in export
          if (ACTIVATE && workflow.active) {
            await fetchWithAuth(`/workflows/${existingId}/activate`, {
              method: 'POST',
            });
            console.log(`   ⚡ Activated`);
          }
        } else {
          // Create new workflow
          const created = await fetchWithAuth('/workflows', {
            method: 'POST',
            body: JSON.stringify(workflowData),
          });
          console.log(`✅ Imported: ${workflow.name}`);
          imported++;

          // Activate if requested and was active in export
          if (ACTIVATE && workflow.active && created.id) {
            await fetchWithAuth(`/workflows/${created.id}/activate`, {
              method: 'POST',
            });
            console.log(`   ⚡ Activated`);
          }
        }
      } catch (err) {
        console.error(`❌ Failed: ${file} - ${err.message}`);
        failed++;
      }
    }

    // 4. Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary:');
    console.log(`   ✅ New imports: ${imported}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(50));

    if (failed > 0) {
      console.log('\n⚠️ Some workflows failed to import.');
      console.log('Check credentials configuration in n8n UI after import.');
    }

    console.log(`\n🌐 Open n8n: ${N8N_URL}`);

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure n8n is running: docker ps | grep n8n');
    console.log('2. Check N8N_API_KEY is correct');
    console.log('3. Wait for n8n to fully start after docker up');
    process.exit(1);
  }
}

// Run
importWorkflows();
