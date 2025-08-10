import * as React from 'react';
import { cn } from '../lib/utils';
import { BookOpen, Target, Users, MessageCircle, Palette, Zap, CheckCircle } from 'lucide-react';

export interface UXGuideProps {
  className?: string;
}

const guides = [
  {
    icon: Target,
    title: 'چطور سوال خوب بپرسم؟',
    items: [
      'مشخص باشید: "متن دکمه ثبت نام" بهتر از "یه متن می‌خوام"',
      'مخاطب را بگویید: "برای کاربران عادی" یا "برای رانندگان"',
      'لحن را مشخص کنید: "دوستانه" یا "حرفه‌ای"',
      'زمینه را شرح دهید: "برای صفحه پرداخت" یا "در زمان خطا"'
    ],
    color: 'blue'
  },
  {
    icon: MessageCircle,
    title: 'نمونه سوالات خوب',
    items: [
      '"متن خطا برای پرداخت ناموفق با لحن آرامش‌بخش"',
      '"دکمه تایید سفارش غذا با انرژی مثبت"',
      '"پیام خوشامدگویی برای رانندگان جدید"',
      '"راهنمای آپلود عکس مدرک برای کاربران"'
    ],
    color: 'green'
  },
  {
    icon: Users,
    title: 'مخاطب‌های مختلف',
    items: [
      '👥 کاربران عادی: زبان ساده و دوستانه',
      '🚗 رانندگان: سریع و کاربردی',
      '🏪 فروشندگان: حرفه‌ای و مفید',
      '👨‍💼 مدیران: دقیق و تخصصی'
    ],
    color: 'purple'
  },
  {
    icon: Palette,
    title: 'انواع لحن',
    items: [
      '😊 دوستانه: گرم، صمیمی و نزدیک',
      '💼 حرفه‌ای: محترم، قابل اعتماد',
      '🚨 فوری: مهم ولی نه استرس‌زا',
      '🎉 تشویقی: مثبت و انرژی‌بخش'
    ],
    color: 'orange'
  }
];

const examples = [
  {
    icon: CheckCircle,
    title: 'مثال‌های کاربردی',
    scenarios: [
      {
        situation: 'خطا در اتصال اینترنت',
        bad: '❌ "خطا در اتصال شبکه"',
        good: '✅ "اتصال اینترنت شما قطع شده. لطفاً چک کنید"'
      },
      {
        situation: 'تایید حذف آیتم',
        bad: '❌ "آیا مطمئن هستید؟"',
        good: '✅ "این آیتم حذف میشه. مطمئنی؟"'
      },
      {
        situation: 'ثبت نام موفق',
        bad: '❌ "ثبت نام با موفقیت انجام شد"',
        good: '✅ "خوش اومدی! همه چیز آماده است"'
      }
    ]
  }
];

const ColorMap = {
  blue: 'border-blue-200 bg-blue-50',
  green: 'border-green-200 bg-green-50',
  purple: 'border-purple-200 bg-purple-50',
  orange: 'border-orange-200 bg-orange-50'
};

const IconColorMap = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  purple: 'text-purple-600',
  orange: 'text-orange-600'
};

export const UXGuide = React.forwardRef<HTMLDivElement, UXGuideProps>(
  ({ className }, ref) => {
    const [selectedGuide, setSelectedGuide] = React.useState(0);

    return (
      <div ref={ref} className={cn('space-y-6', className)}>
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">راهنمای استفاده از نازنین</h2>
          </div>
          <p className="text-gray-600 text-sm">
            چطور بهترین نتیجه رو از دستیار UX Writing بگیرید
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg">
          {guides.map((guide, index) => (
            <button
              key={index}
              onClick={() => setSelectedGuide(index)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                selectedGuide === index
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <guide.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{guide.title}</span>
            </button>
          ))}
        </div>

        {/* Selected Guide Content */}
        <div className={cn(
          'border rounded-lg p-4',
          ColorMap[guides[selectedGuide]?.color as keyof typeof ColorMap]
        )}>
          <div className="flex items-start gap-3">
            <guides[selectedGuide].icon className={cn(
              'w-6 h-6 flex-shrink-0 mt-1',
              IconColorMap[guides[selectedGuide]?.color as keyof typeof IconColorMap]
            )} />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-3">
                {guides[selectedGuide].title}
              </h3>
              <ul className="space-y-2">
                {guides[selectedGuide].items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 mt-1">•</span>
                    <span dir="rtl" className="flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Examples Section */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-3">
                مثال‌های کاربردی
              </h3>
              <div className="space-y-4">
                {examples[0].scenarios.map((scenario, index) => (
                  <div key={index} className="bg-white rounded-md p-3 border">
                    <div className="text-sm font-medium text-gray-800 mb-2">
                      📱 {scenario.situation}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="text-red-600" dir="rtl">{scenario.bad}</div>
                      <div className="text-green-600" dir="rtl">{scenario.good}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-2">💡 نکات سریع:</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• هر چه سوال شما دقیق‌تر باشد، جواب بهتری دریافت می‌کنید</li>
                <li>• از اسناد آپلود شده استفاده کنید تا جواب‌ها مطابق راهنمای شما باشد</li>
                <li>• گزینه‌های مختلف را تست کنید و بهترین را انتخاب کنید</li>
                <li>• از بخش نکات و گزینه‌های جایگزین استفاده کنید</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

UXGuide.displayName = 'UXGuide';
