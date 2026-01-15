// ============================================
// NeuroGUARDIAN — Knowledge Ingestion Pipeline
// Loads and indexes documents into vector store
// Version: 1.0.0 | Date: January 2026
// ============================================

import { promises as fs } from 'fs';
import path from 'path';
import { vectorStore, type EmbeddingNamespace, type EmbeddingDocument } from './VectorStore.js';
import { DocumentChunker, MarkdownParser } from './DocumentChunker.js';
import { logger } from '../../api-lib/lib/logger.js';

// ============================================
// Types
// ============================================

export interface IngestionSource {
  path: string; // File or directory path
  namespace: EmbeddingNamespace;
  recursive?: boolean;
  filePattern?: RegExp;
}

export interface IngestionResult {
  source: string;
  documentsProcessed: number;
  chunksCreated: number;
  errors: string[];
  duration: number;
}

export interface NamespaceMapping {
  [key: string]: EmbeddingNamespace;
}

// ============================================
// Default namespace mappings for knowledge base
// ============================================

const DEFAULT_NAMESPACE_MAPPING: NamespaceMapping = {
  // WB related
  wb_api_rules: 'wb_api',
  wb_commissions: 'wb_api',
  wb_full_guide: 'wb_api',

  // Ozon related
  ozon_api_rules: 'ozon_api',
  ozon_commissions: 'ozon_api',
  ozon_full_guide: 'ozon_api',

  // Sentinel/Security
  sentinel_instruction: 'sentinel',
  security_threats: 'sentinel',
  spp_buffer_guide: 'sentinel',

  // Pricing
  pricing_strategies: 'pricing',

  // Analytics
  unit_economics_guide: 'analytics',
  seasonality_calendar: 'analytics',

  // FAQ/Onboarding
  faq: 'faq',
  api_keys_guide: 'onboarding',
  app_guide: 'onboarding',
  common_mistakes: 'faq',
  quick_responses: 'faq',
  success_cases: 'faq',
  reviews_guide: 'faq',
  viktor_personality: 'faq',
};

// ============================================
// Knowledge Ingestion Pipeline
// ============================================

export class KnowledgeIngestionPipeline {
  private chunker: DocumentChunker;
  private namespaceMapping: NamespaceMapping;

  constructor(options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    namespaceMapping?: NamespaceMapping;
  }) {
    this.chunker = new DocumentChunker({
      chunkSize: options?.chunkSize || 1000,
      chunkOverlap: options?.chunkOverlap || 200,
      respectSections: true,
    });
    this.namespaceMapping = options?.namespaceMapping || DEFAULT_NAMESPACE_MAPPING;
  }

  /**
   * Ingest all documents from a directory
   */
  async ingestDirectory(
    dirPath: string,
    defaultNamespace: EmbeddingNamespace = 'faq',
    options?: { recursive?: boolean; filePattern?: RegExp }
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const result: IngestionResult = {
      source: dirPath,
      documentsProcessed: 0,
      chunksCreated: 0,
      errors: [],
      duration: 0,
    };

    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const files = await this.getFiles(absolutePath, options?.recursive, options?.filePattern);

      logger.info(`[Ingestion] Found ${files.length} files in ${dirPath}`);

      for (const filePath of files) {
        try {
          const fileResult = await this.ingestFile(filePath, defaultNamespace);
          result.documentsProcessed++;
          result.chunksCreated += fileResult;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`${filePath}: ${errorMsg}`);
          logger.error(`[Ingestion] Error processing ${filePath}:`, error);
        }
      }

      result.duration = Date.now() - startTime;
      logger.info(
        `[Ingestion] Completed: ${result.documentsProcessed} docs, ${result.chunksCreated} chunks in ${result.duration}ms`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMsg);
      logger.error('[Ingestion] Directory error:', error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Ingest a single file
   */
  async ingestFile(
    filePath: string,
    defaultNamespace: EmbeddingNamespace = 'faq'
  ): Promise<number> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));

    // Determine namespace from mapping or use default
    const namespace = this.namespaceMapping[fileName] || defaultNamespace;

    // Parse markdown
    const frontmatter = MarkdownParser.extractFrontmatter(content);
    const cleanContent = MarkdownParser.stripFrontmatter(content);
    const title = MarkdownParser.extractTitle(cleanContent) || fileName;

    // Chunk the document
    const chunks = this.chunker.chunk(cleanContent, title);

    // Prepare documents for vector store
    const documents: EmbeddingDocument[] = chunks.map((chunk, index) => ({
      namespace,
      sourceFile: fileName,
      chunkIndex: index,
      title: chunk.title || title,
      content: chunk.content,
      metadata: {
        ...frontmatter,
        ...chunk.metadata,
        originalFile: filePath,
        totalChunks: chunks.length,
      },
    }));

    // Add to vector store
    await vectorStore.addDocuments(documents);

    logger.debug(`[Ingestion] Processed ${fileName}: ${chunks.length} chunks`);
    return chunks.length;
  }

  /**
   * Ingest from multiple sources
   */
  async ingestSources(sources: IngestionSource[]): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    for (const source of sources) {
      const stats = await fs.stat(source.path).catch(() => null);

      if (!stats) {
        results.push({
          source: source.path,
          documentsProcessed: 0,
          chunksCreated: 0,
          errors: [`Path not found: ${source.path}`],
          duration: 0,
        });
        continue;
      }

      if (stats.isDirectory()) {
        const result = await this.ingestDirectory(source.path, source.namespace, {
          recursive: source.recursive,
          filePattern: source.filePattern,
        });
        results.push(result);
      } else {
        const startTime = Date.now();
        try {
          const chunks = await this.ingestFile(source.path, source.namespace);
          results.push({
            source: source.path,
            documentsProcessed: 1,
            chunksCreated: chunks,
            errors: [],
            duration: Date.now() - startTime,
          });
        } catch (error) {
          results.push({
            source: source.path,
            documentsProcessed: 0,
            chunksCreated: 0,
            errors: [error instanceof Error ? error.message : String(error)],
            duration: Date.now() - startTime,
          });
        }
      }
    }

    return results;
  }

  /**
   * Get all files from directory
   */
  private async getFiles(
    dirPath: string,
    recursive = false,
    pattern: RegExp = /\.md$/
  ): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        const subFiles = await this.getFiles(fullPath, recursive, pattern);
        files.push(...subFiles);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Clear namespace and re-ingest
   */
  async refreshNamespace(
    namespace: EmbeddingNamespace,
    sourcePath: string
  ): Promise<IngestionResult> {
    // Delete existing documents
    const deleted = await vectorStore.deleteDocuments({ namespace });
    logger.info(`[Ingestion] Deleted ${deleted} existing documents from ${namespace}`);

    // Re-ingest
    return this.ingestDirectory(sourcePath, namespace);
  }
}

// ============================================
// Singleton and helper functions
// ============================================

export const knowledgeIngestion = new KnowledgeIngestionPipeline();

/**
 * Quick function to ingest default knowledge base
 */
export async function ingestKnowledgeBase(): Promise<IngestionResult> {
  return knowledgeIngestion.ingestDirectory('docs/knowledge_base', 'faq');
}
