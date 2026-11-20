/* Hack the Lease — adaptive onboarding engine (TypeScript port of prototype/engine.js).
 * Keeps a cloud of possible students (particles) consistent with the answers so far.
 * Next question = highest expected information gain about "which apartment is best".
 * Stop after at most `maxScreens` required screens, or earlier once P(true best in top 3) >= tau.
 * ALL listings and student profiles are SYNTHETIC ("Example" data). Pure TS — runs in browser and server.
 */

// ---------- seeded RNG ----------
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick<K extends string>(rng: () => number, dist: Record<K, number>): K {
  const u = rng(); let acc = 0; let last!: K;
  for (const k in dist) { acc += dist[k]; last = k; if (u < acc) return k; }
  return last;
}
function erf(x: number) {
  const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export function PhiInv(p: number): number { // Acklam
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

// ---------- types ----------
export type Campus = 'Central' | 'North' | 'Medical';
export type Base = Campus | 'Split';
export type Mode = 'walk' | 'bus' | 'bike' | 'drive';
export const BASES: Base[] = ['Central', 'North', 'Medical', 'Split'];
export const MODES: Mode[] = ['walk', 'bus', 'bike', 'drive'];

/** The fields the engine scores on. App listings (lib/types.ts) extend this. */
export interface EngineListing {
  id: string; name: string; hood: string;
  beds: number; rent: number; // rent = whole-unit monthly total
  quality: number; inUnit: boolean; parking: boolean; ac: boolean; pets: boolean; leaseAny: boolean;
  quiet: number; dist: Record<Campus, number>; coord: [number, number];
  /** optional precomputed one-way minutes (data/commute.json). Falls back to travel(). */
  commute?: Partial<Record<Campus, Partial<Record<Mode, number>>>>;
}
export interface Student {
  base: Base; mode: Mode; group: number; budget: number; alpha: number;
  parking: boolean; laundry: boolean; pet: boolean; ac: boolean; quiet: boolean; leaseFlex: boolean;
}
export type BoolKey = 'parking' | 'laundry' | 'pet' | 'ac' | 'quiet' | 'leaseFlex';
export interface Answers {
  base?: Base; mode?: Mode; group?: number; budget?: number;
  alphaLo?: number; alphaHi?: number; cards?: number;
  parking?: boolean; laundry?: boolean; pet?: boolean; ac?: boolean; quiet?: boolean; leaseFlex?: boolean;
  _asked?: string[]; _cardLog?: { threshold: number; dollars: number; value: string }[];
}

// ---------- geography (approximate public coordinates) ----------
export const ANCHORS: Record<Campus, [number, number]> = {
  Central: [42.2768, -83.7382], // the Diag
  North: [42.2914, -83.7174],   // Pierpont / BBB area
  Medical: [42.2840, -83.7290], // Michigan Medicine
};
export const DETOUR = 1.3;
export const WALK_MIN_PER_KM = 12.5;
export function km(a: [number, number], b: [number, number]) {
  const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x)) * DETOUR; // street detour factor
}
/** one-way minutes by mode (simple, explainable assumptions — prototype model) */
export function travel(distKm: number, mode: Mode, anchor: Campus) {
  const walk = WALK_MIN_PER_KM * distKm;
  if (mode === 'walk') return walk;
  if (mode === 'bike') return 2 + 4 * distKm;
  if (mode === 'bus') return Math.min(walk, 12 + 2.5 * distKm);
  return 6 + 2 * distKm + (anchor === 'Central' ? 8 : 4);
}
function legMinutes(l: EngineListing, campus: Campus, mode: Mode) {
  const pre = l.commute?.[campus]?.[mode];
  return pre != null ? pre : travel(l.dist[campus], mode, campus);
}

// ---------- SYNTHETIC listings (prototype set; app data lives in data/listings.json) ----------
export const HOODS = [
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
] as { name: string; c: [number, number]; rent: number; quiet: number }[];
export const STREETS = ['Maple', 'Hill', 'State', 'Packard', 'Division', 'Fuller', 'Huron', 'Geddes', 'Liberty', 'Catherine', 'Traver', 'Murfin', 'Washtenaw', 'Kingsley', 'Ann', 'Hoover'];
export const KINDS = ['Lofts', 'Flats', 'House', 'Commons', 'Court', 'Place', 'Terrace', 'Residences'];

