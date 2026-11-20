/* 1,000-student validation of the adaptive onboarding on the app's 120 Example listings.
 *   npm run simulate            (N=1000)
 *   npm run simulate -- 200     (quick run)
 * Writes reports/validation.json and reports/validation.md.
 * Claims (PRD "Testing and statistical validation"):
 *   H1 full-information best is in our top 3 after ≤5 required screens — Wilson 95% CI, pass if ≥ 95%
 *   H2 up to 3 optional questions raise top-1 without lowering top-3
 *   H3 adaptive order beats a fixed order at the same number of screens — McNemar, p < 0.05
 *   H4 the confidence meter is calibrated — reliability table, ECE ≤ 5 points
 *   Robustness: priors ±20%, 10% wrong answers, a different student population
 * Simulations show the algorithm finds what OUR MODEL says is best; they do not show the model matches real students. */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  createEngine, mulberry32, sampleStudent, truthAnswer, runStatic, PRIOR,
  type Answers, type Engine, type Prior, type Question, type Student,
} from '../lib/engine';
import { LISTINGS } from '../lib/data';
import { wilson, mcnemar, reliability } from '../lib/stats';
import { MAX_SCREENS, TAU, SHARPEN, type Profile } from '../lib/session';
import { topAndBench, buildCards } from '../lib/compare';

const N = Number(process.argv[2] ?? 1000);
const NR = Math.max(100, Math.round(N * 0.3)); // robustness sample size
const POOL = 2500;
const t0 = Date.now();
const log = (s: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);

const eng = createEngine({ listings: LISTINGS, poolSize: POOL, tau: TAU, maxScreens: MAX_SCREENS });
const engSharp = createEngine({ listings: LISTINGS, poolSize: POOL, tau: SHARPEN.tau, maxScreens: MAX_SCREENS + SHARPEN.extra });
const L = eng.listings;

type AnswerFn = (q: Pick<Question, 'id' | 'threshold' | 'items'>, t: Student) => unknown;
function noisy(rate: number, seed: number): AnswerFn {
  const r = mulberry32(seed);
  return (q, t) => {
    const a = truthAnswer(q, t);
    if (r() >= rate) return a;
    if (q.id === 'base') return (['Central', 'North', 'Medical', 'Split'] as const).filter(x => x !== a)[Math.floor(r() * 3)];
    if (q.id === 'mode') return (['walk', 'bus', 'bike', 'drive'] as const).filter(x => x !== a)[Math.floor(r() * 3)];
    if (q.id === 'group') return String(Math.max(1, Math.min(5, t.group + (r() < 0.5 ? -1 : 1))));
    if (q.id === 'budget') return Math.round((t.budget * (r() < 0.5 ? 0.8 : 1.2)) / 25) * 25;
    if (q.id === 'card') return a === 'yes' ? 'no' : 'yes';
    if (q.id === 'deal') { const v = { ...(a as Record<string, boolean>) }; const ks = Object.keys(v); if (ks.length) { const k = ks[Math.floor(r() * ks.length)]; v[k] = !v[k]; } return v; }
    return a;
  };
}

function run(e: Engine, truth: Student, answerFn: AnswerFn = truthAnswer, from: Answers = {}) {
  let ans = from, st = e.step(ans);
  const trace: { conf: number; top3: number[] }[] = [{ conf: st.conf, top3: st.rank.slice(0, 3).map(r => r.idx) }];
  let guard = 0;
  while (!st.done && guard++ < 12) { ans = e.applyAnswer(ans, st.next!, answerFn(st.next!, truth)); st = e.step(ans); trace.push({ conf: st.conf, top3: st.rank.slice(0, 3).map(r => r.idx) }); }
  return { ans, st, clicks: (ans._asked ?? []).length, trace };
}

function shiftedPrior(f: number): Prior {
  return {
    ...PRIOR,
    budget: { ...PRIOR.budget, mean: PRIOR.budget.mean * f },
    alpha: { ...PRIOR.alpha, median: PRIOR.alpha.median * f },
    base: f > 1 ? { Central: 0.4, North: 0.35, Medical: 0.1, Split: 0.15 } : { Central: 0.6, North: 0.15, Medical: 0.1, Split: 0.15 },
    laundry: Math.min(0.95, PRIOR.laundry * f), ac: Math.min(0.95, PRIOR.ac * f), quiet: Math.min(0.95, PRIOR.quiet * f),
  };
}

function cohort(n: number, seed: number, prior: Prior = PRIOR, filter?: (s: Student) => boolean) {
  const r = mulberry32(seed); const out: Student[] = []; let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const s = sampleStudent(r, {}, prior).s;
    if (filter && !filter(s)) continue;
    if (eng.bestListing(s, L) < 0) continue; // nothing fits this student even with full information — reported separately
    out.push(s);
  }
  return out;
}

