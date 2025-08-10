import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { supabase } from '@ux-nevesht/database';
import { DocumentProcessor } from '../services/documentProcessor';
import { CleanupService } from '../services/cleanupService';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const isMarkdown = file.mimetype === 'text/markdown' || lower.endsWith('.md');
    const isText = file.mimetype === 'text/plain' || lower.endsWith('.txt');
    if (isMarkdown || isText) {
      cb(null, true);
    } else {
      cb(new Error('Only Markdown (.md) or Text (.txt) files are allowed'));
    }
  },
});

const documentProcessor = new DocumentProcessor();
const cleanupService = new CleanupService();

// Upload document
router.post('/upload', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400);
    }

    const { originalname, buffer, size } = req.file;
    const content = buffer.toString('utf-8');
    const documentId = uuidv4();
    const fileName = `${documentId}-${originalname}`;

    // Upload file to Supabase Storage
    const lower = originalname.toLowerCase();
    const contentType = lower.endsWith('.txt') ? 'text/plain' : 'text/markdown';
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw createError('Failed to upload file to storage', 500, uploadError);
    }

    // Save document metadata to database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        title: originalname.replace(/\.(md|txt)$/i, ''),
        content,
        file_path: fileName,
        file_size: size,
        processed: false,
      })
      .select()
      .single();

    if (dbError) {
      throw createError('Failed to save document metadata', 500, dbError);
    }

    // Process document asynchronously
    documentProcessor.processDocument(documentId).catch(console.error);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        title: document.title,
        file_size: document.file_size,
        upload_date: document.upload_date,
        processed: document.processed,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all documents
router.get('/', async (req, res, next) => {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, title, file_size, upload_date, processed, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw createError('Failed to fetch documents', 500, error);
    }

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// Get document by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      throw createError('Document not found', 404);
    }

    res.json({ document });
  } catch (error) {
    next(error);
  }
});

// Delete document
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get document info first
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      throw createError('Document not found', 404);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([document.file_path]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
    }

    // Delete from database (cascades to chunks)
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw createError('Failed to delete document', 500, dbError);
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Reprocess document
router.post('/:id/reprocess', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if document exists
    const { data: document, error } = await supabase
      .from('documents')
      .select('id, title')
      .eq('id', id)
      .single();

    if (error || !document) {
      throw createError('Document not found', 404);
    }

    console.log(`Starting reprocessing for document: ${document.title} (${id})`);

    // Mark as unprocessed and reprocess
    await supabase
      .from('documents')
      .update({ processed: false })
      .eq('id', id);

    // Delete existing chunks
    const { error: deleteError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', id);

    if (deleteError) {
      console.warn(`Failed to delete existing chunks for ${id}:`, deleteError);
    }

    // Process document with enhanced error handling
    documentProcessor.processDocument(id)
      .then(() => {
        console.log(`✅ Successfully reprocessed document: ${document.title}`);
      })
      .catch((error) => {
        console.error(`❌ Failed to reprocess document ${document.title}:`, error);
      });

    res.json({ 
      message: 'Document reprocessing started',
      document: {
        id,
        title: document.title
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get document processing status
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get document info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, processed, upload_date')
      .eq('id', id)
      .single();

    if (docError || !document) {
      throw createError('Document not found', 404);
    }

    // Get chunk count
    const { count: chunkCount, error: countError } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', id);

    if (countError) {
      console.warn('Failed to count chunks:', countError);
    }

    res.json({
      document: {
        ...document,
        chunk_count: chunkCount || 0,
        status: document.processed ? 'completed' : 'processing'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Cleanup invalid chunks
router.post('/cleanup/chunks', async (req, res, next) => {
  try {
    console.log('Starting chunk cleanup process...');
    const result = await cleanupService.cleanupInvalidChunks();
    
    res.json({
      message: 'Chunk cleanup completed',
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// Get chunk quality statistics
router.get('/cleanup/stats', async (req, res, next) => {
  try {
    const stats = await cleanupService.getChunkQualityStats();
    
    res.json({
      message: 'Chunk quality statistics',
      stats,
    });
  } catch (error) {
    next(error);
  }
});

// Cleanup orphaned chunks
router.post('/cleanup/orphaned', async (req, res, next) => {
  try {
    const removedCount = await cleanupService.cleanupOrphanedChunks();
    
    res.json({
      message: 'Orphaned chunk cleanup completed',
      removedChunks: removedCount,
    });
  } catch (error) {
    next(error);
  }
});

export { router as documentsRouter }; 