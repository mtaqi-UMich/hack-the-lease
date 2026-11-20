// Turn a PageSnapshot into listing fields. Pure functions (unit-tested with synthetic fixtures in tests/).
// Order: site adapters (Zillow, Apartments.com) → any JSON-LD → meta tags → page-text rules (lib/extract) → AI (caller).
// Every value carries where it came from. Anything not found stays Unknown — we never guess.
import type { Extracted, FieldKey } from '../../lib/extract';
import type { PageSnapshot } from './snapshot';

export type Source = 'zillow' | 'apartments.com' | 'structured data' | 'page meta' | 'page text' | 'AI' | 'you' | 'guess';
export interface Found { value: Extracted['value']; evidence: string; source: Source }
export interface Unit { label: string; rent: number; beds: number; baths?: number; sqft?: number; basis?: 'per_bed' | 'per_unit'; evidence?: string }
export interface ReadResult {
  fields: Partial<Record<FieldKey, Found>>;
  coord?: [number, number];
  units: Unit[];             // several floor plans on one page → the student picks one
  sources: Source[];
  text: string;              // sanitized text (emails/phones/links removed), capped — what the AI fallback may see
  redactions: number;
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; }
  return null;
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const quote = (k: string, v: unknown) => `Page data: "${k}": ${JSON.stringify(v).slice(0, 80)}`;

function tryJSON(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

/** Walk any JSON value, also descending into string fields that are themselves JSON (Zillow's gdpClientCache). */
export function walk(root: unknown, visit: (o: Record<string, unknown>) => void, budget = 200_000) {
  const stack: unknown[] = [root]; let n = 0;
  while (stack.length && n++ < budget) {
    const v = stack.pop();
    if (typeof v === 'string') { if (v.length > 50 && (v[0] === '{' || v[0] === '[') && /bedrooms|"beds"/i.test(v)) { const p = tryJSON(v); if (p) stack.push(p); } continue; }
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v)) { for (const x of v) stack.push(x); continue; }
    visit(v as Record<string, unknown>);
    for (const x of Object.values(v as Record<string, unknown>)) stack.push(x);
  }
}

function setF(out: ReadResult['fields'], k: FieldKey, value: Extracted['value'], evidence: string, source: Source) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length) || out[k]) return;
  out[k] = { value, evidence, source };
}

