# 🎯 UX Nevesht - دستیار هوش مصنوعی نویسندگی تجربه کاربری

سیستم UX Nevesht یک دستیار هوش مصنوعی برای تیم UX Writing اسنپ است که به کمک تکنولوژی RAG (Retrieval Augmented Generation) متن‌های کاربری مناسب و متنوع تولید می‌کند.

## ✨ قابلیت‌ها

### 📝 تولید متن کاربری هوشمند
- تولید متن برای انواع المان‌های رابط کاربری (دکمه، خطا، موفقیت، راهنما و...)
- انطباق با مخاطبان مختلف (کاربر، راننده، فروشنده، ادمین)
- تنوع در لحن نوشتاری (دوستانه، رسمی، فوری، تشویق‌کننده)

### 🔍 سیستم RAG پیشرفته
- آپلود و پردازش اسناد راهنمای UX Writing
- وکتورایز کردن محتوا با OpenAI Embeddings
- جستجوی مشابهت معنایی برای یافتن محتوای مرتبط
- ترکیب اطلاعات از چندین سند برای پاسخ‌های جامع

### 🤖 انتخاب مدل‌های مختلف AI
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo
- **Anthropic**: Claude 3 Opus, Sonnet, Haiku
- **Google**: Gemini Pro, Gemini Flash
- **Meta**: Llama 3.1 (8B, 70B)

### 🎨 رابط کاربری فارسی
- طراحی مناسب برای متن فارسی (RTL)
- رابط کاربری زیبا و کاربرپسند
- نمایش اطلاعات مدل‌های AI
- کپی آسان متن‌های تولیدی

## 🚀 نصب و راه‌اندازی

### پیش‌نیازها
- Node.js 18+
- PNPM
- حساب کاربری Supabase
- کلید API OpenAI
- کلید API OpenRouter

### گام‌های نصب

#### 1. کلون کردن پروژه
```bash
git clone <repository-url>
cd uxNevesht
```

#### 2. نصب dependencies
```bash
pnpm install
```

#### 3. تنظیم environment variables
```bash
# اجرای script راه‌اندازی
./setup-env.sh

# یا دستی ایجاد فایل‌ها:
```

فایل `apps/api/.env`:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

فایل `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### 4. راه‌اندازی دیتابیس Supabase

**در Dashboard Supabase:**
1. Database > Extensions → فعال کردن `vector`
2. SQL Editor → اجرای SQL schema (موجود در SETUP-COMPLETE.md)
3. Storage → ایجاد bucket به نام `documents`

**بررسی setup:**
```bash
cd apps/api
npm run startup-check
```

#### 5. اجرای پروژه
```bash
# اجرای همه سرویس‌ها
pnpm dev

# یا جداگانه:
cd apps/api && npm run dev
cd apps/web && npm run dev
```

## 📖 نحوه استفاده

### آپلود اسناد راهنما
1. به صفحه Documents (`/documents`) بروید
2. فایل‌های markdown یا text راهنماهای UX خود را آپلود کنید
3. منتظر تکمیل پردازش بمانید (vectorization)

### چت و تولید متن
1. به صفحه Chat (`/chat`) بروید
2. مدل مورد نظر را انتخاب کنید
3. سوال یا درخواست خود را بنویسید:
   - "متن برای دکمه ثبت نام"
   - "پیام خطا برای ورود ناموفق"
   - "راهنمای tooltip برای آپلود فایل"

### مثال‌های درخواست

**درخواست ساده:**
```
متن برای دکمه تأیید سفارش در اپ رانندگان
```

**درخواست تخصصی:**
```
پیام خطای شبکه برای کاربران عادی با لحن دوستانه و راهنمایی برای حل مشکل
```

**درخواست چندگزینه:**
```
سه گزینه متن برای صفحه خالی لیست سفارش‌ها
```

## 🔧 مدیریت سیستم

### تست سلامت سیستم
```bash
cd apps/api
npm run test-system
```

### پاک‌سازی chunks نامعتبر
```bash
cd apps/api
curl -X POST http://localhost:3001/api/documents/cleanup/chunks
```

### بررسی آمار chunks
```bash
curl http://localhost:3001/api/documents/cleanup/stats
```

### راه‌اندازی مجدد دیتابیس
```bash
cd apps/api
npm run setup-db
```

## 🎛️ تنظیمات پیشرفته

### تنظیم threshold های RAG
در `ragService.ts`:
```typescript
const similarityThreshold = 0.3; // حد آستانه شباهت
const maxChunks = 6; // حداکثر تعداد chunk ها
```

### تنظیم chunking
در `documentProcessor.ts`:
```typescript
const chunker = new TextChunker(512, 50); // 512 token، 50 overlap
```

### تنظیم embedding model
در `embeddings.ts`:
```typescript
model: 'text-embedding-3-small' // یا ada-002
```

## 📊 معماری سیستم

```
uxNevesht/
├── apps/
│   ├── web/          # React/Next.js Frontend
│   └── api/          # Node.js/Express Backend
├── packages/
│   ├── ui/           # مؤلفه‌های مشترک UI
│   ├── database/     # Supabase client و schemas
│   ├── ai/           # سرویس‌های AI (OpenAI, OpenRouter)
│   └── config/       # تنظیمات مشترک
```

### جریان داده
1. **آپلود سند** → Storage → Database → Chunking → Embeddings
2. **سؤال کاربر** → Embedding → Vector Search → RAG → LLM → پاسخ

## 🛠️ عیب‌یابی

### مشکلات رایج

**خطای "Environment validation failed":**
- بررسی کلیدهای API در فایل‌های .env
- اطمینان از صحت URL های Supabase

**خطای "pgvector not found":**
- فعال کردن extension در Supabase Dashboard
- اجرای مجدد SQL schema

**خطای "OpenAI API":**
- بررسی کلید API و اعتبار حساب
- چک کردن rate limits

**آپلود شکست می‌خورد:**
- بررسی اندازه فایل (حداکثر 10MB)
- اطمینان از وجود bucket در Storage

### لاگ‌ها و Monitoring
```bash
# بررسی health check
curl http://localhost:3001/api/health

# بررسی لاگ‌های API
cd apps/api && npm run dev

# بررسی آمار RAG
curl http://localhost:3001/api/chat/stats
```

## 🔐 امنیت

- فایل‌های .env را commit نکنید
- کلیدهای API را محفوظ نگه دارید
- از service role key فقط در سرور استفاده کنید
- دسترسی‌های Supabase را محدود کنید

## 🤝 مشارکت

برای مشارکت در پروژه:
1. Fork کنید
2. Branch جدید بسازید
3. تغییرات را commit کنید
4. Pull request ارسال کنید

## 📈 Performance Tips

- برای بهترین کارکرد از GPT-4o-mini استفاده کنید
- اسناد را در chunks مناسب تقسیم کنید
- از cache برای سؤالات تکراری استفاده کنید
- similarity threshold را تنظیم کنید

## 📞 پشتیبانی

برای سؤالات فنی:
- Issues در GitHub
- مستندات در `/docs`
- راهنمای کامل در `SETUP-COMPLETE.md`

---

**ساخته شده با ❤️ برای تیم UX اسنپ | ۱۴۰۳**
