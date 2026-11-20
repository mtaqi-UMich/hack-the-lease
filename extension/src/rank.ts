// Ranks every place in the student's personal database with the website's own engine (lib/extract → lib/engine),
// so "best for you" here is exactly what /compare would say. Pure: unit-tested.
import { broughtToListing } from '../../lib/brought';
import { rankBrought } from '../../lib/extract';
import type { Profile } from '../../lib/session';
import type { SavedPlace } from './store';

export interface RankedPlace { place: SavedPlace; rank: number | null; of: number; perPerson: number | null; minutes: number | null; reason: string }

/** Best first. Places that can't be scored (no rent/beds) or miss a must-have go last, with the reason. */
export function rankSaved(profile: Profile, saved: SavedPlace[]): RankedPlace[] {
  const rows = saved.map(place => {
    const l = broughtToListing({ fields: place.fields, coord: place.coord, label: place.label, sourceHost: place.sourceHost });
    if (!l) return { place, rank: null, of: 0, perPerson: null, minutes: null, reason: 'Needs the rent and number of bedrooms.' };
    const r = rankBrought(profile, l);
    return { place, rank: r.rank, of: r.of, perPerson: r.perPerson, minutes: r.minutes, reason: r.reason };
  });
  return rows.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (a.perPerson ?? Infinity) - (b.perPerson ?? Infinity));
}

/** The ids to open side by side on /compare: the best `n` that actually fit. */
export const bestIds = (ranked: RankedPlace[], n = 3) => ranked.filter(r => r.rank != null).slice(0, n).map(r => r.place.id);
