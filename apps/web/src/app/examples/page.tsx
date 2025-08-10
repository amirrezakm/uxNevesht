'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, UXResponse } from '@ux-nevesht/ui';
import { ArrowLeft, MessageSquare, Copy, Check, ExternalLink } from 'lucide-react';

const examples = [
  {
    category: '🔘 دکمه‌ها',
    scenarios: [
      {
        title: 'دکمه ثبت نام',
        query: 'متن دکمه ثبت نام برای اپلیکیشن موبایل',
        response: {
          options: [
            { text: 'بیا تو!', tone: 'دوستانه', length: 'کوتاه', context: 'ورود به اپلیکیشن', emotion: 'خوشحالی' },
            { text: 'عضو شو', tone: 'محاوره‌ای', length: 'کوتاه', context: 'عضویت ساده', emotion: 'صمیمیت' },
            { text: 'ثبت نام کن', tone: 'واضح', length: 'کوتاه', context: 'فرآیند ثبت نام', emotion: 'اطمینان' }
          ],
          insights: 'دکمه‌های ثبت نام باید تشویق‌کننده و بدون استرس باشند. از زبان ساده و دوستانه استفاده کنید.',
          meta: {
            chunks_used: 2,
            sources: ['راهنمای UX Writing اسنپ'],
            quality_score: 0.85,
            has_relevant_context: true,
            generated_at: new Date().toISOString()
          }
        }
      },
      {
        title: 'دکمه تایید پرداخت',
        query: 'متن دکمه تایید پرداخت با احساس امنیت',
        response: {
          options: [
            { text: 'پرداخت امن', tone: 'اطمینان‌بخش', length: 'کوتاه', context: 'تأکید بر امنیت', emotion: 'آرامش' },
            { text: 'تکمیل خرید', tone: 'حرفه‌ای', length: 'متوسط', context: 'نهایی کردن فرآیند', emotion: 'رضایت' },
            { text: 'پرداخت کن', tone: 'مستقیم', length: 'کوتاه', context: 'عمل پرداخت', emotion: 'اعتماد' }
          ],
          insights: 'در پرداخت، اعتماد کاربر حیاتی است. از کلمات مطمئن و امن استفاده کنید.',
          meta: {
            chunks_used: 3,
            sources: ['راهنمای امنیت و پرداخت'],
            quality_score: 0.92,
            has_relevant_context: true,
            generated_at: new Date().toISOString()
          }
        }
      }
    ]
  },
  {
    category: '⚠️ پیام‌های خطا',
    scenarios: [
      {
        title: 'خطای اتصال اینترنت',
        query: 'پیام خطا برای قطع اینترنت با لحن آرامش‌بخش',
        response: {
          options: [
            { text: 'اتصال اینترنت قطع شده! لطفاً چک کنید', tone: 'دوستانه', length: 'متوسط', context: 'راهنمایی کاربر', emotion: 'حمایت' },
            { text: 'آنلاین نیستید', tone: 'ساده', length: 'کوتاه', context: 'اطلاع وضعیت', emotion: 'صراحت' },
            { text: 'لطفاً اتصال خود را بررسی کنید', tone: 'مؤدبانه', length: 'متوسط', context: 'درخواست بررسی', emotion: 'احترام' }
          ],
          insights: 'پیام‌های خطا نباید کاربر را عصبانی کنند. همیشه راه‌حل پیشنهاد دهید.',
          meta: {
            chunks_used: 2,
            sources: ['راهنمای مدیریت خطاها'],
            quality_score: 0.78,
            has_relevant_context: true,
            generated_at: new Date().toISOString()
          }
        }
      }
    ]
  },
  {
    category: '🎉 پیام‌های موفقیت',
    scenarios: [
      {
        title: 'ثبت نام موفق',
        query: 'پیام تبریک برای ثبت نام موفق',
        response: {
          options: [
            { text: 'خوش اومدی! همه چیز آماده است', tone: 'گرم', length: 'متوسط', context: 'استقبال از کاربر جدید', emotion: 'شادی' },
            { text: 'عالی! حالا عضو خانواده اسنپ هستی', tone: 'صمیمی', length: 'متوسط', context: 'احساس تعلق', emotion: 'مهربانی' },
            { text: 'ثبت نام کامل شد!', tone: 'مستقیم', length: 'کوتاه', context: 'تأیید عملیات', emotion: 'رضایت' }
          ],
          insights: 'پیام‌های موفقیت باید احساس مثبت ایجاد کنند و کاربر را برای گام بعدی آماده کنند.',
          meta: {
            chunks_used: 1,
            sources: ['راهنمای onboarding'],
            quality_score: 0.88,
            has_relevant_context: true,
            generated_at: new Date().toISOString()
          }
        }
      }
    ]
  }
];

