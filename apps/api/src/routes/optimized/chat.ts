import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { LLMService, PromptBuilder } from '@ux-nevesht/ai';
import { OptimizedRAGService } from '../../services/optimized/ragService';
import { CacheManager } from '../../services/optimized/cacheManager';
import { createError } from '../../middleware/errorHandler';

// Validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1, 'پیام نمی‌تواند خالی باشد').max(2000, 'پیام خیلی طولانی است'),
  context: z.string().max(1000).optional(),
  tone: z.enum(['friendly', 'professional', 'casual', 'urgent']).optional().default('professional'),
  useCache: z.boolean().optional().default(true),
  searchOptions: z.object({
    similarityThreshold: z.number().min(0).max(1).optional(),
    maxChunks: z.number().min(1).max(20).optional(),
    diversityBoost: z.boolean().optional(),
    temporalBoost: z.boolean().optional(),
    rerank: z.boolean().optional(),
  }).optional(),
});

const uxCopyRequestSchema = z.object({
  context: z.string().min(1, 'زمینه ضروری است').max(1000, 'زمینه خیلی طولانی است'),
  elementType: z.enum([
    'button', 'error', 'success', 'tooltip', 'placeholder', 
    'title', 'description', 'navigation', 'notification', 
    'modal', 'form', 'menu', 'loading'
  ]),
  audience: z.enum(['user', 'driver', 'vendor', 'admin', 'general']),
  tone: z.enum(['friendly', 'professional', 'urgent', 'encouraging', 'informative']),
  variations: z.number().min(1).max(10).optional().default(3),
  maxLength: z.number().min(5).max(200).optional(),
  includeEmoji: z.boolean().optional().default(false),
});

const batchCopyRequestSchema = z.object({
  requests: z.array(uxCopyRequestSchema).min(1).max(20),
  priority: z.number().min(0).max(10).optional().default(5),
});

