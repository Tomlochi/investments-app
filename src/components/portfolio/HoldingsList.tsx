import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useGetQuoteQuery } from '../../services/stockApi';
import { updateCurrentPrice, removeHolding } from '../../features/portfolio/portfolioSlice';
import { openEditHoldingModal } from '../../features/ui/uiSlice';
import { closePlan } from '../../features/tradeplan/tradePlanSlice';
import { formatCurrency, formatPercent, getChangeColor, cn } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';
import type { Stock } from '../../types';

function HoldingRow({ holding }: { holding: Stock }) {
  const dispatch = useDispatch<AppDispatch>();
  const openPlanForSymbol = useSelector((state: RootState) =>
    state.tradePlan.plans.find(p => p.status === 'open' && p.symbol === holding.symbol)
  );
  const { data: quote } = useGetQuoteQuery(holding.symbol, {
    pollingInterval: 60000,
  });

  useEffect(() => {
    if (quote?.regularMarketPrice) {
      dispatch(updateCurrentPrice({ symbol: holding.symbol, price: quote.regularMarketPrice }));
    }
  }, [quote, holding.symbol, dispatch]);

  const currentPrice = quote?.regularMarketPrice ?? holding.currentPrice ?? holding.purchasePrice;

  // Deleting a holding out from under an open plan is by definition an unplanned
  // exit, so it is recorded as one rather than leaving the plan orphaned.
  const handleDelete = () => {
    if (openPlanForSymbol) {
      const ok = window.confirm(
        `${holding.symbol} has an open trade plan. Deleting the holding will close that plan as a discretionary exit at ${currentPrice.toFixed(2)}. Continue?`
      );
      if (!ok) return;
      dispatch(
        closePlan({
          id: openPlanForSymbol.id,
          actualExitPrice: currentPrice,
          exitReason: 'discretionary',
        })
      );
    }
    dispatch(removeHolding(holding.symbol));
  };
  const marketValue = holding.quantity * currentPrice;
  const costBasis = holding.quantity * holding.purchasePrice;
  const gain = marketValue - costBasis;
  const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

  return (
    <tr className="border-b border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50">
      <td className="p-4 align-middle font-medium">
        <Link to={`/stock/${holding.symbol}`} className="group block hover:opacity-80 transition-opacity">
          <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {holding.symbol}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{holding.name}</div>
        </Link>
        <span
          className={cn(
            'mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium',
            openPlanForSymbol
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
          )}
        >
          {openPlanForSymbol ? 'Planned' : 'Unplanned'}
        </span>
      </td>
      <td className="p-4 align-middle text-right text-gray-900 dark:text-gray-100">{holding.quantity}</td>
      <td className="p-4 align-middle text-right text-gray-900 dark:text-gray-100">{formatCurrency(holding.purchasePrice)}</td>
      <td className="p-4 align-middle text-right">
        <div className="text-gray-900 dark:text-gray-100">{formatCurrency(currentPrice)}</div>
        {quote && (
          <div className={cn('text-xs', getChangeColor(quote.regularMarketChangePercent))}>
            {formatPercent(quote.regularMarketChangePercent)}
          </div>
        )}
      </td>
      <td className="p-4 align-middle text-right text-gray-900 dark:text-gray-100">{formatCurrency(marketValue)}</td>
      <td className={cn('p-4 align-middle text-right', getChangeColor(gain))}>
        <div>{formatCurrency(gain)}</div>
        <div className="text-xs">{formatPercent(gainPercent)}</div>
      </td>
      <td className="p-4 align-middle">
        <div className="flex justify-end gap-2">
          <Link to={`/stock/${holding.symbol}`}>
            <Button variant="ghost" size="icon" title="View details">
              <ExternalLink className="h-4 w-4 text-blue-500" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => dispatch(openEditHoldingModal(holding.symbol))}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete()}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function HoldingsList() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No holdings yet. Add your first stock to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b [&_tr]:border-gray-200 dark:[&_tr]:border-gray-700">
              <tr className="border-b transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Shares</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Avg Cost</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Price</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Market Value</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Gain/Loss</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {holdings.map((holding) => (
                <HoldingRow key={holding.symbol} holding={holding} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
