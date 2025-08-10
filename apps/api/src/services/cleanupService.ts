import { supabase } from '@ux-nevesht/database';

export class CleanupService {
  
  // Clean up invalid chunks from the database
  async cleanupInvalidChunks(): Promise<{
    removedChunks: number;
    totalChunks: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let removedChunks = 0;
    let totalChunks = 0;

    try {
      // Get all chunks
      const { data: chunks, error: fetchError } = await supabase
        .from('document_chunks')
        .select('id, content, embedding, token_count');

      if (fetchError) {
        throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
      }

      totalChunks = chunks?.length || 0;
      console.log(`Found ${totalChunks} chunks to validate`);

      if (!chunks || chunks.length === 0) {
        return { removedChunks: 0, totalChunks: 0, errors: [] };
      }

      const chunksToRemove: string[] = [];

      // Validate each chunk
      for (const chunk of chunks) {
        const reasons = this.validateChunk(chunk);
        if (reasons.length > 0) {
          chunksToRemove.push(chunk.id);
          console.log(`Marking chunk ${chunk.id} for removal: ${reasons.join(', ')}`);
        }
      }

      // Remove invalid chunks in batches
      if (chunksToRemove.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < chunksToRemove.length; i += batchSize) {
          const batch = chunksToRemove.slice(i, i + batchSize);
          
          const { error: deleteError } = await supabase
            .from('document_chunks')
            .delete()
            .in('id', batch);

          if (deleteError) {
            errors.push(`Failed to delete batch ${i / batchSize + 1}: ${deleteError.message}`);
          } else {
            removedChunks += batch.length;
          }
        }
      }

      console.log(`Cleanup complete: removed ${removedChunks} invalid chunks out of ${totalChunks}`);
      
      return {
        removedChunks,
        totalChunks,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      return {
        removedChunks,
        totalChunks,
        errors,
      };
    }
  }

  // Validate a single chunk and return reasons for invalidity
  private validateChunk(chunk: any): string[] {
    const reasons: string[] = [];

    // Check content
    if (!chunk.content || typeof chunk.content !== 'string') {
      reasons.push('missing or invalid content');
    } else {
      const content = chunk.content.trim();
      
      if (content.length < 20) {
        reasons.push('content too short');
      }

      // Check if content is mostly markdown syntax or whitespace
      const cleanContent = content.replace(/[#*`\-_\s\n]/g, '');
      if (cleanContent.length < content.length * 0.3) {
        reasons.push('mostly markdown syntax');
      }

      // Check for suspicious patterns
      if (content.match(/^[\s\n\r]*$/)) {
        reasons.push('only whitespace');
      }

      if (content.includes('undefined') || content.includes('null')) {
        reasons.push('contains undefined/null text');
      }

      // Check word count
      const words = content.split(/\s+/).filter((w: string) => w.length > 0);
      if (words.length < 5) {
        reasons.push('too few words');
      }
    }

    // Check embedding
    if (!chunk.embedding) {
      reasons.push('missing embedding');
    } else if (!Array.isArray(chunk.embedding)) {
      reasons.push('embedding not array');
    } else if (chunk.embedding.length !== 1536) {
      reasons.push(`wrong embedding dimension: ${chunk.embedding.length}`);
    } else {
      // Check for invalid values
      const hasInvalidValues = chunk.embedding.some((val: any) => 
        typeof val !== 'number' || !isFinite(val)
      );
      if (hasInvalidValues) {
        reasons.push('invalid embedding values');
      }

      // Check for zero vectors (suspicious)
      const isZeroVector = chunk.embedding.every((val: number) => val === 0);
      if (isZeroVector) {
        reasons.push('zero embedding vector');
      }
    }

    // Check token count
    if (!chunk.token_count || typeof chunk.token_count !== 'number') {
      reasons.push('missing or invalid token count');
    } else if (chunk.token_count < 5 || chunk.token_count > 2000) {
      reasons.push(`invalid token count: ${chunk.token_count}`);
    }

    return reasons;
  }

  // Get statistics about chunk quality
  async getChunkQualityStats(): Promise<{
    totalChunks: number;
    validChunks: number;
    invalidChunks: number;
    averageTokenCount: number;
    averageContentLength: number;
    issues: { [key: string]: number };
  }> {
    try {
      const { data: chunks, error } = await supabase
        .from('document_chunks')
        .select('content, embedding, token_count');

      if (error) {
        throw new Error(`Failed to fetch chunks: ${error.message}`);
      }

      const totalChunks = chunks?.length || 0;
      let validChunks = 0;
      let invalidChunks = 0;
      let totalTokens = 0;
      let totalContentLength = 0;
      const issues: { [key: string]: number } = {};

      if (chunks) {
        for (const chunk of chunks) {
          const reasons = this.validateChunk(chunk);
          
          if (reasons.length === 0) {
            validChunks++;
          } else {
            invalidChunks++;
            reasons.forEach(reason => {
              issues[reason] = (issues[reason] || 0) + 1;
            });
          }

          if (chunk.token_count && typeof chunk.token_count === 'number') {
            totalTokens += chunk.token_count;
          }

          if (chunk.content && typeof chunk.content === 'string') {
            totalContentLength += chunk.content.length;
          }
        }
      }

      return {
        totalChunks,
        validChunks,
        invalidChunks,
        averageTokenCount: totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0,
        averageContentLength: totalChunks > 0 ? Math.round(totalContentLength / totalChunks) : 0,
        issues,
      };
    } catch (error) {
      console.error('Error getting chunk quality stats:', error);
      throw error;
    }
  }

  // Cleanup orphaned chunks (chunks without valid document)
  async cleanupOrphanedChunks(): Promise<number> {
    try {
      const { data: orphanedChunks, error } = await supabase
        .from('document_chunks')
        .select('id')
        .not('document_id', 'in', 
          supabase
            .from('documents')
            .select('id')
        );

      if (error) {
        throw new Error(`Failed to find orphaned chunks: ${error.message}`);
      }

      if (!orphanedChunks || orphanedChunks.length === 0) {
        return 0;
      }

      const chunkIds = orphanedChunks.map(chunk => chunk.id);
      
      const { error: deleteError } = await supabase
        .from('document_chunks')
        .delete()
        .in('id', chunkIds);

      if (deleteError) {
        throw new Error(`Failed to delete orphaned chunks: ${deleteError.message}`);
      }

      console.log(`Removed ${chunkIds.length} orphaned chunks`);
      return chunkIds.length;
    } catch (error) {
      console.error('Error cleaning up orphaned chunks:', error);
      throw error;
    }
  }
}