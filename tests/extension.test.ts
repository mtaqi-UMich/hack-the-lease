// Browser-extension readers, field mapping, PII stripping, "missing = Unknown", and score parity with the website.
// All fixtures are SYNTHETIC — they mimic the structure of each site's embedded data, never real page content.
import { describe, expect, it } from 'vitest';
import { readApartments, readJsonLd, readZillow, unitsFromText } from '../extension/src/adapters';
import { mergeAI, readSnapshot, toExtracted } from '../extension/src/read';
import type { PageSnapshot } from '../extension/src/snapshot';
import { score } from '../extension/src/score';
import { broughtToListing } from '../lib/brought';
import { buildCards } from '../lib/compare';
import { LISTINGS } from '../lib/data';
import type { Profile } from '../lib/session';

const snap = (p: Partial<PageSnapshot>): PageSnapshot => ({ url: 'https://example.test/l/1', host: 'example.test', title: 'Listing', jsonld: [], nextData: null, embedded: [], meta: {}, text: '', ...p });

describe('Zillow adapter', () => {
  const property = { zpid: 1, homeStatus: 'FOR_RENT', price: 2350, bedrooms: 2, bathrooms: 1.5, livingArea: 980, latitude: 42.2801, longitude: -83.7402,
    address: { streetAddress: '100 Example Ave', city: 'Ann Arbor', state: 'MI', zipcode: '48104' },
    resoFacts: { laundryFeatures: ['In Unit'], cooling: ['Central Air'], hasPetsAllowed: false, securityDeposit: 2350 } };
  const nextData = JSON.stringify({ props: { pageProps: { componentProps: { gdpClientCache: JSON.stringify({ 'q1': { property } }) } } } });
  it('reads a single rental from __NEXT_DATA__ → gdpClientCache (a JSON string inside JSON)', () => {
    const r = readZillow(snap({ host: 'zillow.com', nextData }));
    expect(r.fields.rent?.value).toBe(2350); expect(r.fields.beds?.value).toBe(2); expect(r.fields.baths?.value).toBe(1.5);
    expect(r.fields.sqft?.value).toBe(980); expect(r.fields.address?.value).toBe('100 Example Ave, Ann Arbor, MI 48104');
    expect(r.coord).toEqual([42.2801, -83.7402]);
    expect(r.fields.laundry?.value).toBe('in_unit'); expect(r.fields.ac?.value).toBe(true); expect(r.fields.pets?.value).toBe(false); expect(r.fields.deposit?.value).toBe(2350);
    expect(r.fields.rent?.source).toBe('zillow');
  });
  it('lists floor plans on a building page instead of picking one', () => {
    const building = { buildingName: 'Example Lofts', latitude: 42.29, longitude: -83.73, address: { streetAddress: '5 Sample St', city: 'Ann Arbor', state: 'MI' },
      floorPlans: [{ beds: 1, baths: 1, price: 1500 }, { beds: 2, baths: 2, price: 2100 }] };
    const r = readZillow(snap({ host: 'zillow.com', nextData: JSON.stringify({ props: { pageProps: { building, bedrooms: 'x' } } }) }));
    expect(r.units.map(u => [u.beds, u.rent])).toEqual([[1, 1500], [2, 2100]]);
    expect(r.fields.rent).toBeUndefined();
  });
  it('survives a layout change (missing pieces → nothing, no crash)', () => {
    expect(readZillow(snap({ host: 'zillow.com', nextData: '{"props":{}}' })).fields).toEqual({});
    expect(readZillow(snap({ host: 'zillow.com', nextData: 'not json' })).fields).toEqual({});
  });
});

