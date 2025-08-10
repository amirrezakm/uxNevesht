import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // requests per window

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  // Clean up old entries
  for (const [key, value] of Object.entries(store)) {
    if (value.resetTime < now) {
      delete store[key];
    }
  }
  
  // Get or create client entry
  if (!store[clientId]) {
    store[clientId] = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
  }
  
  const clientStore = store[clientId];
  
  // Reset if window has passed
  if (clientStore.resetTime < now) {
    clientStore.count = 0;
    clientStore.resetTime = now + WINDOW_MS;
  }
  
  // Check if limit exceeded
  if (clientStore.count >= MAX_REQUESTS) {
    const remainingTime = Math.ceil((clientStore.resetTime - now) / 1000);
    
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: remainingTime,
    });
    return;
  }
  
  // Increment counter
  clientStore.count++;
  
  // Add headers
  res.set({
    'X-RateLimit-Limit': MAX_REQUESTS.toString(),
    'X-RateLimit-Remaining': (MAX_REQUESTS - clientStore.count).toString(),
    'X-RateLimit-Reset': Math.ceil(clientStore.resetTime / 1000).toString(),
  });
  
  next();
}; 