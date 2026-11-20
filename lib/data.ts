import listingsJson from '../data/listings.json';
import landlordsJson from '../data/landlords.json';
import type { Listing, Landlord } from './types';

export const LISTINGS = listingsJson as unknown as Listing[];
export const LANDLORDS = landlordsJson as Landlord[];
export const byId = new Map(LISTINGS.map(l => [l.id, l]));
export const landlordName = (id: string) => LANDLORDS.find(l => l.id === id)?.name ?? id;
export const TODAY = '2026-11-20';
export function daysSince(iso: string | null) {
  if (!iso) return Infinity;
  return Math.round((Date.parse(TODAY) - Date.parse(iso)) / 86400000);
}