describe('Apartments.com adapter', () => {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': ['Product', 'ApartmentComplex'], name: 'Sample Commons',
    address: { '@type': 'PostalAddress', streetAddress: '20 Demo Rd', addressLocality: 'Ann Arbor', addressRegion: 'MI', postalCode: '48105' },
    geo: { latitude: 42.301, longitude: -83.71 }, amenityFeature: [{ name: 'Washer/Dryer' }, { name: 'Air Conditioning' }, { name: 'Garage Parking' }, { name: 'Pet Friendly' }],
    offers: { '@type': 'AggregateOffer', lowPrice: 1295, highPrice: 2450 } });
  it('reads address, geo and amenities from JSON-LD; a price range is not a rent', () => {
    const r = readApartments(snap({ host: 'apartments.com', jsonld: [ld], text: 'Pricing\n1 Bed 1 Bath $1,295\n2 Beds 2 Baths $2,450\nDeposit $500' }));
    expect(r.fields.address?.value).toBe('20 Demo Rd, Ann Arbor, MI 48105'); expect(r.coord).toEqual([42.301, -83.71]);
    expect(r.fields.laundry?.value).toBe('in_unit'); expect(r.fields.ac?.value).toBe(true); expect(r.fields.parking?.value).toBe(true); expect(r.fields.pets?.value).toBe(true);
    expect(r.fields.rent).toBeUndefined();
    expect(r.units.map(u => [u.beds, u.rent])).toEqual([[1, 1295], [2, 2450]]);
  });
});

describe('Apartments.com floor-plan cards (layout mimicked, synthetic numbers)', () => {
  const text = 'Sample Tower\nPricing & Floor Plans\nA Style - Studio ($900 each w/ 2 People!)\nStarting at $900\n/ Person\nTotal Monthly Price\nStudio\n1 Bath\n400 Sq Ft\n$200 Deposit\n' +
    'B Style - Two Bed\nStarting at $1,150\n/ Person\nTotal Monthly Price\n2 Beds\n2 Baths\n800 Sq Ft\n' + 'x'.repeat(300) +
    '\nAverage Prices by Area\nCompare neighborhood and city base rent averages by bedroom.\nStudio\t$1,999\t$1,800\n1 Bedroom\t$2,999\t$2,100';
  it('reads per-person prices under $1,000 and never the neighbourhood averages', () => {
    const r = readApartments(snap({ host: 'apartments.com', text }));
    expect(r.units.map(u => [u.beds, u.rent, u.basis])).toEqual([[0, 900, 'per_bed'], [2, 1150, 'per_bed']]);
    expect(r.units.some(u => u.rent === 1999 || u.rent === 2999)).toBe(false);
  });
});

describe('generic JSON-LD', () => {
  it('reads schema.org Apartment + Offer', () => {
    const r = readJsonLd([JSON.stringify({ '@type': 'Apartment', numberOfBedrooms: 3, numberOfBathroomsTotal: 2, floorSize: { value: 1200, unitCode: 'FTK' }, address: '9 Test Ct, Ann Arbor, MI', offers: { '@type': 'Offer', price: '2,700', priceCurrency: 'USD' } })]);
    expect(r.fields.beds?.value).toBe(3); expect(r.fields.rent?.value).toBe(2700); expect(r.fields.sqft?.value).toBe(1200);
  });
  it('never treats numberOfRooms as bedrooms (rooms include the kitchen)', () => {
    expect(readJsonLd([JSON.stringify({ '@type': 'Apartment', numberOfRooms: 5 })]).fields.beds).toBeUndefined();
  });
  it('ignores broken JSON-LD', () => expect(readJsonLd(['{oops']).fields).toEqual({}));
});

