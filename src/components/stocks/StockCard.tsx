import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { useGetQuoteQuery } from '../../services/stockApi';
import { formatCurrency, formatPercent, getChangeColor, cn } from '../../lib/utils';
import { MiniChart } from './PriceChart';

interface StockCardProps {
  symbol: string;
  name: string;
  quantity?: number;
  purchasePrice?: number;
  onClick?: () => void;
}

export function StockCard({ symbol, name, quantity, purchasePrice, onClick }: StockCardProps) {
  const { data: quote, isLoading } = useGetQuoteQuery(symbol, {
    pollingInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
        </CardContent>
      </Card>
    );
  }

  if (!quote) return null;

  const isPositive = quote.regularMarketChange >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Card
      className={cn('cursor-pointer transition-all hover:shadow-md', onClick && 'hover:ring-2 hover:ring-blue-500')}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{symbol}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{name}</div>
          </div>
          <div className="w-16 h-8">
            <MiniChart symbol={symbol} positive={isPositive} />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(quote.regularMarketPrice)}</div>
          <div className={cn('flex items-center gap-1 text-sm', getChangeColor(quote.regularMarketChange))}>
            <TrendIcon className="h-3 w-3" />
            <span>{formatCurrency(Math.abs(quote.regularMarketChange))}</span>
            <span>({formatPercent(quote.regularMarketChangePercent)})</span>
          </div>
        </div>

        {quantity && purchasePrice && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Shares</span>
              <span className="text-gray-900 dark:text-gray-100">{quantity}</span>
            </div>
            <div className="flex justify-between">
              <span>Value</span>
              <span className="text-gray-900 dark:text-gray-100">{formatCurrency(quantity * quote.regularMarketPrice)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
