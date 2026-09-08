import { describe, it, expect } from 'vitest';
import { changeBucket, aggregateBySector } from './heatmap';
import type { HeatmapTile } from './heatmap';

function tile(over: Partial<HeatmapTile> & { symbol: string }): HeatmapTile {
  return {
    name: over.symbol,
    sector: 'Information Technology',
    changePercent: 0,
    marketCap: 1_000_000_000,
    ...over,
  };
}

describe('changeBucket', () => {
  it('classifies zero and near-zero as neutral', () => {
    expect(changeBucket(0)).toBe('neutral');
    expect(changeBucket(0.24)).toBe('neutral');
    expect(changeBucket(-0.24)).toBe('neutral');
  });

  it('treats each boundary as inclusive at its lower edge', () => {
    expect(changeBucket(0.25)).toBe('slight-up');
    expect(changeBucket(0.75)).toBe('up');
    expect(changeBucket(2)).toBe('strong-up');
    expect(changeBucket(-0.25)).toBe('slight-down');
    expect(changeBucket(-0.75)).toBe('down');
    expect(changeBucket(-2)).toBe('strong-down');
  });

  it('classifies values inside each band', () => {
    expect(changeBucket(0.5)).toBe('slight-up');
    expect(changeBucket(1.4)).toBe('up');
    expect(changeBucket(9)).toBe('strong-up');
    expect(changeBucket(-0.5)).toBe('slight-down');
    expect(changeBucket(-1.4)).toBe('down');
    expect(changeBucket(-9)).toBe('strong-down');
  });

  it('returns neutral for non-finite input rather than throwing', () => {
    expect(changeBucket(Number.NaN)).toBe('neutral');
    expect(changeBucket(Number.POSITIVE_INFINITY)).toBe('neutral');
    expect(changeBucket(Number.NEGATIVE_INFINITY)).toBe('neutral');
  });
});

describe('aggregateBySector', () => {
  it('returns an empty array for no tiles', () => {
    expect(aggregateBySector([])).toEqual([]);
  });

  it('returns a single constituent change unchanged', () => {
    const result = aggregateBySector([
      tile({ symbol: 'AAA', sector: 'Energy', changePercent: 3.5, marketCap: 5 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sector).toBe('Energy');
    expect(result[0].changePercent).toBeCloseTo(3.5);
    expect(result[0].marketCap).toBe(5);
    expect(result[0].count).toBe(1);
  });

  it('weights sector change by market cap, not by count', () => {
    // A huge company up 1% and a tiny one down 9%.
    // Plain mean would be -4%; weighted is close to +1%.
    const result = aggregateBySector([
      tile({ symbol: 'BIG', sector: 'Energy', changePercent: 1, marketCap: 1_000 }),
      tile({ symbol: 'TINY', sector: 'Energy', changePercent: -9, marketCap: 1 }),
    ]);
    expect(result[0].changePercent).toBeCloseTo((1 * 1000 + -9 * 1) / 1001);
    expect(result[0].changePercent).toBeGreaterThan(0);
    expect(result[0].count).toBe(2);
  });

  it('sums market cap per sector', () => {
    const result = aggregateBySector([
      tile({ symbol: 'A', sector: 'Energy', marketCap: 30 }),
      tile({ symbol: 'B', sector: 'Energy', marketCap: 70 }),
    ]);
    expect(result[0].marketCap).toBe(100);
  });

  it('sorts sectors by market cap descending', () => {
    const result = aggregateBySector([
      tile({ symbol: 'S', sector: 'Utilities', marketCap: 10 }),
      tile({ symbol: 'L', sector: 'Financials', marketCap: 900 }),
      tile({ symbol: 'M', sector: 'Energy', marketCap: 100 }),
    ]);
    expect(result.map(r => r.sector)).toEqual(['Financials', 'Energy', 'Utilities']);
  });

  it('excludes tiles with zero or negative market cap from weight and totals', () => {
    const result = aggregateBySector([
      tile({ symbol: 'GOOD', sector: 'Energy', changePercent: 2, marketCap: 100 }),
      tile({ symbol: 'ZERO', sector: 'Energy', changePercent: -50, marketCap: 0 }),
      tile({ symbol: 'NEG', sector: 'Energy', changePercent: -50, marketCap: -5 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].marketCap).toBe(100);
    expect(result[0].changePercent).toBeCloseTo(2);
    expect(result[0].count).toBe(1);
  });

  it('drops a sector entirely when no constituent has usable market cap', () => {
    expect(aggregateBySector([tile({ symbol: 'ZERO', marketCap: 0 })])).toEqual([]);
  });

  it('keeps sectors separate', () => {
    const result = aggregateBySector([
      tile({ symbol: 'A', sector: 'Energy', changePercent: 1, marketCap: 10 }),
      tile({ symbol: 'B', sector: 'Utilities', changePercent: -1, marketCap: 20 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.sector === 'Energy')?.changePercent).toBeCloseTo(1);
    expect(result.find(r => r.sector === 'Utilities')?.changePercent).toBeCloseTo(-1);
  });
});
