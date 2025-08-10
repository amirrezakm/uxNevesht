export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          title: string;
          content: string;
          file_path: string;
          file_size: number;
          upload_date: string;
          processed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          file_path: string;
          file_size: number;
          upload_date?: string;
          processed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          file_path?: string;
          file_size?: number;
          upload_date?: string;
          processed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          content: string;
          embedding: number[] | null;
          chunk_index: number;
          token_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          content: string;
          embedding?: number[] | null;
          chunk_index: number;
          token_count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          content?: string;
          embedding?: number[] | null;
          chunk_index?: number;
          token_count?: number;
          created_at?: string;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          messages: ChatMessage[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          messages?: ChatMessage[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          messages?: ChatMessage[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      search_chunks: {
        Args: {
          query_embedding: number[];
          similarity_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          document_id: string;
          content: string;
          similarity: number;
          document_title: string;
        }[];
      };
    };
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context_chunks?: string[];
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding?: number[];
  chunk_index: number;
  token_count: number;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  processed: boolean;
  created_at: string;
  updated_at: string;
} 