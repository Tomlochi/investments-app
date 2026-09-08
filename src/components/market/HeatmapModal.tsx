import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Treemap, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { HeatmapLegend } from './HeatmapLegend';
import { changeBucket } from '../../lib/heatmap';
import { bucketColor, bucketInk } from '../../lib/heatmapColors';
import { cn } from '../../lib/utils';
import type { RootState } from '../../store';
import type { HeatmapResponse } from '../../types';

type Tile = HeatmapResponse['tiles'][number];

/** All optional: recharts injects the geometry at runtime, so `<StockCell />` must type-check bare. */
interface StockNode {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  symbol?: string;
  changePercent?: number;
  owned?: boolean;
  theme?: 'light' | 'dark';
}

function StockCell(props: StockNode) {
  const { x = 0, y = 0, width, height, depth, symbol, changePercent, owned, theme } = props;
  if (width == null || height == null || width <= 0 || height <= 0) return null;

  // depth 1 is the sector container — draw only its outline, the children carry the colour.
  if (depth === 1) {
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={theme === 'dark' ? '#52514e' : '#c3c2b7'}
        strokeWidth={1}
      />
    );
  }

  const change = changePercent ?? 0;
  const bucket = changeBucket(change);
  const mode = theme ?? 'light';
  const ink = bucketInk(bucket, mode);
  // Owned names are always labelled; everything else needs room for the ticker.
  const showLabel = owned || (width > 34 && height > 16);
  // The signed number is the secondary encoding the green/red scale depends on —
  // print it wherever the tile can hold a second line.
  const showChange = width > 48 && height > 30;

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={2}
        fill={bucketColor(bucket, mode)}
        // Ownership is a shape difference, not a colour difference — it survives CVD
        // and does not consume a step of the diverging scale.
        stroke={owned ? (mode === 'dark' ? '#1a1a19' : '#fcfcfb') : 'none'}
        strokeWidth={owned ? 2 : 0}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showChange ? -2 : 3)}
          textAnchor="middle"
          fill={ink}
          fontSize={Math.min(11, Math.max(8, width / 5))}
          fontWeight={owned ? 700 : 500}
        >
          {symbol}
        </text>
      )}
      {showLabel && showChange && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 11}
          textAnchor="middle"
          fill={ink}
          fontSize={Math.min(10, Math.max(8, width / 6))}
        >
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </text>
      )}
    </g>
  );
}

export function HeatmapModal({
  open,
  onOpenChange,
  tiles,
  asOf,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tiles: Tile[];
  asOf: string;
}) {
  const theme = useSelector((state: RootState) => state.ui.theme);
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);
  const [view, setView] = useState<'map' | 'table'>('map');
  const [sector, setSector] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'change' | 'cap'>('cap');

  const ownedSymbols = useMemo(
    () => new Set(holdings.map(h => h.symbol)),
    [holdings]
  );

  const sectors = useMemo(
    () => [...new Set(tiles.map(t => t.sector))].sort(),
    [tiles]
  );

  const filtered = useMemo(
    () => (sector === 'all' ? tiles : tiles.filter(t => t.sector === sector)),
    [tiles, sector]
  );

  // Nested treemap: depth 1 groups by sector, depth 2 is the constituent.
  const treeData = useMemo(() => {
    const bySector = new Map<string, Tile[]>();
    for (const t of filtered) {
      bySector.set(t.sector, [...(bySector.get(t.sector) ?? []), t]);
    }
    return [...bySector.entries()]
      .map(([name, group]) => ({
        name,
        theme,
        children: group.map(t => ({
          name: t.symbol,
          symbol: t.symbol,
          size: t.marketCap,
          changePercent: t.changePercent,
          owned: ownedSymbols.has(t.symbol),
          theme,
        })),
      }))
      .sort(
        (a, b) =>
          b.children.reduce((s, c) => s + c.size, 0) -
          a.children.reduce((s, c) => s + c.size, 0)
      );
  }, [filtered, ownedSymbols, theme]);

  const tableRows = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) =>
      sortKey === 'change' ? b.changePercent - a.changePercent : b.marketCap - a.marketCap
    );
    return rows;
  }, [filtered, sortKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] grid-rows-[auto_auto_1fr] overflow-hidden">
        <DialogHeader>
          <DialogTitle>S&amp;P 500 — {filtered.length} constituents</DialogTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(asOf).toLocaleTimeString()} · your holdings are outlined
          </p>
        </DialogHeader>

        {/* One control row above the content, scoping both views. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={view === 'map' ? 'default' : 'outline'}
              onClick={() => setView('map')}
            >
              Map
            </Button>
            <Button
              size="sm"
              variant={view === 'table' ? 'default' : 'outline'}
              onClick={() => setView('table')}
            >
              Table
            </Button>
          </div>

          <select
            value={sector}
            onChange={e => setSector(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="all">All sectors</option>
            {sectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {view === 'table' && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={sortKey === 'cap' ? 'default' : 'outline'}
                onClick={() => setSortKey('cap')}
              >
                By size
              </Button>
              <Button
                size="sm"
                variant={sortKey === 'change' ? 'default' : 'outline'}
                onClick={() => setSortKey('change')}
              >
                By change
              </Button>
            </div>
          )}

          <div className="ml-auto">
            <HeatmapLegend />
          </div>
        </div>

        <div className="min-h-0 overflow-auto">
          {view === 'map' ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treeData}
                dataKey="size"
                nameKey="name"
                aspectRatio={16 / 9}
                isAnimationActive={false}
                content={<StockCell />}
              />
            </ResponsiveContainer>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-900">
                <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                  <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Symbol</th>
                  <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Sector</th>
                  <th className="py-2 pr-4 text-right font-medium text-gray-500 dark:text-gray-400">Change</th>
                  <th className="py-2 text-right font-medium text-gray-500 dark:text-gray-400">Market cap</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(t => (
                  <tr
                    key={t.symbol}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-1.5 pr-4">
                      <span className={cn('font-medium', ownedSymbols.has(t.symbol) && 'font-bold text-blue-600 dark:text-blue-400')}>
                        {t.symbol}
                      </span>
                      {ownedSymbols.has(t.symbol) && (
                        <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">held</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">{t.name}</td>
                    <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400">{t.sector}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-gray-900 dark:text-gray-100">
                      {t.changePercent >= 0 ? '+' : ''}{t.changePercent.toFixed(2)}%
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {t.marketCap >= 1e12
                        ? `$${(t.marketCap / 1e12).toFixed(2)}T`
                        : `$${(t.marketCap / 1e9).toFixed(1)}B`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
