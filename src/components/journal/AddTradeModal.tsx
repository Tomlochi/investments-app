import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Sparkles, Loader2, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
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
import { useSearchStocksQuery } from '../../services/stockApi';
import { getTradeCheck } from '../../lib/claude';
import { cn, formatCurrency, formatPercent, getChangeColor } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';
import type { SearchResult, TradeCheckResult } from '../../types';

const VERDICT_STYLES = {
  proceed: {
    icon: ShieldCheck,
    label: 'Looks reasonable',
    box: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-300',
  },
  caution: {
    icon: ShieldAlert,
    label: 'Proceed with caution',
    box: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
    text: 'text-amber-800 dark:text-amber-300',
  },
  reconsider: {
    icon: ShieldX,
    label: 'Worth reconsidering',
    box: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-300',
  },
} as const;

export function AddTradeModal() {
  const dispatch = useDispatch<AppDispatch>();
  const isOpen = useSelector((state: RootState) => state.ui.addTradeModalOpen);
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const journalEntries = useSelector((state: RootState) => state.journal.entries);
  const cashBalance = useSelector((state: RootState) => state.cash.balance);

  const [check, setCheck] = useState<TradeCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);

  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [debouncedSymbol, setDebouncedSymbol] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [picked, setPicked] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce symbol lookups; skip once a result has been picked
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSymbol(picked ? '' : symbol.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [symbol, picked]);

  const { data: searchResults, isFetching: isSearching } = useSearchStocksQuery(debouncedSymbol, {
    skip: debouncedSymbol.length < 1,
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    setSymbol(upper);
    setPicked(false);
    setShowResults(upper.length >= 1);
    const match = holdings.find(h => h.symbol === upper);
    if (match) {
      setName(match.name);
      if (tradeType === 'sell') setEntryPrice(match.purchasePrice.toFixed(2));
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    setSymbol(result.symbol);
    setName(result.shortname || result.longname || result.symbol);
    setPicked(true);
    setShowResults(false);
    setDebouncedSymbol('');
    const match = holdings.find(h => h.symbol === result.symbol);
    if (match && tradeType === 'sell') setEntryPrice(match.purchasePrice.toFixed(2));
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

  // Name is optional — falls back to the symbol, so an unlisted ticker is still loggable
  const canSubmit = Boolean(
    symbol.trim() && qty > 0 && execPrice > 0 && date &&
    (tradeType === 'buy' || costPrice > 0)
  );

  const missing = [
    !symbol.trim() && 'a symbol',
    !(qty > 0) && 'share count',
    !(execPrice > 0) && (tradeType === 'buy' ? 'a buy price' : 'a sell price'),
    tradeType === 'sell' && !(costPrice > 0) && 'an entry price',
    !date && 'a date',
  ].filter(Boolean) as string[];

  const handleAICheck = async () => {
    if (!canSubmit || checking) return;
    setChecking(true);
    setCheckError(false);
    setCheck(null);
    try {
      const result = await getTradeCheck({
        trade: {
          type: tradeType,
          symbol: symbol.trim(),
          name: name.trim() || symbol.trim(),
          quantity: qty,
          price: execPrice,
          notes: notes.trim() || undefined,
        },
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          quantity: h.quantity,
          purchasePrice: h.purchasePrice,
          currentPrice: h.currentPrice,
        })),
        recentTrades: journalEntries.slice(0, 10).map(t => ({
          type: t.type,
          symbol: t.symbol,
          quantity: t.quantity,
          price: t.price,
          date: t.date,
          notes: t.notes,
        })),
        cashBalance,
      });
      setCheck(result);
    } catch (e) {
      console.error('Trade check error:', e);
      setCheckError(true);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const sym = symbol.trim();
    const displayName = name.trim() || sym;
    dispatch(addTrade({
      type: tradeType,
      symbol: sym,
      name: displayName,
      quantity: qty,
      price: execPrice,
      entryPrice: tradeType === 'sell' ? costPrice : execPrice,
      date,
      notes: notes.trim() || undefined,
      gainLoss: gainLoss ?? undefined,
      gainLossPercent: gainLossPercent ?? undefined,
    }));

    if (tradeType === 'buy') {
      dispatch(addHolding({ symbol: sym, name: displayName, quantity: qty, purchasePrice: execPrice }));
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
    setCheck(null);
    setChecking(false);
    setCheckError(false);
    setDebouncedSymbol('');
    setShowResults(false);
    setPicked(false);
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
                <div className="relative" ref={dropdownRef}>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="symbol"
                    placeholder="AAPL"
                    value={symbol}
                    onChange={handleSymbolChange}
                    onFocus={() => {
                      if (symbol.length >= 1 && !picked) setShowResults(true);
                    }}
                    className="pl-9"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
                  )}
                  {showResults && searchResults && searchResults.length > 0 && (
                    <div className="absolute z-[100] mt-1 max-h-60 w-[calc(200%+1rem)] overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {searchResults.map(result => (
                        <button
                          key={result.symbol}
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 first:rounded-t-md last:rounded-b-md dark:text-gray-100 dark:hover:bg-gray-700"
                          onClick={() => handleSelectResult(result)}
                        >
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{result.symbol}</span>
                          <span className="truncate text-xs text-gray-600 dark:text-gray-400">
                            {result.shortname || result.longname}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showResults && debouncedSymbol && !isSearching && searchResults?.length === 0 && (
                    <div className="absolute z-[100] mt-1 w-[calc(200%+1rem)] rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No match for "{debouncedSymbol}" — you can still log it manually.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-gray-900 dark:text-gray-100">
                  Company Name <span className="text-xs font-normal text-gray-500">(optional)</span>
                </Label>
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
            {/* AI second opinion */}
            {check && !checking && (() => {
              const style = VERDICT_STYLES[check.verdict];
              return (
                <div className={cn('rounded-md border p-3 text-sm', style.box)}>
                  <div className={cn('flex items-center gap-1.5 font-semibold mb-1', style.text)}>
                    <style.icon className="h-4 w-4" />
                    {style.label}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{check.assessment}</p>
                  {check.considerations.length > 0 && (
                    <ul className="list-disc pl-5 mt-2 space-y-0.5 text-gray-600 dark:text-gray-400">
                      {check.considerations.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}
            {checkError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                AI check failed. You can still log the trade.
              </p>
            )}
            {missing.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Still need {missing.join(', ')} before this trade can be logged.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 mr-auto"
              disabled={!canSubmit || checking}
              onClick={handleAICheck}
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {checking ? 'Checking...' : 'AI second opinion'}
            </Button>
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
