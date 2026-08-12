import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  getStockInsight,
  getPortfolioInsight,
  getDailyBrief,
  getRebalancePlan,
  getDevilsAdvocate,
  getExitAdvice,
  getStopAdvice,
  getProcessGrade,
} from '../lib/claude';
import type {
  AIInsight,
  StockInsightRequest,
  PortfolioInsightRequest,
  DailyBriefResponse,
  RebalancePlan,
  RebalancePlanRequest,
  DevilsAdvocateRequest,
  DevilsAdvocateResult,
  ExitAdviceRequest,
  ExitAdviceResult,
  StopAdviceRequest,
  StopAdviceResult,
  ProcessGradeRequest,
  ProcessGrade,
} from '../types';

export const insightsApi = createApi({
  reducerPath: 'insightsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['StockInsight', 'PortfolioInsight', 'DailyBrief', 'RebalancePlan', 'DevilsAdvocate', 'ExitAdvice', 'StopAdvice', 'ProcessGrade'],
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

    getDevilsAdvocate: builder.query<DevilsAdvocateResult, DevilsAdvocateRequest>({
      queryFn: async (request) => {
        try {
          return { data: await getDevilsAdvocate(request) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: (_, __, request) => [{ type: 'DevilsAdvocate', id: request.plan.symbol }],
    }),

    getExitAdvice: builder.query<ExitAdviceResult, ExitAdviceRequest>({
      queryFn: async (request) => {
        try {
          return { data: await getExitAdvice(request) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: (_, __, request) => [{ type: 'ExitAdvice', id: request.plan.symbol }],
    }),

    getStopAdvice: builder.query<StopAdviceResult, StopAdviceRequest>({
      queryFn: async (request) => {
        try {
          return { data: await getStopAdvice(request) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: (_, __, request) => [{ type: 'StopAdvice', id: request.symbol }],
    }),

    getProcessGrade: builder.query<ProcessGrade, ProcessGradeRequest>({
      queryFn: async (request) => {
        try {
          return { data: await getProcessGrade(request) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: (_, __, request) => [{ type: 'ProcessGrade', id: request.plan.symbol }],
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
  useLazyGetDevilsAdvocateQuery,
  useLazyGetExitAdviceQuery,
  useLazyGetStopAdviceQuery,
  useLazyGetProcessGradeQuery,
} = insightsApi;
