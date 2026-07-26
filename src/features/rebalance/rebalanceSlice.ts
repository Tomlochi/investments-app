import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RebalanceTarget } from '../../types';

interface RebalanceState {
  targets: RebalanceTarget[];
}

const STORAGE_KEY = 'rebalance-targets';

function loadFromStorage(): RebalanceTarget[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load rebalance targets from storage:', e);
  }
  return [];
}

function saveToStorage(targets: RebalanceTarget[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch (e) {
    console.error('Failed to save rebalance targets to storage:', e);
  }
}

const rebalanceSlice = createSlice({
  name: 'rebalance',
  initialState: { targets: loadFromStorage() } as RebalanceState,
  reducers: {
    setTarget: (state, action: PayloadAction<RebalanceTarget>) => {
      const existing = state.targets.find(t => t.symbol === action.payload.symbol);
      if (existing) {
        existing.targetPercent = action.payload.targetPercent;
      } else {
        state.targets.push(action.payload);
      }
      saveToStorage(state.targets);
    },
    removeTarget: (state, action: PayloadAction<string>) => {
      state.targets = state.targets.filter(t => t.symbol !== action.payload);
      saveToStorage(state.targets);
    },
  },
});

export const { setTarget, removeTarget } = rebalanceSlice.actions;
export default rebalanceSlice.reducer;