function addressOf(a: unknown): string | null {
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') {
    const o = a as Record<string, unknown>;
    const street = str(o.streetAddress) ?? str(o.street) ?? str(o.addressLine1);
    const city = str(o.addressLocality) ?? str(o.city); const st = str(o.addressRegion) ?? str(o.state); const zip = str(o.postalCode) ?? str(o.zipcode);
    if (street) return [street, city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  return null;
}

function amenityFlags(list: string[], out: ReadResult['fields'], source: Source) {
  const all = list.join(' | ');
  const hit = (re: RegExp) => list.find(x => re.test(x));
  const lau = hit(/in[- ]unit|washer\/dryer|washer & dryer|w\/d/i);
  if (lau) setF(out, 'laundry', /in[- ]unit|in unit|w\/d in/i.test(lau) || /washer\/dryer$|washer & dryer$/i.test(lau) ? 'in_unit' : 'in_building', `Listed amenity: "${lau}"`, source);
  else { const sh = hit(/laundry (?:facilit|room|on[- ]site)|shared laundry|coin/i); if (sh) setF(out, 'laundry', 'in_building', `Listed amenity: "${sh}"`, source); }
  const ac = hit(/air condition|central air|\bA\/C\b/i); if (ac) setF(out, 'ac', true, `Listed amenity: "${ac}"`, source);
  const pk = hit(/parking|garage/i); if (pk && !/no parking|street parking only/i.test(pk)) setF(out, 'parking', true, `Listed amenity: "${pk}"`, source);
  const pet = hit(/pets? (?:allowed|friendly|ok)|cats? (?:ok|allowed)|dogs? (?:ok|allowed)/i); if (pet) setF(out, 'pets', true, `Listed amenity: "${pet}"`, source);
  if (/no pets/i.test(all)) setF(out, 'pets', false, 'Listed: "No pets"', source);
}

// ---------- generic JSON-LD (schema.org Apartment / Residence / Offer / Product …) ----------
const PLACE = /Apartment|Residence|House|Accommodation|ApartmentComplex|Product|RealEstateListing|Place|Offer/i;
export function readJsonLd(blocks: string[], source: Source = 'structured data'): Pick<ReadResult, 'fields' | 'coord' | 'units'> {
  const fields: ReadResult['fields'] = {}; let coord: [number, number] | undefined; const units: Unit[] = [];
  for (const raw of blocks) {
    const data = tryJSON(raw); if (!data) continue;
    walk(data, o => {
      const type = ([] as unknown[]).concat(o['@type'] ?? '').join(' ');
      if (!PLACE.test(type) && !o.offers && !o.address) return;
      const addr = addressOf(o.address); if (addr) setF(fields, 'address', addr, quote('address', addr), source);
      const geo = o.geo as Record<string, unknown> | undefined;
      if (geo && num(geo.latitude) != null && num(geo.longitude) != null && !coord) coord = [num(geo.latitude)!, num(geo.longitude)!];
      else if (!coord && num(o.latitude) != null && num(o.longitude) != null) coord = [num(o.latitude)!, num(o.longitude)!]; // Craigslist puts them at the top level
      const beds = num(o.numberOfBedrooms); if (beds != null) setF(fields, 'beds', beds, quote('numberOfBedrooms', o.numberOfBedrooms), source);
      const baths = num(o.numberOfBathroomsTotal ?? o.numberOfFullBathrooms); if (baths != null) setF(fields, 'baths', baths, quote('numberOfBathroomsTotal', baths), source);
      const fs = o.floorSize as Record<string, unknown> | undefined; const sq = fs ? num(fs.value) : null; if (sq != null) setF(fields, 'sqft', sq, quote('floorSize', fs?.value), source);
      if (typeof o.petsAllowed === 'boolean') setF(fields, 'pets', o.petsAllowed, quote('petsAllowed', o.petsAllowed), source);
      const offers = ([] as unknown[]).concat(o.offers ?? []).filter(Boolean) as Record<string, unknown>[];
      for (const of of offers) {
        const price = num(of.price ?? (of.priceSpecification as Record<string, unknown> | undefined)?.price);
        const lo = num(of.lowPrice), hi = num(of.highPrice);
        if (price != null && price >= 300 && price < 20000) setF(fields, 'rent', price, quote('price', of.price ?? price), source);
        else if (lo != null && hi != null && lo === hi && lo >= 300) setF(fields, 'rent', lo, quote('lowPrice', lo), source);
      }
      const am = ([] as unknown[]).concat(o.amenityFeature ?? []).map(a => (a && typeof a === 'object' ? str((a as Record<string, unknown>).name) : str(a))).filter(Boolean) as string[];
      if (am.length) amenityFlags(am, fields, source);
    });
  }
  return { fields, coord, units };
}

// ---------- Zillow: __NEXT_DATA__ / gdpClientCache property object, building floor plans ----------
export function readZillow(s: PageSnapshot): Pick<ReadResult, 'fields' | 'coord' | 'units'> {
  const fields: ReadResult['fields'] = {}; let coord: [number, number] | undefined; const units: Unit[] = []; const seen = new Set<string>();
  const roots = [...new Set([s.nextData, ...s.embedded])].filter(Boolean).map(x => tryJSON(x!)).filter(Boolean);
  for (const root of roots) walk(root, o => {
    // a single rental: { bedrooms, bathrooms, price, address{...}, latitude, longitude, livingArea, resoFacts{...} }
    if (num(o.bedrooms) != null && (num(o.price) != null || num(o.unformattedPrice) != null) && (o.address || o.streetAddress)) {
      const price = num(o.price) ?? num(o.unformattedPrice)!;
      if (price >= 300 && price < 20000) setF(fields, 'rent', price, quote('price', price), 'zillow');
      setF(fields, 'beds', num(o.bedrooms), quote('bedrooms', o.bedrooms), 'zillow');
      if (num(o.bathrooms) != null) setF(fields, 'baths', num(o.bathrooms), quote('bathrooms', o.bathrooms), 'zillow');
      if (num(o.livingArea) != null) setF(fields, 'sqft', num(o.livingArea), quote('livingArea', o.livingArea), 'zillow');
      const addr = addressOf(o.address) ?? str(o.streetAddress); if (addr) setF(fields, 'address', addr, quote('address', addr), 'zillow');
      if (num(o.latitude) != null && num(o.longitude) != null && !coord) coord = [num(o.latitude)!, num(o.longitude)!];
      const rf = o.resoFacts as Record<string, unknown> | undefined;
      if (rf) {
        const list = ([] as unknown[]).concat(rf.laundryFeatures ?? [], rf.cooling ?? [], rf.parkingFeatures ?? [], rf.appliances ?? []).map(x => String(x));
        if (list.length) amenityFlags(list.map(x => /^in unit$/i.test(x) ? 'Washer/dryer in unit' : x), fields, 'zillow');
        if (typeof rf.hasPetsAllowed === 'boolean') setF(fields, 'pets', rf.hasPetsAllowed, quote('hasPetsAllowed', rf.hasPetsAllowed), 'zillow');
        if (num(rf.securityDeposit) != null) setF(fields, 'deposit', num(rf.securityDeposit), quote('securityDeposit', rf.securityDeposit), 'zillow');
        if (str(rf.availabilityDate)) setF(fields, 'lease_start', str(rf.availabilityDate), quote('availabilityDate', rf.availabilityDate), 'zillow');
      }
    }
    // a building page: floorPlans[] / ungroupedUnits[] with beds + price
    for (const key of ['floorPlans', 'ungroupedUnits', 'units']) {
      const arr = o[key]; if (!Array.isArray(arr)) continue;
      for (const u of arr as Record<string, unknown>[]) {
        const beds = num(u.beds ?? u.bedrooms); const rent = num(u.price ?? u.minPrice ?? u.unformattedPrice);
        if (beds == null || rent == null || rent < 300) continue;
        // Zillow repeats the same plan under floorPlans, ungroupedUnits and per-unit lists
        const key = `${beds}-${rent}-${num(u.baths ?? u.bathrooms) ?? ''}`; if (seen.has(key) || units.length >= 20) continue; seen.add(key);
        units.push({ label: `${beds === 0 ? 'Studio' : `${beds} bed`}${num(u.baths) != null ? ` · ${num(u.baths)} bath` : ''} · $${rent.toLocaleString('en-US')}`, rent, beds, baths: num(u.baths ?? u.bathrooms) ?? undefined, sqft: num(u.sqft ?? u.minSqft) ?? undefined });
      }
    }
    if (!coord && num(o.latitude) != null && num(o.longitude) != null && (o.buildingName || o.address)) coord = [num(o.latitude)!, num(o.longitude)!];
    if (!fields.address && o.buildingName && o.address) { const a = addressOf(o.address); if (a) setF(fields, 'address', a, quote('address', a), 'zillow'); }
  });
  units.sort((a, b) => a.beds - b.beds || a.rent - b.rent);
  return { fields, coord, units };
}

// ---------- keep only the listing itself ----------
/** Listing pages end with neighbourhood averages, "nearby" and "similar" listings. Their prices are NOT this place's
 *  prices, so everything from the first such heading on is dropped before any text is read (by rules or by AI). */
const NOT_THIS_LISTING = /\n[ \t]*(?:Average (?:Prices|Rents?)(?: by Area)?|Compare neighborhood|Nearby (?:Apartments|Rentals|Homes|Properties|Listings)|Similar (?:Listings|Rentals|Homes|Properties|Apartments)|You (?:May|might) Also Like|Other (?:rentals|listings|properties) nearby|Explore (?:nearby|similar)|Recently viewed|More rentals (?:near|in))\b/i;
/** Zillow puts its "Nearby apartments" carousel mid-page, BEFORE the cost calculator (rent, deposit, fees) — so a
 *  block with a clear end marker is cut out, and only an open-ended one cuts the rest of the page. */
const CAROUSEL_END = /\n(?:Skip to the beginning of the carousel\s*\n\s*Skip carousel|Listing order may reflect[^\n]*)\n/i;
export function listingText(text: string): string {
  for (let i = 0; i < 5; i++) {
    const m = text.match(NOT_THIS_LISTING); if (!m || m.index == null || m.index <= 200) return text;
    const rest = text.slice(m.index); const end = rest.match(CAROUSEL_END);
    if (end?.index == null || end.index > 5000) return text.slice(0, m.index);
    text = text.slice(0, m.index) + '\n' + rest.slice(end.index + end[0].length);
  }
  return text;
}

// ---------- floor-plan grids written in the page text (Apartments.com, property-manager sites) ----------
export function unitsFromText(text: string): Unit[] {
  const out: Unit[] = []; const seen = new Set<string>();
  const re = /(?:(Studio)|(\d)\s*(?:Beds?|bd|BR|Bedrooms?)\b)[^$\n]{0,40}?\$\s?(\d{1,2},\d{3}|\d{3,5})(?![ \t]*(?:deposit|fee))/gi;
  for (const m of text.matchAll(re)) {
    const beds = m[1] ? 0 : Number(m[2]); const rent = Number(m[3].replace(/,/g, ''));
    if (rent < 300 || rent > 20000) continue;
    const key = `${beds}-${rent}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ label: `${beds === 0 ? 'Studio' : `${beds} bed`} · $${rent.toLocaleString('en-US')}`, rent, beds });
    if (out.length >= 12) break;
  }
  return out;
}

/** Apartments.com floor-plan cards: "<Name> … Starting at $974 / Person Total Monthly Price Studio 1 Bath 400 Sq Ft". */
export function apartmentsUnits(text: string): Unit[] {
  const out: Unit[] = []; const seen = new Set<string>();
  const re = /\$\s?(\d{1,2},\d{3}|\d{3,5})(?:\s*[–-]\s*\$\s?[\d,]{3,6})?[ \t]*\n\s*(\/\s*(?:Person|Bed)\s*\n\s*)?(?:Total Monthly Price\s*\n\s*)?(Studio|\d)\s*(?:Beds?|bd|Bedrooms?)?\s*\n\s*(\d(?:\.5)?)\s*Baths?(?:\s*\n\s*([\d,]+)\s*Sq\s*Ft)?/gi;
  for (const m of text.matchAll(re)) {
    const rent = Number(m[1].replace(/,/g, '')); const beds = /studio/i.test(m[3]) ? 0 : Number(m[3]); const per = !!m[2];
    if (rent < 300 || rent > 20000) continue;
    const key = `${beds}-${rent}-${per}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ label: `${beds === 0 ? 'Studio' : `${beds} bed`} · ${m[4]} bath · $${rent.toLocaleString('en-US')}${per ? ' / person' : ''}`, rent, beds, baths: Number(m[4]), sqft: m[5] ? Number(m[5].replace(/,/g, '')) : undefined,
      basis: per ? 'per_bed' : undefined, evidence: m[0].replace(/\s+/g, ' ').trim().slice(0, 120) });
    if (out.length >= 12) break;
  }
  return out;
}