export function distances(c: [number, number]): Record<Campus, number> {
  return { Central: km(c, ANCHORS.Central), North: km(c, ANCHORS.North), Medical: km(c, ANCHORS.Medical) };
}
/** hedonic per-bed price used by both the prototype set and data/listings.json */
export function hedonicPerBed(dist: Record<Campus, number>, beds: number, quality: number, inUnit: boolean, parking: boolean, ac: boolean, hoodQuiet: number, noise: number) {
  const locPremium = 420 * Math.exp(-dist.Central / 1.0) + 220 * Math.exp(-dist.North / 0.9) + 80 * Math.exp(-dist.Medical / 0.8);
  const sizeAdj = beds === 1 ? 1.3 : beds === 2 ? 1.08 : 1;
  return (720 + locPremium + 380 * quality + (inUnit ? 60 : 0) + (parking ? 40 : 0) + (ac ? 30 : 0) + (hoodQuiet - 0.5) * 60) * sizeAdj * noise;
}

export function makeListings(seed: number): EngineListing[] {
  const rng = mulberry32(seed);
  const L: EngineListing[] = [];
  const count = 120, bedsPlan: number[] = [];
  for (let i = 0; i < count; i++) bedsPlan.push([1, 1, 2, 2, 2, 3, 3, 4, 4, 5][Math.floor(rng() * 10)]);
  bedsPlan.forEach((beds, i) => {
    const h = HOODS[i % HOODS.length];
    const c: [number, number] = [h.c[0] + (rng() - 0.5) * 0.004, h.c[1] + (rng() - 0.5) * 0.005];
    const dist = distances(c);
    const inUnit = rng() < (beds >= 4 ? 0.65 : 0.5);
    const parking = rng() < (dist.Central > 2.2 ? 0.8 : 0.3);
    const ac = rng() < 0.6, pets = rng() < 0.35, leaseAny = rng() < 0.3;
    const quality = Math.round(rng() * 100) / 100;
    const perBed = hedonicPerBed(dist, beds, quality, inUnit, parking, ac, h.quiet, 0.95 + rng() * 0.1);
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
export type Prior = {
  base: Record<Base, number>;
  modeGivenBase: Record<Base, Record<Mode, number>>;
  group: Record<string, number>;
  budget: { mean: number; sd: number; min: number; max: number };
  alpha: { median: number; logSd: number; min: number; max: number };
  parkingGivenMode: Record<Mode, number>;
  laundry: number; pet: number; ac: number; quiet: number; leaseFlex: number;
};
export const PRIOR: Prior = {
  base: { Central: 0.5, North: 0.25, Medical: 0.1, Split: 0.15 },
  modeGivenBase: {
    Central: { walk: 0.6, bus: 0.15, bike: 0.15, drive: 0.1 },
    North: { walk: 0.2, bus: 0.55, bike: 0.1, drive: 0.15 },
    Medical: { walk: 0.35, bus: 0.3, bike: 0.1, drive: 0.25 },
    Split: { walk: 0.25, bus: 0.5, bike: 0.15, drive: 0.1 },
  },
  group: { 1: 0.2, 2: 0.25, 3: 0.2, 4: 0.25, 5: 0.1 },
  budget: { mean: 1150, sd: 260, min: 650, max: 2000 },
  alpha: { median: 25, logSd: 0.6, min: 5, max: 120 },
  parkingGivenMode: { drive: 0.95, walk: 0.03, bus: 0.05, bike: 0.05 },
  laundry: 0.5, pet: 0.12, ac: 0.4, quiet: 0.4, leaseFlex: 0.15,
};
export const BOOL_ITEMS: { key: BoolKey; label: string }[] = [
  { key: 'parking', label: 'I need a parking spot' },
  { key: 'laundry', label: 'In-unit laundry is a must' },
  { key: 'pet', label: 'I have a pet' },
  { key: 'ac', label: 'I want air conditioning' },
  { key: 'quiet', label: 'I study at home — I need it quiet' },
  { key: 'leaseFlex', label: "I can't do an August start (e.g. January)" },
];

export function sampleStudent(rng: () => number, ans: Answers, prior: Prior = PRIOR): { s: Student; w: number } {
  let w = 1;
  const base: Base = ans.base ?? pick(rng, prior.base);
  const pm = prior.modeGivenBase[base];
  let mode: Mode;
  if (ans.mode) { mode = ans.mode; w *= pm[ans.mode]; } else mode = pick(rng, pm);
  const group = ans.group ?? +pick(rng, prior.group);
  let budget: number;
  if (ans.budget != null) budget = ans.budget;
  else { const B = prior.budget; budget = Math.min(B.max, Math.max(B.min, B.mean + B.sd * PhiInv(rng()))); }
  const A = prior.alpha, lo = ans.alphaLo ?? A.min, hi = ans.alphaHi ?? A.max;
  const zlo = Phi((Math.log(lo) - Math.log(A.median)) / A.logSd), zhi = Phi((Math.log(hi) - Math.log(A.median)) / A.logSd);
  const alpha = Math.exp(Math.log(A.median) + A.logSd * PhiInv(zlo + rng() * (zhi - zlo)));
  const pp = prior.parkingGivenMode[mode];
  let parking: boolean;
  if (ans.parking != null) { parking = ans.parking; w *= ans.parking ? pp : 1 - pp; } else parking = rng() < pp;
  const s: Student = { base, mode, group, budget, alpha, parking, laundry: false, pet: false, ac: false, quiet: false, leaseFlex: false };
  for (const k of ['laundry', 'pet', 'ac', 'quiet', 'leaseFlex'] as const) s[k] = ans[k] ?? (rng() < prior[k]);
  return { s, w };
}

// ---------- utility: $-equivalent per person per month (higher = better) ----------
export const TRIPS_PER_MONTH = 2 * 20;
export function oneWayMinutes(st: Pick<Student, 'base' | 'mode'>, l: EngineListing) {
  if (st.base === 'Split') return (legMinutes(l, 'Central', st.mode) + legMinutes(l, 'North', st.mode)) / 2;
  return legMinutes(l, st.base, st.mode);
}
export interface Evaluation { u: number; cost: number; mins: number; hours: number; timeCost: number; bonus: number; qualityValue: number; over: number }
/** Hard filters (size, parking, laundry, pets, lease start) then utility
 *  u = −cost − α·commuteHours + 0.3·budget·quality + AC/quiet bonuses − 4·overBudget */
export function evaluate(st: Student, l: EngineListing): Evaluation | null {
  if (l.beds < st.group || l.beds > st.group + 1) return null;
  if (st.parking && !l.parking) return null;
  if (st.laundry && !l.inUnit) return null;
  if (st.pet && !l.pets) return null;
  if (st.leaseFlex && !l.leaseAny) return null;
  const cost = l.rent / st.group;
  const mins = oneWayMinutes(st, l);
  const hours = mins * TRIPS_PER_MONTH / 60;
  const timeCost = st.alpha * hours;
  const qualityValue = 0.3 * st.budget * l.quality;
  const bonus = qualityValue + (st.ac && l.ac ? 60 : 0) + (st.quiet ? 150 * l.quiet : 0) + (l.beds > st.group ? 40 : 0);
  const over = Math.max(0, cost - st.budget);
  const u = -cost - timeCost + bonus - 4 * over;
  return { u, cost, mins, hours, timeCost, bonus, qualityValue, over };
}
export function bestListing(st: Student, listings: EngineListing[]) {
  let best = -1, bu = -Infinity;
  for (let j = 0; j < listings.length; j++) { const e = evaluate(st, listings[j]); if (e && e.u > bu) { bu = e.u; best = j; } }
  return best;
}

// ---------- information theory ----------
export interface Particle { s: Student; w: number; best: number }
export function entropy(counts: Record<string, number>, total: number) {
  let h = 0; for (const k in counts) { const p = counts[k] / total; if (p > 0) h -= p * Math.log2(p); } return h;
}
function distOf(pool: Particle[]) {
  const c: Record<string, number> = {}; let tot = 0;
  for (const p of pool) { c[p.best] = (c[p.best] || 0) + p.w; tot += p.w; }
  return { c, tot };
}
/** gain(q) = H(best) − Σ P(a)·H(best | a) */
export function expectedGain(pool: Particle[], keyFn: (s: Student) => string | number) {
  const { c, tot } = distOf(pool);
  const H = entropy(c, tot);
  const groups: Record<string, Particle[]> = {};
  for (const p of pool) { const k = String(keyFn(p.s)); (groups[k] = groups[k] || []).push(p); }
  let EH = 0; const answers: Record<string, number> = {};
  for (const k in groups) { const d = distOf(groups[k]); EH += (d.tot / tot) * entropy(d.c, d.tot); answers[k] = d.tot / tot; }
  return { gain: H - EH, answers };
}

export function weightedMedian(vals: { v: number; w: number }[]) {
  vals.sort((a, b) => a.v - b.v); const tot = vals.reduce((s, x) => s + x.w, 0); let acc = 0;
  for (const x of vals) { acc += x.w; if (acc >= tot / 2) return x.v; } return vals[vals.length - 1].v;
}
export const BUDGET_BINS = [800, 950, 1100, 1250, 1400, 1600];
export const binOf = (b: number) => { const i = BUDGET_BINS.findIndex(x => b < x); return i === -1 ? BUDGET_BINS.length : i; };

export interface QItem { key: BoolKey; label: string; gain: number; answers: Record<string, number>; pYes: number }
export interface Question {
  id: 'base' | 'mode' | 'group' | 'budget' | 'card' | 'deal';
  type: 'choice' | 'slider' | 'card' | 'multi';
  title: string; options?: string[]; threshold?: number; dollars?: number;
  items?: QItem[]; hidden?: QItem[];
  gain: number; answers: Record<string, number>;
}
export interface Assumption { key: string; text: string; p: number; value?: boolean }
export interface RankRow { idx: number; p: number }
export interface StepResult {
  pool: Particle[]; rank: RankRow[]; conf: number; cands: Question[]; next: Question | null;
  done: boolean; reason: string; assumptions: Assumption[]; candidatesOptional: Assumption[]; clicks: number;
}
export interface EngineOpts {
  listings?: EngineListing[]; listingSeed?: number; poolSize?: number; tau?: number; minGain?: number;
  itemMinGain?: number; maxCards?: number; predictable?: number; seed?: number; maxScreens?: number; prior?: Prior;
}

export function createEngine(opts: EngineOpts = {}) {
  const listings = opts.listings || makeListings(opts.listingSeed ?? 7);
  const N = opts.poolSize ?? 2500;
  const tau = opts.tau ?? 0.95;
  const minGain = opts.minGain ?? 0.03;
  const itemMinGain = opts.itemMinGain ?? 0.02;
  const maxCards = opts.maxCards ?? 3;
  const predictable = opts.predictable ?? 0.05;
  const seed = opts.seed ?? 1;
  const maxScreens = opts.maxScreens ?? Infinity;
  const prior = opts.prior ?? PRIOR;

  function buildPool(ans: Answers): Particle[] {
    const rng = mulberry32(seed * 7919 + 17);
    const pool: Particle[] = [];
    for (let i = 0; i < N; i++) { const { s, w } = sampleStudent(rng, ans, prior); if (w > 0) pool.push({ s, w, best: bestListing(s, listings) }); }
    return pool;
  }
  function ranking(pool: Particle[]): RankRow[] {
    const { c, tot } = distOf(pool);
    return Object.keys(c).map(k => ({ idx: +k, p: c[k] / tot })).sort((a, b) => b.p - a.p);
  }
  function confidence(rank: RankRow[]) { return rank.slice(0, 3).reduce((s, r) => s + r.p, 0); }

  function candidates(ans: Answers, pool: Particle[]): Question[] {
    const out: Question[] = [];
    if (ans.base == null) out.push({ id: 'base', type: 'choice', title: 'Where does most of your week happen?', options: ['Central', 'North', 'Medical', 'Split'], ...expectedGain(pool, s => s.base) });
    if (ans.mode == null) out.push({ id: 'mode', type: 'choice', title: 'How do you usually get to class?', options: ['walk', 'bus', 'bike', 'drive'], ...expectedGain(pool, s => s.mode) });
    if (ans.group == null) out.push({ id: 'group', type: 'choice', title: 'How many people will live together (including you)?', options: ['1', '2', '3', '4', '5'], ...expectedGain(pool, s => String(s.group)) });
    if (ans.budget == null) out.push({ id: 'budget', type: 'slider', title: 'Max rent per person per month?', ...expectedGain(pool, s => binOf(s.budget)) });
    const cards = ans.cards || 0;
    if (cards < maxCards) {
      const med = weightedMedian(pool.map(p => ({ v: p.s.alpha, w: p.w })));
      const save = Math.round(med * (10 * TRIPS_PER_MONTH / 60) / 5) * 5;
      const g = expectedGain(pool, s => s.alpha >= med ? 'yes' : 'no');
      out.push({ id: 'card', type: 'card', threshold: med, dollars: save, title: `Would you pay $${save} more per month to save 10 minutes on every one-way trip?`, ...g });
    }
    // dealbreaker grid: item shown only if it can change the result AND it is not >=95% predictable
    const items: QItem[] = BOOL_ITEMS.filter(it => ans[it.key] == null).map(it => {
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

  function share(pool: Particle[], f: (s: Student) => boolean) {
    const tot = pool.reduce((s, p) => s + p.w, 0);
    return pool.reduce((s, p) => s + (f(p.s) ? p.w : 0), 0) / tot;
  }
  /** P(cares) >= 80% → "assumed" chip */
  function assumptions(ans: Answers, pool: Particle[]): Assumption[] {
    const out: Assumption[] = [];
    if (ans.mode == null) for (const m of MODES) { const q = share(pool, s => s.mode === m); if (q >= 0.5) out.push({ key: 'mode', text: `You probably ${m === 'bus' ? 'take the bus' : m}`, p: q }); }
    for (const it of BOOL_ITEMS) if (ans[it.key] == null) {
      const q = share(pool, s => s[it.key]);
      out.push({ key: it.key, text: (q >= 0.5 ? '' : 'No: ') + it.label.replace("I can't do", 'Cannot do').replace(/^I /, 'You '), p: Math.max(q, 1 - q), value: q >= 0.5 });
    }
    return out.filter(a => a.p >= 0.8);
  }
  /** 20–80% → candidate optional question */
  function optionalCandidates(ans: Answers, pool: Particle[]): Assumption[] {
    const out: Assumption[] = [];
    for (const it of BOOL_ITEMS) if (ans[it.key] == null) {
      const q = share(pool, s => s[it.key]);
      if (q >= 0.2 && q <= 0.8) out.push({ key: it.key, text: it.label, p: q });
    }
    return out;
  }

  function step(ans: Answers): StepResult {
    const pool = buildPool(ans);
    const rank = ranking(pool);
    const conf = confidence(rank);
    const cands = candidates(ans, pool);
    const asked = ans._asked || [];
    let done = false, reason = '';
    if (conf >= tau) { done = true; reason = `Confident: ${(conf * 100).toFixed(0)}% chance your true best apartment is in this top 3 (target ${(tau * 100).toFixed(0)}%).`; }
    else if (!cands.length || cands[0].gain < minGain) { done = true; reason = `No remaining question is worth a click (best one would only add ${cands.length ? cands[0].gain.toFixed(3) : 0} bits).`; }
    else if (asked.length >= maxScreens) { done = true; reason = `That's all ${maxScreens} required screens. ${(conf * 100).toFixed(0)}% sure your best place is in this top 3 — sharpen your matches to go higher.`; }
    return { pool, rank, conf, cands, next: done ? null : cands[0], done, reason, assumptions: assumptions(ans, pool), candidatesOptional: optionalCandidates(ans, pool), clicks: asked.length };
  }

  function applyAnswer(ans: Answers, q: Pick<Question, 'id' | 'threshold' | 'dollars' | 'items'>, value: unknown): Answers {
    const a: Answers = { ...ans, _asked: [...(ans._asked || []), q.id] };
    if (q.id === 'base') a.base = value as Base;
    else if (q.id === 'mode') a.mode = value as Mode;
    else if (q.id === 'group') a.group = +(value as string);
    else if (q.id === 'budget') a.budget = +(value as number);
    else if (q.id === 'card') {
      a.cards = (ans.cards || 0) + 1;
      if (value === 'yes') a.alphaLo = Math.max(ans.alphaLo ?? 0, q.threshold!); else a.alphaHi = Math.min(ans.alphaHi ?? 1e9, q.threshold!);
      a._cardLog = [...(ans._cardLog || []), { threshold: q.threshold!, dollars: q.dollars!, value: String(value) }];
    } else if (q.id === 'deal') { const v = value as Record<string, boolean>; for (const it of q.items || []) a[it.key] = !!v[it.key]; }
    return a;
  }

  /** answers + most likely values for the rest */
  function pointEstimate(ans: Answers, pool: Particle[]): Student {
    const tot = pool.reduce((s, p) => s + p.w, 0);
    const modeOf = <T,>(k: keyof Student, vals: T[]) => { let best = vals[0], bp = -1; for (const v of vals) { const q = pool.reduce((s, p) => s + ((p.s[k] as unknown) === v ? p.w : 0), 0); if (q > bp) { bp = q; best = v; } } return best; };
    const st: Student = { ...pool[0].s };
    st.base = ans.base ?? modeOf<Base>('base', BASES);
    st.mode = ans.mode ?? modeOf<Mode>('mode', MODES);
    st.group = ans.group ?? modeOf<number>('group', [1, 2, 3, 4, 5]);
    st.budget = ans.budget ?? weightedMedian(pool.map(p => ({ v: p.s.budget, w: p.w })));
    st.alpha = weightedMedian(pool.map(p => ({ v: p.s.alpha, w: p.w })));
    for (const it of BOOL_ITEMS) st[it.key] = ans[it.key] ?? (pool.reduce((s, p) => s + (p.s[it.key] ? p.w : 0), 0) / tot >= 0.5);
    return st;
  }
  /** weighted quantile of α in the posterior — used for the "time is worth $X–$Y" line */
  function alphaRange(pool: Particle[], lo = 0.25, hi = 0.75) {
    const v = pool.map(p => ({ v: p.s.alpha, w: p.w })).sort((a, b) => a.v - b.v);
    const tot = v.reduce((s, x) => s + x.w, 0); let acc = 0; let a = v[0].v, b = v[v.length - 1].v; let gotA = false;
    for (const x of v) { acc += x.w; if (!gotA && acc >= lo * tot) { a = x.v; gotA = true; } if (acc >= hi * tot) { b = x.v; break; } }
    return [a, b] as [number, number];
  }

  return { listings, step, applyAnswer, pointEstimate, alphaRange, explain: evaluate, evaluate, bestListing, buildPool, opts: { N, tau, minGain, itemMinGain, maxCards, predictable, maxScreens } };
}
export type Engine = ReturnType<typeof createEngine>;

// ---------- simulation helpers ----------
export function truthAnswer(q: Pick<Question, 'id' | 'threshold' | 'items'>, truth: Student): unknown {
  if (q.id === 'base') return truth.base;
  if (q.id === 'mode') return truth.mode;
  if (q.id === 'group') return String(truth.group);
  if (q.id === 'budget') return Math.round(truth.budget / 25) * 25;
  if (q.id === 'card') return truth.alpha >= q.threshold! ? 'yes' : 'no';
  if (q.id === 'deal') { const v: Record<string, boolean> = {}; for (const it of q.items || []) v[it.key] = truth[it.key]; return v; }
}
export function runAdaptive(engine: Engine, truth: Student, maxSteps = 15, answerFn = truthAnswer) {
  let ans: Answers = {}, st = engine.step(ans), n = 0;
  while (!st.done && n < maxSteps) { ans = engine.applyAnswer(ans, st.next!, answerFn(st.next!, truth)); st = engine.step(ans); n++; }
  return { ans, st, clicks: (ans._asked || []).length };
}
export const STATIC_ORDER: Question['id'][] = ['group', 'budget', 'base', 'mode', 'deal', 'card', 'card', 'card'];
export function runStatic(engine: Engine, truth: Student, k: number) {
  let ans: Answers = {};
  for (let i = 0; i < k; i++) {
    const id = STATIC_ORDER[i];
    const st = engine.step(ans);
    let q: Pick<Question, 'id' | 'threshold' | 'dollars' | 'items'> | undefined = st.cands.find(c => c.id === id);
    if (id === 'deal') q = { id: 'deal', items: BOOL_ITEMS.filter(it => ans[it.key] == null) as QItem[] }; // static forms show every item
    if (!q) continue;
    ans = engine.applyAnswer(ans, q, truthAnswer(q, truth));
  }
  const st = engine.step(ans);
  return { ans, st, clicks: k };
}
