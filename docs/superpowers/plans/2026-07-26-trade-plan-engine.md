# Trade Plan Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trade plan a first-class object with a planned → open → closed lifecycle, then measure the user's adherence to it with R-multiple-based metrics and three AI decision aids.

**Architecture:** A new `tradePlanSlice` holds intent (entry zone, stop, target, size, thesis, invalidation); `portfolioSlice` stays the source of truth for what is owned. Plan open/close are the only writers of holdings and journal entries for planned trades, so the two stores cannot drift. All computation lives in a pure `src/lib/planMath.ts` with no React or Redux dependency, which is the only code covered by tests.

**Tech Stack:** React 19, TypeScript ~6.0, Redux Toolkit 2.11, RTK Query, Recharts 3.8, Tailwind 4, Express 5, `yahoo-finance2` 3.14, `@anthropic-ai/sdk` 0.95, vitest (added by Task 1).

## Global Constraints

- **Model:** every Claude call uses `claude-opus-5`. Never send `temperature`, `top_p`, or `top_k` — that model rejects them with a 400.
- **Thinking:** adaptive thinking is on by default on `claude-opus-5`; do not pass a `thinking` parameter. `max_tokens` caps thinking *and* response text together, so every call needs headroom above the response size alone.
- **Structured output:** every Claude call uses `output_config: { format: { type: 'json_schema', schema } }`. This is the pattern the existing `getTradeCheck` already follows — copy it.
- **Prompt injection:** every user-supplied string interpolated into a prompt goes through the existing `sanitize()` helper. Symbols use `sanitize(s, 15)`, free text uses an explicit max length.
- **AI is advisory:** no AI call may block a user action. If a call throws, the user's action still completes and the error is surfaced non-blockingly.
- **Long-only:** all plans satisfy `stopPrice < entryHigh < target1`. No short support anywhere.
- **Persistence:** `localStorage` only. Every slice follows the existing `loadFromStorage` / `saveToStorage` pattern from `src/features/cash/cashSlice.ts`.
- **Path alias:** `@/` maps to `src/`. Existing code uses relative imports inside `src/features` and `src/lib` — match the file you are editing.
- **No new runtime dependencies.** vitest is the only addition, and it is a devDependency.
- **Never commit or push.** Stage your work and stop. The user reviews every change before it enters git history. Each task ends with a stage-and-report step, never a commit — offer the commit message, do not run it.

---

### Task 1: Test infrastructure and sizing math

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/planMath.ts`
- Test: `src/lib/planMath.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `computeSizing(input: SizingInput): SizingResult`, `plannedR(entryHigh: number, stopPrice: number, target1: number): number | null`, `realizedR(entry: number, initialStop: number, exit: number): number | null`, and the exported types `SizingInput` and `SizingResult`.

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest@^4
```

Must be v4, not v3. Vitest 3 bundles its own rollup-based Vite; this project runs Vite 8, which is rolldown-based. With both present, `defineConfig` from `vitest/config` types the `plugins` array against the nested Vite while `@vitejs/plugin-react` produces the outer one, and `tsc -b` fails with `Type 'Plugin<any>[]' is not assignable to type 'PluginOption[]'`. Vitest 4 declares `vite ^8` as a peer and reuses the project's install, so there is no second copy and no type conflict.

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Enable vitest in the Vite config**

Change the import at the top of `vite.config.ts` from `'vite'` to `'vitest/config'`, and add a `test` block. The full file becomes:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.js'],
  },
});
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/planMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSizing, plannedR, realizedR } from './planMath';

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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./planMath"`.

- [ ] **Step 6: Write the implementation**

Create `src/lib/planMath.ts`:

```ts
export interface SizingInput {
  equity: number;
  riskPerTradePercent: number;
  maxPositionPercent: number;
  entryHigh: number;
  stopPrice: number;
}

export interface SizingResult {
  riskBudget: number;
  riskPerShare: number;
  /** Shares the risk budget alone allows, before the position cap. */
  suggestedShares: number;
  /** Share ceiling implied by maxPositionPercent. */
  positionCap: number;
  /** The lesser of suggestedShares and positionCap; 0 when invalid. */
  finalShares: number;
  /** False when the inputs cannot produce a position (stop at/above entry, or no equity). */
  valid: boolean;
}

const INVALID: Omit<SizingResult, 'riskBudget' | 'riskPerShare'> = {
  suggestedShares: 0,
  positionCap: 0,
  finalShares: 0,
  valid: false,
};

export function computeSizing(input: SizingInput): SizingResult {
  const { equity, riskPerTradePercent, maxPositionPercent, entryHigh, stopPrice } = input;
  const riskPerShare = entryHigh - stopPrice;
  const riskBudget = (equity * riskPerTradePercent) / 100;

  if (riskPerShare <= 0 || equity <= 0 || entryHigh <= 0) {
    return { riskBudget, riskPerShare, ...INVALID };
  }

  const suggestedShares = Math.floor(riskBudget / riskPerShare);
  const positionCap = Math.floor((equity * maxPositionPercent) / 100 / entryHigh);

  return {
    riskBudget,
    riskPerShare,
    suggestedShares,
    positionCap,
    finalShares: Math.min(suggestedShares, positionCap),
    valid: true,
  };
}

/** Reward-to-risk of the plan as written. Null when the plan has no positive risk. */
export function plannedR(entryHigh: number, stopPrice: number, target1: number): number | null {
  const risk = entryHigh - stopPrice;
  if (risk <= 0) return null;
  return (target1 - entryHigh) / risk;
}

/**
 * Outcome in R. Measured against initialStopPrice — the stop as it stood at
 * open — so that raising a stop mid-trade cannot retroactively inflate R.
 */
export function realizedR(entry: number, initialStop: number, exit: number): number | null {
  const risk = entry - initialStop;
  if (risk <= 0) return null;
  return (exit - entry) / risk;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 9 tests.

- [ ] **Step 8: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add package.json package-lock.json vite.config.ts src/lib/planMath.ts src/lib/planMath.test.ts
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add vitest and position sizing math`

---

### Task 2: Types, tradePlanSlice, settingsSlice

**Files:**
- Modify: `src/types/index.ts` (append at end)
- Create: `src/features/tradeplan/tradePlanSlice.ts`
- Create: `src/features/settings/settingsSlice.ts`
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: types `PlanStatus`, `SetupType`, `ExitReason`, `ProcessGrade`, `TradePlan`, `TradeSettings`. Actions `savePlan(plan: TradePlan)`, `deletePlan(id: string)`, `openPlan({ id, actualEntryPrice, actualShares })`, `closePlan({ id, actualExitPrice, exitReason })`, `setGrade({ id, grade })`, `updateStop({ id, stopPrice })` from `tradePlanSlice`; `setRiskPerTradePercent(n)`, `setMaxPositionPercent(n)` from `settingsSlice`. State shape `state.tradePlan.plans: TradePlan[]` and `state.settings: TradeSettings`.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts`:

```ts
export type PlanStatus = 'idea' | 'open' | 'closed';
export type SetupType = 'breakout' | 'pullback' | 'earnings' | 'value' | 'core-add' | 'other';
export type ExitReason = 'stop-hit' | 'target-hit' | 'thesis-broken' | 'discretionary';

export interface ProcessGrade {
  score: number;
  followedPlan: string[];
  brokePlan: string[];
  lesson: string;
  timestamp: string;
}

export interface TradePlan {
  id: string;
  symbol: string;
  name: string;
  status: PlanStatus;
  setup: SetupType;
  thesis: string;
  invalidation: string;
  entryLow: number;
  entryHigh: number;
  /** Live stop. May be raised while the plan is open. */
  stopPrice: number;
  target1: number;
  target2?: number;
  plannedShares: number;
  riskPercent: number;
  conviction: 1 | 2 | 3 | 4 | 5;
  createdAt: string;

  actualEntryPrice?: number;
  actualShares?: number;
  /** Snapshot of stopPrice at open. Never mutated. All R math uses this. */
  initialStopPrice?: number;
  openedAt?: string;

  actualExitPrice?: number;
  closedAt?: string;
  exitReason?: ExitReason;
  grade?: ProcessGrade;
}

