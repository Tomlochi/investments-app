# S&P 500 Heatmap — Design Spec

## Problem

The dashboard shows the user's own portfolio in detail but gives no market context. A holding down 2% reads very differently depending on whether the index is flat or down 2.5%. The user wants a market heatmap on the dashboard, compact by default with an expand control that opens the full map — the pattern used on Perplexity Finance.

## Data pipeline

### Constituent list

New static file `server/sp500.json`: 503 entries of `{ symbol, name, sector }`.

Generated from the Wikipedia "List of S&P 500 companies" constituents table, with ticker dots normalized to Yahoo's dash form (`BRK.B` → `BRK-B`). The eleven sector values are GICS: Communication Services, Consumer Discretionary, Consumer Staples, Energy, Financials, Health Care, Industrials, Information Technology, Materials, Real Estate, Utilities.

A static file is correct here: index membership changes a handful of times a year, and the alternative — resolving sectors at request time — would mean 503 `quoteSummary` calls, which the existing `/api/profile-batch` endpoint already demonstrates is far too slow (it is sequential with a 200ms delay and capped at 25 symbols). The generation procedure is recorded in the implementation plan so the file can be refreshed.

### Endpoint

New `GET /api/heatmap` in `server.js`.

Fetches quotes for all 503 symbols via `yahooFinance.quote(arrayOfSymbols)` in parallel chunks of 100. This was measured against the live API during design: **503 symbols returned in 609ms**, with `marketCap` present on every one. A single chunk of 100 returned in 379ms.

Response is a flat array of `{ symbol, name, sector, changePercent, marketCap }`, joining each quote to its sector from the static list.

- In-memory cache with a 60-second TTL, following the existing `profileCache` pattern in `server.js`. Repeated dashboard visits cost one upstream fetch per minute.
- A chunk that rejects is caught and dropped rather than failing the request. A partial map is more useful than an error card. The response includes the count actually returned so the client can note it.
- Quotes missing `marketCap` or `regularMarketChangePercent` are excluded — a treemap tile with no area is meaningless.

## Aggregation

New pure module `src/lib/heatmap.ts`, unit-tested without React.

```ts
export interface HeatmapTile {
  symbol: string;
  name: string;
  sector: string;
  changePercent: number;
  marketCap: number;
}

export interface SectorTile {
  sector: string;
  marketCap: number;      // sum of constituent market caps
  changePercent: number;  // market-cap-weighted mean of constituent changes
  count: number;
}

export type BucketKey =
  | 'strong-up' | 'up' | 'slight-up'
  | 'neutral'
  | 'slight-down' | 'down' | 'strong-down';

export function aggregateBySector(tiles: HeatmapTile[]): SectorTile[];
export function changeBucket(changePercent: number): BucketKey;
```

`changeBucket` classifies on absolute magnitude, with each boundary **inclusive at its lower edge**:

| \|Δ\| | bucket |
|---|---|
| < 0.25 | `neutral` |
| ≥ 0.25 and < 0.75 | `slight-up` / `slight-down` |
| ≥ 0.75 and < 2 | `up` / `down` |
| ≥ 2 | `strong-up` / `strong-down` |

So exactly `+0.25` is `slight-up`, exactly `+2` is `strong-up`, and exactly `0` is `neutral`. Non-finite input (`NaN`, `Infinity`) returns `neutral` rather than throwing — a bad quote should render as a colorless tile, not break the map.

Sector change is a **market-cap-weighted** mean, not a plain mean. A plain mean lets the smallest company in a sector move its color as much as the largest, which misrepresents what the sector did.

`aggregateBySector` returns sectors sorted by market cap descending, and ignores tiles whose `marketCap` is zero or negative so they cannot contribute weight.

## Color

The encoding is **diverging** — polarity around zero — so it takes two hues plus a neutral gray midpoint, per the data-visualization method. Three steps per arm and a neutral bucket gives seven classes, which is at the documented ceiling of about seven meaningful color classes.

### Green and red, with the arms deliberately unbalanced

Green is gains, red is losses — the finance convention, pastel fills with dark ink.

Green/red is also the worst possible hue pair for red-green colourblindness, so the arms are **not lightness-matched**. The red arm runs darker than the green arm at every magnitude. When hue collapses under deuteranopia, lightness still separates a gain from a loss.

This asymmetry is the entire mechanism and must not be "balanced". Measured, strong gain against strong loss:

| Approach | Deuteranopia ΔE |
|---|---|
| Lightness-matched pastels (the naive version) | **1.5** — indistinguishable |
| These asymmetric steps | **20.7** light / **14.6** dark |

The mid pair measures 13.0 light / 10.9 dark.

An earlier revision of this spec used blue/red, which measures better still (21.6 / 19.2). It was replaced at the user's request to match the conventional finance look. The asymmetric-lightness construction is what makes that choice defensible rather than merely conventional.

