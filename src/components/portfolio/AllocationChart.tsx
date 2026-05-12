import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatCurrency, formatPercent } from '../../lib/utils';
import type { RootState } from '../../store';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export function AllocationChart() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const data = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => {
      const price = h.currentPrice ?? h.purchasePrice;
      return sum + h.quantity * price;
    }, 0);

    return holdings.map((h) => {
      const price = h.currentPrice ?? h.purchasePrice;
      const value = h.quantity * price;
      return {
        name: h.symbol,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      };
    }).sort((a, b) => b.value - a.value);
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            Add holdings to see allocation
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(value as number),
                  name as string,
                ]}
                contentStyle={{
                  backgroundColor: 'white',
                  borderColor: '#e5e7eb',
                  borderRadius: '8px',
                  color: '#111827',
                }}
              />
              <Legend
                formatter={(value: string, entry: { payload?: { percent?: number } }) => (
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {value} ({formatPercent(entry.payload?.percent ?? 0).replace('+', '')})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
