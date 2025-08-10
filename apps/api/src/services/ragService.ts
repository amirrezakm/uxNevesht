import { supabase } from '@ux-nevesht/database';
import { EmbeddingsService } from '@ux-nevesht/ai';

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  document_title: string;
}

export class RAGService {
  private embeddings: EmbeddingsService;

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.embeddings = new EmbeddingsService(openaiApiKey);
  }

  async searchRelevantChunks(
    query: string,
    similarityThreshold: number = 0.3, // Lowered for Persian text
    matchCount: number = 8 // Increased for better context
  ): Promise<SearchResult[]> {
    try {
      // Preprocess query for better embedding
      const processedQuery = this.preprocessQuery(query);
      
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.generateEmbedding(processedQuery);

      // Search for similar chunks using the database function
      const { data: results, error } = await supabase
        .rpc('search_chunks', {
          query_embedding: queryEmbedding,
          similarity_threshold: similarityThreshold,
          match_count: matchCount,
        });

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`);
      }

      // Post-process and rank results
      const rankedResults = this.rankSearchResults(results || [], query);
      
      return rankedResults;
    } catch (error) {
      console.error('Error in RAG search:', error);
      throw error;
    }
  }

  // Preprocess query for better embedding
  private preprocessQuery(query: string): string {
    const processed = query
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase(); // Normalize case for better matching
    
    // Ensure minimum length for embedding
    if (processed.length < 10) {
      return `سوال کاربر: ${processed} - لطفاً بر اساس اسناد موجود پاسخ دهید`;
    }
    
    return processed;
  }

  // Rank search results based on multiple criteria
  private rankSearchResults(results: SearchResult[], originalQuery: string): SearchResult[] {
    if (!results || results.length === 0) return [];

    return results
      .map(result => ({
        ...result,
        // Add keyword matching bonus
        keywordBonus: this.calculateKeywordBonus(result.content, originalQuery),
      }))
      .sort((a, b) => {
        // Primary sort by similarity + keyword bonus
        const scoreA = a.similarity + (a.keywordBonus || 0) * 0.1;
        const scoreB = b.similarity + (b.keywordBonus || 0) * 0.1;
        return scoreB - scoreA;
      })
      .map(({ keywordBonus, ...result }) => result); // Remove temporary field
  }

  // Calculate keyword matching bonus
  private calculateKeywordBonus(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matchCount = 0;
    for (const queryWord of queryWords) {
      if (contentWords.some(contentWord => 
        contentWord.includes(queryWord) || queryWord.includes(contentWord)
      )) {
        matchCount++;
      }
    }
    
    return queryWords.length > 0 ? matchCount / queryWords.length : 0;
  }

  async getRelevantContext(
    query: string,
    maxChunks: number = 6, // Increased for better context
    minSimilarity: number = 0.3 // Lowered for Persian text
  ): Promise<{
    chunks: SearchResult[];
    contextText: string;
    sources: string[];
    qualityScore: number;
  }> {
    try {
      const chunks = await this.searchRelevantChunks(query, minSimilarity, maxChunks);
      
      // Filter out low-quality results
      const qualityChunks = chunks.filter(chunk => 
        chunk.similarity >= minSimilarity && 
        chunk.content.trim().length > 50
      );
      
      // Combine chunks into context text with better formatting
      const contextText = qualityChunks
        .map((chunk, index) => {
          const source = chunk.document_title ? `[از: ${chunk.document_title}]` : '';
          return `${index + 1}. ${chunk.content.trim()} ${source}`;
        })
        .join('\n\n');
      
      // Get unique document titles as sources
      const sources = [...new Set(qualityChunks.map(chunk => chunk.document_title))]
        .filter(Boolean);
      
      // Calculate overall quality score
      const qualityScore = qualityChunks.length > 0 
        ? qualityChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / qualityChunks.length
        : 0;
      
      return {
        chunks: qualityChunks,
        contextText,
        sources,
        qualityScore,
      };
    } catch (error) {
      console.error('Error getting relevant context:', error);
      throw error;
    }
  }

  async getDocumentStats(): Promise<{
    totalDocuments: number;
    processedDocuments: number;
    totalChunks: number;
    averageChunksPerDocument: number;
  }> {
    try {
      // Get document counts
      const { data: docCounts, error: docError } = await supabase
        .from('documents')
        .select('processed');

      if (docError) {
        throw new Error(`Failed to get document stats: ${docError.message}`);
      }

      const totalDocuments = docCounts.length;
      const processedDocuments = docCounts.filter(doc => doc.processed).length;

      // Get chunk count
      const { count: totalChunks, error: chunkError } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true });

      if (chunkError) {
        throw new Error(`Failed to get chunk stats: ${chunkError.message}`);
      }

      return {
        totalDocuments,
        processedDocuments,
        totalChunks: totalChunks || 0,
        averageChunksPerDocument: processedDocuments > 0 
          ? Math.round((totalChunks || 0) / processedDocuments) 
          : 0,
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      throw error;
    }
  }
} 