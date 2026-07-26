# Trade Plan Engine — Design

**Date:** 2026-07-26
**Status:** Approved, ready for implementation planning
**Phase:** 1 of 3

## Problem

The app today tracks a portfolio and comments on it with AI. It does not help the user trade better, because it captures no *intent*: there is no record of why a position was entered, what would invalidate it, where the exit is, or whether the user followed their own plan.

The user's two self-identified failures are:

1. **No plan before entry** — positions opened on impulse, with no pre-defined stop, target, or written reason.
2. **Bad exits** — losers held past the point of sense, winners cut early, no rule governing either.

Both are process failures, and neither is visible in the current data model. A P&L number cannot tell you whether a losing trade was well-executed or a winning trade was luck.

## Goal

Make the trade plan a first-class object with a lifecycle, then measure adherence to it. Turn "trading discipline" from a feeling into a number the user can watch improve.

## User context

- **Style:** core long-term holdings plus an actively traded satellite. Both must be supported; the plan engine applies to trades of any horizon.
- **Enforcement:** soft gate. The app nags and measures but never blocks. Unplanned positions remain legal and are counted, not prevented.
- **Market:** US equities, USD. `formatCurrency` in `src/lib/utils.ts` already hardcodes USD.

## Scope

### In scope (Phase 1)

- `TradePlan` data model and lifecycle
- Position sizing calculator with ATR-anchored stop suggestion
- `/api/indicators/:symbol` backend endpoint
- Three AI calls: pre-trade devil's advocate, exit advisor, post-trade process grader
- Discipline scorecard with R-multiple-based metrics
- Migration of all Claude calls to `claude-opus-5` with schema-enforced structured outputs
- Split of `src/lib/claude.ts` into a directory
- `vitest` covering pure math only

### Explicitly out of scope

- **Phase 2 (separate spec):** SQLite persistence, server-side quote watcher, Telegram/email notification when the browser is closed, moving the Anthropic API key server-side.
- **Phase 3 (separate spec):** fundamentals data, idea screener that drafts plans for candidates.
- Component tests, e2e tests, CI.
- Multi-currency, multi-portfolio, cost-basis lots.
- **Short positions.** All plans are long-only: `stopPrice < entryHigh < target1`. Sizing, R-multiple, and the bad-exit counters all assume this direction.
- **Partial exits.** A plan closes in full. The exit advisor may *suggest* trimming, but acting on it means manually adjusting the holding; the plan itself has no partial-close state.

## Architecture

### Relationship to existing models

`TradePlan` is a new first-class slice that links to holdings by symbol. Three options were considered:

1. **Plan as its own slice, linked by symbol** — chosen.
2. Plan replaces holdings as the source of truth — rejected: rewrites `HoldingsList`, `AllocationChart`, `RiskPanel`, rebalance, and the history chart, and contradicts the soft-gate requirement, since a plan-only model makes unplanned positions impossible to represent.
3. Plan as optional metadata on a holding — rejected: permits only one plan per symbol ever, cannot represent a candidate not yet owned, and loses plan history on exit, which destroys the scorecard.

**Division of authority under option 1:**

- `portfolioSlice` remains the source of truth for **what is owned and what it is worth**.
- `tradePlanSlice` is the source of truth for **intent and risk levels**.

Opening and closing a plan are the *only* writers of the corresponding `TradeEntry` records and holding mutations for planned trades. This keeps the two stores from drifting: a plan transition is a single transaction that touches plan, holding, and journal together.

"Unplanned positions" — the soft gate — is a derived value: holdings with no `open` plan for their symbol.

### Data model

New types in `src/types/index.ts`:

```ts
type PlanStatus = 'idea' | 'open' | 'closed';
type SetupType = 'breakout' | 'pullback' | 'earnings' | 'value' | 'core-add' | 'other';
type ExitReason = 'stop-hit' | 'target-hit' | 'thesis-broken' | 'discretionary';

interface ProcessGrade {
  score: number;              // 0-100, process quality only, independent of P&L
  followedPlan: string[];
  brokePlan: string[];
  lesson: string;             // one line, injected into future devil's-advocate calls
  timestamp: string;
}

interface TradePlan {
  id: string;
  symbol: string;
  name: string;
  status: PlanStatus;
  setup: SetupType;
  thesis: string;             // why enter
  invalidation: string;       // what would prove the thesis wrong (prose, distinct from stopPrice)
  entryLow: number;
  entryHigh: number;
  stopPrice: number;
  target1: number;
  target2?: number;
  plannedShares: number;
  riskPercent: number;        // % of equity risked at plan time
  conviction: 1 | 2 | 3 | 4 | 5;
  createdAt: string;

  // set on transition to 'open'
  actualEntryPrice?: number;
  actualShares?: number;
  initialStopPrice?: number;  // snapshot of stopPrice at open; never mutated
  openedAt?: string;

  // set on transition to 'closed'
  actualExitPrice?: number;
  closedAt?: string;
  exitReason?: ExitReason;
  grade?: ProcessGrade;
}
```