export interface TradeSettings {
  riskPerTradePercent: number;
  maxPositionPercent: number;
}
```

- [ ] **Step 2: Write the trade plan slice**

Create `src/features/tradeplan/tradePlanSlice.ts`:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TradePlan, ExitReason, ProcessGrade } from '../../types';

interface TradePlanState {
  plans: TradePlan[];
}

const STORAGE_KEY = 'trade-plans';

function loadFromStorage(): TradePlan[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load trade plans from storage:', e);
  }
  return [];
}

function saveToStorage(plans: TradePlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error('Failed to save trade plans to storage:', e);
  }
}

const tradePlanSlice = createSlice({
  name: 'tradePlan',
  initialState: { plans: loadFromStorage() } as TradePlanState,
  reducers: {
    /** Creates a new plan or replaces an existing one by id. */
    savePlan: (state, action: PayloadAction<TradePlan>) => {
      const index = state.plans.findIndex(p => p.id === action.payload.id);
      if (index >= 0) state.plans[index] = action.payload;
      else state.plans.unshift(action.payload);
      saveToStorage(state.plans);
    },
    deletePlan: (state, action: PayloadAction<string>) => {
      state.plans = state.plans.filter(p => p.id !== action.payload);
      saveToStorage(state.plans);
    },
    openPlan: (
      state,
      action: PayloadAction<{ id: string; actualEntryPrice: number; actualShares: number }>
    ) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan || plan.status !== 'idea') return;
      plan.status = 'open';
      plan.actualEntryPrice = action.payload.actualEntryPrice;
      plan.actualShares = action.payload.actualShares;
      plan.initialStopPrice = plan.stopPrice;
      plan.openedAt = new Date().toISOString();
      saveToStorage(state.plans);
    },
    closePlan: (
      state,
      action: PayloadAction<{ id: string; actualExitPrice: number; exitReason: ExitReason }>
    ) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan || plan.status !== 'open') return;
      plan.status = 'closed';
      plan.actualExitPrice = action.payload.actualExitPrice;
      plan.exitReason = action.payload.exitReason;
      plan.closedAt = new Date().toISOString();
      saveToStorage(state.plans);
    },
    setGrade: (state, action: PayloadAction<{ id: string; grade: ProcessGrade }>) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan) return;
      plan.grade = action.payload.grade;
      saveToStorage(state.plans);
    },
    /** Raises or lowers the live stop on an open plan. initialStopPrice is untouched. */
    updateStop: (state, action: PayloadAction<{ id: string; stopPrice: number }>) => {
      const plan = state.plans.find(p => p.id === action.payload.id);
      if (!plan || plan.status !== 'open') return;
      plan.stopPrice = action.payload.stopPrice;
      saveToStorage(state.plans);
    },
  },
});

export const { savePlan, deletePlan, openPlan, closePlan, setGrade, updateStop } =
  tradePlanSlice.actions;
export default tradePlanSlice.reducer;
```

- [ ] **Step 3: Write the settings slice**

Create `src/features/settings/settingsSlice.ts`:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TradeSettings } from '../../types';

const STORAGE_KEY = 'trade-settings';

const DEFAULTS: TradeSettings = {
  riskPerTradePercent: 1,
  maxPositionPercent: 20,
};

function loadFromStorage(): TradeSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Failed to load trade settings from storage:', e);
  }
  return DEFAULTS;
}

function saveToStorage(state: TradeSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save trade settings to storage:', e);
  }
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadFromStorage(),
  reducers: {
    setRiskPerTradePercent: (state, action: PayloadAction<number>) => {
      state.riskPerTradePercent = action.payload;
      saveToStorage(state);
    },
    setMaxPositionPercent: (state, action: PayloadAction<number>) => {
      state.maxPositionPercent = action.payload;
      saveToStorage(state);
    },
  },
});

export const { setRiskPerTradePercent, setMaxPositionPercent } = settingsSlice.actions;
export default settingsSlice.reducer;
```

- [ ] **Step 4: Register both reducers**

In `src/store/index.ts`, add the imports alongside the existing ones:

```ts
import tradePlanReducer from '../features/tradeplan/tradePlanSlice';
import settingsReducer from '../features/settings/settingsSlice';
```

and add to the `reducer` object, after `alerts: alertsReducer,`:

```ts
    tradePlan: tradePlanReducer,
    settings: settingsReducer,
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 6: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/types/index.ts src/features/tradeplan src/features/settings src/store/index.ts
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add trade plan and settings slices`

---

### Task 3: Scorecard math

**Files:**
- Modify: `src/lib/planMath.ts`
- Modify: `src/lib/planMath.test.ts`

**Interfaces:**
- Consumes: `realizedR` from Task 1; `TradePlan`, `SetupType` from Task 2; `Stock` from `src/types`.
- Produces: `computeScorecard(plans: TradePlan[], holdings: Stock[]): Scorecard`, `bySetup(plans: TradePlan[]): SetupStats[]`, `unplannedSymbols(plans: TradePlan[], holdings: Stock[]): string[]`, and the exported types `Scorecard` and `SetupStats`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/planMath.test.ts`, extend the existing import from `./planMath` at the top of the file to also pull in `computeScorecard`, `bySetup`, and `unplannedSymbols`, and add a type import beside it:

```ts
import type { TradePlan, Stock } from '../types';
```

Then append the test blocks below to the end of the file:

```ts

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
      closedPlan({ actualExitPrice: 60, exitReason: 'target-hit' }),  // +2R
      closedPlan({ actualExitPrice: 45, exitReason: 'stop-hit' }),    // -1R
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `computeScorecard is not a function`.

- [ ] **Step 3: Write the implementation**

Add this import to the **top** of `src/lib/planMath.ts` (the file currently has none):

```ts
import type { TradePlan, SetupType, Stock } from '../types';
```

Then append the rest to the end of the file:

```ts
export interface Scorecard {
  coveragePercent: number | null;
  adherencePercent: number | null;
  expectancyR: number | null;
  winRate: number | null;
  avgWinR: number | null;
  /** Mean magnitude of losing R, reported positive. */
  avgLossR: number | null;
  avgGrade: number | null;
  cutWinnersEarly: number;
  heldLosers: number;
  closedCount: number;
}

export interface SetupStats {
  setup: SetupType;
  count: number;
  winRate: number | null;
  expectancyR: number | null;
}

const ADHERENT_REASONS = ['stop-hit', 'target-hit', 'thesis-broken'];

/** R for a closed plan, or null when it is missing the fields R needs. */
function planR(plan: TradePlan): number | null {
  if (
    plan.status !== 'closed' ||
    plan.actualEntryPrice == null ||
    plan.initialStopPrice == null ||
    plan.actualExitPrice == null
  ) {
    return null;
  }
  return realizedR(plan.actualEntryPrice, plan.initialStopPrice, plan.actualExitPrice);
}

function expectancyFrom(rs: number[]): Pick<Scorecard, 'winRate' | 'avgWinR' | 'avgLossR' | 'expectancyR'> {
  if (rs.length === 0) {
    return { winRate: null, avgWinR: null, avgLossR: null, expectancyR: null };
  }
  const wins = rs.filter(r => r > 0);
  const losses = rs.filter(r => r <= 0);
  const winRate = wins.length / rs.length;
  const avgWinR = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossR = losses.length
    ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length)
    : 0;
  return {
    winRate,
    avgWinR: wins.length ? avgWinR : null,
    avgLossR: losses.length ? avgLossR : null,
    expectancyR: winRate * avgWinR - (1 - winRate) * avgLossR,
  };
}

export function unplannedSymbols(plans: TradePlan[], holdings: Stock[]): string[] {
  const planned = new Set(plans.filter(p => p.status === 'open').map(p => p.symbol));
  return holdings.filter(h => !planned.has(h.symbol)).map(h => h.symbol);
}

export function computeScorecard(plans: TradePlan[], holdings: Stock[]): Scorecard {
  const closed = plans.filter(p => p.status === 'closed');
  const rs = closed.map(planR).filter((r): r is number => r !== null);

  const adherent = closed.filter(p => p.exitReason && ADHERENT_REASONS.includes(p.exitReason));
  const graded = closed.filter(p => p.grade != null);

  const cutWinnersEarly = closed.filter(
    p =>
      p.exitReason === 'discretionary' &&
      p.actualEntryPrice != null &&
      p.actualExitPrice != null &&
      p.actualExitPrice > p.actualEntryPrice &&
      p.actualExitPrice < p.target1
  ).length;

  // Compared against the live stop: blowing through a raised stop is still a broken exit.
  const heldLosers = closed.filter(
    p => p.actualExitPrice != null && p.actualExitPrice < p.stopPrice
  ).length;

  const unplanned = unplannedSymbols(plans, holdings).length;

  return {
    coveragePercent:
      holdings.length === 0 ? null : ((holdings.length - unplanned) / holdings.length) * 100,
    adherencePercent: closed.length === 0 ? null : (adherent.length / closed.length) * 100,
    avgGrade: graded.length
      ? graded.reduce((sum, p) => sum + (p.grade?.score ?? 0), 0) / graded.length
      : null,
    cutWinnersEarly,
    heldLosers,
    closedCount: closed.length,
    ...expectancyFrom(rs),
  };
}

