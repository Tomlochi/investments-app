import type { TradePlan, SetupType, Stock } from '../types';

export interface SizingInput {
  equity: number;
  riskPerTradePercent: number;
  maxPositionPercent: number;
  entryHigh: number;
  stopPrice: number;
}

export interface SizingResult {
  riskBudget: number;
  riskPerShare: number;
  /** Shares the risk budget alone allows, before the position cap. */
  suggestedShares: number;
  /** Share ceiling implied by maxPositionPercent. */
  positionCap: number;
  /** The lesser of suggestedShares and positionCap; 0 when invalid. */
  finalShares: number;
  /** False when the inputs cannot produce a position (stop at/above entry, or no equity). */
  valid: boolean;
}

const INVALID: Omit<SizingResult, 'riskBudget' | 'riskPerShare'> = {
  suggestedShares: 0,
  positionCap: 0,
  finalShares: 0,
  valid: false,
};

export function computeSizing(input: SizingInput): SizingResult {
  const { equity, riskPerTradePercent, maxPositionPercent, entryHigh, stopPrice } = input;
  const riskPerShare = entryHigh - stopPrice;
  const riskBudget = (equity * riskPerTradePercent) / 100;

  if (riskPerShare <= 0 || equity <= 0 || entryHigh <= 0) {
    return { riskBudget, riskPerShare, ...INVALID };
  }

  const suggestedShares = Math.floor(riskBudget / riskPerShare);
  const positionCap = Math.floor((equity * maxPositionPercent) / 100 / entryHigh);

  return {
    riskBudget,
    riskPerShare,
    suggestedShares,
    positionCap,
    finalShares: Math.min(suggestedShares, positionCap),
    valid: true,
  };
}

/** Reward-to-risk of the plan as written. Null when the plan has no positive risk. */
export function plannedR(entryHigh: number, stopPrice: number, target1: number): number | null {
  const risk = entryHigh - stopPrice;
  if (risk <= 0) return null;
  return (target1 - entryHigh) / risk;
}

/**
 * Outcome in R. Measured against initialStopPrice — the stop as it stood at
 * open — so that raising a stop mid-trade cannot retroactively inflate R.
 */
export function realizedR(entry: number, initialStop: number, exit: number): number | null {
  const risk = entry - initialStop;
  if (risk <= 0) return null;
  return (exit - entry) / risk;
}

export interface Scorecard {
  coveragePercent: number | null;
  adherencePercent: number | null;
  expectancyR: number | null;
  winRate: number | null;
  avgWinR: number | null;
  /** Mean magnitude of losing R, reported positive. */
  avgLossR: number | null;
  avgGrade: number | null;
  cutWinnersEarly: number;
  heldLosers: number;
  closedCount: number;
}

export interface SetupStats {
  setup: SetupType;
  count: number;
  winRate: number | null;
  expectancyR: number | null;
}

const ADHERENT_REASONS = ['stop-hit', 'target-hit', 'thesis-broken'];

/** R for a closed plan, or null when it is missing the fields R needs. */
function planR(plan: TradePlan): number | null {
  if (
    plan.status !== 'closed' ||
    plan.actualEntryPrice == null ||
    plan.initialStopPrice == null ||
    plan.actualExitPrice == null
  ) {
    return null;
  }
  return realizedR(plan.actualEntryPrice, plan.initialStopPrice, plan.actualExitPrice);
}

function expectancyFrom(
  rs: number[]
): Pick<Scorecard, 'winRate' | 'avgWinR' | 'avgLossR' | 'expectancyR'> {
  if (rs.length === 0) {
    return { winRate: null, avgWinR: null, avgLossR: null, expectancyR: null };
  }
  const wins = rs.filter(r => r > 0);
  const losses = rs.filter(r => r <= 0);
  const winRate = wins.length / rs.length;
  const avgWinR = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossR = losses.length
    ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length)
    : 0;
  return {
    winRate,
    avgWinR: wins.length ? avgWinR : null,
    avgLossR: losses.length ? avgLossR : null,
    expectancyR: winRate * avgWinR - (1 - winRate) * avgLossR,
  };
}

export function unplannedSymbols(plans: TradePlan[], holdings: Stock[]): string[] {
  const planned = new Set(plans.filter(p => p.status === 'open').map(p => p.symbol));
  return holdings.filter(h => !planned.has(h.symbol)).map(h => h.symbol);
}

export function computeScorecard(plans: TradePlan[], holdings: Stock[]): Scorecard {
  const closed = plans.filter(p => p.status === 'closed');
  const rs = closed.map(planR).filter((r): r is number => r !== null);

  const adherent = closed.filter(p => p.exitReason && ADHERENT_REASONS.includes(p.exitReason));
  const graded = closed.filter(p => p.grade != null);

  const cutWinnersEarly = closed.filter(
    p =>
      p.exitReason === 'discretionary' &&
      p.actualEntryPrice != null &&
      p.actualExitPrice != null &&
      p.actualExitPrice > p.actualEntryPrice &&
      p.actualExitPrice < p.target1
  ).length;

  // Compared against the live stop: blowing through a raised stop is still a broken exit.
  const heldLosers = closed.filter(
    p => p.actualExitPrice != null && p.actualExitPrice < p.stopPrice
  ).length;

  const unplanned = unplannedSymbols(plans, holdings).length;

  return {
    coveragePercent:
      holdings.length === 0 ? null : ((holdings.length - unplanned) / holdings.length) * 100,
    adherencePercent: closed.length === 0 ? null : (adherent.length / closed.length) * 100,
    avgGrade: graded.length
      ? graded.reduce((sum, p) => sum + (p.grade?.score ?? 0), 0) / graded.length
      : null,
    cutWinnersEarly,
    heldLosers,
    closedCount: closed.length,
    ...expectancyFrom(rs),
  };
}

export function bySetup(plans: TradePlan[]): SetupStats[] {
  const closed = plans.filter(p => p.status === 'closed');
  const setups = [...new Set(closed.map(p => p.setup))];
  return setups.map(setup => {
    const rs = closed
      .filter(p => p.setup === setup)
      .map(planR)
      .filter((r): r is number => r !== null);
    const { winRate, expectancyR } = expectancyFrom(rs);
    return { setup, count: closed.filter(p => p.setup === setup).length, winRate, expectancyR };
  });
}
