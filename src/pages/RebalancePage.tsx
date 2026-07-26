import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Scale, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useGetQuoteQuery } from '../services/stockApi';
import { useLazyGetRebalancePlanQuery } from '../services/insightsApi';
import { updateCurrentPrice } from '../features/portfolio/portfolioSlice';
import { setTarget } from '../features/rebalance/rebalanceSlice';
import { formatCurrency, cn } from '../lib/utils';
import type { RootState, AppDispatch } from '../store';

// Renders nothing; keeps redux currentPrice fresh for one symbol (same pattern as HoldingsList)
function PriceRefresher({ symbol }: { symbol: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const { data: quote } = useGetQuoteQuery(symbol, { pollingInterval: 60000 });

  useEffect(() => {
    if (quote?.regularMarketPrice) {
      dispatch(updateCurrentPrice({ symbol, price: quote.regularMarketPrice }));
    }
  }, [quote, symbol, dispatch]);

  return null;
}

const CASH_TARGET_KEY = '$CASH';

export function RebalancePage() {
  const dispatch = useDispatch<AppDispatch>();
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const targets = useSelector((state: RootState) => state.rebalance.targets);
  const cashBalance = useSelector((state: RootState) => state.cash.balance);
  const [generatePlan, { data: plan, isFetching, error }] = useLazyGetRebalancePlanQuery();

  const rows = useMemo(() => {
    const holdingsValue = holdings.reduce(
      (sum, h) => sum + h.quantity * (h.currentPrice ?? h.purchasePrice),
      0
    );
    const totalValue = holdingsValue + cashBalance;
    const cashTargetPercent = targets.find(t => t.symbol === CASH_TARGET_KEY)?.targetPercent ?? 0;
    const cashCurrentPercent = totalValue > 0 ? (cashBalance / totalValue) * 100 : 0;
    return {
      totalValue,
      cashTargetPercent,
      cashCurrentPercent,
      cashDrift: cashCurrentPercent - cashTargetPercent,
      holdings: holdings.map(h => {
        const price = h.currentPrice ?? h.purchasePrice;
        const value = h.quantity * price;
        const currentPercent = totalValue > 0 ? (value / totalValue) * 100 : 0;
        const targetPercent = targets.find(t => t.symbol === h.symbol)?.targetPercent ?? 0;
        return { ...h, price, value, currentPercent, targetPercent, drift: currentPercent - targetPercent };
      }),
    };
  }, [holdings, targets, cashBalance]);

  const targetSum = rows.holdings.reduce((sum, h) => sum + h.targetPercent, 0) + rows.cashTargetPercent;
  const targetsValid = Math.abs(targetSum - 100) < 0.5;

  const handleGenerate = () => {
    generatePlan({
      totalValue: rows.totalValue,
      cashBalance,
      cashTargetPercent: rows.cashTargetPercent,
      holdings: rows.holdings.map(h => ({
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        currentPrice: h.price,
        currentPercent: h.currentPercent,
        targetPercent: h.targetPercent,
      })),
    });
  };

  if (holdings.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Rebalance</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add holdings to your portfolio first, then set target allocations here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {holdings.map(h => (
        <PriceRefresher key={h.symbol} symbol={h.symbol} />
      ))}

      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rebalance</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Target allocation</CardTitle>
          <span
            className={cn(
              'text-sm font-medium',
              targetsValid ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'
            )}
          >
            Total: {targetSum.toFixed(1)}%
          </span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium">Symbol</th>
                  <th className="pb-2 pr-4 font-medium text-right">Value</th>
                  <th className="pb-2 pr-4 font-medium text-right">Current %</th>
                  <th className="pb-2 pr-4 font-medium text-right">Target %</th>
                  <th className="pb-2 font-medium text-right">Drift</th>
                </tr>
              </thead>
              <tbody>
                {rows.holdings.map(h => (
                  <tr key={h.symbol} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-gray-100">{h.symbol}</td>
                    <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">{formatCurrency(h.value)}</td>
                    <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">{h.currentPercent.toFixed(1)}%</td>
                    <td className="py-3 pr-4 text-right">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={h.targetPercent}
                        onChange={(e) =>
                          dispatch(setTarget({ symbol: h.symbol, targetPercent: Number(e.target.value) || 0 }))
                        }
                        className="w-20 h-8 text-right ml-auto"
                      />
                    </td>
                    <td
                      className={cn(
                        'py-3 text-right font-medium',
                        Math.abs(h.drift) < 2
                          ? 'text-gray-500 dark:text-gray-400'
                          : h.drift > 0
                            ? 'text-amber-600 dark:text-amber-500'
                            : 'text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {h.drift >= 0 ? '+' : ''}{h.drift.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-100 last:border-0 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-gray-100">Cash</td>
                  <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">{formatCurrency(cashBalance)}</td>
                  <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">{rows.cashCurrentPercent.toFixed(1)}%</td>
                  <td className="py-3 pr-4 text-right">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={rows.cashTargetPercent}
                      onChange={(e) =>
                        dispatch(setTarget({ symbol: CASH_TARGET_KEY, targetPercent: Number(e.target.value) || 0 }))
                      }
                      className="w-20 h-8 text-right ml-auto"
                    />
                  </td>
                  <td
                    className={cn(
                      'py-3 text-right font-medium',
                      Math.abs(rows.cashDrift) < 2
                        ? 'text-gray-500 dark:text-gray-400'
                        : rows.cashDrift > 0
                          ? 'text-amber-600 dark:text-amber-500'
                          : 'text-blue-600 dark:text-blue-400'
                    )}
                  >
                    {rows.cashDrift >= 0 ? '+' : ''}{rows.cashDrift.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            {!targetsValid ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Targets must add up to 100% before generating a plan.
              </p>
            ) : <span />}
            <Button onClick={handleGenerate} disabled={!targetsValid || isFetching} className="gap-2">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isFetching ? 'Generating...' : 'Generate AI plan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error != null && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to generate a plan. Check your API key and try again.
            </p>
          </CardContent>
        </Card>
      )}

      {plan && !isFetching && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Suggested plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">{plan.summary}</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4 font-medium">Symbol</th>
                    <th className="pb-2 pr-4 font-medium">Action</th>
                    <th className="pb-2 pr-4 font-medium text-right">Shares</th>
                    <th className="pb-2 pr-4 font-medium text-right">Est. amount</th>
                    <th className="pb-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.actions.map((a, i) => (
                    <tr key={`${a.symbol}-${i}`} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-gray-100">{a.symbol}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            'text-xs font-semibold uppercase px-2 py-0.5 rounded',
                            a.action === 'buy' && 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                            a.action === 'sell' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                            a.action === 'hold' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          )}
                        >
                          {a.action}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">
                        {a.action === 'hold' ? '—' : a.shares}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">
                        {a.action === 'hold' ? '—' : formatCurrency(a.estimatedAmount)}
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {plan.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Before you trade</span>
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  {plan.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-amber-800 dark:text-amber-300">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              AI-generated suggestion, not professional financial advice. Review before trading.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