export function bySetup(plans: TradePlan[]): SetupStats[] {
  const closed = plans.filter(p => p.status === 'closed');
  const setups = [...new Set(closed.map(p => p.setup))];
  return setups.map(setup => {
    const rs = closed
      .filter(p => p.setup === setup)
      .map(planR)
      .filter((r): r is number => r !== null);
    const { winRate, expectancyR } = expectancyFrom(rs);
    return { setup, count: closed.filter(p => p.setup === setup).length, winRate, expectancyR };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests including the 9 from Task 1.

- [ ] **Step 5: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/lib/planMath.ts src/lib/planMath.test.ts
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add scorecard math for expectancy, adherence and bad exits`

---

### Task 4: Indicator math and the indicators endpoint

**Files:**
- Create: `server/indicators.js`
- Test: `server/indicators.test.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: HTTP `GET /api/indicators/:symbol` returning `{ atr14, sma20, sma50, sma200, rsi14, fiftyTwoWeekPosition }`, each `number | null`. Module exports `sma(closes, period)`, `rsi14(closes)`, `atr14(bars)`, `fiftyTwoWeekPosition(closes)`.

The math lives in its own module rather than inline in `server.js` so it can be imported by the test without starting an Express server.

- [ ] **Step 1: Write the failing tests**

Create `server/indicators.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./indicators.js`.

- [ ] **Step 3: Write the indicator module**

Create `server/indicators.js`:

```js
// Pure indicator math. No Express, no network — imported by server.js and by tests.

/** Simple moving average of the last `period` closes. Null if history is too short. */
export function sma(closes, period) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const window = closes.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

/**
 * Average True Range over 14 periods, Wilder-smoothed.
 * Needs 15 bars: the first is only used as the previous close.
 */
export function atr14(bars) {
  if (!Array.isArray(bars) || bars.length < 15) return null;

  const trueRanges = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    );
  }

  // Seed with a simple average of the first 14, then apply Wilder smoothing.
  let atr = trueRanges.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (let i = 14; i < trueRanges.length; i++) {
    atr = (atr * 13 + trueRanges[i]) / 14;
  }
  return atr;
}

/** Relative Strength Index over 14 periods, Wilder-smoothed. Needs 15 closes. */
export function rsi14(closes) {
  if (!Array.isArray(closes) || closes.length < 15) return null;

  const changes = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  let avgGain = 0;
  let avgLoss = 0;
  for (const change of changes.slice(0, 14)) {
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= 14;
  avgLoss /= 14;

  for (const change of changes.slice(14)) {
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }

  if (avgLoss === 0) return avgGain === 0 ? null : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Where the latest close sits in its range: 0 at the low, 1 at the high. */
export function fiftyTwoWeekPosition(closes) {
  if (!Array.isArray(closes) || closes.length === 0) return null;
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  if (high === low) return null;
  return (closes[closes.length - 1] - low) / (high - low);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add the endpoint**

In `server.js`, add the import near the other imports at the top:

```js
import { sma, rsi14, atr14, fiftyTwoWeekPosition } from './server/indicators.js';
```

Add a cache next to the existing `profileCache` declaration:

```js
const indicatorCache = new Map();
const INDICATOR_TTL = 24 * 60 * 60 * 1000;
```

Add the route after the existing `/api/history-batch` handler:

```js
// Technical indicators for one symbol, derived from one year of daily bars.
app.get('/api/indicators/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!validateSymbol(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol.' });
  }

  const cached = indicatorCache.get(symbol);
  if (cached && Date.now() - cached.at < INDICATOR_TTL) {
    return res.json(cached.indicators);
  }

  try {
    const period1 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2: new Date(),
      interval: '1d',
    });

    const bars = result.quotes.filter(
      (q) => q.close != null && q.high != null && q.low != null
    );
    const closes = bars.map((b) => b.close);

    const indicators = {
      atr14: atr14(bars),
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      sma200: sma(closes, 200),
      rsi14: rsi14(closes),
      fiftyTwoWeekPosition: fiftyTwoWeekPosition(closes),
    };

    indicatorCache.set(symbol, { indicators, at: Date.now() });
    res.json(indicators);
  } catch (error) {
    console.error(`Indicators error for ${symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to compute indicators.' });
  }
});
```

- [ ] **Step 6: Verify the endpoint by hand**

Run: `npm run server` in one terminal, then in another:

```bash
curl -s localhost:3001/api/indicators/AAPL | head -c 400
```

Expected: JSON with six numeric fields, `atr14` a small positive number and `rsi14` between 0 and 100.

- [ ] **Step 7: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add server/indicators.js server/indicators.test.js server.js
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add ATR, RSI and SMA indicators endpoint`

---

### Task 5: Split src/lib/claude.ts into a directory

**Files:**
- Create: `src/lib/claude/client.ts`, `src/lib/claude/schemas.ts`, `src/lib/claude/insights.ts`, `src/lib/claude/chat.ts`, `src/lib/claude/planning.ts`, `src/lib/claude/coaching.ts`, `src/lib/claude/index.ts`
- Delete: `src/lib/claude.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/lib/claude/index.ts` re-exports every function the old module exported, so `import { getStockInsight } from '../lib/claude'` keeps resolving unchanged. `client.ts` exports `anthropic` (the configured SDK client), `MODEL` (a string constant), and `sanitize(value: string, maxLen?: number): string`.

This is a pure mechanical move with **no behavior change**. Do it before adding new calls so they have somewhere to live.

- [ ] **Step 1: Create the shared client module**

Create `src/lib/claude/client.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';

/** Every call in this directory uses this model. */
export const MODEL = 'claude-opus-5';

/** Strip control characters and limit length to prevent prompt injection. */
export function sanitize(value: string, maxLen = 100): string {
  return value.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen);
}

export const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

/** Concatenates the text blocks of a response and parses them as JSON. */
export function parseJsonResponse<T>(response: Anthropic.Message): T {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  return JSON.parse(text) as T;
}
```

- [ ] **Step 2: Move the existing functions into their new homes**

Read `src/lib/claude.ts` and move each function verbatim into the file below, changing only the imports. Move every `*_SCHEMA` constant into `src/lib/claude/schemas.ts` and export each one.

| Function | Destination |
|---|---|
| `getStockInsight`, `getPortfolioInsight`, `getDailyBrief`, `parseInsightResponse` | `insights.ts` |
| `chatWithPortfolio` | `chat.ts` |
| `getRebalancePlan`, `getTradeCheck` | `planning.ts` |
| `getJournalCoach`, `getThesisCheck` | `coaching.ts` |

Each destination file imports what it needs from `./client` and `./schemas`. Do not change any prompt text, model string, or return shape in this task — model changes happen in Task 6.

- [ ] **Step 3: Create the barrel file**

Create `src/lib/claude/index.ts`:

```ts
export * from './client';
export * from './insights';
export * from './chat';
export * from './planning';
export * from './coaching';
```

- [ ] **Step 4: Delete the old file**

```bash
git rm src/lib/claude.ts
```

- [ ] **Step 5: Verify nothing broke**

Run: `npm run build`
Expected: succeeds. No import site should need editing — `../lib/claude` now resolves to the directory's `index.ts`.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add -A src/lib
git status
```

Report what changed and offer this commit message for their approval:

> `refactor: split claude.ts into a directory by call type`

---

### Task 6: Migrate all Claude calls to claude-opus-5

**Files:**
- Modify: `src/lib/claude/client.ts` (already has `MODEL`)
- Modify: `src/lib/claude/insights.ts`
- Modify: `src/lib/claude/schemas.ts`
- Modify: `src/lib/claude/chat.ts`, `src/lib/claude/planning.ts`, `src/lib/claude/coaching.ts`

**Interfaces:**
- Consumes: `MODEL`, `anthropic`, `parseJsonResponse` from Task 5.
- Produces: no signature changes. `getStockInsight`, `getPortfolioInsight`, and `getDailyBrief` return the same `AIInsight` / `DailyBriefResponse` shapes, now built from schema-enforced JSON rather than parsed prose.

`getStockInsight`, `getPortfolioInsight`, and `getDailyBrief` currently use `claude-sonnet-4-20250514`, whose retirement date has passed, and reconstruct their result by regex-scanning prose in `parseInsightResponse`. Both problems get fixed here.

- [ ] **Step 1: Replace every hardcoded model string**

In `chat.ts`, `planning.ts`, and `coaching.ts`, replace each `model: 'claude-opus-4-8',` with `model: MODEL,` and add `MODEL` to the existing import from `./client`. Leave `thinking: { type: 'adaptive' }` in place — it is valid on `claude-opus-5` and equivalent to the default.

- [ ] **Step 2: Add schemas for the three insight calls**

Append to `src/lib/claude/schemas.ts`:

```ts
export const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    content: { type: 'string', description: 'The analysis, under 300 words.' },
    sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
    confidence: { type: 'number', description: 'Confidence from 0 to 1.' },
    keyPoints: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 specific, actionable points.',
    },
  },
  required: ['content', 'sentiment', 'confidence', 'keyPoints'],
  additionalProperties: false,
} as const;

export const DAILY_BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    overallSummary: { type: 'string', description: 'Two or three sentences on the portfolio today.' },
    stocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          brief: { type: 'string', description: 'One or two sentences on this holding today.' },
          sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
        },
        required: ['symbol', 'brief', 'sentiment'],
        additionalProperties: false,
      },
    },
  },
  required: ['overallSummary', 'stocks'],
  additionalProperties: false,
} as const;
```

- [ ] **Step 3: Rewrite getStockInsight**

In `src/lib/claude/insights.ts`, replace the body of `getStockInsight` after the prompt construction. Keep the existing prompt text but drop the trailing formatting instructions, since the schema now enforces shape:

```ts
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: { type: 'json_schema', schema: INSIGHT_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<{
    content: string;
    sentiment: InsightSentiment;
    confidence: number;
    keyPoints: string[];
  }>(response);

  return {
    type: 'stock',
    symbol: request.symbol,
    content: parsed.content,
    sentiment: parsed.sentiment,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    keyPoints: parsed.keyPoints.slice(0, 5),
    timestamp: new Date().toISOString(),
  };
```

`max_tokens` is 2048 rather than the old 500 because thinking shares the budget with the response.

- [ ] **Step 4: Rewrite getPortfolioInsight the same way**

Identical treatment, with `type: 'portfolio'` and no `symbol` field in the returned `AIInsight`.

- [ ] **Step 5: Rewrite getDailyBrief**

Use `DAILY_BRIEF_SCHEMA`, `max_tokens: 4096`, and return `{ ...parsed, timestamp: new Date().toISOString() }`.

- [ ] **Step 6: Delete parseInsightResponse**

It has no remaining callers. Remove the function from `insights.ts` and drop the now-unused `InsightSentiment` regex logic.

- [ ] **Step 7: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed with no unused-import warnings.

Then run `npm run dev:all`, open the dashboard, and confirm the AI Insights card and Daily Brief both render content rather than an error.

- [ ] **Step 8: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/lib/claude
git status
```

Report what changed and offer this commit message for their approval:

> `feat: migrate all Claude calls to claude-opus-5 with structured outputs`

---

### Task 7: Indicators RTK Query service

**Files:**
- Create: `src/services/indicatorsApi.ts`
- Modify: `src/types/index.ts` (append)
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: the endpoint from Task 4.
- Produces: type `Indicators`, hooks `useGetIndicatorsQuery(symbol: string)` and `useLazyGetIndicatorsQuery()`.

- [ ] **Step 1: Add the type**

Append to `src/types/index.ts`:

```ts
export interface Indicators {
  atr14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  fiftyTwoWeekPosition: number | null;
}
```

- [ ] **Step 2: Write the service**

Create `src/services/indicatorsApi.ts`, following the existing `src/services/stockApi.ts` pattern:

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Indicators } from '../types';

export const indicatorsApi = createApi({
  reducerPath: 'indicatorsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getIndicators: builder.query<Indicators, string>({
      query: (symbol) => `/indicators/${encodeURIComponent(symbol)}`,
    }),
  }),
});

export const { useGetIndicatorsQuery, useLazyGetIndicatorsQuery } = indicatorsApi;
```

- [ ] **Step 3: Register it in the store**

In `src/store/index.ts`, import `indicatorsApi`, add `[indicatorsApi.reducerPath]: indicatorsApi.reducer,` to the reducer map, and chain `.concat(indicatorsApi.middleware)` onto the middleware.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/services/indicatorsApi.ts src/types/index.ts src/store/index.ts
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add indicators RTK Query service`

---

### Task 8: Sizing calculator component

**Files:**
- Create: `src/components/plans/SizingCalculator.tsx`

**Interfaces:**
- Consumes: `computeSizing`, `plannedR`, `SizingResult` from Tasks 1 and 3; `useGetIndicatorsQuery` from Task 7; `formatCurrency` from `src/lib/utils`.
- Produces: a component with props `{ symbol: string; entryHigh: number; stopPrice: number; target1: number; shares: number; onSuggestShares: (n: number) => void; onSuggestStop: (price: number) => void; }`. It renders live figures and two suggestion buttons; it owns no form state.

- [ ] **Step 1: Write the component**

Create `src/components/plans/SizingCalculator.tsx`:

```tsx
import { useSelector } from 'react-redux';
import { computeSizing, plannedR } from '../../lib/planMath';
import { formatCurrency } from '../../lib/utils';
import { useGetIndicatorsQuery } from '../../services/indicatorsApi';
import { Button } from '../ui/button';
import type { RootState } from '../../store';

interface Props {
  symbol: string;
  entryHigh: number;
  stopPrice: number;
  target1: number;
  shares: number;
  onSuggestShares: (n: number) => void;
  onSuggestStop: (price: number) => void;
}

export function SizingCalculator({
  symbol, entryHigh, stopPrice, target1, shares, onSuggestShares, onSuggestStop,
}: Props) {
  const holdings = useSelector((s: RootState) => s.portfolio.holdings);
  const cash = useSelector((s: RootState) => s.cash.balance);
  const settings = useSelector((s: RootState) => s.settings);

  const { data: indicators } = useGetIndicatorsQuery(symbol, { skip: !symbol });

  const equity =
    holdings.reduce((sum, h) => sum + h.quantity * (h.currentPrice ?? h.purchasePrice), 0) + cash;

  const sizing = computeSizing({
    equity,
    riskPerTradePercent: settings.riskPerTradePercent,
    maxPositionPercent: settings.maxPositionPercent,
    entryHigh,
    stopPrice,
  });

  const rr = plannedR(entryHigh, stopPrice, target1);
  const positionValue = shares * entryHigh;
  const positionPercent = equity > 0 ? (positionValue / equity) * 100 : 0;
  const riskDollars = shares * sizing.riskPerShare;

  const overCap = positionPercent > settings.maxPositionPercent;
  const poorRR = rr !== null && rr < 1.5;
  const atrStop = indicators?.atr14 != null ? entryHigh - 2 * indicators.atr14 : null;

  if (!sizing.valid) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
        Stop must be below the entry price. A stop at or above entry has no defined risk,
        so position size cannot be calculated.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Risk / share" value={formatCurrency(sizing.riskPerShare)} />
        <Figure label="Risk budget" value={formatCurrency(sizing.riskBudget)} />
        <Figure label="Risk on this trade" value={formatCurrency(riskDollars)} danger={riskDollars > sizing.riskBudget} />
        <Figure label="Position size" value={`${positionPercent.toFixed(1)}%`} danger={overCap} />
        <Figure label="Planned R:R" value={rr === null ? '—' : `${rr.toFixed(2)}`} danger={poorRR} />
        <Figure label="Suggested shares" value={String(sizing.finalShares)} />
      </div>

      {overCap && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Exceeds your {settings.maxPositionPercent}% max position size.
        </p>
      )}
      {poorRR && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Reward-to-risk below 1.5. The target is close relative to the risk taken.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={() => onSuggestShares(sizing.finalShares)}>
          Use {sizing.finalShares} shares
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atrStop === null}
          title={atrStop === null ? 'ATR unavailable for this symbol' : undefined}
          onClick={() => atrStop !== null && onSuggestStop(Number(atrStop.toFixed(2)))}
        >
          {atrStop === null ? 'ATR stop unavailable' : `Stop at 2×ATR (${formatCurrency(atrStop)})`}
        </Button>
      </div>
    </div>
  );
}

