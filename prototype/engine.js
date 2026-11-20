/* Hack the Lease — Adaptive onboarding engine
 * Idea: keep a "cloud" of possible students (particles) consistent with the answers so far.
 * For each particle we know its best apartment. The next question is the one that is expected
 * to shrink the uncertainty (entropy) about "which apartment is best" the most.
 * Stop as soon as we are confident the true best apartment is in our top 3.
 * ALL listings and student profiles here are SYNTHETIC (labelled as such in the UI).
 */
(function (root) {
  'use strict';

  // ---------- seeded RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, dist) { // dist: {value: prob}
    let u = rng(), acc = 0, last;
    for (const k in dist) { acc += dist[k]; last = k; if (u < acc) return k; }
    return last;
  }
  // normal cdf / inverse (for truncated lognormal sampling of value-of-time)
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function PhiInv(p) { // Acklam
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    p = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // ---------- geography (approximate public coordinates) ----------
  const ANCHORS = {
    Central: [42.2768, -83.7382],   // the Diag
    North: [42.2914, -83.7174],     // Pierpont / BBB area
    Medical: [42.2840, -83.7290],   // Michigan Medicine
  };
  function km(a, b) {
    const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x)) * 1.3; // 1.3 = street detour factor
  }
  // one-way minutes by mode (simple, explainable assumptions)
  function travel(distKm, mode, anchor) {
    const walk = 12.5 * distKm;                       // ~4.8 km/h
    if (mode === 'walk') return walk;
    if (mode === 'bike') return 2 + 4 * distKm;       // ~15 km/h + lock-up
    if (mode === 'bus') return Math.min(walk, 12 + 2.5 * distKm); // wait/walk to stop + ride (Blue Bus / TheRide)
    // drive: traffic + parking search (Central parking is hardest)
    return 6 + 2 * distKm + (anchor === 'Central' ? 8 : 4);
  }

  // ---------- SYNTHETIC listings ----------
  const HOODS = [
    { name: 'South U', c: [42.2745, -83.7330], rent: 1.25, quiet: 0.2 },
    { name: 'Kerrytown', c: [42.2840, -83.7465], rent: 1.15, quiet: 0.6 },
    { name: 'Downtown', c: [42.2800, -83.7480], rent: 1.2, quiet: 0.35 },
    { name: 'Old West Side', c: [42.2780, -83.7600], rent: 1.0, quiet: 0.8 },
    { name: 'Burns Park', c: [42.2680, -83.7300], rent: 1.05, quiet: 0.75 },
    { name: 'Geddes / Oxford', c: [42.2760, -83.7230], rent: 1.1, quiet: 0.5 },
    { name: 'Lower Town', c: [42.2900, -83.7400], rent: 0.95, quiet: 0.6 },
    { name: 'Northwood / North Campus', c: [42.2960, -83.7200], rent: 0.9, quiet: 0.7 },
    { name: 'Plymouth Rd', c: [42.3000, -83.7050], rent: 0.8, quiet: 0.75 },
    { name: 'Packard / Stadium', c: [42.2560, -83.7280], rent: 0.75, quiet: 0.7 },
    { name: 'Water Hill', c: [42.2870, -83.7560], rent: 0.9, quiet: 0.85 },
    { name: 'Medical / Fuller', c: [42.2850, -83.7330], rent: 1.05, quiet: 0.55 },
  ];
  const STREETS = ['Maple', 'Hill', 'State', 'Packard', 'Division', 'Fuller', 'Huron', 'Geddes', 'Liberty', 'Catherine', 'Traver', 'Murfin', 'Washtenaw', 'Kingsley', 'Ann', 'Hoover'];
  const KINDS = ['Lofts', 'Flats', 'House', 'Commons', 'Court', 'Place', 'Terrace', 'Residences'];

  function makeListings(seed) {
    const rng = mulberry32(seed);
    const L = [];
    const count = 120, bedsPlan = [];
    for (let i = 0; i < count; i++) bedsPlan.push([1, 1, 2, 2, 2, 3, 3, 4, 4, 5][Math.floor(rng() * 10)]);
    bedsPlan.forEach((beds, i) => {
      const h = HOODS[i % HOODS.length];
      const c = [h.c[0] + (rng() - 0.5) * 0.004, h.c[1] + (rng() - 0.5) * 0.005];
      const dist = {}; for (const a in ANCHORS) dist[a] = km(c, ANCHORS[a]);
      const inUnit = rng() < (beds >= 4 ? 0.65 : 0.5);
      const parking = rng() < (dist.Central > 2.2 ? 0.8 : 0.3);
      const ac = rng() < 0.6, pets = rng() < 0.35, leaseAny = rng() < 0.3;
      const quality = Math.round(rng() * 100) / 100;          // 0 = dated, 1 = newly renovated w/ amenities
      // hedonic pricing: rent reflects location + quality + features (+-5% noise) -> real trade-offs, few "free lunches"
      const locPremium = 420 * Math.exp(-dist.Central / 1.0) + 220 * Math.exp(-dist.North / 0.9) + 80 * Math.exp(-dist.Medical / 0.8);
      const sizeAdj = beds === 1 ? 1.3 : beds === 2 ? 1.08 : 1;
      let perBed = (720 + locPremium + 380 * quality + (inUnit ? 60 : 0) + (parking ? 40 : 0) + (ac ? 30 : 0) + (h.quiet - 0.5) * 60) * sizeAdj * (0.95 + rng() * 0.1);
      const rent = Math.round(perBed * beds / 5) * 5;
      L.push({
        id: 'L' + (i + 1),
        name: `${100 + Math.floor(rng() * 1800)} ${STREETS[Math.floor(rng() * STREETS.length)]} ${KINDS[Math.floor(rng() * KINDS.length)]}`,
        hood: h.name, beds, rent, quality, inUnit, parking, ac, pets, leaseAny,
        quiet: Math.min(1, Math.max(0, h.quiet + (rng() - 0.5) * 0.3)), dist, coord: c,
      });
    });
    return L;
  }

  // ---------- the student model (a small Bayesian network) ----------
  const PRIOR = {
    base: { Central: 0.5, North: 0.25, Medical: 0.1, Split: 0.15 },
    modeGivenBase: {
      Central: { walk: 0.6, bus: 0.15, bike: 0.15, drive: 0.1 },
      North: { walk: 0.2, bus: 0.55, bike: 0.1, drive: 0.15 },
      Medical: { walk: 0.35, bus: 0.3, bike: 0.1, drive: 0.25 },
      Split: { walk: 0.25, bus: 0.5, bike: 0.15, drive: 0.1 },
    },
    group: { 1: 0.2, 2: 0.25, 3: 0.2, 4: 0.25, 5: 0.1 },
    budget: { mean: 1150, sd: 260, min: 650, max: 2000 },      // $ per person per month
    alpha: { median: 25, logSd: 0.6, min: 5, max: 120 },         // value of commute time, $ per hour
    parkingGivenMode: { drive: 0.95, walk: 0.03, bus: 0.05, bike: 0.05 },
    laundry: 0.5, pet: 0.12, ac: 0.4, quiet: 0.4, leaseFlex: 0.15,
  };
  const BOOL_ITEMS = [
    { key: 'parking', label: 'I need a parking spot' },
    { key: 'laundry', label: 'In-unit laundry is a must' },
    { key: 'pet', label: 'I have a pet' },
    { key: 'ac', label: 'I want air conditioning' },
    { key: 'quiet', label: 'I study at home — I need it quiet' },
    { key: 'leaseFlex', label: "I can't do an August start (e.g. January)" },
  ];

  function sampleStudent(rng, ans) {
    // Likelihood weighting: answered nodes are fixed; weight = P(answer | sampled parents)
    let w = 1;
    const s = {};
    s.base = ans.base ?? pick(rng, PRIOR.base);
    const pm = PRIOR.modeGivenBase[s.base];
    if (ans.mode) { s.mode = ans.mode; w *= pm[ans.mode]; } else s.mode = pick(rng, pm);
    s.group = ans.group ?? +pick(rng, PRIOR.group);
    if (ans.budget != null) s.budget = ans.budget;
    else { const B = PRIOR.budget; s.budget = Math.min(B.max, Math.max(B.min, B.mean + B.sd * PhiInv(rng()))); }
    // value of time: truncated lognormal inside the interval learned from trade-off cards
    const A = PRIOR.alpha, lo = ans.alphaLo ?? A.min, hi = ans.alphaHi ?? A.max;
    const zlo = Phi((Math.log(lo) - Math.log(A.median)) / A.logSd), zhi = Phi((Math.log(hi) - Math.log(A.median)) / A.logSd);
    s.alpha = Math.exp(Math.log(A.median) + A.logSd * PhiInv(zlo + rng() * (zhi - zlo)));
    const pp = PRIOR.parkingGivenMode[s.mode];
    if (ans.parking != null) { s.parking = ans.parking; w *= ans.parking ? pp : 1 - pp; } else s.parking = rng() < pp;
    for (const k of ['laundry', 'pet', 'ac', 'quiet', 'leaseFlex']) s[k] = ans[k] ?? (rng() < PRIOR[k]);
    return { s, w };
  }

  // ---------- utility: $-equivalent per person per month (higher = better) ----------
  const TRIPS_PER_MONTH = 2 * 20; // two one-way trips, 20 days
  function oneWayMinutes(st, l) {
    if (st.base === 'Split') return (travel(l.dist.Central, st.mode, 'Central') + travel(l.dist.North, st.mode, 'North')) / 2;
    return travel(l.dist[st.base], st.mode, st.base);
  }
  function evaluate(st, l) {
    if (l.beds < st.group || l.beds > st.group + 1) return null;             // wrong size
    if (st.parking && !l.parking) return null;
    if (st.laundry && !l.inUnit) return null;
    if (st.pet && !l.pets) return null;
    if (st.leaseFlex && !l.leaseAny) return null;
    const cost = l.rent / st.group;
    const mins = oneWayMinutes(st, l);
    const hours = mins * TRIPS_PER_MONTH / 60;
    const timeCost = st.alpha * hours;
    // richer budgets value a nicer place more (renovation, amenities): worth ~30% of budget at quality=1
    const qualityValue = 0.3 * st.budget * l.quality;
    const bonus = qualityValue + (st.ac && l.ac ? 60 : 0) + (st.quiet ? 150 * l.quiet : 0) + (l.beds > st.group ? 40 : 0);
    const over = Math.max(0, cost - st.budget);
    const u = -cost - timeCost + bonus - 4 * over;                        // going over budget hurts 5x
    return { u, cost, mins, hours, timeCost, bonus, qualityValue, over };
  }
  function bestListing(st, listings) {
    let best = -1, bu = -Infinity;
    for (let j = 0; j < listings.length; j++) { const e = evaluate(st, listings[j]); if (e && e.u > bu) { bu = e.u; best = j; } }
    return best; // -1 = nothing fits
  }

  // ---------- information theory ----------
  function entropy(counts, total) {
    let h = 0; for (const k in counts) { const p = counts[k] / total; if (p > 0) h -= p * Math.log2(p); } return h;
  }
  function distOf(pool) {
    const c = {}; let tot = 0;
    for (const p of pool) { c[p.best] = (c[p.best] || 0) + p.w; tot += p.w; }
    return { c, tot };
  }
  function expectedGain(pool, keyFn) {
    const { c, tot } = distOf(pool);
    const H = entropy(c, tot);
    const groups = {};
    for (const p of pool) { const k = keyFn(p.s); (groups[k] = groups[k] || []).push(p); }
    let EH = 0; const answers = {};
    for (const k in groups) { const d = distOf(groups[k]); EH += (d.tot / tot) * entropy(d.c, d.tot); answers[k] = d.tot / tot; }
    return { gain: H - EH, answers };
  }

  // ---------- the engine ----------
  function weightedMedian(vals) { // [{v,w}]
    vals.sort((a, b) => a.v - b.v); const tot = vals.reduce((s, x) => s + x.w, 0); let acc = 0;
    for (const x of vals) { acc += x.w; if (acc >= tot / 2) return x.v; } return vals[vals.length - 1].v;
  }
  const BUDGET_BINS = [800, 950, 1100, 1250, 1400, 1600];
  const binOf = b => BUDGET_BINS.findIndex(x => b < x) === -1 ? BUDGET_BINS.length : BUDGET_BINS.findIndex(x => b < x);

  function createEngine(opts = {}) {
    const listings = opts.listings || makeListings(opts.listingSeed ?? 7);
    const N = opts.poolSize ?? 2500;
    const tau = opts.tau ?? 0.9;            // stop when P(true best is in our top 3) >= tau
    const minGain = opts.minGain ?? 0.03;   // bits; questions below this are "not worth a click"
    const itemMinGain = opts.itemMinGain ?? 0.02; // dealbreaker items shown only if they matter
    const maxCards = opts.maxCards ?? 3;
    const predictable = opts.predictable ?? 0.05; // skip items whose answer is >=95% predictable
    const seed = opts.seed ?? 1;

    function buildPool(ans) {
      const rng = mulberry32(seed * 7919 + 17);
      const pool = [];
      for (let i = 0; i < N; i++) { const { s, w } = sampleStudent(rng, ans); if (w > 0) pool.push({ s, w, best: bestListing(s, listings) }); }
      return pool;
    }
    function ranking(pool) {
      const { c, tot } = distOf(pool);
      return Object.keys(c).map(k => ({ idx: +k, p: c[k] / tot })).sort((a, b) => b.p - a.p);
    }
    function confidence(rank) { return rank.slice(0, 3).reduce((s, r) => s + r.p, 0); }

    // candidate questions given current answers
    function candidates(ans, pool) {
      const out = [];
      if (ans.base == null) out.push({ id: 'base', type: 'choice', title: "Where does most of your week happen?", options: ['Central', 'North', 'Medical', 'Split'], ...expectedGain(pool, s => s.base) });
      if (ans.mode == null) out.push({ id: 'mode', type: 'choice', title: 'How do you usually get to class?', options: ['walk', 'bus', 'bike', 'drive'], ...expectedGain(pool, s => s.mode) });
      if (ans.group == null) out.push({ id: 'group', type: 'choice', title: 'How many people will live together (including you)?', options: ['1', '2', '3', '4', '5'], ...expectedGain(pool, s => String(s.group)) });
      if (ans.budget == null) out.push({ id: 'budget', type: 'slider', title: 'Max rent per person per month?', ...expectedGain(pool, s => binOf(s.budget)) });
      // trade-off card: bisection on value of time
      const cards = ans.cards || 0;
      if (cards < maxCards) {
        const med = weightedMedian(pool.map(p => ({ v: p.s.alpha, w: p.w })));
        const save = Math.round(med * (10 * TRIPS_PER_MONTH / 60) / 5) * 5; // $ for 10 min each way
        const g = expectedGain(pool, s => s.alpha >= med ? 'yes' : 'no');
        out.push({ id: 'card', type: 'card', threshold: med, dollars: save, title: `Would you pay $${save} more per month to save 10 minutes on every one-way trip?`, ...g });
      }
      // dealbreakers grid: only items that individually matter make it onto the screen
      // rule: an item is shown only if (a) it can change the result (gain) AND (b) its answer is not already
      // >=95% predictable — predictable items are assumed instead and shown as editable "assumed" chips.
      const items = BOOL_ITEMS.filter(it => ans[it.key] == null).map(it => {
        const g = expectedGain(pool, s => s[it.key] ? 1 : 0);
        return { ...it, ...g, pYes: g.answers['1'] || 0 };
      });
      const shown = items.filter(it => it.gain >= itemMinGain && it.pYes >= predictable && it.pYes <= 1 - predictable);
      if (shown.length) {
        const g = expectedGain(pool, s => shown.map(it => s[it.key] ? 1 : 0).join(''));
        out.push({ id: 'deal', type: 'multi', title: 'Tick anything that is a dealbreaker for you', items: shown, hidden: items.filter(it => it.gain < itemMinGain), ...g });
      }
      return out.sort((a, b) => b.gain - a.gain);
    }

    // beliefs about things we did NOT ask (shown as "assumed" chips)
    function assumptions(ans, pool) {
      const tot = pool.reduce((s, p) => s + p.w, 0);
      const out = [];
      const share = f => pool.reduce((s, p) => s + (f(p.s) ? p.w : 0), 0) / tot;
      if (ans.mode == null) { for (const m of ['walk', 'bus', 'bike', 'drive']) { const q = share(s => s.mode === m); if (q >= 0.5) out.push({ key: 'mode', text: `You probably ${m === 'bus' ? 'take the bus' : m}`, p: q }); } }
      for (const it of BOOL_ITEMS) if (ans[it.key] == null) { const q = share(s => s[it.key]); out.push({ key: it.key, text: (q >= 0.5 ? '' : 'No: ') + it.label.replace("I can't do", 'Cannot do').replace(/^I /, 'You '), p: Math.max(q, 1 - q), value: q >= 0.5 }); }
      return out.filter(a => a.p >= 0.8);
    }

    function step(ans) {
      const pool = buildPool(ans);
      const rank = ranking(pool);
      const conf = confidence(rank);
      const cands = candidates(ans, pool);
      const asked = ans._asked || [];
      let done = false, reason = '';
      if (conf >= tau) { done = true; reason = `Confident: ${(conf * 100).toFixed(0)}% chance your true best apartment is in this top 3 (target ${(tau * 100).toFixed(0)}%).`; }
      else if (!cands.length || cands[0].gain < minGain) { done = true; reason = `No remaining question is worth a click (best one would only add ${cands.length ? cands[0].gain.toFixed(3) : 0} bits).`; }
      return { pool, rank, conf, cands, next: done ? null : cands[0], done, reason, assumptions: assumptions(ans, pool), clicks: asked.length };
    }

    function applyAnswer(ans, q, value) {
      const a = { ...ans, _asked: [...(ans._asked || []), q.id] };
      if (q.id === 'base' || q.id === 'mode') a[q.id] = value;
      else if (q.id === 'group') a.group = +value;
      else if (q.id === 'budget') a.budget = +value;
      else if (q.id === 'card') {
        a.cards = (ans.cards || 0) + 1;
        if (value === 'yes') a.alphaLo = Math.max(ans.alphaLo ?? 0, q.threshold); else a.alphaHi = Math.min(ans.alphaHi ?? 1e9, q.threshold);
        a._cardLog = [...(ans._cardLog || []), { threshold: q.threshold, dollars: q.dollars, value }];
      } else if (q.id === 'deal') { for (const it of q.items) a[it.key] = !!value[it.key]; }
      return a;
    }

    // explain a listing for the current beliefs (uses answers + most likely values for the rest)
    function pointEstimate(ans, pool) {
      const tot = pool.reduce((s, p) => s + p.w, 0);
      const st = { ...pool[0].s };
      const mode = (k, vals) => { let best, bp = -1; for (const v of vals) { const q = pool.reduce((s, p) => s + (p.s[k] === v ? p.w : 0), 0); if (q > bp) { bp = q; best = v; } } return best; };
      st.base = ans.base ?? mode('base', ['Central', 'North', 'Medical', 'Split']);
      st.mode = ans.mode ?? mode('mode', ['walk', 'bus', 'bike', 'drive']);
      st.group = ans.group ?? mode('group', [1, 2, 3, 4, 5]);
      st.budget = ans.budget ?? weightedMedian(pool.map(p => ({ v: p.s.budget, w: p.w })));
      st.alpha = weightedMedian(pool.map(p => ({ v: p.s.alpha, w: p.w })));
      for (const it of BOOL_ITEMS) st[it.key] = ans[it.key] ?? (pool.reduce((s, p) => s + (p.s[it.key] ? p.w : 0), 0) / tot >= 0.5);
      return st;
    }
    function explain(st, l) { return evaluate(st, l); }

    return { listings, step, applyAnswer, pointEstimate, explain, evaluate, bestListing, buildPool, opts: { N, tau, minGain, itemMinGain, maxCards, predictable } };
  }

  // ---------- simulation: answer truthfully as a given "true" student ----------
  function truthAnswer(q, truth) {
    if (q.id === 'base') return truth.base;
    if (q.id === 'mode') return truth.mode;
    if (q.id === 'group') return String(truth.group);
    if (q.id === 'budget') return Math.round(truth.budget / 25) * 25;
    if (q.id === 'card') return truth.alpha >= q.threshold ? 'yes' : 'no';
    if (q.id === 'deal') { const v = {}; for (const it of q.items) v[it.key] = truth[it.key]; return v; }
  }
  function runAdaptive(engine, truth, maxSteps = 15) {
    let ans = {}, st = engine.step(ans), n = 0;
    while (!st.done && n < maxSteps) { ans = engine.applyAnswer(ans, st.next, truthAnswer(st.next, truth)); st = engine.step(ans); n++; }
    return { ans, st, clicks: (ans._asked || []).length };
  }
  // static baseline: fixed order, like a normal onboarding (first K screens)
  const STATIC_ORDER = ['group', 'budget', 'base', 'mode', 'deal', 'card', 'card', 'card'];
  function runStatic(engine, truth, k) {
    let ans = {};
    for (let i = 0; i < k; i++) {
      const id = STATIC_ORDER[i];
      const st = engine.step(ans);
      let q = st.cands.find(c => c.id === id);
      if (id === 'deal' && !q) { // static forms always show every item
        q = { id: 'deal', items: BOOL_ITEMS.filter(it => ans[it.key] == null) };
      }
      if (!q) continue;
      if (id === 'deal') q = { id: 'deal', items: BOOL_ITEMS.filter(it => ans[it.key] == null) };
      ans = engine.applyAnswer(ans, q, truthAnswer(q, truth));
    }
    const st = engine.step(ans);
    return { ans, st, clicks: k };
  }

  const API = { mulberry32, makeListings, createEngine, sampleStudent, PRIOR, BOOL_ITEMS, ANCHORS, travel, runAdaptive, runStatic, truthAnswer, STATIC_ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.HTL = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
