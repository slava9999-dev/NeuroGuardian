import { db } from '@/lib/db';

interface Document {
  id: string;
  source: 'ozon_docs' | 'wildberries_docs' | 'internal';
  title: string;
  content: string;
  embedding?: number[];
  lastUpdated: Date;
}

interface SearchResult {
  document: Document;
  score: number;
  snippet: string;
}

interface VerificationResult {
  totalDocuments: number;
  bySource: Record<string, number>;
  outdated: string[];
  missing: string[];
}

export class KnowledgeBase {
  private documents: Map<string, Document> = new Map();

  async loadDocuments(): Promise<void> {
    try {
      const docs = await db.query(`
        SELECT id, source, title, content, updated_at
        FROM knowledge_documents
        WHERE active = true
      `);

      for (const doc of docs.rows) {
        this.documents.set(doc.id, {
          id: doc.id,
          source: doc.source,
          title: doc.title,
          content: doc.content,
          lastUpdated: doc.updated_at,
        });
      }
    } catch (e) {
      console.warn('Failed to load knowledge base from DB', e);
    }
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

    for (const doc of this.documents.values()) {
      const contentLower = doc.content.toLowerCase();
      const titleLower = doc.title.toLowerCase();

      let score = 0;
      for (const term of queryTerms) {
        if (titleLower.includes(term)) score += 10;
        if (contentLower.includes(term)) score += 1;
      }

      if (score > 0) {
        const snippet = this.extractSnippet(doc.content, queryTerms[0]);
        results.push({ document: doc, score, snippet });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private extractSnippet(content: string, term: string, contextLength: number = 200): string {
    const index = content.toLowerCase().indexOf(term.toLowerCase());
    if (index === -1) return content.slice(0, contextLength) + '...';

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + contextLength / 2);

    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  async verifyKnowledge(): Promise<VerificationResult> {
    const result = {
      totalDocuments: this.documents.size,
      bySource: {} as Record<string, number>,
      outdated: [] as string[],
      missing: [] as string[],
    };

    for (const doc of this.documents.values()) {
      result.bySource[doc.source] = (result.bySource[doc.source] || 0) + 1;

      const daysSinceUpdate = (Date.now() - doc.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 30) {
        result.outdated.push(doc.id);
      }
    }

    // Required topics for phase 6
    const requiredTopics = ['ozon_api_prices', 'wildberries_api_prices', 'price_protection_rules'];

    for (const topic of requiredTopics) {
      const found = Array.from(this.documents.values()).some(
        d => d.id === topic || d.title.toLowerCase().includes(topic.replace(/_/g, ' '))
      );
      if (!found) {
        result.missing.push(topic);
      }
    }

    return result;
  }
}

export const knowledgeBase = new KnowledgeBase();