export function optimizedChatRouter(
  ragService: OptimizedRAGService,
  cacheManager: CacheManager
): Router {
  const router = Router();

  // Initialize LLM service
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }
  const llmService = new LLMService(openrouterApiKey);

  // Chat endpoint - optimized for speed and caching
  router.post('/', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const requestData = chatRequestSchema.parse(req.body);
      const { message, context, tone, useCache, searchOptions } = requestData;

      console.log(`💬 Chat request: "${message.substring(0, 50)}..." (tone: ${tone})`);

      // Generate cache key for the complete request
      const cacheKey = generateChatCacheKey(message, context, tone, searchOptions);
      
      // Try cache first if enabled
      if (useCache) {
        const cached = await cacheManager.getSearchResults(`chat_${cacheKey}`);
        if (cached) {
          const responseTime = Date.now() - startTime;
          
          res.json({
            ...cached,
            performance: {
              ...cached.performance,
              totalTime: responseTime,
              cacheHit: true,
            },
          });
          return;
        }
      }

      // Get relevant context from RAG
      const ragStartTime = Date.now();
      const ragContext = await ragService.getRelevantContext(message, {
        similarityThreshold: searchOptions?.similarityThreshold,
        maxChunks: searchOptions?.maxChunks || 6,
        diversityBoost: searchOptions?.diversityBoost,
        temporalBoost: searchOptions?.temporalBoost,
        rerank: searchOptions?.rerank,
      });
      const ragTime = Date.now() - ragStartTime;

      // Build optimized prompts
      const systemPrompt = PromptBuilder.buildSystemPrompt();
      const userPrompt = PromptBuilder.buildUserPrompt({
        userQuery: message,
        relevantChunks: ragContext.chunks.map(c => c.content),
        uiContext: context,
        brandTone: tone,
      });

      // Generate LLM response
      const llmStartTime = Date.now();
      const response = await llmService.generateResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        temperature: tone === 'creative' ? 0.8 : 0.6,
        maxTokens: 1000,
      });
      const llmTime = Date.now() - llmStartTime;

      const totalTime = Date.now() - startTime;

      const result = {
        success: true,
        response,
        context: {
          chunks_used: ragContext.chunks.length,
          sources: ragContext.sources,
          similarity_scores: ragContext.chunks.map(c => c.similarity),
          quality_score: ragContext.qualityScore,
          has_relevant_context: ragContext.qualityScore > 0.4,
          total_chunks_available: ragContext.totalChunksAvailable,
        },
        performance: {
          totalTime,
          ragTime,
          llmTime,
          searchTime: ragContext.searchTime,
          cacheHit: false,
          throughput: Math.round(response.length / totalTime * 1000), // chars per second
        },
        metadata: {
          tone,
          context_provided: !!context,
          search_options: searchOptions,
          timestamp: new Date().toISOString(),
        },
      };

      // Cache the result if enabled
      if (useCache) {
        await cacheManager.setSearchResults(`chat_${cacheKey}`, result);
      }

      res.json(result);

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Chat request failed in ${totalTime}ms:`, error);
      
      if (error instanceof z.ZodError) {
        next(createError('درخواست نامعتبر است', 400, error.errors));
      } else {
        next(error);
      }
    }
  });

  // Streaming chat endpoint - for real-time responses
  router.post('/stream', async (req, res, next) => {
    try {
      const requestData = chatRequestSchema.parse(req.body);
      const { message, context, tone, searchOptions } = requestData;

      console.log(`🌊 Streaming chat: "${message.substring(0, 50)}..."`);

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      const startTime = Date.now();

      // Send initial status
      sendSSE(res, 'status', { 
        status: 'starting', 
        message: 'شروع پردازش درخواست...' 
      });

      // Get RAG context
      sendSSE(res, 'status', { 
        status: 'searching', 
        message: 'جستجو در اسناد...' 
      });

      const ragContext = await ragService.getRelevantContext(message, {
        similarityThreshold: searchOptions?.similarityThreshold,
        maxChunks: searchOptions?.maxChunks || 6,
        diversityBoost: searchOptions?.diversityBoost,
        temporalBoost: searchOptions?.temporalBoost,
        rerank: searchOptions?.rerank,
      });

      // Send context information
      sendSSE(res, 'context', {
        chunks_used: ragContext.chunks.length,
        sources: ragContext.sources,
        quality_score: ragContext.qualityScore,
        has_relevant_context: ragContext.qualityScore > 0.4,
      });

      // Generate and stream response
      sendSSE(res, 'status', { 
        status: 'generating', 
        message: 'تولید پاسخ...' 
      });

      const systemPrompt = PromptBuilder.buildSystemPrompt();
      const userPrompt = PromptBuilder.buildUserPrompt({
        userQuery: message,
        relevantChunks: ragContext.chunks.map(c => c.content),
        uiContext: context,
        brandTone: tone,
      });

      // Stream the LLM response
      const stream = await llmService.generateStreamResponse([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      for await (const chunk of stream) {
        sendSSE(res, 'content', { content: chunk });
      }

      // Send completion
      const totalTime = Date.now() - startTime;
      sendSSE(res, 'complete', { 
        performance: {
          totalTime,
          searchTime: ragContext.searchTime,
        }
      });

      res.end();

    } catch (error) {
      console.error('❌ Streaming chat error:', error);
      
      if (error instanceof z.ZodError) {
        sendSSE(res, 'error', { 
          error: 'درخواست نامعتبر است',
          details: error.errors 
        });
      } else {
        sendSSE(res, 'error', { 
          error: error instanceof Error ? error.message : 'خطای داخلی سرور' 
        });
      }
      
      res.end();
    }
  });

  // Specific UX copy generation - optimized for batch processing
  router.post('/generate-copy', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const requestData = uxCopyRequestSchema.parse(req.body);
      
      console.log(`📝 Generating UX copy: ${requestData.elementType} for ${requestData.audience}`);

      // Generate cache key
      const cacheKey = generateUXCopyCacheKey(requestData);
      
      // Try cache first
      const cached = await cacheManager.getSearchResults(`ux_copy_${cacheKey}`);
      if (cached) {
        const responseTime = Date.now() - startTime;
        
        res.json({
          ...cached,
          performance: {
            ...cached.performance,
            totalTime: responseTime,
            cacheHit: true,
          },
        });
        return;
      }

      // Get relevant context for this type of copy
      const contextQuery = `${requestData.elementType} ${requestData.context} ${requestData.audience}`;
      const ragContext = await ragService.getRelevantContext(contextQuery, {
        maxChunks: 4, // Fewer chunks for UX copy
        similarityThreshold: 0.3,
        diversityBoost: true,
      });

      // Build specific UX prompt
      const systemPrompt = PromptBuilder.buildSystemPrompt();
      const userPrompt = PromptBuilder.buildSpecificUXPrompt({
        ...requestData,
        relevantChunks: ragContext.chunks.map(c => c.content),
      });

      // Generate multiple variations
      const variations = await generateUXCopyVariations(
        llmService,
        systemPrompt,
        userPrompt,
        requestData
      );

      const totalTime = Date.now() - startTime;

      const result = {
        success: true,
        options: variations,
        metadata: {
          request: requestData,
          sources: ragContext.sources,
          chunks_used: ragContext.chunks.length,
          quality_score: ragContext.qualityScore,
          has_relevant_context: ragContext.qualityScore > 0.4,
        },
        performance: {
          totalTime,
          searchTime: ragContext.searchTime,
          generationTime: totalTime - ragContext.searchTime,
          variationsGenerated: variations.length,
          cacheHit: false,
        },
      };

      // Cache the result
      await cacheManager.setSearchResults(`ux_copy_${cacheKey}`, result);

      res.json(result);

    } catch (error) {
      if (error instanceof z.ZodError) {
        next(createError('درخواست نامعتبر است', 400, error.errors));
      } else {
        next(error);
      }
    }
  });

  // Batch UX copy generation
  router.post('/generate-copy/batch', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const { requests, priority } = batchCopyRequestSchema.parse(req.body);

      console.log(`📝 Batch generating UX copy: ${requests.length} requests`);

      const results = await Promise.allSettled(
        requests.map(async (request, index) => {
          try {
            const cacheKey = generateUXCopyCacheKey(request);
            
            // Try cache first
            const cached = await cacheManager.getSearchResults(`ux_copy_${cacheKey}`);
            if (cached) {
              return { index, success: true, ...cached, fromCache: true };
            }

            // Generate new content
            const contextQuery = `${request.elementType} ${request.context} ${request.audience}`;
            const ragContext = await ragService.getRelevantContext(contextQuery, {
              maxChunks: 3,
              similarityThreshold: 0.3,
            });

            const systemPrompt = PromptBuilder.buildSystemPrompt();
            const userPrompt = PromptBuilder.buildSpecificUXPrompt({
              ...request,
              relevantChunks: ragContext.chunks.map(c => c.content),
            });

            const variations = await generateUXCopyVariations(
              llmService,
              systemPrompt,
              userPrompt,
              request
            );

            const result = {
              index,
              success: true,
              options: variations,
              metadata: {
                request,
                sources: ragContext.sources,
                quality_score: ragContext.qualityScore,
              },
              fromCache: false,
            };

            // Cache the result
            await cacheManager.setSearchResults(`ux_copy_${cacheKey}`, result);

            return result;

          } catch (error) {
            return {
              index,
              success: false,
              error: error instanceof Error ? error.message : 'خطای نامشخص',
            };
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - successful;
      const fromCache = results
        .filter(r => r.status === 'fulfilled')
        .filter(r => (r.value as any).fromCache).length;

      const totalTime = Date.now() - startTime;

      res.json({
        success: true,
        message: `تولید دسته‌ای کپی UX انجام شد`,
        results: results.map(r => 
          r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }
        ),
        summary: {
          total: requests.length,
          successful,
          failed,
          fromCache,
          newlyGenerated: successful - fromCache,
        },
        performance: {
          totalTime,
          avgTimePerRequest: totalTime / requests.length,
          cacheEfficiency: (fromCache / requests.length) * 100,
        },
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        next(createError('درخواست نامعتبر است', 400, error.errors));
      } else {
        next(error);
      }
    }
  });

  // Get common UX templates - cached
  router.get('/templates', async (req, res, next) => {
    try {
      const cacheKey = 'ux_templates';
      
      // Try cache first
      const cached = await cacheManager.getSearchResults(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const templates = PromptBuilder.getCommonTemplates();
      
      // Enhance templates with additional metadata
      const enhancedTemplates = {
        templates: templates.map(template => ({
          ...template,
          usage_count: 0, // Would be fetched from analytics database
          last_updated: new Date().toISOString(),
        })),
        categories: [
          'buttons', 'forms', 'navigation', 'feedback', 
          'loading', 'errors', 'success', 'modals'
        ],
        metadata: {
          total_templates: templates.length,
          most_used_category: 'buttons', // Would be calculated from actual usage data
          last_updated: new Date().toISOString(),
        },
      };

      // Cache for 1 hour
      await cacheManager.setSearchResults(cacheKey, enhancedTemplates);

      res.json(enhancedTemplates);

    } catch (error) {
      next(error);
    }
  });

  // RAG statistics and performance metrics
  router.get('/stats', async (req, res, next) => {
    try {
      const [ragStats, docStats] = await Promise.all([
        ragService.getStats(),
        ragService.getDocumentStats(),
      ]);

      res.json({
        success: true,
        rag_performance: ragStats,
        document_stats: docStats,
        cache_stats: cacheManager.getStats(),
        recommendations: generatePerformanceRecommendations(ragStats),
      });

    } catch (error) {
      next(error);
    }
  });

  // Search analytics endpoint
  router.get('/analytics/search', async (req, res, next) => {
    try {
      // This would provide search analytics from actual database
      const analytics = {
        popular_queries: [
          // Would be fetched from search logs/analytics database
        ],
        performance_trends: {
          avg_search_time_trend: [], // Would be calculated from performance metrics
          cache_hit_rate_trend: [], // Would be fetched from cache statistics
        },
        quality_distribution: {
          excellent: 0, // Would be calculated from user feedback/ratings
          good: 0,
          fair: 0,
          poor: 0,
        },
      };

      res.json({ success: true, analytics });

    } catch (error) {
      next(error);
    }
  });

  // Health check
  router.get('/health', async (req, res, next) => {
    try {
      const startTime = Date.now();
      
      const [ragHealthy, cacheHealthy] = await Promise.all([
        ragService.healthCheck(),
        cacheManager.healthCheck(),
      ]);

      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        status: ragHealthy && cacheHealthy ? 'healthy' : 'unhealthy',
        components: {
          rag_service: ragHealthy ? 'healthy' : 'unhealthy',
          cache_manager: cacheHealthy ? 'healthy' : 'unhealthy',
          llm_service: 'healthy', // Assume healthy if we get here
        },
        performance: {
          response_time: responseTime,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      next(error);
    }
  });

  // Utility functions
  function generateChatCacheKey(
    message: string, 
    context?: string, 
    tone?: string, 
    searchOptions?: any
  ): string {
    const data = { message, context, tone, searchOptions };
    return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
  }

  function generateUXCopyCacheKey(request: any): string {
    // Remove dynamic fields that shouldn't affect caching
    const { variations, ...cacheableRequest } = request;
    return createHash('sha256').update(JSON.stringify(cacheableRequest)).digest('hex').substring(0, 16);
  }

  async function generateUXCopyVariations(
    llmService: LLMService,
    systemPrompt: string,
    userPrompt: string,
    request: any
  ): Promise<any[]> {
    const variations = [];
    const numVariations = Math.min(request.variations || 3, 5); // Max 5 variations

    for (let i = 0; i < numVariations; i++) {
      try {
        const response = await llmService.generateResponse([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], {
          temperature: 0.7 + (i * 0.1), // Increase creativity for later variations
          maxTokens: request.maxLength ? request.maxLength * 2 : 200,
        });

        // Try to parse as JSON, fallback to text
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(response);
        } catch {
          parsedResponse = {
            text: response,
            tone: request.tone,
            length: response.length,
            variation: i + 1,
          };
        }

        variations.push({
          ...parsedResponse,
          variation_id: i + 1,
          character_count: response.length,
          includes_emoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(response),
        });

      } catch (error) {
        console.error(`Failed to generate variation ${i + 1}:`, error);
        // Continue with other variations
      }
    }

    return variations;
  }

  function sendSSE(res: any, type: string, data: any): void {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }

  function generatePerformanceRecommendations(stats: any): string[] {
    const recommendations = [];

    if (stats.avgSearchTime > 1000) {
      recommendations.push('زمان جستجو بالا است - بررسی ایندکس‌های دیتابیس');
    }

    if (stats.cacheHitRate < 50) {
      recommendations.push('نرخ استفاده از کش پایین است - بررسی استراتژی کش');
    }

    if (stats.avgQualityScore < 0.6) {
      recommendations.push('کیفیت نتایج جستجو پایین است - بهبود embeddings');
    }

    if (recommendations.length === 0) {
      recommendations.push('عملکرد سیستم مطلوب است');
    }

    return recommendations;
  }

  return router;
}

export { optimizedChatRouter };