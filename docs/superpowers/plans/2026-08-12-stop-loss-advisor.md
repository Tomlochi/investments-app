# Stop-Loss Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a stock detail page, let the user press one button to get an AI-suggested stop-loss price grounded in technical indicators, then store that price on the holding so it persists between visits.

**Architecture:** A new optional `stopPrice` field on the `Stock` type, written only by accepting an AI suggestion. A new `getStopAdvice()` Claude call in `src/lib/claude/coaching.ts` that consumes the existing `/api/indicators/:symbol` endpoint's output. A new RTK Query endpoint in `insightsApi` wrapping it, and a new `StopLossAdvisor` component on `StockDetailPage`. A small pure module holds the sanity checks so they can be unit-tested without mocking the network.

**Tech Stack:** React 19, TypeScript, Redux Toolkit + RTK Query, Vitest, Anthropic SDK (`claude-opus-5`, browser-side with `dangerouslyAllowBrowser`), Tailwind, lucide-react icons.

## Global Constraints

- **Never run `git commit` or `git push`.** Every task ends by staging changes and stopping for the user's review. This overrides any habit of committing at the end of a task.
- Model constant is `MODEL` from `src/lib/claude/client.ts` (currently `claude-opus-5`). Never hardcode a model string.
- All Claude calls use `output_config: { format: { type: 'json_schema', schema: ... } }` and `parseJsonResponse<T>(response)` from `client.ts`. Do not parse prose.
- All user-supplied strings interpolated into a prompt go through `sanitize(value, maxLen)` from `client.ts`.
- The path alias `@/` maps to `src/`, but existing files use relative imports (`../../lib/claude`). Follow the relative-import convention of the file you are editing.
- Currency in the UI is formatted with `formatCurrency` from `src/lib/utils.ts`. Conditional class names use `cn` from the same file — do not import `cn` in a file where every class string is static, eslint will flag it as unused.
- No new backend endpoint. Reuse `GET /api/indicators/:symbol`, already served by `server.js` and typed as `Indicators`.
- There is no manual stop-price input anywhere. The only way `stopPrice` gets set is by accepting an AI suggestion.
- Verify with `npm test` (vitest), `npm run build` (tsc + vite), and `npm run lint` (eslint).

---

### Task 1: Pure stop-price sanity checks

A suggested stop can come back nonsensical — at or above the current price (it would trigger instantly on a long position), or absurdly far away. Those checks are pure arithmetic, so they live in their own module with real unit tests. The UI in Task 5 renders whatever this returns.

**Files:**
- Create: `src/lib/stopAdvice.ts`
- Create: `src/lib/stopAdvice.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `stopDistancePercent(stopPrice: number, currentPrice: number): number | null` — how far below the current price the stop sits, as a positive percentage. Returns `null` when `currentPrice <= 0`.
  - `stopWarning(stopPrice: number, currentPrice: number): string | null` — a human-readable warning, or `null` when the stop looks reasonable.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stopAdvice.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/stopAdvice.test.ts`

Expected: FAIL — `Failed to resolve import "./stopAdvice"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/stopAdvice.ts`:

```ts
// Pure sanity checks for an AI-suggested stop price. No React, no network — unit-tested directly.

/** How far below the current price the stop sits, as a percentage. Negative when the stop is above the price. */
export function stopDistancePercent(stopPrice: number, currentPrice: number): number | null {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  return ((currentPrice - stopPrice) / currentPrice) * 100;
}

/** A warning to show alongside a suggested stop, or null when it looks reasonable. */
export function stopWarning(stopPrice: number, currentPrice: number): string | null {
  if (!Number.isFinite(stopPrice) || stopPrice <= 0) {
    return 'The suggested price is not a usable stop.';
  }

  const distance = stopDistancePercent(stopPrice, currentPrice);
  if (distance === null) return null;

  if (distance <= 0) {
    return 'This stop is at or above the current price — it would trigger immediately.';
  }
  if (distance > 50) {
    return 'This stop is unusually wide (more than 50% below the current price).';
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/stopAdvice.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Stage and stop for review**

```bash
git add src/lib/stopAdvice.ts src/lib/stopAdvice.test.ts
git status
```

Do NOT commit. Report to the user: files staged, test count, and that the task is ready for review.

---

### Task 2: Persist a stop price on the holding

**Files:**
- Modify: `src/types/index.ts` (the `Stock` interface, lines 1-9)
- Modify: `src/features/portfolio/portfolioSlice.ts` (add a reducer, extend the exported actions on line 80)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `Stock.stopPrice?: number` — read by Tasks 4 and 5.
  - Action creator `updateStopPrice({ symbol: string; stopPrice: number | null })` exported from `src/features/portfolio/portfolioSlice.ts` — dispatched in Task 5.

- [ ] **Step 1: Add the field to the Stock type**

In `src/types/index.ts`, replace the `Stock` interface with:

```ts
export interface Stock {
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  currentPrice?: number;
  purchaseDate?: string;
  thesis?: string;
  /** Protective stop for this holding. Only ever written by accepting an AI suggestion. */
  stopPrice?: number;
}
```

- [ ] **Step 2: Add the reducer**

In `src/features/portfolio/portfolioSlice.ts`, insert this reducer directly after the existing `updateCurrentPrice` reducer (which ends on the line before `clearPortfolio`):

```ts
    updateStopPrice: (state, action: PayloadAction<{ symbol: string; stopPrice: number | null }>) => {
      const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
      if (holding) {
        holding.stopPrice = action.payload.stopPrice ?? undefined;
        saveToStorage(state.holdings);
      }
    },
