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
