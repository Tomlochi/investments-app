// Pure indicator math. No Express, no network — imported by server.js and by tests.

/** Simple moving average of the last `period` closes. Null if history is too short. */
export function sma(closes, period) {
  if (!Array.isArray(closes) || closes.length < period) return null;
  const window = closes.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

/**
 * Average True Range over 14 periods, Wilder-smoothed.
 * Needs 15 bars: the first is only used as the previous close.
 */
export function atr14(bars) {
  if (!Array.isArray(bars) || bars.length < 15) return null;

  const trueRanges = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    const prevClose = bars[i - 1].close;
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    );
  }

  // Seed with a simple average of the first 14, then apply Wilder smoothing.
  let atr = trueRanges.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (let i = 14; i < trueRanges.length; i++) {
    atr = (atr * 13 + trueRanges[i]) / 14;
  }
  return atr;
}

/** Relative Strength Index over 14 periods, Wilder-smoothed. Needs 15 closes. */
export function rsi14(closes) {
  if (!Array.isArray(closes) || closes.length < 15) return null;

  const changes = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  let avgGain = 0;
  let avgLoss = 0;
  for (const change of changes.slice(0, 14)) {
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= 14;
  avgLoss /= 14;

  for (const change of changes.slice(14)) {
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }

  if (avgLoss === 0) return avgGain === 0 ? null : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Where the latest close sits in its range: 0 at the low, 1 at the high. */
export function fiftyTwoWeekPosition(closes) {
  if (!Array.isArray(closes) || closes.length === 0) return null;
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  if (high === low) return null;
  return (closes[closes.length - 1] - low) / (high - low);
}
