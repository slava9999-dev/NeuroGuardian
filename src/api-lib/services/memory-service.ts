// ============================================
// NeuroGUARDIAN — Memory Service v2.1.0
// Hybrid memory: Vercel KV (production) + Local Redis (development)
// Long-term: ChromaDB with local embeddings fallback
// ============================================

import { ChromaClient, type Collection, type Metadata, DefaultEmbeddingFunction } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { kv } from '@vercel/kv';
import Redis from 'ioredis';
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
  kvProvider: 'vercel' | 'redis' | 'none';
  embeddingsProvider: 'openai' | 'local' | 'none';
}

// ============================================
// EMBEDDING INTERFACE
// ============================================

interface EmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
}

// Wrapper for Chroma's DefaultEmbeddingFunction
class LocalEmbeddingProvider implements EmbeddingProvider {
  private embedder: DefaultEmbeddingFunction;

  constructor() {
    this.embedder = new DefaultEmbeddingFunction();
  }

  async embedQuery(text: string): Promise<number[]> {
    const results = await this.embedder.generate([text]);
    return results[0];
  }
}

// ============================================
// MEMORY SERVICE CLASS
// ============================================

export class MemoryService {
  private chroma: ChromaClient | null = null;
  private embeddings: EmbeddingProvider | null = null;
  private localRedis: Redis | null = null;
  private collectionsCache: Map<string, Collection> = new Map();
  private state: MemoryServiceState = {
    initialized: false,
    chromaHealthy: false,
    kvHealthy: false,
    kvProvider: 'none',
    embeddingsProvider: 'none',
  };

  constructor() {
    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    if (this.state.initialized) return;

    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8001';

    // ===== Initialize ChromaDB =====
    try {
      this.chroma = new ChromaClient({ path: chromaUrl });
      await this.chroma.heartbeat();
      this.state.chromaHealthy = true;
      logger.info('[MemoryService] ChromaDB connected', { url: chromaUrl });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.warn('[MemoryService] ChromaDB unavailable, long-term memory disabled', {
        url: chromaUrl,
        error,
      });
      this.state.chromaHealthy = false;
    }

    // ===== Initialize Embeddings (OpenAI -> Local fallback) =====
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && this.state.chromaHealthy) {
      try {
        this.embeddings = new OpenAIEmbeddings({
          modelName: 'text-embedding-3-small',
          openAIApiKey: openaiKey,
        });
        this.state.embeddingsProvider = 'openai';
        logger.info('[MemoryService] OpenAI Embeddings initialized');
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logger.warn('[MemoryService] OpenAI Embeddings failed', { error });
      }
    }

    // Fallback to local embeddings if OpenAI unavailable
    if (!this.embeddings && this.state.chromaHealthy) {
      try {
        this.embeddings = new LocalEmbeddingProvider();
        this.state.embeddingsProvider = 'local';
        logger.info('[MemoryService] Local Embeddings initialized (Chroma default)');
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logger.warn('[MemoryService] Local Embeddings failed', { error });
        this.state.embeddingsProvider = 'none';
      }
    }

    // ===== Initialize KV (Vercel KV -> Local Redis fallback) =====
    await this.initializeKV();

    this.state.initialized = true;
  }

  private async initializeKV(): Promise<void> {
    // Try Vercel KV first
    try {
      await kv.ping();
      this.state.kvHealthy = true;
      this.state.kvProvider = 'vercel';
      logger.info('[MemoryService] Vercel KV connected');
      return;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.debug('[MemoryService] Vercel KV unavailable, trying local Redis', {
        error,
      });
    }

    // Fallback to local Redis
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.localRedis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: times => {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        },
        lazyConnect: true,
      });

      await this.localRedis.connect();
      await this.localRedis.ping();
      this.state.kvHealthy = true;
      this.state.kvProvider = 'redis';
      logger.info('[MemoryService] Local Redis connected', {
        url: redisUrl.replace(/:[^:@]+@/, ':***@'),
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.warn('[MemoryService] Local Redis unavailable, short-term memory disabled', {
        url: redisUrl.replace(/:[^:@]+@/, ':***@'),
        error,
      });
      this.state.kvHealthy = false;
      this.state.kvProvider = 'none';
      if (this.localRedis) {
        this.localRedis.disconnect();
        this.localRedis = null;
      }
    }
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

      if (this.state.kvProvider === 'vercel') {
        const history = await kv.get<ChatMessage[]>(key);
        return history || [];
      } else if (this.localRedis) {
        const data = await this.localRedis.get(key);
        return data ? JSON.parse(data) : [];
      }

      return [];
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Failed to get session history', {
        sessionId,
        error,
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

      if (this.state.kvProvider === 'vercel') {
        await kv.set(key, history, { ex: MEMORY_CONFIG.SESSION_TTL });
      } else if (this.localRedis) {
        await this.localRedis.setex(key, MEMORY_CONFIG.SESSION_TTL, JSON.stringify(history));
      }
      return true;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Failed to add to session history', {
        sessionId,
        error,
      });
      return false;
    }
  }

  async clearSessionHistory(sessionId: string): Promise<boolean> {
    if (!this.state.kvHealthy) {
      return false;
    }

    try {
      const key = `history_${sessionId}`;
      if (this.state.kvProvider === 'vercel') {
        await kv.del(key);
      } else if (this.localRedis) {
        await this.localRedis.del(key);
      }
      return true;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Failed to clear session history', {
        sessionId,
        error,
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
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Failed to get/create collection', {
        sessionId,
        error,
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
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Failed to save to long-term memory', {
        sessionId,
        error,
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
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Failed to search context', {
        sessionId,
        error,
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
      const key = `history_${sessionId}`;
      if (this.state.kvProvider === 'vercel') {
        await kv.set(key, history, { ex: MEMORY_CONFIG.SESSION_TTL });
      } else if (this.localRedis) {
        await this.localRedis.setex(key, MEMORY_CONFIG.SESSION_TTL, JSON.stringify(history));
      }

      logger.info('[MemoryService] Memory migrated', {
        sessionId,
        migratedMessages: toMigrate.length,
        remainingMessages: history.length,
      });

      return true;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[MemoryService] Migration failed', {
        sessionId,
        error,
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
    kvProvider: 'vercel' | 'redis' | 'none';
    embeddingsProvider: 'openai' | 'local' | 'none';
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

    // Check KV health based on provider
    if (this.state.kvProvider === 'vercel') {
      try {
        await kv.ping();
        this.state.kvHealthy = true;
      } catch {
        this.state.kvHealthy = false;
      }
    } else if (this.localRedis) {
      try {
        await this.localRedis.ping();
        this.state.kvHealthy = true;
      } catch {
        this.state.kvHealthy = false;
      }
    }

    return {
      chromaHealthy: this.state.chromaHealthy,
      kvHealthy: this.state.kvHealthy,
      embeddingsAvailable: !!this.embeddings,
      kvProvider: this.state.kvProvider,
      embeddingsProvider: this.state.embeddingsProvider,
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const memoryService = new MemoryService();
