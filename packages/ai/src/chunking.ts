import { encoding_for_model } from 'tiktoken';
import { marked } from 'marked';

export interface TextChunk {
  content: string;
  tokenCount: number;
  index: number;
}

export class TextChunker {
  private encoder;
  private maxTokens: number;
  private overlap: number;

  constructor(maxTokens: number = 512, overlap: number = 50) {
    this.encoder = encoding_for_model('gpt-4');
    this.maxTokens = maxTokens;
    this.overlap = overlap;
  }

  // Preprocess markdown content
  preprocessMarkdown(content: string): string {
    // Clean up content first
    let cleaned = content
      .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .trim();

    // Parse markdown to extract plain text while preserving structure
    const renderer = new marked.Renderer();
    
    // Preserve headers with their level and add context
    renderer.heading = (text, level) => {
      const cleanText = this.cleanText(text);
      return `\n${'#'.repeat(level)} ${cleanText}\n`;
    };
    
    // Preserve lists with better formatting
    renderer.listitem = (text) => {
      const cleanText = this.cleanText(text);
      return `• ${cleanText}\n`;
    };
    
    // Preserve code blocks with language info
    renderer.code = (code, language) => {
      const cleanCode = code.trim();
      if (cleanCode.length === 0) return '';
      return `\`\`\`${language || 'text'}\n${cleanCode}\n\`\`\`\n`;
    };
    
    // Handle inline code
    renderer.codespan = (code) => `\`${code}\``;
    
    // Handle tables better
    renderer.table = (header, body) => {
      return `\nجدول:\n${header}${body}\n`;
    };
    
    // Handle links with context
    renderer.link = (href, title, text) => {
      return title ? `${text} (${title})` : text;
    };
    
    // Remove HTML tags but keep content
    renderer.html = (html) => {
      // Extract text content from HTML
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    };

    const processed = marked(cleaned, { renderer });
    return this.postProcessText(processed);
  }

  // Clean text from unwanted characters and normalize
  private cleanText(text: string): string {
    return text
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Post-process the markdown-processed text
  private postProcessText(text: string): string {
    return text
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple newlines
      .replace(/\s+$/gm, '') // Remove trailing spaces
      .replace(/^\s+/gm, '') // Remove leading spaces
      .trim();
  }

  // Count tokens in text
  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }

  // Split text into chunks with overlap
  chunkText(content: string): TextChunk[] {
    const preprocessed = this.preprocessMarkdown(content);
    
    if (!preprocessed || preprocessed.trim().length === 0) {
      return [];
    }
    
    // Split by paragraphs first
    const paragraphs = preprocessed
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => this.isValidParagraph(p));

    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.countTokens(paragraph);
      
