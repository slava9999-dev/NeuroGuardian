// ============================================
// NeuroGUARDIAN — Knowledge Base (RAG)
// Version: 5.0.0 | Date: January 2026
// ============================================

import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../../api-lib/lib/logger.js';

/**
 * Knowledge Document
 */
export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
  embedding?: number[]; // Reserved for future vector search
}

/**
 * Knowledge Base Manager
 *
 * Provides RAG capabilities:
 * - Load markdown documents from docs/knowledge
 * - Search by keywords (and planned vectors)
 * - Provide context for the Agent
 */
export class KnowledgeBase {
  private docs: KnowledgeDoc[] = [];
  private isLoaded = false;

  private itemsPath: string;

  constructor(itemsPath = 'docs/knowledge_base') {
    // Resolve to absolute path from project root (works on Vercel)
    this.itemsPath = path.resolve(process.cwd(), itemsPath);
  }

  /**
   * Initialize and load documents
   */
  async init(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Ensure directory exists
      try {
        await fs.access(this.itemsPath);
      } catch {
        // If not exists, create it (in dev) or skip
        if (process.env.NODE_ENV === 'development') {
          await fs.mkdir(this.itemsPath, { recursive: true });
        } else {
          logger.warn(`[KnowledgeBase] Directory not found: ${this.itemsPath}`);
          return;
        }
      }

      const files = await fs.readdir(this.itemsPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      this.docs = [];

      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(this.itemsPath, file), 'utf-8');
        this.docs.push({
          id: file.replace('.md', ''),
          title: this.extractTitle(content) || file.replace('.md', ''),
          content: content,
          tags: this.extractTags(content),
        });
      }

      this.isLoaded = true;
      if (process.env.NODE_ENV !== 'test') {
        logger.info(`[KnowledgeBase] Loaded ${this.docs.length} documents.`);
      }
    } catch (error) {
      // In test environment, we might expect some init errors if dirs are missing, verify criticality
      if (process.env.NODE_ENV !== 'test') {
        logger.error('[KnowledgeBase] Init error:', error);
      }
    }
  }

  /**
   * Search for relevant documents
   */
  async search(query: string, limit = 3): Promise<KnowledgeDoc[]> {
    if (!this.isLoaded) await this.init();

    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);

    // Simple relevance scoring
    const scored = this.docs.map(doc => {
      let score = 0;
      const lowerContent = doc.content.toLowerCase();
      const lowerTitle = doc.title.toLowerCase();

      terms.forEach(term => {
        // Title match is weighted higher
        if (lowerTitle.includes(term)) score += 5;
        // Tag match
        if (doc.tags.some(t => t.includes(term))) score += 3;
        // Content match occurrences (capped at 5)
        const matches = (lowerContent.match(new RegExp(term, 'g')) || []).length;
        score += Math.min(matches, 5);
      });

      return { doc, score };
    });

    // Filter by threshold and sort
    return scored
      .filter(s => s.score > 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.doc);
  }

  /**
   * Extract title from markdown (# Title)
   */
  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract tags from frontmatter or content
   * Format: tags: [one, two] OR #tag in text
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];

    // Frontmatter tags
    const fmMatch = content.match(/tags:\s*\[(.*?)\]/);
    if (fmMatch) {
      tags.push(...fmMatch[1].split(',').map(t => t.trim().toLowerCase()));
    }

    // Hash tags in text (optional, carefully used)
    // const hashMatch = content.match(/#\w+/g);
    // if (hashMatch) tags.push(...hashMatch.map(t => t.substring(1).toLowerCase()));

    return tags;
  }

  /**
   * Helper: Add a document (for testing/seeding)
   */
  async addDoc(id: string, title: string, content: string, tags: string[] = []): Promise<void> {
    this.docs.push({ id, title, content, tags });
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBase();
