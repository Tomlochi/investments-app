import { useSelector } from 'react-redux';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { computeScorecard } from '../../lib/planMath';
import type { RootState } from '../../store';

export function ScorecardPanel() {
  const plans = useSelector((s: RootState) => s.tradePlan.plans);
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);
  const s = computeScorecard(plans, holdings);

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Scorecard</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Based on {s.closedCount} closed plan{s.closedCount === 1 ? '' : 's'}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Row
          label="Plan coverage"
          value={pct(s.coveragePercent)}
          hint="Open positions that have a written plan."
        />
        <Row
          label="Adherence"
          value={pct(s.adherencePercent)}
          hint="Closed on a stop, target or broken thesis — not on impulse."
        />
        <Row
          label="Expectancy"
          value={s.expectancyR === null ? '—' : `${s.expectancyR > 0 ? '+' : ''}${s.expectancyR.toFixed(2)}R`}
          hint="Average R per trade. Above zero means the process makes money."
          className={cn(
            s.expectancyR != null && (s.expectancyR > 0 ? 'text-green-500' : 'text-red-500')
          )}
        />
        <Row label="Win rate" value={pct(s.winRate === null ? null : s.winRate * 100)} hint="Share of closed trades that made money." />
        <Row label="Avg win" value={s.avgWinR === null ? '—' : `+${s.avgWinR.toFixed(2)}R`} hint="Mean size of a winner." />
        <Row label="Avg loss" value={s.avgLossR === null ? '—' : `−${s.avgLossR.toFixed(2)}R`} hint="Mean size of a loser." />
      </div>

      <div className="grid gap-4 border-t border-gray-200 pt-4 dark:border-gray-700 sm:grid-cols-2">
        <Row
          label="Cut winners early"
          value={String(s.cutWinnersEarly)}
          hint="Profitable trades closed on impulse before reaching the target."
          className={s.cutWinnersEarly > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <Row
          label="Held losers"
          value={String(s.heldLosers)}
          hint="Trades exited below your own stop — the stop was passed and you stayed in."
          className={s.heldLosers > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
      </div>
    </Card>
  );
}

function pct(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function Row({
  label, value, hint, className,
}: { label: string; value: string; hint: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn('text-xl font-semibold', className)}>{value}</div>
      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}
