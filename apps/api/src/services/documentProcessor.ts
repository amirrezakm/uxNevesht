import { supabase } from '@ux-nevesht/database';
import { TextChunker, EmbeddingsService } from '@ux-nevesht/ai';

export class DocumentProcessor {
  private chunker: TextChunker;
  private embeddings: EmbeddingsService;

  constructor() {
    this.chunker = new TextChunker(400, 40); // Smaller chunks for better memory management
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.embeddings = new EmbeddingsService(openaiApiKey);
  }

  async processDocument(documentId: string): Promise<void> {
    try {
      console.log(`Processing document ${documentId}...`);

      // Get document content
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .single();

      if (fetchError || !document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Chunk the document
      const chunks = this.chunker.chunkText(document.content);
      console.log(`Created ${chunks.length} chunks for document ${documentId}`);

      if (chunks.length === 0) {
        console.warn(`No valid chunks created for document ${documentId}`);
        await supabase
          .from('documents')
          .update({ processed: true })
          .eq('id', documentId);
        return;
      }

      // Generate embeddings for all chunks with progress tracking
      const texts = chunks.map(chunk => chunk.content);
      console.log(`Generating embeddings for ${texts.length} chunks...`);
      
      // Process embeddings with memory cleanup between batches
      const embeddings = await this.embeddings.generateEmbeddings(texts, (current: number, total: number) => {
        const progress = Math.round((current / total) * 100);
        console.log(`Embedding progress: ${current}/${total} (${progress}%)`);
        
        // Force garbage collection periodically for large files
        if (current % 20 === 0 && global.gc) {
          global.gc();
        }
      });

      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
      }

      // Prepare chunks for insertion with validation
      const chunksToInsert = chunks
        .map((chunk, index) => ({
          document_id: documentId,
          content: chunk.content,
          embedding: embeddings[index],
          chunk_index: chunk.index,
          token_count: chunk.tokenCount,
        }))
        .filter(chunk => this.validateChunkForInsertion(chunk));

      // Insert chunks in smaller batches to avoid large single queries and memory issues
      const batchSize = 5;
      console.log(`Inserting ${chunksToInsert.length} chunks in batches of ${batchSize}...`);
      
      for (let i = 0; i < chunksToInsert.length; i += batchSize) {
        const batch = chunksToInsert.slice(i, i + batchSize);
        
        try {
          const { error: insertError } = await supabase
            .from('document_chunks')
            .insert(batch);

          if (insertError) {
            throw new Error(`Failed to insert chunk batch: ${insertError.message}`);
          }
          
          console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunksToInsert.length/batchSize)}`);
          
          // Add delay between batches to prevent database overload
          if (i + batchSize < chunksToInsert.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Error inserting batch ${i}-${i + batch.length}:`, error);
          throw error;
        }
      }

      // Mark document as processed
      const { error: updateError } = await supabase
        .from('documents')
        .update({ processed: true })
        .eq('id', documentId);

      if (updateError) {
        throw new Error(`Failed to mark document as processed: ${updateError.message}`);
      }

      console.log(`Successfully processed document ${documentId} with ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      
      // Mark document as failed
      await supabase
        .from('documents')
        .update({ processed: false })
        .eq('id', documentId);
      
      throw error;
    }
  }

  async reprocessAllDocuments(): Promise<void> {
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id')
        .eq('processed', false);

      if (error) {
        throw new Error(`Failed to fetch unprocessed documents: ${error.message}`);
      }

      console.log(`Found ${documents.length} unprocessed documents`);

      for (const doc of documents) {
        try {
          await this.processDocument(doc.id);
        } catch (error) {
          console.error(`Failed to process document ${doc.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in bulk reprocessing:', error);
      throw error;
    }
  }

  // Check for documents that might be stuck in processing
  async getStuckDocuments(): Promise<any[]> {
    try {
      // Find documents uploaded more than 10 minutes ago but not processed
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data: stuckDocs, error } = await supabase
        .from('documents')
        .select('id, title, upload_date, processed')
        .eq('processed', false)
        .lt('upload_date', tenMinutesAgo);

      if (error) {
        throw new Error(`Failed to fetch stuck documents: ${error.message}`);
      }

      return stuckDocs || [];
    } catch (error) {
      console.error('Error checking for stuck documents:', error);
      return [];
    }
  }

  // Reset stuck documents for reprocessing
  async resetStuckDocuments(): Promise<void> {
    try {
      const stuckDocs = await this.getStuckDocuments();
      
      if (stuckDocs.length === 0) {
        console.log('No stuck documents found');
        return;
      }

      console.log(`Found ${stuckDocs.length} stuck documents, resetting...`);

      for (const doc of stuckDocs) {
        // Clear existing chunks first
        await supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', doc.id);
        
        // Reset processed status
        await supabase
          .from('documents')
          .update({ processed: false })
          .eq('id', doc.id);
        
        console.log(`Reset document ${doc.id}: ${doc.title}`);
      }
    } catch (error) {
      console.error('Error resetting stuck documents:', error);
      throw error;
    }
  }

  // Validate chunk before insertion
  private validateChunkForInsertion(chunk: any): boolean {
    // Check content
    if (!chunk.content || chunk.content.trim().length < 20) {
      console.warn('Skipping chunk with insufficient content');
      return false;
    }

    // Check embedding
    if (!chunk.embedding || !Array.isArray(chunk.embedding) || chunk.embedding.length !== 1536) {
      console.warn('Skipping chunk with invalid embedding');
      return false;
    }

    // Check for NaN or infinite values in embedding
    if (chunk.embedding.some((val: number) => !isFinite(val))) {
      console.warn('Skipping chunk with invalid embedding values');
      return false;
    }

    // Check token count
    if (!chunk.token_count || chunk.token_count < 5 || chunk.token_count > 2000) {
      console.warn('Skipping chunk with invalid token count');
      return false;
    }

    return true;
  }

  dispose(): void {
    this.chunker.dispose();
  }
} 