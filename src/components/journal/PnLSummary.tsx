import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatCurrency, getChangeColor, cn } from '../../lib/utils';
import type { RootState } from '../../store';

export function PnLSummary() {
  const entries = useSelector((state: RootState) => state.journal.entries);
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const pnl = useMemo(() => {
    const byYear = new Map<number, number>();
    let realizedTotal = 0;

    for (const entry of entries) {
      if (entry.type === 'sell' && entry.gainLoss != null) {
        const year = new Date(entry.date).getFullYear();
        byYear.set(year, (byYear.get(year) ?? 0) + entry.gainLoss);
        realizedTotal += entry.gainLoss;
      }
    }

    let unrealized = 0;
    for (const h of holdings) {
      const currentPrice = h.currentPrice ?? h.purchasePrice;
      unrealized += h.quantity * (currentPrice - h.purchasePrice);
    }

    const currentYear = new Date().getFullYear();
    return {
      realizedTotal,
      realizedThisYear: byYear.get(currentYear) ?? 0,
      unrealized,
      years: [...byYear.entries()].sort((a, b) => b[0] - a[0]),
    };
  }, [entries, holdings]);

  const hasRealized = pnl.years.length > 0;

  const stats = [
    {
      label: 'Realized P&L (all time)',
      value: pnl.realizedTotal,
      icon: pnl.realizedTotal >= 0 ? TrendingUp : TrendingDown,
      hint: 'From sells in your journal',
    },
    {
      label: `Realized P&L (${new Date().getFullYear()})`,
      value: pnl.realizedThisYear,
      icon: pnl.realizedThisYear >= 0 ? TrendingUp : TrendingDown,
      hint: 'Relevant at tax time',
    },
    {
      label: 'Unrealized P&L',
      value: pnl.unrealized,
      icon: Wallet,
      hint: 'Paper gains on current holdings',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Profit &amp; Loss</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map(stat => (
            <div key={stat.label}>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
              <div className={cn('flex items-center gap-1.5 text-xl font-bold mt-1', getChangeColor(stat.value))}>
                <stat.icon className="h-4 w-4" />
                {formatCurrency(stat.value)}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.hint}</p>
            </div>
          ))}
        </div>

        {hasRealized && pnl.years.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Realized by year</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {pnl.years.map(([year, amount]) => (
                <span key={year} className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{year}: </span>
                  <span className={cn('font-medium', getChangeColor(amount))}>{formatCurrency(amount)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
