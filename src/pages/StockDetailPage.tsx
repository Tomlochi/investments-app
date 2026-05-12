import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PriceChart } from '../components/stocks/PriceChart';
import { StockInsights } from '../components/insights/StockInsights';
import { useGetQuoteQuery } from '../services/stockApi';
import { formatCurrency, formatPercent, getChangeColor, cn } from '../lib/utils';
import type { RootState } from '../store';

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const holding = holdings.find((h) => h.symbol === symbol);

  const { data: quote, isLoading } = useGetQuoteQuery(symbol ?? '', {
    skip: !symbol,
  });

  if (!holding || !symbol) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolio
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
            <p>Stock not found in your portfolio.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPrice = quote?.regularMarketPrice ?? holding.currentPrice ?? holding.purchasePrice;
  const change = quote?.regularMarketChange ?? 0;
  const changePercent = quote?.regularMarketChangePercent ?? 0;
  const isPositive = change >= 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  const costBasis = holding.quantity * holding.purchasePrice;
  const marketValue = holding.quantity * currentPrice;
  const gain = marketValue - costBasis;
  const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Portfolio
      </Link>

      {/* Stock Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{symbol}</CardTitle>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{holding.name}</p>
            </div>

            {!isLoading && (
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(currentPrice)}
                </div>
                <div className={cn('flex items-center justify-end gap-1 mt-1', getChangeColor(changePercent))}>
                  <ChangeIcon className="h-4 w-4" />
                  <span className="font-medium">
                    {formatCurrency(Math.abs(change))} ({formatPercent(changePercent)})
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <StatItem label="Shares Held" value={holding.quantity.toString()} />
            <StatItem label="Avg Cost" value={formatCurrency(holding.purchasePrice)} />
            <StatItem label="Market Value" value={formatCurrency(marketValue)} />
            <StatItem
              label="Total Gain/Loss"
              value={`${formatCurrency(gain)} (${formatPercent(gainPercent)})`}
            />
            {quote?.marketCap && (
              <StatItem
                label="Market Cap"
                value={`$${(quote.marketCap / 1e9).toFixed(2)}B`}
              />
            )}
            {quote?.regularMarketVolume && (
              <StatItem
                label="Volume"
                value={quote.regularMarketVolume.toLocaleString()}
              />
            )}
            {quote?.fiftyTwoWeekHigh && quote?.fiftyTwoWeekLow && (
              <StatItem
                label="52-Week Range"
                value={`${formatCurrency(quote.fiftyTwoWeekLow)} – ${formatCurrency(quote.fiftyTwoWeekHigh)}`}
              />
            )}
            {quote?.regularMarketOpen && (
              <StatItem label="Open" value={formatCurrency(quote.regularMarketOpen)} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Chart */}
      <PriceChart symbol={symbol} title={`${symbol} Price History`} />

      {/* AI Analysis — fires only when this page is visited */}
      <StockInsights holding={holding} />
    </div>
  );
}
