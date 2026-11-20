/* The app layer around the engine: a student's Profile ↔ engine Answers, listing sets per
 * living situation and non-negotiables, the onboarding step, ranking and the ID card.
 * Pure TS: used by API routes, tests and the simulation script. */
import { createEngine, BOOL_ITEMS, type Answers, type Base, type Mode, type Engine, type Question, type Student, type EngineListing, type BoolKey } from './engine';
import { LISTINGS, byId } from './data';
import type { Listing } from './types';

export type Living = 'alone' | 'friend' | 'group' | 'match';
/** Non-negotiables that are not engine particles: applied as hard filters on the listing set. */
export type ExtraMust = 'night' | 'private_bath' | 'nofees' | 'furnished';
export type ScoreState = 'must' | 'nice' | 'dont_care';

export interface Profile {
  living?: Living; groupN?: number; // for 'group': 3, 4 or 5
  base?: Base; mode?: Mode; budget?: number; hardBudget?: boolean;
  alphaLo?: number; alphaHi?: number; cards?: number;
  deal?: Partial<Record<BoolKey, boolean>>;
  extra?: ExtraMust[];
  scorecard?: Record<string, ScoreState>;
  asked?: string[];
  cardLog?: { threshold: number; dollars: number; value: string }[];
}

export const MAX_SCREENS = 5;
export const TAU = 0.95;
export const POOL = 2500;

export function groupOf(p: Profile): number | undefined {
  if (p.living === 'alone' || p.living === 'match') return 1;
  if (p.living === 'friend') return 2;
  if (p.living === 'group') return p.groupN ?? 3;
  return undefined;
}
export function livingFromGroup(g: number): Living { return g === 1 ? 'alone' : g === 2 ? 'friend' : 'group'; }

export function toAnswers(p: Profile): Answers {
  const a: Answers = { _asked: p.asked ?? [] };
  const g = groupOf(p); if (g != null) a.group = g;
  if (p.base) a.base = p.base;
  if (p.mode) a.mode = p.mode;
  if (p.budget != null) a.budget = p.budget;
  if (p.alphaLo != null) a.alphaLo = p.alphaLo;
  if (p.alphaHi != null) a.alphaHi = p.alphaHi;
  if (p.cards) a.cards = p.cards;
  for (const k of Object.keys(p.deal ?? {}) as BoolKey[]) a[k] = p.deal![k];
  // scorecard "must" on an engine attribute = answered yes; "dont_care" = answered no
  for (const it of BOOL_ITEMS) { const s = p.scorecard?.[it.key]; if (s === 'must') a[it.key] = true; else if (s === 'dont_care' && a[it.key] == null) a[it.key] = false; }
  return a;
}

export function nightSafe(l: Listing) { return (l.night.litShare >= 0.8 && l.night.walkMin <= 25) || l.owlZone; }

/** "Match me" students rent one bed in a per-bed building with roommate matching: we expose those as 1-bed engine units at the per-bed price. */
function listingSet(p: Profile): EngineListing[] {
  const extra = new Set([...(p.extra ?? []), ...Object.entries(p.scorecard ?? {}).filter(([, v]) => v === 'must').map(([k]) => k as ExtraMust)]);
  let L: Listing[] = LISTINGS;
  if (extra.has('night')) L = L.filter(nightSafe);
  if (extra.has('private_bath')) L = L.filter(l => l.amenities.private_bath);
  if (extra.has('furnished')) L = L.filter(l => l.amenities.furnished);
  if (extra.has('nofees')) L = L.filter(l => l.required_fees !== null && l.required_fees.length === 0);
  if (p.living === 'match') return L.filter(l => l.price_basis === 'per_bed' && (l.roommate_matching || l.lease_type !== 'joint')).map(l => ({ ...l, beds: 1, rent: l.price_amount }));
  if (p.hardBudget && p.budget != null) { const g = groupOf(p); if (g) L = L.filter(l => l.unit_total / g <= p.budget!); }
  return L;
}
function setKey(p: Profile) {
  const ms = Object.entries(p.scorecard ?? {}).filter(([, v]) => v === 'must').map(([k]) => k).sort().join(',');
  return [p.living === 'match' ? 'match' : 'std', (p.extra ?? []).slice().sort().join(','), ms, p.hardBudget ? `hard${p.budget}g${groupOf(p)}` : ''].join('|');
}
const cache = new Map<string, Engine>();
export function engineFor(p: Profile, opts: { poolSize?: number; tau?: number } = {}): Engine {
  const key = setKey(p) + `|${opts.poolSize ?? POOL}|${opts.tau ?? TAU}`;
  let e = cache.get(key);
  if (!e) {
    e = createEngine({ listings: listingSet(p), poolSize: opts.poolSize ?? POOL, tau: opts.tau ?? TAU, maxScreens: MAX_SCREENS, seed: 1 });
    if (cache.size > 64) cache.clear();
    cache.set(key, e);
  }
  return e;
}
export const listingOf = (e: Engine, idx: number) => byId.get(e.listings[idx].id)!;

