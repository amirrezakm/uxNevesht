# راهنمای رفع مشکل وکتورایز کردن 🔧

مشکل وکتورایز که در پردازش گیر می‌کرد حل شده است. در ادامه توضیح مشکلات و راه‌حل‌ها آمده است:

## مشکلات شناسایی شده ❌

1. **عدم وجود timeout** برای فراخوانی‌های OpenAI API
2. **پردازش دسته‌ای بزرگ** بدون نمایش پیشرفت
3. **عدم وجود منطق retry** برای خطاهای API
4. **مشکلات حافظه** با اسناد بزرگ
5. **عدم پیگیری وضعیت پردازش**

## راه‌حل‌های پیاده‌سازی شده ✅

### 1. بهبود EmbeddingsService (`packages/ai/src/embeddings.ts`)

```typescript
// اضافه شدن timeout و retry mechanism
async generateEmbedding(text: string, retries: number = 3): Promise<number[]>

// اضافه شدن progress tracking
async generateEmbeddings(texts: string[], onProgress?: (current: number, total: number) => void): Promise<number[][]>
```

**ویژگی‌های جدید:**
- ⏱️ Timeout 30 ثانیه برای تک embedding
- ⏱️ Timeout 45 ثانیه برای batch embedding  
- 🔁 Retry 3 بار برای خطاهای قابل تکرار
- 📊 نمایش پیشرفت پردازش
- 📉 کاهش batch size از 50 به 20 برای پایداری بیشتر
- ⏳ افزایش تأخیر بین batch‌ها از 100ms به 500ms

### 2. بهبود DocumentProcessor (`apps/api/src/services/documentProcessor.ts`)

**متدهای جدید:**
- `getStuckDocuments()`: شناسایی اسناد گیر کرده
- `resetStuckDocuments()`: ریست اسناد گیر کرده
- بهتر شدن logging و error handling

### 3. اسکریپت تعمیر (`apps/api/src/scripts/fix-vectorization.ts`)

اسکریپت کاملی برای شناسایی و رفع مشکلات:

```bash
# اجرای اسکریپت تعمیر
cd apps/api
npm run fix-vectorization
```

## نحوه استفاده 🚀

### 1. اجرای اسکریپت تعمیر (روش ساده)

```bash
cd apps/api
npm run fix-vectorization
```

### 2. دستی (برای کنترل بیشتر)

```typescript
import { DocumentProcessor } from './services/documentProcessor';

const processor = new DocumentProcessor();

// بررسی اسناد گیر کرده
const stuckDocs = await processor.getStuckDocuments();
console.log(`Found ${stuckDocs.length} stuck documents`);

// ریست اسناد گیر کرده
await processor.resetStuckDocuments();

// پردازش مجدد همه اسناد
await processor.reprocessAllDocuments();
```

## مانیتورینگ 📊

حالا لاگ‌های بهتری خواهید دید:

```
Processing document abc-123...
Created 25 chunks for document abc-123
Starting embedding generation for 25 texts
Processed 20/25 embeddings
Embedding progress: 20/25 (80%)
Processed 25/25 embeddings
Successfully generated 25 embeddings
Inserting 25 chunks in batches of 10...
Inserted batch 1/3
Inserted batch 2/3
Inserted batch 3/3
Successfully processed document abc-123 with 25 chunks
```

## مواردی که بررسی می‌شود 🔍

1. **اسناد گیر کرده**: اسنادی که بیش از 10 دقیقه پیش آپلود شده‌اند ولی پردازش نشده‌اند
2. **خطاهای API**: خطاهای rate limit، timeout، و server errors
3. **کیفیت embedding**: تشخیص embedding‌های نامعتبر
4. **پیشرفت پردازش**: نمایش real-time پیشرفت

## مشکلات احتمالی و راه‌حل 🛠️

### مشکل: هنوز هم گیر می‌کند
```bash
# بررسی لاگ‌ها
tail -f logs/api.log

# اجرای مجدد اسکریپت تعمیر
npm run fix-vectorization
```

### مشکل: خطای rate limit
- batch size کم شده (20 به جای 50)
- تأخیر بیشتر بین batch‌ها (500ms)
- retry mechanism برای rate limit errors

### مشکل: خطای timeout
- timeout افزایش یافته (30s برای تک، 45s برای batch)
- retry برای timeout errors

## متغیرهای محیطی مورد نیاز 🔑

```bash
OPENAI_API_KEY=your_openai_api_key
```

## نکات مهم ⚠️

1. **فضای دیسک**: اطمینان حاصل کنید فضای کافی دارید
2. **اتصال اینترنت**: اتصال پایدار به OpenAI API ضروری است
3. **Memory**: برای اسناد بزرگ ممکن است نیاز به RAM بیشتری باشد
4. **Database**: اتصال به Supabase باید فعال باشد

## پیشرفت‌های آینده 🔮

- [ ] صف async برای پردازش اسناد
- [ ] Cache کردن embedding‌ها
- [ ] پشتیبانی از models مختلف embedding
- [ ] Dashboard برای مانیتورینگ