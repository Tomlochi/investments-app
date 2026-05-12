import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import type { AIInsight } from '../../types';

interface InsightCardProps {
  insight: AIInsight;
  title?: string;
}

export function InsightCard({ insight, title }: InsightCardProps) {
  const sentimentConfig = {
    bullish: {
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      label: 'Bullish',
    },
    bearish: {
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'Bearish',
    },
    neutral: {
      icon: Minus,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      label: 'Neutral',
    },
  };

  const config = sentimentConfig[insight.sentiment];
  const SentimentIcon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-500" />
            {title || (insight.symbol ? `${insight.symbol} Analysis` : 'Portfolio Analysis')}
          </CardTitle>
          <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.color)}>
            <SentimentIcon className="h-3 w-3" />
            {config.label}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{insight.content}</div>

        {insight.keyPoints.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Key Points
            </div>
            <ul className="space-y-1.5">
              {insight.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
          <span>{new Date(insight.timestamp).toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function InsightLoading() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/5" />
        </div>
        <div className="pt-4 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}