// ---------- UI question shapes (copy from design/Onboarding.dc.html) ----------
export interface UIOption { value: string; label: string }
export interface UIQuestion {
  id: Question['id']; kind: 'choice' | 'budget' | 'trade' | 'must';
  title: string; sub: string; why: string; gainBits: number;
  options?: UIOption[];
  trade?: { a: { label: string; cost: string; mins: string }; b: { label: string; cost: string; mins: string }; dollars: number; threshold: number };
  chips?: { value: string; label: string; engine: boolean }[];
}
const MUST_CHIPS: { value: string; label: string; key?: BoolKey; extra?: ExtraMust }[] = [
  { value: 'night', label: 'Safe walk home at night', extra: 'night' },
  { value: 'quiet', label: 'Quiet', key: 'quiet' },
  { value: 'laundry', label: 'In-unit laundry', key: 'laundry' },
  { value: 'ac', label: 'AC', key: 'ac' },
  { value: 'pet', label: 'Pets OK', key: 'pet' },
  { value: 'parking', label: 'Parking', key: 'parking' },
  { value: 'leaseFlex', label: 'Non-August start', key: 'leaseFlex' },
  { value: 'private_bath', label: 'Private bath', extra: 'private_bath' },
  { value: 'nofees', label: 'No surprise fees', extra: 'nofees' },
];
export const MUST_CHIP_LIST = MUST_CHIPS;

function whyLine(q: Question, skipped: string[]): string {
  const bits = q.gain.toFixed(2);
  const skip = skipped.length ? ` We skipped ${skipped.join(' and ')} — we can predict it.` : '';
  if (q.id === 'group') return `Asked first — it rules out about half the listings (${bits} bits).${skip}`;
  if (q.id === 'mode') return `Your answer predicts whether you need parking (${bits} bits).${skip}`;
  if (q.id === 'base') return `Your top 3 still differ on this, so it’s worth one tap (${bits} bits).${skip}`;
  if (q.id === 'budget') return `We rank on true monthly cost, so hidden fees can’t sneak in (${bits} bits).${skip}`;
  if (q.id === 'card') return `One tap tells us what your time is worth to you (${bits} bits).${skip}`;
  return `Only the items that still change your top 3 are shown (${bits} bits).${skip}`;
}

export function toUIQuestion(q: Question, p: Profile): UIQuestion {
  if (q.id === 'group') return { id: q.id, kind: 'choice', gainBits: q.gain, title: 'Who are you living with?', sub: 'This decides per-bed or whole-unit leases.', why: whyLine(q, []), options: [{ value: 'alone', label: 'Just me' }, { value: 'friend', label: 'Me + 1 friend' }, { value: 'group', label: 'A group of 3+' }, { value: 'match', label: 'Match me with roommates' }] };
  if (q.id === 'mode') return { id: q.id, kind: 'choice', gainBits: q.gain, title: 'How will you get to class?', sub: 'We use bus timetables, not straight-line distance.', why: whyLine(q, ['“Need parking?”']), options: [{ value: 'walk', label: 'Walk' }, { value: 'bus', label: 'Bus (free with MCard)' }, { value: 'bike', label: 'Bike' }, { value: 'drive', label: 'Car' }] };
  if (q.id === 'base') return { id: q.id, kind: 'choice', gainBits: q.gain, title: 'Where are most of your classes?', sub: 'Or import your schedule below.', why: whyLine(q, []), options: [{ value: 'Central', label: 'Central Campus' }, { value: 'North', label: 'North Campus' }, { value: 'Medical', label: 'Medical Campus' }, { value: 'Split', label: 'A mix' }] };
  if (q.id === 'budget') return { id: q.id, kind: 'budget', gainBits: q.gain, title: 'What can you spend?', sub: 'Your share, including utilities and fees.', why: whyLine(q, []) };
  if (q.id === 'card') {
    const d = q.dollars!;
    return {
      id: q.id, kind: 'trade', gainBits: q.gain, title: 'Which would you pick?', sub: 'Same size, same quality.', why: whyLine(q, []),
      trade: { a: { label: 'Cheaper, farther', cost: `$${d} less / mo`, mins: '+10 min each way' }, b: { label: 'Closer, pricier', cost: `$${d} more / mo`, mins: '10 min shorter each way' }, dollars: d, threshold: q.threshold! },
    };
  }
  const shownKeys = new Set((q.items ?? []).map(i => i.key));
  const chips = MUST_CHIPS.filter(c => (c.key ? shownKeys.has(c.key) : true) && !(c.key === 'parking' && p.mode === 'walk')).map(c => ({ value: c.value, label: c.label, engine: !!c.key }));
  const hidden = (q.hidden ?? []).map(h => MUST_CHIPS.find(c => c.key === h.key)?.label).filter(Boolean) as string[];
  return { id: 'deal', kind: 'must', gainBits: q.gain, title: 'What won’t you compromise on?', sub: 'Pick up to 3.', why: whyLine(q, hidden.slice(0, 2).map(h => `“${h}”`)), chips };
}

