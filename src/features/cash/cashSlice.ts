import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { CashTransaction } from '../../types';

interface CashState {
  balance: number;
  transactions: CashTransaction[];
}

const STORAGE_KEY = 'cash-state';

function loadFromStorage(): CashState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load cash state from storage:', e);
  }
  return { balance: 0, transactions: [] };
}

function saveToStorage(state: CashState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save cash state to storage:', e);
  }
}

const cashSlice = createSlice({
  name: 'cash',
  initialState: loadFromStorage() as CashState,
  reducers: {
    deposit: {
      reducer: (state, action: PayloadAction<CashTransaction>) => {
        state.balance += action.payload.amount;
        state.transactions.unshift(action.payload);
        saveToStorage(state);
      },
      prepare: (amount: number, note?: string) => ({
        payload: { id: nanoid(), type: 'deposit' as const, amount, date: new Date().toISOString(), note },
      }),
    },
    withdraw: {
      reducer: (state, action: PayloadAction<CashTransaction>) => {
        state.balance -= action.payload.amount;
        state.transactions.unshift(action.payload);
        saveToStorage(state);
      },
      prepare: (amount: number, note?: string) => ({
        payload: { id: nanoid(), type: 'withdraw' as const, amount, date: new Date().toISOString(), note },
      }),
    },
  },
});

export const { deposit, withdraw } = cashSlice.actions;
export default cashSlice.reducer;
