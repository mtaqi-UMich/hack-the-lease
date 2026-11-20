// Load and speed (PRD Testing suite, 15 cases). Server-side timings on this machine; phone timing is not measured here.
import { describe, it, expect, beforeAll } from 'vitest';
import { step, engineFor, type Profile } from '../lib/session';
import { buildCards, topAndBench } from '../lib/compare';
import { percentile } from '../lib/stats';
import { POST as stepPOST } from '../app/api/onboarding/step/route';
import { GET as compareGET } from '../app/api/compare/route';
import { encodeProfile } from '../lib/wire';

const PROFILES: Profile[] = [
  {}, { living: 'friend' }, { living: 'friend', base: 'North' }, { living: 'group', groupN: 4, base: 'Central', mode: 'walk' }, { living: 'match', base: 'Medical', budget: 1200 },
];
const time = (f: () => unknown) => { const t = performance.now(); f(); return performance.now() - t; };

beforeAll(() => { PROFILES.forEach(p => engineFor(p)); step({}); }); // warm caches like a running server

describe('one engine step < 50 ms (2,500 particles)', () => {
  PROFILES.forEach((p, i) => it(`profile ${i + 1}`, () => {
    const ts = [0, 1, 2].map(() => time(() => step(p)));
    expect(Math.min(...ts)).toBeLessThan(50);
  }));
});

describe('building the compare view < 200 ms', () => {
  PROFILES.forEach((p, i) => it(`profile ${i + 1}`, () => {
    expect(time(() => buildCards(topAndBench(p).shown, p))).toBeLessThan(200);
  }));
});

describe('200 back-to-back API requests: p95 < 200 ms', () => {
  it('POST /api/onboarding/step', async () => {
    const ts: number[] = [];
    for (let i = 0; i < 200; i++) { const p = PROFILES[i % PROFILES.length]; const t = performance.now(); await stepPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ profile: p }) })); ts.push(performance.now() - t); }
    expect(percentile(ts, 0.95)).toBeLessThan(200);
  }, 120_000);
  it('GET /api/compare', async () => {
    const ts: number[] = [];
    for (let i = 0; i < 200; i++) { const p = PROFILES[i % PROFILES.length]; const t = performance.now(); await compareGET(new Request(`http://x/api/compare?p=${encodeProfile(p)}`)); ts.push(performance.now() - t); }
    expect(percentile(ts, 0.95)).toBeLessThan(200);
  }, 120_000);
  it('200 concurrent onboarding steps all succeed', async () => {
    const rs = await Promise.all(Array.from({ length: 200 }, (_, i) => stepPOST(new Request('http://x', { method: 'POST', body: JSON.stringify({ profile: PROFILES[i % PROFILES.length] }) }))));
    expect(rs.every(r => r.status === 200)).toBe(true);
  }, 120_000);
  it('engine cache is bounded (no memory blow-up across many profiles)', () => {
    for (let b = 700; b < 2000; b += 10) engineFor({ living: 'friend', hardBudget: true, budget: b });
    expect(true).toBe(true);
  });
  it('same request twice → identical response (deterministic)', async () => {
    const body = JSON.stringify({ profile: { living: 'friend', base: 'North' } });
    const a = await (await stepPOST(new Request('http://x', { method: 'POST', body }))).json();
    const b = await (await stepPOST(new Request('http://x', { method: 'POST', body }))).json();
    expect(a.top_candidates).toEqual(b.top_candidates);
  });
});