      // If single paragraph exceeds max tokens, split it further
      if (paragraphTokens > this.maxTokens) {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            tokenCount: currentTokens,
            index: chunkIndex++,
          });
          currentChunk = '';
          currentTokens = 0;
        }

        // Split large paragraph by sentences
        const sentences = this.splitBySentences(paragraph);
        let sentenceChunk = '';
        let sentenceTokens = 0;

        for (const sentence of sentences) {
          const sentenceTokenCount = this.countTokens(sentence);
          
          if (sentenceTokens + sentenceTokenCount > this.maxTokens && sentenceChunk) {
            chunks.push({
              content: sentenceChunk.trim(),
              tokenCount: sentenceTokens,
              index: chunkIndex++,
            });
            
            // Add overlap from previous chunk
            const overlapText = this.getOverlapText(sentenceChunk, this.overlap);
            sentenceChunk = overlapText + sentence;
            sentenceTokens = this.countTokens(sentenceChunk);
          } else {
            sentenceChunk += sentence;
            sentenceTokens += sentenceTokenCount;
          }
        }

        if (sentenceChunk.trim()) {
          chunks.push({
            content: sentenceChunk.trim(),
            tokenCount: sentenceTokens,
            index: chunkIndex++,
          });
        }
      } else {
        // Check if adding this paragraph exceeds token limit
        if (currentTokens + paragraphTokens > this.maxTokens && currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            tokenCount: currentTokens,
            index: chunkIndex++,
          });

          // Start new chunk with overlap
          const overlapText = this.getOverlapText(currentChunk, this.overlap);
          currentChunk = overlapText + '\n\n' + paragraph;
          currentTokens = this.countTokens(currentChunk);
        } else {
          // Add paragraph to current chunk
          if (currentChunk) {
            currentChunk += '\n\n' + paragraph;
          } else {
            currentChunk = paragraph;
          }
          currentTokens += paragraphTokens;
        }
      }
    }

    // Add final chunk if it has content
    if (currentChunk.trim()) {
      const finalChunk = {
        content: currentChunk.trim(),
        tokenCount: currentTokens,
        index: chunkIndex,
      };
      
      if (this.isValidChunk(finalChunk)) {
        chunks.push(finalChunk);
      }
    }

    // Filter and clean all chunks
    return chunks
      .filter(chunk => this.isValidChunk(chunk))
      .map((chunk, index) => ({
        ...chunk,
        index,
        content: this.finalCleanChunk(chunk.content),
      }));
  }

  // Split text by sentences (supports Persian text)
  private splitBySentences(text: string): string[] {
    // Persian and English sentence endings
    const sentenceEnders = /[.!?؟۔]\s+/g;
    const sentences = text.split(sentenceEnders);
    
    // Rejoin with sentence endings
    const result: string[] = [];
    const matches = text.match(sentenceEnders) || [];
    
    for (let i = 0; i < sentences.length; i++) {
      if (i < matches.length) {
        result.push(sentences[i] + matches[i]);
      } else {
        result.push(sentences[i]);
      }
    }
    
    return result.filter(s => s.trim().length > 0);
  }

  // Get overlap text from the end of a chunk (sentence-aware)
  private getOverlapText(text: string, overlapTokens: number): string {
    if (overlapTokens <= 0) return '';
    
    // Try to get complete sentences for overlap
    const sentences = this.splitBySentences(text);
    let overlapText = '';
    let tokens = 0;
    
    // Build overlap from the end, sentence by sentence
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.countTokens(sentences[i]);
      
      if (tokens + sentenceTokens <= overlapTokens) {
        overlapText = sentences[i] + ' ' + overlapText;
        tokens += sentenceTokens;
      } else {
        break;
      }
    }
    
    // If no complete sentences fit, fall back to token-based overlap
    if (!overlapText.trim()) {
      const allTokens = this.encoder.encode(text);
      if (allTokens.length <= overlapTokens) return text;
      
      const overlapTokensArray = allTokens.slice(-overlapTokens);
      overlapText = this.encoder.decode(overlapTokensArray) as unknown as string;
    }
    
    return overlapText.trim();
  }

  // Validate if a paragraph is worth processing
  private isValidParagraph(paragraph: string): boolean {
    if (!paragraph || paragraph.trim().length < 10) return false;
    
    // Skip paragraphs that are mostly punctuation or markdown syntax
    const cleanPara = paragraph.replace(/[#*`\-_\s]/g, '');
    if (cleanPara.length < 5) return false;
    
    // Skip if it's just a URL or email
    if (/^https?:\/\//.test(paragraph.trim()) || /^[\w\.-]+@[\w\.-]+\.\w+$/.test(paragraph.trim())) {
      return false;
    }
    
    return true;
  }

  // Validate if a chunk is worth storing
  private isValidChunk(chunk: TextChunk): boolean {
    if (!chunk.content || chunk.content.trim().length < 20) return false;
    if (chunk.tokenCount < 5 || chunk.tokenCount > this.maxTokens * 1.5) return false;
    
    // Check content quality
    const words = chunk.content.trim().split(/\s+/);
    if (words.length < 5) return false;
    
    // Skip chunks that are mostly markdown syntax
    const cleanContent = chunk.content.replace(/[#*`\-_\s\n]/g, '');
    if (cleanContent.length < chunk.content.length * 0.3) return false;
    
    return true;
  }

  // Final cleanup for chunk content
  private finalCleanChunk(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n') // Normalize newlines
      .replace(/\s+$/gm, '') // Remove trailing spaces
      .replace(/^\s+/gm, '') // Remove leading spaces
      .trim();
  }

  // Clean up encoder resources
  dispose() {
    this.encoder.free();
  }
} 