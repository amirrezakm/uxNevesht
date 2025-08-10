import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Enhanced services with vectorization improvements
import { supabase } from '@ux-nevesht/database';
import { DocumentProcessor } from './services/documentProcessor';
import { CleanupService } from './services/cleanupService';
import { RAGService } from './services/ragService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize enhanced services
const documentProcessor = new DocumentProcessor();
const cleanupService = new CleanupService(); 
const ragService = new RAGService();

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing with increased limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer configuration for enhanced file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/markdown', 'text/plain'];
    const allowedExts = ['.md', '.txt'];
    
    const isValidType = allowedTypes.includes(file.mimetype) || 
                       allowedExts.some(ext => file.originalname.toLowerCase().endsWith(ext));
    
    if (isValidType) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل‌های Markdown (.md) پذیرفته می‌شوند'));
    }
  }
});

// Enhanced health check with all services status
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const { error: dbError } = await supabase
      .from('documents')
      .select('count')
      .limit(1);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      database: dbError ? 'disconnected' : 'connected',
      services: {
        vectorization: 'enhanced',
        documentProcessor: 'ready with progress tracking',
        ragService: 'ready for intelligent search',
        cleanupService: 'ready for maintenance'
      },
      features: [
        'Timeout protection (30-45s)',
        'Retry logic (3 attempts)',
        'Progress tracking',
        'Batch optimization (20 items)',
        'Stuck documents detection',
        'Enhanced error handling'
      ]
    };

    if (dbError) {
      health.status = 'degraded';
    }

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Enhanced vectorization status
app.get('/api/vectorization-status', async (req, res) => {
  try {
    const stuckDocs = await documentProcessor.getStuckDocuments();
    
    res.json({
      status: 'enhanced',
      message: 'سیستم وکتورایز کاملاً بهبود یافته است',
      improvements: [
        'Timeout برای API calls (30-45 ثانیه)',
        'Retry logic (3 بار تکرار)',
        'Progress tracking real-time',
        'Batch size بهینه (50→20)',
        'تشخیص خودکار اسناد گیر کرده',
        'Better error handling و logging',
        'Memory optimization',
        'Persian text support'
      ],
      currentStatus: {
        stuckDocuments: stuckDocs.length,
        processingOptimized: true,
        retryEnabled: true,
        progressTracking: true
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'خطا در بررسی وضعیت' 
    });
  }
});

// Enhanced document upload endpoint
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'فایلی آپلود نشده است' });
    }

    const { originalname, buffer, size } = req.file;
    const content = buffer.toString('utf-8');
    const documentId = uuidv4();
    const fileName = `${documentId}-${originalname}`;

    console.log(`📄 Starting enhanced document processing: ${originalname}`);

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: 'text/markdown',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`خطا در آپلود فایل: ${uploadError.message}`);
    }

    // Save document metadata to database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        title: originalname.replace(/\.(md|txt)$/i, ''),
        content,
        file_path: fileName,
        file_size: size,
        processed: false,
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`خطا در ذخیره اطلاعات: ${dbError.message}`);
    }

    // Process document with enhanced vectorization
    console.log(`🚀 Starting enhanced vectorization for: ${documentId}`);
    documentProcessor.processDocument(documentId).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'سند با موفقیت آپلود شد و پردازش بهبود یافته آغاز شد',
      document: {
        id: document.id,
        title: document.title,
        file_size: document.file_size,
        upload_date: document.upload_date,
        processed: document.processed,
      },
      processing: {
        enhanced: true,
        features: ['timeout protection', 'retry logic', 'progress tracking']
      }
    });
  } catch (error: any) {
    console.error('Enhanced document upload error:', error);
    res.status(500).json({ 
      error: 'خطا در آپلود سند',
      message: error.message 
    });
  }
});

