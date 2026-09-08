import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/utils';
import { updateStopPrice } from '../../features/portfolio/portfolioSlice';
import type { RootState, AppDispatch } from '../../store';

/** Module scope keeps the clock read out of anything the compiler treats as render. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function breachedFor(iso: string): string {
  const days = daysSince(iso);
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function StopBreachBanner() {
  const dispatch = useDispatch<AppDispatch>();
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const breached = holdings.filter(h => h.stopBreachedAt != null && h.stopPrice != null);
  if (breached.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <h2 className="font-semibold text-red-800 dark:text-red-300">
          {breached.length === 1
            ? '1 position broke its stop'
            : `${breached.length} positions broke their stops`}
        </h2>
      </div>

      <ul className="mt-3 space-y-2">
        {breached.map(h => {
          const stop = h.stopPrice as number;
          const price = h.currentPrice;
          const below = price != null && stop > 0 ? ((stop - price) / stop) * 100 : null;

          return (
            <li
              key={h.symbol}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 p-2 dark:bg-gray-900/50"
            >
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <Link
                  to={`/stock/${h.symbol}`}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {h.symbol}
                </Link>
                <span className="text-gray-700 dark:text-gray-300">
                  {price != null ? formatCurrency(price) : 'price unavailable'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  stop {formatCurrency(stop)}
                  {below != null && ` · ${below.toFixed(1)}% below`}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  broke {breachedFor(h.stopBreachedAt as string)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link to={`/stock/${h.symbol}`}>
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => dispatch(updateStopPrice({ symbol: h.symbol, stopPrice: null }))}
                >
                  Clear stop
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-red-700 dark:text-red-400">
        This stays until you set a new stop or clear it. Price recovering above the stop does not dismiss it.
      </p>
    </div>
  );
}
