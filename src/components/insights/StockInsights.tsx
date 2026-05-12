import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { InsightCard, InsightLoading } from './InsightCard';
import { useLazyGetStockInsightQuery } from '../../services/insightsApi';
import { useGetQuoteQuery } from '../../services/stockApi';
import type { Stock } from '../../types';

interface StockInsightsProps {
  holding: Stock;
}

export function StockInsights({ holding }: StockInsightsProps) {
  const { data: quote } = useGetQuoteQuery(holding.symbol);

  const [trigger, { data: insight, isLoading, isFetching }] = useLazyGetStockInsightQuery();

  const handleAnalyze = () => {
    trigger({
      symbol: holding.symbol,
      name: holding.name,
      currentPrice: quote?.regularMarketPrice ?? holding.currentPrice ?? holding.purchasePrice,
      changePercent: quote?.regularMarketChangePercent ?? 0,
      quantity: holding.quantity,
      purchasePrice: holding.purchasePrice,
    });
  };

  if (isLoading || isFetching) {
    return <InsightLoading />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-blue-500" />
            AI Stock Analysis
          </CardTitle>
          <Button
            variant={insight ? 'outline' : 'default'}
            size="sm"
            onClick={handleAnalyze}
            disabled={!quote}
          >
            {insight ? 'Refresh Analysis' : 'Analyze Stock'}
          </Button>
        </div>
      </CardHeader>

      {insight ? (
        <CardContent className="pt-0">
          <InsightCard insight={insight} />
        </CardContent>
      ) : (
        <CardContent>
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            <p>Click "Analyze Stock" to get AI-powered insights for {holding.symbol}.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