// Enhanced documents list endpoint
app.get('/api/documents', async (req, res) => {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, title, file_size, upload_date, processed, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Check for stuck documents
    const stuckDocs = await documentProcessor.getStuckDocuments();

    res.json({
      success: true,
      documents: documents || [],
      stats: {
        total: documents?.length || 0,
        processed: documents?.filter(d => d.processed).length || 0,
        stuck: stuckDocs.length
      },
      enhanced: true
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'خطا در دریافت اسناد',
      message: error.message 
    });
  }
});

// Enhanced RAG search endpoint
app.post('/api/chat/search', async (req, res) => {
  try {
    const searchSchema = z.object({
      query: z.string().min(1, 'متن جستجو الزامی است'),
      similarity_threshold: z.number().min(0).max(1).optional().default(0.3),
      match_count: z.number().min(1).max(20).optional().default(8)
    });

    const { query, similarity_threshold, match_count } = searchSchema.parse(req.body);

    console.log(`🔍 Enhanced RAG search: "${query}"`);

    const results = await ragService.searchRelevantChunks(
      query,
      similarity_threshold,
      match_count
    );

    res.json({
      success: true,
      query,
      results,
      enhanced: true,
      features: ['Persian support', 'Context ranking', 'Similarity scoring']
    });
  } catch (error: any) {
    console.error('Enhanced search error:', error);
    res.status(500).json({ 
      error: 'خطا در جستجو',
      message: error.message 
    });
  }
});

// Enhanced admin endpoints
app.post('/api/admin/fix-vectorization', async (req, res) => {
  try {
    console.log('🔧 Running enhanced vectorization fix...');
    
    const stuckDocs = await documentProcessor.getStuckDocuments();
    
    if (stuckDocs.length > 0) {
      console.log(`Found ${stuckDocs.length} stuck documents, resetting...`);
      await documentProcessor.resetStuckDocuments();
      
      res.json({
        success: true,
        message: `${stuckDocs.length} سند گیر کرده با موفقیت ریست شد`,
        documents: stuckDocs,
        nextSteps: 'پردازش بهبود یافته آغاز شده است'
      });
    } else {
      res.json({
        success: true,
        message: 'هیچ سند گیر کرده‌ای یافت نشد - سیستم عالی کار می‌کند',
        status: 'optimal'
      });
    }
  } catch (error: any) {
    console.error('Fix vectorization error:', error);
    res.status(500).json({ 
      success: false,
      error: 'خطا در تعمیر سیستم',
      message: error.message 
    });
  }
});

app.post('/api/admin/reprocess', async (req, res) => {
  try {
    console.log('⚡ Starting enhanced reprocessing...');
    
    documentProcessor.reprocessAllDocuments().catch(console.error);
    
    res.json({
      success: true,
      message: 'پردازش مجدد بهبود یافته آغاز شد',
      features: ['Enhanced progress tracking', 'Better error handling', 'Timeout protection']
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: 'خطا در شروع پردازش مجدد' 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'مسیر یافت نشد',
    available_endpoints: [
      'GET /api/health',
      'GET /api/vectorization-status', 
      'POST /api/documents/upload',
      'GET /api/documents',
      'POST /api/chat/search',
      'POST /api/admin/fix-vectorization'
    ]
  });
});

// Enhanced error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('🚨 Enhanced API Error:', error);
  
  if (error.name === 'ZodError') {
    return res.status(400).json({ 
      error: 'خطا در ورودی',
      details: error.errors 
    });
  }

  if (error.message?.includes('File too large')) {
    return res.status(413).json({ 
      error: 'فایل خیلی بزرگ است',
      message: 'حداکثر سایز مجاز: 5MB' 
    });
  }

  res.status(500).json({ 
    error: 'خطای سرور',
    message: process.env.NODE_ENV === 'development' ? error.message : 'مشکلی در سرور رخ داده',
    enhanced: true
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced API server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Vectorization: http://localhost:${PORT}/api/vectorization-status`);
  console.log(`⚡ Features: Enhanced vectorization, Progress tracking, Smart retry`);
  console.log(`💡 Ready for production use!`);
});