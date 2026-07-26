import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { getStockInsight, getPortfolioInsight, getDailyBrief, getRebalancePlan } from '../lib/claude';
import type { AIInsight, StockInsightRequest, PortfolioInsightRequest, DailyBriefResponse, RebalancePlan, RebalancePlanRequest } from '../types';

export const insightsApi = createApi({
  reducerPath: 'insightsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['StockInsight', 'PortfolioInsight', 'DailyBrief', 'RebalancePlan'],
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

    getDailyBrief: builder.query<DailyBriefResponse, { symbol: string; name: string }[]>({
      queryFn: async (holdings) => {
        try {
          const symbols = holdings.map((h) => encodeURIComponent(h.symbol)).join(',');
          const res = await fetch(`/api/news?symbols=${symbols}`);
          if (!res.ok) throw new Error('Failed to fetch news');
          const newsMap = await res.json();
          const brief = await getDailyBrief(holdings, newsMap);
          return { data: brief };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: ['DailyBrief'],
    }),

    getRebalancePlan: builder.query<RebalancePlan, RebalancePlanRequest>({
      queryFn: async (request) => {
        try {
          const plan = await getRebalancePlan(request);
          return { data: plan };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: ['RebalancePlan'],
    }),
  }),
});

export const {
  useGetStockInsightQuery,
  useGetPortfolioInsightQuery,
  useLazyGetStockInsightQuery,
  useLazyGetPortfolioInsightQuery,
  useLazyGetDailyBriefQuery,
  useLazyGetRebalancePlanQuery,
} = insightsApi;
