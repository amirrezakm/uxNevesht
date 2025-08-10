const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    chunks_used?: number;
    sources?: string[];
  };
}

export interface Document {
  id: string;
  title?: string;
  file_size?: number;
  upload_date?: string;
  processed?: boolean;
  // Additional fields that might come from the API
  created_at?: string;
  chunk_count?: number;
  processing_time?: number;
  error_message?: string;
}

export interface ChatResponse {
  options?: Array<{
    text: string;
    tone: string;
    length: string;
    context: string;
    emotion?: string;
  }>;
  insights?: string;
  alternatives?: string | Array<{
    text: string;
    tone: string;
    length: string;
    context?: string;
    emotion?: string;
  }>;
  meta?: {
    chunks_used: number;
    sources: string[];
    quality_score: number;
    has_relevant_context: boolean;
    generated_at: string;
  };
  // Legacy support
  response?: string;
  context?: {
    chunks_used: number;
    sources: string[];
    similarity_scores: number[];
  };
}

// Chat API functions
export const chatApi = {
  async sendMessage(message: string, context?: string, tone?: string, model?: string): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        context,
        tone,
        model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.statusText}`);
    }

    return response.json();
  },

  async generateUXCopy(request: {
    context: string;
    elementType: string;
    audience: string;
    tone: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/api/chat/generate-copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`UX Copy API error: ${response.statusText}`);
    }

    return response.json();
  },

  async getTemplates() {
    const response = await fetch(`${API_BASE_URL}/api/chat/templates`);
    
    if (!response.ok) {
      throw new Error(`Templates API error: ${response.statusText}`);
    }

    return response.json();
  },
};

// Documents API functions
export const documentsApi = {
  async uploadDocument(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.document;
  },

  async getDocuments(): Promise<Document[]> {
    const response = await fetch(`${API_BASE_URL}/api/documents`);
    
    if (!response.ok) {
      throw new Error(`Documents API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Ensure we always return an array, even if backend sends unexpected data
    if (Array.isArray(result.documents)) {
      return result.documents;
    } else if (Array.isArray(result)) {
      return result;
    } else {
      console.warn('API returned unexpected documents structure:', result);
      return [];
    }
  },

  async getDocument(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}`);
    
    if (!response.ok) {
      throw new Error(`Document API error: ${response.statusText}`);
    }

    return response.json();
  },

  async deleteDocument(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Delete API error: ${response.statusText}`);
    }
  },

  async reprocessDocument(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/documents/${id}/reprocess`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Reprocess API error: ${response.statusText}`);
    }
  },
};

// Health check
export const healthApi = {
  async check() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  },
};