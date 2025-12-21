import { z } from 'zod';

/**
 * User schema matching actual database structure in api/index.ts
 * Table: users
 */
export const UserSchema = z.object({
  // Primary key (Telegram user ID)
  id: z.number(),

  // Profile info from Telegram
  username: z.string().nullable().optional(),
  first_name: z.string(),
  last_name: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),

  // Status
  is_active: z.boolean().optional().default(true),

  // API Keys (encrypted with AES-256-GCM)
  api_key_wb: z.string().nullable().optional(),
  api_key_ozon: z.string().nullable().optional(),

  // Protection settings
  protection_enabled: z.boolean().optional().default(false),
  defense_mode: z.enum(['zero_stock', 'price_correction']).optional().default('zero_stock'),

  // Subscription
  subscription_plan: z.enum(['trial', 'basic', 'pro', 'yearly']).nullable().optional(),
  subscription_end: z.string().nullable().optional(), // ISO timestamp
  subscription_active: z.boolean().optional().default(false),

  // Payment
  payment_method_id: z.string().nullable().optional(),

  // Stats
  total_products: z.number().optional().default(0),
  triggered_today: z.number().optional().default(0),
  saved_amount: z.number().optional().default(0),

  // Referral program
  referral_code: z.string().nullable().optional(),
  referred_by: z.string().nullable().optional(),

  // Reminders
  last_reminder_sent: z.string().nullable().optional(),

  // Timestamps
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

// Schema for updating user profile (partial, excludes auto-generated fields)
export const UpdateUserSchema = UserSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
  referral_code: true, // Auto-generated
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;
