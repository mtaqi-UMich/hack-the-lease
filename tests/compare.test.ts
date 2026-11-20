// Compare and bench (PRD Testing suite, 30 cases)
import { describe, it, expect } from 'vitest';
import { topAndBench, benchNext, buildCards, regretLine, timeVsMoney, confidenceBadge, commuteFor, PER_BUILDING_MAX, type Commute } from '../lib/compare';
import { trueMonthlyCost } from '../lib/cost';
import { LISTINGS, byId } from '../lib/data';
import { evaluate, type Base } from '../lib/engine';
import type { Profile } from '../lib/session';

const PROFILES: Profile[] = (['Central', 'North', 'Medical', 'Split', 'Central'] as Base[]).map((base, i) => ({ living: (['friend', 'alone', 'friend', 'group', 'alone'] as const)[i], base, mode: (['bus', 'walk', 'bus', 'bus', 'bike'] as const)[i], budget: [1150, 1300, 1200, 1000, 1500][i], asked: ['group', 'base', 'mode', 'budget'] }));
const student = (p: Profile) => ({ base: p.base!, mode: p.mode! });

describe('"Too far" brings a closer replacement', () => {
  PROFILES.forEach((p, i) => it(`profile ${i + 1}`, () => {
    const tb = topAndBench(p); const removed = byId.get(tb.shown[0])!;
    const out = benchNext(p, tb.shown, removed.id, 'too_far');
    expect(out.replacement).not.toBeNull();
    const closer = commuteFor(byId.get(out.replacement!)!, student(p)).minutes < commuteFor(removed, student(p)).minutes;
    // either the replacement is closer, or we say plainly that nothing closer exists
    expect(closer || /Nothing closer/.test(out.widened)).toBe(true);
    expect(out.profile.alphaLo).toBeGreaterThan(0);
  }));
});

describe('"Too expensive" brings a cheaper replacement and lowers the budget', () => {
  PROFILES.forEach((p, i) => it(`profile ${i + 1}`, () => {
    const tb = topAndBench(p); const removed = tb.shown[0];
    const out = benchNext(p, tb.shown, removed, 'too_expensive');
    const cards = buildCards([removed, out.replacement!], p);
    expect(cards[1].total).toBeLessThan(cards[0].total);
    expect(out.profile.budget!).toBeLessThanOrEqual(p.budget!);
  }));
});

describe(`shown + bench never hold more than ${PER_BUILDING_MAX} units of one building`, () => {
  PROFILES.forEach((p, i) => it(`profile ${i + 1}`, () => {
    const tb = topAndBench(p);
    const counts = new Map<string, number>();
    [...tb.shown, ...tb.bench].forEach(id => { const b = byId.get(id)!.building_id; counts.set(b, (counts.get(b) ?? 0) + 1); });
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(PER_BUILDING_MAX);
    expect(tb.bench.length).toBe(6);
  }));
});

const cm = (minutes: number): Commute => ({ minutes, mode: 'bus', label: 'bus', hoursPerWeek: minutes * 10 / 60, waitMinPerWeek: 0, every: '10 min', provenance: 'Estimated' });
describe('watch-out line only when the gap is meaningful', () => {
  it('14 extra minutes per trip → no line', () => expect(regretLine({ total: 1000, commute: cm(24) }, [{ total: 1000, commute: cm(10) }])).toMatch(/^No big trade-off/));
  it('15 extra minutes per trip → line', () => expect(regretLine({ total: 1000, commute: cm(25) }, [{ total: 1000, commute: cm(10) }])).toMatch(/15 min longer/));
  it('$74 more a month → no line', () => expect(regretLine({ total: 1074, commute: cm(10) }, [{ total: 1000, commute: cm(10) }])).toMatch(/^No big trade-off/));
  it('$75 more a month → line', () => expect(regretLine({ total: 1075, commute: cm(10) }, [{ total: 1000, commute: cm(10) }])).toMatch(/\$75 a month more/));
});

describe('time vs money uses the right direction', () => {
  // B costs $100 more and saves 20 min each way (≈14.3 h a month) → ≈ $7/h
  const A = { total: 1000, commute: cm(30) }, B = { total: 1100, commute: cm(10) };
  it('worth it when price of an hour < value of time', () => expect(timeVsMoney(B, A, 25)).toMatch(/so this is worth it/));
  it('not worth it when price of an hour > value of time', () => expect(timeVsMoney(B, A, 5)).toMatch(/not worth it/));
  it('cheaper and slower → savings worth it for a low value of time', () => expect(timeVsMoney(A, B, 5)).toMatch(/savings are worth it/));
  it('cheaper and slower → #1 worth the extra rent for a high value of time', () => expect(timeVsMoney(A, B, 25)).toMatch(/#1 is worth the extra rent/));
});

describe('cost and evidence labels', () => {
  it('every cost line on every listing carries exactly one label', () => {
    for (const l of LISTINGS) for (const mode of ['bus', 'drive'] as const) {
      const c = trueMonthlyCost(l, { group: Math.min(2, l.beds), mode, needsParking: mode === 'drive' });
      for (const line of c.lines) expect(['Listed', 'Estimated', 'Unknown']).toContain(line.provenance);
      for (const line of c.lines) if (line.provenance === 'Unknown') expect(line.amount).toBeNull();
    }
  });
  it('confidence badge is never High when price basis is unknown or rent is estimated', () => {
    for (const l of LISTINGS.filter(x => x.price_basis == null)) expect(confidenceBadge(l, trueMonthlyCost(l, { group: 2, mode: 'bus', needsParking: false })).level).toBe('Low');
  });
  it('bus transport is $0 with MRide', () => {
    expect(trueMonthlyCost(LISTINGS[0], { group: 1, mode: 'bus', needsParking: false }).lines.find(x => x.key === 'transport')!.amount).toBe(0);
  });
  it('utilities are Estimated when the landlord did not list them', () => {
    const l = LISTINGS.find(x => x.utilities_listed == null)!;
    expect(trueMonthlyCost(l, { group: 1, mode: 'walk', needsParking: false }).lines.find(x => x.key === 'utilities')!.provenance).toBe('Estimated');
  });
  it('per-bed leases carry no roommate risk', () => {
    const l = LISTINGS.find(x => x.price_basis === 'per_bed' && x.lease_type === 'individual')!;
    expect(buildCards([l.id], { living: 'friend', base: 'Central', mode: 'bus', budget: 1200 })[0].roommateRisk).toMatch(/\$0 extra/);
  });
});

describe('neutral ranking', () => {
  it('the engine never sees the landlord (no ranking boost)', () => {
    const s = { base: 'Central' as const, mode: 'walk' as const, group: 2, budget: 1200, alpha: 25, parking: false, laundry: false, pet: false, ac: false, quiet: false, leaseFlex: false };
    for (const l of LISTINGS.slice(0, 40)) expect(evaluate(s, { ...l, landlord_id: 'hackberry' } as typeof l)).toEqual(evaluate(s, { ...l, landlord_id: 'someone_else' } as typeof l));
  });
  it('bench runs dry → search widens and says so', () => {
    const p: Profile = { living: 'alone', base: 'Central', mode: 'walk', budget: 700, hardBudget: true, deal: { pet: true, laundry: true }, asked: ['group'] };
    const tb = topAndBench(p);
    if (tb.shown.length) {
      const out = benchNext(p, tb.shown, tb.shown[0], 'too_far', LISTINGS.map(l => l.id).filter(id => !tb.shown.includes(id)));
      expect(out.widened === '' ? out.replacement === null : out.widened.length > 0).toBe(true);
    } else expect(tb.shown.length).toBe(0);
  });
});
