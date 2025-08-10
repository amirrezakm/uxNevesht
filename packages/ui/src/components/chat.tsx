import * as React from 'react';
import { cn, getTextDirection, copyToClipboard } from '../lib/utils';
import { User, Bot, Copy, Check } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    chunks_used?: number;
    sources?: string[];
    similarity_scores?: number[];
  };
}

export interface ChatMessageProps {
  message: Message;
  className?: string;
}

export const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ message, className }, ref) => {
    const [copied, setCopied] = React.useState(false);
    const isUser = message.role === 'user';
    const direction = getTextDirection(message.content);

    const handleCopy = async () => {
      const success = await copyToClipboard(message.content);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'message-enter flex gap-3 p-4',
          isUser ? 'justify-end' : 'justify-start',
          className
        )}
      >
        {!isUser && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        )}

        <div className={cn('flex flex-col max-w-[80%]', isUser && 'items-end')}>
          <div
            className={cn(
              'rounded-lg px-4 py-2 text-sm',
              isUser
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900 border',
              direction === 'rtl' ? 'text-right' : 'text-left'
            )}
            dir={direction}
          >
            <div className="relative group">
              <p className="whitespace-pre-wrap break-words">
                {typeof message.content === 'string' 
                  ? message.content 
                  : typeof message.content === 'object' 
                    ? 'خطا در نمایش پیام'
                    : String(message.content)
                }
              </p>
              {!isUser && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    'absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200',
                    copied && 'copy-success'
                  )}
                >
                  {copied ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Context Information */}
          {message.context && !isUser && (
            <div className="mt-1 text-xs text-gray-500">
              {message.context.chunks_used && (
                <span>استفاده از {message.context.chunks_used} قطعه متن</span>
              )}
              {message.context.sources && message.context.sources.length > 0 && (
                <div className="mt-1">
                  منابع: {message.context.sources.join('، ')}
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-gray-400 mt-1">
            {message.timestamp.toLocaleTimeString('fa-IR')}
          </div>
        </div>

        {isUser && (
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        )}
      </div>
    );
  }
);

ChatMessage.displayName = 'ChatMessage';

export interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  ({ onSendMessage, disabled = false, placeholder = 'پیام خود را بنویسید...', className }, ref) => {
    const [message, setMessage] = React.useState('');
    const [direction, setDirection] = React.useState<'ltr' | 'rtl'>('rtl');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
      if (message.trim() && !disabled) {
        onSendMessage(message.trim());
        setMessage('');
        setDirection('rtl');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessage(value);
      setDirection(getTextDirection(value));
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    };

    return (
      <div ref={ref} className={cn('flex gap-2 p-4 border-t bg-white', className)}>
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            dir={direction}
            className={cn(
              'w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-32 min-h-[40px]',
              direction === 'rtl' ? 'text-right' : 'text-left'
            )}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          className={cn(
            'self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white',
            'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          ارسال
        </button>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput'; 