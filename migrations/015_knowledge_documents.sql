-- Migration: 015_knowledge_documents
-- Description: Knowledge base for AI agent
-- Date: 2025-12-28
-- Author: NeuroGUARDIAN Production Readiness

-- ============================================
-- KNOWLEDGE DOCUMENTS TABLE
-- Stores documentation and knowledge for AI agent context
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id VARCHAR(100) PRIMARY KEY,
    
    -- Source classification
    source VARCHAR(50) NOT NULL, -- 'ozon_docs', 'wildberries_docs', 'internal', 'faq', 'policy'
    category VARCHAR(50), -- 'api', 'pricing', 'stocks', 'promotions', 'troubleshooting'
    
    -- Content
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT, -- Short summary for quick reference
    
    -- Vector embedding for semantic search (requires pgvector extension)
    -- Uncomment if pgvector is installed:
    -- embedding vector(1536), -- OpenAI ada-002 embedding dimension
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    source_url VARCHAR(1000), -- Original source URL if applicable
    version VARCHAR(20), -- API version if applicable
    language VARCHAR(10) DEFAULT 'ru', -- Content language
    
    -- Search optimization
    keywords TEXT[], -- Keywords for text search
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Source and category filtering
CREATE INDEX idx_knowledge_source ON knowledge_documents(source);
CREATE INDEX idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX idx_knowledge_active ON knowledge_documents(active) WHERE active = true;

-- Full-text search index (Russian language)
CREATE INDEX idx_knowledge_content_fts 
    ON knowledge_documents 
    USING gin(to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Keywords array search
CREATE INDEX idx_knowledge_keywords ON knowledge_documents USING gin(keywords);

-- Vector similarity index (requires pgvector - uncomment if available)
-- CREATE INDEX idx_knowledge_embedding ON knowledge_documents 
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_knowledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_documents_updated
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_timestamp();

-- ============================================
-- HELPER FUNCTION: Full-Text Search
-- ============================================

CREATE OR REPLACE FUNCTION search_knowledge(
    query_text TEXT,
    source_filter VARCHAR(50) DEFAULT NULL,
    result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id VARCHAR(100),
    title VARCHAR(500),
    source VARCHAR(50),
    snippet TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kd.id,
        kd.title,
        kd.source,
        ts_headline('russian', kd.content, plainto_tsquery('russian', query_text), 
                    'MaxWords=50, MinWords=20, StartSel=**, StopSel=**') as snippet,
        ts_rank(to_tsvector('russian', kd.title || ' ' || kd.content), 
                plainto_tsquery('russian', query_text)) as rank
    FROM knowledge_documents kd
    WHERE kd.active = true
      AND (source_filter IS NULL OR kd.source = source_filter)
      AND to_tsvector('russian', kd.title || ' ' || kd.content) @@ plainto_tsquery('russian', query_text)
    ORDER BY rank DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DATA: Essential Knowledge
-- ============================================

INSERT INTO knowledge_documents (id, source, category, title, content, keywords) VALUES
('wb_api_prices', 'wildberries_docs', 'api', 
 'Wildberries API: Управление ценами',
 'API Wildberries для управления ценами товаров. Endpoint: /api/v2/upload/task. 
  Для обновления цен используется POST запрос с массивом товаров. 
  Важно: WB API асинхронный - код 200 означает только постановку задачи в очередь. 
  Для проверки статуса используйте /api/v2/history/tasks.
  Лимиты: не более 100 запросов в минуту.',
 ARRAY['wildberries', 'wb', 'цены', 'api', 'обновление']),

('ozon_api_prices', 'ozon_docs', 'api',
 'Ozon API: Управление ценами и акциями',
 'Ozon Seller API для управления ценами. Endpoint: /v1/product/import/prices.
  Для получения текущих цен: /v4/product/info/prices.
  Для выхода из акций: /v1/actions/products/deactivate.
  Важно: Ozon может вернуть 200 OK с ошибками внутри result.errors.
  Лимиты зависят от endpoint, обычно 50-100 запросов в минуту.',
 ARRAY['ozon', 'озон', 'цены', 'api', 'акции']),

('price_protection_rules', 'internal', 'policy',
 'Правила защиты цены',
 'Система защиты цены NeuroGUARDIAN отслеживает изменения цен и автоматически 
  реагирует на нежелательные акции маркетплейсов.
  
  Правила:
  1. Минимальная цена (min_price) - пол, ниже которого цена не должна опускаться
  2. Максимальная цена (max_price) - потолок для автоматических повышений
  3. Целевая маржа (target_margin) - оптимальная маржинальность в %
  
  При обнаружении акции, снижающей цену ниже минимума, система может:
  - Отправить уведомление (notification_enabled)
  - Автоматически выйти из акции (auto_protect)
  - Скорректировать цену (auto_adjust)',
 ARRAY['защита', 'цена', 'правила', 'маржа', 'акции'])
ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE knowledge_documents IS 'Knowledge base for AI agent context and search';
COMMENT ON COLUMN knowledge_documents.source IS 'Document source: ozon_docs, wildberries_docs, internal, faq, policy';
COMMENT ON COLUMN knowledge_documents.category IS 'Document category: api, pricing, stocks, promotions, troubleshooting';
COMMENT ON FUNCTION search_knowledge IS 'Full-text search function with ranking and snippets';
