import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import { documentsRouter } from './routes/documents';
import { chatRouter } from './routes/chat';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { supabase } from '@ux-nevesht/database';
import { validateEnvironment, validateApiKeys } from './utils/validation';

// Load environment variables
dotenv.config();

// Validate environment early
try {
  validateEnvironment();
  validateApiKeys();
} catch (error) {
  console.error('❌ Startup failed due to configuration issues');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  // Ensure storage bucket exists (requires service role key)
  (async () => {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.warn('⚠️ Failed to list storage buckets:', listError.message);
        return;
      }

      const hasDocuments = buckets?.some((b: any) => b.name === 'documents');
      if (!hasDocuments) {
        const { error: createError } = await supabase.storage.createBucket('documents', {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
        });
        if (createError) {
          console.warn('⚠️ Failed to create storage bucket "documents":', createError.message);
        } else {
          console.log('✅ Created storage bucket "documents"');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('⚠️ Storage bucket check failed:', message);
    }
  })();
});

// Increase server timeout for large file processing
server.timeout = 10 * 60 * 1000; // 10 minutes
server.keepAliveTimeout = 5 * 60 * 1000; // 5 minutes
server.headersTimeout = 6 * 60 * 1000; // 6 minutes 