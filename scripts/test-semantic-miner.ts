import dotenv from 'dotenv';
import path from 'path';
// Explicitly load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Now that env is loaded, we can check it
console.log('🚀 Starting Semantic Miner Test...');
console.log('Target Query: "подставка для ноутбука"');
console.log('🔑 Env Check - Gemini:', process.env.GEMINI_API_KEY ? 'Set' : 'Missing');
console.log('🔑 Env Check - OpenRouter:', process.env.OPENROUTER_API_KEY ? 'Set' : 'Missing');
console.log(
  '🔑 Env Check - Encryption Key:',
  process.env.API_KEY_ENCRYPTION_KEY ? 'Set' : 'Missing'
);

async function run() {
  try {
    // Dynamically import SemanticMiner AFTER dotenv.config()
    const { semanticMiner } = await import('../src/api-lib/core-services/SemanticMiner.js');

    const suggestions = await semanticMiner.mineAndOptimize('подставка для ноутбука');

    console.log('\n✅ Mining completed successfully!');
    console.log('--------------------------------------------------');
    console.log(JSON.stringify(suggestions, null, 2));
    console.log('--------------------------------------------------');

    if (suggestions.length === 0) {
      console.log('⚠️ No suggestions generated. Check logs for details.');
    }
  } catch (error) {
    console.error('❌ Mining failed:', error);
  } finally {
    console.log('Done.');
    process.exit(0);
  }
}

run();
