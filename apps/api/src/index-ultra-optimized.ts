import cluster from 'cluster';
import os from 'os';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Worker } from 'worker_threads';
import EventEmitter from 'events';

// Core services
import { OptimizedDocumentService } from './services/optimized/documentService';
import { OptimizedRAGService } from './services/optimized/ragService';
import { CacheManager } from './services/optimized/cacheManager';
import { QueueManager } from './services/optimized/queueManager';
import { DatabasePool } from './services/optimized/databasePool';
import { PerformanceMonitor } from './services/optimized/performanceMonitor';
import { WorkerPool } from './services/optimized/workerPool';

// Routes
import { optimizedDocumentsRouter } from './routes/optimized/documents';
import { optimizedChatRouter } from './routes/optimized/chat';
import { healthRouter } from './routes/health';
import { metricsRouter } from './routes/optimized/metrics';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { performanceMiddleware } from './middleware/optimized/performance';
import { cacheMiddleware } from './middleware/optimized/cache';

dotenv.config();

// Increase EventEmitter limits for high concurrency
EventEmitter.defaultMaxListeners = 100;

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV === 'development';

class UltraOptimizedServer {
  private app: express.Application;
  private redis: Redis;
  private cacheManager: CacheManager;
  private queueManager: QueueManager;
  private dbPool: DatabasePool;
  private monitor: PerformanceMonitor;
  private workerPool: WorkerPool;
  private documentService: OptimizedDocumentService;
  private ragService: OptimizedRAGService;

  constructor() {
    this.initializeRedis();
    this.initializeServices();
    this.initializeApp();
    this.setupRoutes();
    this.setupMiddleware();
  }

  private initializeRedis(): void {
    // Redis with cluster support and optimal configuration
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Enable pipelines for better performance
      enableAutoPipelining: true,
      // Connection pool settings
      family: 4,
      db: 0,
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  private initializeServices(): void {
    // Initialize core services with optimizations
    this.cacheManager = new CacheManager(this.redis);
    this.dbPool = new DatabasePool();
    this.queueManager = new QueueManager(this.redis);
    this.monitor = new PerformanceMonitor();
    this.workerPool = new WorkerPool(Math.min(numCPUs, 4)); // Limit workers

    // Business services
    this.documentService = new OptimizedDocumentService(
      this.dbPool,
      this.cacheManager,
      this.queueManager,
      this.workerPool
    );

    this.ragService = new OptimizedRAGService(
      this.dbPool,
      this.cacheManager,
      this.monitor
    );
  }

  private initializeApp(): void {
    this.app = express();

    // Trust proxy for load balancers
    this.app.set('trust proxy', 1);
    
    // Disable unnecessary headers
    this.app.disable('x-powered-by');

    // Performance optimizations
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false,
    }));

    // Compression with optimal settings
    this.app.use(compression({
      level: 6, // Balance between speed and compression
      threshold: 1024, // Only compress files > 1KB
      filter: (req, res) => {
        // Don't compress if streaming
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // CORS with caching
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      maxAge: 86400, // Cache preflight for 24 hours
    }));

    // Body parsing with optimizations
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true,
      type: ['application/json', 'text/json']
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 100
    }));
  }

  private setupMiddleware(): void {
    // Performance monitoring
    this.app.use(performanceMiddleware(this.monitor));

    // Smart caching middleware
    this.app.use(cacheMiddleware(this.cacheManager));

    // Rate limiting with Redis backend
    this.app.use(rateLimiter);
  }

  private setupRoutes(): void {
    // Health check (no auth needed)
    this.app.use('/api/health', healthRouter);

    // Metrics endpoint
    this.app.use('/api/metrics', metricsRouter(this.monitor));

    // Business routes with service injection
    this.app.use('/api/documents', optimizedDocumentsRouter(
      this.documentService,
      this.cacheManager
    ));

    this.app.use('/api/chat', optimizedChatRouter(
      this.ragService,
      this.cacheManager
    ));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.redis.connect();

      // Initialize database pool
      await this.dbPool.initialize();

      // Start queue processing
      await this.queueManager.start();

      // Start worker pool
      await this.workerPool.initialize();

      // Start performance monitoring
      this.monitor.start();

      // Start server
      const server = this.app.listen(PORT, () => {
        console.log(`🚀 Ultra-optimized API server running on port ${PORT}`);
        console.log(`🔧 Worker processes: ${cluster.isMaster ? numCPUs : 1}`);
        console.log(`📊 Health: http://localhost:${PORT}/api/health`);
        console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
        console.log(`⚡ All optimizations enabled!`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown(server);

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(server: any): void {
    const shutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}, shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        console.log('🔌 HTTP server closed');

        try {
          // Cleanup in order
          await this.workerPool.shutdown();
          console.log('👷 Worker pool shut down');

          await this.queueManager.stop();
          console.log('📮 Queue manager stopped');

          await this.dbPool.close();
          console.log('🗄️  Database pool closed');

          this.redis.disconnect();
          console.log('🔴 Redis disconnected');

          this.monitor.stop();
          console.log('📊 Monitoring stopped');

          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⏰ Shutdown timeout, forcing exit');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Cluster mode for production
if (cluster.isMaster && !isDevelopment && process.env.CLUSTER !== 'false') {
  console.log(`🎯 Master process ${process.pid} starting...`);
  console.log(`🔄 Spawning ${numCPUs} worker processes...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker crashes
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });

  // Log worker startup
  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} is online`);
  });

} else {
  // Worker process or development mode
  const server = new UltraOptimizedServer();
  server.start().catch((error) => {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  });
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default UltraOptimizedServer;