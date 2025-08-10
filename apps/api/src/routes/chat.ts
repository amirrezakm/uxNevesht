import { Router } from 'express';
import { z } from 'zod';
import { LLMService, PromptBuilder } from '@ux-nevesht/ai';
import { RAGService } from '../services/ragService';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Initialize services
const ragService = new RAGService();

const openrouterApiKey = process.env.OPENROUTER_API_KEY;
if (!openrouterApiKey) {
  throw new Error('OPENROUTER_API_KEY environment variable is required');
}

const llmService = new LLMService(openrouterApiKey);

// Validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.string().optional(),
  tone: z.enum(['friendly', 'professional', 'casual']).optional(),
  model: z.string().optional(),
});

const uxCopyRequestSchema = z.object({
  context: z.string().min(1).max(500),
  elementType: z.enum(['button', 'error', 'success', 'tooltip', 'placeholder', 'title', 'description', 'navigation']),
  audience: z.enum(['user', 'driver', 'vendor', 'admin']),
  tone: z.enum(['friendly', 'professional', 'urgent', 'encouraging']),
});

// Chat endpoint for general UX writing questions
router.post('/', async (req, res, next) => {
  try {
    const { message, context, tone, model } = chatRequestSchema.parse(req.body);

    // Get relevant context from documents (with fallback for short messages)
    let chunks, contextText, sources, qualityScore;
    try {
      const result = await ragService.getRelevantContext(message);
      chunks = result.chunks;
      contextText = result.contextText;
      sources = result.sources;
      qualityScore = result.qualityScore;
    } catch (error) {
      console.warn('RAG search failed, proceeding without context:', error?.message);
      chunks = [];
      contextText = '';
      sources = [];
      qualityScore = 0;
    }

    // Build prompts
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt({
      userQuery: message,
      relevantChunks: chunks.map(c => c.content),
      uiContext: context,
      brandTone: tone,
    });

    // Generate response
    const response = await llmService.generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { model });

    // Try to parse and enhance the response
    let enhancedResponse;
    try {
      // First check if response contains JSON wrapped in markdown
      let cleanResponse = response;
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1];
      }
      
      const parsedResponse = JSON.parse(cleanResponse);
      enhancedResponse = {
        ...parsedResponse,
        meta: {
          chunks_used: chunks.length,
          sources,
          quality_score: qualityScore,
          has_relevant_context: qualityScore > 0.4,
          generated_at: new Date().toISOString()
        }
      };
    } catch {
      // If not JSON, wrap in enhanced structure
      enhancedResponse = {
        options: [
          {
            text: response,
            tone: tone || 'دوستانه',
            length: response.length < 50 ? 'کوتاه' : 'متوسط',
            context: 'پاسخ متنی',
            emotion: 'خنثی'
          }
        ],
        insights: 'پاسخ بر اساس پرسش شما تولید شده',
        meta: {
          chunks_used: chunks.length,
          sources,
          quality_score: qualityScore,
          has_relevant_context: qualityScore > 0.4,
          generated_at: new Date().toISOString()
        }
      };
    }

    res.json(enhancedResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createError('Invalid request data', 400, error.errors));
    } else {
      next(error);
    }
  }
});

// Stream endpoint for real-time chat
router.post('/stream', async (req, res, next) => {
  try {
    const { message, context, tone, model } = chatRequestSchema.parse(req.body);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Get relevant context (with fallback)
    let chunks, contextText, sources, qualityScore;
    try {
      const result = await ragService.getRelevantContext(message);
      chunks = result.chunks;
      contextText = result.contextText;
      sources = result.sources;
      qualityScore = result.qualityScore;
    } catch (error) {
      console.warn('RAG search failed in stream, proceeding without context:', error?.message);
      chunks = [];
      contextText = '';
      sources = [];
      qualityScore = 0;
    }

    // Send context information first
    res.write(`data: ${JSON.stringify({
      type: 'context',
      chunks_used: chunks.length,
      sources,
      quality_score: qualityScore,
      has_relevant_context: qualityScore > 0.4,
    })}\n\n`);

    // Build prompts
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildUserPrompt({
      userQuery: message,
      relevantChunks: chunks.map(c => c.content),
      uiContext: context,
      brandTone: tone,
    });

    // Stream response
    const stream = await llmService.generateStreamResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { model });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({
        type: 'content',
        content: chunk,
      })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Invalid request data',
      })}\n\n`);
    } else {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: errorMessage,
      })}\n\n`);
    }
    res.end();
  }
});

// Specific UX copy generation endpoint
router.post('/generate-copy', async (req, res, next) => {
  try {
    const request = uxCopyRequestSchema.parse(req.body);

    // Get relevant context for this type of copy (with fallback)
    const contextQuery = `${request.elementType} ${request.context} ${request.audience}`;
    let chunks, sources, qualityScore;
    try {
      const result = await ragService.getRelevantContext(contextQuery);
      chunks = result.chunks;
      sources = result.sources;
      qualityScore = result.qualityScore;
    } catch (error) {
      console.warn('RAG search failed in generate-copy, proceeding without context:', error?.message);
      chunks = [];
      sources = [];
      qualityScore = 0;
    }

    // Build specific UX prompt
    const systemPrompt = PromptBuilder.buildSystemPrompt();
    const userPrompt = PromptBuilder.buildSpecificUXPrompt(request);

    // Add relevant guidelines if found
    let finalPrompt = userPrompt;
    if (chunks.length > 0) {
      finalPrompt += '\n\nراهنماهای مرتبط:\n' + 
        chunks.map(c => c.content).join('\n\n');
    }

    // Generate response
    const response = await llmService.generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: finalPrompt },
    ], {
      temperature: 0.7,
      maxTokens: 800,
    });

    // Parse and enhance the response
    let enhancedResponse;
    try {
      // First check if response contains JSON wrapped in markdown
      let cleanResponse = response;
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1];
      }
      
      const parsedResponse = JSON.parse(cleanResponse);
      enhancedResponse = {
        ...parsedResponse,
        project_info: {
          element_type: request.elementType,
          target_audience: request.audience,
          requested_tone: request.tone,
          scenario: request.context
        },
        meta: {
          sources,
          chunks_used: chunks.length,
          quality_score: qualityScore,
          has_relevant_context: qualityScore > 0.4,
          generated_at: new Date().toISOString()
        }
      };
    } catch {
      // If not JSON, wrap in enhanced structure
      enhancedResponse = {
        options: [
          {
            text: response,
            tone: request.tone,
            length: response.length < 30 ? 'کوتاه' : 'متوسط',
            context: `متن ${request.elementType} برای ${request.audience}`,
            emotion: request.tone === 'encouraging' ? 'مثبت' : 'خنثی'
          }
        ],
        insights: `متن برای ${request.elementType} با لحن ${request.tone} تولید شده`,
        project_info: {
          element_type: request.elementType,
          target_audience: request.audience,
          requested_tone: request.tone,
          scenario: request.context
        },
        meta: {
          sources,
          chunks_used: chunks.length,
          quality_score: qualityScore,
          has_relevant_context: qualityScore > 0.4,
          generated_at: new Date().toISOString()
        }
      };
    }

    res.json(enhancedResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(createError('Invalid request data', 400, error.errors));
    } else {
      next(error);
    }
  }
});

// Get common UX templates
router.get('/templates', (req, res) => {
  const templates = PromptBuilder.getCommonTemplates();
  res.json({ templates });
});

// Get RAG statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await ragService.getDocumentStats();
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

export { router as chatRouter }; 