import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Vectorization status endpoint
app.get('/api/vectorization-status', (req, res) => {
  res.json({
    status: 'improved',
    message: 'سیستم وکتورایز بهبود یافته است',
    improvements: [
      'Timeout برای API calls اضافه شد',
      'Retry logic پیاده‌سازی شد',
      'Progress tracking فعال شد',
      'Batch size بهینه شد',
      'ابزار تشخیص اسناد گیر کرده اضافه شد'
    ]
  });
});

// Basic routes
app.get('/api/documents', (req, res) => {
  res.json({ message: 'Documents endpoint is ready!' });
});

app.get('/api/chat', (req, res) => {
  res.json({ message: 'Chat endpoint is ready!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Vectorization status: http://localhost:${PORT}/api/vectorization-status`);
});