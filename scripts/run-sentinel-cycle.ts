// Force production mode for this script
process.env.NODE_ENV = 'production';

// Load environment variables immediately
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Verify critical env vars
if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.error('❌ Error: POSTGRES_URL or DATABASE_URL not found in .env.production');
  process.exit(1);
}

async function runCycle() {
  console.log('🛡️ Запуск боевого цикла Sentinel...');
  console.log(`⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);

  try {
    // Dynamic import ensures modules allow database.ts to see the updated process.env
    const { sentinelOrchestrator } = await import('../src/sentinel/SentinelOrchestrator.js');

    const result = await sentinelOrchestrator.runCycle();

    console.log('\n✅ Цикл завершен успешно!');
    console.log(`👥 Обработано пользователей: ${result.usersProcessed}`);
    console.log(
      `📦 Товаров проверено: WB=${result.productsScanned?.wb || 0}, Ozon=${result.productsScanned?.ozon || 0}`
    );
    console.log(`⚠️ Угроз обнаружено: ${result.threatsDetected}`);
    console.log(`⚔️ Действий защиты: ${result.actionsTaken}`);

    if (result.errors.length > 0) {
      console.log(`\n❌ Ошибки (${result.errors.length}):`);
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    process.exit(0);
  } catch (err) {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', err);
    process.exit(1);
  }
}

runCycle();
