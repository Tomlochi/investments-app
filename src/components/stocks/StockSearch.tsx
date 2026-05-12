import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { useSearchStocksQuery } from '../../services/stockApi';
import type { SearchResult } from '../../types';

interface StockSearchProps {
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}

export function StockSearch({ onSelect, placeholder = "Search stocks..." }: StockSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 1) {
        setDebouncedQuery(query);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useSearchStocksQuery(debouncedQuery, {
    skip: debouncedQuery.length < 1,
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

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setQuery('');
    setDebouncedQuery('');
    setShowResults(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.length >= 1) {
            setShowResults(true);
          } else {
            setShowResults(false);
          }
        }}
        onFocus={() => {
          if (query.length >= 1) {
            setShowResults(true);
          }
        }}
        className="pl-9"
        autoComplete="off"
      />
      {isFetching && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
      )}

      {showResults && results && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {results.map((result) => (
            <button
              key={result.symbol}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 first:rounded-t-md last:rounded-b-md dark:text-gray-100 dark:hover:bg-gray-700"
              onClick={() => handleSelect(result)}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{result.symbol}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{result.quoteType}</span>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[200px]">
                {result.shortname || result.longname}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
