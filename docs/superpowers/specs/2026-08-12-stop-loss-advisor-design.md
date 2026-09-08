# Stop-Loss Advisor — Design Spec

## Problem

The user opens a stock detail page for a holding and wants a second opinion, grounded in technical analysis, on where to set the stop-loss order in their broker app. Existing AI exit-advice (`getExitAdvice`) only works for holdings that went through the formal Trade Plan flow (requires entry price, initial stop, thesis, invalidation criteria, target). Most portfolio holdings are added directly via `AddHoldingModal` and have none of that — they need a lighter-weight, on-demand stop suggestion.

## Data model

Add optional `stopPrice?: number` to the `Stock` type (`src/types/index.ts`). This is independent of `TradePlan.stopPrice` — it's a plain field on the holding itself, only ever set via the AI suggestion flow (no manual input field).

New reducer in `src/features/portfolio/portfolioSlice.ts`:

```ts
updateStopPrice: (state, action: PayloadAction<{ symbol: string; stopPrice: number | null }>) => {
  const holding = state.holdings.find(h => h.symbol === action.payload.symbol);
  if (holding) {
    holding.stopPrice = action.payload.stopPrice ?? undefined;
    saveToStorage(state.holdings);
  }
},
```

Persists to the existing `portfolio-holdings` localStorage key like every other field in this slice.

## AI call

New schema `STOP_ADVICE_SCHEMA` in `src/lib/claude/schemas.ts`:

```ts
export const STOP_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    suggestedStop: { type: 'number', description: 'Recommended stop-loss price based on technical analysis.' },
    reasoning: { type: 'string', description: '2-4 sentences citing the specific technical basis: support level, moving average, ATR-based distance, or recent swing low/high.' },
  },
  required: ['suggestedStop', 'reasoning'],
  additionalProperties: false,
} as const;
```

New types in `src/types/index.ts`:

```ts
export interface StopAdviceRequest {
  symbol: string;
  name: string;
  currentPrice: number;
  purchasePrice: number;
  currentStop: number | null;
  indicators: Indicators | null;
}

export interface StopAdviceResult {
  suggestedStop: number;
  reasoning: string;
  timestamp: string;
}
```

New function `getStopAdvice(request: StopAdviceRequest): Promise<StopAdviceResult>` in `src/lib/claude/coaching.ts`, next to `getExitAdvice`. Follows the same response-parsing pattern (`parseJsonResponse`, `output_config.format` with the json_schema, same `MODEL`).

Prompt requirements:
- Frame as: an investor wants a protective/trailing stop price for this holding, grounded in current technicals.
- Include: symbol/name, current price, purchase price, current stop (or "none set"), and the technicals summary (SMA20/50/200, RSI14, ATR14, 52-week position) — same summarization pattern already used in `getExitAdvice`/`getDevilsAdvocate`.
- No headlines/news — this is price-action only, not sentiment-driven.
- Ask Claude to cite a specific technical basis (support level, moving average, ATR multiple, recent swing low) rather than a generic percentage.
- If a current stop exists, explicitly state whether the suggestion raises it, holds it, or (rarely) says the existing stop already looks fine.

## Wiring

- `src/services/insightsApi.ts`: add `getStopAdvice` query endpoint mirroring the existing `getExitAdvice` endpoint; add `'StopAdvice'` to `tagTypes`; export `useLazyGetStopAdviceQuery`.

## UI

New component `src/components/stocks/StopLossAdvisor.tsx`.

Props: `{ holding: Stock; currentPrice: number }`.

Behavior:
- Shows the current stored stop as a badge if `holding.stopPrice` is set (colored red if `currentPrice` is below it, matching the "Below your stop" treatment in `OpenPositionsPanel`), otherwise "No stop set."
- "Suggest Stop" button (Sparkles icon, same visual style as `StockInsights`'s "Analyze Stock" / `OpenPositionsPanel`'s "Ask AI"). On click:
  1. Fetch indicators via `useLazyGetIndicatorsQuery(holding.symbol)`, swallow failure to `null` (same as `OpenPositionsPanel.askAI`).
  2. Call `getStopAdvice` via `useLazyGetStopAdviceQuery` with symbol, name, currentPrice, purchasePrice, `holding.stopPrice ?? null`, indicators.
  3. Disable button while in flight; show `Loader2` spinner.
- On result: render `suggestedStop` (formatted currency) and `reasoning`, plus a "Set stop to $X" button that dispatches `updateStopPrice({ symbol: holding.symbol, stopPrice: result.suggestedStop })`.
- On error: inline text "Stop suggestion unavailable right now." (no crash), same as `OpenPositionsPanel`.
- Button disabled if `currentPrice` is not yet available.

Placement: `src/pages/StockDetailPage.tsx`, immediately after `<PriceChart />` and before `<ThesisCard />`.

## Out of scope

- No manual stop-price input field — value only ever comes from accepting an AI suggestion.
- No changes to the Trade Plan engine or `ExitAdvice` flow — this is a fully separate, lighter-weight path for plain holdings.
- No new backend endpoint — reuses the existing `/api/indicators/:symbol`.

## Testing

`CLAUDE.md` claims the project has no tests; that is stale. The repo runs vitest via `npm test`, with existing suites in `src/lib/planMath.test.ts`, `src/lib/planChecks.test.ts`, and `server/indicators.test.js`.

The AI call and the React component are not worth mocking, but the sanity checks around a suggested price are pure arithmetic and get real unit tests. A new module `src/lib/stopAdvice.ts` holds them:

- `stopDistancePercent(stopPrice, currentPrice)` — how far below the price the stop sits, as a percentage. Null when the price is unusable.
- `stopWarning(stopPrice, currentPrice)` — a warning string when the suggestion is at or above the current price (it would trigger instantly), more than 50% below it, or not a usable number. Null otherwise.

The component renders whatever `stopWarning` returns above the "Set stop" button, so a bad suggestion is visible rather than silently accepted.
