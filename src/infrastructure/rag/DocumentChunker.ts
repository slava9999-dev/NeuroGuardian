// ============================================
// NeuroGUARDIAN — Document Chunker
// Splits documents into embeddable chunks
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../../api-lib/lib/logger.js';

// ============================================
// Types
// ============================================

export interface DocumentChunk {
  content: string;
  index: number;
  title?: string;
  metadata: {
    startChar: number;
    endChar: number;
    section?: string;
    headers?: string[];
  };
}

export interface ChunkerOptions {
  chunkSize?: number; // Target size in characters (default: 1000)
  chunkOverlap?: number; // Overlap between chunks (default: 200)
  minChunkSize?: number; // Minimum chunk size (default: 100)
  respectSections?: boolean; // Try to split at markdown headers
}

// ============================================
// Document Chunker
// ============================================

export class DocumentChunker {
  private options: Required<ChunkerOptions>;

  constructor(options?: ChunkerOptions) {
    this.options = {
      chunkSize: options?.chunkSize || 1000,
      chunkOverlap: options?.chunkOverlap || 200,
      minChunkSize: options?.minChunkSize || 100,
      respectSections: options?.respectSections ?? true,
    };
  }

  /**
   * Split text into chunks
   */
  chunk(text: string, docTitle?: string): DocumentChunk[] {
    if (!text || text.length < this.options.minChunkSize) {
      return [
        {
          content: text,
          index: 0,
          title: docTitle,
          metadata: { startChar: 0, endChar: text.length },
        },
      ];
    }

    // If respecting sections, split by markdown headers first
    if (this.options.respectSections) {
      return this.chunkBySections(text, docTitle);
    }

    return this.chunkBySize(text, docTitle);
  }

  /**
   * Chunk by markdown sections (headers)
   */
  private chunkBySections(text: string, docTitle?: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Split by headers (## or ###)
    const sectionRegex = /^(#{1,3})\s+(.+)$/gm;
    const sections: { header: string; level: number; start: number; content: string }[] = [];

    let lastIndex = 0;
    let match;

    while ((match = sectionRegex.exec(text)) !== null) {
      if (lastIndex < match.index) {
        // Content before this header belongs to previous section
        if (sections.length > 0) {
          sections[sections.length - 1].content = text.slice(
            sections[sections.length - 1].start,
            match.index
          );
        } else {
          // Intro content (before first header)
          sections.push({
            header: docTitle || 'Introduction',
            level: 1,
            start: 0,
            content: text.slice(0, match.index),
          });
        }
      }

      sections.push({
        header: match[2].trim(),
        level: match[1].length,
        start: match.index,
        content: '',
      });

      lastIndex = match.index + match[0].length;
    }

    // Last section gets remaining content
    if (sections.length > 0) {
      sections[sections.length - 1].content = text.slice(sections[sections.length - 1].start);
    } else {
      // No headers found, treat entire text as one section
      sections.push({
        header: docTitle || 'Content',
        level: 1,
        start: 0,
        content: text,
      });
    }

    // Process each section
    let chunkIndex = 0;
    const headerStack: string[] = [];

    for (const section of sections) {
      // Update header stack
      while (headerStack.length >= section.level) {
        headerStack.pop();
      }
      headerStack.push(section.header);

      const sectionContent = section.content.trim();
      if (!sectionContent || sectionContent.length < this.options.minChunkSize) {
        continue;
      }

      // If section is small enough, keep as one chunk
      if (sectionContent.length <= this.options.chunkSize) {
        chunks.push({
          content: sectionContent,
          index: chunkIndex++,
          title: section.header,
          metadata: {
            startChar: section.start,
            endChar: section.start + sectionContent.length,
            section: section.header,
            headers: [...headerStack],
          },
        });
      } else {
        // Split large sections by size
        const subChunks = this.chunkBySize(sectionContent);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            index: chunkIndex++,
            title: section.header,
            metadata: {
              ...subChunk.metadata,
              startChar: section.start + subChunk.metadata.startChar,
              endChar: section.start + subChunk.metadata.endChar,
              section: section.header,
              headers: [...headerStack],
            },
          });
        }
      }
    }

    logger.debug(`[DocumentChunker] Split into ${chunks.length} chunks by sections`);
    return chunks;
  }

  /**
   * Chunk by size with overlap
   */
  private chunkBySize(text: string, docTitle?: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const { chunkSize, chunkOverlap, minChunkSize } = this.options;

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmedPara = paragraph.trim();
      if (!trimmedPara) continue;

      // If adding this paragraph exceeds chunk size, save current and start new
      if (
        currentChunk.length + trimmedPara.length > chunkSize &&
        currentChunk.length >= minChunkSize
      ) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          title: docTitle,
          metadata: {
            startChar: currentStart,
            endChar: currentStart + currentChunk.length,
          },
        });

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
        currentStart = currentStart + currentChunk.length - overlapText.length;
        currentChunk = overlapText + '\n\n' + trimmedPara;
      } else {
        if (currentChunk) {
          currentChunk += '\n\n' + trimmedPara;
        } else {
          currentChunk = trimmedPara;
        }
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        title: docTitle,
        metadata: {
          startChar: currentStart,
          endChar: currentStart + currentChunk.length,
        },
      });
    }

    return chunks;
  }

  /**
   * Get overlap text from end of chunk
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to find a sentence boundary
    const lastPart = text.slice(-overlapSize * 1.5);
    const sentenceEnd = lastPart.search(/[.!?]\s/);

    if (sentenceEnd > 0 && sentenceEnd < overlapSize) {
      return lastPart.slice(sentenceEnd + 2);
    }

    // Fallback to word boundary
    const words = text.slice(-overlapSize).split(/\s+/);
    return words.slice(1).join(' ');
  }
}

// ============================================
// Markdown Document Parser
// ============================================

export class MarkdownParser {
  /**
   * Extract title from markdown content
   */
  static extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract frontmatter from markdown
   */
  static extractFrontmatter(content: string): Record<string, string> {
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) return {};

    const frontmatter: Record<string, string> = {};
    const lines = fmMatch[1].split('\n');

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }

    return frontmatter;
  }

  /**
   * Remove frontmatter from content
   */
  static stripFrontmatter(content: string): string {
    return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
  }

  /**
   * Extract code blocks
   */
  static extractCodeBlocks(content: string): { language: string; code: string }[] {
    const blocks: { language: string; code: string }[] = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return blocks;
  }
}

// Default instance
export const documentChunker = new DocumentChunker();
