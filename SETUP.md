# راه‌اندازی محیط توسعه

## گام ۱: کپی کردن فایل‌های محیطی

```bash
# کپی کردن فایل محیطی بک‌اند
cp apps/api/.env.template apps/api/.env

# کپی کردن فایل محیطی فرانت‌اند  
cp apps/web/.env.template apps/web/.env.local
```

## گام ۲: تکمیل متغیرهای محیطی

### بک‌اند (apps/api/.env)

```env
# تنظیمات دیتابیس Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# سرویس‌های هوش مصنوعی
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# تنظیمات سرور
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### فرانت‌اند (apps/web/.env.local)

```env
# تنظیمات API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## گام ۳: راه‌اندازی دیتابیس

1. ایجاد پروژه جدید در [Supabase](https://supabase.com)
2. اجرای SQL کد موجود در `packages/database/src/schemas.ts`
3. فعال‌سازی extension `pgvector`

## گام ۴: اجرای پروژه

```bash
# نصب وابستگی‌ها
pnpm install

# اجرای توسعه
pnpm dev
```

## آدرس‌های دسترسی

- فرانت‌اند: http://localhost:3000
- بک‌اند API: http://localhost:3001
- بررسی سلامت API: http://localhost:3001/api/health

## نکات مهم

- حتماً extension `pgvector` را در Supabase فعال کنید
- API Key های OpenAI و OpenRouter را تهیه کنید
- فایل‌های `.env` را هرگز commit نکنید