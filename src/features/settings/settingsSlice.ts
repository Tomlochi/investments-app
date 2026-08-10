import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TradeSettings } from '../../types';

const STORAGE_KEY = 'trade-settings';

const DEFAULTS: TradeSettings = {
  riskPerTradePercent: 1,
  maxPositionPercent: 20,
};

function loadFromStorage(): TradeSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Failed to load trade settings from storage:', e);
  }
  return DEFAULTS;
}

function saveToStorage(state: TradeSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save trade settings to storage:', e);
  }
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadFromStorage(),
  reducers: {
    setRiskPerTradePercent: (state, action: PayloadAction<number>) => {
      state.riskPerTradePercent = action.payload;
      saveToStorage(state);
    },
    setMaxPositionPercent: (state, action: PayloadAction<number>) => {
      state.maxPositionPercent = action.payload;
      saveToStorage(state);
    },
  },
});

export const { setRiskPerTradePercent, setMaxPositionPercent } = settingsSlice.actions;
export default settingsSlice.reducer;