```

Note the `saveToStorage` call — unlike `updateCurrentPrice` (which holds a transient quote), the stop must survive a reload.

- [ ] **Step 3: Export the new action**

In the same file, replace the export line:

```ts
export const { addHolding, updateHolding, removeHolding, updateCurrentPrice, clearPortfolio } = portfolioSlice.actions;
```

with:

```ts
export const { addHolding, updateHolding, removeHolding, updateCurrentPrice, updateStopPrice, clearPortfolio } = portfolioSlice.actions;
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`

Expected: PASS, no TypeScript errors. `stopPrice` is optional, so no existing call site that constructs a `Stock` needs to change.

- [ ] **Step 5: Stage and stop for review**

```bash
git add src/types/index.ts src/features/portfolio/portfolioSlice.ts
git status
```

Do NOT commit. Report to the user: files staged, build clean, ready for review.

---

### Task 3: The Claude call

**Files:**
- Modify: `src/types/index.ts` (append two interfaces at the end of the file)
- Modify: `src/lib/claude/schemas.ts` (append one schema at the end of the file)
- Modify: `src/lib/claude/coaching.ts` (imports on lines 3-13, and a new function after `getExitAdvice`)

**Interfaces:**
- Consumes: the existing `Indicators` interface from `src/types/index.ts` (already defined — `atr14`, `sma20`, `sma50`, `sma200`, `rsi14`, `fiftyTwoWeekPosition`, each `number | null`).
- Produces:
  - `StopAdviceRequest` and `StopAdviceResult` types — used by Tasks 4 and 5.
  - `getStopAdvice(request: StopAdviceRequest): Promise<StopAdviceResult>` — re-exported automatically through `src/lib/claude/index.ts`, which does `export * from './coaching'`. No change to `index.ts` is needed.

- [ ] **Step 1: Add the types**

Append to the end of `src/types/index.ts`:

```ts
export interface StopAdviceRequest {
  symbol: string;
  name: string;
  currentPrice: number;
  purchasePrice: number;
  /** The stop currently stored on the holding, or null if none has been set. */
  currentStop: number | null;
  indicators: Indicators | null;
}

