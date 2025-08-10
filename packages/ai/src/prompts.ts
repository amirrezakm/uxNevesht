export interface PromptContext {
  userQuery: string;
  relevantChunks: string[];
  uiContext?: string;
  brandTone?: 'friendly' | 'professional' | 'casual';
}

export interface UXCopyRequest {
  context: string;
  elementType: 'button' | 'error' | 'success' | 'tooltip' | 'placeholder' | 'title' | 'description' | 'navigation';
  audience: 'user' | 'driver' | 'vendor' | 'admin';
  tone: 'friendly' | 'professional' | 'urgent' | 'encouraging';
}

export class PromptBuilder {
  static buildSystemPrompt(): string {
    return `🎯 شما نازنین هستید - متخصص ارشد UX Writing اسنپ!

✨ شخصیت شما:
• خلاق و با ذوق در تولید متن‌های جذاب
• عاشق زبان فارسی و ظرافت‌های آن
• متخصص در درک احساسات و نیازهای کاربران
• استاد در ایجاد ارتباط صمیمی با کاربران

🎨 اصول طلایی شما:
1. 💎 هر متن باید مثل یک جواهر باشد - کوچک ولی با ارزش
2. 🤝 لحن دوستانه و صمیمی - انگار با دوست صمیمی‌تان حرف می‌زنید
3. 🇮🇷 عمیقاً ایرانی - با درک فرهنگ و زبان محلی
4. 📱 موبایل‌محور - هر کلمه در صفحه کوچک باید معنا داشته باشد
5. 🌈 متنوع و خلاقانه - هرگز تکراری نباشید
6. 💡 راهنما و مفید - همیشه کاربر را به سمت درست هدایت کنید

🎭 سبک‌های لحن شما:
• 😊 دوستانه: مثل حرف زدن با دوست صمیمی
• 💼 حرفه‌ای: محترم و قابل اعتماد
• 🚨 فوری: مهم ولی نه ترسناک
• 🎉 تشویقی: انرژی مثبت و امید

📝 فرمت پاسخ شما (همیشه JSON):
{
  "options": [
    {
      "text": "متن زیبا و کاربردی",
      "tone": "لحن انتخابی", 
      "length": "کوتاه/متوسط",
      "context": "کجا و چگونه استفاده شود",
      "emotion": "احساسی که منتقل می‌کند"
    }
  ],
  "insights": "نکات مهم UX که در نظر گرفته شده",
  "alternatives": "گزینه‌های جایگزین برای سناریوهای مختلف"
}`;
  }

  static buildUserPrompt(context: PromptContext): string {
    const { userQuery, relevantChunks, uiContext, brandTone } = context;
    
    let prompt = `🎯 چالش UX جدید:\n"${userQuery}"\n\n`;
    
    if (uiContext) {
      prompt += `🖼️ محیط کاربری: ${uiContext}\n\n`;
    }
    
    if (brandTone) {
      const toneEmojis = {
        friendly: '😊',
        professional: '💼', 
        casual: '🤙'
      };
      prompt += `${toneEmojis[brandTone] || '🎭'} لحن درخواستی: ${brandTone}\n\n`;
    }
    
    if (relevantChunks.length > 0) {
      prompt += `📚 راهنماهای استخراج شده از اسناد:\n`;
      relevantChunks.forEach((chunk, index) => {
        prompt += `${index + 1}. ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}\n\n`;
      });
    }
    
    prompt += `✨ حالا جادو کنید! چندین گزینه خلاقانه و کاربردی برای این چالش ارائه دهید که:\n`;
    prompt += `• کاربران را خوشحال کند\n`;
    prompt += `• واضح و مفهوم باشد\n`;
    prompt += `• با فرهنگ ایرانی هماهنگ باشد\n`;
    prompt += `• در موبایل زیبا به نظر برسد`;
    
    return prompt;
  }

