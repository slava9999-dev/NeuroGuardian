// ============================================
// NeuroGUARDIAN — Memory Service
// Long-term and short-term memory for AI context management
// Version: 2.0.0 | Date: December 2024
// ============================================

import { ChromaClient, type Collection, type Metadata } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { kv } from '@vercel/kv';
import { logger } from '../lib/logger.js';

// ============================================
// CONFIGURATION
// ============================================

const MEMORY_CONFIG = {
  // Session history limits
  MAX_SHORT_TERM_MESSAGES: 20,
  MIGRATE_THRESHOLD: 10,
  MIGRATE_BATCH_SIZE: 5,

  // Vector search
  SIMILARITY_RESULTS: 3,

  // TTL (seconds)
  SESSION_TTL: 60 * 60 * 24 * 7, // 7 days

  // Collection prefix
  COLLECTION_PREFIX: 'neuro_user_',
} as const;

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface MemoryMetadata {
  type: 'user_query' | 'assistant_response' | 'memory_chunk' | 'preference';
  timestamp: string;
  intent?: string;
}

interface MemoryServiceState {
  initialized: boolean;
  chromaHealthy: boolean;
  kvHealthy: boolean;
}

// ============================================
// MEMORY SERVICE CLASS
// ============================================

export class MemoryService {
  private chroma: ChromaClient | null = null;
  private embeddings: OpenAIEmbeddings | null = null;
  private collectionsCache: Map<string, Collection> = new Map();
  private state: MemoryServiceState = {
    initialized: false,
    chromaHealthy: false,
    kvHealthy: false,
  };

  constructor() {
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    if (this.state.initialized) return;

    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8001';

    try {
      this.chroma = new ChromaClient({ path: chromaUrl });

      // Check ChromaDB health
      await this.chroma.heartbeat();
      this.state.chromaHealthy = true;
      logger.info('[MemoryService] ChromaDB connected', { url: chromaUrl });
    } catch (e: any) {
      logger.warn('[MemoryService] ChromaDB unavailable, long-term memory disabled', {
        url: chromaUrl,
        error: e.message,
      });
      this.state.chromaHealthy = false;
    }

    // Initialize embeddings if OpenAI key available
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && this.state.chromaHealthy) {
      try {
        this.embeddings = new OpenAIEmbeddings({
          modelName: 'text-embedding-3-small',
          openAIApiKey: openaiKey,
        });
        logger.info('[MemoryService] Embeddings initialized');
      } catch (e: any) {
        logger.warn('[MemoryService] Embeddings unavailable', { error: e.message });
      }
    }

    // Check KV health
    try {
      await kv.ping();
      this.state.kvHealthy = true;
      logger.info('[MemoryService] Vercel KV connected');
    } catch (e: any) {
      logger.warn('[MemoryService] Vercel KV unavailable, short-term memory disabled', {
        error: e.message,
      });
      this.state.kvHealthy = false;
    }