export interface StopAdviceResult {
  suggestedStop: number;
  reasoning: string;
  timestamp: string;
}
```

- [ ] **Step 2: Add the response schema**

Append to the end of `src/lib/claude/schemas.ts`:

```ts
export const STOP_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    suggestedStop: {
      type: 'number',
      description: 'The recommended stop-loss price, as an absolute dollar figure.',
    },
    reasoning: {
      type: 'string',
      description: 'Two to four sentences naming the specific technical basis for this level: a support level, a moving average, an ATR multiple, or a recent swing low.',
    },
  },
  required: ['suggestedStop', 'reasoning'],
  additionalProperties: false,
} as const;
```

- [ ] **Step 3: Extend the imports in coaching.ts**

In `src/lib/claude/coaching.ts`, replace lines 3-13 with:

```ts
import { JOURNAL_COACH_SCHEMA, THESIS_CHECK_SCHEMA, EXIT_ADVICE_SCHEMA, PROCESS_GRADE_SCHEMA, STOP_ADVICE_SCHEMA } from './schemas';
import type {
  JournalCoachRequest,
  JournalCoachResult,
  ThesisCheckRequest,
  ThesisCheckResult,
  ExitAdviceRequest,
  ExitAdviceResult,
  ProcessGradeRequest,
  ProcessGrade,
  StopAdviceRequest,
  StopAdviceResult,
} from '../../types';
```

- [ ] **Step 4: Add the function**

In `src/lib/claude/coaching.ts`, insert this function immediately after `getExitAdvice` ends and before `getProcessGrade` begins:

```ts
export async function getStopAdvice(request: StopAdviceRequest): Promise<StopAdviceResult> {
  const i = request.indicators;
  const indicatorsSummary = i
    ? [
        `ATR(14): ${i.atr14?.toFixed(2) ?? 'n/a'}`,
        `RSI(14): ${i.rsi14?.toFixed(1) ?? 'n/a'}`,
        `SMA20: ${i.sma20?.toFixed(2) ?? 'n/a'}`,
        `SMA50: ${i.sma50?.toFixed(2) ?? 'n/a'}`,
        `SMA200: ${i.sma200?.toFixed(2) ?? 'n/a'}`,
        `52-week position: ${i.fiftyTwoWeekPosition != null ? `${(i.fiftyTwoWeekPosition * 100).toFixed(0)}% of the range (0% = 52-week low, 100% = 52-week high)` : 'n/a'}`,
      ].join('\n')
    : 'Unavailable — no indicator data could be loaded for this symbol.';

  const openPnlPercent = request.purchasePrice > 0
    ? ((request.currentPrice - request.purchasePrice) / request.purchasePrice) * 100
    : null;

  const prompt = `An investor holds a long position and wants a second opinion on where to place the protective stop-loss order in their broker app. They will read your answer and then set the order by hand, so the number has to be one they can actually type in.

THE POSITION
Symbol: ${sanitize(request.name)} (${sanitize(request.symbol, 15)})
Current price: $${request.currentPrice.toFixed(2)}
Average cost: $${request.purchasePrice.toFixed(2)}${openPnlPercent !== null ? ` (open position is ${openPnlPercent >= 0 ? 'up' : 'down'} ${Math.abs(openPnlPercent).toFixed(1)}%)` : ''}
Stop currently set: ${request.currentStop !== null ? `$${request.currentStop.toFixed(2)}` : 'none'}

TECHNICALS
${indicatorsSummary}

Recommend one stop price. Ground it in the technicals above — name a support level, a moving average, an ATR multiple below the price, or a recent swing low. Do not give a round percentage with no technical justification behind it.

The stop must sit below the current price of $${request.currentPrice.toFixed(2)}; a stop at or above it would trigger the moment it is placed.

${request.currentStop !== null
  ? `They already have a stop at $${request.currentStop.toFixed(2)}. State plainly whether your recommendation raises it, leaves it where it is, or loosens it — and if you are loosening a stop, justify why that is not just giving a loser more room.`
  : 'They have no stop set yet, so this is the first one.'}

If the technicals are unavailable, say so in your reasoning and base the level on the price and cost basis alone rather than inventing indicator values.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: { type: 'json_schema', schema: STOP_ADVICE_SCHEMA },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseJsonResponse<Omit<StopAdviceResult, 'timestamp'>>(response);
  return { ...parsed, timestamp: new Date().toISOString() };
}
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npm run build && npm run lint`

Expected: build PASS. Lint reports no new errors (the repo may already have pre-existing warnings — only new ones matter).

- [ ] **Step 6: Stage and stop for review**

```bash
git add src/types/index.ts src/lib/claude/schemas.ts src/lib/claude/coaching.ts
git status
```

Do NOT commit. Report to the user: files staged, build and lint clean, ready for review.

---

### Task 4: RTK Query endpoint

**Files:**
- Modify: `src/services/insightsApi.ts` (imports lines 2-24, `tagTypes` line 29, a new endpoint after `getExitAdvice`, and the hook exports at lines 118-128)

**Interfaces:**
- Consumes: `getStopAdvice`, `StopAdviceRequest`, `StopAdviceResult` from Task 3.
- Produces: `useLazyGetStopAdviceQuery()` — used in Task 5. Returns the standard RTK Query lazy tuple; the component calls the trigger and `.unwrap()`s the promise.

- [ ] **Step 1: Extend the imports**

In `src/services/insightsApi.ts`, add `getStopAdvice,` to the import block from `'../lib/claude'` (after `getExitAdvice,`), and add `StopAdviceRequest,` and `StopAdviceResult,` to the type import block from `'../types'` (after `ExitAdviceResult,`).

- [ ] **Step 2: Register the cache tag**

Replace line 29:

```ts
  tagTypes: ['StockInsight', 'PortfolioInsight', 'DailyBrief', 'RebalancePlan', 'DevilsAdvocate', 'ExitAdvice', 'ProcessGrade'],
```

with:

```ts
  tagTypes: ['StockInsight', 'PortfolioInsight', 'DailyBrief', 'RebalancePlan', 'DevilsAdvocate', 'ExitAdvice', 'StopAdvice', 'ProcessGrade'],
```

- [ ] **Step 3: Add the endpoint**

Insert this endpoint after the `getExitAdvice` endpoint definition and before `getProcessGrade`:

```ts
    getStopAdvice: builder.query<StopAdviceResult, StopAdviceRequest>({
      queryFn: async (request) => {
        try {
          return { data: await getStopAdvice(request) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
      providesTags: (_, __, request) => [{ type: 'StopAdvice', id: request.symbol }],
    }),
```

Note `request.symbol`, not `request.plan.symbol` — unlike `ExitAdviceRequest`, this request has no nested `plan` object.

- [ ] **Step 4: Export the hook**

Add `useLazyGetStopAdviceQuery,` to the destructured export block at the bottom of the file, after `useLazyGetExitAdviceQuery,`.

- [ ] **Step 5: Verify it compiles**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Stage and stop for review**

```bash
git add src/services/insightsApi.ts
git status
```

Do NOT commit. Report to the user: file staged, build clean, ready for review.

---

### Task 5: The StopLossAdvisor component

**Files:**
- Create: `src/components/stocks/StopLossAdvisor.tsx`
- Modify: `src/pages/StockDetailPage.tsx` (imports at lines 1-10, render block around line 124)

**Interfaces:**
- Consumes: `updateStopPrice` (Task 2), `Stock.stopPrice` (Task 2), `useLazyGetStopAdviceQuery` (Task 4), `stopDistancePercent` and `stopWarning` (Task 1), and the pre-existing `useLazyGetIndicatorsQuery` from `src/services/indicatorsApi.ts`.
- Produces: `<StopLossAdvisor holding={holding} currentPrice={currentPrice} />`.

- [ ] **Step 1: Create the component**

Create `src/components/stocks/StopLossAdvisor.tsx`:

```tsx
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Shield, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/utils';
import { stopDistancePercent, stopWarning } from '../../lib/stopAdvice';
import { useLazyGetStopAdviceQuery } from '../../services/insightsApi';
import { useLazyGetIndicatorsQuery } from '../../services/indicatorsApi';
import { updateStopPrice } from '../../features/portfolio/portfolioSlice';
import type { AppDispatch } from '../../store';
import type { Stock, StopAdviceResult } from '../../types';

interface StopLossAdvisorProps {
  holding: Stock;
  currentPrice: number;
}

export function StopLossAdvisor({ holding, currentPrice }: StopLossAdvisorProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [result, setResult] = useState<StopAdviceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [fetchStopAdvice] = useLazyGetStopAdviceQuery();
  const [fetchIndicators] = useLazyGetIndicatorsQuery();

  const currentStop = holding.stopPrice ?? null;
  const priceIsUsable = Number.isFinite(currentPrice) && currentPrice > 0;
  const belowStop = currentStop !== null && currentPrice < currentStop;
  const currentStopDistance = currentStop !== null ? stopDistancePercent(currentStop, currentPrice) : null;

  const handleSuggest = async () => {
    if (!priceIsUsable) return;
    setLoading(true);
    setError(false);
    try {
      // Indicators are context, not a hard requirement — a failure here still produces advice.
      const indicators = await fetchIndicators(holding.symbol).unwrap().catch(() => null);

      const advice = await fetchStopAdvice({
        symbol: holding.symbol,
        name: holding.name,
        currentPrice,
        purchasePrice: holding.purchasePrice,
        currentStop,
        indicators: indicators ?? null,
      }).unwrap();

      setResult(advice);
    } catch (e) {
      console.error('Stop advice error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const warning = result ? stopWarning(result.suggestedStop, currentPrice) : null;
  const suggestedDistance = result ? stopDistancePercent(result.suggestedStop, currentPrice) : null;
  const canAccept = result !== null && Number.isFinite(result.suggestedStop) && result.suggestedStop > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-500" />
          Stop Loss
        </CardTitle>
        <Button
          size="sm"
          variant={result ? 'outline' : 'default'}
          className="gap-1.5"
          onClick={handleSuggest}
          disabled={loading || !priceIsUsable}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Analyzing...' : result ? 'Re-analyze' : 'Suggest stop'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {currentStop !== null ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Your stop:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(currentStop)}
            </span>
            {currentStopDistance !== null && !belowStop && (
              <span className="text-gray-500 dark:text-gray-400">
                ({currentStopDistance.toFixed(1)}% below current price)
              </span>
            )}
            {belowStop && (
              <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-3 w-3" />
                Price is below your stop
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No stop set for {holding.symbol}. Get a suggestion based on the current chart, then set the order in your broker.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Stop suggestion unavailable right now. Try again in a moment.
          </p>
        )}

        {result && !loading && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/20">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm text-blue-800 dark:text-blue-300">Suggested stop</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(result.suggestedStop)}
              </span>
              {suggestedDistance !== null && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  ({suggestedDistance.toFixed(1)}% below current price)
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{result.reasoning}</p>

            {warning && (
              <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {warning}
              </p>
            )}

            {canAccept && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  dispatch(updateStopPrice({ symbol: holding.symbol, stopPrice: result.suggestedStop }))
                }
              >
                Set stop to {formatCurrency(result.suggestedStop)}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `src/pages/StockDetailPage.tsx`, add this import after the `ThesisCard` import on line 6:

```tsx
import { StopLossAdvisor } from '../components/stocks/StopLossAdvisor';
```

Then, in the render block, insert the component between the price chart and the thesis card. Replace:

```tsx
      {/* Price Chart */}
      <PriceChart symbol={symbol} title={`${symbol} Price History`} />

      {/* Investment thesis + AI check */}
      <ThesisCard holding={holding} currentPrice={currentPrice} />
```

with:

```tsx
      {/* Price Chart */}
      <PriceChart symbol={symbol} title={`${symbol} Price History`} />

      {/* AI stop-loss suggestion from the current technical picture */}
      <StopLossAdvisor holding={holding} currentPrice={currentPrice} />

      {/* Investment thesis + AI check */}
      <ThesisCard holding={holding} currentPrice={currentPrice} />
```

- [ ] **Step 3: Verify the whole project builds, lints, and tests clean**

Run: `npm test && npm run build && npm run lint`

Expected: tests PASS (the existing suite plus the 8 from Task 1), build PASS, no new lint errors.

- [ ] **Step 4: Verify it works in the running app**

Start both servers: `npm run dev:all`

Then, in the browser at `http://localhost:5173`:
1. Open a holding's detail page (click a row in the portfolio list).
2. Confirm the "Stop Loss" card appears between the price chart and the thesis card, showing "No stop set for <SYMBOL>".
3. Click "Suggest stop". Confirm the button shows a spinner and "Analyzing...".
4. Confirm a suggested price and reasoning appear, and the reasoning names a concrete technical level rather than a bare percentage.
5. Click "Set stop to $X". Confirm the header line changes to "Your stop: $X" with a percentage-below-price readout.
6. Reload the page. Confirm the stop is still shown — this proves the `saveToStorage` call in Task 2 works.
7. Click "Re-analyze". Confirm the reasoning now references the existing stop (raising, holding, or loosening it).

If the backend is not running, `/api/indicators/:symbol` will fail; the advice should still return with reasoning that says the technicals were unavailable. Verify that path by stopping the Express server and clicking "Suggest stop" again.

- [ ] **Step 5: Stage and stop for review**

```bash
git add src/components/stocks/StopLossAdvisor.tsx src/pages/StockDetailPage.tsx
git status
```

Do NOT commit. Report to the user: files staged, all verification commands and the manual browser checks that passed, and that the feature is ready for review.

---

## Verification summary

After all five tasks, the following must hold:

- `npm test` — the existing suite plus 8 new tests in `src/lib/stopAdvice.test.ts`, all passing.
- `npm run build` — clean.
- `npm run lint` — no new errors.
- A holding's detail page shows a Stop Loss card that produces a technically-justified stop price on demand, and the accepted price survives a page reload.
- Nothing is committed. Every task ends staged, awaiting the user's review.
