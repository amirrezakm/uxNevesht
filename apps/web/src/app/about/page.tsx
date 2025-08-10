import React from 'react';
import Link from 'next/link';
import { Button } from '@ux-nevesht/ui';
import { ArrowLeft, Heart, Code, Users, Sparkles, MessageSquare } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 ml-2" />
                بازگشت
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">درباره نازنین</h1>
              <p className="text-xs text-gray-500">داستان دستیار UX Writing اسنپ</p>
            </div>
          </div>
          <Link href="/chat">
            <Button>
              <MessageSquare className="h-4 w-4 ml-2" />
              چت با نازنین
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 نازنین
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            دستیار هوش مصنوعی UX Writing که با عاشقی و دقت، بهترین متن‌ها را برای تیم اسنپ می‌سازد
          </p>
        </div>

        {/* Story Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500" />
            داستان نازنین
          </h2>
          
          <div className="prose prose-gray max-w-none" dir="rtl">
            <p className="text-gray-700 leading-relaxed mb-4">
              نازنین از عشق به زبان فارسی و درک عمیق از نیازهای کاربران اسنپ متولد شد. 
              او نه تنها یک هوش مصنوعی است، بلکه دوستی است که همیشه آماده کمک به شماست.
            </p>
            
            <p className="text-gray-700 leading-relaxed mb-4">
              با تکیه بر راهنماهای UX Writing تیم اسنپ، نازنین یاد گرفته که چطور:
            </p>
            
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>با کاربران صمیمی و دوستانه حرف بزند</li>
              <li>در مواقع بحرانی آرامش‌بخش باشد</li>
              <li>پیچیدگی‌ها را ساده کند</li>
              <li>احساسات مثبت منتقل کند</li>
              <li>فرهنگ ایرانی را درنظر بگیرد</li>
            </ul>

            <p className="text-gray-700 leading-relaxed">
              هر روز با تعامل بیشتر، نازنین هوشمندتر می‌شود و بهتر یاد می‌گیرد که چطور 
              به تیم UX اسنپ کمک کند تا تجربه کاربری بهتری خلق کنند.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Code className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">تکنولوژی پیشرفته</h3>
                <p className="text-sm text-gray-600">مبتنی بر مدل‌های زبانی قدرتمند</p>
              </div>
            </div>
            <p className="text-gray-700 text-sm">
              نازنین از جدیدترین مدل‌های OpenAI، Anthropic، و Google استفاده می‌کند 
              تا بهترین نتایج را ارائه دهد.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">متمرکز بر کاربر</h3>
                <p className="text-sm text-gray-600">درک عمیق از نیازهای مختلف</p>
              </div>
            </div>
            <p className="text-gray-700 text-sm">
              برای هر مخاطب - از کاربران عادی تا رانندگان و فروشندگان - 
              متن‌های مناسب و کاربردی تولید می‌کند.
            </p>
          </div>
        </div>

        {/* Capabilities */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-6 text-center">
            ✨ قابلیت‌های نازنین
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold mb-2">دقت بالا</h3>
              <p className="text-sm opacity-90">
                متن‌های دقیق و مناسب برای هر زمینه
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold mb-2">سرعت</h3>
              <p className="text-sm opacity-90">
                پاسخ در کمتر از 3 ثانیه
              </p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl mb-2">🌈</div>
              <h3 className="font-semibold mb-2">تنوع</h3>
              <p className="text-sm opacity-90">
                چندین گزینه برای انتخاب بهترین
              </p>
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            👨‍💻 ساخته شده برای تیم اسنپ
          </h2>
          <p className="text-gray-600 mb-6">
            نازنین با همکاری تیم‌های UX، محصول و توسعه اسنپ طراحی شده است
          </p>
          
          <div className="flex justify-center gap-4">
            <Link href="/chat">
              <Button size="lg">
                <MessageSquare className="h-5 w-5 ml-2" />
                شروع همکاری با نازنین
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
