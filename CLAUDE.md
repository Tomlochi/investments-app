# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (both servers together)
npm run dev:all

# Frontend only (Vite, port 5173)
npm run dev

# Backend only (Express, port 3001)
npm run server

# Build
npm run build

# Lint
npm run lint
```

There are no tests in this project.

## Architecture

This is a React + TypeScript portfolio tracker with two processes:

**Frontend** — Vite/React SPA (`src/`)  
**Backend** — Express API server (`server.js`, port 3001) that proxies Yahoo Finance via `yahoo-finance2`. The Vite dev server proxies `/api/*` requests to `http://localhost:3001`.

### State management

Redux Toolkit with two slices and two RTK Query APIs:

- `portfolioSlice` — holdings CRUD, persisted to `localStorage` under `portfolio-holdings`
- `uiSlice` — theme (persisted to `localStorage`), sidebar, modal open/close, selected stock
- `stockApi` — RTK Query over the Express backend (`/api/quote`, `/api/historical`, `/api/search`)
- `insightsApi` — RTK Query using `fakeBaseQuery`, calls Claude directly from the browser via `src/lib/claude.ts`

### AI insights

`src/lib/claude.ts` calls the Anthropic SDK with `dangerouslyAllowBrowser: true`, using the key from `VITE_ANTHROPIC_API_KEY`. The `insightsApi` service wraps these calls in RTK Query for caching. `PortfolioInsights` and `StockInsightsList` components consume this API.

### Path alias

`@/` maps to `src/` (configured in `vite.config.ts`).

### Environment

Copy `.env.example` to `.env` and set `VITE_ANTHROPIC_API_KEY` to a real Anthropic API key. The key is exposed in the browser bundle — intended for local/personal use only.
