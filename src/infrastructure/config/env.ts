import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * NeuroGUARDIAN Configuration Validator
 * Ensures all environment variables are present and correctly formatted.
 * This is the FIRST line of defense against "Brittle Architecture".
 */

// Load .env files manually to ensure consistency across different environments (Node, tsx, etc.)
dotenv.config({ path: path.join(process.cwd(), '.env') });

const envSchema = z.object({
  // Infrastructure
  POSTGRES_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')).optional(),
  POSTGRES_DATABASE: z.string().optional(),

  // Security
  API_KEY_ENCRYPTION_KEY: z
    .string()
    .min(32, 'Encryption key must be at least 32 characters for AES-256'),
  ADMIN_API_KEY: z.string().min(16),
  CRON_SECRET: z.string().min(16),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[a-zA-Z0-9_-]+$/, 'Invalid Telegram Bot Token format'),
  ADMIN_TELEGRAM_ID: z
    .string()
    .or(z.number())
    .transform(v => String(v)),
  ADMIN_CHAT_ID: z
    .string()
    .or(z.number())
    .transform(v => String(v)),

  // LLM / AI
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Mode
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VITE_DEV_MODE: z
    .string()
    .optional()
    .transform(v => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ CONFIGURATION ERROR: Invalid environment variables');
    console.error('----------------------------------------------------');
    result.error.issues.forEach(issue => {
      console.error(`👉 [${issue.path.join('.')}]: ${issue.message}`);
    });
    console.error('----------------------------------------------------');
    console.error('Check your .env file and ensure all required keys are set.');

    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Critical failure in production
    } else {
      throw new Error('Config validation failed');
    }
  }

  _env = result.data;

  // Security Check: Ensure the key is not the default one in production
  const DEFAULT_KEY = 'NeuroGuardian2024SecretKey32chXX';
  if (_env.NODE_ENV === 'production' && _env.API_KEY_ENCRYPTION_KEY === DEFAULT_KEY) {
    console.error('❌ SECURITY CRITICAL: Using default API_KEY_ENCRYPTION_KEY in production!');
    console.error('Run "npm run gen-key" to create a new secure key.');
    process.exit(1);
  }

  return _env;
}

/**
 * Convenient shortcut for common variables
 */
export const config = getEnv();
