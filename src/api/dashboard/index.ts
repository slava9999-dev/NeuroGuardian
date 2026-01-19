import { db } from '@/lib/db';

export async function getOverview(_req: Request): Promise<Response> {
  const userId = 1; // Default to 1 for MVP if auth not fully integrated in this context

  try {
    const [products, events, alerts] = await Promise.all([
      db.query(
        `
        SELECT 
          marketplace,
          COUNT(*) as count
        FROM products
        WHERE user_id = $1
        GROUP BY marketplace
      `,
        [userId]
      ),

      db.query(
        `
        SELECT event_type, COUNT(*) as count
        FROM ops_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY event_type
      `,
        []
      ),

      db.query(
        `
        SELECT COUNT(*) as count
        FROM ops_events
        WHERE event_type = 'price_alert'
          AND processed_at IS NULL
      `,
        []
      ),
    ]);

    return new Response(
      JSON.stringify({
        products: products.rows,
        eventsLast24h: events.rows,
        pendingAlerts: alerts.rows[0]?.count || 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Dashboard Overview Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}

export async function getPriceHistory(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');
  const days = parseInt(url.searchParams.get('days') || '30');

  try {
    const history = await db.query(
      `
      SELECT 
        DATE(created_at) as date,
        AVG(CAST(payload->>'old_price' AS DECIMAL)) as avg_old_price,
        AVG(CAST(payload->>'new_price' AS DECIMAL)) as avg_new_price,
        COUNT(*) as changes
      FROM ops_events
      WHERE event_type = 'price_update_completed'
        AND ($1::text IS NULL OR payload->>'product_id' = $1)
        AND created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
      [productId, days]
    );

    return new Response(JSON.stringify(history.rows), { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}

export async function getAgentStatus(_req: Request): Promise<Response> {
  try {
    const lastRun = await db.query(`
      SELECT payload, created_at
      FROM ops_events
      WHERE event_type = 'price_protection_run'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    let n8nStatus = 'unknown';
    if (process.env.N8N_WEBHOOK_SECRET) {
      n8nStatus = 'connected';
    }

    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);

    return new Response(
      JSON.stringify({
        lastRun: lastRun.rows[0] || null,
        systemHealth: {
          status: 'ok',
          n8n: n8nStatus,
          database: 'connected',
        },
        nextScheduledRun: nextRun.toISOString(),
      }),
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}
