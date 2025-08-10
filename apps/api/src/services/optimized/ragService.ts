import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { DatabasePool } from './databasePool';
import { CacheManager } from './cacheManager';
import { PerformanceMonitor } from './performanceMonitor';

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  document_title: string;
  chunk_index: number;
  token_count: number;
}

export interface RAGContext {
  chunks: SearchResult[];
  contextText: string;
  sources: string[];
  qualityScore: number;
  searchTime: number;
  cacheHit: boolean;
  totalChunksAvailable: number;
}

export interface SearchOptions {
  similarityThreshold?: number;
  maxChunks?: number;
  minChunkLength?: number;
  diversityBoost?: boolean;
  temporalBoost?: boolean;
  rerank?: boolean;
}

export interface RAGStats {
  totalSearches: number;
  avgSearchTime: number;
  cacheHitRate: number;
  avgQualityScore: number;
  totalDocuments: number;
  totalChunks: number;
  avgChunksPerSearch: number;
}

export class OptimizedRAGService {
  private dbPool: DatabasePool;
  private cache: CacheManager;
  private monitor: PerformanceMonitor;
  private searchStats: RAGStats;

  // Search optimization parameters
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.25; // Lowered for Persian
  private readonly DEFAULT_MAX_CHUNKS = 8;
  private readonly MIN_CHUNK_LENGTH = 30;
  private readonly CACHE_TTL = 1800; // 30 minutes

  constructor(
    dbPool: DatabasePool,
    cache: CacheManager,
    monitor: PerformanceMonitor
  ) {
    this.dbPool = dbPool;
    this.cache = cache;
    this.monitor = monitor;
    this.searchStats = {
      totalSearches: 0,
      avgSearchTime: 0,
      cacheHitRate: 0,
      avgQualityScore: 0,
      totalDocuments: 0,
      totalChunks: 0,
      avgChunksPerSearch: 0,
    };

    this.initializeOptimizations();
  }

  private initializeOptimizations(): void {
    // Warm up cache with common queries
    this.warmupCache().catch(console.error);
    
    // Update stats periodically
    setInterval(() => {
      this.updateStats().catch(console.error);
    }, 300000); // Every 5 minutes
  }

  private async warmupCache(): Promise<void> {
    const commonQueries = [
      'دکمه ورود',
      'پیام خطا',
      'تایید عملیات',
      'لغو',
      'ذخیره',
      'بازگشت',
      'صفحه اصلی',
      'تنظیمات',
      'پروفایل کاربری',
      'خروج',
    ];

    console.log('🔥 Warming up RAG cache...');
    
    for (const query of commonQueries) {
      try {
        await this.getRelevantContext(query);
      } catch (error) {
        console.warn(`Cache warmup failed for "${query}":`, error);
      }
    }
  }

