import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { computeScorecard, unplannedSymbols } from '../../lib/planMath';
import type { RootState } from '../../store';

export function DisciplineCard() {
  const plans = useSelector((s: RootState) => s.tradePlan.plans);
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);

  const s = computeScorecard(plans, holdings);
  const unplanned = unplannedSymbols(plans, holdings);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
          <Gauge className="h-4 w-4" />
          Discipline
        </h2>
        <Link to="/performance" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Details
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Plan coverage" value={pct(s.coveragePercent)} />
        <Stat label="Adherence" value={pct(s.adherencePercent)} />
        <Stat
          label="Expectancy"
          value={s.expectancyR === null ? '—' : `${s.expectancyR > 0 ? '+' : ''}${s.expectancyR.toFixed(2)}R`}
          className={cn(
            s.expectancyR != null && (s.expectancyR > 0 ? 'text-green-500' : 'text-red-500')
          )}
        />
        <Stat label="Avg process" value={s.avgGrade === null ? '—' : `${Math.round(s.avgGrade)}/100`} />
      </div>

      {unplanned.length > 0 && (
        <Link
          to="/plans"
          className="block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          {unplanned.length} unplanned position{unplanned.length === 1 ? '' : 's'}: {unplanned.join(', ')}
        </Link>
      )}
    </Card>
  );
}

function pct(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn('text-lg font-semibold', className)}>{value}</div>
    </div>
  );
}
