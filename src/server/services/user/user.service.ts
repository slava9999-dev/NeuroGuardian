import { sql, mapDbUser } from '../../core/db';
import { UserSchema, type User, UpdateUserSchema } from '../../schemas/user.schema';
import { logger } from '../../utils/logger';

// TEST_MODE flag - mirrors the one in api/index.ts
const TEST_MODE = process.env.TEST_MODE === 'true';

export class UserService {
  /**
   * Get user by ID (Telegram user ID)
   */
  async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (result.rows.length === 0) return null;

      const rawUser = mapDbUser(result.rows[0]);

      // Validate data coming from DB to ensure it matches our application schema
      const parseResult = UserSchema.safeParse(rawUser);

      if (!parseResult.success) {
        logger.warn('DB User Validation Warning', {
          userId,
          errors: parseResult.error.issues.map(i => `${i.path}: ${i.message}`),
        });
        // Return raw user data even if validation fails (for backwards compatibility)
        return rawUser as User;
      }

      return parseResult.data;
    } catch (error) {
      logger.error('Failed to get user', error, { userId });
      throw error;
    }
  }

  /**
   * Update user data
   */
  async updateUser(userId: number, data: Partial<User>): Promise<void> {
    try {
      // Validate update payload
      const validatedData = UpdateUserSchema.parse(data);

      logger.info('Update user requested', { userId, fields: Object.keys(validatedData) });

      // Build dynamic update - for now just log
      // TODO: Implement actual dynamic SQL update
    } catch (error) {
      logger.error('Update user validation failed', error, { userId });
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   * In TEST_MODE, always returns true (free Pro for everyone)
   */
  isSubscriptionActive(user: User | null): boolean {
    // TEST MODE: everyone gets free access
    if (TEST_MODE) return true;

    if (!user) return false;

    // Check subscription_active flag
    if (user.subscription_active) return true;

    // Check dates if needed
    if (user.subscription_end) {
      const endDate = new Date(user.subscription_end);
      return endDate > new Date();
    }

    return false;
  }

  /**
   * Get product limit based on subscription plan
   * In TEST_MODE, always returns Pro limit (500)
   */
  getProductLimit(plan: string | null): number {
    if (TEST_MODE) return 500;

    switch (plan) {
      case 'pro':
      case 'yearly':
        return 500;
      case 'basic':
        return 50;
      case 'trial':
        return 20;
      default:
        return 0;
    }
  }
}

export const userService = new UserService();
