#!/usr/bin/env node
/**
 * Auto-import n8n workflows via REST API
 * Usage: node scripts/import-n8n-workflows.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';
const API_KEY = process.env.N8N_API_KEY || 'neuroguardian-n8n-api-2024';

async function importWorkflow(workflow) {
  // Only keep minimal fields for n8n API v1
  const workflowData = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || {}
  };
  
  const res = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': API_KEY
    },
    body: JSON.stringify(workflowData)
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`${res.status}: ${error}`);
  }
  
  return res.json();
}

async function activateWorkflow(id) {
  const res = await fetch(`${N8N_URL}/api/v1/workflows/${id}/activate`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': API_KEY
    }
  });
  return res.ok;
}

async function main() {
  console.log('🚀 Starting n8n workflows import via REST API...\n');
  console.log(`   URL: ${N8N_URL}`);
  console.log(`   API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('');
  
  // Wait for n8n to be ready
  console.log('⏳ Waiting for n8n to be ready...');
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(`${N8N_URL}/api/v1/workflows`, {
        headers: { 'X-N8N-API-KEY': API_KEY }
      });
      if (res.ok) {
        console.log('   ✅ n8n is ready!\n');
        break;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  const workflowsDir = path.join(__dirname, '..', 'n8n-workflows');
  const files = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.json') && f.includes('workflow'));
  
  console.log(`📁 Found ${files.length} workflow files\n`);
  
  // Import workflows
  console.log('📥 Importing workflows...');
  const imported = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(workflowsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const workflow = JSON.parse(content);
      
      const result = await importWorkflow(workflow);
      imported.push({ id: result.id, name: workflow.name, active: workflow.active });
      console.log(`   ✅ ${workflow.name}`);
    } catch (e) {
      console.log(`   ❌ ${file}: ${e.message}`);
    }
  }
  
  // Activate workflows
  console.log('\n⚡ Activating workflows...');
  for (const wf of imported) {
    if (wf.active) {
      try {
        await activateWorkflow(wf.id);
        console.log(`   ✅ Activated: ${wf.name}`);
      } catch (e) {
        console.log(`   ⚠️  Could not activate: ${wf.name}`);
      }
    }
  }
  
  console.log(`\n✨ Done! Imported ${imported.length} workflows.`);
}

main().catch(console.error);
