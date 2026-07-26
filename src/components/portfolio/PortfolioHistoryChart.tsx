import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { useGetHistoryBatchQuery } from '../../services/stockApi';
import { formatCurrency } from '../../lib/utils';
import type { RootState } from '../../store';
import type { HistoryPoint } from '../../types';

type HistoryRange = '1mo' | '3mo' | '6mo' | '1y' | '5y';

const BENCHMARK = 'SPY';

// Validated two-series palette (dataviz skill): blue = portfolio, aqua = benchmark
const COLORS = {
  light: { portfolio: '#2a78d6', benchmark: '#1baf7a', grid: '#e1e0d9', ink: '#898781' },
  dark: { portfolio: '#3987e5', benchmark: '#199e70', grid: '#2c2c2a', ink: '#898781' },
};

function toCloseMap(points: HistoryPoint[]): Map<string, number> {
  return new Map(points.map(p => [p.date, p.close]));
}

export function PortfolioHistoryChart() {
  const [range, setRange] = useState<HistoryRange>('1y');
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const theme = useSelector((state: RootState) => state.ui.theme);
  const colors = COLORS[theme];

  const symbols = useMemo(
    () => [...holdings.map(h => h.symbol)].sort().concat(BENCHMARK),
    [holdings]
  );

  const { data: history, isLoading } = useGetHistoryBatchQuery(
    { symbols, range },
    { skip: holdings.length === 0 }
  );

  const chartData = useMemo(() => {
    if (!history) return [];
    const spine = (history[BENCHMARK] ?? []).map(p => p.date);
    if (spine.length === 0) return [];

    const closeMaps = holdings.map(h => ({
      quantity: h.quantity,
      closes: toCloseMap(history[h.symbol] ?? []),
      lastClose: (history[h.symbol] ?? [])[0]?.close ?? 0,
    }));
    const benchmarkCloses = toCloseMap(history[BENCHMARK] ?? []);

    const rows = spine.map(date => {
      let value = 0;
      for (const holding of closeMaps) {
        const close = holding.closes.get(date);
        if (close != null) holding.lastClose = close;
        value += holding.quantity * holding.lastClose;
      }
      return { date, portfolio: value, spy: benchmarkCloses.get(date) ?? null };
    });

    // Normalize the benchmark to the portfolio's starting value so both share one axis
    const firstSpy = rows.find(r => r.spy != null)?.spy;
    const firstValue = rows[0]?.portfolio;
    if (!firstSpy || !firstValue) return [];
    return rows.map(r => ({
      date: r.date,
      portfolio: Math.round(r.portfolio * 100) / 100,
      benchmark: r.spy != null ? Math.round((r.spy / firstSpy) * firstValue * 100) / 100 : null,
    }));
  }, [history, holdings]);

  const changePercent = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].portfolio;
    const last = chartData[chartData.length - 1].portfolio;
    return first > 0 ? ((last - first) / first) * 100 : null;
  }, [chartData]);

  if (holdings.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-baseline gap-3">
          <CardTitle>Portfolio vs S&amp;P 500</CardTitle>
          {changePercent != null && (
            <span className={`text-sm font-medium ${changePercent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
            </span>
          )}
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as HistoryRange)}>
          <TabsList className="h-8">
            <TabsTrigger value="1mo" className="text-xs px-2">1M</TabsTrigger>
            <TabsTrigger value="3mo" className="text-xs px-2">3M</TabsTrigger>
            <TabsTrigger value="6mo" className="text-xs px-2">6M</TabsTrigger>
            <TabsTrigger value="1y" className="text-xs px-2">1Y</TabsTrigger>
            <TabsTrigger value="5y" className="text-xs px-2">5Y</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Value of your current holdings over time; SPY is scaled to the same starting value for comparison.
        </p>
        {isLoading ? (
          <div className="h-[320px] flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={colors.grid} strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: colors.ink }}
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: colors.ink }}
                  tickFormatter={(value: number) => `$${value >= 10000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}`}
                  width={55}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(value as number),
                    name === 'portfolio' ? 'Portfolio' : 'S&P 500 (scaled)',
                  ]}
                  labelFormatter={(d) => (typeof d === 'string' ? new Date(d).toLocaleDateString() : d)}
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1a1a19' : '#fcfcfb',
                    borderColor: theme === 'dark' ? '#2c2c2a' : '#e1e0d9',
                    borderRadius: '8px',
                    color: theme === 'dark' ? '#ffffff' : '#0b0b0b',
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ color: theme === 'dark' ? '#c3c2b7' : '#52514e', fontSize: 12 }}>
                      {value === 'portfolio' ? 'Portfolio' : 'S&P 500 (scaled)'}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  stroke={colors.portfolio}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke={colors.benchmark}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
