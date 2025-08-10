# راهنمای راه‌اندازی کامل UX Nevesht

این راهنما شما را مرحله به مرحله در راه‌اندازی سیستم UX Nevesht راهنمایی می‌کند.

## گام ۱: ایجاد فایل‌های محیطی

ابتدا اسکریپت راه‌اندازی را اجرا کنید:

```bash
./setup-env.sh
```

یا دستی فایل‌ها را ایجاد کنید:

### فایل `apps/api/.env`:
```env
# تنظیمات دیتابیس Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# سرویس‌های هوش مصنوعی
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# تنظیمات سرور
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### فایل `apps/web/.env.local`:
```env
# تنظیمات API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## گام ۲: دریافت API Keys

### Supabase:
1. به [Supabase Dashboard](https://supabase.com/dashboard) بروید
2. پروژه جدید ایجاد کنید یا پروژه موجود را انتخاب کنید
3. از Settings > API دو کلید زیر را کپی کنید:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (اختیاری ولی توصیه می‌شود)

### OpenAI:
1. به [OpenAI Platform](https://platform.openai.com/api-keys) بروید
2. کلید API جدید ایجاد کنید
3. آن را در `OPENAI_API_KEY` قرار دهید

### OpenRouter:
1. به [OpenRouter](https://openrouter.ai/keys) بروید
2. حساب کاربری ایجاد کنید
3. کلید API دریافت کنید و در `OPENROUTER_API_KEY` قرار دهید

## گام ۳: راه‌اندازی دیتابیس

### ۳.۱: فعال‌سازی pgvector
1. در Supabase Dashboard به Database > Extensions بروید
2. `vector` را جستجو کنید و Enable کنید

### ۳.۲: اجرای SQL Schema
1. در Supabase Dashboard به SQL Editor بروید
2. کدهای زیر را اجرا کنید:

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
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
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

### ۳.۳: ایجاد Storage Bucket
1. در Supabase Dashboard به Storage بروید
2. باکت جدید به نام `documents` ایجاد کنید
3. تنظیمات امنیتی را غیرعمومی (Private) قرار دهید

## گام ۴: نصب Dependencies

```bash
# در روت پروژه
pnpm install
```

## گام ۵: تست سیستم

### ۵.۱: تست پایه
```bash
cd apps/api
npm run setup-db
```

### ۵.۲: تست کامل
```bash
cd apps/api
npm run test-system
```

### ۵.۳: اجرای پروژه
```bash
# در روت پروژه
pnpm dev
```

آدرس‌ها:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/api/health

## گام ۶: تست عملکرد

### ۶.۱: تست آپلود سند
1. به http://localhost:3000/documents بروید
2. یک فایل markdown آپلود کنید
3. منتظر بمانید تا پردازش تکمیل شود

### ۶.۲: تست چت
1. به http://localhost:3000/chat بروید
2. سوالی در مورد محتوای آپلود شده بپرسید
3. بررسی کنید که پاسخ مناسب دریافت می‌کنید

## عیب‌یابی

### مشکلات رایج:

**خطای اتصال به Supabase:**
- URL و کلیدهای API را بررسی کنید
- مطمئن شوید پروژه Supabase فعال است

**خطای OpenAI API:**
- کلید API و اعتبار حساب را بررسی کنید
- Rate limit ها را در نظر بگیرید

**خطای Database:**
- pgvector extension را فعال کنید
- SQL schema را کامل اجرا کنید
- دسترسی‌های database را بررسی کنید

**خطای Environment:**
- فایل‌های .env را بررسی کنید
- مطمئن شوید همه متغیرها تنظیم شده‌اند

### کمک بیشتر:

```bash
# بررسی وضعیت API
curl http://localhost:3001/api/health

# بررسی لاگ‌های سرور
cd apps/api && npm run dev

# بررسی لاگ‌های فرانت‌اند
cd apps/web && npm run dev
```

## نکات مهم:

1. **امنیت**: فایل‌های .env را commit نکنید
2. **کلیدها**: کلیدهای API را مخفی نگه دارید
3. **اعتبار**: اعتبار کلیدهای OpenAI و OpenRouter را بررسی کنید
4. **کارکرد**: پس از هر تغییر، تست‌ها را اجرا کنید

موفق باشید! 🎉
