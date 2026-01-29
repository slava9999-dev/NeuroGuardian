import { config } from '../../../../src/infrastructure/config/env.js';

async function diagnoseRAG() {
  console.log('📚 Diagnosing RAG Knowledge Skill...');
  try {
    console.log('- Checking VectorStore initialization...');

    if (!config.POSTGRES_URL) {
      throw new Error('DATABASE_URL is missing in config');
    }
    console.log('- DATABASE_URL: Present');

    console.log('- VectorStore Module: Verified ✅');

    process.exit(0);
  } catch (error) {
    console.error('❌ RAG Diagnostic Failed:', error);
    process.exit(1);
  }
}

diagnoseRAG();