/** Apply a UI answer to the profile (mirrors engine.applyAnswer). */
export function applyUIAnswer(p: Profile, q: Pick<Question, 'id' | 'threshold' | 'dollars' | 'items'>, value: unknown): Profile {
  const n: Profile = { ...p, asked: [...(p.asked ?? []), q.id] };
  if (q.id === 'group') { const v = value as string; if (['alone', 'friend', 'group', 'match'].includes(v)) n.living = v as Living; else { const g = +v; n.living = livingFromGroup(g); if (g >= 3) n.groupN = g; } }
  else if (q.id === 'base') n.base = value as Base;
  else if (q.id === 'mode') n.mode = value as Mode;
  else if (q.id === 'budget') n.budget = +(value as number);
  else if (q.id === 'card') {
    n.cards = (p.cards ?? 0) + 1;
    const yes = value === 'yes' || value === 'b';
    if (yes) n.alphaLo = Math.max(p.alphaLo ?? 0, q.threshold!); else n.alphaHi = Math.min(p.alphaHi ?? 1e9, q.threshold!);
    n.cardLog = [...(p.cardLog ?? []), { threshold: q.threshold!, dollars: q.dollars!, value: yes ? 'yes' : 'no' }];
  } else if (q.id === 'deal') {
    const picks = Array.isArray(value) ? (value as string[]) : Object.keys(value as object).filter(k => (value as Record<string, boolean>)[k]);
    const deal: Partial<Record<BoolKey, boolean>> = { ...(p.deal ?? {}) };
    for (const it of q.items ?? []) deal[it.key] = picks.includes(it.key);
    for (const c of MUST_CHIPS) if (c.key && picks.includes(c.value)) deal[c.key] = true;
    n.deal = deal;
    n.extra = Array.from(new Set([...(p.extra ?? []), ...MUST_CHIPS.filter(c => c.extra && picks.includes(c.value)).map(c => c.extra!)]));
  }
  return n;
}

export interface StepOut {
  done: boolean; reason: string; screen: number; maxScreens: number;
  next: UIQuestion | null; rawNext: Pick<Question, 'id' | 'threshold' | 'dollars' | 'items'> | null;
  gain_table: { id: string; bits: number }[];
  confidence: number;
  top_candidates: { id: string; p: number }[];
  predicted_prefs: { key: string; text: string; p: number; value?: boolean }[];
  optional_questions: { key: string; text: string; p: number }[];
  matchCount: number; alphaRange: [number, number]; student: Student;
}

export function step(p: Profile, opts: { poolSize?: number; tau?: number } = {}): StepOut {
  const e = engineFor(p, opts);
  const ans = toAnswers(p);
  const st = e.step(ans);
  const student = e.pointEstimate(ans, st.pool);
  const next = st.next ? toUIQuestion(st.next, p) : null;
  const g = groupOf(p);
  const matchCount = e.listings.filter(l => (g == null || (l.beds >= g && l.beds <= g + 1)) && (p.budget == null || l.rent / (g ?? 1) <= p.budget * 1.0001)).length;
  return {
    done: st.done, reason: st.reason, screen: (p.asked ?? []).length, maxScreens: MAX_SCREENS,
    next, rawNext: st.next ? { id: st.next.id, threshold: st.next.threshold, dollars: st.next.dollars, items: st.next.items } : null,
    gain_table: st.cands.map(c => ({ id: c.id, bits: Math.round(c.gain * 1000) / 1000 })),
    confidence: st.conf,
    top_candidates: st.rank.filter(r => r.idx >= 0).slice(0, 9).map(r => ({ id: e.listings[r.idx].id, p: r.p })),
    predicted_prefs: st.assumptions, optional_questions: st.candidatesOptional,
    matchCount, alphaRange: e.alphaRange(st.pool), student,
  };
}

/** Rank every listing for this student: P(best) first, then utility under the point estimate. */
export function rankAll(p: Profile, opts: { poolSize?: number } = {}) {
  const e = engineFor(p, opts);
  const ans = toAnswers(p);
  const st = e.step(ans);
  const student = e.pointEstimate(ans, st.pool);
  const pBest = new Map(st.rank.filter(r => r.idx >= 0).map(r => [r.idx, r.p]));
  const rows = e.listings.map((l, idx) => ({ idx, id: l.id, p: pBest.get(idx) ?? 0, ev: e.evaluate(student, l) }))
    .filter(r => r.ev || r.p > 0)
    .sort((a, b) => (b.p - a.p) || ((b.ev?.u ?? -1e9) - (a.ev?.u ?? -1e9)));
  return { rows, student, conf: st.conf, engine: e, alphaRange: e.alphaRange(st.pool) };
}

export function engineListing(p: Profile, id: string): EngineListing | undefined {
  return engineFor(p).listings.find(l => l.id === id);
}
export { byId };