// ---------- main cohort: H1–H4 ----------
const truths = cohort(N, 4242);
let noFit = 0; { const r = mulberry32(4242); for (let i = 0; i < N; i++) if (eng.bestListing(sampleStudent(r, {}).s, L) < 0) noFit++; }
log(`main cohort: ${truths.length} students (${noFit} of the first ${N} draws had no feasible listing and were replaced)`);
const rows: { top1: boolean; top3: boolean; clicks: number; conf: number; s1: boolean; s3: boolean; s5_3: boolean; o1: boolean; o3: boolean; oclicks: number }[] = [];
const calib: { conf: number; hit: boolean }[] = [];
truths.forEach((t, i) => {
  const best = eng.bestListing(t, L);
  const a = run(eng, t);
  const top = a.st.rank.map(r => r.idx);
  for (const tr of a.trace) calib.push({ conf: tr.conf, hit: tr.top3.includes(best) });
  const s = runStatic(eng, t, Math.max(1, a.clicks)); const ts = s.st.rank.map(r => r.idx);
  const s5 = runStatic(eng, t, MAX_SCREENS); const ts5 = s5.st.rank.map(r => r.idx);
  const o = run(engSharp, t, truthAnswer, a.ans); const to = o.st.rank.map(r => r.idx);
  rows.push({ top1: top[0] === best, top3: top.slice(0, 3).includes(best), clicks: a.clicks, conf: a.st.conf, s1: ts[0] === best, s3: ts.slice(0, 3).includes(best), s5_3: ts5.slice(0, 3).includes(best), o1: to[0] === best, o3: to.slice(0, 3).includes(best), oclicks: o.clicks - a.clicks });
  if ((i + 1) % 100 === 0) log(`${i + 1}/${truths.length}`);
});
const count = (f: (r: typeof rows[number]) => boolean) => rows.filter(f).length;
const n = rows.length;
const H1 = wilson(count(r => r.top3), n);
const top1 = wilson(count(r => r.top1), n);
const opt1 = wilson(count(r => r.o1), n), opt3 = wilson(count(r => r.o3), n);
const H2b = mcnemar(count(r => r.o1 && !r.top1), count(r => !r.o1 && r.top1));
const H3 = mcnemar(count(r => r.top3 && !r.s3), count(r => !r.top3 && r.s3));
const static3 = wilson(count(r => r.s3), n), static1 = wilson(count(r => r.s1), n), static5 = wilson(count(r => r.s5_3), n);
const H4 = reliability(calib);
const finalCal = reliability(rows.map(r => ({ conf: r.conf, hit: r.top3 })));
const avgClicks = rows.reduce((s, r) => s + r.clicks, 0) / n;
const clickHist: Record<number, number> = {}; rows.forEach(r => clickHist[r.clicks] = (clickHist[r.clicks] ?? 0) + 1);
const avgOpt = rows.reduce((s, r) => s + r.oclicks, 0) / n;

// ---------- robustness ----------
function robust(name: string, students: Student[], answerFn: AnswerFn = truthAnswer) {
  let hit3 = 0, hit1 = 0;
  for (const t of students) { const best = eng.bestListing(t, L); const a = run(eng, t, answerFn); const top = a.st.rank.map(r => r.idx); if (top.slice(0, 3).includes(best)) hit3++; if (top[0] === best) hit1++; }
  const w = wilson(hit3, students.length);
  log(`robustness ${name}: top-3 ${(w.p * 100).toFixed(1)}%`);
  return { name, n: students.length, top3: w, top1: hit1 / students.length };
}
const robustness = [
  robust('Priors +20% (students richer, value time more, more North)', cohort(NR, 11, shiftedPrior(1.2))),
  robust('Priors −20% (students poorer, value time less, more Central)', cohort(NR, 12, shiftedPrior(0.8))),
  robust('10% of answers wrong', cohort(NR, 13), noisy(0.1, 99)),
  robust('Different population: North Campus only', cohort(NR, 14, PRIOR, s => s.base === 'North')),
  robust('Different population: drivers only', cohort(NR, 15, PRIOR, s => s.mode === 'drive')),
];

// ---------- what-if sensitivity table ----------
const BASE: Profile = { living: 'friend', base: 'Central', mode: 'bus', budget: 1150, deal: { laundry: false, pet: false, parking: false }, asked: ['group', 'base', 'mode', 'budget', 'deal'] };
const variants: { label: string; p: Profile }[] = [
  { label: 'Baseline: 2 people, Central, bus, $1,150', p: BASE },
  { label: 'Budget $1,000', p: { ...BASE, budget: 1000 } },
  { label: 'Budget $1,800', p: { ...BASE, budget: 1800 } },
  { label: 'Classes on North Campus', p: { ...BASE, base: 'North' } },
  { label: 'Classes on Medical Campus', p: { ...BASE, base: 'Medical' } },
  { label: 'Walks instead of bus', p: { ...BASE, mode: 'walk' } },
  { label: 'In-unit laundry is a must', p: { ...BASE, deal: { ...BASE.deal, laundry: true } } },
  { label: 'Values time highly (≥ $40/h)', p: { ...BASE, alphaLo: 40 } },
  { label: 'Match me with roommates', p: { ...BASE, living: 'match' } },
];
const whatIf = variants.map(v => {
  const tb = topAndBench(v.p); const c = buildCards(tb.shown, v.p);
  return { label: v.label, top: c.map(x => ({ id: x.id, short: x.short, name: x.name, total: x.total, minutes: x.commute.minutes, mode: x.commute.label })) };
});
log('what-if table done');