const tips = [
  {
    icon: '🎯',
    title: 'سوال دقیق بپرسید',
    description: 'به جای "یه متن می‌خوام"، بگویید "متن دکمه ثبت نام برای کاربران جدید"'
  },
  {
    icon: '👥',
    title: 'مخاطب را مشخص کنید',
    description: 'برای کاربران عادی، رانندگان، یا فروشندگان متن‌های متفاوتی نیاز است'
  },
  {
    icon: '🎭',
    title: 'لحن را تعیین کنید',
    description: 'دوستانه، حرفه‌ای، فوری یا تشویقی - هر کدام احساس متفاوتی منتقل می‌کند'
  },
  {
    icon: '📱',
    title: 'زمینه را بگویید',
    description: 'در صفحه پرداخت، هنگام خطا، یا برای تأیید - زمینه مهم است'
  }
];

export default function ExamplesPage() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 ml-2" />
                بازگشت
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">مثال‌های عملی</h1>
              <p className="text-xs text-gray-500">نحوه استفاده از نازنین را یاد بگیرید</p>
            </div>
          </div>
          <Link href="/chat">
            <Button>
              <MessageSquare className="h-4 w-4 ml-2" />
              شروع چت
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Tips Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            💡 نکات کلیدی برای بهترین نتیجه
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tips.map((tip, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
                <div className="text-2xl mb-2">{tip.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{tip.title}</h3>
                <p className="text-sm text-gray-600" dir="rtl">{tip.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Examples Section */}
        <div className="space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              🎨 مثال‌های کاربردی
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              ببینید نازنین چطور به سوالات مختلف پاسخ می‌دهد و الهام بگیرید
            </p>
          </div>

          {examples.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 border-b border-gray-300 pb-2">
                {category.category}
              </h3>
              
              <div className="space-y-8">
                {category.scenarios.map((scenario, scenarioIndex) => (
                  <div key={scenarioIndex} className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 overflow-hidden">
                    {/* Scenario Header */}
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{scenario.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">سوال:</span>
                            <code className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-sm" dir="rtl">
                              {scenario.query}
                            </code>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(scenario.query)}
                          className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                          title="کپی سوال"
                        >
                          {copiedText === scenario.query ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Response */}
                    <div className="p-6">
                      <UXResponse 
                        options={scenario.response.options}
                        insights={scenario.response.insights}
                        meta={scenario.response.meta}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-center text-white mt-12">
          <h3 className="text-2xl font-bold mb-4">
            آماده برای تجربه نازنین هستید؟
          </h3>
          <p className="mb-6 opacity-90">
            با مثال‌ها آشنا شدید، حالا نوبت شماست تا متن‌های خودتان را بسازید
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/chat">
              <Button className="bg-white text-blue-600 hover:bg-gray-100">
                <MessageSquare className="h-5 w-5 ml-2" />
                شروع چت با نازنین
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <ExternalLink className="h-5 w-5 ml-2" />
                آپلود راهنماهای خود
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
