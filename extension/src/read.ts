// The reading pipeline: site adapters → JSON-LD → meta → page-text rules (lib/extract) → AI (caller merges).
import { FIELD_KEYS, FIELD_LABELS, enforceEvidence, ruleExtract, sanitize, type Extracted, type FieldKey } from '../../lib/extract';
import { listingText, readApartments, readJsonLd, readMeta, readZillow, unitsFromText, type Found, type ReadResult, type Source, type Unit } from './adapters';
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
  // page-text rules fill the rest, each value tied to a sentence that is really on the page
  const clean = sanitize(body);
  const rules = enforceEvidence(ruleExtract(clean.text), clean.text);
  for (const f of rules) if (f.status === 'Listed' && !fields[f.key]) { fields[f.key] = { value: f.value, evidence: f.evidence!, source: 'page text' }; if (!sources.includes('page text')) sources.push('page text'); }
  const needsAI = fields.rent == null || fields.beds == null;
  return { fields, coord, units, sources, text: clean.text.slice(0, 12000), redactions: clean.redactions, needsAI };
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
