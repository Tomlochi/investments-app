import { useSelector } from 'react-redux';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { bySetup } from '../../lib/planMath';
import type { RootState } from '../../store';

export function SetupBreakdown() {
  const plans = useSelector((s: RootState) => s.tradePlan.plans);

  const rows = bySetup(plans).sort(
    (a, b) => (b.expectancyR ?? -Infinity) - (a.expectancyR ?? -Infinity)
  );

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">By setup</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Which kinds of trade actually work for you. The bottom row is the one to stop taking.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nothing to break down yet — close a few plans first.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="pb-2 font-medium">Setup</th>
                <th className="pb-2 text-right font-medium">Trades</th>
                <th className="pb-2 text-right font-medium">Win rate</th>
                <th className="pb-2 text-right font-medium">Expectancy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.setup} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <td className="py-2 capitalize">{r.setup.replace('-', ' ')}</td>
                  <td className="py-2 text-right">{r.count}</td>
                  <td className="py-2 text-right">
                    {r.winRate === null ? '—' : `${Math.round(r.winRate * 100)}%`}
                  </td>
                  <td
                    className={cn(
                      'py-2 text-right font-semibold',
                      r.expectancyR != null && (r.expectancyR > 0 ? 'text-green-500' : 'text-red-500')
                    )}
                  >
                    {r.expectancyR === null
                      ? '—'
                      : `${r.expectancyR > 0 ? '+' : ''}${r.expectancyR.toFixed(2)}R`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
