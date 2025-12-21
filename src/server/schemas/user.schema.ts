import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number(),
  telegram_id: z.number(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().optional(),
  created_at: z.string().optional(), // ISO string from DB
  api_key_wb: z.string().optional(),
  api_key_ozon: z.string().optional(),
  subscription_status: z.enum(['active', 'inactive', 'trial']),
  subscription_end_date: z.string().optional(),
  trial_used: z.boolean().optional(),
  admin_notes: z.string().optional(),
  referral_code: z.string().optional(),
  referred_by: z.string().optional(),
  saved_amount: z.number().optional().default(0),
  triggered_today: z.number().optional().default(0),
});

export type User = z.infer<typeof UserSchema>;

// Schema for updating user profile
export const UpdateUserSchema = UserSchema.partial().omit({
  id: true,
  telegram_id: true,
  created_at: true,
});