describe('page-text pipeline', () => {
  it('strips emails and phone numbers before anything can leave the device', () => {
    const r = readSnapshot(snap({ text: 'Lovely 2 bedroom at 12 Sample St. Rent is $1,900 per month for the whole unit. Call (734) 555-0100 or email owner@example.test today.' }));
    expect(r.text).not.toMatch(/555-0100|owner@example/); expect(r.redactions).toBe(2);
    expect(r.fields.rent?.value).toBe(1900); expect(r.fields.rent?.source).toBe('page text'); expect(r.needsAI).toBe(false);
  });
  it('asks for AI only when rent or bedrooms are still missing', () => {
    expect(readSnapshot(snap({ text: 'A nice place near campus with big windows and a porch.' })).needsAI).toBe(true);
  });
  it('AI fills gaps only — never overwrites what the page itself states', () => {
    const r = readSnapshot(snap({ text: 'Rent is $1,500 per month for the whole unit.' }));
    const m = mergeAI(r, [{ key: 'rent', label: 'Rent', value: 9999, evidence: 'x', status: 'Listed' }, { key: 'beds', label: 'Bedrooms', value: 2, evidence: 'Two bedrooms.', status: 'Listed' }]);
    expect(m.fields.rent?.value).toBe(1500); expect(m.fields.beds?.value).toBe(2); expect(m.fields.beds?.source).toBe('AI');
  });
  it('anything not found is Unknown with no value', () => {
    const ex = toExtracted({ rent: { value: 1500, evidence: 'Rent is $1,500.', source: 'page text' } });
    expect(ex.find(f => f.key === 'rent')?.status).toBe('Listed');
    for (const f of ex.filter(f => f.key !== 'rent')) { expect(f.status).toBe('Unknown'); expect(f.value).toBeNull(); expect(f.evidence).toBeNull(); }
  });
  it('reads a floor-plan grid from text', () => {
    expect(unitsFromText('Studio $1,100 · 1 Bed $1,350 · 2 Beds $1,900').map(u => u.beds)).toEqual([0, 1, 2]);
  });
});

describe('score parity with the website', () => {
  const profile: Profile = { living: 'friend', base: 'Central', mode: 'bus', budget: 1400 };
  it('an outside listing with the same facts and location scores exactly like the marketplace listing', () => {
    const L = LISTINGS.find(l => l.beds === 2 && l.price_basis === 'per_unit' && Array.isArray(l.required_fees) && l.required_fees.length === 0 && l.utilities_listed == null && l.amenities.laundry === 'in_unit')!;
    expect(L).toBeTruthy();
    const fields = [
      { key: 'rent', value: L.price_amount }, { key: 'price_basis', value: L.price_basis }, { key: 'beds', value: L.beds }, { key: 'address', value: L.address },
      { key: 'utilities_included', value: L.utilities_included }, { key: 'laundry', value: L.amenities.laundry }, { key: 'parking', value: L.amenities.parking },
      { key: 'ac', value: L.amenities.ac }, { key: 'pets', value: L.amenities.pets },
    ].map(f => ({ ...f, status: 'Listed' as const })) as never;
    const outside = broughtToListing({ fields, coord: L.coord })!;
    const [ours] = buildCards([L.id], profile);
    const [theirs] = buildCards(['X-1'], profile, undefined, new Map([['X-1', { ...outside, id: 'X-1' }]]));
    expect(theirs.commute.minutes).toBe(ours.commute.minutes);
    expect(theirs.cost.lines.find(l => l.key === 'rent')?.amount).toBe(ours.cost.lines.find(l => l.key === 'rent')?.amount);
    expect(theirs.mustHaves.owl.main).toBe(ours.mustHaves.owl.main);
  });
  it('the side panel score uses the same engine and reports Unknown commute without an address', () => {
    const fields = toExtracted({ rent: { value: 2000, evidence: 'Rent is $2,000.', source: 'page text' }, beds: { value: 2, evidence: '2 bedrooms.', source: 'page text' } });
    const s = score(fields, undefined, profile, [], 'Test 2BR');
    expect(s.commuteKnown).toBe(false); expect(s.card).not.toBeNull(); expect(s.top3.length).toBe(3);
    expect(s.missing.map(m => m.key)).toContain('price_basis'); expect(s.askText).toMatch(/per person or for the whole unit/);
  });
});
