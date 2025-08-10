'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button, ChatMessage, ChatInput, LoadingMessage, ModelSelector, UXResponse, UXGuide } from '@ux-nevesht/ui';
import { ArrowLeft, FileText, HelpCircle, Sparkles, MessageSquare, BookOpen, Settings } from 'lucide-react';
import { chatApi, ChatResponse } from '../../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  uxResponse?: ChatResponse;
  context?: {
    chunks_used?: number;
    sources?: string[];
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '🎨 سلام! من نازنین هستم، متخصص UX Writing اسنپ!\n\nآماده‌ام تا بهترین متن‌ها رو برای شما بسازم. چه نوع متنی نیاز دارید؟\n\n💡 نکته: هر چه سوال شما دقیق‌تر باشد، جواب بهتری دریافت می‌کنید!',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<string>('openai/gpt-4o-mini');
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Make actual API call
      const response = await chatApi.sendMessage(content, undefined, 'friendly', model);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.options 
          ? '✨ نازنین چندین گزینه برای شما آماده کرده:' 
          : (typeof response.response === 'string' ? response.response : 'پاسخی دریافت نشد'),
        timestamp: new Date(),
        uxResponse: response,
        context: response.meta ? {
          chunks_used: response.meta.chunks_used,
          sources: response.meta.sources,
        } : (response.context || {}),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error message to user
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '😔 متأسفانه خطایی رخ داده! لطفاً:\n• از اتصال اینترنت مطمئن شوید\n• API سرور در حال اجرا باشد\n• دوباره تلاش کنید',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="hover:bg-gray-50">
                <ArrowLeft className="h-4 w-4 ml-2" />
                بازگشت
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">نازنین - دستیار UX Writing</h1>
                <p className="text-xs text-gray-500">متخصص تولید متن اسنپ</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/examples">
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 ml-2" />
                مثال‌ها
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowGuide(!showGuide)}
              className={showGuide ? 'bg-blue-50 border-blue-200' : ''}
            >
              <BookOpen className="h-4 w-4 ml-2" />
              راهنما
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
              className={showSettings ? 'bg-gray-50' : ''}
            >
              <Settings className="h-4 w-4 ml-2" />
              تنظیمات
            </Button>
            <Link href="/documents">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 ml-2" />
                اسناد
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex gap-6 p-4 h-[calc(100vh-80px)]">
        {/* Sidebar - Guide */}
        {showGuide && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 h-full overflow-y-auto">
              <div className="p-4">
                <UXGuide />
              </div>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-5 h-5 text-gray-600" />
                <h3 className="font-medium text-gray-900">تنظیمات</h3>
              </div>
              <ModelSelector
                selectedModel={model}
                onModelChange={setModel}
                className="w-full"
              />
            </div>
          )}

          {/* Chat Container */}
          <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            {/* Chat Messages */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-6"
            >
              {messages.map((message) => (
                <div key={message.id} className="space-y-4">
                  <ChatMessage message={message} />
                  {message.uxResponse && (
                    <div className="mr-11">
                      <UXResponse 
                        options={message.uxResponse.options}
                        insights={message.uxResponse.insights}
                        alternatives={message.uxResponse.alternatives}
                        meta={message.uxResponse.meta}
                      />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-center gap-3 p-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
                  </div>
                  <LoadingMessage message="نازنین در حال آماده کردن بهترین گزینه‌ها برای شما..." />
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Enhanced Chat Input */}
            <div className="border-t border-gray-200 bg-white/50">
              <div className="p-4">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isLoading}
                  placeholder="🎯 درخواست دقیق خود را بنویسید... مثال: متن خطا برای پرداخت ناموفق با لحن آرامش‌بخش"
                  className="border-0 bg-white rounded-lg shadow-sm"
                />
                
                {/* Quick Suggestions */}
                {messages.length <= 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 mr-2">💡 پیشنهادات:</span>
                    {[
                      'متن دکمه ثبت نام',
                      'پیام خطا برای اتصال اینترنت',
                      'خوشامدگویی برای کاربران جدید',
                      'تایید حذف آیتم'
                    ].map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSendMessage(suggestion)}
                        disabled={isLoading}
                        className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 