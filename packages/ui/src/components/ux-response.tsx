import * as React from 'react';
import { cn, copyToClipboard } from '../lib/utils';
import { Copy, Check, Lightbulb, Heart, Sparkles, Info } from 'lucide-react';

export interface UXOption {
  text: string;
  tone: string;
  length: string;
  context: string;
  emotion?: string;
}

export interface UXResponseProps {
  options?: UXOption[];
  insights?: string;
  alternatives?: string | UXOption[];
  meta?: {
    chunks_used: number;
    sources: string[];
    quality_score: number;
    has_relevant_context: boolean;
    generated_at: string;
  };
  className?: string;
}

const EmotionIcon = ({ emotion }: { emotion?: string }) => {
  switch (emotion?.toLowerCase()) {
    case 'مثبت':
    case 'خوشحال':
    case 'شاد':
      return <Heart className="w-4 h-4 text-red-500" />;
    case 'تشویقی':
    case 'انرژی':
      return <Sparkles className="w-4 h-4 text-yellow-500" />;
    default:
      return <Sparkles className="w-4 h-4 text-blue-500" />;
  }
};

const ToneColor = (tone: string) => {
  switch (tone.toLowerCase()) {
    case 'دوستانه':
    case 'friendly':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'حرفه‌ای':
    case 'professional':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'تشویقی':
    case 'encouraging':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'فوری':
    case 'urgent':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export const UXResponse = React.forwardRef<HTMLDivElement, UXResponseProps>(
  ({ options, insights, alternatives, meta, className }, ref) => {
    const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

    const handleCopy = async (text: string, index: number) => {
      const success = await copyToClipboard(text);
      if (success) {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    };

    if (!options || options.length === 0) {
      return null;
    }

    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        {/* Response Header */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>نازنین {options.length} گزینه برای شما آماده کرده:</span>
          {meta?.has_relevant_context && (
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
              <Info className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-700">بر اساس اسناد شما</span>
            </div>
          )}
        </div>

        {/* Options Grid */}
        <div className="grid gap-3">
          {options.map((option, index) => (
            <div
              key={index}
              className="group bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-blue-300"
            >
              {/* Option Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium border',
                    ToneColor(option.tone)
                  )}>
                    {option.tone}
                  </span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded-full text-xs">
                    {option.length}
                  </span>
                  {option.emotion && (
                    <div className="flex items-center gap-1">
                      <EmotionIcon emotion={option.emotion} />
                      <span className="text-xs text-gray-500">{option.emotion}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(option.text, index)}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-gray-100',
                    copiedIndex === index && 'copy-success bg-green-50'
                  )}
                  title="کپی متن"
                >
                  {copiedIndex === index ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Main Text */}
              <div className="mb-3">
                <p className="text-lg font-medium text-gray-900 leading-relaxed" dir="rtl">
                  "{option.text}"
                </p>
              </div>

              {/* Context */}
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md">
                <span className="font-medium">کاربرد: </span>
                {option.context}
              </div>
            </div>
          ))}
        </div>

        {/* Insights Section */}
        {insights && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-2">💡 نکات مهم:</h4>
                <p className="text-blue-800 text-sm leading-relaxed" dir="rtl">
                  {insights}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alternatives Section */}
        {alternatives && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="w-full">
                <h4 className="font-medium text-gray-900 mb-3">🔄 گزینه‌های دیگر:</h4>
                {typeof alternatives === 'string' ? (
                  <p className="text-gray-700 text-sm leading-relaxed" dir="rtl">
                    {alternatives}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {alternatives.map((alt, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900" dir="rtl">"{alt.text}"</span>
                          <span className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium border',
                            ToneColor(alt.tone)
                          )}>
                            {alt.tone}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {alt.length}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(alt.text, `alt-${index}`)}
                          className={cn(
                            'p-1.5 rounded-md hover:bg-gray-100 transition-colors',
                            copiedIndex === `alt-${index}` && 'copy-success bg-green-50'
                          )}
                          title="کپی متن"
                        >
                          {copiedIndex === `alt-${index}` ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Meta Information */}
        {meta && (
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t">
            <div className="flex items-center gap-4">
              {meta.chunks_used > 0 && (
                <span>📚 {meta.chunks_used} منبع استفاده شده</span>
              )}
              {meta.sources.length > 0 && (
                <span>📄 از: {meta.sources.join('، ')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                meta.quality_score > 0.4 ? 'bg-green-400' : 'bg-yellow-400'
              )} />
              <span>
                {new Date(meta.generated_at).toLocaleTimeString('fa-IR')}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

UXResponse.displayName = 'UXResponse';
