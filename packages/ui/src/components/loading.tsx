import * as React from 'react';
import { cn } from '../lib/utils';

export interface LoadingDotsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({ className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <div className={cn('flex space-x-1 space-x-reverse', className)}>
      <div className={cn('bg-current rounded-full dot-pulse', sizeClasses[size])} />
      <div className={cn('bg-current rounded-full dot-pulse', sizeClasses[size])} />
      <div className={cn('bg-current rounded-full dot-pulse', sizeClasses[size])} />
    </div>
  );
};

export interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('animate-spin', sizeClasses[size], className)}>
      <svg className="w-full h-full" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="opacity-25"
        />
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          className="opacity-75"
        />
      </svg>
    </div>
  );
};

export interface LoadingCardProps {
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({ className }) => {
  return (
    <div className={cn('animate-pulse', className)}>
      <div className="bg-gray-200 rounded-lg p-6">
        <div className="space-y-3">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          <div className="h-4 bg-gray-300 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  );
};

export interface LoadingMessageProps {
  message?: string;
  className?: string;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({ 
  message = 'در حال بارگذاری...', 
  className 
}) => {
  return (
    <div className={cn('flex items-center justify-center space-x-2 space-x-reverse text-gray-600', className)}>
      <LoadingSpinner size="sm" />
      <span className="text-sm">{message}</span>
    </div>
  );
};

export interface TypingIndicatorProps {
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ className }) => {
  return (
    <div className={cn('flex items-center space-x-2 space-x-reverse text-gray-500', className)}>
      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
        <LoadingDots size="sm" />
      </div>
      <span className="text-sm">در حال تایپ...</span>
    </div>
  );
}; 