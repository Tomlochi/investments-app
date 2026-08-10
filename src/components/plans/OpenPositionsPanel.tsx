import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { formatCurrency, cn } from '../../lib/utils';
import { realizedR } from '../../lib/planMath';
import { useLazyGetExitAdviceQuery } from '../../services/insightsApi';
import { useLazyGetIndicatorsQuery } from '../../services/indicatorsApi';
import { updateStop } from '../../features/tradeplan/tradePlanSlice';
import type { TradePlan, ExitAdviceResult } from '../../types';
import type { RootState, AppDispatch } from '../../store';

/** Module scope keeps the clock read out of anything the compiler treats as render. */
function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const ACTION_STYLE: Record<string, string> = {
  hold: 'text-green-600 dark:text-green-400',
  trim: 'text-amber-600 dark:text-amber-400',
  exit: 'text-red-600 dark:text-red-400',
  'raise-stop': 'text-blue-600 dark:text-blue-400',
};

export function OpenPositionsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const plans = useSelector((s: RootState) => s.tradePlan.plans);
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);

  const [advice, setAdvice] = useState<Record<string, ExitAdviceResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fetchExitAdvice] = useLazyGetExitAdviceQuery();
  const [fetchIndicators] = useLazyGetIndicatorsQuery();

  const openPlans = plans.filter(p => p.status === 'open');
  if (openPlans.length === 0) return null;

  const priceFor = (symbol: string) => holdings.find(h => h.symbol === symbol)?.currentPrice ?? null;

  const askAI = async (plan: TradePlan) => {
    const currentPrice = priceFor(plan.symbol);
    if (currentPrice == null || plan.actualEntryPrice == null || plan.initialStopPrice == null) return;

    setBusyId(plan.id);
    setErrors(e => ({ ...e, [plan.id]: '' }));

    try {
      const indicators = await fetchIndicators(plan.symbol).unwrap().catch(() => null);

      let headlines: { title: string; publisher: string }[] = [];
      try {
        const res = await fetch(`/api/news?symbols=${encodeURIComponent(plan.symbol)}`);
        if (res.ok) headlines = (await res.json())[plan.symbol] ?? [];
      } catch {
        // headlines are optional context
      }

      const result = await fetchExitAdvice({
        plan: {
          symbol: plan.symbol,
          name: plan.name,
          setup: plan.setup,
          thesis: plan.thesis,
          invalidation: plan.invalidation,
          entryPrice: plan.actualEntryPrice,
          initialStopPrice: plan.initialStopPrice,
          currentStopPrice: plan.stopPrice,
          target1: plan.target1,
          shares: plan.actualShares ?? plan.plannedShares,
          openedAt: plan.openedAt ?? plan.createdAt,
        },
        currentPrice,
        currentR: realizedR(plan.actualEntryPrice, plan.initialStopPrice, currentPrice),
        daysHeld: daysSince(plan.openedAt ?? plan.createdAt),
        indicators: indicators ?? null,
        headlines,
      }).unwrap();

      setAdvice(a => ({ ...a, [plan.id]: result }));
    } catch {
      setErrors(e => ({ ...e, [plan.id]: 'Exit advice unavailable right now.' }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Open positions</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Where each position sits between its stop and its target.
        </p>
      </div>

      <div className="space-y-4">
        {openPlans.map(plan => {
          const price = priceFor(plan.symbol);
          const r =
            price != null && plan.actualEntryPrice != null && plan.initialStopPrice != null
              ? realizedR(plan.actualEntryPrice, plan.initialStopPrice, price)
              : null;
          const belowStop = price != null && price < plan.stopPrice;

          const span = plan.target1 - plan.stopPrice;
          const progress =
            price != null && span > 0
              ? Math.max(0, Math.min(100, ((price - plan.stopPrice) / span) * 100))
              : null;

          const result = advice[plan.id];
          const error = errors[plan.id];

          return (
            <div
              key={plan.id}
              className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/stock/${plan.symbol}`}
                    className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {plan.symbol}
                  </Link>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {plan.actualShares ?? plan.plannedShares} sh
                  </span>
                  {belowStop && (
                    <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" />
                      Below your stop
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      r != null && (r > 0 ? 'text-green-500' : r < 0 ? 'text-red-500' : '')
                    )}
                  >
                    {r === null ? '—' : `${r > 0 ? '+' : ''}${r.toFixed(2)}R`}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === plan.id || price == null}
                    onClick={() => askAI(plan)}
                  >
                    {busyId === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="mr-1 h-4 w-4" />
                        Ask AI
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <div className="h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                  {progress != null && (
                    <div
                      className={cn('h-full', belowStop ? 'bg-red-500' : 'bg-blue-500')}
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>stop {formatCurrency(plan.stopPrice)}</span>
                  <span>{price != null ? formatCurrency(price) : 'price unavailable'}</span>
                  <span>target {formatCurrency(plan.target1)}</span>
                </div>
              </div>

              {error && <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>}

              {result && (
                <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
                  <div className={cn('font-semibold uppercase', ACTION_STYLE[result.action])}>
                    {result.action.replace('-', ' ')}
                  </div>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">{result.reasoning}</p>
                  {result.action === 'raise-stop' && result.suggestedStop != null && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() =>
                        dispatch(updateStop({ id: plan.id, stopPrice: result.suggestedStop! }))
                      }
                    >
                      Move stop to {formatCurrency(result.suggestedStop)}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