  static buildSpecificUXPrompt(request: UXCopyRequest): string {
    const elementData = {
      button: { name: 'دکمه', emoji: '🔘', tips: 'فعال و تشویقی باشد' },
      error: { name: 'پیام خطا', emoji: '⚠️', tips: 'آرامش‌بخش و راه‌حل محور باشد' },
      success: { name: 'پیام موفقیت', emoji: '🎉', tips: 'مثبت و خوشحال‌کننده باشد' },
      tooltip: { name: 'راهنمای کوتاه', emoji: '💡', tips: 'مختصر و مفید باشد' },
      placeholder: { name: 'متن راهنما', emoji: '📝', tips: 'واضح و مثال‌محور باشد' },
      title: { name: 'عنوان', emoji: '📋', tips: 'جذاب و توضیحی باشد' },
      description: { name: 'توضیحات', emoji: '📄', tips: 'کامل ولی خلاصه باشد' },
      navigation: { name: 'ناوبری', emoji: '🧭', tips: 'مسیر را واضح نشان دهد' }
    };

    const audienceData = {
      user: { name: 'کاربران عادی', emoji: '👥', vibe: 'دوستانه و ساده' },
      driver: { name: 'رانندگان', emoji: '🚗', vibe: 'سریع و کاربردی' },
      vendor: { name: 'فروشندگان', emoji: '🏪', vibe: 'حرفه‌ای و مفید' },
      admin: { name: 'مدیران', emoji: '👨‍💼', vibe: 'دقیق و تخصصی' }
    };

    const toneData = {
      friendly: { name: 'دوستانه', emoji: '😊', energy: 'گرم و صمیمی' },
      professional: { name: 'حرفه‌ای', emoji: '💼', energy: 'محترم و قابل اعتماد' },
      urgent: { name: 'فوری', emoji: '🚨', energy: 'مهم ولی نه استرس‌زا' },
      encouraging: { name: 'تشویقی', emoji: '🎉', energy: 'مثبت و انرژی‌بخش' }
    };

    const element = elementData[request.elementType];
    const audience = audienceData[request.audience];
    const tone = toneData[request.tone];

    return `🎨 پروژه خاص UX:

${element.emoji} نوع کامپوننت: ${element.name}
${audience.emoji} مخاطب: ${audience.name} (${audience.vibe})
${tone.emoji} لحن: ${tone.name} (${tone.energy})

📋 سناریو: ${request.context}

🎯 اهداف این متن:
• ${element.tips}
• مناسب ${audience.name} باشد
• احساس ${tone.energy} منتقل کند
• در موبایل زیبا و خوانا باشد

✨ چند گزینه خلاقانه و متفاوت ارائه دهید که کاربر را شگفت‌زده کند!`;
  }

  static buildContextualPrompt(
    query: string,
    relevantDocs: string[],
    previousContext?: string[]
  ): string {
    let prompt = `بر اساس راهنماهای UX Writing موجود، لطفاً برای درخواست زیر متن تولید کنید:\n\n`;
    prompt += `درخواست: ${query}\n\n`;
    
    if (relevantDocs.length > 0) {
      prompt += `اسناد مرتبط:\n`;
      relevantDocs.forEach((doc, index) => {
        prompt += `--- سند ${index + 1} ---\n${doc}\n\n`;
      });
    }
    
    if (previousContext && previousContext.length > 0) {
      prompt += `زمینۀ قبلی گفتگو:\n`;
      previousContext.forEach((context, index) => {
        prompt += `${index + 1}. ${context}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `لطفاً با در نظر گیری راهنماهای موجود، چندین گزینۀ متنی مناسب ارائه دهید.`;
    
    return prompt;
  }

  // Common UX copy templates
  static getCommonTemplates() {
    return {
      buttons: {
        primary: ['ادامه', 'تأیید', 'ذخیره', 'ارسال'],
        secondary: ['انصراف', 'بازگشت', 'بعداً', 'رد کردن'],
        destructive: ['حذف', 'لغو', 'برداشتن', 'پاک کردن']
      },
      errors: {
        network: ['اتصال اینترنت را بررسی کنید', 'مشکل در اتصال'],
        validation: ['لطفاً اطلاعات را بررسی کنید', 'اطلاعات وارد شده صحیح نیست'],
        server: ['خطایی رخ داده، لطفاً دوباره تلاش کنید', 'مشکل موقت در سرور']
      },
      success: {
        general: ['انجام شد!', 'موفق بود', 'ذخیره شد'],
        action: ['درخواست شما ثبت شد', 'عملیات با موفقیت انجام شد']
      },
      placeholders: {
        search: ['جستجو کنید...', 'چی می‌خوای؟'],
        input: ['اینجا بنویسید', 'وارد کنید']
      }
    };
  }
} 