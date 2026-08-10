import { useSelector } from 'react-redux';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/card';
import type { RootState } from '../../store';

export function GradeTrend() {
  const plans = useSelector((s: RootState) => s.tradePlan.plans);
  const theme = useSelector((s: RootState) => s.ui.theme);

  const data = plans
    .filter(p => p.status === 'closed' && p.grade && p.closedAt)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
    .map(p => ({
      date: p.closedAt!.slice(0, 10),
      score: p.grade!.score,
      symbol: p.symbol,
    }));

  const axis = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const grid = theme === 'dark' ? '#374151' : '#e5e7eb';

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Process score over time</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your discipline, independent of whether the trades made money. This is the line to grow.
        </p>
      </div>

      {data.length < 2 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Needs at least two graded trades before a trend means anything.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: axis, fontSize: 12 }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                  border: `1px solid ${grid}`,
                  borderRadius: '0.375rem',
                  fontSize: 12,
                }}
                formatter={(value) => `${value}/100`}
                labelFormatter={(label) => {
                  const point = data.find(d => d.date === label);
                  return point ? `${point.symbol} — ${label}` : String(label);
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
