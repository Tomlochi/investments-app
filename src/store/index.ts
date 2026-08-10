import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { stockApi } from '../services/stockApi';
import { insightsApi } from '../services/insightsApi';
import { indicatorsApi } from '../services/indicatorsApi';
import portfolioReducer from '../features/portfolio/portfolioSlice';
import uiReducer from '../features/ui/uiSlice';
import journalReducer from '../features/journal/journalSlice';
import watchlistReducer from '../features/watchlist/watchlistSlice';
import rebalanceReducer from '../features/rebalance/rebalanceSlice';
import cashReducer from '../features/cash/cashSlice';
import alertsReducer from '../features/alerts/alertsSlice';
import tradePlanReducer from '../features/tradeplan/tradePlanSlice';
import settingsReducer from '../features/settings/settingsSlice';

export const store = configureStore({
  reducer: {
    portfolio: portfolioReducer,
    ui: uiReducer,
    journal: journalReducer,
    watchlist: watchlistReducer,
    rebalance: rebalanceReducer,
    cash: cashReducer,
    alerts: alertsReducer,
    tradePlan: tradePlanReducer,
    settings: settingsReducer,
    [stockApi.reducerPath]: stockApi.reducer,
    [insightsApi.reducerPath]: insightsApi.reducer,
    [indicatorsApi.reducerPath]: indicatorsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(stockApi.middleware)
      .concat(insightsApi.middleware)
      .concat(indicatorsApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