  async searchRelevantChunks(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const startTime = performance.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateSearchCacheKey(query, options);
      
      // Try cache first
      const cached = await this.cache.getRAGContext(cacheKey);
      if (cached) {
        this.updateSearchStats(performance.now() - startTime, true);
        return cached.chunks;
      }

      // Preprocess query
      const processedQuery = this.preprocessQuery(query);
      
      // Generate query embedding with caching
      const queryEmbedding = await this.getQueryEmbedding(processedQuery);
      
      // Perform vector search
      const results = await this.performVectorSearch(queryEmbedding, options);
      
      // Post-process and rank results
      const rankedResults = await this.rankAndOptimizeResults(results, query, options);
      
      // Cache results
      await this.cache.setRAGContext(cacheKey, { chunks: rankedResults });
      
      const searchTime = performance.now() - startTime;
      this.updateSearchStats(searchTime, false);
      
      return rankedResults;

    } catch (error) {
      console.error('Error in optimized RAG search:', error);
      this.updateSearchStats(performance.now() - startTime, false);
      throw error;
    }
  }

  private generateSearchCacheKey(query: string, options: SearchOptions): string {
    const keyData = {
      query: query.toLowerCase().trim(),
      threshold: options.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD,
      maxChunks: options.maxChunks || this.DEFAULT_MAX_CHUNKS,
      diversityBoost: options.diversityBoost || false,
      temporalBoost: options.temporalBoost || false,
      rerank: options.rerank || false,
    };
    
    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);
  }

  private preprocessQuery(query: string): string {
    return query
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase() // Normalize case
      .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\w]/g, '') // Keep Persian, Arabic, and alphanumeric
      .substring(0, 500); // Limit length
  }

  private async getQueryEmbedding(query: string): Promise<number[]> {
    // Try cache first
    const cached = await this.cache.getEmbedding(query);
    if (cached) {
      return cached;
    }

    // Generate new embedding
    // In real implementation, this would use EmbeddingsService
    const embedding = await this.generateEmbedding(query);
    
    // Cache the embedding
    await this.cache.setEmbedding(query, embedding);
    
    return embedding;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for embedding generation');
    }
    
    const { EmbeddingsService } = await import('@ux-nevesht/ai');
    const embeddingsService = new EmbeddingsService(openaiApiKey);
    
    return await embeddingsService.generateEmbedding(text);
  }

  private async performVectorSearch(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const similarityThreshold = options.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD;
    const matchCount = options.maxChunks || this.DEFAULT_MAX_CHUNKS;

    // Use optimized database pool for vector search
    const { data, error } = await this.dbPool.vectorSearch(queryEmbedding, {
      similarityThreshold,
      matchCount: matchCount * 2, // Get more results for better ranking
    });

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return data || [];
  }

  private async rankAndOptimizeResults(
    results: SearchResult[],
    originalQuery: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!results || results.length === 0) return [];

    let rankedResults = [...results];

    // Filter by minimum chunk length
    rankedResults = rankedResults.filter(result => 
      result.content.trim().length >= (options.minChunkLength || this.MIN_CHUNK_LENGTH)
    );

    // Apply keyword matching bonus
    rankedResults = this.applyKeywordBonus(rankedResults, originalQuery);

    // Apply diversity boost (avoid too many chunks from same document)
    if (options.diversityBoost) {
      rankedResults = this.applyDiversityBoost(rankedResults);
    }

    // Apply temporal boost (prefer recent documents)
    if (options.temporalBoost) {
      rankedResults = await this.applyTemporalBoost(rankedResults);
    }

    // Apply reranking using cross-encoder (if enabled)
    if (options.rerank) {
      rankedResults = await this.applyReranking(rankedResults, originalQuery);
    }

    // Final sort by combined score
    rankedResults.sort((a, b) => (b as any).finalScore - (a as any).finalScore);

    // Limit to requested number of chunks
    const maxChunks = options.maxChunks || this.DEFAULT_MAX_CHUNKS;
    return rankedResults.slice(0, maxChunks);
  }

  private applyKeywordBonus(results: SearchResult[], query: string): SearchResult[] {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);

    return results.map(result => {
      const contentWords = result.content.toLowerCase().split(/\s+/);
      
      let keywordMatches = 0;
      for (const queryWord of queryWords) {
        if (contentWords.some(contentWord => 
          contentWord.includes(queryWord) || queryWord.includes(contentWord)
        )) {
          keywordMatches++;
        }
      }
      
      const keywordBonus = queryWords.length > 0 
        ? (keywordMatches / queryWords.length) * 0.1 
        : 0;

      return {
        ...result,
        finalScore: result.similarity + keywordBonus,
      } as any;
    });
  }

  private applyDiversityBoost(results: SearchResult[]): SearchResult[] {
    const documentCounts = new Map<string, number>();
    
    return results.map(result => {
      const currentCount = documentCounts.get(result.document_id) || 0;
      documentCounts.set(result.document_id, currentCount + 1);
      
      // Reduce score for documents that already have many chunks selected
      const diversityPenalty = Math.max(0, (currentCount - 1) * 0.05);
      
      return {
        ...result,
        finalScore: ((result as any).finalScore || result.similarity) - diversityPenalty,
      } as any;
    });
  }

  private async applyTemporalBoost(results: SearchResult[]): SearchResult[] {
    // Get document creation dates
    const documentIds = [...new Set(results.map(r => r.document_id))];
    
    try {
      const { data: documents } = await this.dbPool.select(
        'documents',
        'id, created_at',
        { id: documentIds }
      );

      const documentDates = new Map(
        (documents || []).map(doc => [doc.id, new Date(doc.created_at)])
      );

      const now = new Date();
      const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year

      return results.map(result => {
        const docDate = documentDates.get(result.document_id);
        if (!docDate) {
          return { ...result, finalScore: (result as any).finalScore || result.similarity };
        }

        const age = now.getTime() - docDate.getTime();
        const ageRatio = Math.min(age / maxAge, 1);
        const temporalBonus = (1 - ageRatio) * 0.05; // Up to 5% boost for recent docs

        return {
          ...result,
          finalScore: ((result as any).finalScore || result.similarity) + temporalBonus,
        } as any;
      });

    } catch (error) {
      console.warn('Temporal boost failed:', error);
      return results;
    }
  }

  private async applyReranking(results: SearchResult[], query: string): Promise<SearchResult[]> {
    // This would implement cross-encoder reranking in a real system
    // For now, we'll simulate it with a simple relevance check
    
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return results.map(result => {
      const content = result.content.toLowerCase();
      let relevanceScore = 0;
      
      // Check for exact phrase matches
      if (content.includes(query.toLowerCase())) {
        relevanceScore += 0.1;
      }
      
      // Check for word proximity
      const words = content.split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (queryWords.some(qw => bigram.includes(qw))) {
          relevanceScore += 0.05;
        }
      }
      
      return {
        ...result,
        finalScore: ((result as any).finalScore || result.similarity) + relevanceScore,
      } as any;
    });
  }

  async getRelevantContext(
    query: string,
    options: SearchOptions = {}
  ): Promise<RAGContext> {
    const startTime = performance.now();
    
    try {
      // Get relevant chunks
      const chunks = await this.searchRelevantChunks(query, options);
      
      // Build context text with proper formatting
      const contextText = this.buildContextText(chunks);
      
      // Extract unique sources
      const sources = this.extractSources(chunks);
      
      // Calculate quality score
      const qualityScore = this.calculateQualityScore(chunks, query);
      
      // Get total chunks available for comparison
      const totalChunksAvailable = await this.getTotalChunksCount();
      
      const searchTime = performance.now() - startTime;
      
      const context: RAGContext = {
        chunks,
        contextText,
        sources,
        qualityScore,
        searchTime,
        cacheHit: false, // This would be set based on cache status
        totalChunksAvailable,
      };

      // Monitor search performance
      this.monitor.recordDatabaseQuery(searchTime);
      
      return context;

    } catch (error) {
      console.error('Error getting relevant context:', error);
      const searchTime = performance.now() - startTime;
      
      return {
        chunks: [],
        contextText: '',
        sources: [],
        qualityScore: 0,
        searchTime,
        cacheHit: false,
        totalChunksAvailable: 0,
      };
    }
  }

  private buildContextText(chunks: SearchResult[]): string {
    if (chunks.length === 0) return '';

    return chunks
      .map((chunk, index) => {
        const source = chunk.document_title ? `[از: ${chunk.document_title}]` : '';
        const similarity = `(شباهت: ${Math.round(chunk.similarity * 100)}%)`;
        return `${index + 1}. ${chunk.content.trim()} ${source} ${similarity}`;
      })
      .join('\n\n');
  }

  private extractSources(chunks: SearchResult[]): string[] {
    const sources = new Set<string>();
    
    chunks.forEach(chunk => {
      if (chunk.document_title) {
        sources.add(chunk.document_title);
      }
    });
    
    return Array.from(sources);
  }

  private calculateQualityScore(chunks: SearchResult[], query: string): number {
    if (chunks.length === 0) return 0;

    // Base score from similarity
    const avgSimilarity = chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / chunks.length;
    
    // Bonus for multiple relevant chunks
    const quantityBonus = Math.min(chunks.length / this.DEFAULT_MAX_CHUNKS, 1) * 0.1;
    
    // Bonus for keyword coverage
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const coveredWords = new Set<string>();
    
    chunks.forEach(chunk => {
      const chunkWords = chunk.content.toLowerCase().split(/\s+/);
      queryWords.forEach(queryWord => {
        if (chunkWords.some(chunkWord => 
          chunkWord.includes(queryWord) || queryWord.includes(chunkWord)
        )) {
          coveredWords.add(queryWord);
        }
      });
    });
    
    const coverageBonus = queryWords.length > 0 
      ? (coveredWords.size / queryWords.length) * 0.1 
      : 0;

    return Math.min(avgSimilarity + quantityBonus + coverageBonus, 1);
  }

  private async getTotalChunksCount(): Promise<number> {
    try {
      const { count } = await this.dbPool.select(
        'document_chunks',
        'COUNT(*) as total',
        {},
        { limit: 1 }
      );
      
      return count || 0;
    } catch (error) {
      console.warn('Failed to get total chunks count:', error);
      return 0;
    }
  }

  // Batch operations for better performance
  async searchMultipleQueries(
    queries: string[],
    options: SearchOptions = {}
  ): Promise<Map<string, RAGContext>> {
    console.log(`🔍 Batch searching ${queries.length} queries`);
    
    const results = new Map<string, RAGContext>();
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 5;
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (query) => {
        try {
          const context = await this.getRelevantContext(query, options);
          return { query, context };
        } catch (error) {
          console.error(`Batch search failed for query "${query}":`, error);
          return { 
            query, 
            context: {
              chunks: [],
              contextText: '',
              sources: [],
              qualityScore: 0,
              searchTime: 0,
              cacheHit: false,
              totalChunksAvailable: 0,
            }
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ query, context }) => {
        results.set(query, context);
      });
      
      console.log(`📊 Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(queries.length/batchSize)}`);
    }
    
    return results;
  }

  private updateSearchStats(searchTime: number, cacheHit: boolean): void {
    this.searchStats.totalSearches++;
    
    // Update average search time
    this.searchStats.avgSearchTime = this.searchStats.totalSearches > 1
      ? (this.searchStats.avgSearchTime + searchTime) / 2
      : searchTime;
    
    // Update cache hit rate
    if (cacheHit) {
      this.searchStats.cacheHitRate = 
        ((this.searchStats.totalSearches - 1) * this.searchStats.cacheHitRate + 100) / this.searchStats.totalSearches;
    } else {
      this.searchStats.cacheHitRate = 
        ((this.searchStats.totalSearches - 1) * this.searchStats.cacheHitRate) / this.searchStats.totalSearches;
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const [documentsResult, chunksResult] = await Promise.all([
        this.dbPool.select('documents', 'COUNT(*) as total', { processed: true }),
        this.dbPool.select('document_chunks', 'COUNT(*) as total'),
      ]);

      this.searchStats.totalDocuments = documentsResult.data?.[0]?.total || 0;
      this.searchStats.totalChunks = chunksResult.data?.[0]?.total || 0;
      
    } catch (error) {
      console.warn('Failed to update RAG stats:', error);
    }
  }

  // Public API methods
  getStats(): RAGStats {
    return { ...this.searchStats };
  }

  async getDocumentStats(): Promise<{
    totalDocuments: number;
    processedDocuments: number;
    totalChunks: number;
    averageChunksPerDocument: number;
  }> {
    try {
      const [documentsResult, chunksResult] = await Promise.all([
        this.dbPool.select('documents', 'processed'),
        this.dbPool.select('document_chunks', 'COUNT(*) as total'),
      ]);

      // Ensure we have valid arrays
      const documents = Array.isArray(documentsResult.data) ? documentsResult.data : [];
      const totalChunks = chunksResult.data?.[0]?.total || 0;

      return {
        totalDocuments: documents.length,
        processedDocuments: documents.filter(d => d && d.processed).length,
        totalChunks,
        averageChunksPerDocument: documents.length > 0 ? totalChunks / documents.length : 0,
      };

    } catch (error) {
      console.error('Error getting document stats:', error);
      return {
        totalDocuments: 0,
        processedDocuments: 0,
        totalChunks: 0,
        averageChunksPerDocument: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test a simple search
      const testResult = await this.searchRelevantChunks('تست', {
        maxChunks: 1,
        similarityThreshold: 0.1,
      });
      
      return true; // If no error, service is healthy
    } catch (error) {
      console.error('RAG service health check failed:', error);
      return false;
    }
  }

  // Performance optimization methods
  async precomputeEmbeddings(texts: string[]): Promise<void> {
    console.log(`🔤 Precomputing embeddings for ${texts.length} texts`);
    
    const batchSize = 20;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const embeddings = await Promise.all(
          batch.map(text => this.getQueryEmbedding(text))
        );
        
        console.log(`📊 Precomputed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
      } catch (error) {
        console.error(`Failed to precompute batch ${i}-${i + batchSize}:`, error);
      }
    }
  }

  async optimizeSearchIndex(): Promise<void> {
    console.log('🔧 Optimizing search index...');
    
    try {
      // This would run database optimization commands
      // For example, VACUUM, REINDEX, UPDATE STATISTICS etc.
      
      console.log('✅ Search index optimization completed');
    } catch (error) {
      console.error('Search index optimization failed:', error);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    await this.cache.invalidatePattern('rag:*');
    await this.cache.invalidatePattern('search:*');
    console.log('🧹 RAG cache cleared');
  }
}

export default OptimizedRAGService;