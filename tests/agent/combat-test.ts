import { orchestrateV5 } from '../../src/agent/core/AgentOrchestratorV5.js';
import { logger } from '../../src/api-lib/lib/logger.js';
import { sql } from '../../src/api-lib/services/database.js';
import { registerAllTools } from '../../src/agent/execution/index.js';

/**
 * Combat Test: Evaluate Viktor's strategic reasoning and multi-skill usage.
 */
async function runCombatTest() {
  // 0. Register tools so Viktor knows what he can do
  registerAllTools();

  logger.info('🚀 Starting Viktor Intelligence Combat Test...');

  const testUserId = 7548070478;

  // Ensure user exists in DB for foreign key constraints
  await sql`
        INSERT INTO users (id, first_name, tax_rate)
        VALUES (${testUserId.toString()}, 'CombatTestUser', 7.0)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `;

  // 1. COMPLEX STRATEGIC REQUEST
  const message =
    'Виктор, проанализируй мои товары. Найди те, где низкая маржа, и предложи для них SEO-оптимизацию заголовков, чтобы мы могли поднять цену и привлечь премиум-аудиторию. Какие шаги предпримем?';

  logger.info(`User: ${message}`);

  try {
    const result = await orchestrateV5(message, {
      userId: testUserId,
      userName: 'Вячеслав',
      isFirstContact: false,
    });

    console.log('\n--- VIKTOR RESPONSE ---');
    console.log(result.message);
    console.log('\n--- DEBUG INFO ---');
    console.log('Tools Called:', result.toolsCalled);
    console.log('Total Time:', result.totalTimeMs, 'ms');

    if (result.plan) {
      console.log('Reasoning:', result.plan.reasoning);
    }

    // Evaluate results
    const hasLowMarginTool = result.toolsCalled.includes('get_low_margin_products');
    const hasSEOTool = result.toolsCalled.includes('optimize_product_seo');

    if (hasLowMarginTool && hasSEOTool) {
      logger.info('✅ SUCCESS: Viktor combined Analysis and Optimization tools.');
    } else {
      logger.warn('⚠️ PARTIAL: Viktor missed some tools.', {
        missing: [
          !hasLowMarginTool && 'get_low_margin_products',
          !hasSEOTool && 'optimize_product_seo',
        ].filter(Boolean),
      });
    }

    if (result.message.length > 200) {
      logger.info('✅ SUCCESS: Viktor provided a detailed strategic answer.');
    }
  } catch (error) {
    logger.error('❌ Combat Test Failed', error);
  }
}

runCombatTest();
