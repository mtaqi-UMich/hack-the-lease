// T1–T13 ported from prototype/tests.js — same pass bars, same seeds, same listing set (seed 7).
import { describe, it, expect, beforeAll } from 'vitest';
import {
  createEngine, mulberry32, sampleStudent, truthAnswer, runStatic,
  type Answers, type Engine, type Question, type Student,
} from '../lib/engine';

const N = Number(process.env.HTL_N ?? 100);

function sims(n: number, seed: number) {
  const rng = mulberry32(seed); const out: Student[] = [];
  while (out.length < n) out.push(sampleStudent(rng, {}).s);
  return out;
}
function traced(eng: Engine, truth: Student) {
  let ans: Answers = {}, st = eng.step(ans); const screens: { q: Question; ansBefore: Answers }[] = [];
  while (!st.done && screens.length < 15) { screens.push({ q: st.next!, ansBefore: ans }); ans = eng.applyAnswer(ans, st.next!, truthAnswer(st.next!, truth)); st = eng.step(ans); }
  return { ans, st, screens };
}

let eng: Engine;
let rows: { t: Student; trueBest: number; clicks: number; top: number[]; ts: number[]; conf: number; screens: { q: Question; ansBefore: Answers }[] }[];
let top3 = 0, sTop3 = 0, avgClicks = 0, maxClicks = 0, avgConf = 0;

