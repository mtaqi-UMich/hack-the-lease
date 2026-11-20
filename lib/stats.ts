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

// ---------- distributions (Numerical Recipes-style special functions) ----------
function gammaln(x: number) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x; const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5); let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
/** Regularized lower incomplete gamma P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + a * Math.log(x) - gammaln(a)); }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}
/** P(X > x) for chi-square with df degrees of freedom. */
export function chiSqSf(x: number, df: number) { return x <= 0 ? 1 : 1 - gammaP(df / 2, x / 2); }
function betacf(a: number, b: number, x: number) {
  const qab = a + b, qap = a + 1, qam = a - 1; let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d; let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300; c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}
/** Regularized incomplete beta I_x(a, b). */
export function betaI(a: number, b: number, x: number) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
/** Two-sided p-value of Student's t with df degrees of freedom. */
export function tTwoSided(t: number, df: number) { return betaI(df / 2, 0.5, df / (df + t * t)); }
export function normalCdf(z: number) { return 1 - 0.5 * erfcPublic(z / Math.SQRT2); }
function erfcPublic(x: number) { return chiSq1Sf(x * x * 2) * (x >= 0 ? 1 : -1) + (x >= 0 ? 0 : 2); }

/** One-sided exact binomial test: P(X ≥ k | n, p0). */
export function binomUpper(k: number, n: number, p0: number) {
  let s = 0;
  for (let i = k; i <= n; i++) s += Math.exp(logChoose(n, i) + i * Math.log(p0) + (n - i) * Math.log(1 - p0));
  return Math.min(1, s);
}
export function mean(xs: number[]) { return xs.reduce((s, x) => s + x, 0) / xs.length; }
export function sd(xs: number[]) { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); }
/** Paired / one-sample t-test of mean(xs) = mu. */
export function tTest(xs: number[], mu = 0) { const n = xs.length, m = mean(xs), s = sd(xs); const t = (m - mu) / (s / Math.sqrt(n)); return { n, mean: m, sd: s, t, df: n - 1, p: tTwoSided(t, n - 1) }; }
/** Two-proportion z-test (pooled), two-sided. */
export function twoPropZ(x1: number, n1: number, x2: number, n2: number) {
  const p1 = x1 / n1, p2 = x2 / n2, p = (x1 + x2) / (n1 + n2); const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  const z = (p1 - p2) / se; return { p1, p2, z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}
/** Wilcoxon signed-rank test (normal approximation with tie/zero handling), two-sided. */
export function wilcoxon(diffs: number[]) {
  const d = diffs.filter(x => x !== 0); const n = d.length;
  const ranked = d.map(x => ({ x, a: Math.abs(x) })).sort((p, q) => p.a - q.a);
  const ranks: number[] = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && ranked[j + 1].a === ranked[i].a) j++; const r = (i + j + 2) / 2; for (let k = i; k <= j; k++) ranks[k] = r; i = j + 1; }
  const wPlus = ranked.reduce((s, r, i) => s + (r.x > 0 ? ranks[i] : 0), 0);
  const mu = n * (n + 1) / 4, sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24); const z = (wPlus - mu) / sigma;
  return { n, wPlus, z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}
/** Percentile bootstrap CI of a statistic over paired rows. */
export function bootstrap<T>(rows: T[], stat: (r: T[]) => number, B = 2000, seed = 7, alpha = 0.05) {
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const vals: number[] = [];
  for (let b = 0; b < B; b++) { const sample = Array.from({ length: rows.length }, () => rows[Math.floor(rnd() * rows.length)]); vals.push(stat(sample)); }
  vals.sort((a, b) => a - b);
  return { estimate: stat(rows), lo: vals[Math.floor(B * alpha / 2)], hi: vals[Math.floor(B * (1 - alpha / 2)) - 1] };
}
/** Hosmer–Lemeshow goodness-of-fit over reliability bins (H0: calibrated). df = bins − 2. */
export function hosmerLemeshow(pairs: { conf: number; hit: boolean }[], groups = 10) {
  const s = [...pairs].sort((a, b) => a.conf - b.conf); const size = Math.ceil(s.length / groups); let chi = 0, used = 0;
  for (let g = 0; g < groups; g++) {
    const grp = s.slice(g * size, (g + 1) * size); if (!grp.length) continue;
    const obs = grp.filter(p => p.hit).length, exp = grp.reduce((a, p) => a + p.conf, 0), n = grp.length;
    const pbar = exp / n; if (pbar <= 0 || pbar >= 1) { used++; continue; }
    chi += (obs - exp) ** 2 / (n * pbar * (1 - pbar)); used++;
  }
  const df = Math.max(1, used - 2); return { chi2: chi, df, p: chiSqSf(chi, df) };
}
/** Brier score of probabilistic predictions. */
export function brier(pairs: { conf: number; hit: boolean }[]) { return mean(pairs.map(p => (p.conf - (p.hit ? 1 : 0)) ** 2)); }
/** Sample size for a one-sided one-sample proportion test (normal approx). */
export function nForProportion(p0: number, p1: number, alpha = 0.05, power = 0.8) {
  const za = 1.6449, zb = power === 0.9 ? 1.2816 : 0.8416;
  return Math.ceil(((za * Math.sqrt(p0 * (1 - p0)) + zb * Math.sqrt(p1 * (1 - p1))) / (p1 - p0)) ** 2);
}
