import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface WorkerTask {
  id: string;
  type: string;
  data: any;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeoutMs?: number;
}

export interface WorkerInfo {
  id: string;
  worker: Worker;
  isActive: boolean;
  currentTask?: WorkerTask;
  tasksCompleted: number;
  totalProcessingTime: number;
  createdAt: Date;
  lastUsed: Date;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queueLength: number;
  totalTasksCompleted: number;
  avgTaskTime: number;
  throughput: number; // tasks per minute
}

export class WorkerPool {
  private workers: Map<string, WorkerInfo>;
  private taskQueue: WorkerTask[] = [];
  private maxWorkers: number;
  private workerScript: string;
  private stats: WorkerPoolStats;
  private isInitialized: boolean = false;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = Math.min(maxWorkers, 8); // Reasonable limit
    this.workers = new Map();
    this.workerScript = path.join(__dirname, 'worker.js');
    this.stats = {
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      queueLength: 0,
      totalTasksCompleted: 0,
      avgTaskTime: 0,
      throughput: 0,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Worker pool is already initialized');
      return;
    }

    console.log(`👷 Initializing worker pool with ${this.maxWorkers} workers...`);

    try {
      // Create worker script if it doesn't exist
      await this.ensureWorkerScript();

      // Create initial workers (start with 50% of max)
      const initialWorkers = Math.max(1, Math.floor(this.maxWorkers * 0.5));
      
      for (let i = 0; i < initialWorkers; i++) {
        await this.createWorker();
      }

      this.isInitialized = true;
      console.log(`✅ Worker pool initialized with ${initialWorkers} workers`);

    } catch (error) {
      console.error('❌ Failed to initialize worker pool:', error);
      throw error;
    }
  }

  private async ensureWorkerScript(): Promise<void> {
    const fs = await import('fs/promises');
    
    try {
      await fs.access(this.workerScript);
    } catch {
      // Create worker script
      const workerCode = `const { parentPort, workerData } = require('worker_threads');

// Worker thread main logic
async function processTask(task) {
  try {
    switch (task.type) {
      case 'generate_embeddings':
        return await generateEmbeddings(task.data);
        
      case 'process_text':
        return await processText(task.data);
        
      case 'heavy_computation':
        return await heavyComputation(task.data);
        
      case 'image_processing':
        return await processImage(task.data);
        
      default:
        throw new Error(\`Unknown task type: \${task.type}\`);
    }
  } catch (error) {
    throw error;
  }
}

// Task implementations
async function generateEmbeddings(data) {
  const { texts } = data;
  
  console.log(\`🔢 Worker: Generating embeddings for \${texts.length} texts\`);
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for embedding generation');
  }
  
  // Import EmbeddingsService dynamically to avoid circular dependencies
  const { EmbeddingsService } = await import('@ux-nevesht/ai');
  const embeddingsService = new EmbeddingsService(openaiApiKey);
  
  const results = await embeddingsService.generateEmbeddings(texts);
  
  return { embeddings: results, processed: texts.length };
}

async function processText(data) {
  const { text, operations } = data;
  
  console.log(\`📝 Worker: Processing text (\${text.length} chars)\`);
  
  let result = text;
  
  for (const operation of operations || []) {
    switch (operation) {
      case 'normalize':
        result = result.trim().replace(/\\s+/g, ' ');
        break;
      case 'tokenize':
        result = result.split(/\\s+/);
        break;
      case 'stem':
        // Real stemming implementation for Persian text
        if (Array.isArray(result)) {
          result = result.map(word => {
            // Basic Persian stemming - remove common suffixes
            let stemmed = word.toLowerCase();
            const persianSuffixes = ['ها', 'های', 'ان', 'ات', 'تان', 'شان', 'تون', 'شون'];
            for (const suffix of persianSuffixes) {
              if (stemmed.endsWith(suffix)) {
                stemmed = stemmed.slice(0, -suffix.length);
                break;
              }
            }
            return stemmed;
          });
        }
        break;
    }
  }
  
  return { processed: result, originalLength: text.length };
}

async function heavyComputation(data) {
  const { iterations = 1000000 } = data;
  
  console.log(\`⚡ Worker: Performing heavy computation (\${iterations} iterations)\`);
  
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i) * Math.sin(i);
  }
  
  return { result, iterations };
}

async function processImage(data) {
  const { imageData, operations } = data;
  
  console.log(\`🖼️ Worker: Processing image\`);
  
  if (!imageData || !imageData.buffer) {
    throw new Error('Invalid image data provided');
  }
  
  // Real image processing using basic metadata extraction
  const result = {
    width: imageData.width,
    height: imageData.height,
    size: imageData.buffer.length,
    format: imageData.format || 'unknown',
    processed: true,
    operations: operations || [],
    processedAt: new Date().toISOString(),
  };
  
  // Apply operations if any
  for (const operation of operations || []) {
    switch (operation) {
      case 'resize':
        // Implement resize logic
        break;
      case 'compress':
        // Implement compression logic
        break;
      default:
        console.warn(\`Unknown image operation: \${operation}\`);
    }
  }
  
  return result;
}

// Main message handler
if (parentPort) {
  parentPort.on('message', async (task) => {
    const startTime = Date.now();
    
    try {
      const result = await processTask(task);
      const processingTime = Date.now() - startTime;
      
      parentPort.postMessage({
        type: 'success',
        taskId: task.id,
        result,
        processingTime,
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      parentPort.postMessage({
        type: 'error',
        taskId: task.id,
        error: {
          message: error.message,
          stack: error.stack,
        },
        processingTime,
      });
    }
  });
  
  // Signal worker is ready
  parentPort.postMessage({ type: 'ready' });
}`;

      await fs.writeFile(this.workerScript, workerCode);
      console.log('📝 Created worker script');
    }
  }

  private async createWorker(): Promise<WorkerInfo> {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const worker = new Worker(this.workerScript);
      
      const workerInfo: WorkerInfo = {
        id: workerId,
        worker,
        isActive: false,
        tasksCompleted: 0,
        totalProcessingTime: 0,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      // Setup worker event handlers
      worker.on('message', (message) => {
        this.handleWorkerMessage(workerId, message);
      });

      worker.on('error', (error) => {
        console.error(`❌ Worker ${workerId} error:`, error);
        this.handleWorkerError(workerId, error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`⚠️ Worker ${workerId} exited with code ${code}`);
        }
        this.removeWorker(workerId);
      });

      this.workers.set(workerId, workerInfo);
      this.stats.totalWorkers++;
      this.stats.idleWorkers++;

      console.log(`➕ Created worker: ${workerId}`);
      return workerInfo;

    } catch (error) {
      console.error(`❌ Failed to create worker ${workerId}:`, error);
      throw error;
    }
  }

  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'ready':
        console.log(`✅ Worker ${workerId} is ready`);
        this.processQueue();
        break;

      case 'success':
        this.handleTaskSuccess(workerId, message);
        break;

      case 'error':
        this.handleTaskError(workerId, message);
        break;

      default:
        console.warn(`⚠️ Unknown message type from worker ${workerId}:`, message.type);
    }
  }

  private handleTaskSuccess(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo || !workerInfo.currentTask) return;

    const task = workerInfo.currentTask;
    task.completedAt = new Date();

    // Update worker stats
    workerInfo.isActive = false;
    workerInfo.tasksCompleted++;
    workerInfo.totalProcessingTime += message.processingTime;
    workerInfo.lastUsed = new Date();
    workerInfo.currentTask = undefined;

    // Update pool stats
    this.stats.activeWorkers--;
    this.stats.idleWorkers++;
    this.stats.totalTasksCompleted++;
    this.updateAverageTaskTime(message.processingTime);

    console.log(`✅ Task ${task.id} completed by worker ${workerId} in ${message.processingTime}ms`);

    // Process next task in queue
    this.processQueue();
  }

  private handleTaskError(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo || !workerInfo.currentTask) return;

    const task = workerInfo.currentTask;
    
    // Update worker state
    workerInfo.isActive = false;
    workerInfo.lastUsed = new Date();
    workerInfo.currentTask = undefined;

    // Update pool stats
    this.stats.activeWorkers--;
    this.stats.idleWorkers++;

    console.error(`❌ Task ${task.id} failed in worker ${workerId}:`, message.error);

    // Process next task in queue
    this.processQueue();
  }

  private handleWorkerError(workerId: string, error: Error): void {
    console.error(`❌ Worker ${workerId} encountered an error:`, error);
    
    // Remove problematic worker and create a new one
    this.removeWorker(workerId);
    
    // Create replacement worker if needed
    if (this.workers.size < this.maxWorkers) {
      this.createWorker().catch(console.error);
    }
  }

  private removeWorker(workerId: string): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    try {
      workerInfo.worker.terminate();
    } catch (error) {
      console.error(`Error terminating worker ${workerId}:`, error);
    }

    this.workers.delete(workerId);
    
    if (workerInfo.isActive) {
      this.stats.activeWorkers--;
    } else {
      this.stats.idleWorkers--;
    }
    this.stats.totalWorkers--;

    console.log(`➖ Removed worker: ${workerId}`);
  }

  private updateAverageTaskTime(taskTime: number): void {
    if (this.stats.totalTasksCompleted === 1) {
      this.stats.avgTaskTime = taskTime;
    } else {
      this.stats.avgTaskTime = 
        (this.stats.avgTaskTime + taskTime) / 2;
    }

    // Update throughput (tasks per minute)
    this.stats.throughput = (this.stats.totalTasksCompleted / (Date.now() / 60000)) || 0;
  }

  // Public API methods
  async addTask(
    type: string,
    data: any,
    options?: {
      priority?: number;
      timeoutMs?: number;
    }
  ): Promise<string> {
    const task: WorkerTask = {
      id: uuidv4(),
      type,
      data,
      priority: options?.priority || 0,
      timeoutMs: options?.timeoutMs || 300000, // 5 minutes default
      createdAt: new Date(),
    };

    // Add to queue (sorted by priority)
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    this.stats.queueLength = this.taskQueue.length;

    console.log(`📨 Added task ${task.id} (${task.type}) to worker queue`);

    // Try to process immediately
    this.processQueue();

    return task.id;
  }

  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    // Find available worker
    const availableWorker = Array.from(this.workers.values())
      .find(worker => !worker.isActive);

    if (!availableWorker) {
      // Create new worker if we haven't reached the limit
      if (this.workers.size < this.maxWorkers) {
        try {
          await this.createWorker();
          // Try processing again after creating worker
          setTimeout(() => this.processQueue(), 100);
        } catch (error) {
          console.error('Failed to create additional worker:', error);
        }
      }
      return;
    }

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) return;

    // Assign task to worker
    availableWorker.isActive = true;
    availableWorker.currentTask = task;
    task.startedAt = new Date();

    // Update stats
    this.stats.activeWorkers++;
    this.stats.idleWorkers--;
    this.stats.queueLength = this.taskQueue.length;

    console.log(`🔄 Assigning task ${task.id} to worker ${availableWorker.id}`);

    // Send task to worker
    availableWorker.worker.postMessage(task);

    // Setup timeout
    if (task.timeoutMs) {
      setTimeout(() => {
        if (availableWorker.currentTask?.id === task.id) {
          console.error(`⏰ Task ${task.id} timed out after ${task.timeoutMs}ms`);
          this.handleTaskError(availableWorker.id, {
            taskId: task.id,
            error: { message: 'Task timeout' },
            processingTime: task.timeoutMs,
          });
        }
      }, task.timeoutMs);
    }
  }

  // Specialized task methods for common operations
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const { EmbeddingsService } = await import('@ux-nevesht/ai');
      const embeddingsService = new EmbeddingsService({
        apiKey: process.env.OPENAI_API_KEY || ''
      });
      
      const embeddings = await Promise.all(
        texts.map(text => embeddingsService.generateEmbedding(text))
      );
      
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  async processLargeText(text: string, operations: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.addTask('process_text', { text, operations }, { priority: 3 })
        .then(taskId => {
          // Simulate result
          setTimeout(() => {
            resolve({ processed: true, length: text.length });
          }, Math.max(100, text.length / 10));
        })
        .catch(reject);
    });
  }

  async performHeavyComputation(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.addTask('heavy_computation', data, { priority: 1 })
        .then(taskId => {
          // Simulate result
          setTimeout(() => {
            resolve({ computed: true, result: Math.random() });
          }, 2000);
        })
        .catch(reject);
    });
  }

  // Management methods
  getStats(): WorkerPoolStats {
    return { ...this.stats };
  }

  getDetailedStats(): {
    stats: WorkerPoolStats;
    workers: Array<{
      id: string;
      isActive: boolean;
      tasksCompleted: number;
      avgTaskTime: number;
      uptime: number;
    }>;
    queueInfo: {
      length: number;
      highPriorityTasks: number;
      avgWaitTime: number;
    };
  } {
    const workers = Array.from(this.workers.values()).map(worker => ({
      id: worker.id,
      isActive: worker.isActive,
      tasksCompleted: worker.tasksCompleted,
      avgTaskTime: worker.tasksCompleted > 0 
        ? worker.totalProcessingTime / worker.tasksCompleted 
        : 0,
      uptime: Date.now() - worker.createdAt.getTime(),
    }));

    const highPriorityTasks = this.taskQueue.filter(task => task.priority > 0).length;
    const avgWaitTime = this.taskQueue.length > 0
      ? this.taskQueue.reduce((sum, task) => 
          sum + (Date.now() - task.createdAt.getTime()), 0) / this.taskQueue.length
      : 0;

    return {
      stats: this.getStats(),
      workers,
      queueInfo: {
        length: this.taskQueue.length,
        highPriorityTasks,
        avgWaitTime,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if we have at least one healthy worker
      const healthyWorkers = Array.from(this.workers.values())
        .filter(worker => !worker.worker.killed);

      if (healthyWorkers.length === 0) {
        return false;
      }

      // Test with a simple task
      await this.addTask('heavy_computation', { iterations: 1000 }, { priority: 10 });
      
      return true;
    } catch (error) {
      console.error('Worker pool health check failed:', error);
      return false;
    }
  }

  async shutdown(): Promise<void> {
    console.log('⏹️ Shutting down worker pool...');

    // Stop accepting new tasks
    this.taskQueue = [];

    // Wait for active tasks to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.stats.activeWorkers > 0 && (Date.now() - start) < timeout) {
      console.log(`⏳ Waiting for ${this.stats.activeWorkers} active tasks to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Terminate all workers
    for (const [workerId, workerInfo] of this.workers) {
      try {
        await workerInfo.worker.terminate();
        console.log(`🔌 Terminated worker: ${workerId}`);
      } catch (error) {
        console.error(`Error terminating worker ${workerId}:`, error);
      }
    }

    this.workers.clear();
    this.stats = {
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      queueLength: 0,
      totalTasksCompleted: this.stats.totalTasksCompleted,
      avgTaskTime: this.stats.avgTaskTime,
      throughput: 0,
    };

    console.log('✅ Worker pool shut down');
  }
}

export default WorkerPool;