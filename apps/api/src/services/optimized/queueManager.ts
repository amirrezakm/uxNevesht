import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  result?: any;
}

export interface QueueConfig {
  concurrency: number;
  retryDelay: number;
  maxRetries: number;
  jobTimeout: number;
  cleanupInterval: number;
  jobTTL: number;
}

export interface QueueStats {
  processed: number;
  failed: number;
  completed: number;
  active: number;
  waiting: number;
  delayed: number;
  avgProcessingTime: number;
  throughput: number; // jobs per minute
}

type JobProcessor = (job: QueueJob) => Promise<any>;

export class QueueManager {
  private redis: Redis;
  private config: QueueConfig;
  private processors: Map<string, JobProcessor>;
  private activeJobs: Map<string, QueueJob>;
  private stats: QueueStats;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Queue names
  private readonly QUEUES = {
    HIGH_PRIORITY: 'queue:high',
    NORMAL_PRIORITY: 'queue:normal',
    LOW_PRIORITY: 'queue:low',
    DELAYED: 'queue:delayed',
    ACTIVE: 'queue:active',
    COMPLETED: 'queue:completed',
    FAILED: 'queue:failed',
  };

  constructor(redis: Redis, config?: Partial<QueueConfig>) {
    this.redis = redis;
    this.config = {
      concurrency: 5, // Process 5 jobs simultaneously
      retryDelay: 1000, // 1 second
      maxRetries: 3,
      jobTimeout: 300000, // 5 minutes
      cleanupInterval: 300000, // 5 minutes
      jobTTL: 86400000, // 24 hours
      ...config,
    };

    this.processors = new Map();
    this.activeJobs = new Map();
    this.stats = {
      processed: 0,
      failed: 0,
      completed: 0,
      active: 0,
      waiting: 0,
      delayed: 0,
      avgProcessingTime: 0,
      throughput: 0,
    };

    this.setupDefaultProcessors();
  }

  private setupDefaultProcessors(): void {
    // Document processing
    this.registerProcessor('process_document', async (job: QueueJob) => {
      const { documentId } = job.data;
      console.log(`📄 Processing document: ${documentId}`);
      
      // Import and use DocumentProcessor
      const { DocumentProcessor } = await import('../documentProcessor');
      const processor = new DocumentProcessor();
      
      await processor.processDocument(documentId);
      
      return { documentId, status: 'processed' };
    });

    // Embedding generation
    this.registerProcessor('generate_embeddings', async (job: QueueJob) => {
      const { texts, batchId } = job.data;
      console.log(`🔤 Generating embeddings for batch: ${batchId} (${texts.length} texts)`);
      
      const { EmbeddingsService } = await import('@ux-nevesht/ai');
      const embeddings = new EmbeddingsService(process.env.OPENAI_API_KEY!);
      
      const results = await embeddings.generateEmbeddings(texts);
      
      return { batchId, embeddings: results };
    });

    // Vector search optimization
    this.registerProcessor('optimize_vectors', async (job: QueueJob) => {
      const { documentId } = job.data;
      console.log(`🔍 Optimizing vectors for document: ${documentId}`);
      
      // Perform vector optimization tasks
      // This could include reindexing, cleaning up old vectors, etc.
      
      return { documentId, optimized: true };
    });

    // Cache warmup
    this.registerProcessor('warmup_cache', async (job: QueueJob) => {
      const { queries } = job.data;
      console.log(`🔥 Warming up cache with ${queries.length} queries`);
      
      // Simulate cache warmup
      for (const query of queries) {
        // Pre-generate embeddings and cache results
        console.log(`Warming up: ${query.substring(0, 50)}...`);
      }
      
      return { warmed: queries.length };
    });

    // Cleanup tasks
    this.registerProcessor('cleanup_old_data', async (job: QueueJob) => {
      const { olderThan } = job.data;
      console.log(`🧹 Cleaning up data older than: ${olderThan}`);
      
      // Perform cleanup operations
      return { cleaned: true };
    });
  }

  registerProcessor(jobType: string, processor: JobProcessor): void {
    this.processors.set(jobType, processor);
    console.log(`✅ Registered processor for job type: ${jobType}`);
  }

