import 'dotenv/config';
import { vectorStore } from '../src/infrastructure/rag/VectorStore.js';

async function testVector() {
  console.log('Testing Vector Store with HF...');
  try {
    const id = await vectorStore.addDocument({
      namespace: 'faq',
      sourceFile: 'test_file',
      chunkIndex: 0,
      content: 'Это тестовый документ для проверки HuggingFace эмбеддингов.',
      metadata: { test: true },
    });
    console.log('Document added with ID:', id);

    const stats = await vectorStore.getStats();
    console.log('Stats:', stats);
  } catch (error) {
    console.error('Vector Test Failed:', error);
  }
}

testVector().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
