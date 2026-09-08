import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Treemap, ResponsiveContainer } from 'recharts';
import { Maximize2, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { HeatmapLegend } from './HeatmapLegend';
import { HeatmapModal } from './HeatmapModal';
import { aggregateBySector, changeBucket } from '../../lib/heatmap';
import { bucketColor, bucketInk } from '../../lib/heatmapColors';
import { useGetHeatmapQuery } from '../../services/heatmapApi';
import type { RootState } from '../../store';

/** All optional: recharts injects the geometry at runtime, so `<SectorCell />` must type-check bare. */
interface SectorNode {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  changePercent?: number;
  theme?: 'light' | 'dark';
}

/** Custom tile: recharts hands us the computed geometry, we own the paint. */
function SectorCell(props: SectorNode) {
  const { x = 0, y = 0, width, height, name, changePercent, theme } = props;
  if (width == null || height == null || width <= 0 || height <= 0) return null;

  const change = changePercent ?? 0;
  const bucket = changeBucket(change);
  const mode = theme ?? 'light';

  // A label needs room for the sector name and the number without clipping.
  const showLabel = width > 80 && height > 40;

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={3}
        fill={bucketColor(bucket, mode)}
      />
      {showLabel && (
        <>
          <text
            x={x + 8}
            y={y + 20}
            fill={bucketInk(bucket, mode)}
            fontSize={12}
            fontWeight={600}
          >
            {name}
          </text>
          <text x={x + 8} y={y + 36} fill={bucketInk(bucket, mode)} fontSize={12}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </text>
        </>
      )}
    </g>
  );
}

export function SectorHeatmap() {
  const theme = useSelector((state: RootState) => state.ui.theme);
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isFetching, isError, refetch } = useGetHeatmapQuery();

  const sectors = useMemo(() => {
    if (!data) return [];
    return aggregateBySector(data.tiles).map(s => ({
      name: s.sector,
      size: s.marketCap,
      changePercent: s.changePercent,
      theme,
    }));
  }, [data, theme]);

  const partial = data != null && data.count < data.expected;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-blue-500" />
            S&amp;P 500 by sector
          </CardTitle>
          {data && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {new Date(data.asOf).toLocaleTimeString()}
              {partial && ` · ${data.count} of ${data.expected} constituents`}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setExpanded(true)}
          disabled={!data}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Expand
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isError ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Market data unavailable right now.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          // Skeleton at the final height so the dashboard does not jump when data lands.
          <div className="h-[260px] animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
        ) : (
          // Hold the previous render at reduced opacity on refetch — no skeleton flash.
          <div className={isFetching ? 'h-[260px] opacity-60 transition-opacity' : 'h-[260px]'}>
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={sectors}
                dataKey="size"
                nameKey="name"
                aspectRatio={4 / 3}
                isAnimationActive={false}
                content={<SectorCell />}
              />
            </ResponsiveContainer>
          </div>
        )}

        <HeatmapLegend />
      </CardContent>

      {data && (
        <HeatmapModal
          open={expanded}
          onOpenChange={setExpanded}
          tiles={data.tiles}
          asOf={data.asOf}
        />
      )}
    </Card>
  );
}
