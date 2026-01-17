import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function triggerSentinel() {
  console.log('🚀 Запуск Sentinel для отправки оповещения...');

  const { sentinelOrchestrator } = await import('../src/sentinel/SentinelOrchestrator.js');
  const { sql } = await import('../src/api-lib/services/database.js');

  // Trigger for the specific users we just synced
  const usersRes = await sql`
    SELECT * FROM users 
    WHERE id::text IN ('7548070478', '1634470382', '1600992954')
    AND is_active = true
  `;
  const users = usersRes.rows;

  console.log(`📡 Найдено активных пользователей: ${users.length}`);

  for (const user of users) {
    console.log(`\n🔔 Проверка для ${user.first_name} (${user.id})...`);

    // We run the full process for the user
    // sentinelOrchestrator.runForUser also sends the report if needed
    const result = await (sentinelOrchestrator as any).runForUser(Number(user.id));

    console.log(`📊 Результат для ${user.first_name}:`, {
      scanned: result.productsScanned,
      threats: result.threatsDetected,
      actions: result.actionsTaken,
      errors: result.errors.length,
    });
  }

  console.log('\n✅ Все проверки завершены. Оповещения должны прийти в Telegram!');
  process.exit(0);
}

triggerSentinel().catch(err => {
  console.error('💥 Ошибка:', err);
  process.exit(1);
});