`invalidation` is deliberately separate from `stopPrice`. The stop is a price; the invalidation is the condition that makes the thesis wrong. They are frequently different, and the difference is what the exit advisor reasons about.

**`stopPrice` versus `initialStopPrice`.** The exit advisor can recommend raising a stop, and the user may edit `stopPrice` on an open plan — so `stopPrice` is the *live* stop, used for distance-to-stop displays and for detecting a blown stop. `initialStopPrice` is snapshotted when the plan opens and never changes, and it is what every R calculation uses. Without this split, raising a stop would retroactively shrink the denominator of `rMultiple` and silently inflate every historical R, corrupting expectancy and the entire scorecard.

**Derived, never stored** (computed in `src/lib/planMath.ts`):

```
riskPerShare = entryHigh - stopPrice                                    // at plan time, for sizing
plannedR     = (target1 - entryHigh) / (entryHigh - stopPrice)          // at plan time
rMultiple    = (actualExitPrice - actualEntryPrice) / (actualEntryPrice - initialStopPrice)
```

New settings slice `src/features/settings/settingsSlice.ts`, persisted to `localStorage`:

```ts
interface TradeSettings {
  riskPerTradePercent: number;   // default 1
  maxPositionPercent: number;    // default 20
}
```

### Lifecycle

```
idea ──open──> open ──close──> closed
  │
  └──delete──> (gone)
```

- **idea → open**: user supplies actual fill price and share count. Writes a buy `TradeEntry`, creates or increases the holding, stamps `openedAt`.
- **open → closed**: user supplies exit price and `exitReason`. Writes a sell `TradeEntry`, reduces or removes the holding, stamps `closedAt`, then fires the process grader.
- Closed plans are immutable except for a later-requested `grade`.

## Position sizing

Shown live inside `PlanFormModal`:

```
equity          = holdings market value + cash balance
riskBudget      = equity * riskPerTradePercent / 100
riskPerShare    = entryHigh - stopPrice           // must be > 0
suggestedShares = floor(riskBudget / riskPerShare)
positionCap     = floor(equity * maxPositionPercent / 100 / entryHigh)
finalSuggestion = min(suggestedShares, positionCap)
```

The form displays risk in dollars, risk as a percent of equity, position size as a percent of equity, and planned R:R. It turns red when R:R is below 1.5 or the position exceeds the cap. Every field is overridable — this is a soft gate.

**ATR-anchored stop.** The form offers a one-click "stop = entry − 2 × ATR(14)" using the value from `/api/indicators/:symbol`. This exists so the stop is derived from the instrument's actual volatility rather than from a round number. When ATR is unavailable the button is disabled and manual entry is unaffected.

## Scorecard

Displayed compactly on the dashboard (`DisciplineCard`) and in full on `/performance`.

| Metric | Definition |
|---|---|
| Plan coverage % | open positions with a plan ÷ all open positions |
| Adherence % | closed plans with `exitReason` in {stop-hit, target-hit, thesis-broken} ÷ all closed plans. `discretionary` counts as broken. |
| Expectancy (R) | `(winRate × avgWinR) − (lossRate × avgLossR)` |
| Avg process grade | mean `grade.score`, trended over time |
| By-setup breakdown | win rate, expectancy, and count per `SetupType` |
| Cut winners early | count of closed plans exited profitably below `target1` with `exitReason: 'discretionary'` |
| Held losers | count of closed plans where `actualExitPrice < stopPrice` — the *live* stop, since blowing through a raised stop is still a broken exit |

The last two counters exist to measure the user's stated pain directly.

