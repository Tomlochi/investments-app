import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { StockSearch } from '../components/stocks/StockSearch';
import { useGetQuoteQuery } from '../services/stockApi';
import { addToWatchlist, removeFromWatchlist } from '../features/watchlist/watchlistSlice';
import { formatCurrency } from '../lib/utils';
import type { RootState } from '../store';
import type { WatchlistItem } from '../types';

function WatchlistRow({ item }: { item: WatchlistItem }) {
  const dispatch = useDispatch();
  const { data: quote, isLoading } = useGetQuoteQuery(item.symbol, { pollingInterval: 60000 });

  const change = quote?.regularMarketChangePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-800">
      <td className="py-3 pr-4">
        <Link to={`/stock/${item.symbol}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
          {item.symbol}
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{item.name}</p>
      </td>
      <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">
        {isLoading ? '—' : quote ? formatCurrency(quote.regularMarketPrice) : 'N/A'}
      </td>
      <td className={`py-3 pr-4 text-right font-medium ${isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
        {quote ? `${isPositive ? '+' : ''}${change.toFixed(2)}%` : '—'}
      </td>
      <td className="py-3 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch(removeFromWatchlist(item.symbol))}
          aria-label={`Remove ${item.symbol} from watchlist`}
        >
          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
        </Button>
      </td>
    </tr>
  );
}

export function WatchlistPage() {
  const dispatch = useDispatch();
  const items = useSelector((state: RootState) => state.watchlist.items);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Watchlist</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a stock to watch</CardTitle>
        </CardHeader>
        <CardContent>
          <StockSearch
            placeholder="Search stocks to watch..."
            onSelect={(result) =>
              dispatch(addToWatchlist({ symbol: result.symbol, name: result.shortname || result.longname || result.symbol }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Watching {items.length > 0 ? `(${items.length})` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing here yet — search above to start tracking stocks you don't own.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4 font-medium">Symbol</th>
                    <th className="pb-2 pr-4 font-medium text-right">Price</th>
                    <th className="pb-2 pr-4 font-medium text-right">Today</th>
                    <th className="pb-2 font-medium text-right">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <WatchlistRow key={item.symbol} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
