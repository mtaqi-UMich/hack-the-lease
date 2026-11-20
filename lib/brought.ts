/* A listing the student brought from elsewhere ("Bring any listing"), turned into a full Listing so it can sit
 * in the Compare matrix next to our Example listings.
 * - The place's own facts (rent, beds, fees, utilities, laundry, parking, pets, AC, lease start, deposit, app fee)
 *   come only from what the student pasted / typed. Anything not stated stays Unknown.
 * - Neighbourhood facts (commute, night walk, bus stop, groceries) are Estimated from the nearest Example listing
 *   in the same area, because we never visit the source site.
 * Private to the student: never added to LISTINGS, never ranked for anyone else. */
import { LISTINGS } from './data';
import { geocode, type Extracted, type FieldKey } from './extract';
import type { Fee, Listing } from './types';

export const BROUGHT_ID = 'BYO';
export interface Brought { fields: Pick<Extracted, 'key' | 'value' | 'status'>[]; hood?: string; label?: string }

const dist2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function broughtToListing(b: Brought): Listing | null {
  const get = (k: FieldKey) => b.fields.find(f => f.key === k && f.status === 'Listed')?.value ?? null;
  const rent = get('rent') == null ? null : Number(get('rent'));
  const beds = get('beds') == null ? null : Number(get('beds'));
  if (!rent || !beds) return null;
  const address = (get('address') as string | null) ?? null;
  const geo = geocode(address, b.hood ?? '');
  const tpl = LISTINGS.filter(l => l.hood === geo.hood).sort((x, y) => dist2(x.coord, geo.coord) - dist2(y.coord, geo.coord))[0]
    ?? [...LISTINGS].sort((x, y) => dist2(x.coord, geo.coord) - dist2(y.coord, geo.coord))[0];

  const basis = get('price_basis') as Listing['price_basis'];
  const unitTotal = basis === 'per_bed' ? rent * beds : rent;
  const feesText = get('fees') as string | null;
  const feeAmt = feesText?.match(/\$\s?(\d[\d,]*)/);
  const required_fees: Fee[] | null = feesText ? (feeAmt ? [{ name: feesText.replace(/\$\s?\d[\d,]*/, '').trim() || 'Required fee', amount: Number(feeAmt[1].replace(/,/g, '')), monthly: true }] : null) : null;
  const laundryV = get('laundry') as string | null;
  const laundry: Listing['amenities']['laundry'] = laundryV === 'in_unit' ? 'in_unit' : laundryV === 'in_building' ? 'in_building' : laundryV === 'none' ? 'none' : 'none';
  const yes = (k: FieldKey) => get(k) === true;
  const short = `${geo.hood.startsWith('Unknown') ? 'Your' : geo.hood.split(' / ')[0]} ${beds}BR`;

  return {
    ...tpl,
    id: BROUGHT_ID, name: address ?? 'Your listing', short, hood: geo.hood,
    landlord_id: 'byo', building_id: 'BYO', source: 'bring_your_own', verified_at: null,
    address: address ?? 'Address not given', beds, baths: Number(get('baths') ?? 1), sqft: Number(get('sqft') ?? 0),
    rent: unitTotal, inUnit: laundry === 'in_unit', parking: yes('parking'), ac: yes('ac'), pets: yes('pets'), quality: 0.5,
    price_basis: basis ?? null, price_amount: rent, unit_total: unitTotal,
    required_fees, optional_fees: [],
    utilities_included: (get('utilities_included') as string[] | null) ?? [], utilities_listed: null,
    lease_type: basis === 'per_bed' ? 'individual' : basis === 'per_unit' ? 'joint' : null, roommate_matching: false,
    lease_start: (get('lease_start') as string | null) ?? 'Not stated', lease_months: [12],
    amenities: { laundry, ac: yes('ac'), furnished: false, private_bath: false, pets: yes('pets'), parking: yes('parking'), parking_fee: null, gym_onsite: false },
    application_fee: Number(get('application_fee') ?? 0), application_fee_refundable: false, deposit: Number(get('deposit') ?? 0),
    screening_criteria_url: '', asks_criminal_history: false, landlord_contact: '',
    quietLabel: null, photos: [],
    example: true,
  } as Listing;
}
