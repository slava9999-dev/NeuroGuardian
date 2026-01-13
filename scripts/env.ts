import dotenv from 'dotenv';
import fs from 'fs';

// Load env vars
const loadEnv = (path: string) => {
  if (fs.existsSync(path)) {
    dotenv.config({ path });
    console.log(`[Env] Loaded ${path}`);
    return true;
  }
  return false;
};

const prodLoaded = loadEnv('.env.production');
const localLoaded = loadEnv('.env.local');

if (!prodLoaded && !localLoaded) {
  loadEnv('.env');
}
