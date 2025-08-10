import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  // Optional OpenRouter model id, e.g. "openai/gpt-4o-mini"
  model?: string;
}

export class LLMService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://openrouter.ai/api/v1',
    });
    this.model = 'openai/gpt-4o-mini';
  }

  setModel(modelId: string): void {
    if (typeof modelId === 'string' && modelId.trim().length > 0) {
      this.model = modelId.trim();
    }
  }

  getModel(): string {
    return this.model;
  }

  async generateResponse(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || this.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        top_p: options.topP || 1,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating LLM response:', error);
      throw new Error('Failed to generate response');
    }
  }

  async generateStreamResponse(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<AsyncIterable<string>> {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || this.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        top_p: options.topP || 1,
        stream: true,
      });

      return this.processStream(stream);
    } catch (error) {
      console.error('Error generating LLM stream response:', error);
      throw new Error('Failed to generate stream response');
    }
  }

  private async* processStream(stream: any): AsyncIterable<string> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // Calculate token count estimate for messages
  estimateTokenCount(messages: ChatMessage[]): number {
    // Rough estimate: ~4 characters per token
    const totalChars = messages.reduce((total, msg) => total + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }
} 