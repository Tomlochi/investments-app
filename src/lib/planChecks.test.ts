import { describe, it, expect } from 'vitest';
import { runPlanChecks } from './planChecks';

const base = {
  equity: 100_000,
  riskPerTradePercent: 1,
  maxPositionPercent: 20,
  entryHigh: 50,
  stopPrice: 45,
  target1: 60,
  shares: 200,
  atr14: 2.5,
  sameSectorPercent: 10,
};

describe('runPlanChecks', () => {
  it('reports nothing when the plan is within every limit', () => {
    expect(runPlanChecks(base)).toEqual([]);
  });

  it('flags a position above the size cap', () => {
    const flags = runPlanChecks({ ...base, shares: 600 });
    expect(flags.some(f => f.includes('exceeds the'))).toBe(true);
  });

  it('flags risk above the per-trade budget', () => {
    const flags = runPlanChecks({ ...base, shares: 300 });
    expect(flags.some(f => f.toLowerCase().includes('risk budget'))).toBe(true);
  });

  it('flags reward-to-risk below 1.5', () => {
    const flags = runPlanChecks({ ...base, target1: 55.5 });
    expect(flags.some(f => f.includes('Reward-to-risk'))).toBe(true);
  });

  it('flags a stop tighter than one ATR', () => {
    const flags = runPlanChecks({ ...base, stopPrice: 48.5 });
    expect(flags.some(f => f.includes('ATR'))).toBe(true);
  });

  it('flags heavy concentration in one sector', () => {
    const flags = runPlanChecks({ ...base, sameSectorPercent: 45 });
    expect(flags.some(f => f.toLowerCase().includes('sector'))).toBe(true);
  });

  it('reports only the no-risk problem when the stop is above entry', () => {
    const flags = runPlanChecks({ ...base, stopPrice: 55 });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toContain('no defined risk');
  });
});
