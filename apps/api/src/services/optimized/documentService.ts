import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';
import { DatabasePool } from './databasePool';
import { CacheManager } from './cacheManager';
import { QueueManager } from './queueManager';
import { WorkerPool } from './workerPool';

export interface DocumentMetadata {
  id: string;
  title: string;
  content: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  processed: boolean;
  chunk_count?: number;
  processing_time?: number;
  error_message?: string;
  created_at: string;
}

export interface ProcessingProgress {
  documentId: string;
  status: 'queued' | 'processing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  startTime: Date;
  estimatedCompletion?: Date;
  chunksProcessed?: number;
  totalChunks?: number;
  error?: string;
}

export interface DocumentStats {
  totalDocuments: number;
  processedDocuments: number;
  pendingDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  avgChunksPerDocument: number;
  avgProcessingTime: number;
  totalStorage: number; // in bytes
}

export class OptimizedDocumentService {
  private dbPool: DatabasePool;
  private cache: CacheManager;
  private queue: QueueManager;
  private workerPool: WorkerPool;
  private progressTracking: Map<string, ProcessingProgress> = new Map();

  constructor(
    dbPool: DatabasePool,
    cache: CacheManager,
    queue: QueueManager,
    workerPool: WorkerPool
  ) {
    this.dbPool = dbPool;
    this.cache = cache;
    this.queue = queue;
    this.workerPool = workerPool;

    this.setupProgressCleanup();
  }

