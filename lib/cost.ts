// True monthly cost per person — PRD 2.6. Every line carries exactly one label: Listed | Estimated | Unknown.
import type { Listing, Provenance } from './types';
import type { Mode } from './engine';

export interface CostLine { key: 'rent' | 'fees' | 'utilities' | 'parking' | 'transport' | 'laundry'; label: string; amount: number | null; provenance: Provenance; note: string }
export interface TrueCost { perPerson: number; lines: CostLine[]; unknowns: string[]; wholeUnit: number | null }

/** Estimated utilities per person per month by unit size and month (winter heating). */
export function estimateUtilities(beds: number, month = 1, included: string[] = []) {
  const winter = [12, 1, 2].includes(month) ? 1.35 : [11, 3].includes(month) ? 1.15 : 1;
  const unit = (95 + 40 * beds) * winter; // electric + gas + internet for the whole unit
  const credit = (included.includes('internet') ? 55 : 0) + (included.includes('water') ? 25 : 0);
  return Math.max(20, Math.round((unit - credit) / beds));
}
/** Laundry per person: in-unit $0; otherwise loads/week × price × 4.3 weeks. */
export function estimateLaundry(kind: Listing['amenities']['laundry'], loadsPerWeek = 1.5) {
  if (kind === 'in_unit') return 0;
  const perLoad = kind === 'none' ? 4.5 : 3.0; // wash + dry; laundromat if none
  return Math.round(loadsPerWeek * perLoad * 4.3);
}

export function perPersonRent(l: Listing, group: number) {
  if (l.price_basis === 'per_bed') return l.price_amount;
  return Math.round(l.unit_total / Math.max(1, Math.min(group, l.beds)));
}

export function trueMonthlyCost(l: Listing, opts: { group: number; mode: Mode; needsParking: boolean; month?: number }): TrueCost {
  const lines: CostLine[] = [];
  const rent = perPersonRent(l, opts.group);
  lines.push({
    key: 'rent', label: 'Rent', amount: rent,
    provenance: l.price_basis ? 'Listed' : 'Estimated',
    note: l.price_basis === 'per_bed' ? 'Per bed, as listed' : l.price_basis === 'per_unit' ? `Whole unit $${l.unit_total.toLocaleString('en-US')} ÷ ${Math.min(opts.group, l.beds)}` : 'Listing does not say per bed or per unit — we assumed whole unit split evenly',
  });
  if (l.required_fees === null) lines.push({ key: 'fees', label: 'Fees', amount: null, provenance: 'Unknown', note: 'Not stated — ask the landlord' });
  else {
    const f = l.required_fees.filter(x => x.monthly).reduce((s, x) => s + x.amount, 0);
    lines.push({ key: 'fees', label: 'Fees', amount: f, provenance: 'Listed', note: f ? l.required_fees.map(x => x.name).join(', ') : 'No required fees listed' });
  }
  if (l.utilities_listed != null) lines.push({ key: 'utilities', label: 'Utilities', amount: l.utilities_listed, provenance: 'Listed', note: 'Landlord estimate' });
  else lines.push({ key: 'utilities', label: 'Utilities', amount: estimateUtilities(l.beds, opts.month ?? 1, l.utilities_included), provenance: 'Estimated', note: `Our model: ${l.beds}-bed unit in ${opts.month && ![12, 1, 2].includes(opts.month) ? 'season' : 'winter'}${l.utilities_included.length ? `, ${l.utilities_included.join(' + ')} included` : ''}` });
  if (opts.needsParking) {
    if (!l.amenities.parking) lines.push({ key: 'parking', label: 'Parking', amount: null, provenance: 'Unknown', note: 'No parking listed' });
    else lines.push({ key: 'parking', label: 'Parking', amount: l.amenities.parking_fee ?? 0, provenance: l.amenities.parking_fee != null ? 'Listed' : 'Unknown', note: 'Spot on site' });
  }
  if (opts.mode === 'drive') lines.push({ key: 'transport', label: 'Transport', amount: 85, provenance: 'Estimated', note: 'Gas + campus permit share' });
  else lines.push({ key: 'transport', label: 'Transport', amount: 0, provenance: 'Listed', note: opts.mode === 'bus' ? 'Bus is free with your MCard (MRide)' : 'Walk / bike' });
  lines.push({ key: 'laundry', label: 'Laundry', amount: estimateLaundry(l.amenities.laundry), provenance: l.amenities.laundry === 'in_unit' ? 'Listed' : 'Estimated', note: l.amenities.laundry === 'in_unit' ? 'In-unit machine' : '1.5 loads a week' });
  const perPerson = lines.reduce((s, x) => s + (x.amount ?? 0), 0);
  return { perPerson, lines, unknowns: lines.filter(x => x.provenance === 'Unknown').map(x => x.label), wholeUnit: l.price_basis === 'per_unit' ? l.unit_total : null };
}
