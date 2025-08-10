import { Router } from 'express';
import { supabase } from '@ux-nevesht/database';

const router = Router();

router.get('/', async (req, res) => {
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
      database: dbError ? 'disconnected' : 'connected',
      environment: process.env.NODE_ENV || 'development',
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

export { router as healthRouter }; 