  private setupProgressCleanup(): void {
    // Clean up old progress tracking every hour
    setInterval(() => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      for (const [id, progress] of this.progressTracking) {
        if (progress.startTime.getTime() < oneDayAgo) {
          this.progressTracking.delete(id);
        }
      }
    }, 3600000);
  }

  async uploadDocument(
    file: {
      originalname: string;
      buffer: Buffer;
      size: number;
      mimetype: string;
    },
    options?: {
      priority?: number;
      skipProcessing?: boolean;
    }
  ): Promise<{
    document: DocumentMetadata;
    processingJobId?: string;
  }> {
    const startTime = performance.now();
    const documentId = uuidv4();
    const fileName = `${documentId}-${file.originalname}`;

    try {
      console.log(`📄 Starting document upload: ${file.originalname} (${file.size} bytes)`);

      // Validate file
      this.validateFile(file);

      // Extract content
      const content = file.buffer.toString('utf-8');
      
      // Upload to storage (Supabase Storage)
      const storageResult = await this.uploadToStorage(fileName, file.buffer);
      if (!storageResult.success) {
        throw new Error(`Storage upload failed: ${storageResult.error}`);
      }

      // Create document record
      const document: DocumentMetadata = {
        id: documentId,
        title: file.originalname.replace('.md', ''),
        content,
        file_path: fileName,
        file_size: file.size,
        upload_date: new Date().toISOString(),
        processed: false,
        created_at: new Date().toISOString(),
      };

      // Save to database
      const { error: dbError } = await this.dbPool.insert('documents', document);
      if (dbError) {
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      // Cache document
      await this.cache.setDocument(documentId, document);

      const uploadTime = performance.now() - startTime;
      console.log(`✅ Document uploaded in ${Math.round(uploadTime)}ms: ${documentId}`);

      // Start processing if not skipped
      let processingJobId: string | undefined;
      if (!options?.skipProcessing) {
        processingJobId = await this.startDocumentProcessing(documentId, options?.priority);
      }

      return { document, processingJobId };

    } catch (error) {
      console.error(`❌ Document upload failed for ${file.originalname}:`, error);
      
      // Cleanup on failure
      try {
        await this.cleanupFailedUpload(documentId, fileName);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
      
      throw error;
    }
  }

  private validateFile(file: any): void {
    // File type validation
    if (!file.mimetype.includes('markdown') && !file.originalname.toLowerCase().endsWith('.md')) {
      throw new Error('Only Markdown files are allowed');
    }

    // Size validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
    }

    // Content validation
    const content = file.buffer.toString('utf-8');
    if (content.trim().length < 100) {
      throw new Error('Document content is too short (minimum 100 characters)');
    }

    // Check for valid UTF-8
    try {
      Buffer.from(content, 'utf-8');
    } catch {
      throw new Error('Invalid text encoding. Please ensure the file is UTF-8 encoded');
    }
  }

  private async uploadToStorage(fileName: string, buffer: Buffer): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // In a real implementation, you'd use Supabase storage
      // TODO: Implement actual storage upload (e.g., AWS S3, Google Cloud Storage)
      // For now, we'll assume successful upload
      
      console.log(`☁️ Uploaded to storage: ${fileName}`);
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  private async startDocumentProcessing(
    documentId: string,
    priority: number = 0
  ): Promise<string> {
    // Initialize progress tracking
    this.progressTracking.set(documentId, {
      documentId,
      status: 'queued',
      progress: 0,
      currentStep: 'Queued for processing',
      startTime: new Date(),
    });

    // Add processing job to queue
    const jobId = await this.queue.addJob(
      'process_document_optimized',
      { documentId },
      { priority }
    );

    console.log(`📮 Queued document processing: ${documentId} (job: ${jobId})`);
    return jobId;
  }

  async processDocumentOptimized(documentId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log(`🔄 Starting optimized processing for document: ${documentId}`);

      // Update progress
      this.updateProgress(documentId, {
        status: 'processing',
        progress: 10,
        currentStep: 'Loading document content',
      });

      // Get document from cache or database
      let document = await this.cache.getDocument(documentId);
      if (!document) {
        const { data, error } = await this.dbPool.select<DocumentMetadata>(
          'documents',
          '*',
          { id: documentId }
        );
        
        if (error || !data || data.length === 0) {
          throw new Error(`Document not found: ${documentId}`);
        }
        
        document = data[0];
        await this.cache.setDocument(documentId, document);
      }

      // Step 1: Text chunking (using worker pool for CPU-intensive work)
      this.updateProgress(documentId, {
        status: 'chunking',
        progress: 25,
        currentStep: 'Chunking document text',
      });

      const chunks = await this.chunkDocumentOptimized(document.content);
      console.log(`📝 Created ${chunks.length} chunks for document ${documentId}`);

      this.updateProgress(documentId, {
        status: 'chunking',
        progress: 40,
        currentStep: `Created ${chunks.length} chunks`,
        totalChunks: chunks.length,
        chunksProcessed: 0,
      });

      // Step 2: Generate embeddings in batches
      this.updateProgress(documentId, {
        status: 'embedding',
        progress: 50,
        currentStep: 'Generating embeddings',
      });

      const embeddings = await this.generateEmbeddingsBatch(
        chunks.map(c => c.content),
        (progress) => {
          this.updateProgress(documentId, {
            status: 'embedding',
            progress: 50 + (progress * 0.3), // 50-80%
            currentStep: `Generating embeddings (${Math.round(progress)}%)`,
          });
        }
      );

      // Step 3: Store chunks with embeddings
      this.updateProgress(documentId, {
        status: 'storing',
        progress: 80,
        currentStep: 'Storing chunks to database',
      });

      await this.storeChunksOptimized(documentId, chunks, embeddings);

      // Step 4: Mark as completed
      this.updateProgress(documentId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Processing completed',
      });

      // Update document status
      await this.dbPool.update(
        'documents',
        { 
          processed: true,
          chunk_count: chunks.length,
          processing_time: Math.round(performance.now() - startTime),
        },
        { id: documentId }
      );

      // Update cache
      document.processed = true;
      document.chunk_count = chunks.length;
      await this.cache.setDocument(documentId, document);

      const totalTime = performance.now() - startTime;
      console.log(`✅ Document processing completed: ${documentId} in ${Math.round(totalTime)}ms`);

    } catch (error) {
      console.error(`❌ Document processing failed: ${documentId}`, error);
      
      this.updateProgress(documentId, {
        status: 'failed',
        progress: 0,
        currentStep: 'Processing failed',
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark document as failed
      await this.dbPool.update(
        'documents',
        { 
          processed: false,
          error_message: error instanceof Error ? error.message : String(error),
        },
        { id: documentId }
      );

      throw error;
    }
  }

  private async chunkDocumentOptimized(content: string): Promise<Array<{
    content: string;
    index: number;
    tokenCount: number;
  }>> {
    // Use worker pool for CPU-intensive chunking
    const result = await this.workerPool.processLargeText(content, [
      'normalize',
      'tokenize'
    ]);

    // For now, simulate chunking logic
    // In real implementation, this would use the TextChunker from AI package
    const chunkSize = 512;
    const overlap = 50;
    const chunks = [];
    
    const words = content.split(/\s+/);
    let index = 0;
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkContent = chunkWords.join(' ');
      
      if (chunkContent.trim().length > 50) { // Minimum chunk size
        chunks.push({
          content: chunkContent,
          index: index++,
          tokenCount: chunkWords.length,
        });
      }
    }

    return chunks;
  }

  private async generateEmbeddingsBatch(
    texts: string[],
    progressCallback?: (progress: number) => void
  ): Promise<number[][]> {
    const batchSize = 20; // Optimal batch size for embeddings
    const allEmbeddings: number[][] = [];

    console.log(`🔤 Generating embeddings for ${texts.length} texts in batches of ${batchSize}`);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Check cache first
      const cachedEmbeddings = await this.cache.getEmbeddings(batch);
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];

      // Separate cached and uncached
      batch.forEach((text, localIndex) => {
        if (!cachedEmbeddings.has(text)) {
          uncachedTexts.push(text);
          uncachedIndices.push(i + localIndex);
        }
      });

      // Generate embeddings for uncached texts
      let newEmbeddings: number[][] = [];
      if (uncachedTexts.length > 0) {
        newEmbeddings = await this.workerPool.generateEmbeddings(uncachedTexts);
        
        // Cache new embeddings
        const cacheData = uncachedTexts.map((text, index) => ({
          text,
          embedding: newEmbeddings[index],
        }));
        await this.cache.setEmbeddings(cacheData);
      }

      // Combine cached and new embeddings in correct order
      let newEmbeddingIndex = 0;
      for (let j = 0; j < batch.length; j++) {
        const text = batch[j];
        const cached = cachedEmbeddings.get(text);
        
        if (cached) {
          allEmbeddings.push(cached);
        } else {
          allEmbeddings.push(newEmbeddings[newEmbeddingIndex++]);
        }
      }

      // Report progress
      const progress = ((i + batch.length) / texts.length) * 100;
      progressCallback?.(progress);
      
      console.log(`📊 Embedding progress: ${Math.round(progress)}% (${i + batch.length}/${texts.length})`);
    }

    return allEmbeddings;
  }

  private async storeChunksOptimized(
    documentId: string,
    chunks: Array<{ content: string; index: number; tokenCount: number }>,
    embeddings: number[][]
  ): Promise<void> {
    const batchSize = 10; // Optimal batch size for database inserts
    
    console.log(`💾 Storing ${chunks.length} chunks in batches of ${batchSize}`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      const chunksToInsert = batch.map((chunk, index) => ({
        id: uuidv4(),
        document_id: documentId,
        content: chunk.content,
        embedding: batchEmbeddings[index],
        chunk_index: chunk.index,
        token_count: chunk.tokenCount,
        created_at: new Date().toISOString(),
      }));

      const { error } = await this.dbPool.insert('document_chunks', chunksToInsert);
      if (error) {
        throw new Error(`Failed to store chunk batch: ${error.message}`);
      }

      console.log(`💾 Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }
  }

  private updateProgress(documentId: string, updates: Partial<ProcessingProgress>): void {
    const current = this.progressTracking.get(documentId);
    if (current) {
      const updated = { ...current, ...updates };
      
      // Estimate completion time
      if (updated.progress > 0 && updated.progress < 100) {
        const elapsed = Date.now() - updated.startTime.getTime();
        const estimatedTotal = (elapsed / updated.progress) * 100;
        updated.estimatedCompletion = new Date(updated.startTime.getTime() + estimatedTotal);
      }

      this.progressTracking.set(documentId, updated);
    }
  }

  // Public API methods
  async getDocuments(
    options?: {
      limit?: number;
      offset?: number;
      processed?: boolean;
      sortBy?: 'created_at' | 'title' | 'file_size';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ documents: DocumentMetadata[]; total: number }> {
    const cacheKey = `documents_list_${JSON.stringify(options)}`;
    
    // Try cache first
    const cached = await this.cache.getSearchResults(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const filters: any = {};
    if (options?.processed !== undefined) {
      filters.processed = options.processed;
    }

    const { data, count, error } = await this.dbPool.select<DocumentMetadata>(
      'documents',
      'id, title, file_size, upload_date, processed, chunk_count, processing_time, created_at',
      filters,
      {
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        orderBy: options?.sortBy || 'created_at',
        ascending: options?.sortOrder === 'asc',
      }
    );

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    const result = {
      documents: Array.isArray(data) ? data : [],
      total: count || 0,
    };

    // Cache result
    await this.cache.setSearchResults(cacheKey, result);

    return result;
  }

  async getDocument(documentId: string): Promise<DocumentMetadata | null> {
    // Try cache first
    const cached = await this.cache.getDocument(documentId);
    if (cached) {
      return cached;
    }

    // Query database
    const { data, error } = await this.dbPool.select<DocumentMetadata>(
      'documents',
      '*',
      { id: documentId }
    );

    if (error) {
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    const document = data?.[0] || null;
    
    // Cache result
    if (document) {
      await this.cache.setDocument(documentId, document);
    }

    return document;
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Get document info first
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete from storage
      // In real implementation, you'd delete from Supabase storage
      console.log(`🗑️ Deleting from storage: ${document.file_path}`);

      // Delete from database (cascades to chunks)
      const { error } = await this.dbPool.delete('documents', { id: documentId });
      if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }

      // Invalidate caches
      await this.cache.invalidateDocument(documentId);

      console.log(`✅ Document deleted: ${documentId}`);

    } catch (error) {
      console.error(`❌ Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  async reprocessDocument(documentId: string): Promise<string> {
    // Check if document exists
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Delete existing chunks
    await this.dbPool.delete('document_chunks', { document_id: documentId });

    // Mark as unprocessed
    await this.dbPool.update(
      'documents',
      { processed: false, error_message: null },
      { id: documentId }
    );

    // Invalidate caches
    await this.cache.invalidateDocument(documentId);

    // Start reprocessing
    return this.startDocumentProcessing(documentId, 5); // High priority
  }

  getProcessingProgress(documentId: string): ProcessingProgress | null {
    return this.progressTracking.get(documentId) || null;
  }

  async getStats(): Promise<DocumentStats> {
    const cacheKey = 'document_stats';
    
    // Try cache first
    const cached = await this.cache.getSearchResults(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database for stats
    const [documentsResult, chunksResult] = await Promise.all([
      this.dbPool.select('documents', 'processed, file_size, processing_time'),
      this.dbPool.select('document_chunks', 'COUNT(*) as total', {}, { limit: 1 }),
    ]);

    if (documentsResult.error || chunksResult.error) {
      throw new Error('Failed to fetch document statistics');
    }

    // Ensure we have valid arrays
    const documents = Array.isArray(documentsResult.data) ? documentsResult.data : [];
    const totalChunks = chunksResult.data?.[0]?.total || 0;

    const stats: DocumentStats = {
      totalDocuments: documents.length,
      processedDocuments: documents.filter(d => d && d.processed).length,
      pendingDocuments: documents.filter(d => d && !d.processed).length,
      failedDocuments: documents.filter(d => d && d.error_message).length,
      totalChunks,
      avgChunksPerDocument: documents.length > 0 ? totalChunks / documents.length : 0,
      avgProcessingTime: documents.length > 0 
        ? documents.reduce((sum, d) => sum + ((d && d.processing_time) || 0), 0) / documents.length 
        : 0,
      totalStorage: documents.reduce((sum, d) => sum + ((d && d.file_size) || 0), 0),
    };

    // Cache stats
    await this.cache.setSearchResults(cacheKey, stats);

    return stats;
  }

  private async cleanupFailedUpload(documentId: string, fileName: string): Promise<void> {
    try {
      // Delete from database
      await this.dbPool.delete('documents', { id: documentId });
      
      // Delete from storage
      console.log(`🧹 Cleaning up failed upload: ${fileName}`);
      
      // Remove from cache
      await this.cache.invalidateDocument(documentId);
      
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      const dbHealthy = await this.dbPool.healthCheck();
      if (!dbHealthy) return false;

      // Test cache connection
      const cacheHealthy = await this.cache.healthCheck();
      if (!cacheHealthy) return false;

      // Test a simple query
      const { error } = await this.dbPool.select('documents', 'id', {}, { limit: 1 });
      
      return !error;
    } catch (error) {
      console.error('Document service health check failed:', error);
      return false;
    }
  }
}

export default OptimizedDocumentService;