import * as React from 'react';
import { cn } from '../lib/utils';
import { Info, Zap, DollarSign, Brain } from 'lucide-react';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  provider: string;
  speed: 'fast' | 'medium' | 'slow';
  cost: 'low' | 'medium' | 'high';
  quality: 'good' | 'better' | 'best';
  contextWindow: string;
  strengths: string[];
}

export interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}

const MODEL_INFO: Record<string, ModelInfo> = {
  'openai/gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'مدل سریع و اقتصادی OpenAI',
    provider: 'OpenAI',
    speed: 'fast',
    cost: 'low',
    quality: 'good',
    contextWindow: '128K',
    strengths: ['سرعت بالا', 'کمترین هزینه', 'مناسب برای کاربردهای عمومی']
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'مدل پیشرفته چندحالته OpenAI',
    provider: 'OpenAI',
    speed: 'medium',
    cost: 'medium',
    quality: 'best',
    contextWindow: '128K',
    strengths: ['بهترین کیفیت', 'استدلال پیشرفته', 'درک عمیق متن']
  },
  'openai/gpt-4-turbo': {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'نسخه بهینه‌شده GPT-4',
    provider: 'OpenAI',
    speed: 'medium',
    cost: 'medium',
    quality: 'better',
    contextWindow: '128K',
    strengths: ['متعادل', 'کیفیت خوب', 'سرعت قابل قبول']
  },
  'anthropic/claude-3-haiku': {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'مدل سریع و کارآمد Anthropic',
    provider: 'Anthropic',
    speed: 'fast',
    cost: 'low',
    quality: 'good',
    contextWindow: '200K',
    strengths: ['سرعت بالا', 'هزینه کم', 'پاسخ‌های مفصل']
  },
  'anthropic/claude-3-sonnet': {
    id: 'anthropic/claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'مدل متعادل با کیفیت خوب',
    provider: 'Anthropic',
    speed: 'medium',
    cost: 'medium',
    quality: 'better',
    contextWindow: '200K',
    strengths: ['تعادل خوب', 'پاسخ‌های دقیق', 'تحلیل عمیق']
  },
  'anthropic/claude-3-opus': {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'قدرتمندترین مدل Anthropic',
    provider: 'Anthropic',
    speed: 'slow',
    cost: 'high',
    quality: 'best',
    contextWindow: '200K',
    strengths: ['بهترین کیفیت', 'تفکر پیچیده', 'خلاقیت بالا']
  },
  'google/gemini-flash-1.5': {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    description: 'مدل سریع Google',
    provider: 'Google',
    speed: 'fast',
    cost: 'low',
    quality: 'good',
    contextWindow: '1M',
    strengths: ['سرعت فوق‌العاده', 'حافظه بلندمدت', 'هزینه کم']
  },
  'google/gemini-pro-1.5': {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    description: 'مدل حرفه‌ای Google',
    provider: 'Google',
    speed: 'medium',
    cost: 'medium',
    quality: 'better',
    contextWindow: '1M',
    strengths: ['حافظه بلندمدت', 'کیفیت خوب', 'پردازش سریع']
  }
};

const MODEL_GROUPS = [
  {
    label: 'OpenAI Models',
    models: [
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'openai/gpt-3.5-turbo'
    ]
  },
  {
    label: 'Anthropic Models', 
    models: [
      'anthropic/claude-3-haiku',
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3-opus'
    ]
  },
  {
    label: 'Google Models',
    models: [
      'google/gemini-flash-1.5',
      'google/gemini-pro-1.5'
    ]
  }
];

function getSpeedIcon(speed: string) {
  switch (speed) {
    case 'fast': return '🚀';
    case 'medium': return '⚡';
    case 'slow': return '🐌';
    default: return '⚡';
  }
}

function getCostIcon(cost: string) {
  switch (cost) {
    case 'low': return '💚';
    case 'medium': return '💛';
    case 'high': return '💰';
    default: return '💛';
  }
}

function getQualityIcon(quality: string) {
  switch (quality) {
    case 'good': return '⭐';
    case 'better': return '⭐⭐';
    case 'best': return '⭐⭐⭐';
    default: return '⭐';
  }
}

export const ModelSelector = React.forwardRef<HTMLDivElement, ModelSelectorProps>(
  ({ selectedModel, onModelChange, className }, ref) => {
    const [showInfo, setShowInfo] = React.useState(false);
    const selectedModelInfo = MODEL_INFO[selectedModel];

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {/* Model Selection */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            مدل زبانی
          </label>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {MODEL_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.models.map((modelId) => {
                const info = MODEL_INFO[modelId];
                if (!info) return null;
                
                return (
                  <option key={modelId} value={modelId}>
                    {info.name}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>

        {/* Model Information Panel */}
        {showInfo && selectedModelInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                {selectedModelInfo.name}
              </h3>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                {selectedModelInfo.provider}
              </span>
            </div>
            
            <p className="text-sm text-gray-600">
              {selectedModelInfo.description}
            </p>

            {/* Model Metrics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span>{getSpeedIcon(selectedModelInfo.speed)}</span>
                <span className="text-gray-600">سرعت</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{getCostIcon(selectedModelInfo.cost)}</span>
                <span className="text-gray-600">هزینه</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{getQualityIcon(selectedModelInfo.quality)}</span>
                <span className="text-gray-600">کیفیت</span>
              </div>
              <div className="flex items-center gap-1">
                <Brain className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600">{selectedModelInfo.contextWindow}</span>
              </div>
            </div>

            {/* Strengths */}
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1">
                نقاط قوت:
              </h4>
              <div className="flex flex-wrap gap-1">
                {selectedModelInfo.strengths.map((strength, index) => (
                  <span
                    key={index}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ModelSelector.displayName = 'ModelSelector';
