// ============================================
// NeuroGUARDIAN — Chat History Handler
// Manages persistent chat history storage
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateTelegramInitData, sanitizeInput } from '../lib/index.js';
import { getChatHistory, saveChatHistory, clearChatHistory } from '../services/database.js';

/**
 * GET CHAT HISTORY
 * Retrieves user's chat history from database
 */
export async function handleGetChatHistory(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const initData = sanitizeInput(
    (req.headers['x-init-data'] as string) || req.body?.initData || ''
  );
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }

  try {
    const messages = await getChatHistory(validation.user.id);
    return res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Get chat history error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve chat history',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * SAVE CHAT HISTORY
 * Persists user's chat messages to database
 */
export async function handleSaveChatHistory(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const initData = sanitizeInput(req.body?.initData || '');
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }

  const messages = req.body?.messages || [];

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages must be an array' });
  }

  try {
    await saveChatHistory(validation.user.id, messages);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Save chat history error:', error);
    return res.status(500).json({
      error: 'Failed to save chat history',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * CLEAR CHAT HISTORY
 * Deletes all chat messages for user
 */
export async function handleClearChatHistory(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const initData = sanitizeInput(req.body?.initData || '');
  const validation = validateTelegramInitData(initData);

  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
  }

  try {
    await clearChatHistory(validation.user.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Clear chat history error:', error);
    return res.status(500).json({
      error: 'Failed to clear chat history',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
