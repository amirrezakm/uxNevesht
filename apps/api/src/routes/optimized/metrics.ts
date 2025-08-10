import { Router } from 'express';
import { PerformanceMonitor } from '../../services/optimized/performanceMonitor';

export function metricsRouter(monitor: PerformanceMonitor): Router {
  const router = Router();

  // Basic metrics endpoint
  router.get('/', async (req, res) => {
    try {
      const metrics = monitor.getMetrics();
      const health = monitor.getHealthScore();

      res.json({
        success: true,
        metrics: {
          ...metrics,
          health_score: health.score,
          health_status: health.status,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Detailed metrics with analytics
  router.get('/detailed', async (req, res) => {
    try {
      const detailed = monitor.getDetailedMetrics();
      const analytics = monitor.getRequestAnalytics();

      res.json({
        success: true,
        ...detailed,
        analytics,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch detailed metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Prometheus format for external monitoring
  router.get('/prometheus', async (req, res) => {
    try {
      const prometheusMetrics = monitor.exportMetricsForPrometheus();
      
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusMetrics);

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to export Prometheus metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Health check endpoint
  router.get('/health', async (req, res) => {
    try {
      const health = monitor.getHealthScore();
      const isHealthy = monitor.healthCheck();

      const statusCode = health.status === 'critical' ? 503 : 200;

      res.status(statusCode).json({
        success: isHealthy,
        status: health.status,
        score: health.score,
        issues: health.issues,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}

export { metricsRouter };