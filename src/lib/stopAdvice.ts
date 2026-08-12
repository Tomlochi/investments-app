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
