import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

export interface DatabaseConfig {
  maxConnections: number;
  idleTimeout: number;
  acquireTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface PoolConnection {
  client: SupabaseClient;
  id: string;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
  queryCount: number;
}

export interface DatabaseStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  poolUtilization: number;
  errors: number;
}

export class DatabasePool {
  private connections: Map<string, PoolConnection>;
  private available: string[];
  private waiting: Array<{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }>;
  private config: DatabaseConfig;
  private stats: DatabaseStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      maxConnections: 20, // Reasonable limit for Supabase
      idleTimeout: 300000, // 5 minutes
      acquireTimeout: 10000, // 10 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      ...config,
    };

    this.connections = new Map();
    this.available = [];
    this.waiting = [];
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalQueries: 0,
      avgQueryTime: 0,
      poolUtilization: 0,
      errors: 0,
    };
  }

  async initialize(): Promise<void> {
    console.log('🗄️ Initializing database pool...');
    
    try {
      // Create initial connections (25% of max)
      const initialConnections = Math.max(1, Math.floor(this.config.maxConnections * 0.25));
      
      for (let i = 0; i < initialConnections; i++) {
        await this.createConnection();
      }

      // Start cleanup interval
      this.startCleanupTask();
      
      console.log(`✅ Database pool initialized with ${initialConnections} connections`);
    } catch (error) {
      console.error('❌ Failed to initialize database pool:', error);
      throw error;
    }
  }

  private async createConnection(): Promise<PoolConnection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false, // Don't persist for server connections
          },
          db: {
            schema: 'public',
          },
          global: {
            headers: {
              'x-client-info': `ux-nevesht-pool/${connectionId}`,
            },
          },
          realtime: {
            params: {
              eventsPerSecond: 10, // Limit realtime events
            },
          },
        }
      );

      const connection: PoolConnection = {
        client,
        id: connectionId,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: false,
        queryCount: 0,
      };

      this.connections.set(connectionId, connection);
      this.available.push(connectionId);
      this.stats.totalConnections++;
      this.stats.idleConnections++;

      console.log(`➕ Created database connection: ${connectionId}`);
      return connection;

    } catch (error) {
      console.error(`❌ Failed to create database connection: ${error}`);
      this.stats.errors++;
      throw error;
    }
  }

  async acquireConnection(): Promise<PoolConnection> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeWaiting(resolve);
        reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeout}ms`));
      }, this.config.acquireTimeout);

      try {
        // Try to get available connection
        if (this.available.length > 0) {
          const connectionId = this.available.pop()!;
          const connection = this.connections.get(connectionId)!;
          
          connection.isActive = true;
          connection.lastUsed = new Date();
          
          this.stats.activeConnections++;
          this.stats.idleConnections--;
          this.updatePoolUtilization();
          
          clearTimeout(timeout);
          resolve(connection);
          return;
        }

        // Create new connection if under limit
        if (this.connections.size < this.config.maxConnections) {
          const connection = await this.createConnection();
          connection.isActive = true;
          
          // Remove from available since we're using it
          const index = this.available.indexOf(connection.id);
          if (index > -1) {
            this.available.splice(index, 1);
          }
          
          this.stats.activeConnections++;
          this.stats.idleConnections--;
          this.updatePoolUtilization();
          
          clearTimeout(timeout);
          resolve(connection);
          return;
        }

        // Wait for available connection
        this.waiting.push({ resolve, reject, timeout });
        
      } catch (error) {
        clearTimeout(timeout);
        this.stats.errors++;
        reject(error);
      }
    });
  }

  async releaseConnection(connection: PoolConnection): Promise<void> {
    try {
      if (!this.connections.has(connection.id)) {
        console.warn(`⚠️ Attempting to release unknown connection: ${connection.id}`);
        return;
      }

      connection.isActive = false;
      connection.lastUsed = new Date();

      // If there are waiting requests, give connection to them
      if (this.waiting.length > 0) {
        const waiter = this.waiting.shift()!;
        clearTimeout(waiter.timeout);
        
        connection.isActive = true;
        waiter.resolve(connection);
        return;
      }

      // Return to available pool
      this.available.push(connection.id);
      this.stats.activeConnections--;
      this.stats.idleConnections++;
      this.updatePoolUtilization();

    } catch (error) {
      console.error(`❌ Error releasing connection ${connection.id}:`, error);
      this.stats.errors++;
    }
  }

  private removeWaiting(resolve: Function): void {
    const index = this.waiting.findIndex(w => w.resolve === resolve);
    if (index > -1) {
      const waiter = this.waiting.splice(index, 1)[0];
      clearTimeout(waiter.timeout);
    }
  }

  // High-level query methods with automatic connection management
  async query<T = any>(
    query: string,
    params?: any[],
    retries: number = this.config.retryAttempts
  ): Promise<T> {
    const startTime = performance.now();
    let connection: PoolConnection | null = null;

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      // Execute query based on type
      let result;
      if (query.startsWith('SELECT') || query.startsWith('select')) {
        const { data, error } = await connection.client.rpc('execute_sql', {
          sql: query,
          params: params || [],
        });
        if (error) throw error;
        result = data;
      } else {
        // For other operations, we need to use appropriate Supabase methods
        // This is a simplified approach - in practice, you'd have specific methods
        throw new Error('Complex queries should use specific repository methods');
      }

      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);

      return result;

    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);
      this.stats.errors++;

      console.error(`❌ Query failed: ${error}`);

      // Retry logic
      if (retries > 0 && this.shouldRetry(error)) {
        console.log(`🔄 Retrying query (${retries} attempts left)...`);
        await this.delay(this.config.retryDelay);
        return this.query(query, params, retries - 1);
      }

      throw error;

    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  // Supabase-specific optimized methods
  async select<T = any>(
    tableName: string,
    columns: string = '*',
    filters?: Record<string, any>,
    options?: { limit?: number; offset?: number; orderBy?: string; ascending?: boolean }
  ): Promise<{ data: T[] | null; count?: number; error: any }> {
    let connection: PoolConnection | null = null;
    const startTime = performance.now();

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      let query = connection.client.from(tableName).select(columns, { count: 'exact' });

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply options
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      const result = await query;
      
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);

      // Ensure we always return a consistent structure
      return {
        data: result.data || null,
        count: result.count || undefined,
        error: result.error || null,
      };

    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);
      this.stats.errors++;
      
      return {
        data: null,
        count: undefined,
        error: error instanceof Error ? error : new Error(String(error)),
      };

    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  async insert<T = any>(
    tableName: string,
    data: any | any[],
    options?: { onConflict?: string; returning?: string }
  ): Promise<{ data: T[] | null; error: any }> {
    let connection: PoolConnection | null = null;
    const startTime = performance.now();

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      let query = connection.client.from(tableName).insert(data);

      if (options?.returning) {
        query = query.select(options.returning);
      }

      if (options?.onConflict) {
        query = query.upsert(data);
      }

      const result = await query;
      
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);

      // Ensure consistent structure
      return {
        data: result.data || null,
        error: result.error || null,
      };

    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);
      this.stats.errors++;
      
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };

    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  async update<T = any>(
    tableName: string,
    data: any,
    filters: Record<string, any>,
    returning?: string
  ): Promise<{ data: T[] | null; error: any }> {
    let connection: PoolConnection | null = null;
    const startTime = performance.now();

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      let query = connection.client.from(tableName).update(data);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      if (returning) {
        query = query.select(returning);
      }

      const result = await query;
      
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);

      // Ensure consistent structure
      return {
        data: result.data || null,
        error: result.error || null,
      };

    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);
      this.stats.errors++;
      
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };

    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  async delete<T = any>(
    tableName: string,
    filters: Record<string, any>,
    returning?: string
  ): Promise<{ data: T[] | null; error: any }> {
    let connection: PoolConnection | null = null;
    const startTime = performance.now();

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      let query = connection.client.from(tableName).delete();

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      if (returning) {
        query = query.select(returning);
      }

      const result = await query;
      
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);

      // Ensure consistent structure
      return {
        data: result.data || null,
        error: result.error || null,
      };

    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);
      this.stats.errors++;
      
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };

    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  // Vector search optimized method
  async vectorSearch(
    queryEmbedding: number[],
    options?: {
      tableName?: string;
      similarityThreshold?: number;
      matchCount?: number;
      filters?: Record<string, any>;
    }
  ): Promise<{ data: any[] | null; error: any }> {
    let connection: PoolConnection | null = null;
    const startTime = performance.now();

    try {
      connection = await this.acquireConnection();
      connection.queryCount++;

      const result = await connection.client.rpc('search_chunks', {
        query_embedding: queryEmbedding,
        similarity_threshold: options?.similarityThreshold || 0.3,
        match_count: options?.matchCount || 8,
        ...(options?.filters || {}),
      });

      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);

      // Ensure consistent structure
      return {
        data: result.data || null,
        error: result.error || null,
      };

    } catch (error) {
      const queryTime = performance.now() - startTime;
      this.updateQueryStats(queryTime);
      this.stats.errors++;
      
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };

    } finally {
      if (connection) {
        await this.releaseConnection(connection);
      }
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on connection errors, timeouts, but not on data errors
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Connection terminated',
      'server closed the connection unexpectedly',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(retryable => 
      errorMessage.includes(retryable.toLowerCase())
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateQueryStats(queryTime: number): void {
    this.stats.totalQueries++;
    this.stats.avgQueryTime = this.stats.totalQueries > 1
      ? (this.stats.avgQueryTime + queryTime) / 2
      : queryTime;
  }

  private updatePoolUtilization(): void {
    this.stats.poolUtilization = this.connections.size > 0
      ? (this.stats.activeConnections / this.connections.size) * 100
      : 0;
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run every minute
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = new Date();
    const connectionsToRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      if (!connection.isActive && 
          (now.getTime() - connection.lastUsed.getTime()) > this.config.idleTimeout) {
        connectionsToRemove.push(id);
      }
    }

    for (const id of connectionsToRemove) {
      await this.removeConnection(id);
    }

    if (connectionsToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${connectionsToRemove.length} idle connections`);
    }
  }

  private async removeConnection(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // Remove from available list
      const availableIndex = this.available.indexOf(connectionId);
      if (availableIndex > -1) {
        this.available.splice(availableIndex, 1);
        this.stats.idleConnections--;
      }

      // Remove from connections map
      this.connections.delete(connectionId);
      this.stats.totalConnections--;
      
      this.updatePoolUtilization();

      console.log(`➖ Removed idle connection: ${connectionId}`);

    } catch (error) {
      console.error(`❌ Error removing connection ${connectionId}:`, error);
    }
  }

  getStats(): DatabaseStats {
    return { ...this.stats };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const connection = await this.acquireConnection();
      
      // Simple health check query
      const { error } = await connection.client.from('documents').select('id').limit(1);
      
      await this.releaseConnection(connection);
      
      return !error;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    console.log('🔌 Closing database pool...');

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiting requests
    for (const waiter of this.waiting) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Database pool is closing'));
    }
    this.waiting = [];

    // Close all connections
    for (const [id, connection] of this.connections) {
      try {
        // Supabase clients don't have explicit close method
        // but we can clear the connection
        console.log(`🔌 Closing connection: ${id}`);
      } catch (error) {
        console.error(`Error closing connection ${id}:`, error);
      }
    }

    this.connections.clear();
    this.available = [];

    console.log('✅ Database pool closed');
  }
}

export default DatabasePool;