// ============================================
// NeuroGUARDIAN — Vision Core Test Utility
// Tests Gemini Vision analysis capabilities
// Usage: npx tsx scripts/test-vision.ts [image-url]
// ============================================

import { config } from 'dotenv';
import path from 'path';

// Load env before imports
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

// Test image (Product example)
const DEFAULT_IMAGE_URL =
  'https://fastly.picsum.photos/id/10/2500/1667.jpg?hmac=J04WWC_ebchx3WwzbM-Z4_KC_LeLBWr5LZMaAkWkF68';

async function testVision(imageUrl: string) {
  // Dynamic import to ensure env vars are loaded
  const { visionService } = await import('../src/vision/VisionService.js');

  console.log('\n👁️  VISION CORE DIAGNOSTICS');
  console.log('============================');
  console.log(`📸 Image: ${imageUrl}`);

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ CONFIG ERROR: GEMINI_API_KEY missing in .env');
    process.exit(1);
  }

  try {
    console.log('\n🔄 Analyzing image quality & content...');
    const startTime = Date.now();

    // 1. Full Analysis
    const result = await visionService.analyzeImage({
      imageUrl,
      checkType: 'full',
      targetMarketplace: 'both', // Check compliance for both WB and Ozon
    });

    const elapsed = Date.now() - startTime;

    console.log('\n✅ ANALYSIS COMPLETE');
    console.log(`⏱️  Time: ${elapsed}ms`);
    console.log(`📐 Quality Score: ${result.overall_quality}/10`);
    console.log(
      `📦 Material: ${result.material_detected} (${(result.material_confidence * 100).toFixed(0)}%)`
    );

    console.log('\n🔍 Quality Checks:');
    console.log(`   - Lighting: ${result.lighting_score}/10`);
    console.log(`   - Sharpness: ${result.sharpness_score}/10`);
    console.log(`   - Composition: ${result.composition_score}/10`);
    console.log(`   - Blur Detected: ${result.blur_detected ? 'YES ⚠️' : 'No'}`);

    console.log('\n🏷️  Generated Tags (SEO):');
    console.log(`   - RU: ${result.seo_tags_ru.join(', ')}`);
    console.log(`   - Texture: ${result.texture_tags.join(', ')}`);

    console.log('\n🛍️  Marketplace Compliance:');
    console.log(`   - Wildberries: ${result.wb_compliant ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!result.wb_compliant) {
      result.wb_issues.forEach(issue => console.log(`     ⚠️  ${issue}`));
    }

    console.log(`   - Ozon: ${result.ozon_compliant ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!result.ozon_compliant) {
      result.ozon_issues.forEach(issue => console.log(`     ⚠️  ${issue}`));
    }
  } catch (error) {
    console.error('\n💥 VISION FAILURE:', error);
  }
}

// Get URL from args or use default
const targetUrl = process.argv[2] || DEFAULT_IMAGE_URL;
testVision(targetUrl);
