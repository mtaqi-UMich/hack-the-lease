/* Deep statistical analysis of the adaptive onboarding engine (why ≤5 screens are enough).
 *   npx tsx scripts/analysis.ts          (N = 1000 simulated students)
 *   npx tsx scripts/analysis.ts 200      (quick run)
 * Writes reports/analysis.json and docs/ANALYSIS.md.
 *
 * Trick that keeps this cheap: the engine always asks the highest-information-gain question; τ and the screen cap only
 * decide WHEN to stop. So we record ONE uncapped trace per student (up to 8 screens, never stopping on confidence) and
 * derive every τ / cap policy, the per-screen trajectories and the hypothesis tests from it.
 * All students and listings are synthetic (Example data). */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  createEngine, mulberry32, sampleStudent, truthAnswer, evaluate, PRIOR, BOOL_ITEMS, STATIC_ORDER,
  type Answers, type Engine, type Question, type Student, type QItem, type Particle,
} from '../lib/engine';
import { LISTINGS, LANDLORDS } from '../lib/data';
import {
  wilson, mcnemar, reliability, hosmerLemeshow, brier, binomUpper, tTest, twoPropZ, wilcoxon, bootstrap, mean, sd,
  nForProportion, normalCdf, percentile,
} from '../lib/stats';

const N = Number(process.argv[2] ?? 1000);
const POOL = 2500, CAP = 5, TAU = 0.95, MAX_TRACE = 8;
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
const L = LISTINGS;

// never stop on confidence (τ > 1); the minimum-gain rule still applies, exactly as in production
const engTrace = createEngine({ listings: L, poolSize: POOL, tau: 1.01, maxScreens: MAX_TRACE });

function entropyOf(rank: { p: number }[]) { return -rank.reduce((s, r) => s + (r.p > 0 ? r.p * Math.log2(r.p) : 0), 0); }
function ess(pool: Particle[]) { const s = pool.reduce((a, p) => a + p.w, 0), s2 = pool.reduce((a, p) => a + p.w * p.w, 0); return s * s / s2; }

interface TraceStep { k: number; conf: number; H: number; top: number[]; next: string | null; expGain: number | null; alphaMed: number; cards: number; ess: number; ms: number; stoppedByGain: boolean }
function trace(e: Engine, truth: Student): TraceStep[] {
  let ans: Answers = {}; const out: TraceStep[] = [];
  for (let k = 0; k <= MAX_TRACE; k++) {
    const t = performance.now(); const st = e.step(ans); const ms = performance.now() - t;
    const pe = e.pointEstimate(ans, st.pool);
    out.push({ k, conf: st.conf, H: entropyOf(st.rank), top: st.rank.slice(0, 3).map(r => r.idx), next: st.next?.id ?? null, expGain: st.next?.gain ?? null, alphaMed: pe.alpha, cards: ans.cards ?? 0, ess: ess(st.pool), ms, stoppedByGain: st.done && !st.next });
    if (!st.next) break;
    ans = e.applyAnswer(ans, st.next, truthAnswer(st.next, truth));
  }
  return out;
}
function staticTrace(e: Engine, truth: Student): number[][] { // top-3 after k fixed-order screens, k = 0..5
  let ans: Answers = {}; const out: number[][] = [e.step(ans).rank.slice(0, 3).map(r => r.idx)];
  for (let i = 0; i < CAP; i++) {
    const id = STATIC_ORDER[i]; const st = e.step(ans);
    let q: Pick<Question, 'id' | 'threshold' | 'dollars' | 'items'> | undefined = st.cands.find(c => c.id === id);
    if (id === 'deal') q = { id: 'deal', items: BOOL_ITEMS.filter(it => ans[it.key] == null) as QItem[] };
    if (q) ans = e.applyAnswer(ans, q, truthAnswer(q, truth));
    out.push(e.step(ans).rank.slice(0, 3).map(r => r.idx));
  }
  return out;
}
/** stop index under a policy: first k with conf ≥ τ, or the cap, or the end of the trace (min-gain stop) */
function stopAt(tr: TraceStep[], tau: number, cap: number) { for (const s of tr) if (s.conf >= tau || s.k >= cap || s.next === null) return s; return tr[tr.length - 1]; }

