// ============================================
// NeuroGUARDIAN — RAG Setup Handler
// Initializes vector store via API (server-side)
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../services/database.js';
import { promises as fs } from 'fs';
import path from 'path';

// Enable Gemini embeddings (768 dims)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Namespace mapping
const NAMESPACE_MAPPING: Record<string, string> = {
  wb_api_rules: 'wb_api',
  wb_commissions: 'wb_api',
  wb_full_guide: 'wb_api',
  ozon_api_rules: 'ozon_api',
  ozon_commissions: 'ozon_api',
  ozon_full_guide: 'ozon_api',
  sentinel_instruction: 'sentinel',
  security_threats: 'sentinel',
  spp_buffer_guide: 'sentinel',
  pricing_strategies: 'pricing',
  unit_economics_guide: 'analytics',
  seasonality_calendar: 'analytics',
  faq: 'faq',
  api_keys_guide: 'onboarding',
  app_guide: 'onboarding',
  common_mistakes: 'faq',
  quick_responses: 'faq',
  success_cases: 'faq',
  reviews_guide: 'faq',
  viktor_personality: 'faq',
};

async function getGeminiEmbedding(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) throw new Error('No Gemini API Key');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = (await response.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

function chunkText(text: string, maxSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    if (currentChunk.length + para.length > maxSize) {
      if (currentChunk) chunks.push(currentChunk.trim());

      // Overlap: add some context from previous chunk if it fits
      let overlapContent = '';
      let j = i - 1;
      while (j >= 0 && overlapContent.length + paragraphs[j].length < overlap) {
        overlapContent = paragraphs[j] + '\n\n' + overlapContent;
        j--;
      }
      currentChunk = overlapContent + para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim().length > 50) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = authHeader.split(' ')[1];
  const isValid =
    (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) ||
    (process.env.ADMIN_KEY && secret === process.env.ADMIN_KEY);

  if (!isValid && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);

    log('Starting RAG setup...');

    // 1. Recreate table (768 dims for Gemini)
    if (req.query.reset === 'true') {
      log('Dropping existing table...');
      await sql`DROP TABLE IF EXISTS knowledge_embeddings CASCADE`;

      log('Creating new table (768 dims)...');
      await sql`
        CREATE TABLE knowledge_embeddings (
          id SERIAL PRIMARY KEY,
          namespace VARCHAR(50) NOT NULL,
          source_file VARCHAR(255) NOT NULL,
          chunk_index INT NOT NULL DEFAULT 0,
          title VARCHAR(500),
          content TEXT NOT NULL,
          embedding vector(768),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(namespace, source_file, chunk_index)
        )
      `;

      await sql`CREATE INDEX idx_embeddings_namespace ON knowledge_embeddings(namespace)`;
      await sql`CREATE INDEX idx_embeddings_source ON knowledge_embeddings(source_file)`;
      log('Table created.');
    }

    // 2. Ingest documents
    const knowledgePath = path.resolve(process.cwd(), 'docs/knowledge_base');
    const files = await fs.readdir(knowledgePath);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    log(`Found ${mdFiles.length} documents.`);

    let processed = 0;

    for (const file of mdFiles) {
      const fileName = file.replace('.md', '');
      const namespace = NAMESPACE_MAPPING[fileName] || 'faq';
      const filePath = path.join(knowledgePath, file);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const title = content.match(/^#\s+(.+)$/m)?.[1] || fileName;
        const chunks = chunkText(content);

        log(`Processing ${fileName} (${chunks.length} chunks) -> ${namespace}`);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = await getGeminiEmbedding(chunk);

          await sql`
            INSERT INTO knowledge_embeddings (
              namespace, source_file, chunk_index, title, content, embedding, metadata
            ) VALUES (
              ${namespace}, ${fileName}, ${i}, ${title}, ${chunk}, 
              ${JSON.stringify(embedding)}::vector, 
              ${JSON.stringify({ totalChunks: chunks.length })}::jsonb
            )
            ON CONFLICT (namespace, source_file, chunk_index) 
            DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              updated_at = now()
          `;

          // Small delay for rate limits
          await new Promise(r => setTimeout(r, 100));
        }
        processed++;
      } catch (err) {
        log(`Error processing ${file}: ${err}`);
      }
    }

    // 3. Create HNSW and FTS Indexes
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw 
        ON knowledge_embeddings 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;

      // Add GIN index for full-text search (Russian)
      log('Creating GIN index for full-text search...');
      await sql`
        CREATE INDEX IF NOT EXISTS idx_embeddings_fts 
        ON knowledge_embeddings 
        USING GIN (to_tsvector('russian', content))
      `;
      log('HNSW and GIN indexes created/verified.');
    } catch (e) {
      log(`Index warning: ${e}`);
    }

    res.status(200).json({
      success: true,
      processed,
      logs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
