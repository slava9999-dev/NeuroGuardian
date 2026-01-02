#!/usr/bin/env node

/**
 * Vercel to n8n Environment Variables Sync Script
 * 
 * Синхронизирует переменные окружения из Vercel в локальный n8n
 * 
 * Требования:
 * - Node.js 16+
 * - Vercel CLI (npm install -g vercel)
 * 
 * Использование:
 *   node scripts/sync-vercel-to-n8n.js                # Автосинхронизация
 *   node scripts/sync-vercel-to-n8n.js --dry-run      # Тестовый запуск
 *   node scripts/sync-vercel-to-n8n.js --export       # Экспорт в .env.n8n
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============ КОНФИГУРАЦИЯ ============

const CONFIG = {
  // n8n настройки
  n8n: {
    baseUrl: 'http://localhost:5678',
    envFile: '.env.n8n',  // Локальный файл для Docker
  },
  
  // Vercel настройки
  vercel: {
    projectName: 'neuro-guardian',
    environment: 'production',
  },
  
  // Опции синхронизации
  sync: {
    dryRun: false,
    overwrite: true,
    excludePatterns: [
      'VERCEL_*',           // Системные Vercel
      'NEXT_PUBLIC_*',      // Публичные Next.js
      'POSTGRES_PASSWORD',  // Секретные
      'ENCRYPTION_KEY',
      'YOOKASSA_SECRET_KEY',
    ],
    // Переменные которые ОБЯЗАТЕЛЬНО нужны для n8n
    requiredVars: [
      'CRON_SECRET',
      'TELEGRAM_BOT_TOKEN',
      'ADMIN_API_KEY',
      'OPENAI_API_KEY',
    ],
  },
};

// ============ ОСНОВНОЙ КОД ============

class VercelToN8nSync {
  constructor(config) {
    this.config = config;
    this.stats = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
  }

  /**
   * Получить переменные из Vercel API
   */
  async getVercelEnvVars() {
    console.log('📥 Получение переменных из Vercel API...');
    
    const token = process.env.VERCEL_TOKEN || process.argv[2];
    
    if (!token || token.startsWith('--')) {
      console.log(`
❌ Требуется Vercel Token!

Использование:
  node scripts/sync-vercel-to-n8n.cjs YOUR_VERCEL_TOKEN

Получить токен:
  1. Откройте: https://vercel.com/account/tokens
  2. Нажмите "Create Token"
  3. Скопируйте и вставьте в команду
`);
      process.exit(1);
    }
    
    const https = require('https');
    const projectId = 'prj_o1iWqASNGs9hX2YKgjpSpvlpKSxY';
    const teamId = 'team_ako4Zs43jWPxUelg7nCBya9V';
    
    return new Promise((resolve, reject) => {
      const url = `/v9/projects/${projectId}/env?teamId=${teamId}&decrypt=true`;
      
      const options = {
        hostname: 'api.vercel.com',
        path: url,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`❌ API Error: ${res.statusCode}`);
            console.error(data);
            reject(new Error(`API Error: ${res.statusCode}`));
            return;
          }
          
          try {
            const response = JSON.parse(data);
            const envVars = (response.envs || []).map(v => ({
              key: v.key,
              value: v.value || ''
            }));
            
            console.log(`✅ Найдено ${envVars.length} переменных в Vercel\n`);
            resolve(envVars);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Фильтрация переменных
   */
  filterEnvVars(envVars) {
    const { excludePatterns } = this.config.sync;
    
    return envVars.filter(envVar => {
      const key = envVar.key;
      
      // Проверяем паттерны исключения
      for (const pattern of excludePatterns) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        if (regex.test(key)) {
          console.log(`  ⏭️  ${key} (исключён по паттерну)`);
          this.stats.skipped++;
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Синхронизировать переменные
   */
  async syncToN8n(vercelVars) {
    console.log('\n🔄 Синхронизация в .env.n8n...\n');
    
    const { dryRun } = this.config.sync;
    const envPath = this.config.n8n.envFile;
    
    let envContent = `# n8n Environment Variables for NeuroGUARDIAN
# Автоматически сгенерировано: ${new Date().toISOString()}
# Источник: Vercel ${this.config.vercel.environment}

# API
API_URL=https://neuro-guardian.vercel.app

`;
    
    for (const envVar of vercelVars) {
      const { key, value } = envVar;
      this.stats.total++;
      
      // Проверяем наличие значения
      if (!value || value === 'undefined' || value === 'null') {
        console.log(`  ⚠️  ${key} (пустое значение)`);
        this.stats.skipped++;
        continue;
      }
      
      console.log(`  ✅ ${key}`);
      envContent += `${key}=${value}\n`;
      this.stats.created++;
    }
    
    // Добавляем ADMIN_CHAT_ID если нет
    if (!envContent.includes('ADMIN_CHAT_ID')) {
      envContent += `\n# Admin\nADMIN_CHAT_ID=7548070478\n`;
    }
    
    // Записываем файл
    if (!dryRun) {
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log(`\n✅ Записано в ${envPath}`);
    } else {
      console.log('\n⚠️  DRY RUN - изменения не применены');
      console.log('\n--- Содержимое файла ---');
      console.log(envContent);
      console.log('--- Конец файла ---');
    }
  }

  /**
   * Проверить обязательные переменные
   */
  checkRequiredVars(envVars) {
    const { requiredVars } = this.config.sync;
    const missing = [];
    
    for (const required of requiredVars) {
      const found = envVars.find(v => v.key === required);
      if (!found || !found.value) {
        missing.push(required);
      }
    }
    
    if (missing.length > 0) {
      console.log('\n⚠️  ВНИМАНИЕ! Отсутствуют обязательные переменные:');
      missing.forEach(v => console.log(`   - ${v}`));
      console.log('\nДобавьте их в Vercel или .env.n8n вручную.');
    }
  }

  /**
   * Показать статистику
   */
  printStats() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 СТАТИСТИКА СИНХРОНИЗАЦИИ');
    console.log('═'.repeat(50));
    console.log(`   Всего обработано:  ${this.stats.total}`);
    console.log(`   ✨ Добавлено:       ${this.stats.created}`);
    console.log(`   ⏭️  Пропущено:       ${this.stats.skipped}`);
    console.log(`   ❌ Ошибок:          ${this.stats.errors}`);
    console.log('═'.repeat(50));
  }

  /**
   * Запустить синхронизацию
   */
  async run() {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║   Vercel → n8n Environment Variables Sync      ║');
    console.log('║   NeuroGUARDIAN                                 ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    try {
      // 1. Получаем переменные из Vercel
      const vercelVars = await this.getVercelEnvVars();
      
      // 2. Фильтруем переменные
      console.log('🔍 Фильтрация переменных...');
      const filteredVars = this.filterEnvVars(vercelVars);
      
      // 3. Проверяем обязательные
      this.checkRequiredVars(filteredVars);
      
      // 4. Синхронизируем
      await this.syncToN8n(filteredVars);
      
      // 5. Показываем статистику
      this.printStats();
      
      // 6. Инструкции
      if (!this.config.sync.dryRun) {
        console.log('\n🚀 Следующий шаг:');
        console.log('   docker-compose -f docker-compose.n8n.yml --env-file .env.n8n up -d');
      }
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error.message);
      process.exit(1);
    }
  }
}

// ============ ЗАПУСК ============

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Использование:
  node scripts/sync-vercel-to-n8n.js [опции]

Опции:
  --dry-run    Тестовый запуск без записи
  --help       Показать справку

Примеры:
  node scripts/sync-vercel-to-n8n.js           # Синхронизация
  node scripts/sync-vercel-to-n8n.js --dry-run # Тестовый запуск
  `);
  process.exit(0);
}

if (args.includes('--dry-run')) {
  CONFIG.sync.dryRun = true;
}

const syncer = new VercelToN8nSync(CONFIG);
syncer.run();