// ---------- cohort ----------
const rng = mulberry32(4242); const truths: Student[] = []; let replaced = 0;
while (truths.length < N) { const s = sampleStudent(rng, {}).s; if (engTrace.bestListing(s, L) < 0) { replaced++; continue; } truths.push(s); }
log(`${N} students (${replaced} draws with no feasible listing replaced)`);

const rows = truths.map((t, i) => {
  const best = engTrace.bestListing(t, L);
  const tr = trace(engTrace, t);
  const stat = staticTrace(engTrace, t);
  if ((i + 1) % 100 === 0) log(`${i + 1}/${N}`);
  return { t, best, tr, stat };
});

// ---------- policy sweeps ----------
const TAUS = [0.8, 0.85, 0.9, 0.95, 0.97, 0.99];
const tauSweep = TAUS.map(tau => {
  const st = rows.map(r => ({ s: stopAt(r.tr, tau, CAP), best: r.best }));
  const hits = st.filter(x => x.s.top.includes(x.best)).length, top1 = st.filter(x => x.s.top[0] === x.best).length;
  return { tau, avgScreens: mean(st.map(x => x.s.k)), top3: wilson(hits, N), top1: top1 / N };
});
const capSweep = [1, 2, 3, 4, 5, 6, 7, 8].map(cap => {
  const st = rows.map(r => ({ s: stopAt(r.tr, TAU, cap), best: r.best }));
  const hits = st.filter(x => x.s.top.includes(x.best)).length;
  return { cap, avgScreens: mean(st.map(x => x.s.k)), top3: wilson(hits, N), top1: st.filter(x => x.s.top[0] === x.best).length / N };
});

// ---------- per-screen trajectory (no early stop) vs fixed order ----------
const trajectory = [0, 1, 2, 3, 4, 5].map(k => {
  const at = rows.map(r => r.tr[Math.min(k, r.tr.length - 1)]);
  return {
    k, meanEntropyBits: mean(at.map(s => s.H)), meanConf: mean(at.map(s => s.conf)),
    adaptiveTop3: at.filter((s, i) => s.top.includes(rows[i].best)).length / N,
    fixedTop3: rows.filter(r => r.stat[k].includes(r.best)).length / N,
  };
});

// ---------- which question gets asked where ----------
const QIDS = ['group', 'deal', 'budget', 'base', 'mode', 'card'];
const order = [0, 1, 2, 3, 4].map(pos => {
  const c: Record<string, number> = {}; let asked = 0;
  for (const r of rows) { const s = r.tr[pos]; if (s?.next) { c[s.next] = (c[s.next] ?? 0) + 1; asked++; } }
  return { screen: pos + 1, asked, share: Object.fromEntries(QIDS.map(q => [q, (c[q] ?? 0) / Math.max(1, asked)])) };
});
const distinctOrders = new Set(rows.map(r => r.tr.slice(0, CAP).map(s => s.next).filter(Boolean).join('>'))).size;

// ---------- information gain: predicted vs realized ----------
const gainPairs: { exp: number; real: number; q: string; k: number }[] = [];
for (const r of rows) for (let k = 0; k + 1 < r.tr.length && k < CAP; k++) { const s = r.tr[k]; if (s.expGain != null) gainPairs.push({ exp: s.expGain, real: s.H - r.tr[k + 1].H, q: s.next!, k: k + 1 }); }
const gainDiff = tTest(gainPairs.map(g => g.real - g.exp));
const corr = (() => { const x = gainPairs.map(g => g.exp), y = gainPairs.map(g => g.real); const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); })();
const gainByQuestion = QIDS.map(q => { const g = gainPairs.filter(p => p.q === q); return { q, n: g.length, expected: g.length ? mean(g.map(p => p.exp)) : null, realized: g.length ? mean(g.map(p => p.real)) : null }; });
const minGainShown = Math.min(...gainPairs.map(g => g.exp));

