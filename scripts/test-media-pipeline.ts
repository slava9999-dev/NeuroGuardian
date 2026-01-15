// ============================================
// NeuroGUARDIAN — Media Pipeline Test
// Verifies Storage, DB, and Webhook flow
// ============================================

import 'dotenv/config';
import { storageService } from '../src/vision/StorageService.js';
import { sql } from '../src/api-lib/services/database.js';
import { logger } from '../src/api-lib/lib/logger.js';
import handleMediaWebhook from '../src/api-lib/handlers/media-webhook.js';

async function runTest() {
  console.log('🚀 Starting Media Pipeline Test...');

  try {
    // 1. Test Storage Upload (Buffer)
    console.log('\nStep 1: Testing Storage Upload...');
    const testBuffer = Buffer.from('test image data ' + Date.now());
    const uploadUrl = await storageService.upload(
      testBuffer,
      `test_asset_${Date.now()}.txt`,
      'text/plain',
      'tests'
    );
    console.log('✅ Upload URL:', uploadUrl);

    // 2. Fetch a real product for the test
    console.log('\nStep 2: Fetching real product from DB...');
    const productResult = await sql`SELECT product_id, user_id FROM products LIMIT 1`;
    if (productResult.rows.length === 0) {
      throw new Error('No products found in DB. Please sync at least one product first.');
    }

    const { product_id: productId, user_id: userId } = productResult.rows[0];
    const assetId = `test_asset_${Date.now()}`;
    console.log(`✅ Using Product: ${productId}, User: ${userId}`);

    console.log('\nStep 2.1: Creating DB record...');
    await sql`
      INSERT INTO media_assets (id, product_id, user_id, type, status, original_url)
      VALUES (${assetId}, ${productId}, ${userId}, 'original', 'uploading', ${uploadUrl})
    `;
    console.log('✅ DB Record created:', assetId);

    // 3. Simulate Webhook Call for Analysis
    console.log('\nStep 3: Simulating Webhook (Vision Analysis)...');

    // We mock the Request/Response objects for the Vercel handler
    const mockReq = {
      method: 'POST',
      body: {
        jobId: `job_test_${Date.now()}`,
        type: 'vision_analyze',
        sourceImageUrl: 'https://picsum.photos/800/600', // Use a real image for Gemini to analyze
        metadata: { assetId },
      },
    } as any;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          console.log(`📡 Response (${code}):`, data);
          return mockRes;
        },
      }),
    } as any;

    await handleMediaWebhook(mockReq, mockRes);

    // 4. Verify DB update
    console.log('\nStep 4: Verifying DB Update...');
    const result = await sql`SELECT * FROM media_assets WHERE id = ${assetId}`;
    const asset = result.rows[0];

    if (asset.status === 'ready' && asset.vision_metadata) {
      console.log('✅ Pipeline Success!');
      console.log('📊 Vision Data:', JSON.stringify(asset.vision_metadata, null, 2));
    } else {
      console.error('❌ Pipeline Failed: Asset not ready or metadata missing');
      console.log('Asset state:', asset);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

runTest();