**Why R-multiples.** Expressing outcomes in R normalizes across position sizes: a \$200 gain on \$100 of risk and a \$2,000 gain on \$1,000 of risk are both +2R. Without normalization, a few oversized positions dominate every statistic and the process signal disappears into noise.

## AI decision suite

All calls use `claude-opus-5`.

**Model migration.** Three existing calls (`getStockInsight`, `getDailyBrief`, `getPortfolioInsight`) currently use `claude-sonnet-4-20250514`, whose published retirement date was 2026-06-15 — already past. These may be returning errors in production today. All eight existing calls plus the three new ones move to `claude-opus-5`.

**Structured outputs.** Current code prompts for JSON and parses the model's prose. All calls move to `output_config: { format: { type: 'json_schema', schema } }`, which makes the response shape enforced rather than hoped for. Schemas live in `src/lib/claude/schemas.ts`.

**Thinking and token budget.** On `claude-opus-5` adaptive thinking is on by default; omitting the `thinking` parameter runs it. `max_tokens` caps thinking *and* response text together, so every call gets headroom above what the response alone would need. Sampling parameters (`temperature`, `top_p`, `top_k`) are rejected by this model and must not be sent.

**Every AI call is advisory. None may block a user action.** If a call fails, the user's action still completes and the failure is surfaced non-blockingly.

### 1. Devil's advocate

Fires when a plan is saved, before it goes live.

Deterministic checks run **in code before the call**, and their results are passed in as input: R:R ratio, position percent versus cap, risk dollars versus budget, stop distance versus ATR, and sector concentration against existing holdings using `/api/profile-batch`. Arithmetic on the risk budget stays in code where it is exact.

- **Input:** draft plan, holdings, cash, open plans, the last 10 closed plans *with their grades and lessons*, indicators, recent news for the symbol, computed check flags.
- **Output:** `{ verdict: 'proceed' | 'caution' | 'reconsider', bearCase: string[], planCritique: string[], repeatedMistakes: string[] }`
- `repeatedMistakes` cites the user's own graded lessons by symbol and date. This is the feedback loop that makes past errors visible at the moment they are about to recur.

### 2. Exit advisor

Runs on demand, for a single open plan or all of them.

- **Input:** plan, current price, distance to stop and target expressed in both R and ATR, days held, price action since entry, recent news.
- **Output:** `{ action: 'hold' | 'trim' | 'exit' | 'raise-stop', reasoning: string, suggestedStop?: number }`
- The system prompt directs it to prioritize exit discipline: flag explicitly when the user is holding past their own stop, or is about to exit early with no stated reason.

### 3. Process grader

Fires on plan close.

- **Input:** the plan as written, what actually happened, the outcome.
- **Output:** `ProcessGrade`
- The system prompt is explicit that the score reflects process only and must ignore profit. A losing trade stopped out exactly as planned scores high. A profitable trade taken with no plan or exited on impulse scores low. This inversion is the core mechanism of the feature: it rewards repeatable behavior rather than outcomes, which are partly noise.

## Backend

One new endpoint in `server.js`:

```
GET /api/indicators/:symbol
  → { atr14, sma20, sma50, sma200, rsi14, fiftyTwoWeekPosition }
```

Computed in plain JavaScript from the data already fetched for `/api/historical`. No new dependency. Cached in memory for 24 hours, following the existing `/api/profile-batch` pattern.

Returns `null` for any indicator whose lookback exceeds available history. With fewer than 14 bars, all values are null.

## File structure

### Refactor: split `src/lib/claude.ts`

The file is 520 lines with 8 exported functions. Adding three calls plus JSON schemas would push it past 800. Split before the new calls land:

```
src/lib/claude/
  index.ts       // re-exports everything; existing import sites unchanged
  client.ts      // Anthropic client, model constant, shared call helper
  schemas.ts     // json_schema definitions
  insights.ts    // getStockInsight, getPortfolioInsight, getDailyBrief
  chat.ts        // chatWithPortfolio
  planning.ts    // getRebalancePlan, getTradeCheck, getDevilsAdvocate
  coaching.ts    // getJournalCoach, getThesisCheck, getExitAdvice, getProcessGrade
```

Mechanical move, no behavior change.

### New files

