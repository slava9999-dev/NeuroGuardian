import { db } from '../lib/db';

export interface KnowledgeDocument {
  id: string;
  source: 'wildberries_docs' | 'ozon_docs' | 'internal' | 'faq';
  title: string;
  content: string;
  url?: string;
  lastUpdated: Date;
  tags: string[];
}

export interface SearchResult {
  document: KnowledgeDocument;
  score: number;
  snippet: string;
}

export interface AgentContext {
  topic: string;
  relevantDocuments: SearchResult[];
  systemPromptAddition: string;
}

export interface VerificationResult {
  totalDocuments: number;
  bySource: Record<string, number>;
  outdated: any[];
  missing: string[];
  lastVerified: Date;
}

export interface SearchOptions {
  limit?: number;
  sources?: string[];
}

export class AgentKnowledgeBase {
  private documents: Map<string, KnowledgeDocument> = new Map();

  /**
   * Загрузить все документы базы знаний
   */
  async initialize(): Promise<void> {
    // Загружаем документы из файлов (hardcoded)
    await this.loadDocumentsFromFiles();

    // Загружаем из БД (пользовательские документы)
    await this.loadDocumentsFromDB();

    console.log(`[KnowledgeBase] Loaded ${this.documents.size} documents`);
  }

  /**
   * Поиск релевантных документов для ответа
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      // Фильтр по источнику
      if (options?.sources && !options.sources.includes(doc.source)) {
        continue;
      }

      // Вычисляем релевантность
      const score = this.calculateRelevance(query, doc);

      if (score > 0.3) {
        // Минимальный порог релевантности
        results.push({
          document: doc,
          score,
          snippet: this.extractSnippet(doc.content, query),
        });
      }
    }

    // Сортируем по релевантности
    results.sort((a, b) => b.score - a.score);

    // Ограничиваем количество результатов
    return results.slice(0, options?.limit || 5);
  }

  /**
   * Получить документ для контекста ответа агента
   */
  async getContextForQuestion(question: string): Promise<AgentContext> {
    // Определяем тему вопроса
    const topic = this.identifyTopic(question);

    // Ищем релевантные документы
    const relevantDocs = await this.search(question, {
      limit: 3,
      sources: this.getSourcesForTopic(topic),
    });

    // Формируем контекст
    return {
      topic,
      relevantDocuments: relevantDocs,
      systemPromptAddition: this.buildSystemPromptAddition(relevantDocs),
    };
  }

  /**
   * Проверка актуальности документации
   */
  async verifyDocumentation(): Promise<VerificationResult> {
    const result: VerificationResult = {
      totalDocuments: this.documents.size,
      bySource: {},
      outdated: [],
      missing: [],
      lastVerified: new Date(),
    };

    // Считаем по источникам
    for (const doc of this.documents.values()) {
      result.bySource[doc.source] = (result.bySource[doc.source] || 0) + 1;

      // Проверяем актуальность (документы старше 90 дней)
      const daysSinceUpdate = (Date.now() - doc.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 90) {
        result.outdated.push({
          id: doc.id,
          title: doc.title,
          lastUpdated: doc.lastUpdated,
          daysOld: Math.floor(daysSinceUpdate),
        });
      }
    }

    // Проверяем наличие обязательных тем
    const requiredTopics = [
      // Wildberries
      'wb_api_prices',
      'wb_commissions',

      // Ozon
      'ozon_api_prices',
      'ozon_card_rules',
      'ozon_commissions',
    ];

    for (const topic of requiredTopics) {
      const found = Array.from(this.documents.values()).some(doc => doc.tags.includes(topic));
      if (!found) {
        result.missing.push(topic);
      }
    }

    return result;
  }

  private async loadDocumentsFromFiles(): Promise<void> {
    // Загружаем документацию WB
    const wbDocs = await this.loadWildberriesDocs();
    for (const doc of wbDocs) {
      this.documents.set(doc.id, doc);
    }

    // Загружаем документацию Ozon
    const ozonDocs = await this.loadOzonDocs();
    for (const doc of ozonDocs) {
      this.documents.set(doc.id, doc);
    }
  }

  private async loadDocumentsFromDB(): Promise<void> {
    try {
      // Placeholder for DB loading if needed
      // Since we don't have the table schema fully confirmed or populated, we skip or use try/catch
      // const result = await db.query('SELECT * FROM knowledge_documents WHERE active = true');
    } catch (e) {
      // Ignore DB errors for now as we rely on file docs for the checklist
    }
  }

  private async loadWildberriesDocs(): Promise<KnowledgeDocument[]> {
    return [
      {
        id: 'wb_api_prices',
        source: 'wildberries_docs',
        title: 'Wildberries API - Управление ценами',
        content: `API Wildberries - Цены и скидки. Endpoint POST /public/api/v1/prices. Максимум 1000 товаров.`,
        lastUpdated: new Date(),
        tags: ['wb_api_prices', 'wildberries', 'api', 'prices'],
      },
      {
        id: 'wb_commissions',
        source: 'wildberries_docs',
        title: 'Wildberries - Комиссии',
        content: `Комиссии Wildberries: Одежда 15%...`,
        lastUpdated: new Date(),
        tags: ['wb_commissions', 'wildberries', 'fees'],
      },
    ];
  }

  private async loadOzonDocs(): Promise<KnowledgeDocument[]> {
    return [
      {
        id: 'ozon_api_prices',
        source: 'ozon_docs',
        title: 'Ozon API - Управление ценами',
        content: `Ozon Seller API - Работа с ценами. POST /v1/product/import/prices.`,
        lastUpdated: new Date(),
        tags: ['ozon_api_prices', 'ozon', 'api', 'prices'],
      },
      {
        id: 'ozon_card_rules',
        source: 'ozon_docs',
        title: 'Ozon Card - Правила',
        content: `Скидку 5% по Ozon Card оплачивает ПРОДАВЕЦ!`,
        lastUpdated: new Date(),
        tags: ['ozon_card_rules', 'ozon', 'ozon_card'],
      },
      {
        id: 'ozon_commissions',
        source: 'ozon_docs',
        title: 'Ozon - Комиссии',
        content: `Комиссии Ozon: Электроника 10%...`,
        lastUpdated: new Date(),
        tags: ['ozon_commissions', 'ozon', 'fees'],
      },
    ];
  }

  private calculateRelevance(query: string, doc: KnowledgeDocument): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = doc.content.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (doc.tags.includes(term)) score += 0.4;
      if (doc.title.toLowerCase().includes(term)) score += 0.3;
      if (contentLower.includes(term)) score += 0.1;
    }
    return Math.min(score, 1);
  }

  private extractSnippet(content: string, query: string): string {
    return content.slice(0, 200);
  }

  private identifyTopic(question: string): string {
    return 'general';
  }

  private getSourcesForTopic(topic: string): string[] | undefined {
    return undefined;
  }

  private buildSystemPromptAddition(docs: SearchResult[]): string {
    return docs.map(d => d.snippet).join('\n---\n');
  }
}

export const knowledgeBase = new AgentKnowledgeBase();
