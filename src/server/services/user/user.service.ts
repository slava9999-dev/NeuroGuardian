import { sql, mapDbUser } from '../../core/db';
import type { User } from '../../core/types';
import { logger } from '../../utils/logger';

export class UserService {
  async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (result.rows.length === 0) return null;
      return mapDbUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get user', error, { userId });
      throw error;
    }
  }

  async updateUser(userId: number, data: Partial<User>): Promise<void> {
    // Implementation needed based on specific fields to update
    // Using simple query for now or construct dynamic query
    logger.info('Update user requested', { userId, data });
  }

  isSubscriptionActive(user: User): boolean {
    if (!user) return false;
    if (user.is_premium) return true;
    if (user.subscription_status === 'active') return true;

    // Check dates if needed
    if (user.subscription_end_date) {
      return new Date(user.subscription_end_date) > new Date();
    }

    return false;
  }
}

export const userService = new UserService();
