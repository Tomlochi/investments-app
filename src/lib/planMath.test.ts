import { describe, it, expect } from 'vitest';
import {
  computeSizing,
  plannedR,
  realizedR,
  computeScorecard,
  bySetup,
  unplannedSymbols,
} from './planMath';
import type { TradePlan, Stock } from '../types';

describe('computeSizing', () => {
  const base = { equity: 100_000, riskPerTradePercent: 1, maxPositionPercent: 20 };

  it('sizes from the risk budget when the position cap is not binding', () => {
    const r = computeSizing({ ...base, entryHigh: 50, stopPrice: 45 });
    expect(r.valid).toBe(true);
    expect(r.riskBudget).toBe(1000);
    expect(r.riskPerShare).toBe(5);
    expect(r.suggestedShares).toBe(200);
    expect(r.positionCap).toBe(400);
    expect(r.finalShares).toBe(200);
  });

  it('clamps to the position cap when a tight stop would oversize the position', () => {
    const r = computeSizing({ ...base, entryHigh: 50, stopPrice: 49 });
    expect(r.suggestedShares).toBe(1000);
    expect(r.positionCap).toBe(400);
    expect(r.finalShares).toBe(400);
  });

  it('is invalid when the stop is at or above the entry', () => {
    const r = computeSizing({ ...base, entryHigh: 50, stopPrice: 55 });
    expect(r.valid).toBe(false);
    expect(r.finalShares).toBe(0);
  });

  it('is invalid when equity is zero', () => {
    const r = computeSizing({ ...base, equity: 0, entryHigh: 50, stopPrice: 45 });
    expect(r.valid).toBe(false);
    expect(r.finalShares).toBe(0);
  });
});

describe('plannedR', () => {
  it('returns reward divided by risk', () => {
    expect(plannedR(50, 45, 60)).toBe(2);
  });

  it('returns null when risk is not positive', () => {
    expect(plannedR(50, 50, 60)).toBeNull();
  });
});

describe('realizedR', () => {
  it('returns a positive multiple for a winner', () => {
    expect(realizedR(50, 45, 60)).toBe(2);
  });

  it('returns -1 for a trade stopped out exactly', () => {
    expect(realizedR(50, 45, 45)).toBe(-1);
  });

  it('returns null when the initial risk is not positive', () => {
    expect(realizedR(50, 50, 60)).toBeNull();
  });
});

function closedPlan(over: Partial<TradePlan> = {}): TradePlan {
  return {
    id: Math.random().toString(36).slice(2),
    symbol: 'AAA',
    name: 'Test Co',
    status: 'closed',
    setup: 'breakout',
    thesis: 't',
    invalidation: 'i',
    entryLow: 49,
    entryHigh: 50,
    stopPrice: 45,
    target1: 60,
    plannedShares: 100,
    riskPercent: 1,
    conviction: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    actualEntryPrice: 50,
    actualShares: 100,
    initialStopPrice: 45,
    openedAt: '2026-01-02T00:00:00.000Z',
    actualExitPrice: 60,
    closedAt: '2026-01-10T00:00:00.000Z',
    exitReason: 'target-hit',
    ...over,
  };
}

describe('computeScorecard', () => {
  it('computes expectancy from one +2R winner and one -1R loser', () => {
    const plans = [
      closedPlan({ actualExitPrice: 60, exitReason: 'target-hit' }),
      closedPlan({ actualExitPrice: 45, exitReason: 'stop-hit' }),
    ];
    const s = computeScorecard(plans, []);
    expect(s.closedCount).toBe(2);
    expect(s.winRate).toBe(0.5);
    expect(s.avgWinR).toBe(2);
    expect(s.avgLossR).toBe(1);
    expect(s.expectancyR).toBe(0.5);
  });

  it('counts a discretionary exit as broken adherence', () => {
    const plans = [
      closedPlan({ exitReason: 'target-hit' }),
      closedPlan({ exitReason: 'discretionary' }),
    ];
    expect(computeScorecard(plans, []).adherencePercent).toBe(50);
  });

  it('counts a profitable discretionary exit below target as cutting a winner early', () => {
    const plans = [closedPlan({ actualExitPrice: 55, exitReason: 'discretionary' })];
    expect(computeScorecard(plans, []).cutWinnersEarly).toBe(1);
  });

  it('counts an exit below the live stop as holding a loser', () => {
    const plans = [closedPlan({ actualExitPrice: 40, exitReason: 'stop-hit' })];
    expect(computeScorecard(plans, []).heldLosers).toBe(1);
  });

  it('reports coverage as the share of holdings that have an open plan', () => {
    const holdings = [
      { symbol: 'AAA', name: 'A', quantity: 10, purchasePrice: 1 },
      { symbol: 'BBB', name: 'B', quantity: 10, purchasePrice: 1 },
    ] as Stock[];
    const plans = [closedPlan({ symbol: 'AAA', status: 'open' })];
    expect(computeScorecard(plans, holdings).coveragePercent).toBe(50);
  });

  it('returns nulls rather than NaN when there is nothing to measure', () => {
    const s = computeScorecard([], []);
    expect(s.expectancyR).toBeNull();
    expect(s.adherencePercent).toBeNull();
    expect(s.coveragePercent).toBeNull();
    expect(s.cutWinnersEarly).toBe(0);
  });
});

describe('bySetup', () => {
  it('groups closed plans by setup and reports expectancy per group', () => {
    const plans = [
      closedPlan({ setup: 'breakout', actualExitPrice: 60 }),
      closedPlan({ setup: 'breakout', actualExitPrice: 45 }),
      closedPlan({ setup: 'value', actualExitPrice: 60 }),
    ];
    const rows = bySetup(plans);
    const breakout = rows.find(r => r.setup === 'breakout')!;
    expect(breakout.count).toBe(2);
    expect(breakout.expectancyR).toBe(0.5);
    expect(rows.find(r => r.setup === 'value')!.count).toBe(1);
  });
});

describe('unplannedSymbols', () => {
  it('lists held symbols with no open plan', () => {
    const holdings = [
      { symbol: 'AAA', name: 'A', quantity: 10, purchasePrice: 1 },
      { symbol: 'BBB', name: 'B', quantity: 10, purchasePrice: 1 },
    ] as Stock[];
    const plans = [closedPlan({ symbol: 'AAA', status: 'open' })];
    expect(unplannedSymbols(plans, holdings)).toEqual(['BBB']);
  });

  it('does not count a closed plan as coverage', () => {
    const holdings = [{ symbol: 'AAA', name: 'A', quantity: 10, purchasePrice: 1 }] as Stock[];
    const plans = [closedPlan({ symbol: 'AAA', status: 'closed' })];
    expect(unplannedSymbols(plans, holdings)).toEqual(['AAA']);
  });
});
