import { db, users } from '../src/infrastructure/database/db.js';

async function main() {
  const allUsers = await db.query.users.findMany();
  console.log(`📊 Всего пользователей в базе: ${allUsers.length}`);

  allUsers.forEach((user, i) => {
    console.log(
      `${i + 1}. ID: ${user.id} | Name: ${user.firstName} ${user.lastName || ''} | Username: @${user.username || 'n/a'} | Active: ${user.isActive ? '✅' : '❌'}`
    );
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
