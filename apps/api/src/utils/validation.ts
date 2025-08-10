import { z } from 'zod';

// Environment validation
export const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(20, 'SUPABASE_ANON_KEY seems too short'),
  OPENAI_API_KEY: z.string().min(20, 'OPENAI_API_KEY seems too short'),
  OPENROUTER_API_KEY: z.string().min(20, 'OPENROUTER_API_KEY seems too short'),
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

// Document validation
export const documentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(10),
  file_path: z.string().min(1),
  file_size: z.number().positive(),
  processed: z.boolean().default(false),
});

// Chunk validation
export const chunkSchema = z.object({
  document_id: z.string().uuid(),
  content: z.string().min(20),
  embedding: z.array(z.number()).length(1536),
  chunk_index: z.number().nonnegative(),
  token_count: z.number().positive(),
});

// Chat request validation
export const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.string().optional(),
  tone: z.enum(['friendly', 'professional', 'casual']).optional(),
  model: z.string().optional(),
});

// UX Copy request validation
export const uxCopyRequestSchema = z.object({
  context: z.string().min(1).max(500),
  elementType: z.enum([
    'button', 'error', 'success', 'tooltip', 
    'placeholder', 'title', 'description', 'navigation'
  ]),
  audience: z.enum(['user', 'driver', 'vendor', 'admin']),
  tone: z.enum(['friendly', 'professional', 'urgent', 'encouraging']),
});

// File upload validation
export const fileUploadSchema = z.object({
  originalname: z.string().min(1),
  mimetype: z.enum(['text/markdown', 'text/plain']),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  buffer: z.instanceof(Buffer),
});

// Vector search options validation
export const vectorSearchSchema = z.object({
  similarityThreshold: z.number().min(0).max(1).default(0.3),
  maxChunks: z.number().min(1).max(20).default(6),
  diversityBoost: z.boolean().default(false),
  temporalBoost: z.boolean().default(false),
  rerank: z.boolean().default(false),
});

// Validate environment variables
export function validateEnvironment() {
  try {
    const env = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid environment configuration');
  }
}

// Validate API keys format (basic check)
export function validateApiKeys() {
  const errors: string[] = [];

  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('supabase.co') && !supabaseUrl.includes('localhost')) {
    errors.push('SUPABASE_URL should be a valid Supabase URL');
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && !openaiKey.startsWith('sk-')) {
    errors.push('OPENAI_API_KEY should start with "sk-"');
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey && !openrouterKey.startsWith('sk-')) {
    errors.push('OPENROUTER_API_KEY should start with "sk-"');
  }

  if (errors.length > 0) {
    console.warn('⚠️ API Key format warnings:');
    errors.forEach(error => console.warn(`  - ${error}`));
  }

  return errors.length === 0;
}

// Validate text content for embedding
export function validateTextForEmbedding(text: string): {
  isValid: boolean;
  reason?: string;
} {
  if (!text || text.trim().length === 0) {
    return { isValid: false, reason: 'Text is empty' };
  }

  if (text.length < 10) {
    return { isValid: false, reason: 'Text too short (minimum 10 characters)' };
  }

  if (text.length > 8000) {
    return { isValid: false, reason: 'Text too long (maximum 8000 characters)' };
  }

  // Check for valid content (not just symbols)
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < 3) {
    return { isValid: false, reason: 'Text must contain at least 3 words' };
  }

  return { isValid: true };
}

// Validate document content
export function validateDocumentContent(content: string): {
  isValid: boolean;
  warnings: string[];
  stats: {
    characters: number;
    words: number;
    lines: number;
  };
} {
  const warnings: string[] = [];
  const stats = {
    characters: content.length,
    words: content.trim().split(/\s+/).length,
    lines: content.split('\n').length,
  };

  if (stats.characters < 100) {
    warnings.push('Document is very short, may not provide useful context');
  }

  if (stats.words < 20) {
    warnings.push('Document contains very few words');
  }

  if (stats.characters > 1000000) { // 1MB
    warnings.push('Document is very large, processing may be slow');
  }

  // Check for valid text content
  const nonWhitespaceContent = content.replace(/\s/g, '');
  if (nonWhitespaceContent.length < content.length * 0.1) {
    warnings.push('Document contains mostly whitespace');
  }

  return {
    isValid: warnings.length === 0 || stats.words >= 10,
    warnings,
    stats,
  };
}

// Utility to sanitize user input
export function sanitizeUserInput(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 10000); // Limit length
}

// Validate embedding vector
export function validateEmbedding(embedding: number[]): {
  isValid: boolean;
  reason?: string;
} {
  if (!Array.isArray(embedding)) {
    return { isValid: false, reason: 'Embedding must be an array' };
  }

  if (embedding.length !== 1536) {
    return { isValid: false, reason: `Embedding must have 1536 dimensions, got ${embedding.length}` };
  }

  if (!embedding.every(n => typeof n === 'number' && !isNaN(n))) {
    return { isValid: false, reason: 'Embedding must contain only valid numbers' };
  }

  // Check for zero vector (might indicate empty embedding)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude < 0.001) {
    return { isValid: false, reason: 'Embedding appears to be zero vector' };
  }

  return { isValid: true };
}
