import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { stockApi } from '../services/stockApi';
import { insightsApi } from '../services/insightsApi';
import portfolioReducer from '../features/portfolio/portfolioSlice';
import uiReducer from '../features/ui/uiSlice';
import journalReducer from '../features/journal/journalSlice';
import watchlistReducer from '../features/watchlist/watchlistSlice';
import rebalanceReducer from '../features/rebalance/rebalanceSlice';
import cashReducer from '../features/cash/cashSlice';
import alertsReducer from '../features/alerts/alertsSlice';

export const store = configureStore({
  reducer: {
    portfolio: portfolioReducer,
    ui: uiReducer,
    journal: journalReducer,
    watchlist: watchlistReducer,
    rebalance: rebalanceReducer,
    cash: cashReducer,
    alerts: alertsReducer,
    [stockApi.reducerPath]: stockApi.reducer,
    [insightsApi.reducerPath]: insightsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(stockApi.middleware)
      .concat(insightsApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
