import { describe, it, expect, beforeEach, vi } from 'vitest';

// The slice reads localStorage at module load, so stub it before importing.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const { default: reducer, savePlan, openPlan, closePlan, updateStop, setGrade } = await import(
  './tradePlanSlice'
);

import type { TradePlan } from '../../types';

function idea(over: Partial<TradePlan> = {}): TradePlan {
  return {
    id: 'p1',
    symbol: 'AAA',
    name: 'Test Co',
    status: 'idea',
    setup: 'breakout',
    thesis: 'why',
    invalidation: 'what breaks it',
    entryLow: 49,
    entryHigh: 50,
    stopPrice: 45,
    target1: 60,
    plannedShares: 100,
    riskPercent: 1,
    conviction: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('tradePlanSlice lifecycle', () => {
  beforeEach(() => store.clear());

  it('snapshots the stop into initialStopPrice on open', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, openPlan({ id: 'p1', actualEntryPrice: 50.25, actualShares: 90 }));

    const plan = state.plans[0];
    expect(plan.status).toBe('open');
    expect(plan.initialStopPrice).toBe(45);
    expect(plan.actualEntryPrice).toBe(50.25);
    expect(plan.actualShares).toBe(90);
    expect(plan.openedAt).toBeTruthy();
  });

  it('leaves initialStopPrice untouched when the live stop is raised', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, openPlan({ id: 'p1', actualEntryPrice: 50, actualShares: 100 }));
    state = reducer(state, updateStop({ id: 'p1', stopPrice: 52 }));

    // This is the guarantee the whole scorecard rests on: raising a stop must not
    // shrink the risk denominator and inflate historical R.
    expect(state.plans[0].stopPrice).toBe(52);
    expect(state.plans[0].initialStopPrice).toBe(45);
  });

  it('records exit details on close', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, openPlan({ id: 'p1', actualEntryPrice: 50, actualShares: 100 }));
    state = reducer(
      state,
      closePlan({ id: 'p1', actualExitPrice: 60, exitReason: 'target-hit' })
    );

    const plan = state.plans[0];
    expect(plan.status).toBe('closed');
    expect(plan.actualExitPrice).toBe(60);
    expect(plan.exitReason).toBe('target-hit');
    expect(plan.closedAt).toBeTruthy();
  });

  it('refuses to open a plan that is not an idea', () => {
    let state = reducer(undefined, savePlan(idea({ status: 'closed' })));
    state = reducer(state, openPlan({ id: 'p1', actualEntryPrice: 50, actualShares: 100 }));
    expect(state.plans[0].status).toBe('closed');
    expect(state.plans[0].actualEntryPrice).toBeUndefined();
  });

  it('refuses to close a plan that is not open', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, closePlan({ id: 'p1', actualExitPrice: 60, exitReason: 'target-hit' }));
    expect(state.plans[0].status).toBe('idea');
  });

  it('refuses to move the stop on a plan that is not open', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, updateStop({ id: 'p1', stopPrice: 48 }));
    expect(state.plans[0].stopPrice).toBe(45);
  });

  it('replaces an existing plan on save rather than duplicating it', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, savePlan(idea({ target1: 70 })));
    expect(state.plans).toHaveLength(1);
    expect(state.plans[0].target1).toBe(70);
  });

  it('attaches a grade to a closed plan', () => {
    let state = reducer(undefined, savePlan(idea()));
    state = reducer(state, openPlan({ id: 'p1', actualEntryPrice: 50, actualShares: 100 }));
    state = reducer(state, closePlan({ id: 'p1', actualExitPrice: 45, exitReason: 'stop-hit' }));
    state = reducer(
      state,
      setGrade({
        id: 'p1',
        grade: {
          score: 88,
          followedPlan: ['Stopped out exactly as planned'],
          brokePlan: [],
          lesson: 'A losing trade taken on plan is still a good trade.',
          timestamp: '2026-01-10T00:00:00.000Z',
        },
      })
    );
    expect(state.plans[0].grade?.score).toBe(88);
  });
});
