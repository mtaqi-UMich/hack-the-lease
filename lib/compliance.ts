/* Ann Arbor / Michigan leasing rules (PRD 7.3) — used by the landlord listing check and the student's lease review.
 * Not legal advice. Sources: ORD-26-04 (fees, effective Aug 1 2026), Fair Chance Access to Housing, MCL 554.602. */
export const APP_FEE_CAP = 50;
export const DEPOSIT_MAX_MONTHS = 1.5;

export interface ListingDraft {
  rent: number;                       // advertised monthly base rent (per unit or per bed, as advertised)
  price_basis?: 'per_bed' | 'per_unit' | null;
  lease_type?: 'individual' | 'joint' | 'both' | null;
  application_fee: number; application_fee_refundable: boolean;
  deposit: number;
  required_fees: { name: string; amount: number; in_base_rent: boolean }[];
  pre_tenancy_fees?: { name: string; amount: number }[];   // e.g. waitlist / holding fees
  utilities_disclosed: boolean;
  asks_criminal_history: boolean;
  screening_criteria_provided?: boolean;
  applications_open_on?: string | null;
}
export interface Check { id: string; pass: boolean; title: string; sub: string; fix?: string }

export function checkListing(d: ListingDraft): { checks: Check[]; failures: number; publishable: boolean } {
  const checks: Check[] = [];
  const feeOk = d.application_fee <= APP_FEE_CAP && d.application_fee_refundable;
  checks.push({
    id: 'app_fee', pass: feeOk,
    title: feeOk ? `Application fee $${d.application_fee}` : d.application_fee > APP_FEE_CAP ? `Application fee $${d.application_fee} is over the cap` : `Application fee $${d.application_fee} isn’t refundable`,
    sub: `Cap is $${APP_FEE_CAP}, refundable if the applicant isn’t offered the unit`,
    fix: feeOk ? undefined : `Set the fee to $${Math.min(d.application_fee, APP_FEE_CAP)} and mark it refundable`,
  });
  const maxDep = Math.round(d.rent * DEPOSIT_MAX_MONTHS);
  const depOk = d.deposit <= maxDep;
  checks.push({ id: 'deposit', pass: depOk, title: `Deposit $${d.deposit.toLocaleString('en-US')}${depOk ? '' : ' is too high'}`, sub: `Max is ${DEPOSIT_MAX_MONTHS}× monthly rent ($${maxDep.toLocaleString('en-US')})`, fix: depOk ? undefined : `Lower the deposit to $${maxDep.toLocaleString('en-US')}` });
  const outside = d.required_fees.filter(f => !f.in_base_rent);
  checks.push({
    id: 'fees_in_rent', pass: outside.length === 0,
    title: outside.length ? `${outside.map(f => `$${f.amount} ${f.name.toLowerCase()}`).join(', ')} listed separately` : d.required_fees.length ? 'Required fees are in base rent' : 'No required fees outside rent',
    sub: 'Required fees must be in the advertised rent',
    fix: outside.length ? `Add $${outside.reduce((s, f) => s + f.amount, 0)} to the advertised rent` : undefined,
  });
  const pre = d.pre_tenancy_fees ?? [];
  checks.push({ id: 'pre_tenancy', pass: pre.length === 0, title: pre.length ? `${pre.map(f => f.name).join(', ')} not allowed` : 'No pre-tenancy fees', sub: 'Waitlist, holding and other pre-tenancy fees are banned', fix: pre.length ? 'Remove pre-tenancy fees' : undefined });
  checks.push({ id: 'utilities', pass: d.utilities_disclosed, title: d.utilities_disclosed ? 'Utilities disclosed' : 'Utilities not disclosed', sub: 'Ads must say which utilities are included', fix: d.utilities_disclosed ? undefined : 'List which utilities are included' });
  checks.push({ id: 'criminal', pass: !d.asks_criminal_history, title: d.asks_criminal_history ? 'Criminal-history question on the application' : 'No criminal-history question', sub: 'Fair Chance rules: can’t be used in tenant selection', fix: d.asks_criminal_history ? 'Remove the criminal-history question' : undefined });
  const basisOk = !!d.price_basis && !!d.lease_type;
  checks.push({ id: 'structure', pass: basisOk, title: basisOk ? 'Price basis and lease type stated' : 'Price basis or lease type missing', sub: 'Required on our site: per bed or per unit, individual or joint', fix: basisOk ? undefined : 'Choose per bed / per unit and individual / joint' });
  if (d.screening_criteria_provided === false) checks.push({ id: 'criteria', pass: false, title: 'Screening criteria not provided', sub: 'Applicants must get criteria in writing before paying a fee', fix: 'Link your written screening criteria' });
  const failures = checks.filter(c => !c.pass).length;
  return { checks, failures, publishable: failures === 0 };
}

/** Apply every suggested fix (the "Fix N items and publish" button). */
export function autoFix(d: ListingDraft): ListingDraft {
  const outside = d.required_fees.filter(f => !f.in_base_rent).reduce((s, f) => s + f.amount, 0);
  const rent = d.rent + outside;
  return {
    ...d, rent,
    application_fee: Math.min(d.application_fee, APP_FEE_CAP), application_fee_refundable: true,
    deposit: Math.min(d.deposit, Math.round(rent * DEPOSIT_MAX_MONTHS)),
    required_fees: d.required_fees.map(f => ({ ...f, in_base_rent: true })),
    pre_tenancy_fees: [], utilities_disclosed: true, asks_criminal_history: false,
    price_basis: d.price_basis ?? 'per_unit', lease_type: d.lease_type ?? 'joint', screening_criteria_provided: d.screening_criteria_provided === false ? true : d.screening_criteria_provided,
  };
}

/** The demo draft on the landlord screen (Example): 2 problems, as in design/Landlord.dc.html. */
export const DEMO_DRAFT: ListingDraft = {
  rent: 1400, price_basis: 'per_unit', lease_type: 'joint',
  application_fee: 35, application_fee_refundable: true, deposit: 1400,
  required_fees: [{ name: 'Amenity fee', amount: 40, in_base_rent: false }],
  pre_tenancy_fees: [], utilities_disclosed: false, asks_criminal_history: false, screening_criteria_provided: true,
};
