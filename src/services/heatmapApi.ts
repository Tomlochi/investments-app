import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { HeatmapResponse } from '../types';

export const heatmapApi = createApi({
  reducerPath: 'heatmapApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getHeatmap: builder.query<HeatmapResponse, void>({
      query: () => '/heatmap',
      // The server caches for 60s; matching it here avoids refetching on every remount.
      keepUnusedDataFor: 60,
    }),
  }),
});

export const { useGetHeatmapQuery } = heatmapApi;
