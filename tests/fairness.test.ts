// Compliance and fairness (PRD Testing suite, 15 cases)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LISTINGS } from '../lib/data';
import { toAnswers, type Profile } from '../lib/session';
import { buildCards, topAndBench } from '../lib/compare';
import { prequalify } from '../lib/apply';
import { POST as applyPOST } from '../app/api/applications/route';

const PROFILE_KEYS = ['living', 'groupN', 'base', 'mode', 'budget', 'hardBudget', 'alphaLo', 'alphaHi', 'cards', 'deal', 'extra', 'scorecard', 'asked', 'cardLog'];
const PROTECTED = ['race', 'ethnicity', 'religion', 'gender', 'sex', 'age', 'nationality', 'national_origin', 'disability', 'familial', 'marital', 'student_status', 'income_source', 'criminal', 'ssn'];

describe('no protected-class inputs reach the ranking', () => {
  it('the student profile has only behavioural fields', () => {
    const src = readFileSync('lib/session.ts', 'utf8');
    const block = src.slice(src.indexOf('export interface Profile'), src.indexOf('}', src.indexOf('export interface Profile')));
    for (const p of PROTECTED) expect(block.toLowerCase()).not.toContain(p);
    for (const k of PROFILE_KEYS) expect(block).toContain(k);
  });
  it('extra fields injected into a profile are ignored by the engine', () => {
    const base: Profile = { living: 'friend', base: 'Central', mode: 'bus', budget: 1200 };
    const tainted = { ...base, race: 'x', religion: 'y', nationality: 'z' } as Profile;
    expect(toAnswers(tainted)).toEqual(toAnswers(base));
    expect(topAndBench(tainted).shown).toEqual(topAndBench(base).shown);
  });
  it('the night-walk row uses route facts only (no crime data in listings)', () => {
    for (const l of LISTINGS) expect(Object.keys(l.night).sort()).toEqual(['lastBus', 'litShare', 'walkMin']);
    expect(JSON.stringify(LISTINGS[0]).toLowerCase()).not.toMatch(/crime|demograph/);
  });
  it('neighbourhood demographics are not a listing field', () => { for (const k of Object.keys(LISTINGS[0])) expect(k).not.toMatch(/demo|race|income|crime/i); });
});

describe('criminal history and SSNs are never collected', () => {
  it('no Example listing asks about criminal history', () => expect(LISTINGS.every(l => !l.asks_criminal_history)).toBe(true));
  it('applications with an SSN are rejected', async () => {
    const r = await applyPOST(new Request('http://x/api/applications', { method: 'POST', body: JSON.stringify({ listing_id: LISTINGS[0].id, funding: { ssn: '123-45-6789' } }) }));
    expect(r.status).toBe(400);
  });
  it('applications with a criminal-history answer are rejected', async () => {
    const r = await applyPOST(new Request('http://x/api/applications', { method: 'POST', body: JSON.stringify({ listing_id: LISTINGS[0].id, housing_id: { criminal_record: 'no' } }) }));
    expect(r.status).toBe(400);
  });
  it('a clean application is accepted (mock)', async () => {
    const r = await applyPOST(new Request('http://x/api/applications', { method: 'POST', body: JSON.stringify({ listing_id: LISTINGS[0].id, funding: { pay: 'parent' } }) }));
    expect(r.status).toBe(200);
  });
});

describe('fees and source of income', () => {
  it('every Example listing shows an application fee ≤ $50', () => expect(LISTINGS.every(l => l.application_fee <= 50)).toBe(true));
  it('every Example application fee is refundable', () => expect(LISTINGS.every(l => l.application_fee_refundable)).toBe(true));
  it('financial aid counts as income in pre-qualify', () => {
    const l = LISTINGS.find(x => x.price_basis === 'per_bed')!;
    const v = prequalify(l, { pay: 'aid', credit: '650plus', monthly: l.price_amount * 4 }, 1);
    expect(v.verdict).toBe('Likely eligible');
  });
  it('aid and income with the same amount get the same verdict', () => {
    const l = LISTINGS[3];
    expect(prequalify(l, { pay: 'aid', credit: '650plus', monthly: 5000 }).verdict).toBe(prequalify(l, { pay: 'income', credit: '650plus', monthly: 5000 }).verdict);
  });
  it('no US credit routes to guarantor options, not a rejection', () => {
    expect(prequalify(LISTINGS[3], { pay: 'income', credit: 'none', monthly: 99999 }).verdict).toBe('Likely needs a guarantor');
  });
  it('every card is labelled Example', () => {
    const cards = buildCards(topAndBench({ living: 'alone', base: 'North', mode: 'bus', budget: 1300 }).shown, { living: 'alone' });
    expect(cards.every(c => c.example === true)).toBe(true);
  });
  it('every Example listing is flagged synthetic in the data', () => expect(LISTINGS.every(l => l.example === true)).toBe(true));
});