// ---------- main policy (production: τ = 0.95, cap 5) ----------
const prod = rows.map(r => { const s = stopAt(r.tr, TAU, CAP); return { r, s, hit: s.top.includes(r.best), hit1: s.top[0] === r.best, fixedHit: r.stat[Math.max(1, s.k)].includes(r.best) }; });
const hits = prod.filter(p => p.hit).length;
const H1 = { ...wilson(hits, N), pOneSidedVs95: binomUpper(hits, N, 0.95) };
const mcn = mcnemar(prod.filter(p => p.hit && !p.fixedHit).length, prod.filter(p => !p.hit && p.fixedHit).length);
const diffBoot = bootstrap(prod, rs => mean(rs.map(p => (p.hit ? 1 : 0) - (p.fixedHit ? 1 : 0))));
const calPairs = prod.flatMap(p => p.r.tr.slice(0, p.s.k + 1).map(s => ({ conf: s.conf, hit: s.top.includes(p.r.best) })));
const rel = reliability(calPairs);
const HL = hosmerLemeshow(calPairs);
const brierScore = brier(calPairs);
const brierRef = brier(calPairs.map(p => ({ conf: mean(calPairs.map(q => (q.hit ? 1 : 0))), hit: p.hit })));
const finalPairs = prod.map(p => ({ conf: p.s.conf, hit: p.hit }));

// ---------- value of time: do the trade-off cards learn α? ----------
const alphaRows = rows.filter(r => r.tr[r.tr.length - 1].cards >= 1).map(r => {
  const first = r.tr[0], last = r.tr[r.tr.length - 1];
  return { before: Math.abs(Math.log(first.alphaMed / r.t.alpha)), after: Math.abs(Math.log(last.alphaMed / r.t.alpha)), cards: last.cards };
});
const alphaTest = wilcoxon(alphaRows.map(a => a.before - a.after));
const alphaByCards = [1, 2, 3].map(c => { const g = alphaRows.filter(a => a.cards === c); return { cards: c, n: g.length, medianErrorFactorBefore: g.length ? Math.exp(percentile(g.map(a => a.before), 0.5)) : null, medianErrorFactorAfter: g.length ? Math.exp(percentile(g.map(a => a.after), 0.5)) : null }; });

// ---------- decision sensitivity (the decision function itself) ----------
type Pert = { name: string; f: (s: Student) => Student; meaningful: boolean };
const PERTS: Pert[] = [
  { name: 'Budget +$10 (trivial)', f: s => ({ ...s, budget: s.budget + 10 }), meaningful: false },
  { name: 'Value of time ×1.05 (trivial)', f: s => ({ ...s, alpha: s.alpha * 1.05 }), meaningful: false },
  { name: 'Budget −$250', f: s => ({ ...s, budget: s.budget - 250 }), meaningful: true },
  { name: 'Budget +$250', f: s => ({ ...s, budget: s.budget + 250 }), meaningful: true },
  { name: 'Campus Central ↔ North', f: s => ({ ...s, base: s.base === 'North' ? 'Central' : 'North' }), meaningful: true },
  { name: 'Walk ↔ bus', f: s => ({ ...s, mode: s.mode === 'walk' ? 'bus' : 'walk' }), meaningful: true },
  { name: 'In-unit laundry toggled', f: s => ({ ...s, laundry: !s.laundry }), meaningful: true },
  { name: 'Value of time ×2', f: s => ({ ...s, alpha: s.alpha * 2 }), meaningful: true },
];
const sensitivity = PERTS.map(pt => {
  let flips = 0, n = 0;
  for (const r of rows) { const b2 = engTrace.bestListing(pt.f(r.t), L); if (b2 < 0) continue; n++; if (b2 !== r.best) flips++; }
  return { name: pt.name, meaningful: pt.meaningful, n, flips, rate: flips / n };
});
const triv = sensitivity.filter(s => !s.meaningful), mean250 = sensitivity.find(s => s.name === 'Budget −$250')!;
const sensTest = twoPropZ(mean250.flips, mean250.n, triv[0].flips, triv[0].n);

// ---------- what drives the #1 pick: utility decomposition ----------
const decomp = rows.map(r => evaluate(r.t, L[r.best])!).filter(Boolean);
const utilityShares = (() => { const a = decomp.map(e => [e.cost, e.timeCost, e.qualityValue, Math.max(0, e.bonus - e.qualityValue), 4 * e.over]); const tot = a.map(v => v.reduce((s, x) => s + Math.abs(x), 0)); const share = (i: number) => mean(a.map((v, j) => Math.abs(v[i]) / tot[j])); return { rent: share(0), commuteTime: share(1), quality: share(2), extras: share(3), overBudgetPenalty: share(4) }; })();

