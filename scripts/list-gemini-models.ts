import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY not found in .env');
    return;
  }

  console.log(`🔑 Using API Key: ${apiKey.substring(0, 8)}...`);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      console.error(await response.text());
      return;
    }

    const data = await response.json();
    console.log('\n✅ Available Models:');
    console.log('--------------------------------------------------');
    data.models.forEach((model: any) => {
      console.log(`- ${model.name} (${model.displayName})`);
      console.log(`  Methods: ${model.supportedGenerationMethods.join(', ')}`);
    });
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('❌ Failed to list models:', error);
  }
}

listModels();
