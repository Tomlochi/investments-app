import { describe, it, expect } from 'vitest';
import { computeStopRisk, findBreachedHoldings } from './stopRisk';
import type { Stock } from '../types';

function holding(over: Partial<Stock> & { symbol: string }): Stock {
  return { name: over.symbol, quantity: 10, purchasePrice: 100, ...over };
}

describe('computeStopRisk', () => {
  it('returns zeroed totals for an empty portfolio', () => {
    const result = computeStopRisk([], 0);
    expect(result.riskAmount).toBe(0);
    expect(result.riskPercent).toBe(0);
    expect(result.protectedCount).toBe(0);
    expect(result.unprotectedCount).toBe(0);
    expect(result.breachedCount).toBe(0);
    expect(result.perHolding).toEqual([]);
  });

  it('counts holdings with no stop as unprotected and excludes them from the dollar figure', () => {
    const result = computeStopRisk(
      [holding({ symbol: 'AAA', currentPrice: 120 }), holding({ symbol: 'BBB', currentPrice: 90 })],
      2100
    );
    expect(result.riskAmount).toBe(0);
    expect(result.protectedCount).toBe(0);
    expect(result.unprotectedCount).toBe(2);
    expect(result.perHolding).toEqual([]);
  });

  it('counts a holding with a stop but no current price as unprotected', () => {
    const result = computeStopRisk([holding({ symbol: 'AAA', stopPrice: 90 })], 1000);
    expect(result.riskAmount).toBe(0);
    expect(result.protectedCount).toBe(0);
    expect(result.unprotectedCount).toBe(1);
  });

  it('sums risk across protected holdings', () => {
    // AAA: (120 - 100) * 10 = 200   BBB: (50 - 45) * 10 = 50
    const result = computeStopRisk(
      [
        holding({ symbol: 'AAA', currentPrice: 120, stopPrice: 100 }),
        holding({ symbol: 'BBB', currentPrice: 50, stopPrice: 45 }),
      ],
      1700
    );
    expect(result.riskAmount).toBe(250);
    expect(result.protectedCount).toBe(2);
    expect(result.unprotectedCount).toBe(0);
    expect(result.breachedCount).toBe(0);
  });

  it('treats a breached holding as zero pending risk but still counts it protected', () => {
    const result = computeStopRisk(
      [
        holding({ symbol: 'AAA', currentPrice: 120, stopPrice: 100 }),
        holding({ symbol: 'DOWN', currentPrice: 40, stopPrice: 45 }),
      ],
      1600
    );
    expect(result.riskAmount).toBe(200);
    expect(result.breachedCount).toBe(1);
    expect(result.protectedCount).toBe(2);
    expect(result.unprotectedCount).toBe(0);
  });

  it('treats a price exactly at the stop as breached', () => {
    const result = computeStopRisk([holding({ symbol: 'AAA', currentPrice: 45, stopPrice: 45 })], 450);
    expect(result.riskAmount).toBe(0);
    expect(result.breachedCount).toBe(1);
  });

  it('computes riskPercent against total value and avoids dividing by zero', () => {
    const stocks = [holding({ symbol: 'AAA', currentPrice: 120, stopPrice: 100 })];
    expect(computeStopRisk(stocks, 1000).riskPercent).toBeCloseTo(20);
    expect(computeStopRisk(stocks, 0).riskPercent).toBe(0);
    expect(computeStopRisk(stocks, -5).riskPercent).toBe(0);
  });

  it('sorts perHolding by risk descending, breached entries last', () => {
    const result = computeStopRisk(
      [
        holding({ symbol: 'SMALL', currentPrice: 50, stopPrice: 48 }),
        holding({ symbol: 'BREACH', currentPrice: 40, stopPrice: 45 }),
        holding({ symbol: 'BIG', currentPrice: 200, stopPrice: 150 }),
      ],
      5000
    );
    expect(result.perHolding.map(h => h.symbol)).toEqual(['BIG', 'SMALL', 'BREACH']);
    expect(result.perHolding[2].risk).toBe(0);
  });

  it('reports each holding risk as a percent of portfolio value', () => {
    const result = computeStopRisk([holding({ symbol: 'AAA', currentPrice: 120, stopPrice: 100 })], 1000);
    expect(result.perHolding[0].percentOfPortfolio).toBeCloseTo(20);
  });
});

describe('findBreachedHoldings', () => {
  it('returns only holdings whose price is at or below their stop', () => {
    const result = findBreachedHoldings(
      [
        holding({ symbol: 'OK', stopPrice: 100 }),
        holding({ symbol: 'UNDER', stopPrice: 100 }),
        holding({ symbol: 'EQUAL', stopPrice: 100 }),
      ],
      { OK: 120, UNDER: 90, EQUAL: 100 }
    );
    expect(result.map(r => r.symbol).sort()).toEqual(['EQUAL', 'UNDER']);
  });

  it('ignores holdings with no stop set', () => {
    expect(findBreachedHoldings([holding({ symbol: 'AAA' })], { AAA: 1 })).toEqual([]);
  });

  it('ignores symbols missing from the price map', () => {
    expect(findBreachedHoldings([holding({ symbol: 'AAA', stopPrice: 100 })], {})).toEqual([]);
  });

  it('reports the breaching price and the stop', () => {
    const [breach] = findBreachedHoldings([holding({ symbol: 'AAA', stopPrice: 100 })], { AAA: 90 });
    expect(breach).toEqual({ symbol: 'AAA', price: 90, stopPrice: 100 });
  });

  it('returns breaches regardless of whether stopBreachedAt is already set', () => {
    const result = findBreachedHoldings(
      [holding({ symbol: 'AAA', stopPrice: 100, stopBreachedAt: '2026-08-01T00:00:00.000Z' })],
      { AAA: 90 }
    );
    expect(result).toHaveLength(1);
  });
});
