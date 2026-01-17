// ============================================
// NeuroGUARDIAN — Generate Product Image Tool
// Uses Replicate via RenderFactory to generate images
// Version: 1.0.0 | Date: January 2026
// ============================================

import {
  GenerateProductImageArgsSchema,
  type GenerateProductImageArgs,
} from '../../../api-lib/agent/validators.js';
import { defineTool } from '../ToolRegistry.js';
import { renderFactory } from '../../../vision/RenderFactory.js';

/**
 * Generate Product Image Tool
 *
 * Generates marketing images for products using AI (Replicate/Flux)
 */
export const generateProductImageTool = defineTool<GenerateProductImageArgs>({
  name: 'generate_product_image',
  description: 'Создать рекламное фото товара (lifestyle или на белом фоне).',
  schema: GenerateProductImageArgsSchema,
  category: 'write', // Generates new content/assets
  requiresConfirmation: true, // Generating images costs money/credits
  examples: [
    'User: "сгенерируй фото товара в интерьере лофт" → generate_product_image({ prompt: "in a luxury loft interior", style: "lifestyle" })',
    'User: "сделай фото на белом фоне для вайлдберриз" → generate_product_image({ prompt: "white background, clean studio light", style: "white_background" })',
  ],

  async execute(userId, args) {
    try {
      // 1. Resolve source image logic (if product_id provided)
      let sourceImageUrl = '';
      if (args.product_id) {
        // TODO: Fetch product image from DB
        // For now, we assume prompt is enough or user provided URL in prompt?
        // Actually RenderFactory needs a source image for "workflowLifestyle" (removedBg -> composite).
        // But Flux can also generate from scratch?
        // RenderFactory.generateScene generates a background.
        // RenderFactory.workflowLifestyle takes `imageUrl` (input product).
        // Since we don't have easy DB access helper here without importing huge services,
        // and we typically use this tool after 'get_products', maybe pass URL?
        // Schema doesn't have image_url.
        // Let's rely on product_id fetch.
        // Simple workaround: If no product_id, maybe we are generating FROM SCRATCH?
        // But RenderFactory seems designed for Product Photography (taking existing product and putting in scene).
        // If we want pure generation (e.g. "generate a cat"), RenderFactory.generateScene does it.
        // But the tool is "generate_product_image".
        // Let's assume for now we need an input image.
        // If product_id is given, we would need to fetch it.
        // Since I can't easily import "ProductService" here without potential circular deps or complexity,
        // I will throw if product_id is needed but logic not implemented.
        // BUT, for the "Check if agent generates photo" request, maybe I just want to generate A SCENE?
        // Let's look at RenderFactory again.
        // workflowLifestyle(imageUrl, ...) -> requires imageUrl.
        // I'll skip product fetch for now and return a mock or error if product_id is used,
        // OR I can use a placeholder function for "fetchProductImage".
        // Actually, I can use `sql` from `database.js` like `GetProductsTool` does.
      }

      // If no product_id, we might just be generating a scene or idea?
      // The user request was "generate photo", context implies Product Photo.

      if (!args.product_id) {
        // If no product, maybe use a default test image or fail?
        // Or maybe the prompt describes the FULL image.
        // RenderFactory doesn't seem to expose "Text to Image" directly as public method except `generateScene` which is private?
        // specific `generateScene` IS private in RenderFactory.ts.

        // `workflowLifestyle` is public. It takes `imageUrl`.

        return {
          success: false,
          error:
            'Для генерации фото товара необходимо указать product_id, чтобы я мог взять исходное фото.',
        };
      }

      const { sql } = await import('../../../api-lib/services/database.js');
      const dbResult = await sql`
        SELECT main_image FROM products 
        WHERE user_id = ${userId} 
        AND (product_id = ${args.product_id} OR nm_id = ${parseInt(args.product_id) || 0}) 
        LIMIT 1
      `;

      if (dbResult.rows.length === 0 || !dbResult.rows[0].main_image) {
        return {
          success: false,
          error: `Товар ${args.product_id} не найден или у него нет главного фото.`,
        };
      }

      sourceImageUrl = dbResult.rows[0].main_image;

      // 2. Call RenderFactory
      let result;
      if (args.style === 'white_background') {
        result = await renderFactory.workflowWhiteBackground(sourceImageUrl, {
          upscale: true,
        });
      } else {
        result = await renderFactory.workflowLifestyle(sourceImageUrl, {
          scenePrompt: args.prompt,
          lightingStyle: 'natural',
        });
      }

      if (!result.success || !result.resultUrl) {
        throw new Error(result.error || 'Unknown generation error');
      }

      return {
        success: true,
        data: {
          image_url: result.resultUrl,
          job_id: result.jobId,
          message: `Фото успешно сгенерировано! [Открыть](${result.resultUrl})`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка генерации: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
