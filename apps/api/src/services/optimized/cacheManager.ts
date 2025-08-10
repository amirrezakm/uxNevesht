import Redis from 'ioredis';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

export interface CacheConfig {
  defaultTTL: number;
  embeddingTTL: number;
  searchTTL: number;
  documentTTL: number;
  maxKeyLength: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  avgResponseTime: number;
}

export class CacheManager {
  private redis: Redis;
  private config: CacheConfig;
  private stats: CacheStats;

  // Cache key prefixes for organization
  private readonly PREFIXES = {
    EMBEDDING: 'emb:',
    SEARCH: 'search:',
    DOCUMENT: 'doc:',
    CHUNK: 'chunk:',
    RAG_CONTEXT: 'rag:',
    USER_SESSION: 'session:',
    METRICS: 'metrics:',
  };

  constructor(redis: Redis, config?: Partial<CacheConfig>) {
    this.redis = redis;
    this.config = {
      defaultTTL: 3600, // 1 hour
      embeddingTTL: 86400 * 7, // 7 days (embeddings rarely change)
      searchTTL: 1800, // 30 minutes (search results can be cached longer)
      documentTTL: 3600 * 6, // 6 hours
      maxKeyLength: 250,
      ...config,
    };

    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      avgResponseTime: 0,
    };

    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // Reset stats every hour
    setInterval(() => {
      this.resetStats();
    }, 3600000);
  }

  private generateCacheKey(prefix: string, identifier: string): string {
    const key = `${prefix}${identifier}`;
    
    // Hash long keys to prevent Redis key length issues
    if (key.length > this.config.maxKeyLength) {
      const hash = createHash('sha256').update(key).digest('hex').substring(0, 16);
      return `${prefix}${hash}`;
    }
    
    return key;
  }

  private async trackCacheHit(): Promise<void> {
    this.stats.hits++;
    this.stats.totalRequests++;
    this.updateHitRate();
  }

  private async trackCacheMiss(): Promise<void> {
    this.stats.misses++;
    this.stats.totalRequests++;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
  }

  // Embedding cache methods
  async getEmbedding(text: string): Promise<number[] | null> {
    const startTime = performance.now();
    const key = this.generateCacheKey(this.PREFIXES.EMBEDDING, text);
    
    try {
      const cached = await this.redis.get(key);
      const responseTime = performance.now() - startTime;
      this.updateAvgResponseTime(responseTime);

      if (cached) {
        await this.trackCacheHit();
        return JSON.parse(cached);
      }
      
      await this.trackCacheMiss();
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      await this.trackCacheMiss();
      return null;
    }
  }

  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    const key = this.generateCacheKey(this.PREFIXES.EMBEDDING, text);
    
    try {
      await this.redis.setex(
        key,
        this.config.embeddingTTL,
        JSON.stringify(embedding)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Batch embedding operations for better performance
  async getEmbeddings(texts: string[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>();
    
    if (texts.length === 0) return results;

    try {
      // Use pipeline for batch operations
      const pipeline = this.redis.pipeline();
      const keys = texts.map(text => 
        this.generateCacheKey(this.PREFIXES.EMBEDDING, text)
      );

      keys.forEach(key => pipeline.get(key));
      const responses = await pipeline.exec();

      if (responses) {
        responses.forEach((response, index) => {
          if (response && response[1]) {
            try {
              const embedding = JSON.parse(response[1] as string);
              results.set(texts[index], embedding);
            } catch (parseError) {
              console.error('Failed to parse cached embedding:', parseError);
            }
          }
        });
      }

      // Update stats
      const hits = results.size;
      const misses = texts.length - hits;
      this.stats.hits += hits;
      this.stats.misses += misses;
      this.stats.totalRequests += texts.length;
      this.updateHitRate();

    } catch (error) {
      console.error('Batch cache get error:', error);
      this.stats.misses += texts.length;
      this.stats.totalRequests += texts.length;
      this.updateHitRate();
    }

    return results;
  }

  async setEmbeddings(textEmbeddingPairs: Array<{ text: string; embedding: number[] }>): Promise<void> {
    if (textEmbeddingPairs.length === 0) return;

    try {
      const pipeline = this.redis.pipeline();
      
      textEmbeddingPairs.forEach(({ text, embedding }) => {
        const key = this.generateCacheKey(this.PREFIXES.EMBEDDING, text);
        pipeline.setex(key, this.config.embeddingTTL, JSON.stringify(embedding));
      });

      await pipeline.exec();
    } catch (error) {
      console.error('Batch cache set error:', error);
    }
  }

  // Search results cache
  async getSearchResults(query: string, filters?: Record<string, any>): Promise<any | null> {
    const cacheKey = JSON.stringify({ query, filters });
    const key = this.generateCacheKey(this.PREFIXES.SEARCH, cacheKey);
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        await this.trackCacheHit();
        return JSON.parse(cached);
      }
      
      await this.trackCacheMiss();
      return null;
    } catch (error) {
      console.error('Search cache get error:', error);
      await this.trackCacheMiss();
      return null;
    }
  }

  async setSearchResults(query: string, results: any, filters?: Record<string, any>): Promise<void> {
    const cacheKey = JSON.stringify({ query, filters });
    const key = this.generateCacheKey(this.PREFIXES.SEARCH, cacheKey);
    
    try {
      await this.redis.setex(
        key,
        this.config.searchTTL,
        JSON.stringify(results)
      );
    } catch (error) {
      console.error('Search cache set error:', error);
    }
  }

  // Document cache
  async getDocument(documentId: string): Promise<any | null> {
    const key = this.generateCacheKey(this.PREFIXES.DOCUMENT, documentId);
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        await this.trackCacheHit();
        return JSON.parse(cached);
      }
      
      await this.trackCacheMiss();
      return null;
    } catch (error) {
      console.error('Document cache get error:', error);
      await this.trackCacheMiss();
      return null;
    }
  }

  async setDocument(documentId: string, document: any): Promise<void> {
    const key = this.generateCacheKey(this.PREFIXES.DOCUMENT, documentId);
    
    try {
      await this.redis.setex(
        key,
        this.config.documentTTL,
        JSON.stringify(document)
      );
    } catch (error) {
      console.error('Document cache set error:', error);
    }
  }

  // RAG context cache (for similar queries)
  async getRAGContext(queryHash: string): Promise<any | null> {
    const key = this.generateCacheKey(this.PREFIXES.RAG_CONTEXT, queryHash);
    
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        await this.trackCacheHit();
        return JSON.parse(cached);
      }
      
      await this.trackCacheMiss();
      return null;
    } catch (error) {
      console.error('RAG context cache get error:', error);
      await this.trackCacheMiss();
      return null;
    }
  }

  async setRAGContext(queryHash: string, context: any): Promise<void> {
    const key = this.generateCacheKey(this.PREFIXES.RAG_CONTEXT, queryHash);
    
    try {
      await this.redis.setex(
        key,
        this.config.searchTTL,
        JSON.stringify(context)
      );
    } catch (error) {
      console.error('RAG context cache set error:', error);
    }
  }

  // Utility methods
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
      
      return keys.length;
    } catch (error) {
      console.error('Pattern invalidation error:', error);
      return 0;
    }
  }

  async invalidateDocument(documentId: string): Promise<void> {
    try {
      // Invalidate document and related caches
      const patterns = [
        `${this.PREFIXES.DOCUMENT}${documentId}*`,
        `${this.PREFIXES.CHUNK}${documentId}*`,
        `${this.PREFIXES.SEARCH}*`, // Search results might include this doc
        `${this.PREFIXES.RAG_CONTEXT}*`, // RAG context might include this doc
      ];

      for (const pattern of patterns) {
        await this.invalidatePattern(pattern);
      }
    } catch (error) {
      console.error('Document invalidation error:', error);
    }
  }

  async warmupCache(commonQueries: string[]): Promise<void> {
    console.log(`🔥 Warming up cache with ${commonQueries.length} common queries...`);
    
    // This would be called with actual RAG service
    // to pre-populate frequently used queries
    for (const query of commonQueries) {
      try {
        // Check if already cached
        const cached = await this.getSearchResults(query);
        if (!cached) {
          console.log(`Cache miss for: ${query.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('Cache warmup error:', error);
      }
    }
  }

  // Statistics and monitoring
  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateAvgResponseTime(responseTime: number): void {
    // Simple moving average for response time
    this.stats.avgResponseTime = this.stats.totalRequests > 1
      ? (this.stats.avgResponseTime + responseTime) / 2
      : responseTime;
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      avgResponseTime: 0,
    };
  }

  async getRedisInfo(): Promise<any> {
    try {
      const info = await this.redis.info();
      const memory = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        info,
        memory,
        keyspace,
        connected: this.redis.status === 'ready',
      };
    } catch (error) {
      console.error('Redis info error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { connected: false, error: message };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.redis.disconnect();
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
}

export default CacheManager;