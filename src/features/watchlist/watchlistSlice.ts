import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WatchlistItem } from '../../types';

interface WatchlistState {
  items: WatchlistItem[];
}

const STORAGE_KEY = 'watchlist-items';

function loadFromStorage(): WatchlistItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load watchlist from storage:', e);
  }
  return [];
}

function saveToStorage(items: WatchlistItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save watchlist to storage:', e);
  }
}

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState: { items: loadFromStorage() } as WatchlistState,
  reducers: {
    addToWatchlist: (state, action: PayloadAction<{ symbol: string; name: string }>) => {
      if (!state.items.some(i => i.symbol === action.payload.symbol)) {
        state.items.push({ ...action.payload, addedAt: new Date().toISOString() });
        saveToStorage(state.items);
      }
    },
    removeFromWatchlist: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.symbol !== action.payload);
      saveToStorage(state.items);
    },
  },
});

export const { addToWatchlist, removeFromWatchlist } = watchlistSlice.actions;
export default watchlistSlice.reducer;
