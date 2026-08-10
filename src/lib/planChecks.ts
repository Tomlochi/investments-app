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
  if (!sizing.valid) {
    return ['Stop is at or above the entry price, so the trade has no defined risk.'];
  }

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
