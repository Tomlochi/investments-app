import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getStockInsight, getPortfolioInsight } from '../lib/claude';
import type { AIInsight, StockInsightRequest, PortfolioInsightRequest } from '../types';

export const insightsApi = createApi({
  reducerPath: 'insightsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['StockInsight', 'PortfolioInsight'],
  endpoints: (builder) => ({
    getStockInsight: builder.query<AIInsight, StockInsightRequest>({
      queryFn: async (request) => {
        try {
          const insight = await getStockInsight(request);
          return { data: insight };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: (_, __, request) => [{ type: 'StockInsight', id: request.symbol }],
    }),

    getPortfolioInsight: builder.query<AIInsight, PortfolioInsightRequest>({
      queryFn: async (request) => {
        try {
          const insight = await getPortfolioInsight(request);
          return { data: insight };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: ['PortfolioInsight'],
    }),
  }),
});

export const {
  useGetStockInsightQuery,
  useGetPortfolioInsightQuery,
  useLazyGetStockInsightQuery,
  useLazyGetPortfolioInsightQuery,
} = insightsApi;
