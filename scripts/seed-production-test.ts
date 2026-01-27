import { sql } from '../src/api-lib/services/database.ts';

async function seedTest() {
  console.log('🧪 Seeding Master Test User...');

  const testUser = {
    id: 7548070478, // Your Admin ID
    username: 'slava9999',
    first_name: 'Master',
    last_name: 'Tester',
    is_active: true,
    subscription_plan: 'premium',
    subscription_active: true,
    subscription_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    protection_enabled: true,
    defense_mode: 'price_correction',
  };

  try {
    // 1. Create User
    await sql`
      INSERT INTO users (
        id, username, first_name, last_name, is_active, 
        subscription_plan, subscription_active, subscription_end,
        protection_enabled, defense_mode
      ) VALUES (
        ${testUser.id}, ${testUser.username}, ${testUser.first_name}, 
        ${testUser.last_name}, ${testUser.is_active}, 
        ${testUser.subscription_plan}, ${testUser.subscription_active}, 
        ${testUser.subscription_end}, ${testUser.protection_enabled}, 
        ${testUser.defense_mode}
      )
      ON CONFLICT (id) DO UPDATE SET 
        subscription_plan = EXCLUDED.subscription_plan,
        subscription_active = EXCLUDED.subscription_active,
        protection_enabled = EXCLUDED.protection_enabled;
    `;
    console.log('✅ User "Master Tester" created/updated.');

    // 2. Create a Test Subscription for SaaS logic (017 migration)
    await sql`
      INSERT INTO subscriptions (user_id, status, tier, current_period_end)
      VALUES (${testUser.id}, 'active', 'business', ${testUser.subscription_end})
      ON CONFLICT (user_id) DO UPDATE SET 
        status = 'active', tier = 'business';
    `;
    console.log('✅ Business Subscription linked.');

    // 3. Create a Dummy WB Account
    await sql`
      INSERT INTO marketplace_accounts (user_id, name, marketplace, is_active)
      VALUES (${testUser.id}, 'WB_TEST_STORE', 'WB', true)
      ON CONFLICT DO NOTHING;
    `;
    console.log('✅ WB Test Account added.');

    console.log('\n✨ Seeding Complete. You are now the Master Admin in the new DB.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedTest();