beforeAll(() => {
  eng = createEngine({ poolSize: 1500, tau: 0.9 });
  const L = eng.listings;
  rows = sims(N, 4242).map(t => {
    const trueBest = eng.bestListing(t, L);
    const r = traced(eng, t);
    const s = runStatic(eng, t, Math.max(1, r.screens.length));
    return { t, trueBest, clicks: r.screens.length, top: r.st.rank.map(x => x.idx), ts: s.st.rank.map(x => x.idx), conf: r.st.conf, screens: r.screens };
  });
  const mean = (f: (r: typeof rows[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  top3 = mean(r => r.top.slice(0, 3).includes(r.trueBest) ? 1 : 0);
  sTop3 = mean(r => r.ts.slice(0, 3).includes(r.trueBest) ? 1 : 0);
  avgClicks = mean(r => r.clicks);
  maxClicks = Math.max(...rows.map(r => r.clicks));
  avgConf = mean(r => r.conf);
}, 300_000);

describe('prototype parity (T1–T13)', () => {
  it('T1 same answer as the full form: top-3 hit ≥ 90%', () => { expect(top3).toBeGreaterThanOrEqual(0.9); });
  it('T2 far fewer clicks: avg ≤ 6, max ≤ 10', () => { expect(avgClicks).toBeLessThanOrEqual(6); expect(maxClicks).toBeLessThanOrEqual(10); });
  it('T3 adaptive order beats fixed order by > 5 points', () => { expect(top3).toBeGreaterThan(sTop3 + 0.05); });
  it('T4 confidence meter calibrated within 7 points', () => { expect(Math.abs(avgConf - top3)).toBeLessThanOrEqual(0.07); });

  it('T5 walkers never asked about parking; drivers asked or assumed', () => {
    let walkViolations = 0, driveOk = 0, driveN = 0;
    for (const r of rows) for (const sc of r.screens)
      if (sc.q.id === 'deal' && sc.ansBefore.mode === 'walk' && sc.q.items!.some(it => it.key === 'parking')) walkViolations++;
    for (const b0 of ['Central', 'North', 'Medical', 'Split'] as const) for (const g of [1, 2, 3, 4, 5]) {
      const st = eng.step({ base: b0, group: g, mode: 'walk', budget: 1200 });
      const deal = st.cands.find(q => q.id === 'deal');
      if (deal && deal.items!.some(it => it.key === 'parking')) walkViolations++;
      const sd = eng.step({ base: b0, group: g, mode: 'drive', budget: 1200 }); driveN++;
      const dd = sd.cands.find(q => q.id === 'deal');
      if ((dd && dd.items!.some(it => it.key === 'parking')) || sd.assumptions.some(a => a.key === 'parking' && a.value)) driveOk++;
    }
    expect(walkViolations).toBe(0);
    expect(driveOk).toBe(driveN);
  }, 120_000);

  it('T6 drivers who need parking get parking (≥ 90%)', () => {
    const L = eng.listings;
    const drivers = rows.filter(r => r.t.mode === 'drive' && r.t.parking);
    const ok = drivers.filter(r => L[r.top[0]]?.parking).length;
    expect(drivers.length === 0 || ok / drivers.length >= 0.9).toBe(true);
  });

  it('T7 #1 pick within budget (±3%) for ≥ 90%', () => {
    const L = eng.listings; let ok = 0, n = 0;
    for (const r of rows) {
      const feasible = L.some(l => { const e = eng.evaluate(r.t, l); return e && e.over === 0; });
      if (!feasible || r.top[0] == null || r.top[0] < 0) continue;
      n++; const e = eng.evaluate(r.t, L[r.top[0]]); if (e && e.cost <= r.t.budget * 1.03) ok++;
    }
    expect(ok / n).toBeGreaterThanOrEqual(0.9);
  });

  it('T8 pet owners see an all-pet-friendly top 3 (≥ 90%)', () => {
    const L = eng.listings;
    const pets = rows.filter(r => r.t.pet);
    const ok = pets.filter(r => r.top.slice(0, 3).every(i => i < 0 || L[i].pets)).length;
    expect(pets.length === 0 || ok / pets.length >= 0.9).toBe(true);
  });

  it('T9 sensitivity: Central → North changes the pick toward North', () => {
    const L = eng.listings;
    const base: Answers = { group: 2, budget: 1300, mode: 'bus', _asked: ['group', 'budget', 'mode'] };
    const la = L[eng.step({ ...base, base: 'Central' }).rank[0].idx], lb = L[eng.step({ ...base, base: 'North' }).rank[0].idx];
    expect(la.id).not.toBe(lb.id);
    expect(lb.dist.North).toBeLessThan(la.dist.North);
  });

  it('T10 sensitivity: a higher budget buys quality or location', () => {
    const L = eng.listings;
    const l1 = L[eng.step({ group: 2, base: 'Central', mode: 'walk', budget: 1000 }).rank[0].idx];
    const l2 = L[eng.step({ group: 2, base: 'Central', mode: 'walk', budget: 1800 }).rank[0].idx];
    expect(l2.rent).toBeGreaterThanOrEqual(l1.rent);
    expect(l2.quality > l1.quality || l2.dist.Central < l1.dist.Central).toBe(true);
  });

  it('T11 trade-off cards are a binary search on value of time', () => {
    const rngB = mulberry32(77); const ratios: number[] = [];
    for (let k = 0; k < 20; k++) {
      const truth = sampleStudent(rngB, {}).s;
      let ans: Answers = { group: truth.group, base: truth.base, budget: Math.round(truth.budget), mode: truth.mode };
      for (let c = 0; c < 3; c++) {
        const card = eng.step(ans).cands.find(q => q.id === 'card'); if (!card) break;
        ans = eng.applyAnswer(ans, card, truth.alpha >= card.threshold! ? 'yes' : 'no');
        ratios.push(card.answers.yes ?? 0);
        if (!(truth.alpha >= (ans.alphaLo ?? 5) && truth.alpha <= (ans.alphaHi ?? 120))) ratios.push(-1);
      }
    }
    const splits = ratios.filter(x => x >= 0);
    expect(ratios.filter(x => x < 0).length).toBe(0);
    expect(Math.abs(splits.reduce((s, x) => s + x, 0) / splits.length - 0.5)).toBeLessThan(0.08);
  }, 120_000);

  it('T12 every question asked is worth ≥ 0.03 bits', () => {
    let worthless = 0;
    for (const r of rows) for (const sc of r.screens) if (sc.q.gain < eng.opts.minGain) worthless++;
    expect(worthless).toBe(0);
  });

  it('T13 same answers → same result', () => {
    const x1 = eng.step({ group: 3, base: 'Split', budget: 1100 }), x2 = eng.step({ group: 3, base: 'Split', budget: 1100 });
    expect(x1.rank[0].idx).toBe(x2.rank[0].idx);
    expect(Math.abs(x1.conf - x2.conf)).toBeLessThan(1e-12);
  });
});
