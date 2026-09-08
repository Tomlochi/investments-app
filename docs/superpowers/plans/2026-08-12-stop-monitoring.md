# Stop Monitoring and Portfolio Stop Risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watch every holding that has a stop, notify and persistently flag when price breaks below it, and show the portfolio's total stop risk in one number.

**Architecture:** All decision logic lives in one pure module, `src/lib/stopRisk.ts`, unit-tested without React. A `StopWatcher` component mounted globally in `App` subscribes to quotes for holdings with stops and dispatches a breach marker. A `StopBreachBanner` at the top of the Dashboard renders the resulting state and offers the two actions that clear it. `RiskPanel` gains a stop-risk section computed independently of its existing profile query.

**Tech Stack:** React 19, TypeScript, Redux Toolkit + RTK Query, Vitest, Tailwind, lucide-react icons.

## Global Constraints

- **Never run `git commit` or `git push`.** Every task ends by staging changes and stopping for the user's review.
- This plan builds on `Stock.stopPrice` and the `updateStopPrice` reducer from commit `84f5a73` (branch `feat/stop-loss-advisor`). Work on that branch or on a branch cut from it. Verify before starting: `grep -c stopPrice src/features/portfolio/portfolioSlice.ts` must return a non-zero count.
- Currency in the UI is formatted with `formatCurrency` from `src/lib/utils.ts`. Conditional class names use `cn` from the same file — do not import `cn` where every class string is static, eslint flags it as unused.
- Follow the relative-import convention of the file being edited (`../../lib/utils`), not the `@/` alias.
- A holding's market value uses `h.currentPrice ?? h.purchasePrice`, matching `RiskPanel`. **Stop-risk math is the exception:** it must never fall back to `purchasePrice`, because treating a stale cost basis as the live price produces a wrong risk figure. A holding with no `currentPrice` counts as unprotected.
- Verify with `npm test`, `npm run build`, and `npm run lint`. The repo has 4 pre-existing lint errors (`button.tsx`, `input.tsx`, `client.ts`, `EditHoldingModal.tsx`) — only new ones matter.

---

### Task 1: Pure stop-risk and breach-detection math

**Files:**
- Create: `src/lib/stopRisk.ts`
- Create: `src/lib/stopRisk.test.ts`

**Interfaces:**
- Consumes: the `Stock` type from `src/types/index.ts`, which already carries `stopPrice?: number`.
- Produces:
  - `computeStopRisk(holdings: Stock[], totalValue: number): StopRisk`
  - `findBreachedHoldings(holdings: Stock[], priceBySymbol: Record<string, number>): BreachedHolding[]`
  - Types `HoldingRisk`, `StopRisk`, `BreachedHolding`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stopRisk.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/stopRisk.test.ts`

Expected: FAIL — `Cannot find module './stopRisk'`. The last test also references `stopBreachedAt`, which Task 2 adds; TypeScript in test files is checked by `npm run build`, not by vitest at runtime, so this test still runs. If the editor flags it, ignore until Task 2.

- [ ] **Step 3: Write the implementation**

Create `src/lib/stopRisk.ts`:

```ts
// Pure stop-risk math and breach detection. No React, no network — unit-tested directly.
import type { Stock } from '../types';

export interface HoldingRisk {
  symbol: string;
  /** Dollars between the current price and the stop. Zero for a breached holding. */
  risk: number;
  percentOfPortfolio: number;
}

export interface StopRisk {
  riskAmount: number;
  riskPercent: number;
  protectedCount: number;
  unprotectedCount: number;
  breachedCount: number;
  /** Protected holdings only, largest risk first. Breached entries carry zero and sort last. */
  perHolding: HoldingRisk[];
}

export interface BreachedHolding {
  symbol: string;
  price: number;
  stopPrice: number;
}

/**
 * Total pending loss if every stop were hit at once.
 *
 * Holdings without both a stop and a live price are excluded from the dollar figure and
 * counted as unprotected — folding them in at full market value would produce a number
 * dominated by unprotected positions that never moves.
 */
