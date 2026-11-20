// The reading pipeline: site adapters → JSON-LD → meta → page-text rules (lib/extract) → AI (caller merges).
import { FIELD_KEYS, FIELD_LABELS, enforceEvidence, ruleExtract, sanitize, type Extracted, type FieldKey } from '../../lib/extract';import { listingText, readApartments, readJsonLd, readMeta, readZillow, unitsFromText, type Found, type ReadResult, type Source, type Unit } from './adapters';
import type { PageSnapshot } from './snapshot';

/** Everything except the AI step. `needsAI` = rent or beds still missing. */
export function readSnapshot(s: PageSnapshot): ReadResult & { needsAI: boolean } {
  const sources: Source[] = [];
  const site = /(^|\.)zillow\.com$/.test(s.host) ? readZillow(s) : /(^|\.)apartments\.com$/.test(s.host) ? readApartments(s) : { fields: {}, coord: undefined, units: [] as Unit[] };
  const ld = readJsonLd(s.jsonld);
  const fields: ReadResult['fields'] = {};
  for (const part of [site.fields, ld.fields, readMeta(s.meta)]) for (const [k, v] of Object.entries(part) as [FieldKey, Found][]) if (!fields[k]) { fields[k] = v; if (!sources.includes(v.source)) sources.push(v.source); }
  const coord = site.coord ?? ld.coord;
  const body = listingText(s.text);
  const units = site.units.length ? site.units : (!fields.rent ? unitsFromText(body) : []);
  // One floor plan on the page → that's the place. Several → the student picks one in the panel.
  if (units.length === 1 && fields.rent == null) {
    const u = units[0]; const ev = u.evidence ?? `Floor plan: ${u.label}`; const src: Source = !site.units.length ? 'page text' : /zillow/.test(s.host) ? 'zillow' : 'apartments.com';
    if (!sources.includes(src)) sources.push(src);
    fields.rent = { value: u.rent, evidence: ev, source: src }; if (fields.beds == null) fields.beds = { value: u.beds, evidence: ev, source: src };
    if (u.basis && !fields.price_basis) fields.price_basis = { value: u.basis, evidence: ev, source: src };
  }
  const multi = units.length > 1;
  // On a multi-plan page, rent/beds/baths/size in the text describe the whole building (ranges, filters, marketing copy),
  // not one unit — they come from the plan the student picks instead.
  const PER_UNIT = new Set<FieldKey>(['rent', 'price_basis', 'beds', 'baths', 'sqft']);
  // page-text rules fill the rest, each value tied to a sentence that is really on the page
  const clean = sanitize(body);
  const rules = enforceEvidence(ruleExtract(clean.text), clean.text);
  for (const f of rules) if (f.status === 'Listed' && !fields[f.key] && !(multi && PER_UNIT.has(f.key))) { fields[f.key] = { value: f.value, evidence: f.evidence!, source: 'page text' }; if (!sources.includes('page text')) sources.push('page text'); }
  // "By-the-bed leasing" / "individual leases" anywhere on the listing is a stated fact: prices are per person
  if (!fields.price_basis) {
    const m = body.match(/[^\n]*\b(?:by[- ]the[- ]bed|per (?:person|bed(?:room)?)|individual leases?|leased by the (?:bed|room))\b[^\n]*/i);
    if (m && !/fee|deposit|application/i.test(m[0])) // m[0] is a line of the page itself, so it is its own evidence
      { fields.price_basis = { value: 'per_bed', evidence: m[0].trim().slice(0, 160), source: 'page text' }; if (!sources.includes('page text')) sources.push('page text'); }
  }
  // AI only when the page gives neither a rent nor a list of plans to pick from
  const needsAI = !multi && (fields.rent == null || fields.beds == null);
  return { fields, coord, units, sources, text: clean.text.slice(0, 12000), redactions: clean.redactions, needsAI };
}

/** When the page never says, preselect per person vs whole place (the student can flip it in the panel).
 *  A 1-bed is the same either way; under $400 a bedroom is not a whole-place price in Ann Arbor, so it's per person. */
export function guessBasis(rent: number, beds: number, host: string): Found {
  const where = /zillow\.com$/.test(host) ? 'Zillow shows whole-unit prices' : /craigslist\.org$/.test(host) ? 'Craigslist rents are usually for the whole place' : null;
  if (beds <= 1) return { value: 'per_unit', evidence: 'Our guess: one bedroom, so the rent is for the whole place', source: 'guess' };
  if (rent < 400 * beds) return { value: 'per_bed', evidence: `Our guess: $${rent.toLocaleString('en-US')} for ${beds} bedrooms is too low for a whole place in Ann Arbor, so it’s per person`, source: 'guess' };
  return { value: 'per_unit', evidence: `Our guess: ${where ?? `$${rent.toLocaleString('en-US')} for ${beds} bedrooms looks like a whole-place price`}`, source: 'guess' };
}

/** Merge AI fields (already evidence-checked on the server) into gaps only. */
export function mergeAI(r: ReadResult, ai: Extracted[]): ReadResult {
  const fields = { ...r.fields };
  for (const f of ai) if (f.status === 'Listed' && f.value != null && f.evidence && !fields[f.key]) fields[f.key] = { value: f.value, evidence: f.evidence, source: 'AI' };
  return { ...r, fields, sources: Object.values(fields).some(f => f?.source === 'AI') && !r.sources.includes('AI') ? [...r.sources, 'AI'] : r.sources };
}

/** The Extracted[] shape the website already uses (missing = Unknown). */
export function toExtracted(fields: ReadResult['fields']): Extracted[] {
  return FIELD_KEYS.map(k => fields[k] ? { key: k, label: FIELD_LABELS[k], value: fields[k]!.value, evidence: fields[k]!.evidence, status: 'Listed' as const } : { key: k, label: FIELD_LABELS[k], value: null, evidence: null, status: 'Unknown' as const });
}
