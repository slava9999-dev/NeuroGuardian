import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function diagnose() {
  console.log('🔍 Diagnosing Users (SELECT *)...');
  try {
    const users = await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT 5`;
    // Filter out complex objects for easier console reading if needed, or just log
    console.log(
      users.rows.map(
        (u: {
          id: number;
          telegram_id: number;
          subscription_plan: string;
          is_trial_active: boolean;
          status: string;
        }) => ({
          id: u.id,
          telegram_id: u.telegram_id,
          sub_plan: u.subscription_plan,
          trial: u.is_trial_active, // Check if this field exists in output
          status: u.status,
        })
      )
    );
  } catch (err) {
    console.error('❌ Diagnosis failed:', err);
  } finally {
    process.exit(0);
  }
}

diagnose();
