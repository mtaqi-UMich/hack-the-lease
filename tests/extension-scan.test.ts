// Extension: bot-check detection (we pause and ask the student — never solve it), results-page link discovery,
// multi-plan pages during a scan, and ranking the student's personal database with the website's engine.
// All pages and listings here are SYNTHETIC.
import { describe, expect, it } from 'vitest';
import { detectChallenge, pace, PACE_MS, pickListingLinks } from '../extension/src/discover';
import { scanFields } from '../extension/src/pipeline';
import { bestIds, rankSaved } from '../extension/src/rank';
import type { SavedPlace } from '../extension/src/store';
import type { ReadResult } from '../extension/src/adapters';
import { rankBrought } from '../lib/extract';
import { broughtToListing } from '../lib/brought';
import type { Profile } from '../lib/session';

describe('bot checks are detected so the student can complete them', () => {
  it.each([
    ['Access to this page has been denied', 'Press & Hold to confirm you are a human (and not a bot).', []],
    ['Just a moment...', 'Checking if the site connection is secure', []],
    ['Zillow', 'Press & Hold', ['#px-captcha']],
    ['Rentals', 'Please verify you are a human', []],
    ['Listing', '', ['iframe[src*="challenges.cloudflare.com"]']],
  ])('"%s" is a check', (title, text, captcha) => {
    const c = detectChallenge({ title, text, captcha: captcha as string[] });
    expect(c).not.toBeNull();
    expect(c!.message).toMatch(/complete it in the page/);
  });
  it('a normal listing page is not a check', () => {
    expect(detectChallenge({ title: '2 bd apartment for rent · 100 Example Ave', text: 'Rent $1,800/mo. 2 beds, 1 bath. In-unit laundry. '.repeat(80), captcha: [] })).toBeNull();
  });
  it('a long listing that happens to embed a reCAPTCHA contact form is not a check', () => {
    expect(detectChallenge({ title: 'Example Lofts', text: 'Floor plans and pricing. '.repeat(200) + 'Contact form protected by reCAPTCHA.', captcha: ['.g-recaptcha'] })).toBeNull();
  });
});

describe('finding listing pages on a search-results page', () => {
  it('Zillow: only detail pages on the same site, de-duplicated, query and hash dropped', () => {
    const page = 'https://www.zillow.com/ann-arbor-mi/rentals/';
    const hrefs = [
      'https://www.zillow.com/homedetails/100-Example-Ave-Ann-Arbor-MI-48104/12345_zpid/',
      'https://www.zillow.com/homedetails/100-Example-Ave-Ann-Arbor-MI-48104/12345_zpid/?utm=x#photos',
      'https://www.zillow.com/b/example-lofts-ann-arbor-mi/5XjKHx/',
      'https://www.zillow.com/ann-arbor-mi/rentals/2_p/',
      'https://www.zillow.com/agent-finder/',
      'https://evil.test/homedetails/1/1_zpid/',
    ];
    expect(pickListingLinks(page, hrefs)).toEqual([
      'https://www.zillow.com/homedetails/100-Example-Ave-Ann-Arbor-MI-48104/12345_zpid/',
      'https://www.zillow.com/b/example-lofts-ann-arbor-mi/5XjKHx/',
    ]);
  });
  it('Apartments.com property pages, capped', () => {
    const page = 'https://www.apartments.com/ann-arbor-mi/';
    const hrefs = Array.from({ length: 30 }, (_, i) => `https://www.apartments.com/example-place-${i}-ann-arbor-mi/ab${String(i).padStart(4, '0')}x/`);
    hrefs.push('https://www.apartments.com/ann-arbor-mi/2/', 'https://www.apartments.com/grow/');
    const got = pickListingLinks(page, hrefs, 10);
    expect(got).toHaveLength(10);
    expect(got.every(u => /\/example-place-\d+-ann-arbor-mi\/ab\d{4}x\/$/.test(u))).toBe(true);
  });
  it('Apartments.com: category pages with the same shape as property pages are skipped', () => {
    const page = 'https://www.apartments.com/ann-arbor-mi/';
    const hrefs = ['https://www.apartments.com/ann-arbor-mi/studios/', 'https://www.apartments.com/ann-arbor-mi/duplex/', 'https://www.apartments.com/ann-arbor-mi/luxury/',
      'https://www.apartments.com/parks-and-recreation/mi/ann-arbor/example-park/00lt041/', 'https://www.apartments.com/ann-arbor-mi/2/',
      'https://www.apartments.com/example-greene-ann-arbor-mi/dlklzsl/', 'https://www.apartments.com/example-row-ann-arbor-mi/7qcbk9y/#7qcbk9y-0-videos'];
    expect(pickListingLinks(page, hrefs)).toEqual(['https://www.apartments.com/example-greene-ann-arbor-mi/dlklzsl/', 'https://www.apartments.com/example-row-ann-arbor-mi/7qcbk9y/']);
  });
  it('Craigslist posts', () => {
    const got = pickListingLinks('https://annarbor.craigslist.org/search/apa', ['https://annarbor.craigslist.org/apa/d/ann-arbor-2br-example/7712345678.html', 'https://annarbor.craigslist.org/about/help']);
    expect(got).toEqual(['https://annarbor.craigslist.org/apa/d/ann-arbor-2br-example/7712345678.html']);
  });
  it('unknown sites: generic listing-like paths only', () => {
    const got = pickListingLinks('https://example-pm.test/rentals', ['https://example-pm.test/properties/maple-court', 'https://example-pm.test/about', 'https://example-pm.test/rentals']);
    expect(got).toEqual(['https://example-pm.test/properties/maple-court']);
  });
  it('waits a human-like 2.5–5 s between pages', () => {
    for (let i = 0; i < 50; i++) { const p = pace(); expect(p).toBeGreaterThanOrEqual(PACE_MS.min); expect(p).toBeLessThanOrEqual(PACE_MS.max); }
  });
});

