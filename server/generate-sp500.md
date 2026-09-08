# Refreshing sp500.json

`sp500.json` is a committed static list of S&P 500 constituents (`symbol`, `name`, `sector`).
It is static on purpose: index membership changes a few times a year, and resolving
sectors at request time would mean 503 `quoteSummary` calls per load.

Sector values are GICS and must stay exactly as Wikipedia spells them — `src/lib/heatmap.ts`
groups on the raw string.

To refresh, re-run the two commands in Task 2 of
`docs/superpowers/plans/2026-08-12-sp500-heatmap.md`: fetch the Wikipedia constituents
page to `/tmp/sp.html`, then run the Python parser, which asserts the constituent count
is 490–515 and that exactly 11 sectors are present.

Ticker dots are converted to dashes (`BRK.B` -> `BRK-B`) because that is the form Yahoo
Finance accepts.
