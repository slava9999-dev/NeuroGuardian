import * as dotenv from 'dotenv';
import path from 'path';

// FORCE ENVIRONMENT VARIABLES BEFORE IMPORTS
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

process.env.NODE_ENV = 'production';
process.env.LOCAL_DEV = '';
process.env.DEBUG = 'true';

console.log('🌍 Environment set to PRODUCTION/DEBUG mode');

// Dynamic imports to ensure env vars are set first
const { sentinelService } = await import('../src/api-lib/services/sentinel-service.js');
const { sql } = await import('../src/api-lib/services/database.js');

async function debugRun() {
  const userId = 7548070478; // Вячеслав
  console.log(`\n🚀 ЗАПУСК ОТЛАДКИ SENTINEL ДЛЯ ID: ${userId}`);

  try {
    // 1. Проверка пользователя
    console.log('🔍 Проверка подключения к БД и пользователя...');
    const userRes = await sql`SELECT * FROM users WHERE id = ${userId}`;
    const user = userRes.rows[0];

    if (!user) {
      console.error('❌ Пользователь не найден в БД!');
      return;
    }
    console.log(`👤 Пользователь: ${user.first_name} (${user.username})`);
    console.log(`🛡️ Защита: ${user.protection_enabled ? 'ВКЛ' : 'ВЫКЛ'}`);
    console.log(`💳 Подписка: ${user.subscription_active ? 'АКТИВНА' : 'НЕТ'}`);

    // 4. ЗАПУСК ЦИКЛА
    console.log('\n⚙️ Запуск SentinelService.runForUser()...');

    // Тайм-аут на выполнение, чтобы не висело вечно
    const timeout = setTimeout(() => {
      console.error(
        '\n🛑 ПРЕДУПРЕЖДЕНИЕ: Процесс выполняется слишком долго (>30 сек). Проверьте сетевое соединение или таймауты API.'
      );
    }, 30000);

    const summary = await sentinelService.runForUser(userId);
    clearTimeout(timeout);

    console.log('\n🏁 РЕЗУЛЬТАТ ПРОВЕРКИ:');

    // Безопасное чтение свойств
    const wbScanned = summary.productsScanned?.wb || 0;
    const ozonScanned = summary.productsScanned?.ozon || 0;
    const totalScanned = wbScanned + ozonScanned;

    console.log(`✅ Товаров реально опрошено по API: ${totalScanned}`);
    console.log(`⚠️ Угроз найдено: ${summary.threatsDetected}`);
    console.log(`⚔️ Действий защиты: ${summary.actionsTaken}`);

    if (summary.errors && summary.errors.length > 0) {
      console.log('\n❌ ОШИБКИ API / СИСТЕМЫ:');
      summary.errors.forEach((e: string) => console.error(`- ${e}`));
    }

    if (totalScanned === 0 && (!summary.errors || summary.errors.length === 0)) {
      console.log(
        '🛑 ВНИМАНИЕ: Сторож не нашел товаров для проверки. Проверьте флаг is_monitored.'
      );
    }
  } catch (err) {
    console.error('\n💥 КРИТИЧЕСКИЙ СБОЙ СКРИПТА:', err);
  } finally {
    process.exit(0);
  }
}

debugRun().catch(console.error);
