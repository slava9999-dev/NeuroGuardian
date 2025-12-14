// ============================================
// NeuroGUARDIAN — Database Init API Endpoint
// POST /api/init-db — Initialize database schema
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeDatabase } from './lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST with admin key
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await initializeDatabase();
    return res.status(200).json({ 
      success: true, 
      message: 'Database initialized successfully' 
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to initialize database' 
    });
  }
}
