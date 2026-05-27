import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { InsightLoading } from './InsightCard';
import { useLazyGetDailyBriefQuery } from '../../services/insightsApi';
import { cn } from '../../lib/utils';
import type { RootState } from '../../store';
import type { InsightSentiment, StockBriefItem } from '../../types';

const sentimentConfig: Record<InsightSentiment, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  bullish: { icon: TrendingUp,   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30',  label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/30',    label: 'Bearish' },
  neutral: { icon: Minus,        color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Neutral' },
};

function BriefRow({ item }: { item: StockBriefItem }) {
  const cfg = sentimentConfig[item.sentiment];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className={cn('mt-0.5 shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cfg.bg, cfg.color)}>
        <Icon className="h-3 w-3" />
        {item.symbol}
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.brief}</p>
    </div>
  );
}

export function DailyBrief() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const briefRequest = useMemo(
    () => holdings.map((h) => ({ symbol: h.symbol, name: h.name })),
    [holdings]
  );

  const [trigger, { data: brief, isLoading, isFetching, isError }] = useLazyGetDailyBriefQuery();

  if (holdings.length === 0) return null;

  if (isLoading || isFetching) {
    return <InsightLoading />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-blue-500" />
            Daily Brief
          </CardTitle>
          <Button
            variant={brief ? 'outline' : 'default'}
            size="sm"
            onClick={() => trigger(briefRequest)}
          >
            {brief ? 'Refresh Brief' : 'Generate Daily Brief'}
          </Button>
        </div>
      </CardHeader>

      {isError && (
        <CardContent>
          <p className="text-sm text-red-500 dark:text-red-400">Failed to generate brief. Please try again.</p>
        </CardContent>
      )}

      {brief && !isError && (
        <CardContent className="pt-0 space-y-4">
          {/* Overall summary */}
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-3">
            {brief.overallSummary}
          </p>

          {/* Per-stock rows */}
          <div>
            {brief.stocks.map((item) => (
              <BriefRow key={item.symbol} item={item} />
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            {new Date(brief.timestamp).toLocaleString()}
          </p>
        </CardContent>
      )}

      {!brief && !isError && (
        <CardContent>
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            <p>Click "Generate Daily Brief" for a news summary of your holdings.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
