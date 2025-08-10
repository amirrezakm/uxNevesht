# حل مشکل پردازش اسناد UX Nevesht

## 🔍 تشخیص مشکل
اسناد آپلود شده در حالت "در حال پردازش" باقی می‌مانند و وکتورایز نمی‌شوند.

## 🧩 علت مشکل
1. **کلیدهای Supabase نادرست**: SUPABASE_ANON_KEY خیلی کوتاه است
2. **نبود Database Schema**: جداول در دیتابیس ایجاد نشده‌اند

## ✅ راه‌حل گام به گام

### گام ۱: دریافت کلیدهای صحیح Supabase

1. به [Supabase Dashboard](https://supabase.com/dashboard) بروید
2. پروژه خود را انتخاب کنید
3. **Settings > API** کلیک کنید
4. کلیدهای زیر را کپی کنید:

```
Project URL: https://your-project-ref.supabase.co
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (طولانی)
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (طولانی)
```

### گام ۲: بروزرسانی فایل .env

فایل `apps/api/.env` را با کلیدهای صحیح بروزرسانی کنید:

```env
# Database Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (کلید کامل)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (کلید کامل)

# AI Services
OPENAI_API_KEY=sk-proj-... (همان کلید فعلی)
OPENROUTER_API_KEY=sk-or-v1-... (همان کلید فعلی)

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### گام ۳: ایجاد Database Schema

1. **Supabase Dashboard > SQL Editor** بروید
2. کد SQL زیر را اجرا کنید:

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_chunks table with vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  document_title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.title AS document_title
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 1 - (dc.embedding <=> query_embedding) > similarity_threshold
    AND dc.embedding IS NOT NULL
    AND d.processed = true
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### گام ۴: فعال‌سازی pgvector Extension

1. **Database > Extensions** بروید
2. `vector` را جستجو کنید
3. **Enable** کلیک کنید

### گام ۵: تست سیستم

```bash
cd apps/api
npm run startup-check
```

باید همه تست‌ها پاس شوند.

### گام ۶: restart سرور

```bash
cd apps/api
npm run dev
```

## 🔄 تست عملکرد

1. اسناد قبلی را حذف کنید
2. سند جدید آپلود کنید
3. باید پردازش شود و وضعیت به "پردازش شده" تغییر کند

## 🆘 عیب‌یابی

اگر مشکل ادامه داشت:

```bash
# چک کردن لاگ‌های API
cd apps/api && npm run dev

# تست مجدد startup
npm run startup-check

# بررسی جداول در Supabase
# Table Editor > documents, document_chunks
```