export function computeStopRisk(holdings: Stock[], totalValue: number): StopRisk {
  const usableTotal = Number.isFinite(totalValue) && totalValue > 0 ? totalValue : 0;

  let riskAmount = 0;
  let protectedCount = 0;
  let unprotectedCount = 0;
  let breachedCount = 0;
  const perHolding: HoldingRisk[] = [];

  for (const h of holdings) {
    const price = h.currentPrice;
    const stop = h.stopPrice;

    if (stop == null || price == null) {
      unprotectedCount++;
      continue;
    }

    protectedCount++;

    // At or below the stop the loss is already live, not pending — it contributes nothing
    // to the "what could still go wrong" figure, but it must stay visible in the counts.
    const breached = price <= stop;
    if (breached) breachedCount++;

    const risk = breached ? 0 : (price - stop) * h.quantity;
    riskAmount += risk;
    perHolding.push({
      symbol: h.symbol,
      risk,
      percentOfPortfolio: usableTotal > 0 ? (risk / usableTotal) * 100 : 0,
    });
  }

  perHolding.sort((a, b) => b.risk - a.risk);

  return {
    riskAmount,
    riskPercent: usableTotal > 0 ? (riskAmount / usableTotal) * 100 : 0,
    protectedCount,
    unprotectedCount,
    breachedCount,
    perHolding,
  };
}

/**
 * Every holding whose known price sits at or below its stop.
 *
 * Stateless on purpose: it ignores `stopBreachedAt` entirely so it stays trivially testable.
 * Firing a notification only once per breach episode is the reducer's job, not this function's.
 */
export function findBreachedHoldings(
  holdings: Stock[],
  priceBySymbol: Record<string, number>
): BreachedHolding[] {
  const breached: BreachedHolding[] = [];

  for (const h of holdings) {
    const price = priceBySymbol[h.symbol];
    if (h.stopPrice == null || price == null) continue;
    if (price <= h.stopPrice) {
      breached.push({ symbol: h.symbol, price, stopPrice: h.stopPrice });
    }
  }

  return breached;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/stopRisk.test.ts`

Expected: PASS, 14 tests.

- [ ] **Step 5: Stage and stop for review**

```bash
git add src/lib/stopRisk.ts src/lib/stopRisk.test.ts
git status
```

Do NOT commit. Report: files staged, test count, ready for review.

---

### Task 2: Breach state on the holding

**Files:**
- Modify: `src/types/index.ts` (the `Stock` interface)
- Modify: `src/features/portfolio/portfolioSlice.ts` (add `markStopBreached`, extend `updateStopPrice`, extend the exported actions)

**Interfaces:**
- Consumes: the existing `updateStopPrice` reducer from commit `84f5a73`.
- Produces:
  - `Stock.stopBreachedAt?: string` — read by Tasks 3, 4.
  - Action creator `markStopBreached({ symbol: string; price: number })` — dispatched in Task 3.
  - `updateStopPrice` now also clears `stopBreachedAt` — relied on by Task 4.

- [ ] **Step 1: Add the field to the Stock type**

In `src/types/index.ts`, the `Stock` interface currently ends with the `stopPrice` field added by `84f5a73`. Add one more field after it:

```ts
  /** Protective stop for this holding. Only ever written by accepting an AI suggestion. */
  stopPrice?: number;
  /** ISO timestamp of the first price seen at or below stopPrice. Cleared when the stop changes. */
  stopBreachedAt?: string;
}
```

- [ ] **Step 2: Add the markStopBreached reducer**

In `src/features/portfolio/portfolioSlice.ts`, insert this reducer directly after the existing `updateStopPrice` reducer:

```ts
    markStopBreached: (state, action: PayloadAction<{ symbol: string; price: number }>) => {
      const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
      // The guard is what makes a breach notify once per episode instead of once per poll.
      if (holding && !holding.stopBreachedAt) {
        holding.stopBreachedAt = new Date().toISOString();
        saveToStorage(state.holdings);
      }
    },
```

The `price` field in the payload is not stored. It is part of the action so the notification in Task 3 and any future debugging have the triggering price in the Redux action log.

- [ ] **Step 3: Make updateStopPrice clear the breach**

In the same file, replace the existing `updateStopPrice` reducer body so it also resets `stopBreachedAt`:

```ts
    updateStopPrice: (state, action: PayloadAction<{ symbol: string; stopPrice: number | null }>) => {
      const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
      if (holding) {
        holding.stopPrice = action.payload.stopPrice ?? undefined;
        // Setting or clearing a stop is the user acknowledging the breach.
        holding.stopBreachedAt = undefined;
        saveToStorage(state.holdings);
      }
    },
