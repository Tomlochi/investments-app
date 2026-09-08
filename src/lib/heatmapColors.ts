import type { BucketKey } from './heatmap';

/**
 * Diverging scale for the heatmap: green = gains, red = losses, pale neutral at zero.
 * Pastel fills with dark ink, matching the familiar finance-heatmap look.
 *
 * Green/red is the convention, and it is the single worst hue pair for red-green
 * colourblindness, so the arms are deliberately NOT lightness-matched: the red arm runs
 * darker than the green arm at every magnitude. When hue collapses under deuteranopia,
 * lightness still separates a gain from a loss.
 *
 * That asymmetry is the whole trick — do not "balance" the two arms to the same
 * lightness. Measured, strong gain vs strong loss:
 *   lightness-matched pastels  dE  1.5 (deutan) — indistinguishable
 *   these asymmetric steps     dE 20.7 light / 14.6 dark — clearly separated
 * The mid pair measures 13.0 light / 10.9 dark.
 *
 * The two `slight-*` buckets sit at dE 3.8 and are genuinely hard to tell apart under
 * deuteranopia. That is inherent to a near-white midpoint, and it is the least
 * consequential distinction on the map (a move under 0.75%). The secondary encoding
 * carries it: sector tiles print a signed percentage, and the expanded view has a full
 * table twin where every value is text.
 *
 * Hues are the documented green (#008300) and red (#e34948); steps were generated at
 * fixed OKLCH lightness/chroma and validated per arm.
 */
const LIGHT: Record<BucketKey, string> = {
  'strong-up': '#61d15a',
  'up': '#a2e59c',
  'slight-up': '#d5f1d2',
  'neutral': '#f0efec',
  'slight-down': '#ffccc7',
  'down': '#f07f77',
  'strong-down': '#cc272f',
};

const DARK: Record<BucketKey, string> = {
  'strong-up': '#4fc149',
  'up': '#3b8837',
  'slight-up': '#365733',
  'neutral': '#383835',
  'slight-down': '#572220',
  'down': '#942124',
  'strong-down': '#d4212d',
};

export function bucketColor(bucket: BucketKey, theme: 'light' | 'dark'): string {
  return (theme === 'dark' ? DARK : LIGHT)[bucket];
}

/** Legend order, strongest gain first. */
export const BUCKET_ORDER: BucketKey[] = [
  'strong-up',
  'up',
  'slight-up',
  'neutral',
  'slight-down',
  'down',
  'strong-down',
];

export const BUCKET_LABELS: Record<BucketKey, string> = {
  'strong-up': '≥ +2%',
  'up': '+0.75 to +2%',
  'slight-up': '+0.25 to +0.75%',
  'neutral': 'flat',
  'slight-down': '−0.25 to −0.75%',
  'down': '−0.75 to −2%',
  'strong-down': '≤ −2%',
};

/**
 * Ink that stays legible on each bucket's fill. Most fills are pale enough for dark ink;
 * only the darkest step of each arm needs white.
 */
const LIGHT_INK: Record<BucketKey, string> = {
  'strong-up': '#0b0b0b',
  'up': '#0b0b0b',
  'slight-up': '#0b0b0b',
  'neutral': '#52514e',
  'slight-down': '#0b0b0b',
  'down': '#0b0b0b',
  'strong-down': '#ffffff',
};

const DARK_INK: Record<BucketKey, string> = {
  'strong-up': '#0b0b0b',
  'up': '#ffffff',
  'slight-up': '#ffffff',
  'neutral': '#c3c2b7',
  'slight-down': '#ffffff',
  'down': '#ffffff',
  'strong-down': '#ffffff',
};

export function bucketInk(bucket: BucketKey, theme: 'light' | 'dark'): string {
  return (theme === 'dark' ? DARK_INK : LIGHT_INK)[bucket];
}
