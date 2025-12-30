// ============================================
// NeuroGUARDIAN — MoE API Handler
// Hybrid Mixture of Experts routing endpoint
// Version: 1.0.0 | Date: December 2024
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../lib/logger.js';
import { classifyQuery, checkLocalLLMHealth } from '../agent/moe-router.js';
import { triggerMoEQuery, triggerPriceCheck } from '../services/inngest-functions.js';
import { memoryService } from '../services/memory-service.js';

// ============================================
// MOE CLASSIFY - Direct intent classification
// ============================================

export async function handleMoEClassify(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const startTime = Date.now();
    const result = await classifyQuery(query);
    const latencyMs = Date.now() - startTime;

    logger.info('[MoE API] Query classified', {
      userId,
      intent: result.intent,
      confidence: result.confidence,
      routeTo: result.routeTo,
      classifiedBy: result.classifiedBy,
      latencyMs,
    });

    return res.status(200).json({
      success: true,
      classification: {
        intent: result.intent,
        confidence: result.confidence,
        routeTo: result.routeTo,
        classifiedBy: result.classifiedBy,
      },
      latencyMs,
    });
  } catch (error: any) {
    logger.error('[MoE API] Classification failed', { userId, error: error.message });
    return res.status(500).json({ error: error.message });
  }
}

// ============================================
// MOE QUERY - Async query processing via Inngest
// ============================================

export async function handleMoEQuery(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, sessionId, marketplace, sync } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  const effectiveSessionId = sessionId || `session_${userId}_${Date.now()}`;

  try {
    // If sync=true, run directly (for testing/debugging)
    if (sync) {
      const classification = await classifyQuery(query);

      return res.status(200).json({
        success: true,
        mode: 'sync',
        classification: {
          intent: classification.intent,
          confidence: classification.confidence,
          routeTo: classification.routeTo,
          classifiedBy: classification.classifiedBy,
        },
        message: `Query classified as ${classification.intent} (${Math.round(classification.confidence * 100)}% confidence)`,
      });
    }

    // Async mode: trigger Inngest function
    const { eventId } = await triggerMoEQuery({
      userId,
      query,
      sessionId: effectiveSessionId,
      marketplace,
    });

    logger.info('[MoE API] Query queued', { userId, eventId, sessionId: effectiveSessionId });

    return res.status(202).json({
      success: true,
      mode: 'async',
      eventId,
      sessionId: effectiveSessionId,
      message: 'Query submitted for processing',
    });
  } catch (error: any) {
    logger.error('[MoE API] Query submission failed', { userId, error: error.message });
    return res.status(500).json({ error: error.message });
  }
}

// ============================================
// MOE HEALTH - Check MoE infrastructure health
// ============================================

export async function handleMoEHealth(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // Check Local LLM
    const llmHealth = await checkLocalLLMHealth();

    // Check Memory Service
    const memoryHealth = await memoryService.getHealth();

    const totalLatency = Date.now() - startTime;

    const overallHealthy =
      llmHealth.healthy && memoryHealth.chromaHealthy && memoryHealth.kvHealthy;

    const status = {
      healthy: overallHealthy,
      components: {
        localLLM: {
          healthy: llmHealth.healthy,
          latencyMs: llmHealth.latencyMs,
          error: llmHealth.error,
        },
        chromaDB: {
          healthy: memoryHealth.chromaHealthy,
        },
        vercelKV: {
          healthy: memoryHealth.kvHealthy,
        },
        embeddings: {
          available: memoryHealth.embeddingsAvailable,
        },
      },
      config: {
        moeEnabled: process.env.MOE_ROUTING_ENABLED !== 'false',
        forceLocal: process.env.FORCE_LOCAL_INFERENCE === 'true',
        localLLMUrl: process.env.LOCAL_LLM_URL || 'http://localhost:8000/v1',
        chromaUrl: process.env.CHROMA_URL || 'http://localhost:8001',
      },
      latencyMs: totalLatency,
    };

    logger.info('[MoE API] Health check', {
      healthy: overallHealthy,
      llm: llmHealth.healthy,
      chroma: memoryHealth.chromaHealthy,
      kv: memoryHealth.kvHealthy,
    });

    return res.status(overallHealthy ? 200 : 503).json(status);
  } catch (error: any) {
    logger.error('[MoE API] Health check failed', { error: error.message });
    return res.status(500).json({
      healthy: false,
      error: error.message,
    });
  }
}

// ============================================
// MOE PRICE CHECK - Trigger background price check
// ============================================

export async function handleMoEPriceCheck(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, items } = req.body || {};

  try {
    const { eventId } = await triggerPriceCheck({
      userId,
      accountId,
      items,
    });

    logger.info('[MoE API] Price check queued', { userId, eventId, accountId });

    return res.status(202).json({
      success: true,
      eventId,
      message: 'Price check submitted for background processing',
    });
  } catch (error: any) {
    logger.error('[MoE API] Price check submission failed', { userId, error: error.message });
    return res.status(500).json({ error: error.message });
  }
}
