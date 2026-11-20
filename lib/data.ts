import listingsJson from '../data/listings.json';
import landlordsJson from '../data/landlords.json';
import type { Listing, Landlord } from './types';
import { inLyftZone } from './zones';

// owlZone comes from the real Lyft Pass coverage polygon (lib/zones.ts), not the old distance rule in the generator
export const LISTINGS = (listingsJson as unknown as Listing[]).map(l => ({ ...l, owlZone: inLyftZone(l.coord) }));
export const LANDLORDS = landlordsJson as Landlord[];
export const byId = new Map(LISTINGS.map(l => [l.id, l]));
export const landlordName = (id: string) => LANDLORDS.find(l => l.id === id)?.name ?? id;
export const TODAY = '2026-11-20';
export function daysSince(iso: string | null) {
  if (!iso) return Infinity;
  return Math.round((Date.parse(TODAY) - Date.parse(iso)) / 86400000);
}
