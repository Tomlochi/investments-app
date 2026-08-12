import { describe, it, expect } from 'vitest';
import { stopDistancePercent, stopWarning } from './stopAdvice';

describe('stopDistancePercent', () => {
  it('returns the percentage the stop sits below the current price', () => {
    expect(stopDistancePercent(90, 100)).toBeCloseTo(10);
  });

  it('returns a negative percentage when the stop is above the current price', () => {
    expect(stopDistancePercent(110, 100)).toBeCloseTo(-10);
  });

  it('returns null when the current price is not usable', () => {
    expect(stopDistancePercent(90, 0)).toBeNull();
    expect(stopDistancePercent(90, -5)).toBeNull();
  });
});

describe('stopWarning', () => {
  it('returns null for a normal stop below the price', () => {
    expect(stopWarning(92, 100)).toBeNull();
  });

  it('warns when the stop is at or above the current price', () => {
    expect(stopWarning(100, 100)).toMatch(/at or above/i);
    expect(stopWarning(105, 100)).toMatch(/at or above/i);
  });

  it('warns when the stop is more than 50% below the current price', () => {
    expect(stopWarning(40, 100)).toMatch(/unusually wide/i);
  });

  it('does not warn at exactly 50% below', () => {
    expect(stopWarning(50, 100)).toBeNull();
  });

  it('warns when the stop is not a usable number', () => {
    expect(stopWarning(0, 100)).toMatch(/not a usable/i);
    expect(stopWarning(Number.NaN, 100)).toMatch(/not a usable/i);
  });
});
