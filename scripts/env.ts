import dotenv from 'dotenv';
import fs from 'fs';

// Load env vars
if (fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' });
  console.log('[Env] Loaded .env.production');
} else if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
  console.log('[Env] Loaded .env.local');
} else {
  dotenv.config();
  console.log('[Env] Loaded default .env');
}
