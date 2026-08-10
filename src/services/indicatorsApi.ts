import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Indicators } from '../types';

export const indicatorsApi = createApi({
  reducerPath: 'indicatorsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getIndicators: builder.query<Indicators, string>({
      query: (symbol) => `/indicators/${encodeURIComponent(symbol)}`,
    }),
  }),
});

export const { useGetIndicatorsQuery, useLazyGetIndicatorsQuery } = indicatorsApi;
