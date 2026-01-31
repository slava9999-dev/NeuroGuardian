import { sql } from '../../api-lib/services/database.js';

export class SentinelRepository {
  async logAction(log: {
    user_id: string | number;
    product_id: string | number;
    product_title: string;
    detected_price: number;
    min_price: number;
    defense_action: string;
    saved_amount: number;
    marketplace: string;
    threat_type?: string;
    success?: boolean;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await sql`
      INSERT INTO sentinel_logs (
        user_id, product_id, product_title, detected_price, 
        min_price, defense_action, saved_amount, marketplace, threat_type, success, details
      )
      VALUES (
        ${log.user_id}, ${log.product_id}, ${log.product_title}, ${log.detected_price},
        ${log.min_price}, ${log.defense_action}, ${log.saved_amount}, ${log.marketplace},
        ${log.threat_type || null}, ${log.success !== undefined ? log.success : true},
        ${log.details ? JSON.stringify(log.details) : '{}'}
      )
    `;
  }
}

export const sentinelRepository = new SentinelRepository();
