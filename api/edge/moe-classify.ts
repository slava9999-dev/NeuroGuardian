import { classifyQuery } from '../../src/api-lib/agent/moe-router.js';
import { logger } from '../../src/api-lib/lib/logger.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const startTime = Date.now();
    const result = await classifyQuery(query);
    const latencyMs = Date.now() - startTime;

    // Redacted logger for Edge
    console.log('[MoE Edge] Query classified', {
      intent: result.intent,
      latencyMs,
    });

    return new Response(
      JSON.stringify({
        success: true,
        classification: {
          intent: result.intent,
          confidence: result.confidence,
          routeTo: result.routeTo,
          classifiedBy: result.classifiedBy,
        },
        latencyMs,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
