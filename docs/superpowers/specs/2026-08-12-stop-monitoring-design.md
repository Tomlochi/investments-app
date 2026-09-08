# Stop Monitoring and Portfolio Stop Risk — Design Spec

## Problem

The stop-loss advisor (branch `feat/stop-loss-advisor`, commit `84f5a73`) writes a `stopPrice` onto a holding, but nothing watches it and nothing aggregates it. Two gaps follow from that:

1. **A stop is only visible on the page you have to visit.** `HoldingsList` polls quotes at 60s, but only while the dashboard is mounted — navigate to Journal or Plans and no holding is being watched at all. If price breaks below a stop, nothing tells you. The whole point of the advisor was to act on the number in a broker app; a number nobody watches does not prompt action.

2. **No portfolio-level view of what the stops actually protect.** `RiskPanel` covers sector and beta concentration. The number missing is the one a risk-managed trader checks daily: if every stop hit tomorrow, what is the total loss, and which positions have no stop at all.

This spec depends on `Stock.stopPrice` and the `updateStopPrice` reducer from `feat/stop-loss-advisor`. That branch must be merged (or this work branched off it) before implementation.

## Data model

Add one optional field to `Stock` in `src/types/index.ts`:

```ts
/** ISO timestamp of the first price observation below stopPrice. Cleared when the stop is changed or removed. */
stopBreachedAt?: string;
```

Add one reducer to `src/features/portfolio/portfolioSlice.ts`:

```ts
markStopBreached: (state, action: PayloadAction<{ symbol: string; price: number }>) => {
  const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
  if (holding && !holding.stopBreachedAt) {
    holding.stopBreachedAt = new Date().toISOString();
    saveToStorage(state.holdings);
  }
},
```

The `!holding.stopBreachedAt` guard is what makes the notification fire once per breach episode rather than once per 60-second poll.

Modify the existing `updateStopPrice` reducer to clear the breach whenever the stop changes:

```ts
updateStopPrice: (state, action: PayloadAction<{ symbol: string; stopPrice: number | null }>) => {
  const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
  if (holding) {
    holding.stopPrice = action.payload.stopPrice ?? undefined;
    holding.stopBreachedAt = undefined;
    saveToStorage(state.holdings);
  }
},
```

Setting a new stop, or clearing the stop entirely, is the user's acknowledgement that they have dealt with the breach.

## Pure logic

New module `src/lib/stopRisk.ts`. No React, no network — everything here is unit-tested directly.

```ts
export interface HoldingRisk {
  symbol: string;
  risk: number;              // dollars at risk between current price and stop
  percentOfPortfolio: number;
}

export interface StopRisk {
  riskAmount: number;
  riskPercent: number;
  protectedCount: number;
  unprotectedCount: number;
  breachedCount: number;
  perHolding: HoldingRisk[];  // protected holdings only, largest risk first
}

export function computeStopRisk(holdings: Stock[], totalValue: number): StopRisk;

export function findBreachedHoldings(
  holdings: Stock[],
  priceBySymbol: Record<string, number>,
): { symbol: string; price: number; stopPrice: number }[];
```

`computeStopRisk` rules:

- A holding is **protected** when it has both a `stopPrice` and a `currentPrice`. Only protected holdings contribute to `riskAmount` and appear in `perHolding`.
- Per-holding risk is `(currentPrice - stopPrice) * quantity`.
- A holding whose `currentPrice` is at or below its `stopPrice` is **breached**: it contributes `0` to `riskAmount` (the loss is already live, not pending) and increments `breachedCount`. It is still counted as protected.
- A holding with no `stopPrice`, or with no known `currentPrice`, increments `unprotectedCount` and is excluded from the dollar figure. Rolling it in at full market value would produce a number dominated by unprotected positions that never moves and therefore never gets read.
- `riskPercent` is `riskAmount / totalValue * 100`, and is `0` when `totalValue <= 0`.
- `perHolding` contains every protected holding, including breached ones (which carry `risk: 0` and therefore sort last). It is sorted by `risk` descending.

`findBreachedHoldings` returns every holding where a known price is at or below a set `stopPrice`, regardless of whether `stopBreachedAt` is already set. De-duplication is the reducer's job, not this function's — keeping it stateless is what makes it testable. A price exactly equal to the stop counts as breached.