describe('scanning a page with several floor plans', () => {
  const read: ReadResult = { fields: { address: { value: '5 Sample St, Ann Arbor, MI', evidence: 'x', source: 'page text' } }, units: [
    { label: 'Studio · $1,050', rent: 1050, beds: 0 }, { label: '2 bed · $1,900', rent: 1900, beds: 2 }, { label: '2 bed · $2,100', rent: 2100, beds: 2 }, { label: '3 bed · $2,700', rent: 2700, beds: 3 },
  ], sources: ['page text'], text: '', redactions: 0 };
  it('takes the cheapest plan that fits the group, and says so', () => {
    const { fields, beds } = scanFields(read, 2);
    expect(beds).toBe(2);
    const rent = fields.find(f => f.key === 'rent')!;
    expect(rent.value).toBe(1900); expect(rent.evidence).toMatch(/Cheapest floor plan that fits/);
  });
  it('with no group known, the cheapest plan overall', () => {
    expect(scanFields(read, undefined).fields.find(f => f.key === 'rent')!.value).toBe(1050);
  });
});

describe('ranking the personal database with the website engine', () => {
  const profile: Profile = { living: 'friend', base: 'Central', mode: 'walk', budget: 1150 };
  const place = (id: string, rent: number, beds: number, coord: [number, number]): SavedPlace => ({
    id, sourceUrl: `https://example.test/${id}`, sourceHost: 'example.test', capturedAt: '2026-11-20T00:00:00Z', title: id, label: id, coord,
    fields: [{ key: 'rent', value: rent, status: 'Listed', evidence: 'x' }, { key: 'beds', value: beds, status: 'Listed', evidence: 'x' }, { key: 'price_basis', value: 'per_unit', status: 'Listed', evidence: 'x' }],
  });
  const saved = [
    place('X-far', 1700, 2, [42.305, -83.70]),
    place('X-near', 1900, 2, [42.276, -83.740]),
    place('X-cheap', 1500, 2, [42.280, -83.745]),
    place('X-tiny', 900, 1, [42.279, -83.741]),   // 1 bedroom for 2 people → doesn't fit
    { ...place('X-norent', 0, 2, [42.28, -83.74]), fields: [{ key: 'beds', value: 2, status: 'Listed', evidence: 'x' }] } as SavedPlace,
  ];
  const ranked = rankSaved(profile, saved);
  it('orders places exactly as the website ranks them', () => {
    const fits = ranked.filter(r => r.rank != null);
    expect(fits.length).toBe(3);
    for (const r of fits) {
      const l = broughtToListing({ fields: r.place.fields, coord: r.place.coord })!;
      expect(r.rank).toBe(rankBrought(profile, l).rank);
    }
    expect(fits.map(r => r.rank)).toEqual([...fits.map(r => r.rank)].sort((a, b) => a! - b!));
  });
  it('places that miss a must-have or the rent go last, with a reason', () => {
    expect(ranked.slice(-2).map(r => r.place.id).sort()).toEqual(['X-norent', 'X-tiny']);
    expect(ranked.find(r => r.place.id === 'X-tiny')!.reason).toMatch(/bedroom/);
    expect(ranked.find(r => r.place.id === 'X-norent')!.reason).toMatch(/rent/);
  });
  it('"Compare my best 3" opens the top three that fit', () => {
    expect(bestIds(ranked)).toEqual(ranked.filter(r => r.rank != null).slice(0, 3).map(r => r.place.id));
    expect(bestIds(ranked)).not.toContain('X-tiny');
  });
  it('changing the scorecard changes the best place (decision sensitivity)', () => {
    const cheapFirst = rankSaved({ ...profile, budget: 700, hardBudget: true }, saved).filter(r => r.rank != null)[0]?.place.id;
    const richNorth = rankSaved({ ...profile, base: 'North', budget: 2000 }, saved).filter(r => r.rank != null)[0]?.place.id;
    expect(cheapFirst).toBeDefined(); expect(richNorth).toBeDefined();
    expect(new Set([bestIds(ranked)[0], cheapFirst, richNorth]).size).toBeGreaterThan(1);
  });
});
