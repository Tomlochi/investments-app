import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { addTrade } from '../../features/journal/journalSlice';
import { addHolding, updateHolding, removeHolding } from '../../features/portfolio/portfolioSlice';
import { closeAddTradeModal } from '../../features/ui/uiSlice';
import { cn, formatCurrency, formatPercent, getChangeColor } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';

export function AddTradeModal() {
  const dispatch = useDispatch<AppDispatch>();
  const isOpen = useSelector((state: RootState) => state.ui.addTradeModalOpen);
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    setSymbol(upper);
    const match = holdings.find(h => h.symbol === upper);
    if (match) {
      setName(match.name);
      if (tradeType === 'sell') setEntryPrice(match.purchasePrice.toFixed(2));
    }
  };

  const handleTypeChange = (type: 'buy' | 'sell') => {
    setTradeType(type);
    if (type === 'sell') {
      const match = holdings.find(h => h.symbol === symbol);
      if (match) setEntryPrice(match.purchasePrice.toFixed(2));
    } else {
      setEntryPrice('');
    }
  };

  const qty = parseFloat(quantity) || 0;
  const execPrice = parseFloat(price) || 0;
  const costPrice = parseFloat(entryPrice) || 0;

  const gainLoss =
    tradeType === 'sell' && qty > 0 && execPrice > 0 && costPrice > 0
      ? (execPrice - costPrice) * qty
      : null;
  const gainLossPercent =
    costPrice > 0 && gainLoss !== null ? ((execPrice - costPrice) / costPrice) * 100 : null;

  const canSubmit =
    symbol.trim() && name.trim() && qty > 0 && execPrice > 0 && date &&
    (tradeType === 'buy' || costPrice > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const sym = symbol.trim();
    dispatch(addTrade({
      type: tradeType,
      symbol: sym,
      name: name.trim(),
      quantity: qty,
      price: execPrice,
      entryPrice: tradeType === 'sell' ? costPrice : execPrice,
      date,
      notes: notes.trim() || undefined,
      gainLoss: gainLoss ?? undefined,
      gainLossPercent: gainLossPercent ?? undefined,
    }));

    if (tradeType === 'buy') {
      dispatch(addHolding({ symbol: sym, name: name.trim(), quantity: qty, purchasePrice: execPrice }));
    } else {
      const holding = holdings.find(h => h.symbol === sym);
      if (holding) {
        const remaining = holding.quantity - qty;
        if (remaining <= 0) {
          dispatch(removeHolding(sym));
        } else {
          dispatch(updateHolding({ symbol: sym, quantity: remaining, purchasePrice: holding.purchasePrice }));
        }
      }
    }

    handleClose();
  };

  const handleClose = () => {
    setTradeType('buy');
    setSymbol('');
    setName('');
    setQuantity('');
    setPrice('');
    setEntryPrice('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    dispatch(closeAddTradeModal());
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Log Trade</DialogTitle>
          <DialogDescription>Record a buy or sell transaction in your journal.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Trade type toggle */}
            <div className="grid gap-2">
              <Label className="text-gray-900 dark:text-gray-100">Trade Type</Label>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleTypeChange('buy')}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    tradeType === 'buy'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                  )}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('sell')}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    tradeType === 'sell'
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                  )}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Symbol + Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="symbol" className="text-gray-900 dark:text-gray-100">Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="AAPL"
                  value={symbol}
                  onChange={handleSymbolChange}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-900 dark:text-gray-100">Company Name</Label>
                <Input
                  id="name"
                  placeholder="Apple Inc."
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Quantity + Execution price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity" className="text-gray-900 dark:text-gray-100">Shares</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price" className="text-gray-900 dark:text-gray-100">
                  {tradeType === 'buy' ? 'Buy Price' : 'Sell Price'}
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Entry price — only for sells */}
            {tradeType === 'sell' && (
              <div className="grid gap-2">
                <Label htmlFor="entryPrice" className="text-gray-900 dark:text-gray-100">
                  Entry Price (avg cost)
                </Label>
                <Input
                  id="entryPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={entryPrice}
                  onChange={e => setEntryPrice(e.target.value)}
                />
              </div>
            )}

            {/* Gain/loss preview for sells */}
            {tradeType === 'sell' && gainLoss !== null && gainLossPercent !== null && (
              <div className={cn(
                'rounded-md border p-3 text-sm',
                gainLoss >= 0
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              )}>
                <span className="text-gray-600 dark:text-gray-400">Gain / Loss: </span>
                <span className={cn('font-semibold', getChangeColor(gainLoss))}>
                  {formatCurrency(gainLoss)} ({formatPercent(gainLossPercent)})
                </span>
              </div>
            )}

            {/* Date */}
            <div className="grid gap-2">
              <Label htmlFor="date" className="text-gray-900 dark:text-gray-100">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-gray-900 dark:text-gray-100">Notes (optional)</Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Why did you make this trade?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className={tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              Log {tradeType === 'buy' ? 'Buy' : 'Sell'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