It takes a price map rather than a single price so the banner can evaluate the whole portfolio in one call. `StopWatcher`'s per-symbol inner component calls it with a one-element holdings array and a single-entry map — slightly indirect at that call site, but it keeps one tested function instead of two near-identical ones.

## Watching

New component `src/components/portfolio/StopWatcher.tsx`, mounted in `src/App.tsx` directly alongside the existing `<AlertWatcher />`.

It is deliberately a sibling of `AlertWatcher` rather than an extension of it. The two read different slices (`alerts` vs `portfolio`), fire different notification copy, and serve different concepts — a price alert is something you asked to be told about, a stop breach is something you should already have acted on. Folding stop logic into `AlertWatcher` would make a single-purpose component read two slices for two unrelated reasons.

Structure mirrors `AlertWatcher`: an inner `SymbolWatcher` subscribes to `useGetQuoteQuery(symbol, { pollingInterval: 60000 })` for one symbol, and the outer component maps over holdings that have a `stopPrice`. RTK Query deduplicates identical subscriptions, so a symbol already polled by `HoldingsList` or `AlertWatcher` costs no additional request.

On each quote update, the watcher checks the holding via `findBreachedHoldings` and, on a breach, dispatches `markStopBreached` and fires a browser notification. Copy is distinct from a price alert:

> **AAPL broke your stop** — $305.20, your stop is $308.00.

Notification uses the same guard as `AlertWatcher`: no-op unless `Notification.permission === 'granted'`.

## Banner

New component `src/components/portfolio/StopBreachBanner.tsx`, rendered at the top of `Dashboard` in `src/App.tsx`, above `PortfolioSummary`. Returns `null` when no holding has `stopBreachedAt` set.

One row per breached holding, showing symbol, current price, the stop, how far below the stop the price sits, and how long it has been breached (derived from `stopBreachedAt`). Each row links to `/stock/:symbol`, where the advisor can issue a replacement stop.

There is no dismiss button. The banner clears only when the user takes a real action:

- **Set a new stop** — via the advisor on the detail page, which dispatches `updateStopPrice` and clears the breach.
- **Clear stop** — a button on each banner row dispatching `updateStopPrice({ symbol, stopPrice: null })`. This path does not exist yet: `updateStopPrice` accepts `null` but nothing dispatches it. Without it, a breached holding the user has consciously decided to keep has no way out of the banner.
- **Sell the holding** — removing it from the portfolio removes the row.

Price recovering above the stop does **not** auto-clear the breach. A breach that happened while the app was closed is still a decision the user needs to make.

## Risk display

Add a stop-risk section to the existing `src/components/portfolio/RiskPanel.tsx` (currently 147 lines, covering sector and beta concentration) rather than adding an eighth dashboard card. Risk belongs in one place.

Headline line:

> Risking **$4,200** (3.1%) across 5 protected positions · 3 unprotected · 1 breached

Below it, the top three entries from `perHolding` with symbol and dollar risk. The unprotected count is rendered as a muted prompt to set stops on those holdings, not as an error.

When `protectedCount` is 0, the section shows a single line explaining that no holding has a stop set, rather than "$0 at risk" — which would read as safety when it means the opposite.

## Testing

The project runs vitest via `npm test`. `src/lib/stopRisk.ts` gets real unit tests:

- `computeStopRisk` with an empty holdings array
- all holdings unprotected (no stops) — `riskAmount` 0, `unprotectedCount` correct, `protectedCount` 0
- a mixed portfolio — dollar figure and counts
- a breached holding — contributes 0 to `riskAmount`, increments `breachedCount`, still counted protected
- `totalValue` of 0 — `riskPercent` is 0, no division by zero
- holdings with a `stopPrice` but no `currentPrice` — counted unprotected, not crashed on
- `perHolding` sort order
- `findBreachedHoldings` — returns breached only, ignores holdings with no stop, ignores symbols missing from the price map, treats price exactly equal to the stop as breached

`StopWatcher` and `StopBreachBanner` are thin subscription and presentation shells; their logic lives in `stopRisk.ts` and is covered there.

## Out of scope

- Stale-stop nudges ("this stop is 24 days old"). Considered and deliberately deferred — it needs a `stopSetAt` field and its own UI surface.
- Unifying `PriceAlert` and stop breaches into one concept. They stay separate.
- Any change to the AI advisor or to `src/lib/claude/`.
- Background or server-side watching. Like the existing alerts, monitoring runs only while the app is open. This is a real limitation and is not addressed here.
