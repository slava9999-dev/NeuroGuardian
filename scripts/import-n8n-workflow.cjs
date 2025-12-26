#!/usr/bin/env node
/**
 * Автоматический импорт workflow в n8n
 * 
 * Использование:
 *   node scripts/import-n8n-workflow.cjs
 * 
 * Требуется: N8N_API_KEY в .env.n8n
 */

const fs = require('fs');
const http = require('http');

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
  workflowFile: './n8n-workflows/sentinel-workflow.json'
};

// Validate API key
if (!CONFIG.n8n.apiKey) {
  console.error('❌ N8N_API_KEY not found in .env.n8n');
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

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   n8n Workflow Auto-Import                     ║');
  console.log('║   NeuroGUARDIAN Sentinel                        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // 1. Читаем workflow файл
  console.log('📖 Читаем workflow файл...');
  if (!fs.existsSync(CONFIG.workflowFile)) {
    console.error(`❌ Файл не найден: ${CONFIG.workflowFile}`);
    process.exit(1);
  }
  
  const workflowData = JSON.parse(fs.readFileSync(CONFIG.workflowFile, 'utf-8'));
  console.log(`   ✅ Загружен: ${workflowData.name}`);
  console.log(`   📊 Нод: ${workflowData.nodes.length}`);

  // 2. Проверяем подключение к n8n
  console.log('\n🔌 Проверяем подключение к n8n...');
  try {
    const health = await makeRequest('GET', '/healthz');
    if (health.status !== 200) {
      throw new Error('n8n не отвечает');
    }
    console.log('   ✅ n8n доступен');
  } catch (error) {
    console.error('   ❌ Не удалось подключиться к n8n');
    console.log('   💡 Убедитесь что Docker запущен:');
    console.log('      docker-compose -f docker-compose.n8n.yml up -d');
    process.exit(1);
  }

  // 3. Получаем список существующих workflows
  console.log('\n📋 Проверяем существующие workflows...');
  const workflowsRes = await makeRequest('GET', '/api/v1/workflows');
  
  if (workflowsRes.status !== 200) {
    console.error('   ❌ Ошибка получения списка:', workflowsRes.data);
    process.exit(1);
  }

  const existingWorkflows = workflowsRes.data.data || [];
  console.log(`   📊 Найдено workflows: ${existingWorkflows.length}`);

  // 4. Ищем существующий Sentinel workflow
  const existingSentinel = existingWorkflows.find(w => 
    w.name.toLowerCase().includes('sentinel') || 
    w.name.toLowerCase().includes('neuroguardian')
  );

  // 5. Удаляем старый если есть
  if (existingSentinel) {
    console.log(`\n🗑️  Удаляем старый workflow: ${existingSentinel.name} (ID: ${existingSentinel.id})`);
    const deleteRes = await makeRequest('DELETE', `/api/v1/workflows/${existingSentinel.id}`);
    if (deleteRes.status === 200 || deleteRes.status === 204) {
      console.log('   ✅ Удалён');
    } else {
      console.log('   ⚠️  Не удалось удалить, продолжаем...');
    }
  }

  // 6. Создаём новый workflow
  console.log('\n📤 Импортируем новый workflow...');
  
  // Подготавливаем данные для API (active is read-only, set via PATCH)
  const importData = {
    name: workflowData.name,
    nodes: workflowData.nodes,
    connections: workflowData.connections,
    settings: workflowData.settings || { executionOrder: 'v1' }
  };

  const createRes = await makeRequest('POST', '/api/v1/workflows', importData);
  
  if (createRes.status === 200 || createRes.status === 201) {
    const newWorkflow = createRes.data;
    console.log(`   ✅ Создан: ${newWorkflow.name}`);
    console.log(`   🔗 ID: ${newWorkflow.id}`);
    console.log(`   📊 Нод: ${newWorkflow.nodes?.length || 0}`);

    // 7. Активируем workflow
    console.log('\n⚡ Активируем workflow...');
    const activateRes = await makeRequest('PATCH', `/api/v1/workflows/${newWorkflow.id}`, {
      active: true
    });
    
    if (activateRes.status === 200) {
      console.log('   ✅ Workflow активирован!');
    } else {
      console.log('   ⚠️  Активируйте вручную в n8n');
    }

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║               🎉 ГОТОВО!                       ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  Workflow: ${newWorkflow.name.substring(0, 35).padEnd(35)} ║`);
    console.log(`║  URL: http://localhost:5678/workflow/${newWorkflow.id}  ║`);
    console.log('╚════════════════════════════════════════════════╝\n');

  } else {
    console.error('   ❌ Ошибка создания:', createRes.data);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Критическая ошибка:', err.message);
  process.exit(1);
});
