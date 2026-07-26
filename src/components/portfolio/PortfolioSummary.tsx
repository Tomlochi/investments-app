import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatCurrency, formatPercent, getChangeColor } from '../../lib/utils';
import type { RootState } from '../../store';

export function PortfolioSummary() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const cashBalance = useSelector((state: RootState) => state.cash.balance);

  const summary = useMemo(() => {
    let holdingsValue = 0;
    let totalCost = 0;

    holdings.forEach((holding) => {
      const currentPrice = holding.currentPrice ?? holding.purchasePrice;
      holdingsValue += holding.quantity * currentPrice;
      totalCost += holding.quantity * holding.purchasePrice;
    });

    const totalGain = holdingsValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return { totalValue: holdingsValue + cashBalance, totalCost, totalGain, totalGainPercent };
  }, [holdings, cashBalance]);

  const stats = [
    {
      label: 'Total Value',
      value: formatCurrency(summary.totalValue),
      subValue: cashBalance > 0 ? `incl. ${formatCurrency(cashBalance)} cash` : undefined,
      icon: DollarSign,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Total Cost',
      value: formatCurrency(summary.totalCost),
      icon: PieChart,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
    },
    {
      label: 'Total Gain/Loss',
      value: formatCurrency(summary.totalGain),
      subValue: formatPercent(summary.totalGainPercent),
      icon: summary.totalGain >= 0 ? TrendingUp : TrendingDown,
      color: getChangeColor(summary.totalGain),
      bgColor: summary.totalGain >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30',
    },
    {
      label: 'Holdings',
      value: holdings.length.toString(),
      icon: PieChart,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            {stat.subValue && (
              <p className={`text-xs mt-1 ${stat.color}`}>{stat.subValue}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
