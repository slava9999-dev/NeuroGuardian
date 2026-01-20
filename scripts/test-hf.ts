import 'dotenv/config';
import { hfBrain } from '../src/infrastructure/llm/HuggingFaceProvider.js';

async function testHF() {
  console.log('Testing HuggingFace PRO (Qwen 2.5 72B)...');
  try {
    const response = await hfBrain.complete([
      { role: 'user', content: 'Привет! Расскажи о себе кратко на русском.' },
    ]);
    console.log('Response:', response.content);
    console.log('Tokens:', response.tokensUsed);
  } catch (error) {
    console.error('HF Test Failed:', error);
  }
}

testHF();