// ---------- write ----------
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ci = (w: { p: number; lo: number; hi: number }) => `${pct(w.p)} (95% CI ${pct(w.lo)}–${pct(w.hi)})`;
const report = {
  generated_at: new Date().toISOString(), n, pool: POOL, tau: TAU, max_screens: MAX_SCREENS, listings: L.length, example_data: true,
  H1: { claim: 'Full-information best is in our top 3 after ≤5 required screens', top3: H1, pass: H1.p >= 0.95, bar: '≥ 95%', top1, avg_clicks: avgClicks, click_hist: clickHist },
  H2: { claim: 'Up to 3 optional questions raise top-1 without lowering top-3', top1_before: top1, top1_after: opt1, top3_before: H1, top3_after: opt3, avg_optional_clicks: avgOpt, mcnemar_top1: H2b, pass: opt1.p > top1.p && opt3.p >= H1.p - 0.005 },
  H3: { claim: 'Adaptive order beats a fixed order with the same number of screens', adaptive_top3: H1, fixed_top3_same_clicks: static3, fixed_top1_same_clicks: static1, fixed_top3_5_screens: static5, mcnemar: H3, pass: H3.p < 0.05 && H1.p > static3.p },
  H4: { claim: 'Confidence meter is calibrated', all_steps: H4, final_screen: finalCal, ece_points: H4.ece * 100, pass: H4.ece <= 0.05 },
  robustness, whatIf, runtime_s: (Date.now() - t0) / 1000,
};
mkdirSync('reports', { recursive: true });
writeFileSync('reports/validation.json', JSON.stringify(report, null, 2));

const md = `# Validation report — Hack the Lease adaptive onboarding

_Generated ${report.generated_at} · ${n} simulated students · ${L.length} Example listings · ${POOL} particles · τ = ${TAU} · ≤ ${MAX_SCREENS} required screens._
**All listings and students are synthetic (Example data).** Simulations show the algorithm finds what our model says is best with few questions; they do not show the model matches real students — that needs the survey and hallway test.

| Claim | Result | Bar | Pass |
|---|---|---|---|
| **H1** Same answer as the long form (top 3) | ${ci(H1)} · top-1 ${pct(top1.p)} · ${avgClicks.toFixed(2)} screens on average | ≥ 95% | ${report.H1.pass ? '✅' : '❌'} |
| **H2** Optional questions help | top-1 ${pct(top1.p)} → ${pct(opt1.p)}; top-3 ${pct(H1.p)} → ${pct(opt3.p)}; +${avgOpt.toFixed(2)} questions | top-1 rises, top-3 doesn’t drop | ${report.H2.pass ? '✅' : '❌'} |
| **H3** Order matters | adaptive ${pct(H1.p)} vs fixed order ${pct(static3.p)} at the same clicks · McNemar b=${H3.b}, c=${H3.c}, p=${H3.p.toExponential(2)} | adaptive better, p < 0.05 | ${report.H3.pass ? '✅' : '❌'} |
| **H4** Confidence meter is honest | ECE ${(H4.ece * 100).toFixed(1)} points over ${calib.length} screens | ≤ 5 points | ${report.H4.pass ? '✅' : '❌'} |

Fixed order with all 5 screens: top-3 ${pct(static5.p)}. Screens used: ${Object.entries(clickHist).map(([k, v]) => `${k} → ${v}`).join(', ')}.

## H4 reliability table (every screen of every student)

| Confidence shown | Screens | Mean confidence | Actual top-3 hit |
|---|---|---|---|
${H4.bins.filter(b => b.n).map(b => `| ${pct(b.lo)}–${pct(b.hi)} | ${b.n} | ${pct(b.meanConf)} | ${pct(b.hitRate)} |`).join('\n')}

## Robustness

| Scenario | n | Top-3 hit (95% CI) | Top-1 |
|---|---|---|---|
${robustness.map(r => `| ${r.name} | ${r.n} | ${ci(r.top3)} | ${pct(r.top1)} |`).join('\n')}

## What-if: how the decision changes when one input changes

| Change | #1 | #2 | #3 |
|---|---|---|---|
${whatIf.map(w => `| ${w.label} | ${w.top.map(t => `${t.short} · $${t.total.toLocaleString('en-US')} · ${t.minutes} min`).join(' | ')} |`).join('\n')}

_Runtime ${report.runtime_s.toFixed(0)} s. Reproduce: \`npm run simulate\`._
`;
writeFileSync('reports/validation.md', md);
log(`H1 ${ci(H1)} | H2 top1 ${pct(top1.p)}→${pct(opt1.p)} | H3 p=${H3.p.toExponential(2)} | H4 ECE ${(H4.ece * 100).toFixed(1)}pt`);
