import { useSelector } from 'react-redux';
import { computeSizing, plannedR } from '../../lib/planMath';
import { formatCurrency } from '../../lib/utils';
import { useGetIndicatorsQuery } from '../../services/indicatorsApi';
import { Button } from '../ui/button';
import type { RootState } from '../../store';

interface Props {
  symbol: string;
  entryHigh: number;
  stopPrice: number;
  target1: number;
  shares: number;
  onSuggestShares: (n: number) => void;
  onSuggestStop: (price: number) => void;
}

export function SizingCalculator({
  symbol,
  entryHigh,
  stopPrice,
  target1,
  shares,
  onSuggestShares,
  onSuggestStop,
}: Props) {
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);
  const cash = useSelector((s: RootState) => s.cash.balance);
  const settings = useSelector((s: RootState) => s.settings);

  const { data: indicators } = useGetIndicatorsQuery(symbol, { skip: !symbol });

  const equity =
    holdings.reduce((sum, h) => sum + h.quantity * (h.currentPrice ?? h.purchasePrice), 0) + cash;

  const sizing = computeSizing({
    equity,
    riskPerTradePercent: settings.riskPerTradePercent,
    maxPositionPercent: settings.maxPositionPercent,
    entryHigh,
    stopPrice,
  });

  const rr = plannedR(entryHigh, stopPrice, target1);
  const positionValue = shares * entryHigh;
  const positionPercent = equity > 0 ? (positionValue / equity) * 100 : 0;
  const riskDollars = shares * sizing.riskPerShare;

  const overCap = positionPercent > settings.maxPositionPercent;
  const poorRR = rr !== null && rr < 1.5;
  const atrStop = indicators?.atr14 != null ? entryHigh - 2 * indicators.atr14 : null;

  if (!sizing.valid) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
        Stop must be below the entry price. A stop at or above entry has no defined risk, so
        position size cannot be calculated.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Risk / share" value={formatCurrency(sizing.riskPerShare)} />
        <Figure label="Risk budget" value={formatCurrency(sizing.riskBudget)} />
        <Figure
          label="Risk on this trade"
          value={formatCurrency(riskDollars)}
          danger={riskDollars > sizing.riskBudget}
        />
        <Figure
          label="Position size"
          value={`${positionPercent.toFixed(1)}%`}
          danger={overCap}
        />
        <Figure label="Planned R:R" value={rr === null ? '—' : rr.toFixed(2)} danger={poorRR} />
        <Figure label="Suggested shares" value={String(sizing.finalShares)} />
      </div>

      {overCap && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Exceeds your {settings.maxPositionPercent}% max position size.
        </p>
      )}
      {poorRR && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Reward-to-risk below 1.5. The target is close relative to the risk taken.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSuggestShares(sizing.finalShares)}
        >
          Use {sizing.finalShares} shares
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atrStop === null}
          title={atrStop === null ? 'ATR unavailable for this symbol' : undefined}
          onClick={() => atrStop !== null && onSuggestStop(Number(atrStop.toFixed(2)))}
        >
          {atrStop === null ? 'ATR stop unavailable' : `Stop at 2×ATR (${formatCurrency(atrStop)})`}
        </Button>
      </div>
    </div>
  );
}

function Figure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={danger ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold'}>
        {value}
      </div>
    </div>
  );
}
