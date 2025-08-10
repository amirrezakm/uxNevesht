import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { OptimizedDocumentService } from '../../services/optimized/documentService';
import { CacheManager } from '../../services/optimized/cacheManager';
import { createError } from '../../middleware/errorHandler';

// Validation schemas
const documentQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  processed: z.string().optional().transform(val => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }),
  sortBy: z.enum(['created_at', 'title', 'file_size']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const reprocessSchema = z.object({
  priority: z.number().optional().default(0),
});

export function optimizedDocumentsRouter(
  documentService: OptimizedDocumentService,
  cacheManager: CacheManager
): Router {
  const router = Router();

  // Optimized multer configuration
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit (increased)
      files: 1,
      fields: 5,
      fieldNameSize: 100,
      fieldSize: 1024 * 1024, // 1MB field size
    },
    fileFilter: (req, file, cb) => {
      // Enhanced file validation
      const allowedMimeTypes = ['text/markdown', 'text/plain'];
      const allowedExtensions = ['.md', '.markdown', '.txt'];
      
      const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
      const isValidExtension = allowedExtensions.some(ext => 
        file.originalname.toLowerCase().endsWith(ext)
      );
      
      if (isValidMimeType || isValidExtension) {
        cb(null, true);
      } else {
        cb(new Error('فقط فایل‌های مارک‌داون (.md) مجاز هستند'));
      }
    },
  });

  // Upload document - optimized for high throughput
  router.post('/upload', upload.single('document'), async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        throw createError('فایلی آپلود نشده است', 400);
      }

      // Parse optional parameters
      const priority = req.body.priority ? parseInt(req.body.priority) : 0;
      const skipProcessing = req.body.skipProcessing === 'true';

      // Validate file size and content
      if (req.file.size === 0) {
        throw createError('فایل خالی است', 400);
      }

      console.log(`📄 Uploading document: ${req.file.originalname} (${req.file.size} bytes)`);

      // Upload with optimizations
      const result = await documentService.uploadDocument(req.file, {
        priority: Math.max(-5, Math.min(10, priority)), // Clamp priority
        skipProcessing,
      });

      const processingTime = Date.now() - startTime;

      res.status(201).json({
        success: true,
        message: 'سند با موفقیت آپلود شد',
        document: {
          id: result.document.id,
          title: result.document.title,
          file_size: result.document.file_size,
          upload_date: result.document.upload_date,
          processed: result.document.processed,
        },
        processing: {
          jobId: result.processingJobId,
          status: skipProcessing ? 'skipped' : 'queued',
          estimatedTime: skipProcessing ? 0 : Math.max(30, result.document.file_size / 1000), // Rough estimate
        },
        performance: {
          uploadTime: processingTime,
          fileSize: req.file.size,
          throughput: Math.round(req.file.size / processingTime * 1000), // bytes per second
        },
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log performance metrics even for errors
      console.error(`❌ Upload failed in ${processingTime}ms:`, error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(createError('فایل خیلی بزرگ است (حداکثر 10 مگابایت)', 413));
      } else {
        next(error);
      }
    }
  });

  // Get all documents - with advanced caching and pagination
  router.get('/', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      // Validate and parse query parameters
      const queryParams = documentQuerySchema.parse(req.query);
      
      // Generate cache key
      const cacheKey = `documents_list_${JSON.stringify(queryParams)}`;
      
      console.log(`📋 Fetching documents with params:`, queryParams);

      // Get documents with caching
      const result = await documentService.getDocuments({
        limit: Math.min(queryParams.limit, 100), // Max 100 per request
        offset: queryParams.offset,
        processed: queryParams.processed,
        sortBy: queryParams.sortBy,
        sortOrder: queryParams.sortOrder,
      });

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        documents: result.documents,
        pagination: {
          total: result.total,
          limit: queryParams.limit,
          offset: queryParams.offset,
          pages: Math.ceil(result.total / queryParams.limit),
          currentPage: Math.floor(queryParams.offset / queryParams.limit) + 1,
        },
        performance: {
          queryTime: processingTime,
          resultsCount: result.documents.length,
          cacheUsed: processingTime < 50, // Assume cache if very fast
        },
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        next(createError('پارامترهای درخواست نامعتبر هستند', 400, error.errors));
      } else {
        next(error);
      }
    }
  });

  // Get document by ID - with caching
  router.get('/:id', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const { id } = req.params;

      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw createError('شناسه سند نامعتبر است', 400);
      }

      console.log(`📄 Fetching document: ${id}`);

      const document = await documentService.getDocument(id);
      if (!document) {
        throw createError('سند یافت نشد', 404);
      }

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        document,
        performance: {
          queryTime: processingTime,
          cacheUsed: processingTime < 10,
        },
      });

    } catch (error) {
      next(error);
    }
  });

  // Get document processing progress
  router.get('/:id/progress', async (req, res, next) => {
    try {
      const { id } = req.params;

      const progress = documentService.getProcessingProgress(id);
      
      if (!progress) {
        res.json({
          success: true,
          status: 'not_found',
          message: 'اطلاعات پیشرفت پردازش یافت نشد',
        });
        return;
      }

      // Calculate additional metrics
      const elapsedTime = Date.now() - progress.startTime.getTime();
      const estimatedTotal = progress.progress > 0 
        ? (elapsedTime / progress.progress) * 100 
        : null;
      const estimatedRemaining = estimatedTotal 
        ? Math.max(0, estimatedTotal - elapsedTime)
        : null;

      res.json({
        success: true,
        progress: {
          ...progress,
          elapsedTime,
          estimatedRemaining,
          progressPercent: Math.round(progress.progress),
        },
      });

    } catch (error) {
      next(error);
    }
  });

  // Delete document - with cleanup optimization
  router.delete('/:id', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const { id } = req.params;

      console.log(`🗑️ Deleting document: ${id}`);

      await documentService.deleteDocument(id);

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        message: 'سند با موفقیت حذف شد',
        performance: {
          deletionTime: processingTime,
        },
      });

    } catch (error) {
      next(error);
    }
  });

  // Reprocess document - with priority handling
  router.post('/:id/reprocess', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { priority } = reprocessSchema.parse(req.body);

      console.log(`🔄 Reprocessing document: ${id} (priority: ${priority})`);

      const jobId = await documentService.reprocessDocument(id);

      res.json({
        success: true,
        message: 'پردازش مجدد سند آغاز شد',
        jobId,
        priority,
        estimatedTime: '1-5 دقیقه',
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        next(createError('پارامترهای درخواست نامعتبر هستند', 400, error.errors));
      } else {
        next(error);
      }
    }
  });

  // Batch operations
  router.post('/batch/reprocess', async (req, res, next) => {
    try {
      const { documentIds, priority = 0 } = req.body;

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        throw createError('لیست شناسه‌های سند ضروری است', 400);
      }

      if (documentIds.length > 50) {
        throw createError('حداکثر 50 سند در هر درخواست مجاز است', 400);
      }

      console.log(`🔄 Batch reprocessing ${documentIds.length} documents`);

      const results = await Promise.allSettled(
        documentIds.map(id => documentService.reprocessDocument(id))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - successful;

      res.json({
        success: true,
        message: `پردازش مجدد دسته‌ای انجام شد`,
        results: {
          total: documentIds.length,
          successful,
          failed,
          jobIds: results
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<string>).value),
        },
      });

    } catch (error) {
      next(error);
    }
  });

  // Get document statistics - heavily cached
  router.get('/stats/overview', async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      console.log('📊 Fetching document statistics');

      const stats = await documentService.getStats();
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        stats: {
          ...stats,
          // Add computed metrics
          processingSuccessRate: stats.totalDocuments > 0 
            ? ((stats.processedDocuments / stats.totalDocuments) * 100).toFixed(1)
            : '0',
          avgStoragePerDocument: stats.totalDocuments > 0
            ? Math.round(stats.totalStorage / stats.totalDocuments)
            : 0,
          formattedTotalStorage: formatBytes(stats.totalStorage),
        },
        performance: {
          queryTime: processingTime,
          cacheUsed: processingTime < 100,
        },
      });

    } catch (error) {
      next(error);
    }
  });

  // Health check endpoint
  router.get('/health/check', async (req, res, next) => {
    try {
      const startTime = Date.now();
      
      const isHealthy = await documentService.healthCheck();
      const responseTime = Date.now() - startTime;

      res.json({
        success: true,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        checks: {
          database: isHealthy,
          cache: await cacheManager.healthCheck(),
        },
      });

    } catch (error) {
      next(error);
    }
  });

  // Utility function for formatting bytes
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return router;
}

export { optimizedDocumentsRouter };