/* Compare cards (PRD 2.1, 2.6) and the X-button bench (PRD 2.2, 2.3). Pure TS. */
import { trueMonthlyCost, type TrueCost } from './cost';
import { daysSince, byId, landlordName } from './data';
import { groupOf, rankAll, nightSafe, type Profile } from './session';
import type { Listing, Provenance } from './types';
import type { Mode, Student, Campus } from './engine';

export const REGRET_MIN_PER_TRIP = 15;
export const REGRET_DOLLARS = 75;

export type Tone = 'good' | 'bad' | 'ink';
export interface Cell { main: string; tone: Tone; sub?: string; provenance?: Provenance }
export interface Commute { minutes: number; mode: Mode | 'bike'; label: string; hoursPerWeek: number; waitMinPerWeek: number; every: string; provenance: 'Estimated' }

export function commuteFor(l: Listing, s: Pick<Student, 'base' | 'mode'>): Commute {
  const legs: Campus[] = s.base === 'Split' ? ['Central', 'North'] : [s.base as Campus];
  let minutes = 0, wait = 0; let mode: Commute['mode'] = s.mode; let every = '—';
  for (const c of legs) {
    const f = l.campusCommute[c];
    let m: number; let used: Commute['mode'];
    if (s.mode === 'drive') { m = f.drive; used = 'drive'; }
    else if (s.mode === 'bike') { m = f.bike; used = 'bike'; }
    else if (s.mode === 'bus') { if (f.walk <= f.bus.total) { m = f.walk; used = 'walk'; } else { m = f.bus.total; used = 'bus'; wait += f.bus.wait; every = `${f.bus.headwayDay} min`; } }
    else { m = f.walk; used = 'walk'; }
    minutes += m / legs.length; mode = used;
  }
  minutes = Math.round(minutes);
  const tripsPerWeek = 10;
  return {
    minutes, mode, label: mode === 'bus' ? 'bus' : mode === 'drive' ? 'car' : mode, every,
    hoursPerWeek: Math.round(minutes * tripsPerWeek / 60 * 10) / 10,
    waitMinPerWeek: Math.round(wait / legs.length * tripsPerWeek), provenance: 'Estimated',
  };
}

/** How sure are we — share of cost lines + must-have rows that are Listed/verified. Kept in engine/API; NOT rendered on Compare. */
export function confidenceBadge(l: Listing, cost: TrueCost): { level: 'High' | 'Medium' | 'Low'; share: number; estimated: string[] } {
  const rows: Provenance[] = [
    ...cost.lines.map(x => x.provenance),
    l.quietLabel ? 'Listed' : 'Unknown', 'Listed', 'Listed', 'Listed', 'Listed', // quiet, night, owl, transloc, laundry
  ];
  const share = rows.filter(x => x === 'Listed').length / rows.length;
  const verified = daysSince(l.verified_at) <= 7;
  const rentEstimated = cost.lines.find(x => x.key === 'rent')!.provenance !== 'Listed';
  let level: 'High' | 'Medium' | 'Low' = share >= 0.8 && verified ? 'High' : share >= 0.5 ? 'Medium' : 'Low';
  if (rentEstimated || l.price_basis == null) level = 'Low';
  return { level, share, estimated: cost.lines.filter(x => x.provenance !== 'Listed').map(x => `${x.label}: ${x.provenance}`) };
}

export interface CardOut {
  id: string; rank: number; tag: string; name: string; short: string; hood: string; landlord: string; photos: string[];
  verified: boolean; pBest: number; example: true;
  cost: TrueCost; total: number; leaseBadge: string;
  commute: Commute; regret: string; timeVsMoney: string | null;
  mustHaves: { night: Cell; owl: Cell; transloc: Cell; laundry: Cell; quiet: Cell };
  extras: { gym: string; groc: string; food: string; park: string; bus: string };
  roommateRisk: string; badge: ReturnType<typeof confidenceBadge>; coord: [number, number];
  overBudget: number; utility: number | null;
}

const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');

