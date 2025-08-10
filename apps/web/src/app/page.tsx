import React from 'react';
import Link from 'next/link';
import { Button } from '@ux-nevesht/ui';
import { MessageSquare, FileText, Sparkles, Users, Zap, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Sparkles className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">UX نوِشت</h1>
            </div>
            <nav className="flex space-x-4 space-x-reverse">
              <Link href="/examples">
                <Button variant="outline" size="sm">
                  <Sparkles className="h-4 w-4 ml-2" />
                  مثال‌ها
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 ml-2" />
                  چت
                </Button>
              </Link>
              <Link href="/documents">
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 ml-2" />
                  اسناد
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            دستیار هوش مصنوعی نویسندگی تجربه کاربری
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            با استفاده از راهنماهای UX تیم اسنپ، متن‌های کاربری مناسب و متنوع برای 
            اپلیکیشن‌های موبایل تولید کنید
          </p>
          <div className="flex justify-center space-x-4 space-x-reverse">
            <Link href="/chat">
              <Button size="lg" className="text-lg px-8 py-3">
                <MessageSquare className="h-5 w-5 ml-2" />
                شروع چت
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                <FileText className="h-5 w-5 ml-2" />
                مدیریت اسناد
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <Sparkles className="h-6 w-6 text-blue-600 ml-2" />
              <h3 className="text-lg font-semibold">تولید خودکار متن</h3>
            </div>
            <p className="text-gray-600">
              با استفاده از هوش مصنوعی و راهنماهای موجود، متن‌های مناسب برای 
              انواع المان‌های رابط کاربری تولید کنید
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <Users className="h-6 w-6 text-green-600 ml-2" />
              <h3 className="text-lg font-semibold">متناسب با مخاطب</h3>
            </div>
            <p className="text-gray-600">
              متن‌هایی تولید کنید که مناسب کاربران مختلف اسنپ از جمله رانندگان، 
              کاربران عادی و فروشندگان باشد
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <Zap className="h-6 w-6 text-yellow-600 ml-2" />
              <h3 className="text-lg font-semibold">سریع و کارآمد</h3>
            </div>
            <p className="text-gray-600">
              در کمتر از ۳ ثانیه چندین گزینه متنی دریافت کنید و آن‌ها را 
              مستقیماً کپی کنید
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <FileText className="h-6 w-6 text-purple-600 ml-2" />
              <h3 className="text-lg font-semibold">مبتنی بر راهنما</h3>
            </div>
            <p className="text-gray-600">
              تمام متن‌های تولیدی بر اساس راهنماهای UX Writing تیم اسنپ 
              و استانداردهای برند تولید می‌شوند
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <Shield className="h-6 w-6 text-red-600 ml-2" />
              <h3 className="text-lg font-semibold">حفظ هویت برند</h3>
            </div>
            <p className="text-gray-600">
              لحن و سبک نوشتاری مطابق با هویت اسنپ و فرهنگ ایرانی 
              در نظر گرفته می‌شود
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <MessageSquare className="h-6 w-6 text-indigo-600 ml-2" />
              <h3 className="text-lg font-semibold">گزینه‌های متنوع</h3>
            </div>
            <p className="text-gray-600">
              برای هر درخواست حداقل ۳ گزینه مختلف دریافت کنید تا بهترین 
              متن را انتخاب کنید
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-lg p-8 text-center shadow-md">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            آماده برای شروع هستید؟
          </h3>
          <p className="text-gray-600 mb-6">
            ابتدا راهنماهای UX Writing خود را آپلود کنید و سپس شروع به تولید متن کنید
          </p>
          <div className="flex justify-center space-x-4 space-x-reverse flex-wrap gap-2">
            <Link href="/examples">
              <Button variant="outline" size="lg">
                <Sparkles className="h-5 w-5 ml-2" />
                مشاهده مثال‌ها
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" size="lg">
                <FileText className="h-5 w-5 ml-2" />
                آپلود راهنماها
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="lg">
                <MessageSquare className="h-5 w-5 ml-2" />
                شروع چت
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>طراحی شده برای تیم UX اسنپ | ۱۴۰۳</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 