import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Stock } from '../../types';

interface PortfolioState {
  holdings: Stock[];
}

const STORAGE_KEY = 'portfolio-holdings';

function loadFromStorage(): Stock[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load portfolio from storage:', e);
  }
  return [];
}

function saveToStorage(holdings: Stock[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  } catch (e) {
    console.error('Failed to save portfolio to storage:', e);
  }
}

const initialState: PortfolioState = {
  holdings: loadFromStorage(),
};

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    addHolding: (state, action: PayloadAction<Stock>) => {
      const existing = state.holdings.find(h => h.symbol === action.payload.symbol);
      if (existing) {
        const totalShares = existing.quantity + action.payload.quantity;
        const totalCost = (existing.quantity * existing.purchasePrice) +
                         (action.payload.quantity * action.payload.purchasePrice);
        existing.quantity = totalShares;
        existing.purchasePrice = totalCost / totalShares;
        if (action.payload.thesis) existing.thesis = action.payload.thesis;
      } else {
        state.holdings.push(action.payload);
      }
      saveToStorage(state.holdings);
    },
    updateHolding: (state, action: PayloadAction<{ symbol: string; quantity: number; purchasePrice: number; thesis?: string }>) => {
      const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
      if (holding) {
        holding.quantity = action.payload.quantity;
        holding.purchasePrice = action.payload.purchasePrice;
        if (action.payload.thesis !== undefined) {
          holding.thesis = action.payload.thesis.trim() || undefined;
        }
        saveToStorage(state.holdings);
      }
    },
    removeHolding: (state, action: PayloadAction<string>) => {
      state.holdings = state.holdings.filter(h => h.symbol !== action.payload);
      saveToStorage(state.holdings);
    },
    updateCurrentPrice: (state, action: PayloadAction<{ symbol: string; price: number }>) => {
      const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
      if (holding) {
        holding.currentPrice = action.payload.price;
      }
    },
    clearPortfolio: (state) => {
      state.holdings = [];
      saveToStorage(state.holdings);
    },
  },
});

export const { addHolding, updateHolding, removeHolding, updateCurrentPrice, clearPortfolio } = portfolioSlice.actions;
export default portfolioSlice.reducer;
