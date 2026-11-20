// The statistics library checked against textbook values (so the analysis rests on verified math).
import { describe, it, expect } from 'vitest';
import { wilson, mcnemar, chiSqSf, tTwoSided, normalCdf, binomUpper, binomTwoSided, tTest, twoPropZ, wilcoxon, hosmerLemeshow, brier, nForProportion, reliability, bootstrap } from '../lib/stats';

describe('distributions match tables', () => {
  it('normal: Φ(1.96) = 0.975', () => expect(normalCdf(1.96)).toBeCloseTo(0.975, 3));
  it('normal: Φ(−1.645) = 0.05', () => expect(normalCdf(-1.645)).toBeCloseTo(0.05, 3));
  it('chi-square 1 df: P(X > 3.841) = 0.05', () => expect(chiSqSf(3.841, 1)).toBeCloseTo(0.05, 3));
  it('chi-square 10 df: P(X > 18.307) = 0.05', () => expect(chiSqSf(18.307, 10)).toBeCloseTo(0.05, 3));
  it('t 10 df: two-sided p at t = 2.228 is 0.05', () => expect(tTwoSided(2.228, 10)).toBeCloseTo(0.05, 3));
  it('t 30 df: two-sided p at t = 2.042 is 0.05', () => expect(tTwoSided(2.042, 30)).toBeCloseTo(0.05, 3));
  it('binomial: P(X ≥ 9 | 10, 0.5) = 11/1024', () => expect(binomUpper(9, 10, 0.5)).toBeCloseTo(11 / 1024, 6));
  it('binomial two-sided: 0 of 10 at p = .5 → 2/1024', () => expect(binomTwoSided(0, 10)).toBeCloseTo(2 / 1024, 6));
});

describe('tests and intervals', () => {
  it('Wilson 95% CI for 98/100 ≈ 93.0%–99.4%', () => { const w = wilson(98, 100); expect(w.lo).toBeCloseTo(0.930, 2); expect(w.hi).toBeCloseTo(0.994, 2); });
  it('McNemar b = 30, c = 10 → χ² = 9.025, p ≈ 0.0027', () => { const m = mcnemar(30, 10); expect(m.chi2).toBeCloseTo(9.025, 3); expect(m.p).toBeCloseTo(0.00266, 3); });
  it('one-sample t-test of a centred sample is not significant', () => expect(tTest([-1, 1, -2, 2, -0.5, 0.5]).p).toBeGreaterThan(0.9));
  it('two-proportion z: 60/100 vs 40/100 → p ≈ 0.0047', () => expect(twoPropZ(60, 100, 40, 100).p).toBeCloseTo(0.0047, 3));
  it('Wilcoxon on all-positive differences is significant', () => expect(wilcoxon(Array.from({ length: 30 }, (_, i) => i + 1)).p).toBeLessThan(0.001));
  it('perfectly calibrated predictions pass Hosmer–Lemeshow', () => {
    const pairs = Array.from({ length: 1000 }, (_, i) => { const conf = (i % 10 + 0.5) / 10; return { conf, hit: (i * 7919 % 1000) / 1000 < conf }; });
    expect(hosmerLemeshow(pairs).p).toBeGreaterThan(0.05);
    expect(reliability(pairs).ece).toBeLessThan(0.05);
  });
  it('Brier score of certain correct predictions is 0', () => expect(brier([{ conf: 1, hit: true }, { conf: 0, hit: false }])).toBe(0));
  it('sample size to tell 95% from 98% (α = .05, power .8) is a few hundred', () => { const n = nForProportion(0.95, 0.98); expect(n).toBeGreaterThan(200); expect(n).toBeLessThan(400); });
  it('bootstrap CI contains the estimate', () => { const b = bootstrap(Array.from({ length: 200 }, (_, i) => i % 2), r => r.reduce((s, x) => s + x, 0) / r.length); expect(b.lo).toBeLessThanOrEqual(b.estimate); expect(b.hi).toBeGreaterThanOrEqual(b.estimate); });
});
