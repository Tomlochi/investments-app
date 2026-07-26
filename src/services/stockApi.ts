import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { StockQuote, HistoricalDataPoint, SearchResult, HistoryBatchResponse, ProfileBatchResponse } from '../types';

export const stockApi = createApi({
  reducerPath: 'stockApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Quote', 'Historical', 'Search', 'HistoryBatch', 'ProfileBatch'],
  endpoints: (builder) => ({
    getQuote: builder.query<StockQuote, string>({
      query: (symbol) => `/quote/${symbol}`,
      providesTags: (_, __, symbol) => [{ type: 'Quote', id: symbol }],
    }),

    getHistorical: builder.query<HistoricalDataPoint[], { symbol: string; range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y' }>({
      query: ({ symbol, range }) => `/historical/${symbol}?range=${range}`,
      providesTags: (_, __, { symbol, range }) => [{ type: 'Historical', id: `${symbol}-${range}` }],
    }),

    searchStocks: builder.query<SearchResult[], string>({
      query: (query) => `/search?q=${encodeURIComponent(query)}`,
      providesTags: ['Search'],
    }),

    getHistoryBatch: builder.query<HistoryBatchResponse, { symbols: string[]; range: '1mo' | '3mo' | '6mo' | '1y' | '5y' }>({
      query: ({ symbols, range }) => `/history-batch?symbols=${symbols.map(encodeURIComponent).join(',')}&range=${range}`,
      providesTags: (_, __, { symbols, range }) => [{ type: 'HistoryBatch', id: `${symbols.join(',')}-${range}` }],
    }),

    getProfileBatch: builder.query<ProfileBatchResponse, string[]>({
      query: (symbols) => `/profile-batch?symbols=${symbols.map(encodeURIComponent).join(',')}`,
      providesTags: (_, __, symbols) => [{ type: 'ProfileBatch', id: symbols.join(',') }],
    }),
  }),
});

export const { useGetQuoteQuery, useGetHistoricalQuery, useSearchStocksQuery, useGetHistoryBatchQuery, useGetProfileBatchQuery } = stockApi;