```

- [ ] **Step 4: Export the new action**

Replace the export line so it includes `markStopBreached`:

```ts
export const { addHolding, updateHolding, removeHolding, updateCurrentPrice, updateStopPrice, markStopBreached, clearPortfolio } = portfolioSlice.actions;
```

- [ ] **Step 5: Verify it compiles and the existing tests still pass**

Run: `npm run build && npm test`

Expected: build PASS, all tests PASS (including the 14 from Task 1 — the `stopBreachedAt` reference in the last `findBreachedHoldings` test now type-checks).

- [ ] **Step 6: Stage and stop for review**

```bash
git add src/types/index.ts src/features/portfolio/portfolioSlice.ts
git status
```

Do NOT commit. Report: files staged, build and tests clean, ready for review.

---

### Task 3: The global stop watcher

**Files:**
- Create: `src/components/portfolio/StopWatcher.tsx`
- Modify: `src/App.tsx` (imports, and the mount list beside `<AlertWatcher />` at line 83)

**Interfaces:**
- Consumes: `findBreachedHoldings` (Task 1), `markStopBreached` (Task 2), the existing `useGetQuoteQuery` from `src/services/stockApi.ts`.
- Produces: `<StopWatcher />`, mounted once in `App`.

- [ ] **Step 1: Create the component**

Create `src/components/portfolio/StopWatcher.tsx`. This deliberately mirrors the structure of `src/components/alerts/AlertWatcher.tsx` — an inner per-symbol component holding the subscription, an outer component deciding which symbols to watch:

```tsx
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetQuoteQuery } from '../../services/stockApi';
import { markStopBreached } from '../../features/portfolio/portfolioSlice';
import { findBreachedHoldings } from '../../lib/stopRisk';
import { formatCurrency } from '../../lib/utils';
import type { RootState, AppDispatch } from '../../store';
import type { Stock } from '../../types';

function notifyBreach(holding: Stock, price: number) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(`${holding.symbol} broke your stop`, {
    body: `${formatCurrency(price)} — your stop is ${formatCurrency(holding.stopPrice ?? 0)}.`,
  });
}

function SymbolStopWatcher({ holding }: { holding: Stock }) {
  const dispatch = useDispatch<AppDispatch>();
  const { data: quote } = useGetQuoteQuery(holding.symbol, { pollingInterval: 60000 });

  useEffect(() => {
    const price = quote?.regularMarketPrice;
    if (price == null) return;

    // One-element call: the shared helper keeps the at-or-below rule in a single tested place.
    const breaches = findBreachedHoldings([holding], { [holding.symbol]: price });
    if (breaches.length === 0) return;

    // The reducer ignores a repeat breach, so this stays a no-op until the stop changes.
    if (!holding.stopBreachedAt) {
      notifyBreach(holding, price);
    }
    dispatch(markStopBreached({ symbol: holding.symbol, price }));
  }, [quote, holding, dispatch]);

  return null;
}

