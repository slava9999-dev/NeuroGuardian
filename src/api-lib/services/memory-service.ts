import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { kv } from '@vercel/kv';

export class MemoryService {
  private chroma: ChromaClient;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8001';
    console.log(`[MemoryService] Initializing ChromaDB at ${chromaUrl}`);

    this.chroma = new ChromaClient({ path: chromaUrl });
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
    });

    if (!process.env.KV_URL && process.env.NODE_ENV !== 'production') {
      console.warn('[MemoryService] KV_URL is missing. Local short-term memory might fail.');
    }
  }

  // Краткосрочная память (KV/Redis)
  async getSessionHistory(sessionId: string) {
    try {
      const history = await kv.get(`history_${sessionId}`);
      return history || [];
    } catch (e: any) {
      console.error(`[MemoryService] Redis Error: ${e?.message || 'Unknown error'}`);
      return [];
    }
  }

  // Долгосрочная память (Vector DB)
  async saveToLongTerm(sessionId: string, text: string, metadata: any) {
    const collection = await this.chroma.getOrCreateCollection({ name: `user_${sessionId}` });
    const vector = await this.embeddings.embedQuery(text);

    await collection.add({
      ids: [Date.now().toString()],
      embeddings: [vector],
      metadatas: [metadata],
      documents: [text],
    });
  }

  async searchRelatedContext(sessionId: string, query: string) {
    const collection = await this.chroma.getOrCreateCollection({ name: `user_${sessionId}` });
    const vector = await this.embeddings.embedQuery(query);

    const results = await collection.query({
      queryEmbeddings: [vector],
      nResults: 3,
    });

    return results.documents[0] || [];
  }

  // Миграция: перенос старых сообщений из краткосрочной памяти в долгосрочную
  async packAndMigrate(sessionId: string) {
    const history: any[] = (await kv.get(`history_${sessionId}`)) || [];

    // Если история > 10 сообщений, берем первые 5, суммаризируем и переносим
    if (history.length > 10) {
      const toMigrate = history.splice(0, 5);
      const textToStore = toMigrate.map(m => `${m.role}: ${m.content}`).join('\n');

      await this.saveToLongTerm(sessionId, textToStore, {
        timestamp: new Date().toISOString(),
        type: 'memory_chunk',
      });

      // Обновляем краткосрочную память
      await kv.set(`history_${sessionId}`, history);
      return true;
    }
    return false;
  }
}

export const memoryService = new MemoryService();
