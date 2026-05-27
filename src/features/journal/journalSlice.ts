import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { TradeEntry } from '../../types';

interface JournalState {
  entries: TradeEntry[];
}

const STORAGE_KEY = 'journal-entries';

function loadFromStorage(): TradeEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load journal from storage:', e);
  }
  return [];
}

function saveToStorage(entries: TradeEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save journal to storage:', e);
  }
}

const journalSlice = createSlice({
  name: 'journal',
  initialState: { entries: loadFromStorage() } as JournalState,
  reducers: {
    addTrade: {
      reducer: (state, action: PayloadAction<TradeEntry>) => {
        state.entries.unshift(action.payload);
        saveToStorage(state.entries);
      },
      prepare: (entry: Omit<TradeEntry, 'id'>) => ({
        payload: { ...entry, id: nanoid() },
      }),
    },
    removeTrade: (state, action: PayloadAction<string>) => {
      state.entries = state.entries.filter(e => e.id !== action.payload);
      saveToStorage(state.entries);
    },
  },
});

export const { addTrade, removeTrade } = journalSlice.actions;
export default journalSlice.reducer;
