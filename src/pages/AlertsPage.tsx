import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Bell, BellRing, Trash2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { StockSearch } from '../components/stocks/StockSearch';
import { useGetQuoteQuery } from '../services/stockApi';
import { addAlert, removeAlert } from '../features/alerts/alertsSlice';
import { formatCurrency, cn } from '../lib/utils';
import type { RootState, AppDispatch } from '../store';
import type { PriceAlert, AlertCondition, SearchResult } from '../types';

function AlertRow({ alert }: { alert: PriceAlert }) {
  const dispatch = useDispatch<AppDispatch>();
  const { data: quote } = useGetQuoteQuery(alert.symbol, {
    pollingInterval: 60000,
    skip: alert.triggeredAt != null,
  });
  const triggered = alert.triggeredAt != null;

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-800">
      <td className="py-3 pr-4">
        <Link to={`/stock/${alert.symbol}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
          {alert.symbol}
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{alert.name}</p>
      </td>
      <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">
        {alert.condition === 'above' ? '≥' : '≤'} {formatCurrency(alert.targetPrice)}
      </td>
      <td className="py-3 pr-4 text-right text-gray-900 dark:text-gray-100">
        {triggered
          ? alert.triggeredPrice != null ? formatCurrency(alert.triggeredPrice) : '—'
          : quote ? formatCurrency(quote.regularMarketPrice) : '—'}
      </td>
      <td className="py-3 pr-4">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
            triggered
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          )}
        >
          {triggered ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
          {triggered ? `Hit ${new Date(alert.triggeredAt!).toLocaleDateString()}` : 'Watching'}
        </span>
      </td>
      <td className="py-3 text-right">
        <Button variant="ghost" size="sm" onClick={() => dispatch(removeAlert(alert.id))} aria-label={`Delete ${alert.symbol} alert`}>
          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
        </Button>
      </td>
    </tr>
  );
}

export function AlertsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const alerts = useSelector((state: RootState) => state.alerts.alerts);

  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(null);
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');

  const { data: selectedQuote } = useGetQuoteQuery(selected?.symbol ?? '', { skip: !selected });

  const price = parseFloat(targetPrice) || 0;
  const canAdd = selected != null && price > 0;

  const handleAdd = () => {
    if (!selected || !canAdd) return;
    dispatch(addAlert({ symbol: selected.symbol, name: selected.name, condition, targetPrice: price }));
    setSelected(null);
    setTargetPrice('');
    setCondition('above');
  };

  const handleSelect = (result: SearchResult) => {
    setSelected({ symbol: result.symbol, name: result.shortname || result.longname || result.symbol });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Price Alerts</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New alert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selected == null ? (
            <StockSearch placeholder="Search a stock to set an alert..." onSelect={handleSelect} />
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Stock</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{selected.symbol}</span>
                  {selectedQuote && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      now {formatCurrency(selectedQuote.regularMarketPrice)}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>change</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Condition</Label>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-1">
                  {(['above', 'below'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCondition(c)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium transition-colors',
                        condition === c
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                      )}
                    >
                      {c === 'above' ? 'Rises above' : 'Falls below'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="alert-price" className="text-xs text-gray-500 dark:text-gray-400">Target price</Label>
                <Input
                  id="alert-price"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-28 h-9 mt-1"
                />
              </div>
              <Button onClick={handleAdd} disabled={!canAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Add alert
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Alerts are checked every minute while the app is open and fire a browser notification when hit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your alerts {alerts.length > 0 ? `(${alerts.length})` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No alerts yet — add one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-4 font-medium">Symbol</th>
                    <th className="pb-2 pr-4 font-medium">Alert</th>
                    <th className="pb-2 pr-4 font-medium text-right">Price</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(alert => (
                    <AlertRow key={alert.id} alert={alert} />
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