/** Apartments.com "Details" block: a "Utilities Included" heading followed by one utility per line. */
const UTIL_WORDS: [RegExp, string][] = [[/^heat/i, 'heat'], [/^water/i, 'water'], [/^trash/i, 'trash'], [/^(?:high[- ]speed )?internet|^wi-?fi/i, 'internet'], [/^electric/i, 'electric'], [/^gas/i, 'gas']];
export function apartmentsUtilities(text: string): Found | null {
  const m = text.match(/\n\s*Utilities Included\s*\n((?:[ \t]*[A-Za-z][^\n]{0,30}\n){1,10})/); if (!m) return null;
  const lines: string[] = [];
  for (const l of m[1].split('\n').map(x => x.trim()).filter(Boolean)) { if (!/^(?:heat|water|sewer|trash|internet|high[- ]speed internet|wi-?fi|electric\w*|gas|cable|satellite tv)/i.test(l)) break; lines.push(l); }
  if (!lines.length) return null;
  const value = [...new Set(lines.flatMap(l => UTIL_WORDS.filter(([re]) => re.test(l)).map(([, w]) => w)))];
  return value.length ? { value, evidence: `Listed: "Utilities Included: ${lines.join(', ')}"`, source: 'apartments.com' } : null;
}

export function readApartments(s: PageSnapshot): Pick<ReadResult, 'fields' | 'coord' | 'units'> {
  const ld = readJsonLd(s.jsonld, 'apartments.com');
  const text = listingText(s.text);
  const util = apartmentsUtilities(text); if (util && !ld.fields.utilities_included) ld.fields.utilities_included = util;
  const units = ld.fields.rent ? [] : apartmentsUnits(text);
  return { ...ld, units: units.length ? units : ld.fields.rent ? [] : unitsFromText(text) };
}

export function readMeta(meta: Record<string, string>): ReadResult['fields'] {
  const fields: ReadResult['fields'] = {};
  const price = num(meta['product:price:amount']); if (price != null && price >= 300) setF(fields, 'rent', price, `Page tag product:price:amount = ${meta['product:price:amount']}`, 'page meta');
  return fields;
}