    this.state.initialized = true;
  }

  // ============================================
  // SHORT-TERM MEMORY (KV/Redis)
  // ============================================

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    if (!this.state.kvHealthy) {
      return [];
    }

    try {
      const key = `history_${sessionId}`;
      const history = await kv.get<ChatMessage[]>(key);
      return history || [];
    } catch (e: any) {
      logger.error('[MemoryService] Failed to get session history', {
        sessionId,
        error: e.message,
      });
      return [];
    }
  }

  async addToSessionHistory(sessionId: string, message: ChatMessage): Promise<boolean> {
    if (!this.state.kvHealthy) {
      return false;
    }

    try {
      const key = `history_${sessionId}`;
      const history = await this.getSessionHistory(sessionId);

      // Add new message
      history.push({
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      });

      // Trim if exceeds max
      while (history.length > MEMORY_CONFIG.MAX_SHORT_TERM_MESSAGES) {
        history.shift();
      }

      await kv.set(key, history, { ex: MEMORY_CONFIG.SESSION_TTL });
      return true;
    } catch (e: any) {
      logger.error('[MemoryService] Failed to add to session history', {
        sessionId,
        error: e.message,
      });
      return false;
    }
  }

  async clearSessionHistory(sessionId: string): Promise<boolean> {
    if (!this.state.kvHealthy) {
      return false;
    }

    try {
      await kv.del(`history_${sessionId}`);
      return true;
    } catch (e: any) {
      logger.error('[MemoryService] Failed to clear session history', {
        sessionId,
        error: e.message,
      });
      return false;
    }
  }

  // ============================================
  // LONG-TERM MEMORY (Vector DB)
  // ============================================

  private async getCollection(sessionId: string): Promise<Collection | null> {
    if (!this.chroma || !this.state.chromaHealthy) {
      return null;
    }

    const collectionName = `${MEMORY_CONFIG.COLLECTION_PREFIX}${sessionId}`;

    // Check cache
    if (this.collectionsCache.has(collectionName)) {
      return this.collectionsCache.get(collectionName)!;
    }

    try {
      const collection = await this.chroma.getOrCreateCollection({
        name: collectionName,
      });
      this.collectionsCache.set(collectionName, collection);
      return collection;
    } catch (e: any) {
      logger.error('[MemoryService] Failed to get/create collection', {
        sessionId,
        error: e.message,
      });
      return null;
    }
  }

  async saveToLongTerm(
    sessionId: string,
    text: string,
    metadata: MemoryMetadata
  ): Promise<boolean> {
    if (!this.embeddings) {
      logger.debug('[MemoryService] Embeddings not available, skipping long-term save');
      return false;
    }

    const collection = await this.getCollection(sessionId);
    if (!collection) {
      return false;
    }

    try {
      const vector = await this.embeddings.embedQuery(text);

      await collection.add({
        ids: [`mem_${Date.now()}_${Math.random().toString(36).substring(7)}`],
        embeddings: [vector],
        metadatas: [{ ...metadata, intent: metadata.intent || '' } as Metadata],
        documents: [text],
      });

      logger.debug('[MemoryService] Saved to long-term memory', {
        sessionId,
        textLength: text.length,
        type: metadata.type,
      });

      return true;
    } catch (e: any) {
      logger.error('[MemoryService] Failed to save to long-term memory', {
        sessionId,
        error: e.message,
      });
      return false;
    }
  }

  async searchRelatedContext(
    sessionId: string,
    query: string,
    nResults: number = MEMORY_CONFIG.SIMILARITY_RESULTS
  ): Promise<string[]> {
    if (!this.embeddings) {
      return [];
    }

    const collection = await this.getCollection(sessionId);
    if (!collection) {
      return [];
    }

    try {
      const vector = await this.embeddings.embedQuery(query);

      const results = await collection.query({
        queryEmbeddings: [vector],
        nResults,
      });

      return (results.documents?.[0] || []).filter((doc): doc is string => doc !== null);
    } catch (e: any) {
      logger.error('[MemoryService] Failed to search context', {
        sessionId,
        error: e.message,
      });
      return [];
    }
  }

  // ============================================
  // MEMORY MIGRATION
  // ============================================

  async packAndMigrate(sessionId: string): Promise<boolean> {
    if (!this.state.kvHealthy || !this.embeddings) {
      return false;
    }

    try {
      const history = await this.getSessionHistory(sessionId);

      if (history.length <= MEMORY_CONFIG.MIGRATE_THRESHOLD) {
        return false;
      }

      // Take oldest messages to migrate
      const toMigrate = history.splice(0, MEMORY_CONFIG.MIGRATE_BATCH_SIZE);

      // Create text summary
      const textToStore = toMigrate.map(m => `${m.role}: ${m.content}`).join('\n');

      // Save to long-term
      await this.saveToLongTerm(sessionId, textToStore, {
        timestamp: new Date().toISOString(),
        type: 'memory_chunk',
      });

      // Update short-term
      await kv.set(`history_${sessionId}`, history, {
        ex: MEMORY_CONFIG.SESSION_TTL,
      });

      logger.info('[MemoryService] Memory migrated', {
        sessionId,
        migratedMessages: toMigrate.length,
        remainingMessages: history.length,
      });

      return true;
    } catch (e: any) {
      logger.error('[MemoryService] Migration failed', {
        sessionId,
        error: e.message,
      });
      return false;
    }
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async getHealth(): Promise<{
    chromaHealthy: boolean;
    kvHealthy: boolean;
    embeddingsAvailable: boolean;
  }> {
    // Re-check health
    if (this.chroma) {
      try {
        await this.chroma.heartbeat();
        this.state.chromaHealthy = true;
      } catch {
        this.state.chromaHealthy = false;
      }
    }

    try {
      await kv.ping();
      this.state.kvHealthy = true;
    } catch {
      this.state.kvHealthy = false;
    }

    return {
      chromaHealthy: this.state.chromaHealthy,
      kvHealthy: this.state.kvHealthy,
      embeddingsAvailable: !!this.embeddings,
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const memoryService = new MemoryService();
