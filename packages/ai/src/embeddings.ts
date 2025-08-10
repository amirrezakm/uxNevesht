import OpenAI from 'openai';

export class EmbeddingsService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
    });
  }

  async generateEmbedding(text: string, retries: number = 3): Promise<number[]> {
    try {
      // Validate and clean input text
      const cleanText = this.preprocessText(text);
      if (!cleanText || cleanText.length < 10) {
        throw new Error('Text too short or invalid for embedding');
      }

      const response = await Promise.race([
        this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: cleanText,
          encoding_format: 'float',
          dimensions: 1536, // Explicit dimension setting
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Embedding request timeout')), 60000)
        )
      ]) as any;

      return response.data[0].embedding;
    } catch (error: any) {
      console.error('Error generating embedding:', error);
      
      if (retries > 0 && this.isRetryableError(error)) {
        console.log(`Retrying embedding generation, ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.generateEmbedding(text, retries - 1);
      }
      
      throw new Error(`Failed to generate embedding: ${error?.message || 'Unknown error'}`);
    }
  }

  async generateEmbeddings(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]> {
    try {
      // Validate and clean input texts
      const cleanTexts = texts
        .map(text => this.preprocessText(text))
        .filter(text => text && text.length >= 10);

      if (cleanTexts.length === 0) {
        throw new Error('No valid texts provided for embedding');
      }

      console.log(`Starting embedding generation for ${cleanTexts.length} texts`);

      // Process in smaller batches to avoid rate limits and large payloads
      const batchSize = 5; // Much smaller batch size for stability with large files
      const results: number[][] = [];
      let processedCount = 0;

      for (let i = 0; i < cleanTexts.length; i += batchSize) {
        const batch = cleanTexts.slice(i, i + batchSize);
        
        try {
          const response = await Promise.race([
            this.openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: batch,
              encoding_format: 'float',
              dimensions: 1536,
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Batch embedding timeout')), 120000)
            )
          ]) as any;

          results.push(...response.data.map((item: any) => item.embedding));
          processedCount += batch.length;
          
          if (onProgress) {
            onProgress(processedCount, cleanTexts.length);
          }
          
          console.log(`Processed ${processedCount}/${cleanTexts.length} embeddings`);

          // Longer delay between batches to avoid rate limits and give system time to breathe
          if (i + batchSize < cleanTexts.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error processing batch ${i}-${i + batch.length}:`, error);
          throw error;
        }
      }

      console.log(`Successfully generated ${results.length} embeddings`);
      return results;
    } catch (error: any) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error?.message || 'Unknown error'}`);
    }
  }

  // Preprocess text for better embedding quality
  private preprocessText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[^\u0000-\u007F\u0600-\u06FF\u200C\u200D]/g, ' ') // Keep ASCII, Persian, and joiners
      .trim();
  }

  // Check if error is retryable
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.status;
    
    // Retry on rate limits, timeouts, and temporary server errors
    return (
      errorCode === 429 || // Rate limit
      errorCode === 502 || // Bad gateway
      errorCode === 503 || // Service unavailable
      errorCode === 504 || // Gateway timeout
      errorMessage.includes('timeout') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('temporarily unavailable')
    );
  }

  // Calculate cosine similarity between two vectors
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
} 