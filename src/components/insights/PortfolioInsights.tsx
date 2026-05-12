import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { InsightCard, InsightLoading } from './InsightCard';
import { useLazyGetPortfolioInsightQuery } from '../../services/insightsApi';
import type { RootState } from '../../store';

export function PortfolioInsights() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const portfolioRequest = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => {
      const price = h.currentPrice ?? h.purchasePrice;
      return sum + h.quantity * price;
    }, 0);

    const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.purchasePrice, 0);
    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return {
      holdings: holdings.map((h) => {
        const currentPrice = h.currentPrice ?? h.purchasePrice;
        const value = h.quantity * currentPrice;
        return {
          symbol: h.symbol,
          name: h.name,
          quantity: h.quantity,
          purchasePrice: h.purchasePrice,
          currentPrice,
          weight: totalValue > 0 ? value / totalValue : 0,
        };
      }),
      totalValue,
      totalGain,
      totalGainPercent,
    };
  }, [holdings]);

  const [trigger, { data: insight, isLoading, isFetching }] = useLazyGetPortfolioInsightQuery();

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Portfolio Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Add holdings to your portfolio to get AI-powered insights.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || isFetching) {
    return <InsightLoading />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            AI Portfolio Insights
          </CardTitle>
          <Button
            variant={insight ? 'outline' : 'default'}
            size="sm"
            onClick={() => trigger(portfolioRequest)}
          >
            {insight ? 'Refresh Analysis' : 'Analyze Portfolio'}
          </Button>
        </div>
      </CardHeader>

      {insight ? (
        <CardContent className="pt-0">
          <InsightCard insight={insight} title="Portfolio Analysis" />
        </CardContent>
      ) : (
        <CardContent>
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            <p>Click "Analyze Portfolio" to get AI-powered insights.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
