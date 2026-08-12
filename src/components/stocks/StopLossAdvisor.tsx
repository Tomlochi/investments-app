import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Shield, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/utils';
import { stopDistancePercent, stopWarning } from '../../lib/stopAdvice';
import { useLazyGetStopAdviceQuery } from '../../services/insightsApi';
import { useLazyGetIndicatorsQuery } from '../../services/indicatorsApi';
import { updateStopPrice } from '../../features/portfolio/portfolioSlice';
import type { AppDispatch } from '../../store';
import type { Stock, StopAdviceResult } from '../../types';

interface StopLossAdvisorProps {
  holding: Stock;
  currentPrice: number;
}

export function StopLossAdvisor({ holding, currentPrice }: StopLossAdvisorProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [result, setResult] = useState<StopAdviceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [fetchStopAdvice] = useLazyGetStopAdviceQuery();
  const [fetchIndicators] = useLazyGetIndicatorsQuery();

  const currentStop = holding.stopPrice ?? null;
  const priceIsUsable = Number.isFinite(currentPrice) && currentPrice > 0;
  const belowStop = currentStop !== null && currentPrice < currentStop;
  const currentStopDistance = currentStop !== null ? stopDistancePercent(currentStop, currentPrice) : null;

  const handleSuggest = async () => {
    if (!priceIsUsable) return;
    setLoading(true);
    setError(false);
    try {
      // Indicators are context, not a hard requirement — a failure here still produces advice.
      const indicators = await fetchIndicators(holding.symbol).unwrap().catch(() => null);

      const advice = await fetchStopAdvice({
        symbol: holding.symbol,
        name: holding.name,
        currentPrice,
        purchasePrice: holding.purchasePrice,
        currentStop,
        indicators: indicators ?? null,
      }).unwrap();

      setResult(advice);
    } catch (e) {
      console.error('Stop advice error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const warning = result ? stopWarning(result.suggestedStop, currentPrice) : null;
  const suggestedDistance = result ? stopDistancePercent(result.suggestedStop, currentPrice) : null;
  const canAccept = result !== null && Number.isFinite(result.suggestedStop) && result.suggestedStop > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-500" />
          Stop Loss
        </CardTitle>
        <Button
          size="sm"
          variant={result ? 'outline' : 'default'}
          className="gap-1.5"
          onClick={handleSuggest}
          disabled={loading || !priceIsUsable}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Analyzing...' : result ? 'Re-analyze' : 'Suggest stop'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {currentStop !== null ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Your stop:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(currentStop)}
            </span>
            {currentStopDistance !== null && !belowStop && (
              <span className="text-gray-500 dark:text-gray-400">
                ({currentStopDistance.toFixed(1)}% below current price)
              </span>
            )}
            {belowStop && (
              <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                Price is below your stop
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No stop set for {holding.symbol}. Get a suggestion based on the current chart, then set the order in your broker.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Stop suggestion unavailable right now. Try again in a moment.
          </p>
        )}

        {result && !loading && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/20">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm text-blue-800 dark:text-blue-300">Suggested stop</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(result.suggestedStop)}
              </span>
              {suggestedDistance !== null && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  ({suggestedDistance.toFixed(1)}% below current price)
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{result.reasoning}</p>

            {warning && (
              <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {warning}
              </p>
            )}

            {canAccept && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  dispatch(updateStopPrice({ symbol: holding.symbol, stopPrice: result.suggestedStop }))
                }
              >
                Set stop to {formatCurrency(result.suggestedStop)}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
