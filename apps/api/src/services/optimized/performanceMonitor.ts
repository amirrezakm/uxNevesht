import { performance, PerformanceObserver } from 'perf_hooks';
import os from 'os';
import process from 'process';

export interface PerformanceMetrics {
  // Request metrics
  totalRequests: number;
  avgResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  
  // System metrics
  cpuUsage: number;
  memoryUsage: NodeJS.MemoryUsage;
  heapUsed: number;
  heapTotal: number;
  uptime: number;
  
  // Database metrics
  dbConnections: number;
  avgQueryTime: number;
  totalQueries: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  
  // Queue metrics
  queueLength: number;
  avgJobProcessingTime: number;
  
  // Performance timeline
  timestamp: Date;
}

export interface RequestMetric {
  path: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface ErrorMetric {
  message: string;
  stack?: string;
  path: string;
  method: string;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private requestMetrics: RequestMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private performanceObserver: PerformanceObserver | null = null;
  private isRunning: boolean = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  // Sliding window for calculations (last 5 minutes)
  private readonly WINDOW_SIZE = 5 * 60 * 1000; // 5 minutes in ms
  private readonly MAX_METRICS_HISTORY = 1000; // Keep last 1000 requests

  constructor() {
    this.metrics = this.initializeMetrics();
    this.setupPerformanceObserver();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      avgResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: process.memoryUsage(),
      heapUsed: 0,
      heapTotal: 0,
      uptime: process.uptime(),
      dbConnections: 0,
      avgQueryTime: 0,
      totalQueries: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      queueLength: 0,
      avgJobProcessingTime: 0,
      timestamp: new Date(),
    };
  }

  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          this.processPerformanceEntry(entry);
        }
      });

      // Observe different types of performance entries
      try {
        this.performanceObserver.observe({ 
          entryTypes: ['measure', 'mark', 'function', 'gc'] 
        });
      } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Some performance entry types not supported:', message);
        // Fallback to basic observation
        try {
          this.performanceObserver.observe({ entryTypes: ['measure'] });
        } catch (fallbackError) {
          console.warn('Performance observation not available');
        }
      }
    }
  }

  private processPerformanceEntry(entry: any): void {
    // Process different types of performance entries
    switch (entry.entryType) {
      case 'measure':
        if (entry.name.startsWith('http-request')) {
          // HTTP request measurement
          this.updateResponseTimeMetrics(entry.duration);
        } else if (entry.name.startsWith('db-query')) {
          // Database query measurement
          this.updateDatabaseMetrics(entry.duration);
        }
        break;
      
      case 'gc':
        // Garbage collection metrics
        console.log(`🗑️ GC: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
        break;
    }
  }

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Performance monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('📊 Starting performance monitor...');

    // Update metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.updateSystemMetrics();
      this.cleanupOldMetrics();
    }, 10000);

    console.log('✅ Performance monitor started');
  }

  stop(): void {
    this.isRunning = false;
    console.log('⏹️ Stopping performance monitor...');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    console.log('✅ Performance monitor stopped');
  }

  // Request tracking methods
  recordRequest(requestMetric: RequestMetric): void {
    this.requestMetrics.push(requestMetric);
    this.metrics.totalRequests++;
    
    // Update error rate
    if (requestMetric.statusCode >= 400) {
      this.updateErrorRate();
    }

    // Update response time
    this.updateResponseTimeMetrics(requestMetric.responseTime);
    
    // Maintain sliding window
    this.cleanupOldMetrics();
  }

  recordError(errorMetric: ErrorMetric): void {
    this.errorMetrics.push(errorMetric);
    this.updateErrorRate();
  }

  // Database metrics
  recordDatabaseQuery(queryTime: number): void {
    this.metrics.totalQueries++;
    this.updateDatabaseMetrics(queryTime);
  }

  updateDatabaseConnections(count: number): void {
    this.metrics.dbConnections = count;
  }

  // Cache metrics
  updateCacheMetrics(hitRate: number, size: number): void {
    this.metrics.cacheHitRate = hitRate;
    this.metrics.cacheSize = size;
  }

  // Queue metrics
  updateQueueMetrics(length: number, avgProcessingTime: number): void {
    this.metrics.queueLength = length;
    this.metrics.avgJobProcessingTime = avgProcessingTime;
  }

  private updateResponseTimeMetrics(responseTime: number): void {
    // Calculate moving average
    if (this.metrics.totalRequests === 1) {
      this.metrics.avgResponseTime = responseTime;
    } else {
      this.metrics.avgResponseTime = 
        (this.metrics.avgResponseTime + responseTime) / 2;
    }

    // Calculate requests per second (based on last 5 minutes)
    const recentRequests = this.getRecentRequests();
    const timeWindow = Math.min(this.WINDOW_SIZE, Date.now() - this.getOldestRequestTime());
    this.metrics.requestsPerSecond = recentRequests.length / (timeWindow / 1000);
  }

  private updateDatabaseMetrics(queryTime: number): void {
    // Calculate moving average for query time
    if (this.metrics.totalQueries === 1) {
      this.metrics.avgQueryTime = queryTime;
    } else {
      this.metrics.avgQueryTime = 
        (this.metrics.avgQueryTime + queryTime) / 2;
    }
  }

  private updateErrorRate(): void {
    const recentRequests = this.getRecentRequests();
    const recentErrors = this.getRecentErrors();
    
    this.metrics.errorRate = recentRequests.length > 0 
      ? (recentErrors.length / recentRequests.length) * 100 
      : 0;
  }

  private updateSystemMetrics(): void {
    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    this.metrics.cpuUsage = ((totalTick - totalIdle) / totalTick) * 100;

    // Memory usage
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.heapUsed = this.metrics.memoryUsage.heapUsed / 1024 / 1024; // MB
    this.metrics.heapTotal = this.metrics.memoryUsage.heapTotal / 1024 / 1024; // MB
    
    // Uptime
    this.metrics.uptime = process.uptime();
    
    // Update timestamp
    this.metrics.timestamp = new Date();
  }

  private getRecentRequests(): RequestMetric[] {
    const cutoff = Date.now() - this.WINDOW_SIZE;
    return this.requestMetrics.filter(req => req.timestamp.getTime() > cutoff);
  }

  private getRecentErrors(): ErrorMetric[] {
    const cutoff = Date.now() - this.WINDOW_SIZE;
    return this.errorMetrics.filter(err => err.timestamp.getTime() > cutoff);
  }

  private getOldestRequestTime(): number {
    if (this.requestMetrics.length === 0) return Date.now();
    return Math.min(...this.requestMetrics.map(req => req.timestamp.getTime()));
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.WINDOW_SIZE;
    
    // Keep only recent requests (sliding window)
    this.requestMetrics = this.requestMetrics
      .filter(req => req.timestamp.getTime() > cutoff)
      .slice(-this.MAX_METRICS_HISTORY); // Limit total size
    
    // Keep only recent errors
    this.errorMetrics = this.errorMetrics
      .filter(err => err.timestamp.getTime() > cutoff)
      .slice(-this.MAX_METRICS_HISTORY); // Limit total size
  }

  // Public API methods
  getMetrics(): PerformanceMetrics {
    // Update real-time metrics before returning
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  getDetailedMetrics(): {
    metrics: PerformanceMetrics;
    recentRequests: RequestMetric[];
    recentErrors: ErrorMetric[];
    systemInfo: any;
  } {
    return {
      metrics: this.getMetrics(),
      recentRequests: this.getRecentRequests().slice(-50), // Last 50 requests
      recentErrors: this.getRecentErrors().slice(-50), // Last 50 errors
      systemInfo: this.getSystemInfo(),
    };
  }

  getSystemInfo(): any {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem() / 1024 / 1024 / 1024, // GB
      freeMemory: os.freemem() / 1024 / 1024 / 1024, // GB
      loadAverage: os.loadavg(),
      cpuCount: os.cpus().length,
      uptime: os.uptime(),
      processId: process.pid,
    };
  }

  getHealthScore(): {
    score: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check response time
    if (this.metrics.avgResponseTime > 5000) {
      issues.push('High average response time');
      score -= 30;
    } else if (this.metrics.avgResponseTime > 2000) {
      issues.push('Elevated response time');
      score -= 15;
    }

    // Check error rate
    if (this.metrics.errorRate > 10) {
      issues.push('High error rate');
      score -= 25;
    } else if (this.metrics.errorRate > 5) {
      issues.push('Elevated error rate');
      score -= 10;
    }

    // Check memory usage
    const memoryUsagePercent = (this.metrics.heapUsed / this.metrics.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      issues.push('Critical memory usage');
      score -= 30;
    } else if (memoryUsagePercent > 80) {
      issues.push('High memory usage');
      score -= 15;
    }

    // Check CPU usage
    if (this.metrics.cpuUsage > 90) {
      issues.push('Critical CPU usage');
      score -= 25;
    } else if (this.metrics.cpuUsage > 70) {
      issues.push('High CPU usage');
      score -= 10;
    }

    // Check cache performance
    if (this.metrics.cacheHitRate < 50) {
      issues.push('Low cache hit rate');
      score -= 10;
    }

    // Determine status
    let status: 'excellent' | 'good' | 'warning' | 'critical';
    if (score >= 90) status = 'excellent';
    else if (score >= 70) status = 'good';
    else if (score >= 50) status = 'warning';
    else status = 'critical';

    return { score: Math.max(0, score), status, issues };
  }

  // Performance measurement helpers
  startMeasurement(name: string): void {
    performance.mark(`${name}-start`);
  }

  endMeasurement(name: string): number {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    return measure ? measure.duration : 0;
  }

  // Advanced analytics
  getRequestAnalytics(): {
    topPaths: Array<{ path: string; count: number; avgTime: number }>;
    slowestRequests: RequestMetric[];
    errorBreakdown: Array<{ statusCode: number; count: number }>;
  } {
    const recentRequests = this.getRecentRequests();
    
    // Top paths by frequency
    const pathCounts = new Map<string, { count: number; totalTime: number }>();
    recentRequests.forEach(req => {
      const key = `${req.method} ${req.path}`;
      const existing = pathCounts.get(key) || { count: 0, totalTime: 0 };
      pathCounts.set(key, {
        count: existing.count + 1,
        totalTime: existing.totalTime + req.responseTime,
      });
    });

    const topPaths = Array.from(pathCounts.entries())
      .map(([path, data]) => ({
        path,
        count: data.count,
        avgTime: data.totalTime / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Slowest requests
    const slowestRequests = recentRequests
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 10);

    // Error breakdown
    const errorCounts = new Map<number, number>();
    recentRequests.forEach(req => {
      if (req.statusCode >= 400) {
        errorCounts.set(req.statusCode, (errorCounts.get(req.statusCode) || 0) + 1);
      }
    });

    const errorBreakdown = Array.from(errorCounts.entries())
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => b.count - a.count);

    return { topPaths, slowestRequests, errorBreakdown };
  }

  // Export metrics for external monitoring systems
  exportMetricsForPrometheus(): string {
    const metrics = this.getMetrics();
    
    return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.totalRequests}

# HELP http_request_duration_seconds Average HTTP request duration
# TYPE http_request_duration_seconds gauge
http_request_duration_seconds ${metrics.avgResponseTime / 1000}

# HELP http_requests_per_second Current requests per second
# TYPE http_requests_per_second gauge
http_requests_per_second ${metrics.requestsPerSecond}

# HELP http_error_rate_percent Current error rate percentage
# TYPE http_error_rate_percent gauge
http_error_rate_percent ${metrics.errorRate}

# HELP nodejs_heap_size_used_bytes Process heap space used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${metrics.memoryUsage.heapUsed}

# HELP nodejs_heap_size_total_bytes Process heap space total
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes ${metrics.memoryUsage.heapTotal}

# HELP system_cpu_usage_percent System CPU usage percentage
# TYPE system_cpu_usage_percent gauge
system_cpu_usage_percent ${metrics.cpuUsage}

# HELP cache_hit_rate_percent Cache hit rate percentage
# TYPE cache_hit_rate_percent gauge
cache_hit_rate_percent ${metrics.cacheHitRate}

# HELP queue_length Current queue length
# TYPE queue_length gauge
queue_length ${metrics.queueLength}
    `.trim();
  }

  healthCheck(): boolean {
    const health = this.getHealthScore();
    return health.status !== 'critical';
  }
}

export default PerformanceMonitor;