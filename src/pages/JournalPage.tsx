import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BookOpen, Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { PnLSummary } from '../components/journal/PnLSummary';
import { JournalCoach } from '../components/journal/JournalCoach';
import { removeTrade } from '../features/journal/journalSlice';
import { openAddTradeModal } from '../features/ui/uiSlice';
import { formatCurrency, formatPercent, getChangeColor, cn } from '../lib/utils';
import type { RootState, AppDispatch } from '../store';
import type { TradeEntry } from '../types';

function TradeCard({ entry }: { entry: TradeEntry }) {
  const dispatch = useDispatch<AppDispatch>();
  const isBuy = entry.type === 'buy';
  const total = entry.quantity * entry.price;

  const SentimentIcon =
    entry.gainLoss == null ? Minus
    : entry.gainLoss >= 0 ? TrendingUp
    : TrendingDown;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {/* Type pill */}
            <span className={cn(
              'mt-0.5 shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              isBuy
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
            )}>
              {isBuy ? 'BUY' : 'SELL'}
            </span>

            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{entry.symbol}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{entry.name}</span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                <span>{entry.quantity} shares @ {formatCurrency(entry.price)}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Total: {formatCurrency(total)}
                </span>
                {!isBuy && (
                  <span>Entry: {formatCurrency(entry.entryPrice)}</span>
                )}
              </div>

              {/* Gain/loss row for sells */}
              {!isBuy && entry.gainLoss != null && entry.gainLossPercent != null && (
                <div className={cn('mt-1 flex items-center gap-1.5 text-sm font-medium', getChangeColor(entry.gainLoss))}>
                  <SentimentIcon className="h-3.5 w-3.5" />
                  {formatCurrency(entry.gainLoss)} ({formatPercent(entry.gainLossPercent)})
                </div>
              )}

              {entry.notes && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                  "{entry.notes}"
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(removeTrade(entry.id))}
              title="Delete entry"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
      <BookOpen className="h-12 w-12 mb-4 opacity-40" />
      <p className="text-base font-medium">No {label} trades yet</p>
      <p className="text-sm mt-1">Log your first trade using the button above.</p>
    </div>
  );
}

export function JournalPage() {
  const dispatch = useDispatch<AppDispatch>();
  const entries = useSelector((state: RootState) => state.journal.entries);
  const [tab, setTab] = useState<'all' | 'buy' | 'sell'>('all');

  const filtered = entries.filter(e => tab === 'all' || e.type === tab);

  const buyCount = entries.filter(e => e.type === 'buy').length;
  const sellCount = entries.filter(e => e.type === 'sell').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Investment Journal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {entries.length} {entries.length === 1 ? 'trade' : 'trades'} logged
          </p>
        </div>
        <Button
          onClick={() => dispatch(openAddTradeModal())}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Log Trade
        </Button>
      </div>

      <PnLSummary />

      <JournalCoach />

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
          <TabsTrigger value="buy">Buys ({buyCount})</TabsTrigger>
          <TabsTrigger value="sell">Sells ({sellCount})</TabsTrigger>
        </TabsList>

        {(['all', 'buy', 'sell'] as const).map(t => (
          <TabsContent key={t} value={t}>
            {filtered.length === 0 ? (
              <EmptyState label={t === 'all' ? '' : t} />
            ) : (
              <div className="space-y-3 mt-4">
                {filtered.map(entry => (
                  <TradeCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
