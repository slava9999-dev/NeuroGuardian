// ============================================
// NeuroGUARDIAN — Vector Store Service
// RAG infrastructure with pgvector
// Version: 1.0.0 | Date: January 2026
// ============================================

import { sql } from '../../api-lib/services/database.js';
import { logger } from '../../api-lib/lib/logger.js';

// ============================================
// Types
// ============================================

export type EmbeddingNamespace =
  | 'wb_api'
  | 'ozon_api'
  | 'sentinel'
  | 'pricing'
  | 'analytics'
  | 'faq'
  | 'onboarding';

export interface EmbeddingDocument {
  id?: number;
  namespace: EmbeddingNamespace;
  sourceFile: string;
  chunkIndex: number;
  title?: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: number;
  namespace: EmbeddingNamespace;
  title: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface HybridSearchResult extends SearchResult {
  vectorScore: number;
  textScore: number;
  combinedScore: number;
}

// ============================================
// Embedding Provider Interface
// ============================================

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

// ============================================
// OpenAI Embedding Provider
// ============================================

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  public dimensions: number;

  constructor(options?: { model?: string }) {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = options?.model || 'text-embedding-3-small';
    this.dimensions = 1536;
  }

  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding API error: ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data.map(d => d.embedding);
  }
}

// ============================================
// Gemini Embedding Provider (Free tier)
// ============================================

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  public dimensions: number = 768;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`,
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
      throw new Error(`Gemini Embedding API error: ${error}`);
    }

    const data = (await response.json()) as {
      embedding: { values: number[] };
    };

    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Gemini doesn't have batch API, process sequentially
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}

// ============================================
// Vector Store Service
// ============================================

export class VectorStore {
  private embeddingProvider: EmbeddingProvider;
  private initialized = false;

  constructor(provider?: EmbeddingProvider) {
    // Default to OpenAI, fallback to Gemini
    if (provider) {
      this.embeddingProvider = provider;
    } else if (process.env.OPENAI_API_KEY) {
      this.embeddingProvider = new OpenAIEmbeddingProvider();
    } else {
      this.embeddingProvider = new GeminiEmbeddingProvider();
      logger.info('[VectorStore] Using Gemini embeddings (768 dims)');
    }
  }

  /**
   * Initialize vector store (check extension, table)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if pgvector extension exists
      const result = await sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as has_vector
      `;

      if (!result.rows[0]?.has_vector) {
        logger.warn('[VectorStore] pgvector extension not found. Run migration first.');
      }

      // Check if table exists
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'knowledge_embeddings'
        ) as has_table
      `;

      if (!tableCheck.rows[0]?.has_table) {
        logger.warn('[VectorStore] knowledge_embeddings table not found. Run migration first.');
      }

      this.initialized = true;
      logger.info('[VectorStore] Initialized successfully');
    } catch (error) {
      logger.error('[VectorStore] Init error:', error);
      throw error;
    }
  }

  /**
   * Add document with embedding to vector store
   */
  async addDocument(doc: EmbeddingDocument): Promise<number> {
    await this.init();

    // Generate embedding if not provided
    let embedding = doc.embedding;
    if (!embedding) {
      embedding = await this.embeddingProvider.embed(doc.content);
    }

    const result = await sql`
      INSERT INTO knowledge_embeddings (
        namespace, source_file, chunk_index, title, content, embedding, metadata
      ) VALUES (
        ${doc.namespace},
        ${doc.sourceFile},
        ${doc.chunkIndex},
        ${doc.title || null},
        ${doc.content},
        ${JSON.stringify(embedding)}::vector,
        ${JSON.stringify(doc.metadata || {})}::jsonb
      )
      ON CONFLICT (namespace, source_file, chunk_index) 
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `;

    return result.rows[0].id;
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(docs: EmbeddingDocument[]): Promise<number[]> {
    // Generate embeddings for docs without them
    const textsToEmbed = docs.filter(d => !d.embedding).map(d => d.content);

    if (textsToEmbed.length > 0) {
      const embeddings = await this.embeddingProvider.embedBatch(textsToEmbed);
      let embeddingIndex = 0;
      for (const doc of docs) {
        if (!doc.embedding) {
          doc.embedding = embeddings[embeddingIndex++];
        }
      }
    }

    // Insert all documents
    const ids: number[] = [];
    for (const doc of docs) {
      const id = await this.addDocument(doc);
      ids.push(id);
    }

    logger.info(`[VectorStore] Added ${ids.length} documents`);
    return ids;
  }

  /**
   * Search for similar documents by vector similarity
   */
  async search(
    query: string,
    options?: {
      namespace?: EmbeddingNamespace | EmbeddingNamespace[];
      limit?: number;
      threshold?: number;
    }
  ): Promise<SearchResult[]> {
    await this.init();

    const embedding = await this.embeddingProvider.embed(query);
    const limit = options?.limit || 5;
    const threshold = options?.threshold || 0.5;

    // Handle namespace filter
    const namespaces = options?.namespace
      ? Array.isArray(options.namespace)
        ? options.namespace
        : [options.namespace]
      : null;

    // Use different queries based on namespace filter
    // This is necessary because tagged template doesn't support dynamic SQL well
    let result;
    const embeddingStr = JSON.stringify(embedding);

    if (namespaces && namespaces.length > 0) {
      // With namespace filter - use ANY array
      result = await sql`
        SELECT 
          id,
          namespace,
          title,
          content,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity,
          metadata
        FROM knowledge_embeddings
        WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
        AND namespace = ANY(${namespaces}::text[])
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `;
    } else {
      // Without namespace filter
      result = await sql`
        SELECT 
          id,
          namespace,
          title,
          content,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity,
          metadata
        FROM knowledge_embeddings
        WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `;
    }

    return result.rows.map(row => ({
      id: row.id as number,
      namespace: row.namespace as EmbeddingNamespace,
      title: row.title as string | null,
      content: row.content as string,
      similarity: parseFloat(String(row.similarity)),
      metadata: (row.metadata || {}) as Record<string, unknown>,
    }));
  }

  /**
   * Hybrid search combining vector similarity and full-text search
   */
  async hybridSearch(
    query: string,
    options?: {
      namespace?: EmbeddingNamespace | EmbeddingNamespace[];
      limit?: number;
      vectorWeight?: number;
    }
  ): Promise<HybridSearchResult[]> {
    await this.init();

    const embedding = await this.embeddingProvider.embed(query);
    const limit = options?.limit || 5;
    const vectorWeight = options?.vectorWeight || 0.7;
    const textWeight = 1 - vectorWeight;

    // Handle namespace filter
    const namespaces = options?.namespace
      ? Array.isArray(options.namespace)
        ? options.namespace
        : [options.namespace]
      : null;

    const embeddingStr = JSON.stringify(embedding);
    let result;

    if (namespaces && namespaces.length > 0) {
      result = await sql`
        SELECT 
          id,
          namespace,
          title,
          content,
          1 - (embedding <=> ${embeddingStr}::vector) as vector_score,
          ts_rank(to_tsvector('russian', content), plainto_tsquery('russian', ${query})) as text_score,
          (${vectorWeight} * (1 - (embedding <=> ${embeddingStr}::vector))) + 
          (${textWeight} * ts_rank(to_tsvector('russian', content), plainto_tsquery('russian', ${query}))) as combined_score,
          metadata
        FROM knowledge_embeddings
        WHERE namespace = ANY(${namespaces}::text[])
        ORDER BY combined_score DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT 
          id,
          namespace,
          title,
          content,
          1 - (embedding <=> ${embeddingStr}::vector) as vector_score,
          ts_rank(to_tsvector('russian', content), plainto_tsquery('russian', ${query})) as text_score,
          (${vectorWeight} * (1 - (embedding <=> ${embeddingStr}::vector))) + 
          (${textWeight} * ts_rank(to_tsvector('russian', content), plainto_tsquery('russian', ${query}))) as combined_score,
          metadata
        FROM knowledge_embeddings
        ORDER BY combined_score DESC
        LIMIT ${limit}
      `;
    }

    return result.rows.map(row => ({
      id: row.id as number,
      namespace: row.namespace as EmbeddingNamespace,
      title: row.title as string | null,
      content: row.content as string,
      similarity: parseFloat(String(row.combined_score)),
      vectorScore: parseFloat(String(row.vector_score)),
      textScore: parseFloat(String(row.text_score)),
      combinedScore: parseFloat(String(row.combined_score)),
      metadata: (row.metadata || {}) as Record<string, unknown>,
    }));
  }

  /**
   * Delete documents by namespace or source file
   */
  async deleteDocuments(options: {
    namespace?: EmbeddingNamespace;
    sourceFile?: string;
  }): Promise<number> {
    await this.init();

    let result;
    if (options.namespace && options.sourceFile) {
      result = await sql`
        DELETE FROM knowledge_embeddings
        WHERE namespace = ${options.namespace} AND source_file = ${options.sourceFile}
      `;
    } else if (options.namespace) {
      result = await sql`
        DELETE FROM knowledge_embeddings
        WHERE namespace = ${options.namespace}
      `;
    } else if (options.sourceFile) {
      result = await sql`
        DELETE FROM knowledge_embeddings
        WHERE source_file = ${options.sourceFile}
      `;
    } else {
      return 0;
    }

    return result.rowCount || 0;
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<{
    totalDocuments: number;
    byNamespace: Record<string, number>;
    lastUpdated: Date | null;
  }> {
    await this.init();

    const [countResult, namespaceResult, lastUpdatedResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM knowledge_embeddings`,
      sql`SELECT namespace, COUNT(*) as count FROM knowledge_embeddings GROUP BY namespace`,
      sql`SELECT MAX(updated_at) as last_updated FROM knowledge_embeddings`,
    ]);

    const byNamespace: Record<string, number> = {};
    for (const row of namespaceResult.rows) {
      byNamespace[row.namespace] = parseInt(row.count);
    }

    return {
      totalDocuments: parseInt(countResult.rows[0].count),
      byNamespace,
      lastUpdated: lastUpdatedResult.rows[0].last_updated,
    };
  }
}

// Singleton instance
export const vectorStore = new VectorStore();
