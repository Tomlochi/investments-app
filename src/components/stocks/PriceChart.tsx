import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { useGetHistoricalQuery } from '../../services/stockApi';
import { formatCurrency } from '../../lib/utils';

type TimeRange = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y';

interface PriceChartProps {
  symbol: string;
  title?: string;
}

export function PriceChart({ symbol, title }: PriceChartProps) {
  const [range, setRange] = useState<TimeRange>('1mo');
  const { data: historicalData, isLoading } = useGetHistoricalQuery({ symbol, range });

  const chartData = historicalData?.map((d) => ({
    date: new Date(d.date).toLocaleDateString(),
    price: d.close,
  })) ?? [];

  const isPositive = chartData.length > 1 && chartData[chartData.length - 1].price >= chartData[0].price;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{title || `${symbol} Price`}</CardTitle>
        <Tabs value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <TabsList className="h-8">
            <TabsTrigger value="1d" className="text-xs px-2">1D</TabsTrigger>
            <TabsTrigger value="5d" className="text-xs px-2">5D</TabsTrigger>
            <TabsTrigger value="1mo" className="text-xs px-2">1M</TabsTrigger>
            <TabsTrigger value="3mo" className="text-xs px-2">3M</TabsTrigger>
            <TabsTrigger value="1y" className="text-xs px-2">1Y</TabsTrigger>
            <TabsTrigger value="5y" className="text-xs px-2">5Y</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPositive ? '#10b981' : '#ef4444'}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={isPositive ? '#10b981' : '#ef4444'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), 'Price']}
                  contentStyle={{
                    backgroundColor: 'white',
                    borderColor: '#e5e7eb',
                    borderRadius: '8px',
                    color: '#111827',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? '#10b981' : '#ef4444'}
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MiniChart({ symbol, positive }: { symbol: string; positive: boolean }) {
  const { data: historicalData } = useGetHistoricalQuery({ symbol, range: '5d' });

  const chartData = historicalData?.map((d) => ({
    price: d.close,
  })) ?? [];

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="price"
          stroke={positive ? '#10b981' : '#ef4444'}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
