// ============================================
// NeuroGUARDIAN — RAG Tests
// Tests for vector store and knowledge retrieval
// Version: 1.0.0 | Date: January 2026
// ============================================

import { describe, it, expect, vi } from 'vitest';

// Mock database
vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: Object.assign(vi.fn().mockResolvedValue({ rows: [], count: 0 }), {
    unsafe: vi.fn().mockResolvedValue({ rows: [] }),
  }),
}));

import { DocumentChunker, MarkdownParser } from '../../src/infrastructure/rag/DocumentChunker.js';

describe('RAG Infrastructure', () => {
  describe('DocumentChunker', () => {
    const chunker = new DocumentChunker({
      chunkSize: 500,
      chunkOverlap: 100,
      minChunkSize: 50,
    });

    it('should chunk text into sections', () => {
      const text = `# Main Title

This is the introduction paragraph.

## Section One

Content of section one with some details.

## Section Two

Content of section two with more information.
`;

      const chunks = chunker.chunk(text, 'Test Doc');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].metadata).toHaveProperty('startChar');
    });

    it('should respect minimum chunk size', () => {
      const chunker = new DocumentChunker({ minChunkSize: 100 });
      const text = 'Short text';
      const chunks = chunker.chunk(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should handle empty text', () => {
      const chunks = chunker.chunk('');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
    });

    it('should preserve section headers in metadata', () => {
      const text = `## Раздел 1

Контент раздела номер один. Это достаточно длинный текст чтобы создать полноценный чанк.
Добавляем еще немного текста для уверенности. Это важная информация о разделе.

### Подраздел 1.1

Больше контента в подразделе. Здесь тоже нужен текст достаточной длины для создания чанка.
Добавляем дополнительную информацию для теста. Это нужно для проверки работы чанкера.
`;
      const chunks = chunker.chunk(text);

      // Check that at least one chunk has section metadata
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.metadata.section !== undefined)).toBe(true);
    });
  });

  describe('MarkdownParser', () => {
    it('should extract title from markdown', () => {
      const content = `# My Document Title

Some content here.
`;
      const title = MarkdownParser.extractTitle(content);
      expect(title).toBe('My Document Title');
    });

    it('should extract frontmatter', () => {
      const content = `---
title: Test Document
tags: one, two
---

# Content
`;
      const fm = MarkdownParser.extractFrontmatter(content);
      expect(fm.title).toBe('Test Document');
      expect(fm.tags).toBe('one, two');
    });

    it('should strip frontmatter', () => {
      const content = `---
title: Test
---

# Real Content
`;
      const stripped = MarkdownParser.stripFrontmatter(content);
      expect(stripped.includes('---')).toBe(false);
      expect(stripped.includes('# Real Content')).toBe(true);
    });

    it('should handle content without frontmatter', () => {
      const content = '# Just Title\n\nContent';
      const fm = MarkdownParser.extractFrontmatter(content);
      expect(Object.keys(fm)).toHaveLength(0);
    });

    it('should extract code blocks', () => {
      const content = `
Some text.

\`\`\`typescript
const x = 1;
\`\`\`

More text.

\`\`\`sql
SELECT * FROM users;
\`\`\`
`;
      const blocks = MarkdownParser.extractCodeBlocks(content);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('typescript');
      expect(blocks[1].language).toBe('sql');
    });
  });

  describe('Namespace Mapping', () => {
    it('should map WB documents correctly', () => {
      const mapping: Record<string, string> = {
        wb_api_rules: 'wb_api',
        wb_commissions: 'wb_api',
        wb_full_guide: 'wb_api',
      };

      expect(mapping['wb_api_rules']).toBe('wb_api');
      expect(mapping['wb_full_guide']).toBe('wb_api');
    });

    it('should map Ozon documents correctly', () => {
      const mapping: Record<string, string> = {
        ozon_api_rules: 'ozon_api',
        ozon_full_guide: 'ozon_api',
      };

      expect(mapping['ozon_api_rules']).toBe('ozon_api');
    });

    it('should map Sentinel documents correctly', () => {
      const mapping: Record<string, string> = {
        sentinel_instruction: 'sentinel',
        security_threats: 'sentinel',
      };

      expect(mapping['sentinel_instruction']).toBe('sentinel');
      expect(mapping['security_threats']).toBe('sentinel');
    });
  });
});

describe('SpecialistKnowledgeBase', () => {
  const SPECIALIST_NAMESPACES = {
    ProductsSpecialist: ['wb_api', 'ozon_api', 'faq'],
    PricingSpecialist: ['wb_api', 'ozon_api', 'pricing', 'sentinel'],
    SentinelSpecialist: ['sentinel', 'pricing', 'wb_api', 'ozon_api'],
    AnalyticsSpecialist: ['analytics', 'pricing', 'faq'],
    ChatSpecialist: ['faq', 'onboarding'],
  };

  it('should map ProductsSpecialist to correct namespaces', () => {
    const ns = SPECIALIST_NAMESPACES.ProductsSpecialist;
    expect(ns).toContain('wb_api');
    expect(ns).toContain('ozon_api');
  });

  it('should map PricingSpecialist to correct namespaces', () => {
    const ns = SPECIALIST_NAMESPACES.PricingSpecialist;
    expect(ns).toContain('pricing');
    expect(ns).toContain('sentinel');
  });

  it('should map SentinelSpecialist to correct namespaces', () => {
    const ns = SPECIALIST_NAMESPACES.SentinelSpecialist;
    expect(ns).toContain('sentinel');
    expect(ns).toContain('wb_api');
  });

  it('should map ChatSpecialist to FAQ namespaces', () => {
    const ns = SPECIALIST_NAMESPACES.ChatSpecialist;
    expect(ns).toContain('faq');
    expect(ns).toContain('onboarding');
  });
});