function cells(l: Listing): CardOut['mustHaves'] {
  const lit = l.night.litShare;
  const nightMain = l.hood.startsWith('Northwood') ? 'Campus path' : lit >= 0.85 ? 'Lit streets' : lit >= 0.65 ? 'Mostly lit' : 'Some dark blocks';
  const laundry = { in_unit: 'In unit', in_building: 'In building', basement: 'Basement', none: 'None' }[l.amenities.laundry];
  return {
    night: { main: nightMain, tone: lit >= 0.65 || nightMain === 'Campus path' ? 'good' : 'bad', sub: `${l.night.walkMin} min from the Diag · ${Math.round(lit * 100)}% lit · last bus ${l.night.lastBus}`, provenance: 'Estimated' },
    owl: l.owlZone ? { main: '$4 off', tone: 'good', sub: 'in zone · 8 PM–7 AM' } : { main: 'Outside zone', tone: 'bad', sub: 'full fare' },
    transloc: l.translocCovered ? { main: 'Covered', tone: 'good' } : { main: 'Not covered', tone: 'bad' },
    laundry: { main: laundry, tone: l.amenities.laundry === 'in_unit' ? 'good' : 'bad' },
    quiet: l.quietLabel ? { main: l.quietLabel, tone: l.quietLabel === 'Quiet street' ? 'good' : l.quietLabel === 'Busy weekends' ? 'bad' : 'ink' } : { main: 'Unknown', tone: 'ink', provenance: 'Unknown' },
  };
}

/** "What you'll regret / Watch out": weakest attribute vs the other cards, only when the gap is meaningful. */
export function regretLine(me: { total: number; commute: Commute }, others: { total: number; commute: Commute }[], budget?: number): string {
  const cands: { score: number; text: string }[] = [];
  const bestMin = Math.min(...others.map(o => o.commute.minutes));
  const cheapest = Math.min(...others.map(o => o.total));
  const minGap = me.commute.minutes - bestMin;
  const costGap = me.total - cheapest;
  if (minGap >= REGRET_MIN_PER_TRIP) cands.push({ score: minGap / REGRET_MIN_PER_TRIP, text: `${me.commute.minutes} min each way — ${minGap} min longer than your closest option` });
  if (costGap >= REGRET_DOLLARS) cands.push({ score: costGap / REGRET_DOLLARS, text: `${money(costGap)} a month more than your cheapest option` });
  if (budget != null && me.total - budget >= REGRET_DOLLARS) cands.push({ score: (me.total - budget) / REGRET_DOLLARS + 0.5, text: `${money(me.total - budget)} over your budget` });
  if (!cands.length) return 'No big trade-off against your priorities';
  cands.sort((a, b) => b.score - a.score);
  return cands[0].text;
}

/** Time vs money vs card #1: price of an hour = extra monthly cost ÷ hours saved per month. "Worth it" only if below the student's value of time. */
export function timeVsMoney(me: { total: number; commute: Commute }, ref: { total: number; commute: Commute }, alpha: number, refLabel = '#1'): string | null {
  const dCost = me.total - ref.total;
  const dHoursMonth = (ref.commute.hoursPerWeek - me.commute.hoursPerWeek) * 4.3; // hours this place saves vs ref
  if (Math.abs(dHoursMonth) < 0.5 || Math.abs(dCost) < 10) {
    if (Math.abs(dCost) >= 10) return dCost > 0 ? `${money(dCost)} more than ${refLabel} for about the same commute.` : `${money(dCost)} less than ${refLabel} for about the same commute.`;
    return null;
  }
  const a = Math.round(alpha);
  if (dCost > 0 && dHoursMonth > 0) {
    const price = dCost / dHoursMonth;
    return `Costs ${money(dCost)} more a month than ${refLabel} but gives you back ${dHoursMonth.toFixed(1)} hours — about ${money(price)} an hour. You value your time at about $${a} an hour, so this is ${price < alpha ? 'worth it' : 'not worth it'}.`;
  }
  if (dCost < 0 && dHoursMonth < 0) {
    const price = -dCost / -dHoursMonth;
    return `Saves ${money(dCost)} a month vs ${refLabel} but costs you ${(-dHoursMonth).toFixed(1)} more hours — about ${money(price)} per hour given up. You value your time at about $${a} an hour, so ${price > alpha ? 'the savings are worth it' : `${refLabel} is worth the extra rent`}.`;
  }
  if (dCost < 0) return `${money(dCost)} cheaper and ${dHoursMonth.toFixed(1)} hours a month faster than ${refLabel}.`;
  return `${money(dCost)} more and ${(-dHoursMonth).toFixed(1)} hours a month slower than ${refLabel}.`;
}

