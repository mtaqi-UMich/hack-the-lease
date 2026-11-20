/* Test suite: proves the adaptive onboarding behaves correctly and is as good as the long form.
 * Works in Node (node tests.js) and in the browser (HTLTests.run()). */
(function (root) {
  'use strict';
  const H = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.HTL;

  function sims(eng, n, seed, filter) {
    const rng = H.mulberry32(seed); const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 200) { const t = H.sampleStudent(rng, {}).s; if (!filter || filter(t)) out.push(t); }
    return out;
  }
  // run adaptive while recording every screen shown
  function traced(eng, truth) {
    let ans = {}, st = eng.step(ans); const screens = [];
    while (!st.done && screens.length < 15) { screens.push({ q: st.next, ansBefore: ans }); ans = eng.applyAnswer(ans, st.next, H.truthAnswer(st.next, truth)); st = eng.step(ans); }
    return { ans, st, screens };
  }

  async function run(opts = {}) {
    const n = opts.n ?? 150;
    const log = opts.log || (() => {});
    const tick = () => new Promise(r => setTimeout(r, 0));
    const eng = H.createEngine({ poolSize: opts.poolSize ?? 1500, tau: opts.tau ?? 0.9 });
    const L = eng.listings;
    const results = [];
    const add = (id, name, pass, detail, why) => { results.push({ id, name, pass, detail, why }); log(results[results.length - 1]); };

    // ---------- Simulation benchmark (shared by several tests) ----------
    const truths = sims(eng, n, 4242);
    const rows = [];
    for (let i = 0; i < truths.length; i++) {
      const t = truths[i];
      const trueBest = eng.bestListing(t, L);
      const r = traced(eng, t);
      const top = r.st.rank.map(x => x.idx);
      const clicks = r.screens.length;
      const s = H.runStatic(eng, t, Math.max(1, clicks));
      const ts = s.st.rank.map(x => x.idx);
      rows.push({ t, trueBest, clicks, top, ts, conf: r.st.conf, screens: r.screens });
      if (i % 10 === 9) { opts.progress && opts.progress((i + 1) / truths.length); await tick(); }
    }
    const mean = f => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    const top1 = mean(r => r.top[0] === r.trueBest ? 1 : 0);
    const top3 = mean(r => r.top.slice(0, 3).includes(r.trueBest) ? 1 : 0);
    const sTop3 = mean(r => r.ts.slice(0, 3).includes(r.trueBest) ? 1 : 0);
    const sTop1 = mean(r => r.ts[0] === r.trueBest ? 1 : 0);
    const avgClicks = mean(r => r.clicks);
    const avgConf = mean(r => r.conf);
    const maxClicks = Math.max(...rows.map(r => r.clicks));

    add('T1', 'Same answer as the full 17-screen form (top-3)', top3 >= 0.9,
      `${(top3 * 100).toFixed(1)}% of ${n} simulated students: their true best apartment (computed with ALL their info) is in our top 3. Top-1 exact match: ${(top1 * 100).toFixed(1)}%.`,
      'The "full form" answer is computed from every hidden trait of the simulated student — that is the 17-click result. We only ask a few questions and check we land on the same apartment.');
    add('T2', 'Far fewer clicks than the classic flow', avgClicks <= 6 && maxClicks <= 10,
      `Average ${avgClicks.toFixed(2)} screens (max ${maxClicks}) vs 17 screens on Apartment List.`,
      'Early stopping: we stop the moment more questions cannot realistically change the top 3.');
    add('T3', 'Adaptive order beats a fixed order with the same number of clicks', top3 > sTop3 + 0.05,
      `Adaptive top-3 hit ${(top3 * 100).toFixed(1)}% vs fixed-order ${(sTop3 * 100).toFixed(1)}% (top-1: ${(top1 * 100).toFixed(1)}% vs ${(sTop1 * 100).toFixed(1)}%) at identical click counts.`,
      'Fixed order = a normal onboarding (beds → budget → location → commute → amenities…) cut off at the same length. Proves the ORDER chosen by information gain matters, not just the number of questions.');
    add('T4', 'Confidence meter is honest (calibrated)', Math.abs(avgConf - top3) <= 0.07,
      `Average confidence shown at the end: ${(avgConf * 100).toFixed(1)}%. Actual top-3 hit rate: ${(top3 * 100).toFixed(1)}%.`,
      'If we say "90% sure", we should be right ~90% of the time. This is the evidence that our stop rule is trustworthy.');

    // ---------- T5 walkers never get the parking question ----------
    let walkViolations = 0, walkScreens = 0, driveShownOrInferred = 0, driveN = 0;
    for (const r of rows) for (const sc of r.screens) {
      if (sc.q.id === 'deal' && sc.ansBefore.mode === 'walk') { walkScreens++; if (sc.q.items.some(it => it.key === 'parking')) walkViolations++; }
    }
    for (const b0 of ['Central', 'North', 'Medical', 'Split']) for (const g of [1, 2, 3, 4, 5]) {
      const st = eng.step({ base: b0, group: g, mode: 'walk', budget: 1200 });
      const deal = st.cands.find(q => q.id === 'deal'); walkScreens++;
      if (deal && deal.items.some(it => it.key === 'parking')) walkViolations++;
      const sd = eng.step({ base: b0, group: g, mode: 'drive', budget: 1200 }); driveN++;
      const dd = sd.cands.find(q => q.id === 'deal');
      if ((dd && dd.items.some(it => it.key === 'parking')) || sd.assumptions.some(a => a.key === 'parking' && a.value)) driveShownOrInferred++;
    }
    add('T5', 'Walkers are never asked about parking (drivers are)', walkViolations === 0 && driveShownOrInferred === driveN,
      `${walkScreens} dealbreaker screens for walkers (all 4 campuses x 5 group sizes + simulations) → parking shown ${walkViolations} times. Drivers: parking asked or auto-assumed in ${driveShownOrInferred}/${driveN} cases.`,
      'Apartment List asks parking even after you choose "I walk". Our grid only shows items whose information gain is above a threshold, so irrelevant items disappear by themselves.');

    // ---------- T6 drivers get parking ----------
    const drivers = rows.filter(r => r.t.mode === 'drive' && r.t.parking);
    const drvOk = drivers.filter(r => L[r.top[0]] && L[r.top[0]].parking).length;
    add('T6', 'Drivers who need parking get a place with parking', drivers.length === 0 || drvOk / drivers.length >= 0.9,
      `${drvOk}/${drivers.length} drivers got a #1 pick with parking.`,
      'Either we asked, or we inferred it from "I drive" (95% of drivers need parking) without asking.');

    // ---------- T7 budget respected ----------
    let budOk = 0, budN = 0;
    for (const r of rows) {
      const feasible = L.some(l => { const e = eng.evaluate(r.t, l); return e && e.over === 0; });
      if (!feasible || r.top[0] == null || r.top[0] < 0) continue;
      budN++; const e = eng.evaluate(r.t, L[r.top[0]]); if (e && e.cost <= r.t.budget * 1.03) budOk++;
    }
    add('T7', 'Recommendations respect the budget', budOk / budN >= 0.9,
      `${budOk}/${budN} students got a #1 pick within budget (±3%).`, 'Budget acts as a near-hard constraint (5x penalty above it).');

    // ---------- T8 pet owners ----------
    const pets = rows.filter(r => r.t.pet);
    const petOk = pets.filter(r => r.top.slice(0, 3).every(i => i < 0 || L[i].pets)).length;
    add('T8', 'Pet owners only see pet-friendly places', pets.length === 0 || petOk / pets.length >= 0.9,
      `${petOk}/${pets.length} pet owners had an all-pet-friendly top 3.`, 'Hard constraint once known.');
    await tick();

    // ---------- T9 decision sensitivity: Central vs North flips the answer ----------
    const base = { group: 2, budget: 1300, mode: 'bus', _asked: ['group', 'budget', 'mode'] };
    const A = eng.step({ ...base, base: 'Central' }), B = eng.step({ ...base, base: 'North' });
    const la = L[A.rank[0].idx], lb = L[B.rank[0].idx];
    add('T9', 'Decision sensitivity: changing campus changes the pick', la.id !== lb.id && lb.dist.North < la.dist.North,
      `Central → ${la.name} (${la.hood}, ${la.dist.North.toFixed(1)} km to North). North → ${lb.name} (${lb.hood}, ${lb.dist.North.toFixed(1)} km to North).`,
      'Required by the brief: change one input and show the outcome changes in the expected direction.');

    // ---------- T10 budget sensitivity: more money -> nicer or closer ----------
    const lo = eng.step({ group: 2, base: 'Central', mode: 'walk', budget: 1000 }), hi = eng.step({ group: 2, base: 'Central', mode: 'walk', budget: 1800 });
    const l1 = L[lo.rank[0].idx], l2 = L[hi.rank[0].idx];
    add('T10', 'Decision sensitivity: a higher budget buys quality or location', l2.rent >= l1.rent && (l2.quality > l1.quality || l2.dist.Central < l1.dist.Central),
      `$1000 → ${l1.name}, $${l1.rent / 2}/person, quality ${l1.quality}, ${l1.dist.Central.toFixed(1)} km. $1800 → ${l2.name}, $${l2.rent / 2}/person, quality ${l2.quality}, ${l2.dist.Central.toFixed(1)} km.`,
      'Checks the model reacts sensibly in the economic direction we expect.');

    // ---------- T11 trade-off cards are a real binary search ----------
    const rngB = H.mulberry32(77); let ratios = [];
    for (let k = 0; k < 20; k++) {
      const truth = H.sampleStudent(rngB, {}).s; let ans = { group: truth.group, base: truth.base, budget: Math.round(truth.budget), mode: truth.mode };
      let lo2 = 5, hi2 = 120;
      for (let c = 0; c < 3; c++) {
        const st = eng.step(ans); const card = st.cands.find(q => q.id === 'card'); if (!card) break;
        const before = Math.log(hi2) - Math.log(lo2);
        ans = eng.applyAnswer(ans, card, truth.alpha >= card.threshold ? 'yes' : 'no');
        lo2 = ans.alphaLo ?? 5; hi2 = ans.alphaHi ?? 120;
        ratios.push(card.answers.yes ?? 0);
        if (!(truth.alpha >= lo2 && truth.alpha <= hi2)) ratios.push(-1);
      }
    }
    const bad = ratios.filter(x => x < 0).length, splits = ratios.filter(x => x >= 0);
    const avgSplit = splits.reduce((s, x) => s + x, 0) / splits.length;
    add('T11', 'Trade-off cards = binary search on "value of your time"', bad === 0 && Math.abs(avgSplit - 0.5) < 0.08,
      `Each card splits the remaining students ${(avgSplit * 100).toFixed(0)}% yes / ${(100 - avgSplit * 100).toFixed(0)}% no (ideal 50/50). True value always stays inside the interval (${bad} misses).`,
      'Each card asks at the current MEDIAN value of time, so every answer halves the possibilities: 3 cards = 8x more precise.');

    // ---------- T12 never asks a worthless question ----------
    const minGain = eng.opts.minGain; let worthless = 0, total = 0;
    for (const r of rows) for (const sc of r.screens) { total++; if (sc.q.gain < minGain) worthless++; }
    add('T12', 'Every question asked is worth its click', worthless === 0,
      `${total} screens shown across ${n} students; ${worthless} had expected information gain below ${minGain} bits.`, 'Each click must reduce uncertainty about which apartment is best.');

    // ---------- T13 determinism ----------
    const x1 = eng.step({ group: 3, base: 'Split', budget: 1100 }), x2 = eng.step({ group: 3, base: 'Split', budget: 1100 });
    add('T13', 'Same answers → same result (reproducible)', x1.rank[0].idx === x2.rank[0].idx && Math.abs(x1.conf - x2.conf) < 1e-12,
      `Both runs → ${L[x1.rank[0].idx].name}, confidence ${(x1.conf * 100).toFixed(1)}%.`, 'Seeded randomness so judges see the same thing twice.');

    // ---------- curve: accuracy vs clicks for fixed order ----------
    const curve = [];
    for (let k = 1; k <= 8; k++) {
      const hit = mean(r => H.runStatic(eng, r.t, k).st.rank.slice(0, 3).map(x => x.idx).includes(r.trueBest) ? 1 : 0);
      curve.push({ k, hit }); await tick();
      if (k >= 6 && rows.length > 80) break;
    }
    const kMatch = (curve.find(c => c.hit >= top3) || { k: '>' + curve[curve.length - 1].k }).k;
    const clickHist = {}; rows.forEach(r => clickHist[r.clicks] = (clickHist[r.clicks] || 0) + 1);
    return { results, summary: { n, top1, top3, sTop1, sTop3, avgClicks, maxClicks, avgConf, curve, kMatch, clickHist } };
  }

  const API = { run };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
    if (require.main === module) run({ n: +process.argv[2] || 150, log: r => console.log(r.pass ? 'PASS' : 'FAIL', r.id, r.name, '—', r.detail) })
      .then(o => console.log(JSON.stringify(o.summary, null, 1)));
  } else root.HTLTests = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
