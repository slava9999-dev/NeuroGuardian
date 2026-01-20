import 'dotenv/config';
import { HuggingFaceProvider } from '../src/infrastructure/llm/HuggingFaceProvider.js';
import { logger } from '../src/api-lib/lib/logger.js';

async function main() {
  console.log('🧪 Testing HuggingFace PRO Vision (Qwen 2.5 VL)...');

  const provider = new HuggingFaceProvider({
    // Use the model defined in HF_MODELS.vision or explicit string
    model: 'Qwen/Qwen2-VL-72B-Instruct',
    maxTokens: 1000,
  });

  const imageUrl =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg';

  console.log(`📸 Analyzing image: ${imageUrl}`);

  try {
    const response = await provider.complete([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in detail. What is the lighting like?' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ]);

    console.log('\n✅ Vision Analysis Result:');
    console.log('--------------------------------------------------');
    console.log(response.content);
    console.log('--------------------------------------------------');
    console.log(`Tokens used: ${response.tokensUsed}`);
  } catch (error) {
    console.error('\n❌ Vision Test Failed:', error);
  }
}

main();