export function roommateRisk(l: Listing, group: number) {
  if (l.price_basis === 'per_bed' && l.lease_type !== 'joint') return 'If a roommate leaves: you pay $0 extra';
  if (group <= 1) return 'Just you on the lease';
  const exposure = l.unit_total - Math.round(l.unit_total / group);
  return `Joint lease: you may owe up to ${money(exposure)} / month if roommates leave`;
}

function leaseBadge(l: Listing, group: number) {
  if (l.price_basis === 'per_bed') return `individual${l.roommate_matching ? ' · roommate matching' : ''}`;
  if (l.price_basis === 'per_unit') return `joint · ${money(l.unit_total)} whole unit if you bring ${Math.min(group, l.beds)}`;
  return 'price basis not stated';
}

function tagFor(pos: number, card: { total: number; commute: Commute }, all: { total: number; commute: Commute }[]) {
  if (pos === 0) return 'Best';
  if (card.total === Math.min(...all.map(c => c.total))) return 'Cheapest';
  if (card.commute.minutes === Math.min(...all.map(c => c.commute.minutes))) return 'Closest';
  return 'Next best';
}

export function buildCards(ids: string[], p: Profile, ctx?: { student: Student; pBest: Map<string, number>; utility: Map<string, number | null> }): CardOut[] {
  const r = ctx ?? (() => { const rk = rankAll(p); return { student: rk.student, pBest: new Map(rk.rows.map(x => [x.id, x.p])), utility: new Map(rk.rows.map(x => [x.id, x.ev?.u ?? null])) }; })();
  const s = r.student; const g = groupOf(p) ?? s.group;
  const base = ids.map(id => byId.get(id)!).filter(Boolean).map(l => {
    const cost = trueMonthlyCost(l, { group: p.living === 'match' ? 1 : g, mode: s.mode, needsParking: s.parking });
    return { l, cost, total: cost.perPerson, commute: commuteFor(l, s) };
  });
  return base.map((c, pos) => {
    const others = base.filter((_, j) => j !== pos);
    return {
      id: c.l.id, rank: pos + 1, tag: tagFor(pos, c, base), name: c.l.name, short: c.l.short, hood: c.l.hood, landlord: landlordName(c.l.landlord_id), photos: c.l.photos,
      verified: daysSince(c.l.verified_at) <= 7, pBest: r.pBest.get(c.l.id) ?? 0, example: true,
      cost: c.cost, total: c.total, leaseBadge: leaseBadge(c.l, g),
      commute: c.commute,
      regret: others.length ? regretLine(c, others, p.budget) : 'No big trade-off against your priorities',
      timeVsMoney: pos === 0 ? null : timeVsMoney(c, base[0], s.alpha),
      mustHaves: cells(c.l),
      extras: {
        gym: c.l.amenities.gym_onsite ? 'In building' : c.l.poi.gymMin != null ? `${c.l.poi.gymMin} min walk` : 'None nearby',
        groc: `${c.l.poi.groceryMin} min walk`, food: `${c.l.poi.lateFood} open late`,
        park: !c.l.amenities.parking ? 'Street only' : c.l.amenities.parking_fee ? `${money(c.l.amenities.parking_fee)} / mo` : 'Included',
        bus: `${c.l.poi.busStopMin} min to stop`,
      },
      roommateRisk: roommateRisk(c.l, g), badge: confidenceBadge(c.l, c.cost), coord: c.l.coord,
      overBudget: p.budget != null ? Math.max(0, Math.round(c.total - p.budget)) : 0,
      utility: r.utility.get(c.l.id) ?? null,
    };
  });
}

