// Scenario rules (PRD Testing suite, 60 cases)
import { describe, it, expect } from 'vitest';
import { engineFor, toAnswers, step, toUIQuestion, nightSafe, MAX_SCREENS, applyUIAnswer, type Profile } from '../lib/session';
import { topAndBench } from '../lib/compare';
import { byId } from '../lib/data';
import type { Base } from '../lib/engine';

const BASES: Base[] = ['Central', 'North', 'Medical', 'Split'];
const LIVING = [['alone', 1], ['friend', 2], ['group', 3]] as const;
const top3 = (p: Profile) => topAndBench(p).shown.map(id => byId.get(id)!);
const dealOf = (p: Profile) => engineFor(p).step(toAnswers(p)).cands.find(c => c.id === 'deal');

describe('walkers never see the parking question', () => {
  for (const base of BASES) for (const [living] of LIVING) {
    it(`walk · ${base} · ${living}`, () => {
      const p: Profile = { living, base, mode: 'walk', budget: 1200, asked: ['group', 'base', 'mode', 'budget'] };
      const deal = dealOf(p);
      expect(deal?.items?.some(i => i.key === 'parking') ?? false).toBe(false);
      if (deal) expect(toUIQuestion(deal, p).chips!.some(c => c.value === 'parking')).toBe(false);
    });
  }
});

describe('drivers get parking (asked or assumed)', () => {
  for (const base of BASES) for (const [living] of LIVING) {
    it(`drive · ${base} · ${living}`, () => {
      const p: Profile = { living, base, mode: 'drive', budget: 1200, asked: ['group', 'base', 'mode', 'budget'] };
      const st = engineFor(p).step(toAnswers(p));
      const asked = st.cands.find(c => c.id === 'deal')?.items?.some(i => i.key === 'parking') ?? false;
      const assumed = st.assumptions.some(a => a.key === 'parking' && a.value);
      expect(asked || assumed).toBe(true);
    });
  }
});

describe('pet owners see pet-friendly places only', () => {
  for (const base of BASES) for (const living of ['alone', 'friend'] as const) {
    it(`pet · ${base} · ${living}`, () => {
      const t = top3({ living, base, mode: 'bus', budget: 1400, deal: { pet: true }, asked: ['group', 'base', 'deal'] });
      expect(t.length).toBeGreaterThan(0);
      expect(t.every(l => l.pets)).toBe(true);
    });
  }
});

describe('in-unit laundry as a must-have', () => {
  for (const base of BASES) for (const living of ['alone', 'friend'] as const) {
    it(`laundry · ${base} · ${living}`, () => {
      const t = top3({ living, base, mode: 'walk', budget: 1400, deal: { laundry: true }, asked: ['group', 'base', 'deal'] });
      expect(t.every(l => l.inUnit)).toBe(true);
    });
  }
});

describe('"Match me" shows only per-bed or roommate-matching buildings', () => {
  for (const base of BASES) {
    it(`match · ${base}`, () => {
      const t = top3({ living: 'match', base, mode: 'bus', budget: 1300, asked: ['group', 'base'] });
      expect(t.length).toBe(3);
      expect(t.every(l => l.price_basis === 'per_bed')).toBe(true);
    });
  }
  it('match-me engine units are single beds priced per bed', () => {
    const e = engineFor({ living: 'match' });
    expect(e.listings.every(l => l.beds === 1 && l.rent === byId.get(l.id)!.price_amount)).toBe(true);
  });
  it('match-me has fewer candidate listings than the whole market', () => {
    expect(engineFor({ living: 'match' }).listings.length).toBeLessThan(engineFor({}).listings.length);
  });
});

describe('hard budget limit is respected', () => {
  for (const budget of [900, 1000, 1100, 1200, 1400, 1600]) {
    it(`hard $${budget}`, () => {
      const t = top3({ living: 'friend', base: 'Central', mode: 'walk', budget, hardBudget: true, asked: ['group', 'base', 'budget'] });
      expect(t.every(l => l.unit_total / 2 <= budget)).toBe(true);
    });
  }
});

describe('safe walk home at night as a non-negotiable', () => {
  for (const base of BASES) {
    it(`night · ${base}`, () => {
      const t = top3({ living: 'friend', base, mode: 'walk', budget: 1500, extra: ['night'], asked: ['group', 'base'] });
      expect(t.every(nightSafe)).toBe(true);
    });
  }
});

describe('never more than 5 required screens', () => {
  const answers: Record<string, unknown> = { group: 'friend', base: 'North', mode: 'bus', budget: 1100, card: 'yes', deal: ['laundry'] };
  for (const seedBase of BASES) {
    it(`flow ends by screen ${MAX_SCREENS} · ${seedBase}`, () => {
      let p: Profile = {}; let s = step(p); let n = 0;
      while (!s.done && n < 10) { p = applyUIAnswer(p, s.rawNext!, s.rawNext!.id === 'base' ? seedBase : answers[s.rawNext!.id]); s = step(p); n++; }
      expect(s.done).toBe(true);
      expect((p.asked ?? []).length).toBeLessThanOrEqual(MAX_SCREENS);
    });
  }
});
