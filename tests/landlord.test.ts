// Landlord side (PRD Testing suite, 20 cases): Ann Arbor compliance check and leads.
import { describe, it, expect } from 'vitest';
import { checkListing, autoFix, DEMO_DRAFT, type ListingDraft } from '../lib/compliance';
import { leadsFor } from '../lib/apply';
import { LISTINGS } from '../lib/data';

const ok: ListingDraft = { ...DEMO_DRAFT, required_fees: [], utilities_disclosed: true };
const failsOn = (d: Partial<ListingDraft>, id: string) => checkListing({ ...ok, ...d }).checks.find(c => c.id === id)!.pass === false;

describe('compliance check catches problems', () => {
  it('a clean listing passes every check', () => expect(checkListing(ok).failures).toBe(0));
  it('$75 application fee is caught', () => expect(failsOn({ application_fee: 75 }, 'app_fee')).toBe(true));
  it('$50 application fee is allowed', () => expect(failsOn({ application_fee: 50 }, 'app_fee')).toBe(false));
  it('$51 application fee is caught', () => expect(failsOn({ application_fee: 51 }, 'app_fee')).toBe(true));
  it('non-refundable fee is caught', () => expect(failsOn({ application_fee_refundable: false }, 'app_fee')).toBe(true));
  it('waitlist fee is caught', () => expect(failsOn({ pre_tenancy_fees: [{ name: 'Waitlist fee', amount: 100 }] }, 'pre_tenancy')).toBe(true));
  it('required fee outside rent is caught', () => expect(failsOn({ required_fees: [{ name: 'Amenity fee', amount: 40, in_base_rent: false }] }, 'fees_in_rent')).toBe(true));
  it('required fee inside rent passes', () => expect(failsOn({ required_fees: [{ name: 'Tech fee', amount: 20, in_base_rent: true }] }, 'fees_in_rent')).toBe(false));
  it('deposit of 1.6× rent is caught', () => expect(failsOn({ rent: 1000, deposit: 1600 }, 'deposit')).toBe(true));
  it('deposit of exactly 1.5× rent passes', () => expect(failsOn({ rent: 1000, deposit: 1500 }, 'deposit')).toBe(false));
  it('undisclosed utilities are caught', () => expect(failsOn({ utilities_disclosed: false }, 'utilities')).toBe(true));
  it('criminal-history question is caught', () => expect(failsOn({ asks_criminal_history: true }, 'criminal')).toBe(true));
  it('missing price basis is caught', () => expect(failsOn({ price_basis: null }, 'structure')).toBe(true));
  it('missing lease type is caught', () => expect(failsOn({ lease_type: null }, 'structure')).toBe(true));
  it('missing written screening criteria is caught', () => expect(checkListing({ ...ok, screening_criteria_provided: false }).failures).toBe(1));
  it('the demo draft has exactly 2 problems', () => expect(checkListing(DEMO_DRAFT).failures).toBe(2));
});

describe('auto-fix', () => {
  it('fixing the demo draft makes it publishable', () => expect(checkListing(autoFix(DEMO_DRAFT)).publishable).toBe(true));
  it('fees moved into the advertised rent', () => expect(autoFix(DEMO_DRAFT).rent).toBe(DEMO_DRAFT.rent + 40));
});

describe('our own inventory and leads', () => {
  it('every Example listing keeps the application fee ≤ $50 and deposit ≤ 1.5× rent', () => {
    for (const l of LISTINGS) { expect(l.application_fee).toBeLessThanOrEqual(50); expect(l.deposit).toBeLessThanOrEqual(l.price_amount * 1.5); }
  });
  it('leads are pre-qualified with budget, move-in and reasons', () => {
    const leads = leadsFor('hackberry');
    expect(leads.length).toBeGreaterThan(0);
    for (const l of leads) { expect(l.budget).toBeGreaterThan(0); expect(l.move_in).toMatch(/^2027-/); expect(l.reasons.length).toBeGreaterThan(0); }
  });
});
