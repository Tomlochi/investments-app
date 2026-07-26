import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { PriceAlert, AlertCondition } from '../../types';

interface AlertsState {
  alerts: PriceAlert[];
}

const STORAGE_KEY = 'price-alerts';

function loadFromStorage(): PriceAlert[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load alerts from storage:', e);
  }
  return [];
}

function saveToStorage(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.error('Failed to save alerts to storage:', e);
  }
}

const alertsSlice = createSlice({
  name: 'alerts',
  initialState: { alerts: loadFromStorage() } as AlertsState,
  reducers: {
    addAlert: {
      reducer: (state, action: PayloadAction<PriceAlert>) => {
        state.alerts.unshift(action.payload);
        saveToStorage(state.alerts);
      },
      prepare: (alert: { symbol: string; name: string; condition: AlertCondition; targetPrice: number }) => ({
        payload: {
          ...alert,
          id: nanoid(),
          createdAt: new Date().toISOString(),
          triggeredAt: null,
        },
      }),
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(a => a.id !== action.payload);
      saveToStorage(state.alerts);
    },
    markTriggered: (state, action: PayloadAction<{ id: string; price: number }>) => {
      const alert = state.alerts.find(a => a.id === action.payload.id);
      if (alert && !alert.triggeredAt) {
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = action.payload.price;
        saveToStorage(state.alerts);
      }
    },
  },
});

export const { addAlert, removeAlert, markTriggered } = alertsSlice.actions;
export default alertsSlice.reducer;
