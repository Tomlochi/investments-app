// Pure heatmap classification and aggregation. No React, no network — unit-tested directly.

export interface HeatmapTile {
  symbol: string;
  name: string;
  sector: string;
  changePercent: number;
  marketCap: number;
}

export interface SectorTile {
  sector: string;
  /** Sum of constituent market caps. */
  marketCap: number;
  /** Market-cap-weighted mean of constituent changes. */
  changePercent: number;
  count: number;
}

export type BucketKey =
  | 'strong-up'
  | 'up'
  | 'slight-up'
  | 'neutral'
  | 'slight-down'
  | 'down'
  | 'strong-down';

/**
 * Classify a percentage move into one of seven diverging buckets.
 * Boundaries are inclusive at the lower edge of each absolute band:
 * <0.25 neutral, >=0.25 slight, >=0.75 mid, >=2 strong.
 * A bad quote returns neutral rather than throwing — a colorless tile beats a broken map.
 */
export function changeBucket(changePercent: number): BucketKey {
  if (!Number.isFinite(changePercent)) return 'neutral';

  const magnitude = Math.abs(changePercent);
  if (magnitude < 0.25) return 'neutral';

  const up = changePercent > 0;
  if (magnitude < 0.75) return up ? 'slight-up' : 'slight-down';
  if (magnitude < 2) return up ? 'up' : 'down';
  return up ? 'strong-up' : 'strong-down';
}

/**
 * Roll constituents up to sectors, sorted by market cap descending.
 *
 * Sector change is weighted by market cap: a plain mean would let the smallest company
 * in a sector move its color as much as the largest, which misreports what the sector did.
 * Tiles without a usable market cap carry no weight and are excluded entirely.
 */
export function aggregateBySector(tiles: HeatmapTile[]): SectorTile[] {
  const bySector = new Map<string, { capSum: number; weighted: number; count: number }>();

  for (const t of tiles) {
    if (!Number.isFinite(t.marketCap) || t.marketCap <= 0) continue;

    const change = Number.isFinite(t.changePercent) ? t.changePercent : 0;
    const entry = bySector.get(t.sector) ?? { capSum: 0, weighted: 0, count: 0 };
    entry.capSum += t.marketCap;
    entry.weighted += change * t.marketCap;
    entry.count += 1;
    bySector.set(t.sector, entry);
  }

  return [...bySector.entries()]
    .map(([sector, { capSum, weighted, count }]) => ({
      sector,
      marketCap: capSum,
      changePercent: capSum > 0 ? weighted / capSum : 0,
      count,
    }))
    .sort((a, b) => b.marketCap - a.marketCap);
}
