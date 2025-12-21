import { sql, mapDbUser } from '../../core/db';
import { UserSchema, type User, UpdateUserSchema } from '../../schemas/user.schema';
import { logger } from '../../utils/logger';

export class UserService {
  async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (result.rows.length === 0) return null;

      const rawUser = mapDbUser(result.rows[0]);
      // Validate data coming from DB to ensure it matches our application schema
      const parseResult = UserSchema.safeParse(rawUser);

      if (!parseResult.success) {
        logger.error('DB Validation Error', parseResult.error, { userId });
        // In production, we might want to return null or throw, but for now log and return raw casted
        return rawUser as User;
      }
      return parseResult.data;
    } catch (error) {
      logger.error('Failed to get user', error, { userId });
      throw error;
    }
  }

  async updateUser(userId: number, data: Partial<User>): Promise<void> {
    try {
      // Validate update payload
      const validatedData = UpdateUserSchema.parse(data);

      // This is a dynamic query builder (simplified)
      // In a real ORM we'd have better tools, but with sql template literals we have to be careful
      // For now, let's just log as this is a placeholder implementation from previous step
      logger.info('Update user requested (validated)', { userId, validatedData });

      // Example implementation if we were actually updating:
      // const setParams = Object.entries(validatedData).map(([k, v]) => sql`${sql(k)} = ${v}`);
      // await sql`UPDATE users SET ... WHERE id = ${userId}`;
    } catch (error) {
      logger.error('Update user validation failed', error, { userId });
      throw error;
    }
  }

  isSubscriptionActive(user: User | null): boolean {
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
