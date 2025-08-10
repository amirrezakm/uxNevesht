import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { PerformanceMonitor } from '../../services/optimized/performanceMonitor';

export function performanceMiddleware(monitor: PerformanceMonitor) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now();
    const startMark = `request-${Date.now()}-${Math.random()}`;
    
    // Start performance measurement
    performance.mark(`${startMark}-start`);
    monitor.startMeasurement(`http-request-${req.method}-${req.path}`);

    // Track request details
    const requestInfo = {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: req.get('Content-Length'),
      timestamp: new Date(),
    };

    // Override res.end to capture response metrics
    const originalEnd = res.end;
    const originalSend = res.send;
    const originalJson = res.json;

    let responseSize = 0;
    let responseSent = false;

    // Capture response data
    const captureResponse = () => {
      if (responseSent) return;
      responseSent = true;

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // End performance measurement
      performance.mark(`${startMark}-end`);
      performance.measure(`http-request`, `${startMark}-start`, `${startMark}-end`);
      monitor.endMeasurement(`http-request-${req.method}-${req.path}`);

      // Record request metrics
      monitor.recordRequest({
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        timestamp: requestInfo.timestamp,
        userAgent: requestInfo.userAgent,
        ip: requestInfo.ip,
      });

      // Record error if status >= 400
      if (res.statusCode >= 400) {
        monitor.recordError({
          message: `HTTP ${res.statusCode} - ${req.method} ${req.path}`,
          path: req.path,
          method: req.method,
          timestamp: new Date(),
          userAgent: requestInfo.userAgent,
          ip: requestInfo.ip,
        });
      }

      // Add performance headers
      res.setHeader('X-Response-Time', `${Math.round(responseTime)}ms`);
      res.setHeader('X-Process-ID', process.pid.toString());
      res.setHeader('X-Timestamp', Date.now().toString());

      // Optional: Add cache headers for certain routes
      if (req.method === 'GET' && !req.path.includes('/health')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      }

      // Clean up performance marks
      try {
        performance.clearMarks(`${startMark}-start`);
        performance.clearMarks(`${startMark}-end`);
        performance.clearMeasures(`http-request`);
      } catch (error) {
        // Ignore cleanup errors
      }
    };

    // Override response methods
    res.end = function(chunk?: any, encoding?: any) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      }
      captureResponse();
      return originalEnd.call(this, chunk, encoding);
    };

    res.send = function(data?: any) {
      if (data) {
        responseSize += Buffer.isBuffer(data) ? data.length : Buffer.byteLength(String(data));
      }
      captureResponse();
      return originalSend.call(this, data);
    };

    res.json = function(data?: any) {
      if (data) {
        const jsonString = JSON.stringify(data);
        responseSize += Buffer.byteLength(jsonString);
      }
      captureResponse();
      return originalJson.call(this, data);
    };

    next();
  };
}

export default performanceMiddleware;