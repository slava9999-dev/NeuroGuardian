#!/usr/bin/env node
// sync-env-to-n8n.js
// Синхронизирует переменные из Vercel в n8n

import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const N8N_CONFIG = {
  url: process.env.N8N_URL || 'https://your-n8n-instance.com',
  apiKey: process.env.N8N_API_KEY, // Получить в n8n Settings → API
};

const VERCEL_CONFIG = {
  token: process.env.VERCEL_TOKEN, // Получить на vercel.com/account/tokens
  projectId: process.env.VERCEL_PROJECT_ID,
};

// Переменные которые нужно синхронизировать
const VARS_TO_SYNC = [
  'CRON_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'OPENAI_API_KEY',
  'ADMIN_API_KEY',
  'ENCRYPTION_KEY',
  // Добавьте нужные переменные
];

// ============================================
// ФУНКЦИИ
// ============================================

/**
 * Получить переменные из Vercel
 */
async function getVercelEnvVars() {
  const url = `https://api.vercel.com/v9/projects/${VERCEL_CONFIG.projectId}/env`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${VERCEL_CONFIG.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Vercel API error: ${response.status}`);
  }

  const data = await response.json();
  return data.envs;
}

/**
 * Установить переменную в n8n
 */
async function setN8nVariable(key, value) {
  const url = `${N8N_CONFIG.url}/api/v1/variables`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_CONFIG.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'string',
    }),
  });

  if (!response.ok) {
    // Если переменная уже существует, обновляем
    if (response.status === 409) {
      return updateN8nVariable(key, value);
    }
    throw new Error(`n8n API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Обновить существующую переменную в n8n
 */
async function updateN8nVariable(key, value) {
  const url = `${N8N_CONFIG.url}/api/v1/variables/${key}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'X-N8N-API-KEY': N8N_CONFIG.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      value,
    }),
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Основная функция синхронизации
 */
async function syncEnvVars() {
  console.log('🔄 Начинаем синхронизацию переменных...\n');

  try {
    // 1. Получаем переменные из Vercel
    console.log('📥 Получаем переменные из Vercel...');
    const vercelVars = await getVercelEnvVars();
    
    // 2. Фильтруем только нужные
    const varsToSync = vercelVars.filter(v => 
      VARS_TO_SYNC.includes(v.key) && v.target.includes('production')
    );

    console.log(`✅ Найдено ${varsToSync.length} переменных для синхронизации\n`);

    // 3. Синхронизируем каждую переменную
    let synced = 0;
    let failed = 0;

    for (const envVar of varsToSync) {
      try {
        console.log(`  📤 ${envVar.key}...`);
        await setN8nVariable(envVar.key, envVar.value);
        console.log(`  ✅ ${envVar.key} синхронизирована`);
        synced++;
      } catch (error) {
        console.error(`  ❌ ${envVar.key} ошибка: ${error.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Синхронизация завершена!`);
    console.log(`   Успешно: ${synced}`);
    console.log(`   Ошибок: ${failed}`);

  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error.message);
    process.exit(1);
  }
}

// ============================================
// ЗАПУСК
// ============================================

syncEnvVars();
