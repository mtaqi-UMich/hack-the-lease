// Scores an outside listing with the SAME code the website uses (lib/brought → lib/compare → lib/engine),
// so a place scores identically in the side panel and on /compare.
import { broughtToListing, type Brought } from '../../lib/brought';
import { buildCards, topAndBench, type CardOut } from '../../lib/compare';
import { questionsFor, rankBrought, type Extracted } from '../../lib/extract';
import type { Profile } from '../../lib/session';
import type { Listing } from '../../lib/types';
import type { SavedPlace } from './store';
import { LISTINGS } from '../../lib/data';

/** Commute/night/Lyft rows are borrowed from the nearest Example listing — only honest if one is close by (≈3 km). */
export function inCoveredArea(c: [number, number]) { return LISTINGS.some(l => Math.hypot((l.coord[0] - c[0]) * 111, (l.coord[1] - c[1]) * 82) < 3); }

export interface Scored {
  card: CardOut | null; top3: CardOut[]; listing: Listing | null;
  rank: { rank: number | null; of: number; reason: string };
  vsSaved: { better: number; of: number };
  commuteKnown: boolean;
  missing: { key: string; label: string }[];
  questions: ReturnType<typeof questionsFor>;
  askText: string;
}

const ASK: Record<string, string> = {
  rent: 'What is the monthly rent?', price_basis: 'Is the rent per person or for the whole unit?', beds: 'How many bedrooms does it have?',
  utilities_included: 'Which utilities are included in the rent, and roughly what do tenants pay for the rest?', fees: 'Are there any required monthly fees on top of rent (amenity, trash, tech, admin)?',
  laundry: 'Is there a washer and dryer in the unit?', parking: 'Is parking included, and what does it cost?', lease_start: 'When does the lease start, and how long is it?',
  deposit: 'How much is the security deposit?', application_fee: 'What is the application fee, and is it refundable?', pets: 'Are pets allowed?', ac: 'Does it have air conditioning?',
};

export function score(fields: Extracted[], coord: [number, number] | undefined, profile: Profile, saved: SavedPlace[], label: string): Scored {
  const brought: Brought = { fields: fields.map(f => ({ key: f.key, value: f.value, status: f.status })), coord, label };
  const listing = broughtToListing(brought);
  const questions = questionsFor(fields);
  const missing = fields.filter(f => f.status === 'Unknown' && ASK[f.key]).map(f => ({ key: f.key, label: f.label }));
  const askText = missing.length ? `Hi! I'm interested in this place for Fall 2027. ${missing.map(m => ASK[m.key]).join(' ')} Thanks!` : '';
  const tb = topAndBench(profile);
  const top3 = buildCards(tb.shown, profile);
  if (!listing) return { card: null, top3, listing: null, rank: { rank: null, of: tb.rank.rows.length, reason: 'We need the rent and the number of bedrooms first.' }, vsSaved: { better: 0, of: saved.length }, commuteKnown: !!coord && inCoveredArea(coord), missing, questions, askText };
  const id = 'X-NEW';
  const card = buildCards([...tb.shown, id], profile, undefined, new Map([[id, { ...listing, id, short: label }]])).find(c => c.id === id) ?? null;
  const rk = rankBrought(profile, listing);
  const savedRanks = saved.map(p => { const l = broughtToListing({ fields: p.fields, coord: p.coord }); return l ? rankBrought(profile, l).rank : null; });
  const better = rk.rank == null ? 0 : savedRanks.filter(r => r == null || r > rk.rank!).length;
  return { card, top3, listing, rank: { rank: rk.rank, of: rk.of, reason: rk.reason }, vsSaved: { better, of: saved.length }, commuteKnown: !!coord && inCoveredArea(coord), missing, questions, askText };
}
