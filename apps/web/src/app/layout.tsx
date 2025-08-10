import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import React from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UX Nevesht - دستیار نویسندگی تجربه کاربری',
  description: 'دستیار هوش مصنوعی برای تولید متن‌های کاربری فارسی - طراحی شده برای تیم UX اسنپ',
  keywords: ['UX Writing', 'فارسی', 'اسنپ', 'متن کاربری', 'Microcopy'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100;200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Iran+Sans:wght@100;200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} font-vazir antialiased`}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
} 