// ---------- neutrality: who wins #1, by landlord ----------
const inv: Record<string, number> = {}; L.forEach(l => inv[l.landlord_id] = (inv[l.landlord_id] ?? 0) + 1);
const wins: Record<string, number> = {}; rows.forEach(r => { const id = L[r.best].landlord_id; wins[id] = (wins[id] ?? 0) + 1; });
const landlordTable = LANDLORDS.map(ll => ({ landlord: ll.name, inventoryShare: (inv[ll.id] ?? 0) / L.length, top1Share: (wins[ll.id] ?? 0) / N }));
const shuffled = (() => { // permutation check: swap landlord labels at random → rankings unchanged (landlord is not an input)
  const r2 = mulberry32(5); const ids = L.map(l => l.landlord_id).sort(() => r2() - 0.5); const L2 = L.map((l, i) => ({ ...l, landlord_id: ids[i] }));
  return rows.filter(r => engTrace.bestListing(r.t, L2) !== r.best).length;
})();

// ---------- Monte Carlo error vs particle count ----------
const states = rows.slice(0, 25).map(r => { let a: Answers = {}; for (const s of r.tr.slice(0, Math.min(3, r.tr.length - 1))) { const st = engTrace.step(a); if (!st.next) break; a = engTrace.applyAnswer(a, st.next, truthAnswer(st.next, r.t)); } return a; });
const SIZES = [250, 500, 1000, 2500, 5000];
const mc = SIZES.map(size => {
  const sds: number[] = [], top1Agree: number[] = []; let ms = 0, runs = 0;
  const refEng = createEngine({ listings: L, poolSize: 20000, tau: 1.01, maxScreens: 99, seed: 999 });
  for (const a of states) {
    const ref = refEng.step(a).rank[0].idx;
    const confs: number[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const e = createEngine({ listings: L, poolSize: size, tau: 1.01, maxScreens: 99, seed });
      const t = performance.now(); const st = e.step(a); ms += performance.now() - t; runs++;
      confs.push(st.conf); top1Agree.push(st.rank[0].idx === ref ? 1 : 0);
    }
    sds.push(sd(confs));
  }
  return { particles: size, sdOfConfidence: mean(sds), top1AgreesWithReference: mean(top1Agree), msPerStep: ms / runs };
});
const slope = (() => { const x = mc.map(m => Math.log(m.particles)), y = mc.map(m => Math.log(m.sdOfConfidence)); const mx = mean(x), my = mean(y); let n = 0, d = 0; for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); d += (x[i] - mx) ** 2; } return n / d; })();
log('Monte Carlo convergence done');

// ---------- engineering ----------
const stepMs = rows.flatMap(r => r.tr.map(s => s.ms));
const essFinal = prod.map(p => p.s.ess);
const power = { nNeeded_95vs98: nForProportion(0.95, 0.98), achievedPower: (() => { const p0 = 0.95, p1 = H1.p, se0 = Math.sqrt(p0 * (1 - p0) / N), se1 = Math.sqrt(p1 * (1 - p1) / N); return normalCdf((p1 - p0 - 1.6449 * se0) / se1); })() };
const initialEntropy = mean(rows.map(r => r.tr[0].H));

const report = {
  generated_at: new Date().toISOString(), n: N, particles: POOL, tau: TAU, cap: CAP, listings: L.length, example_data: true,
  prior: PRIOR,
  H1, mcnemar: mcn, diffBootstrap: diffBoot, avgScreens: mean(prod.map(p => p.s.k)), top1: prod.filter(p => p.hit1).length / N,
  tauSweep, capSweep, trajectory, order, distinctOrders, initialEntropy,
  gain: { pairs: gainPairs.length, meanExpected: mean(gainPairs.map(g => g.exp)), meanRealized: mean(gainPairs.map(g => g.real)), diffTest: gainDiff, correlation: corr, byQuestion: gainByQuestion, minGainShown },
  calibration: { ece: rel.ece, bins: rel.bins, hosmerLemeshow: HL, brier: brierScore, brierBaseline: brierRef, brierSkill: 1 - brierScore / brierRef, final: reliability(finalPairs) },
  alpha: { n: alphaRows.length, test: alphaTest, medianErrorFactorBefore: Math.exp(percentile(alphaRows.map(a => a.before), 0.5)), medianErrorFactorAfter: Math.exp(percentile(alphaRows.map(a => a.after), 0.5)), byCards: alphaByCards },
  sensitivity, sensitivityTest: sensTest, utilityShares, landlordTable, landlordPermutationChanges: shuffled,
  monteCarlo: mc, mcSlope: slope,
  engineering: { stepMsP50: percentile(stepMs, 0.5), stepMsP95: percentile(stepMs, 0.95), essMean: mean(essFinal), essMin: Math.min(...essFinal), essShare: mean(essFinal) / POOL },
  power, runtime_s: (Date.now() - t0) / 1000,
};
mkdirSync('reports', { recursive: true });
writeFileSync('reports/analysis.json', JSON.stringify(report, null, 2));

