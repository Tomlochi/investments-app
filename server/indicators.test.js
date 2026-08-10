import { describe, it, expect } from 'vitest';
import { sma, rsi14, atr14, fiftyTwoWeekPosition } from './indicators.js';

describe('sma', () => {
  it('averages the last N closes', () => {
    expect(sma([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toBe(8);
  });

  it('returns null when there is less history than the period', () => {
    expect(sma([1, 2, 3], 5)).toBeNull();
  });
});

describe('atr14', () => {
  it('returns the constant range when every bar has the same true range', () => {
    const bars = Array.from({ length: 15 }, () => ({ high: 12, low: 10, close: 11 }));
    expect(atr14(bars)).toBeCloseTo(2, 10);
  });

  it('returns null with fewer than 15 bars', () => {
    const bars = Array.from({ length: 14 }, () => ({ high: 12, low: 10, close: 11 }));
    expect(atr14(bars)).toBeNull();
  });
});

describe('rsi14', () => {
  it('is 100 when every change is a gain', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi14(closes)).toBe(100);
  });

  it('is 0 when every change is a loss', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi14(closes)).toBe(0);
  });

  it('stays within bounds on mixed data', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? i : -i));
    const value = rsi14(closes);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });

  it('returns null with fewer than 15 closes', () => {
    expect(rsi14([1, 2, 3])).toBeNull();
  });
});

describe('fiftyTwoWeekPosition', () => {
  it('is 1 at the top of the range', () => {
    expect(fiftyTwoWeekPosition([10, 12, 15, 20])).toBe(1);
  });

  it('is 0 at the bottom of the range', () => {
    expect(fiftyTwoWeekPosition([20, 15, 12, 10])).toBe(0);
  });

  it('returns null when the range has no width', () => {
    expect(fiftyTwoWeekPosition([10, 10, 10])).toBeNull();
  });
});
