import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

// ПРИНУДИТЕЛЬНО ВЫСТАВЛЯЕМ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ДО ЛЮБЫХ ИМПОРТОВ
process.env.NODE_ENV = 'production';
process.env.LOCAL_DEV = '';
process.env.DEBUG = 'true';

console.log('🌍 Environment set to PRODUCTION/DEBUG mode');

// Трюк для ESM: импортируем сервисы ПОСЛЕ конфигурации env
const { sentinelService } = await import('../src/api-lib/services/sentinel-service.js');
const { getMarketplaceKeys } = await import('../src/api-lib/services/marketplace.js');
const { sql } = await import('@vercel/postgres');

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
    console.log('\n⚙️ Передача управления в SentinelService.processUser()...');
    const summary = {
      usersProcessed: 1,
      threatsDetected: 0,
      actionsTaken: 0,
      errors: [],
      productsScanned: { wb: 0, ozon: 0 },
      defenseDetails: [],
    };

    // Тайм-аут на выполнение, чтобы не висело вечно
    const timeout = setTimeout(() => {
      console.error(
        '\n🛑 ПРЕДУПРЕЖДЕНИЕ: Процесс выполняется слишком долго (>30 сек). Проверьте сетевое соединение или таймауты API.'
      );
    }, 30000);

    await sentinelService.processUser(user as any, summary);
    clearTimeout(timeout);

    console.log('\n🏁 РЕЗУЛЬТАТ ПРОВЕРКИ:');
    console.log(
      `✅ Товаров реально опрошено по API: ${summary.productsScanned.wb + summary.productsScanned.ozon}`
    );
    console.log(`⚠️ Угроз найдено: ${summary.threatsDetected}`);
    console.log(`⚔️ Действий защиты: ${summary.actionsTaken}`);

    if (summary.errors.length > 0) {
      console.log('\n❌ ОШИБКИ API / СИСТЕМЫ:');
      summary.errors.forEach(e => console.error(`- ${e}`));
    }

    if (summary.productsScanned.wb + summary.productsScanned.ozon === 0 && !summary.errors.length) {
      console.log(
        '🛑 ВНИМАНИЕ: Сторож не нашел товаров для проверки. Проверьте флаг is_monitored.'
      );
    }
  } catch (err) {
    console.error('\n💥 КРИТИЧЕСКИЙ СБОЙ СКРИПТА:', err);
  }
}

debugRun().catch(console.error);
