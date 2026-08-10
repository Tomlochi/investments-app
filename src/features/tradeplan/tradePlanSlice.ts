import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TradePlan, ExitReason, ProcessGrade } from '../../types';

interface TradePlanState {
  plans: TradePlan[];
}

const STORAGE_KEY = 'trade-plans';

function loadFromStorage(): TradePlan[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load trade plans from storage:', e);
  }
  return [];
}

function saveToStorage(plans: TradePlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error('Failed to save trade plans to storage:', e);
  }
}

const tradePlanSlice = createSlice({
  name: 'tradePlan',
  initialState: { plans: loadFromStorage() } as TradePlanState,
  reducers: {
    /** Creates a new plan or replaces an existing one by id. */
    savePlan: (state, action: PayloadAction<TradePlan>) => {
      const index = state.plans.findIndex(p => p.id === action.payload.id);
      if (index >= 0) state.plans[index] = action.payload;
      else state.plans.unshift(action.payload);
      saveToStorage(state.plans);
    },
    deletePlan: (state, action: PayloadAction<string>) => {
      state.plans = state.plans.filter(p => p.id !== action.payload);
      saveToStorage(state.plans);
    },
    openPlan: (
      state,
      action: PayloadAction<{ id: string; actualEntryPrice: number; actualShares: number }>
    ) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan || plan.status !== 'idea') return;
      plan.status = 'open';
      plan.actualEntryPrice = action.payload.actualEntryPrice;
      plan.actualShares = action.payload.actualShares;
      plan.initialStopPrice = plan.stopPrice;
      plan.openedAt = new Date().toISOString();
      saveToStorage(state.plans);
    },
    closePlan: (
      state,
      action: PayloadAction<{ id: string; actualExitPrice: number; exitReason: ExitReason }>
    ) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan || plan.status !== 'open') return;
      plan.status = 'closed';
      plan.actualExitPrice = action.payload.actualExitPrice;
      plan.exitReason = action.payload.exitReason;
      plan.closedAt = new Date().toISOString();
      saveToStorage(state.plans);
    },
    setGrade: (state, action: PayloadAction<{ id: string; grade: ProcessGrade }>) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan) return;
      plan.grade = action.payload.grade;
      saveToStorage(state.plans);
    },
    /** Raises or lowers the live stop on an open plan. initialStopPrice is untouched. */
    updateStop: (state, action: PayloadAction<{ id: string; stopPrice: number }>) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan || plan.status !== 'open') return;
      plan.stopPrice = action.payload.stopPrice;
      saveToStorage(state.plans);
    },
  },
});

export const { savePlan, deletePlan, openPlan, closePlan, setGrade, updateStop } =
  tradePlanSlice.actions;
export default tradePlanSlice.reducer;