// ---------- markdown ----------
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const pv = (p: number) => p < 1e-15 ? '< 1e-15' : p < 1e-4 ? p.toExponential(1) : p.toFixed(4);
const md = `# Statistical analysis — why ≤ 5 adaptive screens find your place

_Generated ${report.generated_at} by \`scripts/analysis.ts\` · ${N} simulated students · ${L.length} Example listings · ${POOL} particles · τ = ${TAU} · cap ${CAP} screens._
**Everything here is synthetic (Example data).** It shows the algorithm reliably finds what *our model* says is best; it does not show the model matches real students (that needs the survey + hallway test).

## 1. The model in one page

**Student (hidden).** A small Bayesian network: campus → commute mode → needs parking; budget ~ truncated Normal($${PRIOR.budget.mean}, $${PRIOR.budget.sd}); value of time α ~ LogNormal(median $${PRIOR.alpha.median}/h, σ = ${PRIOR.alpha.logSd}); group size, laundry, pets, AC, quiet and lease flexibility as independent Bernoullis.

**Utility of listing j for student s** (dollars per person per month, higher is better):

\`u(s, j) = −cost − α · commuteHours + 0.3 · budget · quality + AC/quiet bonuses − 4 · max(0, cost − budget)\`

after hard filters (size, parking, laundry, pets, lease start). The student's "true best" is \`argmax_j u(s, j)\` — the answer a 17-screen form with perfect information would give.

**Belief.** We keep ${POOL} sampled students (particles). Each answer is evidence: answered nodes are fixed and each particle is re-weighted by the likelihood of the answer given its sampled parents (likelihood weighting, e.g. weight × P(mode | campus)). Then

\`P(best = j | answers) = Σᵢ wᵢ · 1[bestᵢ = j] / Σᵢ wᵢ\`

**Which question next.** The one with the largest expected information gain about which listing is best:

\`gain(q) = H(best) − Σₐ P(a) · H(best | a)\`, with \`H = −Σ p log₂ p\`.

Questions under 0.03 bits are never shown; dealbreaker items that are ≥ 95% predictable are assumed instead (shown as editable chips).

**Trade-off cards.** Each card offers "$X more per month to save 10 minutes each way", where X is set at the current *posterior median* of α — so every answer halves the remaining probability mass on α (binary search).

**When to stop.** As soon as P(true best ∈ our top 3) ≥ τ = ${TAU}, or after ${CAP} required screens. That probability is the confidence meter on screen.

## 2. Headline results (production policy: τ = ${TAU}, cap ${CAP})

| | Result |
|---|---|
| True best in our top 3 | **${pct(H1.p)}** (Wilson 95% CI ${pct(H1.lo)}–${pct(H1.hi)}) |
| Exact one-sided binomial test, H0: accuracy ≤ 95% | p = ${pv(H1.pOneSidedVs95)} → ${H1.pOneSidedVs95 < 0.05 ? 'reject H0' : 'cannot reject H0'} |
| True best is our #1 | ${pct(report.top1)} |
| Screens used | ${report.avgScreens.toFixed(2)} on average (cap 5; Apartment List uses 17) |
| Adaptive vs fixed order, same screens | McNemar b = ${mcn.b}, c = ${mcn.c}, p = ${pv(mcn.p)}; paired difference ${pct(diffBoot.estimate)} (bootstrap 95% CI ${pct(diffBoot.lo)}–${pct(diffBoot.hi)}) |
| Power | n = ${power.nNeeded_95vs98} students would detect 98% vs 95% at α = .05, power .8; we ran ${N} (achieved power ≈ ${pct(power.achievedPower, 0)}) |

## 3. Why 5 screens are enough: uncertainty falls fast

Starting uncertainty about which of ${L.length} listings is best: **${initialEntropy.toFixed(2)} bits** (≈ ${Math.round(2 ** initialEntropy)} equally likely candidates).

| After screen | Mean entropy (bits) | Mean confidence | Adaptive top-3 hit | Fixed-order top-3 hit |
|---|---|---|---|---|
${trajectory.map(t => `| ${t.k} | ${t.meanEntropyBits.toFixed(2)} | ${pct(t.meanConf)} | ${pct(t.adaptiveTop3)} | ${pct(t.fixedTop3)} |`).join('\n')}

Each screen removes on average ${(report.gain.meanRealized).toFixed(2)} bits. By screen 3 the remaining uncertainty is about ${trajectory[3].meanEntropyBits.toFixed(1)} bits — a handful of candidates, which is why a **top 3** is the right thing to show.

### Does the engine's predicted gain come true?
Over ${gainPairs.length} screens: predicted ${report.gain.meanExpected.toFixed(3)} bits, realized ${report.gain.meanRealized.toFixed(3)} bits per screen; correlation r = ${corr.toFixed(2)}. Paired t-test of (realized − predicted): mean ${gainDiff.mean.toFixed(3)}, t = ${gainDiff.t.toFixed(2)}, p = ${pv(gainDiff.p)}. ${Math.abs(gainDiff.mean) < 0.1 ? 'The forecasts are close to unbiased' : 'The forecast is biased'} — the engine knows how much each question will help before asking it. The smallest gain ever shown was ${minGainShown.toFixed(3)} bits (threshold 0.03).

| Question | Times asked | Predicted gain | Realized gain |
|---|---|---|---|
${gainByQuestion.filter(g => g.n).map(g => `| ${g.q} | ${g.n} | ${g.expected!.toFixed(2)} | ${g.realized!.toFixed(2)} |`).join('\n')}

### The order adapts to the student
${distinctOrders} different question orders were used across ${N} students.

| Screen | ${QIDS.join(' | ')} |
|---|${QIDS.map(() => '---').join('|')}|
${order.map(o => `| ${o.screen} (n=${o.asked}) | ${QIDS.map(q => pct(o.share[q], 0)).join(' | ')} |`).join('\n')}

## 4. Choosing τ and the screen cap

| τ | Avg screens | Top-3 hit (95% CI) | Top-1 |
|---|---|---|---|
${tauSweep.map(t => `| ${t.tau} | ${t.avgScreens.toFixed(2)} | ${pct(t.top3.p)} (${pct(t.top3.lo)}–${pct(t.top3.hi)}) | ${pct(t.top1)} |`).join('\n')}

| Cap (τ = ${TAU}) | Avg screens | Top-3 hit | Top-1 |
|---|---|---|---|
${capSweep.map(c => `| ${c.cap} | ${c.avgScreens.toFixed(2)} | ${pct(c.top3.p)} | ${pct(c.top1)} |`).join('\n')}

τ = 0.95 with a cap of 5 sits at the knee: tighter τ costs extra taps for little accuracy; a cap above 5 is almost never reached.

## 5. Is the confidence meter honest?

| Meter shows | Screens | Mean shown | Actually right |
|---|---|---|---|
${rel.bins.filter(b => b.n).map(b => `| ${pct(b.lo, 0)}–${pct(b.hi, 0)} | ${b.n} | ${pct(b.meanConf)} | ${pct(b.hitRate)} |`).join('\n')}

- Expected calibration error: **${(rel.ece * 100).toFixed(1)} points** (bar ≤ 5).
- Hosmer–Lemeshow: χ² = ${HL.chi2.toFixed(1)}, df = ${HL.df}, p = ${pv(HL.p)} (H0: calibrated). ${HL.p < 0.05 ? `With ${calPairs.length.toLocaleString('en-US')} screens the test detects even small gaps: every bin above is within ${(Math.max(...rel.bins.filter(b => b.n).map(b => Math.abs(b.meanConf - b.hitRate))) * 100).toFixed(1)} points of reality, and the ECE (${(rel.ece * 100).toFixed(1)} points) measures how large the miscalibration actually is. We report the rejection rather than hide it.` : 'No evidence of miscalibration.'}
- Brier score ${brierScore.toFixed(3)} vs ${brierRef.toFixed(3)} for a constant forecast → skill ${pct(report.calibration.brierSkill)}.

## 6. Do the trade-off cards learn what your time is worth?
For ${alphaRows.length} students who saw at least one card, the median error in α (as a factor) went from **×${report.alpha.medianErrorFactorBefore.toFixed(2)}** before the cards to **×${report.alpha.medianErrorFactorAfter.toFixed(2)}** after. Wilcoxon signed-rank: z = ${alphaTest.z.toFixed(2)}, p = ${pv(alphaTest.p)}.

| Cards seen | Students | Median error before | Median error after |
|---|---|---|---|
${alphaByCards.filter(a => a.n).map(a => `| ${a.cards} | ${a.n} | ×${a.medianErrorFactorBefore!.toFixed(2)} | ×${a.medianErrorFactorAfter!.toFixed(2)} |`).join('\n')}

## 7. Decision sensitivity: big changes move the pick, tiny ones don't

| Change to the student | Students | #1 pick changed |
|---|---|---|
${sensitivity.map(s => `| ${s.name} | ${s.n} | ${pct(s.rate)} |`).join('\n')}

Budget −$250 vs budget +$10: two-proportion z = ${sensTest.z.toFixed(1)}, p = ${pv(sensTest.p)}. The recommendation responds to real changes in how a student lives and is stable under noise.

**What drives the #1 pick** (average share of the score): rent ${pct(utilityShares.rent, 0)}, commute time ${pct(utilityShares.commuteTime, 0)}, quality ${pct(utilityShares.quality, 0)}, extras ${pct(utilityShares.extras, 0)}, over-budget penalty ${pct(utilityShares.overBudgetPenalty, 0)}.

## 8. Neutral marketplace
Landlord is not an input to the engine. Randomly permuting landlord labels across all ${L.length} listings changed **${shuffled} of ${N}** #1 picks.

| Landlord (fictional) | Share of listings | Share of #1 picks |
|---|---|---|
${landlordTable.map(l => `| ${l.landlord} | ${pct(l.inventoryShare)} | ${pct(l.top1Share)} |`).join('\n')}

Differences come from location, price and features, not from who the landlord is.

## 9. Engineering: is ${POOL} particles enough, and is it fast?

| Particles | SD of confidence across seeds | #1 agrees with a 20,000-particle reference | ms per step |
|---|---|---|---|
${mc.map(m => `| ${m.particles} | ${(m.sdOfConfidence * 100).toFixed(2)} pts | ${pct(m.top1AgreesWithReference)} | ${m.msPerStep.toFixed(1)} |`).join('\n')}

Monte Carlo error falls as particles^${slope.toFixed(2)} (theory: −0.5). At ${POOL} particles the confidence meter wobbles by about ${(mc.find(m => m.particles === POOL)!.sdOfConfidence * 100).toFixed(1)} points between seeds, and we fix the seed so judges see the same answer twice.

- One engine step: p50 ${report.engineering.stepMsP50.toFixed(1)} ms, p95 ${report.engineering.stepMsP95.toFixed(1)} ms (server).
- Effective sample size after likelihood weighting: mean ${report.engineering.essMean.toFixed(0)} of ${POOL} (${pct(report.engineering.essShare, 0)}), minimum ${report.engineering.essMin.toFixed(0)} — the weights never collapse, so the posterior stays well estimated.

## 10. Assumptions and limits
- Priors (campus mix, budgets, value of time, amenity rates) are invented. Robustness runs in \`reports/validation.md\` shift them ±20% and still reach 97–99% top-3; 10% wrong answers drops it to ~83%.
- "True best" is defined by our utility function; if real students weigh things differently, accuracy against *their* choices will be lower. Next: a ~100-student survey and a 15-minute hallway test.
- Commute uses a synthetic timetable stand-in (Estimated), not TheRide GTFS.

_Runtime ${report.runtime_s.toFixed(0)} s. Reproduce: \`npx tsx scripts/analysis.ts\`._
`;
mkdirSync('docs', { recursive: true });
writeFileSync('docs/ANALYSIS.md', md);
log(`done: H1 ${pct(H1.p)} p(vs95)=${pv(H1.pOneSidedVs95)} | gain r=${corr.toFixed(2)} | ECE ${(rel.ece * 100).toFixed(1)} | alpha p=${pv(alphaTest.p)} | mc slope ${slope.toFixed(2)}`);
