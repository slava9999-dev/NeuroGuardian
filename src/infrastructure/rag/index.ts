// ============================================
// NeuroGUARDIAN — RAG Infrastructure Index
// Exports all RAG components
// Version: 1.0.0 | Date: January 2026
// ============================================

// Vector Store
export {
  VectorStore,
  vectorStore,
  OpenAIEmbeddingProvider,
  GeminiEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingNamespace,
  type EmbeddingDocument,
  type SearchResult,
  type HybridSearchResult,
} from './VectorStore.js';

// Document Chunker
export {
  DocumentChunker,
  MarkdownParser,
  documentChunker,
  type DocumentChunk,
  type ChunkerOptions,
} from './DocumentChunker.js';

// Ingestion Pipeline
export {
  KnowledgeIngestionPipeline,
  knowledgeIngestion,
  ingestKnowledgeBase,
  type IngestionSource,
  type IngestionResult,
} from './IngestionPipeline.js';

// Specialist Knowledge Base
export {
  SpecialistKnowledgeBase,
  specialistKnowledgeBase,
  type SpecialistType,
  type RetrievedContext,
} from './SpecialistKnowledgeBase.js';