  async addJob(
    type: string,
    data: any,
    options?: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    }
  ): Promise<string> {
    const job: QueueJob = {
      id: uuidv4(),
      type,
      data,
      priority: options?.priority || 0,
      attempts: 0,
      maxAttempts: options?.maxAttempts || this.config.maxRetries,
      delay: options?.delay || 0,
      createdAt: new Date(),
      scheduledFor: new Date(Date.now() + (options?.delay || 0)),
    };

    try {
      // Determine queue based on priority
      let queueName = this.QUEUES.NORMAL_PRIORITY;
      if (job.priority > 5) {
        queueName = this.QUEUES.HIGH_PRIORITY;
      } else if (job.priority < 0) {
        queueName = this.QUEUES.LOW_PRIORITY;
      }

      // If job is delayed, add to delayed queue
      if (job.delay > 0) {
        queueName = this.QUEUES.DELAYED;
      }

      // Store job data
      await this.redis.hset(`job:${job.id}`, {
        id: job.id,
        type: job.type,
        data: JSON.stringify(job.data),
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        delay: job.delay,
        createdAt: job.createdAt.toISOString(),
        scheduledFor: job.scheduledFor.toISOString(),
        status: 'waiting',
      });

      // Add to appropriate queue
      await this.redis.zadd(queueName, Date.now(), job.id);

      console.log(`📨 Added job ${job.id} (${job.type}) to ${queueName}`);
      return job.id;

    } catch (error) {
      console.error('Failed to add job:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Queue manager is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting queue manager...');

    // Start processing loop
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(console.error);
    }, 1000); // Check every second

    // Start cleanup task
    this.cleanupInterval = setInterval(() => {
      this.cleanupJobs().catch(console.error);
    }, this.config.cleanupInterval);

    // Move delayed jobs to main queues
    setInterval(() => {
      this.moveDelayedJobs().catch(console.error);
    }, 5000); // Check every 5 seconds

    console.log('✅ Queue manager started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('⏹️ Stopping queue manager...');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - start) < timeout) {
      console.log(`⏳ Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      console.log(`⚠️ Force stopping with ${this.activeJobs.size} active jobs`);
    }

    console.log('✅ Queue manager stopped');
  }

  private async processJobs(): Promise<void> {
    if (!this.isRunning || this.activeJobs.size >= this.config.concurrency) {
      return;
    }

    try {
      // Get next job from highest priority queue
      const job = await this.getNextJob();
      if (!job) return;

      // Mark as active
      this.activeJobs.set(job.id, job);
      this.updateStats();

      // Process job
      this.processJob(job).catch(error => {
        console.error(`Error processing job ${job.id}:`, error);
      });

    } catch (error) {
      console.error('Error in processJobs:', error);
    }
  }

  private async getNextJob(): Promise<QueueJob | null> {
    const queues = [
      this.QUEUES.HIGH_PRIORITY,
      this.QUEUES.NORMAL_PRIORITY,
      this.QUEUES.LOW_PRIORITY,
    ];

    for (const queue of queues) {
      try {
        // Get and remove the oldest job from queue
        const result = await this.redis.zpopmin(queue, 1);
        if (result.length === 0) continue;

        const jobId = result[0];
        
        // Get job data
        const jobData = await this.redis.hgetall(`job:${jobId}`);
        if (!jobData.id) continue;

        const job: QueueJob = {
          id: jobData.id,
          type: jobData.type,
          data: JSON.parse(jobData.data),
          priority: parseInt(jobData.priority),
          attempts: parseInt(jobData.attempts),
          maxAttempts: parseInt(jobData.maxAttempts),
          delay: parseInt(jobData.delay),
          createdAt: new Date(jobData.createdAt),
          scheduledFor: new Date(jobData.scheduledFor),
          startedAt: new Date(),
        };

        return job;

      } catch (error) {
        console.error(`Error getting job from ${queue}:`, error);
        continue;
      }
    }

    return null;
  }

  private async processJob(job: QueueJob): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log(`🔄 Processing job ${job.id} (${job.type})`);

      // Update job status
      await this.redis.hset(`job:${job.id}`, {
        status: 'active',
        startedAt: job.startedAt!.toISOString(),
        attempts: job.attempts + 1,
      });

      // Add to active queue
      await this.redis.zadd(this.QUEUES.ACTIVE, Date.now(), job.id);

      // Get processor
      const processor = this.processors.get(job.type);
      if (!processor) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      // Set timeout
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), this.config.jobTimeout);
      });

      // Process with timeout
      const result = await Promise.race([
        processor(job),
        timeout,
      ]);

      // Job completed successfully
      await this.completeJob(job, result);

      const processingTime = performance.now() - startTime;
      this.updateProcessingStats(processingTime);

      console.log(`✅ Completed job ${job.id} in ${Math.round(processingTime)}ms`);

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      await this.failJob(job, error);
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(job.id);
      await this.redis.zrem(this.QUEUES.ACTIVE, job.id);
      this.updateStats();
    }
  }

  private async completeJob(job: QueueJob, result: any): Promise<void> {
    const completedAt = new Date();

    await this.redis.hset(`job:${job.id}`, {
      status: 'completed',
      completedAt: completedAt.toISOString(),
      result: JSON.stringify(result),
    });

    // Move to completed queue
    await this.redis.zadd(this.QUEUES.COMPLETED, Date.now(), job.id);

    this.stats.completed++;
    this.stats.processed++;
  }

  private async failJob(job: QueueJob, error: any): Promise<void> {
    job.attempts++;
    const failedAt = new Date();

    await this.redis.hset(`job:${job.id}`, {
      attempts: job.attempts,
      error: error.message || String(error),
      failedAt: failedAt.toISOString(),
    });

    // Retry if attempts remaining
    if (job.attempts < job.maxAttempts) {
      console.log(`🔄 Retrying job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      
      // Add delay for retry
      const retryDelay = this.config.retryDelay * Math.pow(2, job.attempts - 1); // Exponential backoff
      job.scheduledFor = new Date(Date.now() + retryDelay);
      
      await this.redis.hset(`job:${job.id}`, {
        status: 'waiting',
        scheduledFor: job.scheduledFor.toISOString(),
      });

      // Add back to delayed queue
      await this.redis.zadd(this.QUEUES.DELAYED, job.scheduledFor.getTime(), job.id);
    } else {
      // Max attempts reached
      await this.redis.hset(`job:${job.id}`, {
        status: 'failed',
      });

      // Move to failed queue
      await this.redis.zadd(this.QUEUES.FAILED, Date.now(), job.id);
      this.stats.failed++;
    }

    this.stats.processed++;
  }

  private async moveDelayedJobs(): Promise<void> {
    try {
      const now = Date.now();
      
      // Get jobs that are ready to run
      const readyJobs = await this.redis.zrangebyscore(
        this.QUEUES.DELAYED,
        0,
        now,
        'LIMIT',
        0,
        100
      );

      for (const jobId of readyJobs) {
        try {
          // Get job data to determine priority
          const jobData = await this.redis.hgetall(`job:${jobId}`);
          if (!jobData.id) continue;

          const priority = parseInt(jobData.priority || '0');
          
          // Determine target queue
          let targetQueue = this.QUEUES.NORMAL_PRIORITY;
          if (priority > 5) {
            targetQueue = this.QUEUES.HIGH_PRIORITY;
          } else if (priority < 0) {
            targetQueue = this.QUEUES.LOW_PRIORITY;
          }

          // Move job
          await this.redis.zrem(this.QUEUES.DELAYED, jobId);
          await this.redis.zadd(targetQueue, now, jobId);

          await this.redis.hset(`job:${jobId}`, {
            status: 'waiting',
          });

        } catch (error) {
          console.error(`Error moving delayed job ${jobId}:`, error);
        }
      }

    } catch (error) {
      console.error('Error moving delayed jobs:', error);
    }
  }

  private async cleanupJobs(): Promise<void> {
    try {
      const cutoff = Date.now() - this.config.jobTTL;

      // Cleanup completed jobs
      const completedJobs = await this.redis.zrangebyscore(
        this.QUEUES.COMPLETED,
        0,
        cutoff
      );

      for (const jobId of completedJobs) {
        await this.redis.zrem(this.QUEUES.COMPLETED, jobId);
        await this.redis.del(`job:${jobId}`);
      }

      // Cleanup failed jobs
      const failedJobs = await this.redis.zrangebyscore(
        this.QUEUES.FAILED,
        0,
        cutoff
      );

      for (const jobId of failedJobs) {
        await this.redis.zrem(this.QUEUES.FAILED, jobId);
        await this.redis.del(`job:${jobId}`);
      }

      if (completedJobs.length + failedJobs.length > 0) {
        console.log(`🧹 Cleaned up ${completedJobs.length + failedJobs.length} old jobs`);
      }

    } catch (error) {
      console.error('Error cleaning up jobs:', error);
    }
  }

  private updateStats(): void {
    this.stats.active = this.activeJobs.size;
    // Other stats would be updated from Redis in a real implementation
  }

  private updateProcessingStats(processingTime: number): void {
    this.stats.avgProcessingTime = this.stats.processed > 1
      ? (this.stats.avgProcessingTime + processingTime) / 2
      : processingTime;

    // Calculate throughput (jobs per minute)
    // This is a simplified calculation
    this.stats.throughput = (this.stats.completed / (Date.now() / 60000)) || 0;
  }

  // Public API methods
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const jobData = await this.redis.hgetall(`job:${jobId}`);
      return jobData.id ? jobData : null;
    } catch (error) {
      console.error(`Error getting job status for ${jobId}:`, error);
      return null;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Remove from all queues
      const queues = Object.values(this.QUEUES);
      for (const queue of queues) {
        await this.redis.zrem(queue, jobId);
      }

      // Update status
      await this.redis.hset(`job:${jobId}`, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error);
      return false;
    }
  }

  getStats(): QueueStats {
    return { ...this.stats };
  }

  async getQueueCounts(): Promise<Record<string, number>> {
    try {
      const counts: Record<string, number> = {};
      
      for (const [name, queueKey] of Object.entries(this.QUEUES)) {
        counts[name] = await this.redis.zcard(queueKey);
      }

      return counts;
    } catch (error) {
      console.error('Error getting queue counts:', error);
      return {};
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can add and retrieve a test job
      const testId = await this.addJob('health_check', { test: true });
      const status = await this.getJobStatus(testId);
      await this.cancelJob(testId);
      
      return !!status;
    } catch (error) {
      console.error('Queue health check failed:', error);
      return false;
    }
  }
}

export default QueueManager;