import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

import { sentinelService } from '../src/api-lib/services/sentinel-service.js';

async function runCycle() {
  console.log('🛡️ Запуск боевого цикла Sentinel...');
  console.log(`⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);

  try {
    const result = await sentinelService.runCycle();

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