### Buckets

| Bucket | Range | Light | Dark |
|---|---|---|---|
| strong up | ≥ +2% | `#61d15a` | `#4fc149` |
| up | +0.75% … +2% | `#a2e59c` | `#3b8837` |
| slight up | +0.25% … +0.75% | `#d5f1d2` | `#365733` |
| neutral | \|Δ\| < 0.25% | `#f0efec` | `#383835` |
| slight down | −0.25% … −0.75% | `#ffccc7` | `#572220` |
| down | −0.75% … −2% | `#f07f77` | `#942124` |
| strong down | ≤ −2% | `#cc272f` | `#d4212d` |

Hues are the documented green (`#008300`) and red (`#e34948`). Steps were generated at fixed OKLCH lightness and chroma, then validated per arm.

### Known weak point

The two `slight-*` buckets measure ΔE 3.8 under deuteranopia and are genuinely hard to tell apart. This is inherent to a near-white midpoint: both buckets are nearly the surface color by design, which is what produces the familiar pale middle.

It is accepted rather than fixed because it is the least consequential distinction on the map — a move under 0.75% — and because the secondary encoding carries it. Sector tiles print a signed percentage, constituent tiles print one wherever the tile can hold a second line, and the expanded view has a full table twin where every value is text.

### Validation notes

Each arm passes lightness monotonicity, adjacent ΔL ≥ 0.06, and single-hue checks in both modes.

The `--ordinal` light-end contrast check fails on the palest step of each arm. That check governs discrete ordered marks; for a heatmap the reference palette explicitly permits the near-zero step to recede toward the surface, which is exactly the pale middle this design wants. **Do not darken the pale steps to satisfy the ordinal floor.**

## Components

### `SectorHeatmap` — the dashboard card

Eleven sector tiles in a recharts `Treemap`, sized by summed market cap, colored by bucket. Each tile is large enough to carry a direct label: sector name and weighted change percent.

Card header holds the title, the as-of time, and an expand control (`Maximize2` from lucide-react).

A legend showing all seven buckets is always present. It is what makes the scale readable without relying on remembering which end is which.

### `HeatmapModal` — the expanded view

Opens from the expand control, using the existing `dialog` UI component at full-screen width.

Two modes, toggled in a single control row above the content:

1. **Map** — all 503 constituents in one treemap, grouped by sector, sized by market cap, colored by bucket. Labels render only where a tile is wide enough to hold the symbol without clipping; everything else is reached by hover.
2. **Table** — the same data as a sortable table: symbol, name, sector, change percent, market cap. Sortable by change and by market cap.

**The table view is required, not a nice-to-have.** At 503 tiles most tiles cannot carry a label and cannot meet the ~24px minimum hit target for hover, which would make the tooltip the only route to a value and the color the only encoding — two documented anti-patterns. The table is the accessible twin that discharges both, and it is also what satisfies the sub-3:1 contrast relief on the lightest buckets.

A sector filter sits in the same control row, scoping both modes.

### Portfolio overlay

Constituents the user holds get:

- a 2px ring in the chart surface color around the tile,
- their symbol labeled regardless of tile size,
- position size and open P&L added to the tooltip.

The ring is a shape difference rather than a color difference, so it survives colorblindness and does not consume a step of the diverging scale.

### Placement

`SectorHeatmap` goes on the Dashboard below `AllocationChart` and above `RiskPanel` — market context after the portfolio's own composition, before the risk read.

## Loading, errors, empty states

- While the first fetch is in flight, the card shows a skeleton at the treemap's final height so the dashboard does not jump.
- On refetch, the previous render is held at reduced opacity rather than reverting to a skeleton.
- If the endpoint fails entirely, the card shows a short message and a retry control; it does not disappear, and it does not take the dashboard down.
- If the endpoint returns fewer than the full constituent count, the map renders what arrived and the header notes the count.

## Testing

The project runs vitest via `npm test`.

`src/lib/heatmap.ts` gets real unit tests:

- `aggregateBySector` on an empty array
- weighting: a sector where a large-cap and a small-cap move opposite ways resolves toward the large-cap's direction, and differs from the plain mean
- sectors sorted by market cap descending
- tiles with zero or negative market cap excluded from weight
- a single-constituent sector returns that constituent's change unchanged
- `changeBucket` at every boundary, including exact values at `0.25`, `0.75`, `2` and their negatives, and at exactly `0`
- `changeBucket` on non-finite input

The React components are presentation over this module and are verified in the browser.

## Out of scope

- Indices other than the S&P 500.
- Intraday history or sparklines inside tiles.
- Automatic refresh of `sp500.json` — it is a committed static file, refreshed by rerunning the documented procedure.
- Server-side or background fetching while the app is closed.
- Any change to the AI modules under `src/lib/claude/`.