// Mounted once in App: polls quotes for every holding with a stop and flags breaches.
export function StopWatcher() {
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const watched = useMemo(() => holdings.filter(h => h.stopPrice != null), [holdings]);

  // Ask for notification permission once there is something to watch
  useEffect(() => {
    if (watched.length > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [watched.length]);

  return (
    <>
      {watched.map(h => (
        <SymbolStopWatcher key={h.symbol} holding={h} />
      ))}
    </>
  );
}
```

This does not loop, though the dependency array invites the question. Dispatching `markStopBreached` on an already-breached holding hits the reducer's `!holding.stopBreachedAt` guard, so Immer mutates nothing and returns the original state object. The `holdings` reference is unchanged, `holding` keeps its identity, and the effect does not re-fire. The first breach does change identity and re-runs the effect once, which is harmless: `stopBreachedAt` is now set, so no second notification.

- [ ] **Step 2: Mount it in App**

In `src/App.tsx`, add the import after the existing `AlertWatcher` import on line 13:

```tsx
import { StopWatcher } from './components/portfolio/StopWatcher';
```

Then add the component beside `<AlertWatcher />` near line 83:

```tsx
      <AlertWatcher />
      <StopWatcher />
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build && npm run lint`

Expected: build PASS. Lint reports the 4 pre-existing errors and nothing from `StopWatcher.tsx`.

- [ ] **Step 4: Stage and stop for review**

```bash
git add src/components/portfolio/StopWatcher.tsx src/App.tsx
git status
```

Do NOT commit. Report: files staged, build and lint clean, ready for review.

---

### Task 4: The breach banner

**Files:**
- Create: `src/components/portfolio/StopBreachBanner.tsx`
- Modify: `src/App.tsx` (imports, and the `Dashboard` function around line 36)

**Interfaces:**
- Consumes: `Stock.stopBreachedAt` and `updateStopPrice` (Task 2).
- Produces: `<StopBreachBanner />`, rendered at the top of the Dashboard.

- [ ] **Step 1: Create the component**

Create `src/components/portfolio/StopBreachBanner.tsx`:

```tsx
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/utils';
import { updateStopPrice } from '../../features/portfolio/portfolioSlice';
import type { RootState, AppDispatch } from '../../store';

/** Module scope keeps the clock read out of anything the compiler treats as render. */
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function breachedFor(iso: string): string {
  const days = daysSince(iso);
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function StopBreachBanner() {
  const dispatch = useDispatch<AppDispatch>();
  const holdings = useSelector((state: RootState) => state.portfolio.holdings);

  const breached = holdings.filter(h => h.stopBreachedAt != null && h.stopPrice != null);
  if (breached.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <h2 className="font-semibold text-red-800 dark:text-red-300">
          {breached.length === 1
            ? '1 position broke its stop'
            : `${breached.length} positions broke their stops`}
        </h2>
      </div>

      <ul className="mt-3 space-y-2">
        {breached.map(h => {
          const stop = h.stopPrice as number;
          const price = h.currentPrice;
          const below = price != null && stop > 0 ? ((stop - price) / stop) * 100 : null;

          return (
            <li
              key={h.symbol}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 p-2 dark:bg-gray-900/50"
            >
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <Link
                  to={`/stock/${h.symbol}`}
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  {h.symbol}
                </Link>
                <span className="text-gray-700 dark:text-gray-300">
                  {price != null ? formatCurrency(price) : 'price unavailable'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  stop {formatCurrency(stop)}
                  {below != null && ` · ${below.toFixed(1)}% below`}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  broke {breachedFor(h.stopBreachedAt as string)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link to={`/stock/${h.symbol}`}>
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => dispatch(updateStopPrice({ symbol: h.symbol, stopPrice: null }))}
                >
                  Clear stop
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-red-700 dark:text-red-400">
        This stays until you set a new stop or clear it. Price recovering above the stop does not dismiss it.
      </p>
    </div>
  );
}
```

"Review" links to the detail page, where the stop-loss advisor issues a replacement stop; accepting one dispatches `updateStopPrice`, which clears the breach. "Clear stop" is the escape hatch for a position the user has consciously decided to keep without a stop.

- [ ] **Step 2: Render it at the top of the Dashboard**

In `src/App.tsx`, add the import next to the other portfolio component imports:

```tsx
import { StopBreachBanner } from './components/portfolio/StopBreachBanner';
```

Then, in the `Dashboard` function, place it above `<PortfolioSummary />`. Replace:

```tsx
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <PortfolioSummary />
```

with:

```tsx
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <StopBreachBanner />
        <PortfolioSummary />
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build && npm run lint`

Expected: build PASS, no new lint errors.

- [ ] **Step 4: Stage and stop for review**

```bash
git add src/components/portfolio/StopBreachBanner.tsx src/App.tsx
git status
```

Do NOT commit. Report: files staged, build and lint clean, ready for review.

---

### Task 5: Stop risk in the Risk panel

**Files:**
- Modify: `src/components/portfolio/RiskPanel.tsx` (imports lines 1-7, a new `useMemo` after the existing `analysis` memo ending line 63, and a new section inside `CardContent`)

**Interfaces:**
- Consumes: `computeStopRisk` (Task 1).
- Produces: no new exports — this extends an existing component.

- [ ] **Step 1: Extend the imports**

In `src/components/portfolio/RiskPanel.tsx`, add to the existing imports:

```tsx
import { computeStopRisk } from '../../lib/stopRisk';
import { formatCurrency } from '../../lib/utils';
```

Note `formatCurrency` joins the existing `cn` import from `'../../lib/utils'` — merge them into one import statement rather than adding a second line for the same module.

- [ ] **Step 2: Compute stop risk independently of the profile query**

The existing `analysis` memo returns `null` when `profiles` has not loaded, and the render hides everything behind `isLoading || !analysis`. Stop risk does not depend on `profiles` at all, so it must be computed and rendered outside that gate — otherwise a failing `/api/profile-batch` call would hide the risk figure too.

Add this memo immediately after the existing `analysis` memo (which ends at line 63) and before the `if (holdings.length === 0) return null;` line:

```tsx
  const stopRisk = useMemo(() => {
    const totalValue = holdings.reduce(
      (sum, h) => sum + h.quantity * (h.currentPrice ?? h.purchasePrice),
      0
    );
    return computeStopRisk(holdings, totalValue);
  }, [holdings]);
```

- [ ] **Step 3: Render the stop-risk section**

Inside `CardContent`, add this block **before** the existing `{isLoading || !analysis ? (...) : (...)}` expression, so it renders whether or not the profile data arrived:

```tsx
        <div className="mb-6 border-b border-gray-100 pb-6 dark:border-gray-800">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            If every stop were hit
          </p>

          {stopRisk.protectedCount === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No holding has a stop set — none of this portfolio has a defined downside.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Risking{' '}
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(stopRisk.riskAmount)}
                </span>{' '}
                ({stopRisk.riskPercent.toFixed(1)}%) across {stopRisk.protectedCount}{' '}
                {stopRisk.protectedCount === 1 ? 'protected position' : 'protected positions'}
                {stopRisk.unprotectedCount > 0 && ` · ${stopRisk.unprotectedCount} unprotected`}
                {stopRisk.breachedCount > 0 && ` · ${stopRisk.breachedCount} breached`}
              </p>

              <ul className="mt-2 space-y-1">
                {stopRisk.perHolding.slice(0, 3).map(h => (
                  <li key={h.symbol} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{h.symbol}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatCurrency(h.risk)} ({h.percentOfPortfolio.toFixed(1)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
```

The zero-protected case says "no holding has a stop set" rather than showing "$0 at risk", which would read as safety when it means the opposite.

- [ ] **Step 4: Verify everything passes**

Run: `npm test && npm run build && npm run lint`

Expected: tests PASS (existing suite plus the 14 from Task 1), build PASS, no new lint errors.

- [ ] **Step 5: Verify it works in the running app**

Start both servers if they are not already up: `npm run dev:all`

Then, at `http://localhost:5173`:
1. On a holding with no stop, confirm `RiskPanel` shows "No holding has a stop set" (assuming no other holding has one).
2. Open a holding's detail page, use the stop-loss advisor, and accept a suggestion.
3. Back on the dashboard, confirm `RiskPanel` now shows a dollar figure, a percentage, the protected count, and the unprotected count for the rest.
4. To exercise the breach path without waiting for the market: open the detail page for a holding, accept a stop, then in DevTools edit `localStorage['portfolio-holdings']` to set that holding's `stopPrice` above its current price, and reload.
5. Within 60 seconds of the dashboard being open, confirm the red breach banner appears above the portfolio summary, showing the symbol, price, stop, percent below, and "broke today".
6. Confirm the browser notification fires once — not repeatedly every 60 seconds.
7. Navigate to `/journal` and back. Confirm the banner is still there and no second notification fired.
8. Click "Clear stop" and confirm the banner row disappears and `RiskPanel` moves that holding to the unprotected count.
9. Reload the page and confirm the cleared state persisted.

- [ ] **Step 6: Stage and stop for review**

```bash
git add src/components/portfolio/RiskPanel.tsx
git status
```

Do NOT commit. Report: file staged, every verification command and manual check that passed, and that the feature is ready for review.

---

## Verification summary

After all five tasks:

- `npm test` — existing suite plus 14 new tests in `src/lib/stopRisk.test.ts`, all passing.
- `npm run build` — clean.
- `npm run lint` — 4 pre-existing errors, none new.
- A holding whose price falls below its stop produces one notification and a persistent dashboard banner that survives navigation and reload, clearing only on a new stop or an explicit "Clear stop".
- `RiskPanel` shows total pending stop risk in dollars and percent, with protected, unprotected, and breached counts.
- Nothing is committed. Every task ends staged, awaiting review.
