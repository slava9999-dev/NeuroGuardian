// ============================================
// NeuroGUARDIAN — Knowledge Base Service
// AI Agent's long-term memory and documentation search
// ============================================

import { sql } from '../services/database.js';

// ============================================
// TYPES
// ============================================

export type KnowledgeSource = 'ozon_docs' | 'wildberries_docs' | 'internal' | 'faq' | 'policy';

export type KnowledgeCategory = 'api' | 'pricing' | 'stocks' | 'promotions' | 'troubleshooting';

export interface KnowledgeDocument {
  id: string;
  source: KnowledgeSource;
  category: KnowledgeCategory;
  title: string;
  content: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  sourceUrl?: string;
  version?: string;
  language: string;
  keywords: string[];
  active: boolean;
  score?: number; // Search score
}

// ============================================
// KNOWLEDGE BASE
// ============================================

/**
 * Search knowledge base using full-text search
 */
export async function searchKnowledge(
  query: string,
  limit = 5,
  sourceFilter?: KnowledgeSource
): Promise<KnowledgeDocument[]> {
  try {
    // Note: search_knowledge function was created in migration 015
    const result = await sql`
      SELECT id, title, source, snippet, rank
      FROM search_knowledge(${query}, ${sourceFilter || null}, ${limit})
    `;

    // Fetch full content for top results if needed, but search_knowledge returns summary
    // Let's adhere to the migration's return type.
    // However, the migration returns a specific table structure.
    // Let's implement full retrieval here if migration function is used just for IDs or lightweight search.

    // For now, let's assume we want full documents for the agent context.
    if (result.rows.length === 0) return [];

    // We can't pass arrays to template literals easily in WHERE IN clause without helpers.
    // Assuming small limit, we can loop or use a workaround.
    // Better yet, let's join properly.

    // Actually, let's just query directly if we need full logic
    const docs = await sql`
       SELECT 
        kd.*,
        ts_rank(to_tsvector('russian', kd.title || ' ' || kd.content), plainto_tsquery('russian', ${query})) as rank
       FROM knowledge_documents kd
       WHERE kd.active = true
         AND (${sourceFilter || null}::text IS NULL OR kd.source = ${sourceFilter})
         AND to_tsvector('russian', kd.title || ' ' || kd.content) @@ plainto_tsquery('russian', ${query})
       ORDER BY rank DESC
       LIMIT ${limit}
    `;

    return docs.rows.map(row => ({
      id: row.id,
      source: row.source as KnowledgeSource,
      category: row.category as KnowledgeCategory,
      title: row.title,
      content: row.content,
      summary: row.summary,
      metadata: row.metadata,
      sourceUrl: row.source_url,
      version: row.version,
      language: row.language,
      keywords: row.keywords,
      active: row.active,
      score: row.rank,
    }));
  } catch (error) {
    console.error('Knowledge search failed:', error);
    return [];
  }
}

/**
 * Get document by ID
 */
export async function getDocument(id: string): Promise<KnowledgeDocument | null> {
  try {
    const result = await sql`SELECT * FROM knowledge_documents WHERE id = ${id}`;
    const row = result.rows[0];

    if (!row) return null;

    return {
      id: row.id,
      source: row.source as KnowledgeSource,
      category: row.category as KnowledgeCategory,
      title: row.title,
      content: row.content,
      summary: row.summary,
      metadata: row.metadata,
      sourceUrl: row.source_url,
      version: row.version,
      language: row.language,
      keywords: row.keywords,
      active: row.active,
    };
  } catch (error) {
    console.error(`Failed to get document ${id}:`, error);
    return null;
  }
}

/**
 * Sync document to knowledge base (upsert)
 */
export async function syncDocument(
  doc: Omit<KnowledgeDocument, 'active' | 'score'> & { active?: boolean }
): Promise<boolean> {
  try {
    const keywords = `{${doc.keywords.join(',')}}`; // Array literal for Postgres
    const metadata = JSON.stringify(doc.metadata || {});

    await sql`
      INSERT INTO knowledge_documents (
        id, source, category, title, content, summary,
        metadata, source_url, version, language, keywords, active
      ) VALUES (
        ${doc.id}, ${doc.source}, ${doc.category}, ${doc.title}, ${doc.content}, ${doc.summary || null},
        ${metadata}, ${doc.sourceUrl || null}, ${doc.version || null}, ${doc.language}, ${keywords}, ${doc.active ?? true}
      )
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        summary = EXCLUDED.summary,
        metadata = EXCLUDED.metadata,
        version = EXCLUDED.version,
        keywords = EXCLUDED.keywords,
        updated_at = NOW()
    `;
    return true;
  } catch (error) {
    console.error(`Failed to sync document ${doc.id}:`, error);
    return false;
  }
}

// ============================================
// AGENT HELPER
// ============================================

/**
 * Get relevant context for agent prompt
 */
export async function getAgentContext(query: string, maxLength = 4000): Promise<string> {
  const docs = await searchKnowledge(query, 3);

  if (docs.length === 0) return '';

  let context = `DOCUMENTATION CONTEXT:\n\n`;
  let currentLength = context.length;

  for (const doc of docs) {
    // Prefer summary if available, otherwise truncated content
    const text = doc.summary || doc.content.substring(0, 1000);
    const entry = `[${doc.source.toUpperCase()}] ${doc.title}\n${text}\n\n`;

    if (currentLength + entry.length > maxLength) {
      break;
    }

    context += entry;
    currentLength += entry.length;
  }

  return context;
}
