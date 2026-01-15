// ============================================
// Script to list available Gemini models
// Usage: npx tsx scripts/list-gemini-models.ts
// ============================================

import { config } from 'dotenv';
import path from 'path';

// Load env
config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is missing in .env');
  process.exit(1);
}

async function listModels() {
  console.log('🔍 Querying Google Gemini API for available models...');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`API Request Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.models) {
      console.log('⚠️ No models returned from API.');
      return;
    }

    // Filter and sort models
    const visionModels = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .sort((a: any, b: any) => b.displayName.localeCompare(a.displayName));

    console.log('\n🧠 AVAILABLE VISION-CAPABLE MODELS:');
    console.log('===================================');

    visionModels.forEach((model: any) => {
      const isVision =
        model.displayName.toLowerCase().includes('vision') ||
        model.name.includes('1.5') ||
        model.name.includes('2.0');

      console.log(`\n🔹 [${model.name.replace('models/', '')}]`);
      console.log(`   Name: ${model.displayName}`);
      console.log(`   Version: ${model.version}`);
      console.log(`   Limit (Input): ${model.inputTokenLimit}`);
      console.log(`   Limit (Output): ${model.outputTokenLimit}`);

      if (model.description) {
        console.log(`   Desc: ${model.description.substring(0, 100)}...`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to list models:', error);
  }
}

listModels();
