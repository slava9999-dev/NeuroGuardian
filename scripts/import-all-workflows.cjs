#!/usr/bin/env node
/**
 * Импорт ВСЕХ workflows в n8n
 * 
 * Использование:
 *   node scripts/import-all-workflows.cjs
 * 
 * Требуется: N8N_API_KEY в .env.n8n
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

// Manual .env.n8n parsing (no external deps)
function loadEnv(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
  return env;
}

const envVars = loadEnv('.env.n8n');

const CONFIG = {
  n8n: {
    host: envVars.N8N_HOST || 'localhost',
    port: parseInt(envVars.N8N_PORT || '5678'),
    apiKey: envVars.N8N_API_KEY || ''
  },
  workflowDir: './n8n-workflows',
  workflows: [
    'sentinel-workflow.json',
    'sync-workflow.json',
    'monitoring-workflow.json'
  ]
};

// Validate API key
if (!CONFIG.n8n.apiKey) {
  console.error('❌ N8N_API_KEY not found in .env.n8n');
  console.log('   Add: N8N_API_KEY=your-api-key-here');
  process.exit(1);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.n8n.host,
      port: CONFIG.n8n.port,
      path: path,
      method: method,
      headers: {
        'X-N8N-API-KEY': CONFIG.n8n.apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function importWorkflow(filename) {
  const filepath = path.join(CONFIG.workflowDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`   ⚠️  Файл не найден: ${filename}`);
    return null;
  }
  
  const workflowData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  console.log(`   📖 ${workflowData.name}`);
  
  // Подготавливаем данные для API
  const importData = {
    name: workflowData.name,
    nodes: workflowData.nodes,
    connections: workflowData.connections,
    settings: workflowData.settings || { executionOrder: 'v1' }
  };

  const createRes = await makeRequest('POST', '/api/v1/workflows', importData);
  
  if (createRes.status === 200 || createRes.status === 201) {
    const newWorkflow = createRes.data;
    console.log(`   ✅ Создан (ID: ${newWorkflow.id})`);
    return newWorkflow;
  } else {
    console.log(`   ❌ Ошибка: ${JSON.stringify(createRes.data)}`);
    return null;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   n8n Import ALL Workflows                     ║');
  console.log('║   NeuroGUARDIAN System                          ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Проверяем подключение к n8n
  console.log('🔌 Проверяем подключение к n8n...');
  try {
    const health = await makeRequest('GET', '/healthz');
    if (health.status !== 200) {
      throw new Error('n8n не отвечает');
    }
    console.log('   ✅ n8n доступен\n');
  } catch (error) {
    console.error('   ❌ Не удалось подключиться к n8n');
    console.log('   💡 Запустите: docker-compose -f docker-compose.n8n.yml up -d');
    process.exit(1);
  }

  // Получаем существующие workflows
  console.log('📋 Получаем существующие workflows...');
  const workflowsRes = await makeRequest('GET', '/api/v1/workflows');
  const existingWorkflows = workflowsRes.data?.data || [];
  console.log(`   📊 Найдено: ${existingWorkflows.length}\n`);

  // Удаляем старые NeuroGUARDIAN workflows
  console.log('🗑️  Удаляем старые workflows...');
  for (const w of existingWorkflows) {
    if (w.name.toLowerCase().includes('neuroguardian')) {
      await makeRequest('DELETE', `/api/v1/workflows/${w.id}`);
      console.log(`   ✅ Удалён: ${w.name}`);
    }
  }
  console.log('');

  // Импортируем новые workflows
  console.log('📤 Импортируем workflows...\n');
  const imported = [];
  
  for (const filename of CONFIG.workflows) {
    const result = await importWorkflow(filename);
    if (result) {
      imported.push(result);
    }
    console.log('');
  }

  // Итог
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║               🎉 ГОТОВО!                       ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Импортировано: ${imported.length}/${CONFIG.workflows.length} workflows              ║`);
  console.log('╠════════════════════════════════════════════════╣');
  
  for (const w of imported) {
    const name = w.name.substring(0, 40).padEnd(40);
    console.log(`║  ${name} ║`);
  }
  
  console.log('╚════════════════════════════════════════════════╝\n');
  console.log('📌 Откройте: http://localhost:5678/home/workflows\n');
  console.log('⚡ Активируйте workflows вручную в n8n!\n');
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err.message);
  process.exit(1);
});