function Figure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={danger ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold'}>
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: succeeds. (The component has no consumer yet — Task 9 adds one.)

- [ ] **Step 3: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/components/plans/SizingCalculator.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add position sizing calculator component`

---

### Task 9: Plan form modal and plans page

**Files:**
- Create: `src/components/plans/PlanFormModal.tsx`
- Create: `src/components/plans/PlanCard.tsx`
- Create: `src/pages/PlansPage.tsx`
- Modify: `src/features/ui/uiSlice.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `savePlan`, `deletePlan` from Task 2; `SizingCalculator` from Task 8.
- Produces: route `/plans`; UI actions `openPlanModal(planId?: string)` and `closePlanModal()`; `PlanCard` with props `{ plan: TradePlan; onEdit: (p: TradePlan) => void }`.

- [ ] **Step 1: Add modal state to uiSlice**

In `src/features/ui/uiSlice.ts`, follow the existing modal pattern (mirror how `addHoldingModal` is handled). Add `planModalOpen: boolean` and `editingPlanId: string | null` to the state, plus reducers `openPlanModal` (payload `string | undefined`, sets `editingPlanId` and opens) and `closePlanModal` (clears both).

- [ ] **Step 2: Write PlanFormModal**

Create `src/components/plans/PlanFormModal.tsx`. It uses the existing `Dialog`, `Input`, `Label`, and `Button` primitives from `src/components/ui/`, mirroring `src/components/portfolio/AddHoldingModal.tsx`.

Fields, in order: symbol (with the existing `StockSearch` component for lookup), setup (select over `SetupType`), entryLow, entryHigh, stopPrice, target1, target2 (optional), shares, conviction (1–5 select), thesis (textarea), invalidation (textarea).

Below the price fields, render:

```tsx
<SizingCalculator
  symbol={form.symbol}
  entryHigh={Number(form.entryHigh) || 0}
  stopPrice={Number(form.stopPrice) || 0}
  target1={Number(form.target1) || 0}
  shares={Number(form.plannedShares) || 0}
  onSuggestShares={(n) => setForm(f => ({ ...f, plannedShares: String(n) }))}
  onSuggestStop={(p) => setForm(f => ({ ...f, stopPrice: String(p) }))}
/>
```

Submit handler:

```tsx
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const entryHigh = Number(form.entryHigh);
  const stopPrice = Number(form.stopPrice);

  // The only hard validation in the feature: without positive risk per share,
  // sizing divides by zero or goes negative.
  if (!(stopPrice < entryHigh)) {
    setError('Stop price must be below the entry price.');
    return;
  }

  const equity = holdingsValue + cash;
  dispatch(savePlan({
    id: editingPlan?.id ?? nanoid(),
    symbol: form.symbol.toUpperCase(),
    name: form.name,
    status: editingPlan?.status ?? 'idea',
    setup: form.setup,
    thesis: form.thesis,
    invalidation: form.invalidation,
    entryLow: Number(form.entryLow),
    entryHigh,
    stopPrice,
    target1: Number(form.target1),
    target2: form.target2 ? Number(form.target2) : undefined,
    plannedShares: Number(form.plannedShares),
    riskPercent: equity > 0 ? ((Number(form.plannedShares) * (entryHigh - stopPrice)) / equity) * 100 : 0,
    conviction: Number(form.conviction) as 1 | 2 | 3 | 4 | 5,
    createdAt: editingPlan?.createdAt ?? new Date().toISOString(),
    ...(editingPlan ? {
      actualEntryPrice: editingPlan.actualEntryPrice,
      actualShares: editingPlan.actualShares,
      initialStopPrice: editingPlan.initialStopPrice,
      openedAt: editingPlan.openedAt,
    } : {}),
  }));
  dispatch(closePlanModal());
}
```

Editing an open plan must preserve `initialStopPrice`, `actualEntryPrice`, `actualShares`, and `openedAt` — the spread above does that. Losing `initialStopPrice` would break every R calculation for that plan.

- [ ] **Step 3: Write PlanCard**

Create `src/components/plans/PlanCard.tsx`. Renders symbol, name, setup badge, status badge, entry zone, stop, target, planned R:R (from `plannedR`), conviction, and the thesis truncated to two lines. Buttons: Edit, Delete, and — for `idea` status — "Mark opened" (wired in Task 10).

- [ ] **Step 4: Write PlansPage**

Create `src/pages/PlansPage.tsx`. Uses the existing `Tabs` primitive with three tabs: Ideas, Open, Closed, each filtering `state.tradePlan.plans` by status. Header has a "New plan" button dispatching `openPlanModal()`. Empty states explain what the tab is for.

- [ ] **Step 5: Wire up the route, nav link, and modal**

In `src/App.tsx`: import `PlansPage` and `PlanFormModal`, add `<Route path="/plans" element={<PlansPage />} />`, and add `<PlanFormModal />` beside the other modals.

In `src/components/layout/Sidebar.tsx`: add a "Plans" nav link to `/plans`, following the existing link pattern and using a `lucide-react` icon such as `Target`.

- [ ] **Step 6: Verify by hand**

Run: `npm run dev:all`, open `http://localhost:5173/plans`, create a plan. Confirm:
- The sizing calculator updates live as entry and stop change.
- Setting a stop above entry blocks submit with the error message.
- The plan appears under Ideas and survives a page reload.

- [ ] **Step 7: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/components/plans src/pages/PlansPage.tsx src/features/ui/uiSlice.ts src/App.tsx src/components/layout/Sidebar.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add plan form modal and plans page`

---

### Task 10: Open a plan

**Files:**
- Create: `src/components/plans/OpenPlanModal.tsx`
- Modify: `src/components/plans/PlanCard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `openPlan` from Task 2; `addHolding` from `portfolioSlice`; `addTrade` from `journalSlice`.
- Produces: a modal that performs the idea → open transition as one dispatch sequence.

- [ ] **Step 1: Write the modal**

Create `src/components/plans/OpenPlanModal.tsx`. Props: `{ plan: TradePlan | null; onClose: () => void }`. Two inputs: actual fill price (defaulting to `plan.entryHigh`) and actual shares (defaulting to `plan.plannedShares`).

Submit handler — the three dispatches must stay together, since this is the transaction that keeps plan, holding, and journal consistent:

```tsx
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!plan) return;
  const price = Number(form.price);
  const shares = Number(form.shares);
  if (!(price > 0) || !(shares > 0)) {
    setError('Fill price and share count must both be greater than zero.');
    return;
  }

  dispatch(openPlan({ id: plan.id, actualEntryPrice: price, actualShares: shares }));
  dispatch(addHolding({
    symbol: plan.symbol,
    name: plan.name,
    quantity: shares,
    purchasePrice: price,
    purchaseDate: new Date().toISOString(),
    thesis: plan.thesis,
  }));
  dispatch(addTrade({
    type: 'buy',
    symbol: plan.symbol,
    name: plan.name,
    quantity: shares,
    price,
    entryPrice: price,
    date: new Date().toISOString(),
    notes: `Plan: ${plan.setup} — ${plan.thesis}`,
  }));
  onClose();
}
```

`addHolding` already averages into an existing position, so opening a second plan on a held symbol behaves correctly without extra handling.

- [ ] **Step 2: Wire the button**

In `PlanCard.tsx`, the "Mark opened" button (shown only for `status === 'idea'`) sets local state in `PlansPage` that selects the plan for `OpenPlanModal`. Render `<OpenPlanModal plan={openingPlan} onClose={() => setOpeningPlan(null)} />` from `PlansPage`.

- [ ] **Step 3: Verify by hand**

Run `npm run dev:all`. From an idea plan, click "Mark opened" and submit. Confirm:
- The plan moves to the Open tab.
- The holding appears on the dashboard with the entered quantity and price.
- A buy entry appears on the Journal page.
- Reloading preserves all three.

- [ ] **Step 4: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/components/plans src/pages/PlansPage.tsx src/App.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: open a plan, writing the holding and journal entry`

---

### Task 11: Close a plan

**Files:**
- Create: `src/components/plans/ClosePlanModal.tsx`
- Modify: `src/components/plans/PlanCard.tsx`, `src/pages/PlansPage.tsx`

**Interfaces:**
- Consumes: `closePlan` from Task 2; `updateHolding`, `removeHolding` from `portfolioSlice`; `addTrade` from `journalSlice`; `realizedR` from Task 1.
- Produces: a modal performing the open → closed transition. Task 14 hooks the process grader onto its submit.

- [ ] **Step 1: Write the modal**

Create `src/components/plans/ClosePlanModal.tsx`. Props: `{ plan: TradePlan | null; onClose: () => void }`. Inputs: exit price, and an `exitReason` select with these four options and helper text, because the labels are what make the adherence metric meaningful:

- `stop-hit` — "Stop was hit"
- `target-hit` — "Target was reached"
- `thesis-broken` — "Thesis was invalidated"
- `discretionary` — "I changed my mind" *(counts against adherence)*

Show the resulting R live as the exit price is typed, using `realizedR(plan.actualEntryPrice, plan.initialStopPrice, exitPrice)`.

Submit handler:

```tsx
const exitPrice = Number(form.exitPrice);
const shares = plan.actualShares ?? 0;
const entry = plan.actualEntryPrice ?? 0;

dispatch(closePlan({ id: plan.id, actualExitPrice: exitPrice, exitReason: form.exitReason }));

const holding = holdings.find(h => h.symbol === plan.symbol);
if (holding) {
  const remaining = holding.quantity - shares;
  if (remaining > 0) {
    dispatch(updateHolding({
      symbol: plan.symbol,
      quantity: remaining,
      purchasePrice: holding.purchasePrice,
    }));
  } else {
    dispatch(removeHolding(plan.symbol));
  }
}

dispatch(addTrade({
  type: 'sell',
  symbol: plan.symbol,
  name: plan.name,
  quantity: shares,
  price: exitPrice,
  entryPrice: entry,
  date: new Date().toISOString(),
  notes: `Closed: ${form.exitReason}`,
  gainLoss: (exitPrice - entry) * shares,
  gainLossPercent: entry > 0 ? ((exitPrice - entry) / entry) * 100 : 0,
}));

onClose();
```

- [ ] **Step 2: Wire the button**

Add a "Close plan" button to `PlanCard` for `status === 'open'`, driving a `closingPlan` state in `PlansPage` the same way Task 10 did.

- [ ] **Step 3: Verify by hand**

Close an open plan at a profit. Confirm: the plan moves to Closed, the holding is removed, a sell entry with the correct gain appears on the Journal page, and the Journal P&L summary updates.

- [ ] **Step 4: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/components/plans src/pages/PlansPage.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: close a plan, writing the sell entry and updating the holding`

---

### Task 12: Devil's advocate

**Files:**
- Modify: `src/lib/claude/schemas.ts`, `src/lib/claude/planning.ts`
- Modify: `src/types/index.ts`
- Create: `src/lib/planChecks.ts`
- Test: `src/lib/planChecks.test.ts`
- Modify: `src/services/insightsApi.ts`
- Modify: `src/components/plans/PlanFormModal.tsx`

**Interfaces:**
- Consumes: `computeSizing`, `plannedR` from Tasks 1 and 3; `MODEL`, `anthropic`, `sanitize`, `parseJsonResponse` from Task 5.
- Produces: `runPlanChecks(input: PlanCheckInput): string[]`; `getDevilsAdvocate(request: DevilsAdvocateRequest): Promise<DevilsAdvocateResult>`; hook `useLazyGetDevilsAdvocateQuery()`; types `DevilsAdvocateRequest`, `DevilsAdvocateResult`, `PlanCheckInput`.

The arithmetic runs in code and is passed to the model as findings. The model reasons; it does not compute the risk budget.

- [ ] **Step 1: Write the failing check tests**

Create `src/lib/planChecks.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — cannot resolve `./planChecks`.

- [ ] **Step 3: Write the checks**

Create `src/lib/planChecks.ts`:

```ts
import { computeSizing, plannedR } from './planMath';

export interface PlanCheckInput {
  equity: number;
  riskPerTradePercent: number;
  maxPositionPercent: number;
  entryHigh: number;
  stopPrice: number;
  target1: number;
  shares: number;
  atr14: number | null;
  /** Percent of portfolio already in this symbol's sector, including this plan. */
  sameSectorPercent: number | null;
}

/**
 * Deterministic pre-trade findings. These are facts, computed exactly, and
 * handed to the model as input — the model never does this arithmetic itself.
 */
export function runPlanChecks(input: PlanCheckInput): string[] {
  const flags: string[] = [];
  const sizing = computeSizing(input);
  if (!sizing.valid) return ['Stop is at or above the entry price, so the trade has no defined risk.'];

  const positionValue = input.shares * input.entryHigh;
  const positionPercent = input.equity > 0 ? (positionValue / input.equity) * 100 : 0;
  const riskDollars = input.shares * sizing.riskPerShare;

  if (positionPercent > input.maxPositionPercent) {
    flags.push(
      `Position is ${positionPercent.toFixed(1)}% of equity, which exceeds the ${input.maxPositionPercent}% cap.`
    );
  }
  if (riskDollars > sizing.riskBudget) {
    flags.push(
      `Risk of $${riskDollars.toFixed(0)} is above the $${sizing.riskBudget.toFixed(0)} per-trade risk budget.`
    );
  }

  const rr = plannedR(input.entryHigh, input.stopPrice, input.target1);
  if (rr !== null && rr < 1.5) {
    flags.push(`Reward-to-risk is ${rr.toFixed(2)}, below the 1.5 threshold.`);
  }

  if (input.atr14 != null && sizing.riskPerShare < input.atr14) {
    flags.push(
      `Stop is ${sizing.riskPerShare.toFixed(2)} away, tighter than one ATR (${input.atr14.toFixed(2)}); normal daily noise could trigger it.`
    );
  }

  if (input.sameSectorPercent != null && input.sameSectorPercent > 40) {
    flags.push(
      `This trade would put ${input.sameSectorPercent.toFixed(0)}% of the portfolio in one sector.`
    );
  }

  return flags;
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add the types**

Append to `src/types/index.ts`:

```ts
export interface DevilsAdvocateRequest {
  plan: {
    symbol: string;
    name: string;
    setup: string;
    thesis: string;
    invalidation: string;
    entryHigh: number;
    stopPrice: number;
    target1: number;
    shares: number;
    conviction: number;
  };
  checkFlags: string[];
  holdings: { symbol: string; quantity: number; purchasePrice: number; currentPrice?: number }[];
  cashBalance: number;
  openPlans: { symbol: string; setup: string; thesis: string }[];
  /** Most recent graded closes, newest first. Feeds repeatedMistakes. */
  pastLessons: { symbol: string; date: string; setup: string; score: number; lesson: string }[];
  indicators: Indicators | null;
  headlines: { title: string; publisher: string }[];
}

export interface DevilsAdvocateResult {
  verdict: TradeCheckVerdict;
  bearCase: string[];
  planCritique: string[];
  repeatedMistakes: string[];
  timestamp: string;
}
```

`TradeCheckVerdict` already exists and is `'proceed' | 'caution' | 'reconsider'`.

- [ ] **Step 6: Add the schema**

Append to `src/lib/claude/schemas.ts`:

```ts
export const DEVILS_ADVOCATE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['proceed', 'caution', 'reconsider'] },
    bearCase: {
      type: 'array',
      items: { type: 'string' },
      description: '2-4 concrete reasons this trade could fail. Specific to this company and setup, not generic market risk.',
    },
    planCritique: {
      type: 'array',
      items: { type: 'string' },
      description: 'Problems with the plan itself: arbitrary stop, vague invalidation, size inconsistent with conviction. Empty if the plan is sound.',
    },
    repeatedMistakes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ways this trade repeats a mistake from the past lessons provided. Cite the symbol and date. Empty if none apply.',
    },
  },
  required: ['verdict', 'bearCase', 'planCritique', 'repeatedMistakes'],
  additionalProperties: false,
} as const;
```

- [ ] **Step 7: Write the call**

Append to `src/lib/claude/planning.ts`:

```ts
export async function getDevilsAdvocate(
  request: DevilsAdvocateRequest
): Promise<DevilsAdvocateResult> {
  const { plan } = request;

  const lessonsSummary = request.pastLessons.length > 0
    ? request.pastLessons
        .map(l => `- ${l.date.slice(0, 10)} ${sanitize(l.symbol, 15)} (${sanitize(l.setup, 20)}, process score ${l.score}): ${sanitize(l.lesson, 300)}`)
        .join('\n')
    : 'No graded trades yet.';

  const holdingsSummary = request.holdings.length > 0
    ? request.holdings
        .map(h => `- ${sanitize(h.symbol, 15)}: ${h.quantity} shares @ $${h.purchasePrice.toFixed(2)}`)
        .join('\n')
    : 'No holdings.';

  const flagsSummary = request.checkFlags.length > 0
    ? request.checkFlags.map(f => `- ${f}`).join('\n')
    : 'None — the plan is within all configured risk limits.';

  const indicatorsSummary = request.indicators
    ? `ATR(14): ${request.indicators.atr14?.toFixed(2) ?? 'n/a'}, RSI(14): ${request.indicators.rsi14?.toFixed(1) ?? 'n/a'}, SMA50: ${request.indicators.sma50?.toFixed(2) ?? 'n/a'}, SMA200: ${request.indicators.sma200?.toFixed(2) ?? 'n/a'}`
    : 'Unavailable.';

  const headlinesSummary = request.headlines.length > 0
    ? request.headlines.map(h => `- ${sanitize(h.title, 200)} (${sanitize(h.publisher, 50)})`).join('\n')
    : 'No recent headlines.';

  const prompt = `An investor has written this trade plan and wants it attacked before they commit money. Your job is to argue the other side, not to encourage them.

PROPOSED PLAN
Symbol: ${sanitize(plan.name)} (${sanitize(plan.symbol, 15)})
Setup: ${sanitize(plan.setup, 20)}
Entry: $${plan.entryHigh.toFixed(2)} | Stop: $${plan.stopPrice.toFixed(2)} | Target: $${plan.target1.toFixed(2)}
Size: ${plan.shares} shares | Conviction: ${plan.conviction}/5
Thesis: "${sanitize(plan.thesis, 600)}"
What would invalidate it: "${sanitize(plan.invalidation, 400)}"

AUTOMATED RISK CHECKS (already computed — do not recalculate, but do interpret):
${flagsSummary}

CURRENT PORTFOLIO:
${holdingsSummary}
Cash: $${request.cashBalance.toFixed(2)}

TECHNICALS: ${indicatorsSummary}

RECENT HEADLINES:
${headlinesSummary}

THIS INVESTOR'S PAST GRADED TRADES AND LESSONS:
${lessonsSummary}

Build the strongest bear case against this trade. Critique the plan's construction — is the stop arbitrary, is the invalidation actually falsifiable, does the size match the stated conviction. Then check the past lessons above: if this trade repeats a mistake they have already made and been graded on, say so and cite the symbol and date. Be direct. If the plan is genuinely sound, say proceed and keep the critique short.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: {
      format: { type: 'json_schema', schema: DEVILS_ADVOCATE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<DevilsAdvocateResult, 'timestamp'>>(response);
  return { ...parsed, timestamp: new Date().toISOString() };
}
```

- [ ] **Step 8: Expose it through insightsApi**

In `src/services/insightsApi.ts`, add a `getDevilsAdvocate` endpoint following the exact shape of the existing `getRebalancePlan` endpoint, add `'DevilsAdvocate'` to `tagTypes`, and export `useLazyGetDevilsAdvocateQuery`.

- [ ] **Step 9: Render the verdict in PlanFormModal**

On successful save, assemble the request (using `runPlanChecks`, the indicators query, and the last 10 closed plans that have a `grade`), fire the lazy query, and render the result inline below the form: a coloured verdict badge, then the three lists.

The plan is already saved at this point. Wrap the call so a failure cannot undo that:

```tsx
try {
  await triggerDevilsAdvocate(request).unwrap();
} catch {
  setAiError('AI review unavailable. Your plan was saved.');
}
```

Sector concentration for `sameSectorPercent` comes from the existing `/api/profile-batch` data already used by `RiskPanel`; pass `null` when it is unavailable.

- [ ] **Step 10: Verify by hand**

Create a deliberately bad plan — 60% of equity in one position with a 1.1 reward-to-risk. Confirm the automated flags appear in the response reasoning and the verdict is `caution` or `reconsider`. Then confirm that with the dev server's network disabled, saving still works and shows the fallback message.

- [ ] **Step 11: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/lib/planChecks.ts src/lib/planChecks.test.ts src/lib/claude src/types/index.ts src/services/insightsApi.ts src/components/plans/PlanFormModal.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add pre-trade devil's advocate review`

---

### Task 13: Exit advisor and open positions panel

**Files:**
- Modify: `src/lib/claude/schemas.ts`, `src/lib/claude/coaching.ts`, `src/types/index.ts`, `src/services/insightsApi.ts`
- Create: `src/components/plans/OpenPositionsPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `realizedR` from Task 1; `updateStop` from Task 2; `useGetIndicatorsQuery` from Task 7.
- Produces: `getExitAdvice(request: ExitAdviceRequest): Promise<ExitAdviceResult>`; hook `useLazyGetExitAdviceQuery()`; types `ExitAdviceRequest`, `ExitAdviceResult`, `ExitAction`; component `OpenPositionsPanel`.

- [ ] **Step 1: Add the types**

Append to `src/types/index.ts`:

```ts
export type ExitAction = 'hold' | 'trim' | 'exit' | 'raise-stop';

export interface ExitAdviceRequest {
  plan: {
    symbol: string;
    name: string;
    setup: string;
    thesis: string;
    invalidation: string;
    entryPrice: number;
    initialStopPrice: number;
    currentStopPrice: number;
    target1: number;
    shares: number;
    openedAt: string;
  };
  currentPrice: number;
  currentR: number | null;
  daysHeld: number;
  indicators: Indicators | null;
  headlines: { title: string; publisher: string }[];
}

export interface ExitAdviceResult {
  action: ExitAction;
  reasoning: string;
  suggestedStop?: number;
  timestamp: string;
}
```

- [ ] **Step 2: Add the schema**

Append to `src/lib/claude/schemas.ts`:

```ts
export const EXIT_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['hold', 'trim', 'exit', 'raise-stop'] },
    reasoning: { type: 'string', description: 'Two to four sentences. Reference the plan as written.' },
    suggestedStop: { type: 'number', description: 'New stop price. Only meaningful when action is raise-stop.' },
  },
  required: ['action', 'reasoning'],
  additionalProperties: false,
} as const;
```

- [ ] **Step 3: Write the call**

Append to `src/lib/claude/coaching.ts`:

```ts
export async function getExitAdvice(request: ExitAdviceRequest): Promise<ExitAdviceResult> {
  const { plan } = request;
  const riskPerShare = plan.entryPrice - plan.initialStopPrice;
  const distanceToStop = request.currentPrice - plan.currentStopPrice;
  const distanceToTarget = plan.target1 - request.currentPrice;

  const headlinesSummary = request.headlines.length > 0
    ? request.headlines.map(h => `- ${sanitize(h.title, 200)} (${sanitize(h.publisher, 50)})`).join('\n')
    : 'No recent headlines.';

  const indicatorsSummary = request.indicators
    ? `ATR(14): ${request.indicators.atr14?.toFixed(2) ?? 'n/a'}, RSI(14): ${request.indicators.rsi14?.toFixed(1) ?? 'n/a'}, SMA50: ${request.indicators.sma50?.toFixed(2) ?? 'n/a'}`
    : 'Unavailable.';

  const prompt = `An investor holds this position and wants help deciding whether to stay in it. They struggle with exits specifically: they hold losers too long and cut winners too early. Judge against the plan they wrote, not against what looks good now.

THE PLAN AS WRITTEN
Symbol: ${sanitize(plan.name)} (${sanitize(plan.symbol, 15)})
Setup: ${sanitize(plan.setup, 20)}
Thesis: "${sanitize(plan.thesis, 600)}"
What would invalidate it: "${sanitize(plan.invalidation, 400)}"
Entry: $${plan.entryPrice.toFixed(2)} | Original stop: $${plan.initialStopPrice.toFixed(2)} | Target: $${plan.target1.toFixed(2)}

WHERE IT STANDS NOW
Current price: $${request.currentPrice.toFixed(2)}
Current stop: $${plan.currentStopPrice.toFixed(2)}
Open result: ${request.currentR === null ? 'unknown' : `${request.currentR.toFixed(2)}R`}
Distance to stop: $${distanceToStop.toFixed(2)} (${riskPerShare > 0 ? (distanceToStop / riskPerShare).toFixed(2) : 'n/a'}R)
Distance to target: $${distanceToTarget.toFixed(2)}
Held for ${request.daysHeld} days.

TECHNICALS: ${indicatorsSummary}

RECENT HEADLINES:
${headlinesSummary}

Recommend one action: hold, trim, exit, or raise-stop.

Two things you must call out explicitly if they are true:
1. The price is already below their stop and they are still holding. That is a broken exit, and they need to hear it plainly.
2. The thesis is intact and the target has not been reached, meaning an exit now would be cutting a winner early.

If the thesis is invalidated by the invalidation condition they wrote, say exit regardless of the price. If you recommend raise-stop, give the specific price.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3072,
    output_config: {
      format: { type: 'json_schema', schema: EXIT_ADVICE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<ExitAdviceResult, 'timestamp'>>(response);
  return { ...parsed, timestamp: new Date().toISOString() };
}
```

- [ ] **Step 4: Expose it through insightsApi**

Add a `getExitAdvice` endpoint following the existing pattern, tagged per symbol, and export `useLazyGetExitAdviceQuery`.

- [ ] **Step 5: Write OpenPositionsPanel**

Create `src/components/plans/OpenPositionsPanel.tsx`. For each plan with `status === 'open'`, render a row containing:

- Symbol, name, shares
- Current R from `realizedR(plan.actualEntryPrice, plan.initialStopPrice, currentPrice)`, coloured green when positive and red when negative
- A progress bar positioned between `stopPrice` and `target1`, with the current price marked
- A red "Below your stop" badge when `currentPrice < plan.stopPrice`
- An "Ask AI" button firing the lazy exit-advice query, rendering `action` and `reasoning` inline
- When the result is `raise-stop` with a `suggestedStop`, an "Apply" button dispatching `updateStop({ id, stopPrice: suggestedStop })`

Current prices come from `state.portfolio.holdings`, which the existing quote polling keeps fresh. Wrap the query call in try/catch and show a non-blocking message on failure.

Render nothing when there are no open plans.

- [ ] **Step 6: Add it to the dashboard**

In the `Dashboard` function in `src/App.tsx`, insert `<OpenPositionsPanel />` immediately after `<PortfolioSummary />`.

- [ ] **Step 7: Verify by hand**

With an open plan, confirm the R and the progress bar render, and that "Ask AI" returns an action with reasoning. Manually edit the plan's stop above the current price and confirm the "Below your stop" badge appears.

- [ ] **Step 8: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/lib/claude src/types/index.ts src/services/insightsApi.ts src/components/plans/OpenPositionsPanel.tsx src/App.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add exit advisor and open positions panel`

---

### Task 14: Process grader

**Files:**
- Modify: `src/lib/claude/schemas.ts`, `src/lib/claude/coaching.ts`, `src/types/index.ts`, `src/services/insightsApi.ts`
- Modify: `src/components/plans/ClosePlanModal.tsx`, `src/components/plans/PlanCard.tsx`

**Interfaces:**
- Consumes: `setGrade` from Task 2; `realizedR` from Task 1; `ProcessGrade` from Task 2.
- Produces: `getProcessGrade(request: ProcessGradeRequest): Promise<ProcessGrade>`; hook `useLazyGetProcessGradeQuery()`; type `ProcessGradeRequest`.

- [ ] **Step 1: Add the type**

Append to `src/types/index.ts`:

```ts
export interface ProcessGradeRequest {
  plan: {
    symbol: string;
    name: string;
    setup: string;
    thesis: string;
    invalidation: string;
    entryHigh: number;
    initialStopPrice: number;
    target1: number;
    plannedShares: number;
    conviction: number;
  };
  execution: {
    actualEntryPrice: number;
    actualShares: number;
    actualExitPrice: number;
    exitReason: ExitReason;
    daysHeld: number;
    realizedR: number | null;
  };
}
```

- [ ] **Step 2: Add the schema**

Append to `src/lib/claude/schemas.ts`:

```ts
export const PROCESS_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', description: 'Process quality from 0 to 100. Ignores whether the trade made money.' },
    followedPlan: { type: 'array', items: { type: 'string' }, description: 'Specific things the investor did as planned.' },
    brokePlan: { type: 'array', items: { type: 'string' }, description: 'Specific deviations from the written plan. Empty if there were none.' },
    lesson: { type: 'string', description: 'One sentence, phrased so it is useful before a similar future trade.' },
  },
  required: ['score', 'followedPlan', 'brokePlan', 'lesson'],
  additionalProperties: false,
} as const;
```

- [ ] **Step 3: Write the call**

Append to `src/lib/claude/coaching.ts`:

```ts
export async function getProcessGrade(request: ProcessGradeRequest): Promise<ProcessGrade> {
  const { plan, execution } = request;
  const sizeDelta = execution.actualShares - plan.plannedShares;

  const prompt = `Grade how well an investor executed their own trade plan. Grade the PROCESS ONLY. Whether the trade made money is irrelevant to the score, and you must not let it influence you.

Apply these rules literally:
- A trade that lost money but was entered on plan and stopped out exactly where planned is a HIGH score. That is a well-executed losing trade, which is a normal and necessary part of a working process.
- A trade that made money but was entered outside the planned zone, sized differently than planned, or exited on impulse is a LOW score. Profit from a broken process is luck, and rewarding it teaches the wrong lesson.

THE PLAN AS WRITTEN
Symbol: ${sanitize(plan.name)} (${sanitize(plan.symbol, 15)})
Setup: ${sanitize(plan.setup, 20)}
Thesis: "${sanitize(plan.thesis, 600)}"
Invalidation condition: "${sanitize(plan.invalidation, 400)}"
Planned entry: $${plan.entryHigh.toFixed(2)} | Planned stop: $${plan.initialStopPrice.toFixed(2)} | Planned target: $${plan.target1.toFixed(2)}
Planned size: ${plan.plannedShares} shares | Conviction: ${plan.conviction}/5

WHAT ACTUALLY HAPPENED
Entered at $${execution.actualEntryPrice.toFixed(2)} with ${execution.actualShares} shares (${sizeDelta === 0 ? 'exactly as planned' : `${Math.abs(sizeDelta)} shares ${sizeDelta > 0 ? 'more' : 'fewer'} than planned`}).
Exited at $${execution.actualExitPrice.toFixed(2)} after ${execution.daysHeld} days.
Stated exit reason: ${execution.exitReason}
Result: ${execution.realizedR === null ? 'unknown' : `${execution.realizedR.toFixed(2)}R`}

Score the process from 0 to 100. List what they followed and what they broke, citing the specific numbers. Then give one lesson, written so it is useful to them the next time they are about to take a similar trade.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3072,
    output_config: {
      format: { type: 'json_schema', schema: PROCESS_GRADE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<ProcessGrade, 'timestamp'>>(response);
  return {
    ...parsed,
    score: Math.max(0, Math.min(100, parsed.score)),
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Expose it through insightsApi**

Add a `getProcessGrade` endpoint and export `useLazyGetProcessGradeQuery`.

- [ ] **Step 5: Fire it on close**

In `ClosePlanModal`, after the three dispatches from Task 11, request the grade and store it. The close has already happened, so a failure here must not undo it:

```tsx
try {
  const grade = await triggerProcessGrade({
    plan: { /* fields from plan */ },
    execution: {
      actualEntryPrice: entry,
      actualShares: shares,
      actualExitPrice: exitPrice,
      exitReason: form.exitReason,
      daysHeld: Math.round((Date.now() - new Date(plan.openedAt!).getTime()) / 86_400_000),
      realizedR: realizedR(entry, plan.initialStopPrice!, exitPrice),
    },
  }).unwrap();
  dispatch(setGrade({ id: plan.id, grade }));
} catch {
  setAiError('Grading unavailable. The trade was closed and can be graded later.');
}
```

Keep the modal open while grading is in flight, showing a spinner, then display the returned score and lesson before the user dismisses it.

- [ ] **Step 6: Show the grade on closed plans**

In `PlanCard`, for `status === 'closed'`, render the realized R, the process score, and the lesson. Add a "Grade now" button for closed plans that have no `grade`, so a failed grading can be retried.

- [ ] **Step 7: Verify by hand**

Close a plan exactly at its stop with `exitReason: 'stop-hit'`. Confirm the score is high despite the loss — that inversion is the feature working. Then close another at a profit with `exitReason: 'discretionary'` well below target and confirm the score is lower.

- [ ] **Step 8: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/lib/claude src/types/index.ts src/services/insightsApi.ts src/components/plans
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add post-trade process grader`

---

### Task 15: Scorecard UI

**Files:**
- Create: `src/components/performance/DisciplineCard.tsx`, `src/components/performance/ScorecardPanel.tsx`, `src/components/performance/SetupBreakdown.tsx`, `src/components/performance/GradeTrend.tsx`
- Create: `src/pages/PerformancePage.tsx`
- Modify: `src/App.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/portfolio/HoldingsList.tsx`

**Interfaces:**
- Consumes: `computeScorecard`, `bySetup`, `unplannedSymbols` from Task 3.
- Produces: route `/performance`; components `DisciplineCard` (dashboard) and `ScorecardPanel`, `SetupBreakdown`, `GradeTrend` (page).

Note the component is `ScorecardPanel`, not `Scorecard`: `Scorecard` is already the name of the type exported from `planMath.ts`, and a component importing that type while also declaring a function of the same name is a duplicate-identifier error.

- [ ] **Step 1: Write DisciplineCard**

Create `src/components/performance/DisciplineCard.tsx`. Uses the existing `Card` primitive. Reads plans and holdings from the store, calls `computeScorecard`, and renders four figures in a row: plan coverage, adherence, expectancy in R, and average process grade. Below them, when `unplannedSymbols` is non-empty, a red line reading `N unplanned positions: AAA, BBB` linking to `/plans`.

Show an em dash for any null metric rather than `NaN` or `0`, so an empty history is not mistaken for bad performance.

- [ ] **Step 2: Write ScorecardPanel, SetupBreakdown, GradeTrend**

`ScorecardPanel` renders the full `computeScorecard` output including `cutWinnersEarly` and `heldLosers`, each with a one-line explanation of what the counter means.

`SetupBreakdown` renders `bySetup` as a table: setup, count, win rate, expectancy in R, sorted by expectancy descending.

`GradeTrend` renders a Recharts `LineChart` of `grade.score` against `closedAt` for graded closed plans in chronological order, following the chart setup already used in `src/components/portfolio/PortfolioHistoryChart.tsx`. Render a placeholder message when fewer than two graded plans exist.

- [ ] **Step 3: Write PerformancePage**

Create `src/pages/PerformancePage.tsx` stacking the three components with a heading.

- [ ] **Step 4: Add the badge to HoldingsList**

In `src/components/portfolio/HoldingsList.tsx`, read `state.tradePlan.plans`, build a set of symbols with an open plan, and render a small badge on each row: green "Planned" or amber "Unplanned". Amber, not red — an unplanned position is a nudge, not an error, and the design is a soft gate.

- [ ] **Step 5: Wire the route, nav link, and dashboard card**

Add the `/performance` route and a Sidebar link (a `lucide-react` icon such as `Gauge`). In the `Dashboard` function in `src/App.tsx`, insert `<DisciplineCard />` after `<CashCard />`.

- [ ] **Step 6: Verify by hand**

With at least two closed plans of differing outcomes, confirm the dashboard shows non-null coverage, adherence, and expectancy, that `/performance` matches, and that a holding with no open plan shows the amber badge.

- [ ] **Step 7: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/components/performance src/pages/PerformancePage.tsx src/App.tsx src/components/layout/Sidebar.tsx src/components/portfolio/HoldingsList.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `feat: add discipline scorecard and performance page`

---

### Task 16: Backup coverage and the orphaned-plan guard

**Files:**
- Modify: `src/pages/DataPage.tsx`
- Modify: `src/components/portfolio/HoldingsList.tsx`

**Interfaces:**
- Consumes: `deletePlan`, `closePlan` from Task 2.
- Produces: no new exports. Closes the two data-integrity gaps the design identified.

- [ ] **Step 1: Add the new keys to backup and restore**

Read `src/pages/DataPage.tsx` and find the list of `localStorage` keys the JSON backup writes and the restore reads. Add `trade-plans` and `trade-settings` to both.

This is not cosmetic. Without it, every backup silently omits the user's entire plan history and all process grades, and a restore wipes them.

- [ ] **Step 2: Verify the round trip**

With at least one plan saved, export the JSON backup from `/data` and confirm `trade-plans` is present with the plan in it. Clear `localStorage`, restore the file, and confirm the plans reappear on `/plans`.

- [ ] **Step 3: Guard holding deletion**

In `HoldingsList.tsx`, before dispatching `removeHolding`, check for an open plan on that symbol. If one exists, show a confirm dialog:

> "AAA has an open trade plan. Deleting the holding will close that plan as a discretionary exit at the current price. Continue?"

On confirm, dispatch `closePlan({ id, actualExitPrice: currentPrice, exitReason: 'discretionary' })` before `removeHolding`. On cancel, do nothing.

`discretionary` is the correct reason: deleting a holding out from under a plan is by definition an unplanned exit, and the adherence metric should record it as one.

- [ ] **Step 4: Verify**

Delete a holding that has an open plan. Confirm the dialog appears, the plan lands in Closed with reason `discretionary`, and the adherence percentage on the dashboard drops accordingly.

- [ ] **Step 5: Run the full check**

```bash
npm test && npm run build && npm run lint
```

Expected: all three succeed.

- [ ] **Step 6: Stage and stop for review**

Stage the work, then **stop. Do not commit.** The user reviews every change before it enters git history.

```bash
git add src/pages/DataPage.tsx src/components/portfolio/HoldingsList.tsx
git status
```

Report what changed and offer this commit message for their approval:

> `fix: include trade plans in backups and guard orphaned plans`

---

## Verification against the design's success criteria

After Task 16, walk these end to end:

1. Create a plan, open it, close it. Holding and journal stay consistent at every step.
2. The dashboard shows plan coverage, and unplanned positions are visible and counted.
3. Closing a plan produces a process grade, and that grade's `lesson` appears in a later devil's-advocate response for a comparable setup.
4. `/performance` shows expectancy in R and both bad-exit counters.
5. Every Claude call runs on `claude-opus-5` — `grep -rn "claude-sonnet-4-20250514\|claude-opus-4-8" src/` returns nothing.
6. `npm test` passes.

## Not in this plan

Phase 2 (SQLite, server-side quote watcher, Telegram notifications, moving the Anthropic key out of the browser) and Phase 3 (fundamentals, idea screener) each get their own spec and plan. **The API key remains readable in the browser bundle throughout this plan — do not host this app anywhere reachable until Phase 2 ships.**
