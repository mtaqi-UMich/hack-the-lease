// Listing schema — PRD section 2.4, plus the engine fields and the Compare-card facts.
// Every listing in data/ is SYNTHETIC ("Example") unless source === 'bring_your_own'.
import type { Campus, EngineListing, Mode } from './engine';

export type Provenance = 'Listed' | 'Estimated' | 'Unknown';
export type Laundry = 'in_unit' | 'in_building' | 'basement' | 'none';

export interface Fee { name: string; amount: number; monthly: boolean; refundable?: boolean }

export interface Landlord {
  id: string; name: string; kind: 'operator' | 'small' | 'house_owner';
  verifiedCadenceDays: number; contact: string; launchPartner?: boolean;
}

export interface BusLeg {
  route: string; walkToStop: number; wait: number; ride: number; walkFromStop: number;
  transfers: number; headwayDay: number; headwayNight: number; total: number;
}
export interface CommuteFacts {
  walk: number; bike: number; drive: number; bus: BusLeg;
  fastest: { mode: Exclude<Mode, 'drive'>; minutes: number };
  provenance: 'Estimated';
}

export interface Listing extends EngineListing {
  landlord_id: string; building_id: string; source: 'direct' | 'feed' | 'bring_your_own';
  verified_at: string | null;
  address: string; lat: number; lng: number; baths: number; sqft: number;
  short: string; // "Lower Town 2BR"
  price_basis: 'per_bed' | 'per_unit' | null; price_amount: number; unit_total: number;
  required_fees: Fee[] | null; optional_fees: Fee[];
  utilities_included: string[]; utilities_listed: number | null; // $/person/month if landlord states it
  lease_type: 'individual' | 'joint' | 'both' | null; roommate_matching: boolean;
  lease_start: string; lease_months: number[]; applications_open_on: string;
  amenities: { laundry: Laundry; ac: boolean; furnished: boolean; private_bath: boolean; pets: boolean; parking: boolean; parking_fee: number | null; gym_onsite: boolean };
  application_fee: number; application_fee_refundable: boolean; deposit: number;
  screening_criteria_url: string; asks_criminal_history: boolean;
  photos: string[]; landlord_contact: string;
  // Compare-card facts (route facts only, no crime or demographic data)
  night: { walkMin: number; litShare: number; lastBus: string };
  owlZone: boolean; translocCovered: boolean;
  quietLabel: string | null;
  poi: { groceryMin: number; gymMin: number | null; lateFood: number; busStopMin: number };
  campusCommute: Record<Campus, CommuteFacts>;
  example: true;
}