```
src/features/tradeplan/tradePlanSlice.ts
src/features/settings/settingsSlice.ts
src/lib/planMath.ts                     // pure: sizing, R-multiple, expectancy, adherence
src/lib/planMath.test.ts
src/services/indicatorsApi.ts           // RTK Query over /api/indicators
src/components/plans/PlanCard.tsx
src/components/plans/PlanFormModal.tsx
src/components/plans/ClosePlanModal.tsx
src/components/plans/SizingCalculator.tsx
src/components/plans/OpenPositionsPanel.tsx
src/components/performance/DisciplineCard.tsx
src/components/performance/Scorecard.tsx
src/components/performance/SetupBreakdown.tsx
src/components/performance/GradeTrend.tsx
src/pages/PlansPage.tsx
src/pages/PerformancePage.tsx
```

`planMath.ts` has no dependency on React or Redux. That isolation is what makes it testable, and it holds every number the user makes decisions from.

### Modified files

- `src/App.tsx` — two routes, two dashboard cards, two modals
- `src/components/layout/Sidebar.tsx` — two nav links
- `src/components/portfolio/HoldingsList.tsx` — planned/unplanned badge per row
- `src/store/index.ts` — register two slices
- `src/types/index.ts` — new types
- `src/pages/DataPage.tsx` — include new `localStorage` keys in backup and restore
- `server.js` — indicators endpoint

## UI surfaces

| Route | Contents |
|---|---|
| `/plans` | Tabs: Ideas / Open / Closed. `PlanCard` per plan. "New plan" button. |
| `/performance` | Scorecard, grade trend, by-setup table, bad-exit counters |

Dashboard additions, placed above the fold as the daily-use surface:

- `OpenPositionsPanel` — one row per open plan showing distance to stop and target in R, a progress bar between them, and an "Ask AI" button firing the exit advisor.
- `DisciplineCard` — coverage %, adherence %, expectancy, and a red count of unplanned positions linking to them.

Modals:

- `PlanFormModal` — sizing calculator, ATR-stop button, live R:R. Saving triggers the devil's advocate; the verdict renders inline and can be overridden.
- `ClosePlanModal` — exit price and `exitReason`. On save: writes the sell `TradeEntry`, updates the holding, fires the grader, displays the grade.

## Error handling and edge cases

| Case | Behavior |
|---|---|
| Any AI call fails (network, rate limit, refusal, truncation) | User action completes; error surfaced non-blockingly |
| `stopPrice >= entryHigh` | **Blocks save.** `riskPerShare <= 0` breaks sizing, and a stop above entry is not a stop. The only hard validation in the feature. |
| `/api/indicators` fails, or fewer than 14 bars available | Nulls returned; ATR-stop button disabled with tooltip; manual stop entry unaffected |
| Holding deleted while a plan is open | Prompt to close the plan first, or auto-close with `exitReason: 'discretionary'`. No orphaned plans. |
| Plan opened for an already-held symbol | Allowed. Each plan carries its own `actualEntryPrice` and `actualShares` and is scored as a separate trade. |
| Backup/restore | `DataPage` must include `trade-plans` and `trade-settings`. Omitting them would silently discard all plan history and grades on restore. |

## Testing

`vitest` added as a devDependency with an `npm test` script. Coverage is deliberately narrow:

- `src/lib/planMath.ts` — sizing, R-multiple, expectancy, adherence, the two bad-exit counters
- Indicator math — ATR, RSI, SMA, including short-history null cases

No component tests, no e2e, no CI.

**Rationale.** These are pure functions with exact expected outputs, and they produce the numbers the user makes money decisions from. A wrong expectancy formula does not crash; it silently reports that a losing strategy works. That is the only failure mode in this design severe enough to justify introducing test infrastructure to a project that has none.

## Security

`VITE_ANTHROPIC_API_KEY` is bundled into the browser and readable by anyone who can load the app. Phase 1 adds three more calls through that same path, increasing exposure without changing the underlying flaw.

This is accepted for Phase 1 on the explicit condition that the app runs only on localhost. **Phase 2 must move the key server-side before this app is hosted anywhere reachable.**

## Success criteria

1. A plan can be created, opened, and closed, with the holding and journal staying consistent through every transition.
2. The dashboard reports plan coverage, and unplanned positions are visible and countable.
3. Closing a plan produces a process grade, and that grade's `lesson` appears in a later devil's-advocate response for a comparable setup.
4. `/performance` reports expectancy in R and both bad-exit counters over the user's closed plans.
5. All Claude calls run on `claude-opus-5` with schema-enforced output.
6. `npm test` passes.
