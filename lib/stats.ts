// Small, dependency-free statistics used by the validation report and tests.

/** Wilson score interval for a binomial proportion. */
export function wilson(successes: number, n: number, z = 1.959964): { p: number; lo: number; hi: number } {
  if (n === 0) return { p: NaN, lo: NaN, hi: NaN };
  const p = successes / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

function logChoose(n: number, k: number) { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; }
/** Exact two-sided binomial test p-value for k successes in n trials at p = 0.5. */
export function binomTwoSided(k: number, n: number): number {
  if (n === 0) return 1;
  const kk = Math.min(k, n - k);
  let tail = 0;
  for (let i = 0; i <= kk; i++) tail += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}
/** McNemar's test on paired binary outcomes. b = A right & B wrong, c = A wrong & B right. Exact for small counts. */
export function mcnemar(b: number, c: number): { b: number; c: number; chi2: number; p: number; exact: boolean } {
  const n = b + c;
  if (n < 25) return { b, c, chi2: NaN, p: binomTwoSided(Math.min(b, c), n), exact: true };
  const chi2 = (Math.abs(b - c) - 1) ** 2 / n; // continuity-corrected, 1 df
  return { b, c, chi2, p: chiSq1Sf(chi2), exact: false };
}
/** Survival function of chi-square with 1 df: P(X > x) = erfc(sqrt(x/2)). */
export function chiSq1Sf(x: number) { return erfc(Math.sqrt(x / 2)); }
function erfc(x: number) { // Numerical Recipes erfc, rel. error < 1.2e-7
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

export interface Bin { lo: number; hi: number; n: number; meanConf: number; hitRate: number }
/** Reliability table + expected calibration error (weighted |confidence − accuracy|). */
export function reliability(pairs: { conf: number; hit: boolean }[], edges = [0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 1.0001]): { bins: Bin[]; ece: number } {
  const bins: Bin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const inBin = pairs.filter(p => p.conf >= edges[i] && p.conf < edges[i + 1]);
    if (!inBin.length) { bins.push({ lo: edges[i], hi: Math.min(1, edges[i + 1]), n: 0, meanConf: NaN, hitRate: NaN }); continue; }
    bins.push({ lo: edges[i], hi: Math.min(1, edges[i + 1]), n: inBin.length, meanConf: inBin.reduce((s, p) => s + p.conf, 0) / inBin.length, hitRate: inBin.filter(p => p.hit).length / inBin.length });
  }
  const N = pairs.length;
  const ece = bins.reduce((s, b) => s + (b.n ? (b.n / N) * Math.abs(b.meanConf - b.hitRate) : 0), 0);
  return { bins, ece };
}

export function percentile(xs: number[], q: number) { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
