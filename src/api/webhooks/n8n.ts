import { priceProtectionAgent } from '@/agent/priceProtection';
import { marketplaceService } from '@/services/marketplaceService';
import { notificationService } from '@/services/notificationService';
import { db } from '@/lib/db';

const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

function validateN8nRequest(req: Request): boolean {
  const secret = req.headers.get('x-n8n-secret') || req.headers.get('authorization');
  return secret === N8N_WEBHOOK_SECRET || secret === `Bearer ${N8N_WEBHOOK_SECRET}`;
}

export async function handlePriceCheck(req: Request): Promise<Response> {
  if (!validateN8nRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    await priceProtectionAgent.loadRules();
    const result = await priceProtectionAgent.executeProtection();

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        result,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Price check failed:', error);

    await notificationService.sendAlert({
      type: 'system_error',
      urgency: 'high',
      message: `Price check failed: ${error.message}`,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500 }
    );
  }
}

export async function handleSyncProducts(req: Request): Promise<Response> {
  if (!validateN8nRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const products = await marketplaceService.getAllProducts();

    for (const product of products) {
      await db.query(
        `
        INSERT INTO products (product_id, marketplace, title, current_price, current_stock, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, product_id) 
        DO UPDATE SET 
          title = EXCLUDED.title,
          current_price = EXCLUDED.current_price,
          current_stock = EXCLUDED.current_stock,
          updated_at = NOW()
      `,
        [product.externalId, product.marketplace, product.name, product.price, product.stock]
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: products.length,
        timestamp: new Date().toISOString(),
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Product sync failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500 }
    );
  }
}

export async function handleHealthCheck(req: Request): Promise<Response> {
  if (!validateN8nRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      wildberries: false,
      ozon: false,
    },
  };

  try {
    await db.query('SELECT 1');
    health.checks.database = true;
  } catch (e) {
    health.status = 'degraded';
  }

  try {
    await marketplaceService.wb.getPrices();
    health.checks.wildberries = true;
  } catch (e) {
    health.status = 'degraded';
  }

  try {
    await marketplaceService.ozon.getProducts(1, 1);
    health.checks.ozon = true;
  } catch (e) {
    health.status = 'degraded';
  }

  return new Response(JSON.stringify(health), {
    status: health.status === 'ok' ? 200 : 503,
  });
}
