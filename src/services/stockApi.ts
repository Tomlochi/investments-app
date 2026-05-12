import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { StockQuote, HistoricalDataPoint, SearchResult } from '../types';

export const stockApi = createApi({
  reducerPath: 'stockApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Quote', 'Historical', 'Search'],
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
  }),
});

export const { useGetQuoteQuery, useGetHistoricalQuery, useSearchStocksQuery } = stockApi;
