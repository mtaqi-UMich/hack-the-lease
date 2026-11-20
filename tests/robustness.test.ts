// Robustness (PRD Testing suite, 30 cases): priors ±20%, a different population, 10% wrong answers.
// Each case is a small cohort (fast); the 1,000-student version is in scripts/simulate.ts → reports/validation.md.
import { describe, it, expect } from 'vitest';
import { createEngine, mulberry32, sampleStudent, truthAnswer, PRIOR, type Answers, type Prior, type Question, type Student } from '../lib/engine';
import { LISTINGS } from '../lib/data';

const eng = createEngine({ listings: LISTINGS, poolSize: 1000, tau: 0.95, maxScreens: 5 });
const COHORT = 15;

function cohort(seed: number, prior: Prior, filter?: (s: Student) => boolean) {
  const r = mulberry32(seed); const out: Student[] = [];
  while (out.length < COHORT) { const s = sampleStudent(r, {}, prior).s; if ((!filter || filter(s)) && eng.bestListing(s, eng.listings) >= 0) out.push(s); }
  return out;
}
function hitRate(students: Student[], answer: (q: Pick<Question, 'id' | 'threshold' | 'items'>, t: Student) => unknown = truthAnswer) {
  let hits = 0;
  for (const t of students) {
    const best = eng.bestListing(t, eng.listings);
    let a: Answers = {}, st = eng.step(a), g = 0;
    while (!st.done && g++ < 8) { a = eng.applyAnswer(a, st.next!, answer(st.next!, t)); st = eng.step(a); }
    if (st.rank.slice(0, 3).some(r => r.idx === best)) hits++;
  }
  return hits / students.length;
}
const shifted = (f: number): Prior => ({ ...PRIOR, budget: { ...PRIOR.budget, mean: PRIOR.budget.mean * f }, alpha: { ...PRIOR.alpha, median: PRIOR.alpha.median * f }, laundry: Math.min(0.95, PRIOR.laundry * f), quiet: Math.min(0.95, PRIOR.quiet * f) });
function noisy(seed: number) {
  const r = mulberry32(seed);
  return (q: Pick<Question, 'id' | 'threshold' | 'items'>, t: Student) => {
    const a = truthAnswer(q, t);
    if (r() >= 0.1) return a;
    if (q.id === 'card') return a === 'yes' ? 'no' : 'yes';
    if (q.id === 'budget') return Math.round(t.budget * 1.2 / 25) * 25;
    if (q.id === 'base') return t.base === 'Central' ? 'North' : 'Central';
    return a;
  };
}

describe('priors shifted +20% (engine keeps the default prior)', () => {
  for (let k = 0; k < 8; k++) it(`cohort ${k + 1}`, () => expect(hitRate(cohort(100 + k, shifted(1.2)))).toBeGreaterThanOrEqual(0.8));
});
describe('priors shifted −20%', () => {
  for (let k = 0; k < 8; k++) it(`cohort ${k + 1}`, () => expect(hitRate(cohort(200 + k, shifted(0.8)))).toBeGreaterThanOrEqual(0.8));
});
describe('a different population (North Campus only / drivers only)', () => {
  for (let k = 0; k < 4; k++) it(`North cohort ${k + 1}`, () => expect(hitRate(cohort(300 + k, PRIOR, s => s.base === 'North'))).toBeGreaterThanOrEqual(0.8));
  for (let k = 0; k < 4; k++) it(`driver cohort ${k + 1}`, () => expect(hitRate(cohort(400 + k, PRIOR, s => s.mode === 'drive'))).toBeGreaterThanOrEqual(0.8));
});
describe('10% wrong answers degrade gracefully (no collapse)', () => {
  for (let k = 0; k < 6; k++) it(`cohort ${k + 1}`, () => expect(hitRate(cohort(500 + k, PRIOR), noisy(k))).toBeGreaterThanOrEqual(0.6));
});
