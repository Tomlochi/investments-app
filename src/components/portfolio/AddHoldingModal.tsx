import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Loader2 } from 'lucide-react';
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
import { useSearchStocksQuery, useGetQuoteQuery } from '../../services/stockApi';
import { addHolding } from '../../features/portfolio/portfolioSlice';
import { closeAddHoldingModal } from '../../features/ui/uiSlice';
import type { RootState, AppDispatch } from '../../store';

export function AddHoldingModal() {
  const dispatch = useDispatch<AppDispatch>();
  const isOpen = useSelector((state: RootState) => state.ui.addHoldingModalOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [thesis, setThesis] = useState('');
  const [showResults, setShowResults] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 1 && !selectedSymbol) {
        setDebouncedSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSymbol]);

  const { data: searchResults, isFetching: isSearching } = useSearchStocksQuery(debouncedSearch, {
    skip: debouncedSearch.length < 1,
  });

  const { data: selectedQuote } = useGetQuoteQuery(selectedSymbol ?? '', {
    skip: !selectedSymbol,
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

  const handleSelectStock = (symbol: string, name: string) => {
    setSelectedSymbol(symbol);
    setSearchQuery(`${symbol} - ${name}`);
    setShowResults(false);
    setDebouncedSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol || !quantity || !purchasePrice) return;

    dispatch(addHolding({
      symbol: selectedSymbol,
      name: selectedQuote?.longName || selectedQuote?.shortName || selectedSymbol,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
      currentPrice: selectedQuote?.regularMarketPrice,
      thesis: thesis.trim() || undefined,
    }));

    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedSymbol(null);
    setQuantity('');
    setPurchasePrice('');
    setThesis('');
    setShowResults(false);
    dispatch(closeAddHoldingModal());
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedSymbol(null);
    if (value.length >= 1) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Holding</DialogTitle>
          <DialogDescription>
            Search for a stock and enter your purchase details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="stock" className="text-gray-900 dark:text-gray-100">Stock</Label>
              <div className="relative" ref={dropdownRef}>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="stock"
                  placeholder="Search by symbol or name..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => {
                    if (searchQuery.length >= 1 && !selectedSymbol) {
                      setShowResults(true);
                    }
                  }}
                  className="pl-9"
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
                )}
                {showResults && searchResults && searchResults.length > 0 && (
                  <div className="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {searchResults.map((result) => (
                      <button
                        key={result.symbol}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md"
                        onClick={() => handleSelectStock(result.symbol, result.shortname || result.longname || result.symbol)}
                      >
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{result.symbol}</span>
                        <span className="text-gray-600 dark:text-gray-400 truncate ml-2 text-xs">
                          {result.shortname || result.longname}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showResults && debouncedSearch && !isSearching && searchResults?.length === 0 && (
                  <div className="absolute z-[100] mt-1 w-full rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No stocks found for "{debouncedSearch}"</p>
                  </div>
                )}
              </div>
            </div>

            {selectedQuote && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3 text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100">{selectedQuote.longName || selectedQuote.shortName}</div>
                <div className="text-blue-600 dark:text-blue-400 font-semibold">
                  Current Price: ${selectedQuote.regularMarketPrice.toFixed(2)}
                </div>
              </div>
            )}

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
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price" className="text-gray-900 dark:text-gray-100">Purchase Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="thesis" className="text-gray-900 dark:text-gray-100">Thesis (optional)</Label>
              <textarea
                id="thesis"
                rows={2}
                placeholder="Why are you buying this? The AI can check later whether your reasoning still holds."
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                className="flex min-h-[60px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedSymbol || !quantity || !purchasePrice}>
              Add Holding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
