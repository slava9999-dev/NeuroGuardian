import { renderFactory } from '../src/vision/RenderFactory.js';

async function testImageGeneration() {
  console.log('🎨 Testing Image Generation\n');

  const testPrompts = [
    {
      name: 'Luxury Interior Scene',
      prompt:
        'Luxury minimalist loft interior, concrete walls, warm ambient lighting, modern Scandinavian design, high-end photography, 8k quality',
    },
    {
      name: 'Product Photography',
      prompt:
        'Professional product photography, white background, studio lighting, commercial quality, 4k resolution',
    },
  ];

  for (const test of testPrompts) {
    console.log(`\n📸 Test: ${test.name}`);
    console.log(`📝 Prompt: ${test.prompt}\n`);

    try {
      // Using generateScene (private method exposed through workflowLifestyle)
      // Or we can test the full workflow with a dummy product image

      // For quick test, let's use a public image URL
      const dummyProductUrl = 'https://via.placeholder.com/500x500.png?text=Product';

      const result = await renderFactory.workflowLifestyle(dummyProductUrl, {
        scenePrompt: test.prompt,
        lightingStyle: 'natural',
      });

      if (result.success) {
        console.log('✅ Generation successful!');
        console.log(`🖼️  Result URL: ${result.resultUrl}`);
        console.log(`🆔 Job ID: ${result.jobId}`);
      } else {
        console.log('❌ Generation failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    }

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Image generation test complete!');
}

testImageGeneration().catch(console.error);