// ---------- top 3 + bench ----------
export const BENCH_SIZE = 6;
export const PER_BUILDING_MAX = 2;

export function topAndBench(p: Profile, exclude: string[] = [], keep: string[] = []) {
  const rk = rankAll(p);
  const perBuilding = new Map<string, number>();
  const take = (id: string) => { const b = byId.get(id)!.building_id; perBuilding.set(b, (perBuilding.get(b) ?? 0) + 1); };
  const ok = (id: string) => (perBuilding.get(byId.get(id)!.building_id) ?? 0) < PER_BUILDING_MAX;
  keep.forEach(take);
  const shown = [...keep];
  const bench: string[] = [];
  for (const row of rk.rows) {
    if (exclude.includes(row.id) || keep.includes(row.id) || !ok(row.id)) continue;
    if (shown.length < 3) { shown.push(row.id); take(row.id); }
    else if (bench.length < BENCH_SIZE) { bench.push(row.id); take(row.id); }
    if (shown.length >= 3 && bench.length >= BENCH_SIZE) break;
  }
  return { shown, bench, rank: rk };
}

export type XReason = 'too_expensive' | 'too_far' | 'dont_like' | 'skip';

/** X-button reasons are a free extra answer: they update α or the budget before re-ranking. */
export function applyXReason(p: Profile, removed: Listing, reason: XReason, student: Student): { profile: Profile; note: string } {
  if (reason === 'too_far') {
    const lo = Math.max(p.alphaLo ?? 0, student.alpha);
    return { profile: { ...p, alphaLo: lo }, note: `Got it — your time is worth at least about $${Math.round(lo)} an hour.` };
  }
  if (reason === 'too_expensive') {
    const g = p.living === 'match' ? 1 : (groupOf(p) ?? student.group);
    const removedCost = trueMonthlyCost(removed, { group: g, mode: student.mode, needsParking: student.parking }).perPerson;
    const budget = Math.round(Math.min(p.budget ?? student.budget, removedCost - 25) / 25) * 25;
    return { profile: { ...p, budget }, note: `Got it — we now treat about $${budget.toLocaleString('en-US')} as your ceiling.` };
  }
  return { profile: p, note: '' };
}

export function benchNext(p: Profile, shown: string[], removedId: string, reason: XReason, seen: string[] = []) {
  const removed = byId.get(removedId)!;
  const before = rankAll(p);
  const { profile, note } = applyXReason(p, removed, reason, before.student);
  const keep = shown.filter(id => id !== removedId);
  const exclude = Array.from(new Set([...seen, removedId, ...shown]));
  let tb = topAndBench(profile, exclude, keep);
  let widened = '';
  let prof = profile;
  if (tb.shown.length < shown.length) { // bench ran dry → widen: budget +10%
    prof = { ...profile, budget: profile.budget ? Math.round(profile.budget * 1.1) : profile.budget, extra: [] };
    tb = topAndBench(prof, exclude, keep);
    widened = 'We widened your search: budget +10% and dropped extra filters.';
  }
  const replacement = tb.shown.find(id => !keep.includes(id)) ?? null;
  const slot = shown.indexOf(removedId);
  const nextShown = [...keep]; if (replacement) nextShown.splice(slot, 0, replacement);
  let why = '';
  if (replacement) {
    const cards = buildCards([removedId, replacement], prof);
    const dCost = cards[1].total - cards[0].total, dMin = cards[1].commute.minutes - cards[0].commute.minutes;
    why = `${dCost <= 0 ? money(dCost) + ' cheaper' : money(dCost) + ' more'}, ${dMin <= 0 ? Math.abs(dMin) + ' min closer' : dMin + ' min farther'}`;
  }
  return { profile: prof, shown: nextShown, bench: tb.bench, replacement, why, note, widened };
}

export { nightSafe };
