import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { CacheManager } from '../../services/optimized/cacheManager';

export interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  vary?: string[];
  tags?: string[];
}

export function cacheMiddleware(cacheManager: CacheManager, options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching should be applied
    if (options.condition && !options.condition(req, res)) {
      return next();
    }

    // Skip caching for certain paths
    const skipPaths = ['/health', '/metrics', '/admin'];
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(req)
        : generateDefaultCacheKey(req, options.vary);

      // Try to get cached response
      const cached = await cacheManager.getSearchResults(`route_${cacheKey}`);
      
      if (cached) {
        // Cache hit - return cached response
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        // Set vary headers if specified
        if (options.vary) {
          res.set('Vary', options.vary.join(', '));
        }

        return res.json(cached);
      }

      // Cache miss - continue with request processing
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Override response methods to cache the result
      const originalJson = res.json;
      const originalSend = res.send;

      res.json = function(data: any) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheResponse(cacheManager, cacheKey, data, options.ttl);
        }
        return originalJson.call(this, data);
      };

      res.send = function(data: any) {
        // Try to parse as JSON for caching
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
            cacheResponse(cacheManager, cacheKey, jsonData, options.ttl);
          } catch {
            // Not JSON, skip caching
          }
        }
        return originalSend.call(this, data);
      };

      next();

    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

// Smart caching middleware with automatic cache management
export function smartCacheMiddleware(cacheManager: CacheManager) {
  return cacheMiddleware(cacheManager, {
    keyGenerator: (req: Request) => {
      // Generate smarter cache keys based on route patterns
      const baseKey = `${req.method}:${req.path}`;
      
      // Include relevant query parameters
      const relevantParams = new URLSearchParams();
      
      // Common parameters that affect responses
      const importantParams = ['limit', 'offset', 'page', 'sort', 'filter', 'search'];
      
      for (const param of importantParams) {
        if (req.query[param]) {
          relevantParams.set(param, String(req.query[param]));
        }
      }

      const paramString = relevantParams.toString();
      const fullKey = paramString ? `${baseKey}?${paramString}` : baseKey;
      
      return createHash('sha256').update(fullKey).digest('hex').substring(0, 16);
    },
    
    condition: (req: Request, res: Response) => {
      // Cache GET requests for specific patterns
      if (req.method !== 'GET') return false;
      
      // Cache document lists, stats, templates
      const cacheablePatterns = [
        /^\/api\/documents$/,
        /^\/api\/documents\/stats/,
        /^\/api\/chat\/templates$/,
        /^\/api\/chat\/stats$/,
      ];
      
      return cacheablePatterns.some(pattern => pattern.test(req.path));
    },
    
    vary: ['Accept', 'Accept-Language', 'User-Agent'],
    
    ttl: 300, // 5 minutes default
  });
}

// Conditional caching based on response content
export function conditionalCacheMiddleware(cacheManager: CacheManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = generateDefaultCacheKey(req);
    
    // Check cache first
    const cached = await cacheManager.getSearchResults(`conditional_${cacheKey}`);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Intercept response to apply conditional caching
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Determine cache TTL based on response content
      let ttl = 300; // Default 5 minutes
      
      if (data && typeof data === 'object') {
        // Cache static content longer
        if (data.templates || data.stats) {
          ttl = 1800; // 30 minutes
        }
        
        // Cache document lists based on size
        if (data.documents) {
          ttl = data.documents.length > 50 ? 600 : 300; // 10 minutes for large lists
        }
        
        // Cache search results based on quality
        if (data.context && data.context.quality_score) {
          ttl = data.context.quality_score > 0.8 ? 900 : 300; // 15 minutes for high quality
        }
      }

      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheResponse(cacheManager, `conditional_${cacheKey}`, data, ttl);
      }

      res.set('X-Cache', 'MISS');
      res.set('X-Cache-TTL', ttl.toString());
      
      return originalJson.call(this, data);
    };

    next();
  };
}

// Cache invalidation middleware
export function cacheInvalidationMiddleware(cacheManager: CacheManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only handle non-GET requests that might invalidate cache
    if (req.method === 'GET') {
      return next();
    }

    const originalJson = res.json;
    const originalSend = res.send;

    const handleInvalidation = async () => {
      // Only invalidate on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await invalidateRelatedCaches(cacheManager, req);
      }
    };

    res.json = function(data: any) {
      handleInvalidation().catch(console.error);
      return originalJson.call(this, data);
    };

    res.send = function(data: any) {
      handleInvalidation().catch(console.error);
      return originalSend.call(this, data);
    };

    next();
  };
}

// Utility functions
function generateDefaultCacheKey(req: Request, varyHeaders?: string[]): string {
  let keyData = `${req.method}:${req.originalUrl}`;
  
  // Include vary headers in key
  if (varyHeaders) {
    const varyValues = varyHeaders.map(header => 
      `${header}:${req.get(header) || ''}`
    ).join('|');
    keyData += `|${varyValues}`;
  }
  
  return createHash('sha256').update(keyData).digest('hex').substring(0, 16);
}

async function cacheResponse(
  cacheManager: CacheManager, 
  key: string, 
  data: any, 
  ttl?: number
): Promise<void> {
  try {
    await cacheManager.setSearchResults(key, data);
    console.log(`📦 Cached response: ${key} (TTL: ${ttl || 'default'})`);
  } catch (error) {
    console.error('Failed to cache response:', error);
  }
}

async function invalidateRelatedCaches(
  cacheManager: CacheManager, 
  req: Request
): Promise<void> {
  try {
    const patterns: string[] = [];

    // Document operations
    if (req.path.includes('/documents')) {
      patterns.push(
        'route_*documents*',
        'documents_list_*',
        'document_stats',
        'ux_copy_*' // UX copy might depend on documents
      );
    }

    // Chat/RAG operations
    if (req.path.includes('/chat')) {
      patterns.push(
        'route_*chat*',
        'search:*',
        'rag:*'
      );
    }

    // Invalidate patterns
    for (const pattern of patterns) {
      const invalidated = await cacheManager.invalidatePattern(pattern);
      if (invalidated > 0) {
        console.log(`🧹 Invalidated ${invalidated} cache entries for pattern: ${pattern}`);
      }
    }

  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

// Export configured middleware functions
export function createCacheMiddleware(cacheManager: CacheManager) {
  return {
    smart: smartCacheMiddleware(cacheManager),
    conditional: conditionalCacheMiddleware(cacheManager),
    invalidation: cacheInvalidationMiddleware(cacheManager),
    custom: (options: CacheOptions) => cacheMiddleware(cacheManager, options),
  };
}

export default cacheMiddleware;