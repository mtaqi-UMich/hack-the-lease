/* Pre-qualify (PRD 7.1 step 1) and the lease review. No SSN, no credit report, no criminal history — ever. */
import { byId, landlordName } from './data';
import { trueMonthlyCost } from './cost';
import { APP_FEE_CAP, DEPOSIT_MAX_MONTHS } from './compliance';
import { createEngine, mulberry32, sampleStudent } from './engine';
import { LISTINGS } from './data';
import type { Listing } from './types';

export type Payer = 'parent' | 'income' | 'aid' | 'service';
export type Credit = 'none' | 'below650' | '650plus';
export interface PreQ { pay: Payer; credit: Credit; monthly?: number; international?: boolean }
export type Verdict = 'Likely eligible' | 'Likely needs a guarantor' | 'Missing: proof of funds' | 'Not accepted here';

export const INCOME_MULTIPLE = 3;

/** Each landlord's screening rules (Example data — in production these come from the landlord's published criteria).
 *  incomeX: monthly income needed as a multiple of rent · minCredit: lowest US credit accepted (no credit history never passes alone)
 *  guarantorX: what a parent/co-signer must earn as a multiple of rent · service: accepts guarantor services (TheGuarantors, Leap, etc.) */
export interface Screening { incomeX: number; minCredit: 'below650' | '650plus'; guarantorX: number; service: boolean }
export const SCREENING: Record<string, Screening> = {
  hackberry: { incomeX: 3, minCredit: '650plus', guarantorX: 4, service: true },
  maizeblue: { incomeX: 3, minCredit: '650plus', guarantorX: 4, service: true },
  arborprop: { incomeX: 3, minCredit: '650plus', guarantorX: 5, service: false },
  huronview: { incomeX: 2.5, minCredit: '650plus', guarantorX: 4, service: true },
  kerrylane: { incomeX: 3, minCredit: 'below650', guarantorX: 3, service: false },
  packardpm: { incomeX: 3.5, minCredit: '650plus', guarantorX: 5, service: true },
  northwoodre: { incomeX: 3, minCredit: '650plus', guarantorX: 4, service: true },
  owner_jlee: { incomeX: 2.5, minCredit: 'below650', guarantorX: 3, service: false },
  owner_mpatel: { incomeX: 3, minCredit: 'below650', guarantorX: 3, service: false },
};
const DEFAULT_SCREENING: Screening = { incomeX: INCOME_MULTIPLE, minCredit: '650plus', guarantorX: 4, service: true };
export const screeningFor = (landlordId: string) => SCREENING[landlordId] ?? DEFAULT_SCREENING;

/** Pre-qualify against this landlord's own rules. Aid and family support count as income (source of income is protected in Ann Arbor). */
export function prequalify(l: Listing, q: PreQ, group = 1): { verdict: Verdict; why: string; rentPerPerson: number; rules: string } {
  const rent = trueMonthlyCost(l, { group, mode: 'bus', needsParking: false }).perPerson;
  const sc = screeningFor(l.landlord_id);
  const who = landlordName(l.landlord_id);
  const $ = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  const rules = `${who}: income ${sc.incomeX}× rent, credit ${sc.minCredit === '650plus' ? '650+' : 'any score'}, guarantor ${sc.guarantorX}× rent, guarantor services ${sc.service ? 'accepted' : 'not accepted'}`;
  if (q.pay === 'parent') return { verdict: 'Likely eligible', why: `Your guarantor needs to earn about ${$(rent * sc.guarantorX)} a month (${sc.guarantorX}× rent) — ${who}’s rule.`, rentPerPerson: rent, rules };
  if (q.pay === 'service') return sc.service
    ? { verdict: 'Likely eligible', why: `${who} accepts guarantor services; they usually charge 60–110% of one month’s rent (about ${$(rent * 0.6)}–${$(rent * 1.1)} once).`, rentPerPerson: rent, rules }
    : { verdict: 'Not accepted here', why: `${who} doesn’t accept guarantor services. A parent guarantor earning ${$(rent * sc.guarantorX)} a month would work, or pick another place.`, rentPerPerson: rent, rules };
  const need = rent * sc.incomeX;
  const monthly = q.monthly ?? 0;
  if (monthly <= 0) return { verdict: 'Missing: proof of funds', why: `Add your monthly ${q.pay === 'aid' ? 'aid' : 'income'} — ${who} asks for about ${$(need)} a month (${sc.incomeX}× rent).`, rentPerPerson: rent, rules };
  const incomeOk = monthly >= need;
  const creditOk = q.credit === '650plus' || (q.credit === 'below650' && sc.minCredit === 'below650');
  if (incomeOk && creditOk) return { verdict: 'Likely eligible', why: `${q.pay === 'aid' ? 'Aid counts as income here — that’s the law in Ann Arbor. ' : ''}${$(monthly)} covers ${who}’s ${sc.incomeX}× rent (${$(need)}).`, rentPerPerson: rent, rules };
  const fix = sc.service ? 'a parent guarantor or a guarantor service fixes this' : 'a parent guarantor fixes this (no guarantor services here)';
  return { verdict: 'Likely needs a guarantor', why: !incomeOk ? `${$(monthly)} is under ${who}’s ${sc.incomeX}× rent (${$(need)}) — ${fix}.` : `${q.credit === 'none' ? 'No US credit history yet' : 'Credit below 650'} — ${who} asks for 650+; ${fix}.`, rentPerPerson: rent, rules };
}

export interface LeaseLine { label: string; value: string; flag?: string }
export function leaseReview(l: Listing, group = 1): LeaseLine[] {
  const c = trueMonthlyCost(l, { group, mode: 'bus', needsParking: false });
  const rent = c.lines[0].amount!;
  const monthlyRentForDeposit = l.price_basis === 'per_bed' ? l.price_amount : l.unit_total;
  const out: LeaseLine[] = [
    { label: 'Your cost per month', value: `$${c.perPerson.toLocaleString('en-US')} (rent $${rent.toLocaleString('en-US')} + fees, utilities, laundry)` },
    { label: 'Lease type', value: l.price_basis === 'per_bed' ? 'Individual — you only owe your own bed' : `Joint — everyone owes the full $${l.unit_total.toLocaleString('en-US')} if someone leaves` },
    { label: 'Dates', value: `Starts ${l.lease_start} · ${l.lease_months.join(' or ')} months` },
    { label: 'Deposit', value: `$${l.deposit.toLocaleString('en-US')}`, flag: l.deposit > monthlyRentForDeposit * DEPOSIT_MAX_MONTHS ? `Over the ${DEPOSIT_MAX_MONTHS}× rent cap` : undefined },
    { label: 'Application fee', value: `$${l.application_fee}${l.application_fee_refundable ? ', refundable if you’re not offered the unit' : ''}`, flag: l.application_fee > APP_FEE_CAP ? `Over Ann Arbor’s $${APP_FEE_CAP} cap` : undefined },
    { label: 'Required fees', value: l.required_fees === null ? 'Not stated — ask before signing' : l.required_fees.length ? l.required_fees.map(f => `${f.name} $${f.amount}/mo`).join(', ') : 'None outside rent', flag: l.required_fees?.length ? 'Required fees should be inside base rent (Ann Arbor, since Aug 1 2026)' : undefined },
  ];
  return out;
}

// ---------- leads for the landlord inbox (synthetic Example students) ----------
export interface Lead { id: string; init: string; name: string; listing_id: string; unit: string; budget: number; move_in: string; who: string; guarantor: string; reasons: string[]; cta: 'Invite' | 'Confirm' | 'Reply' }
const NAMES = ['Alex R.', 'Priya S.', 'Jordan M.', 'Dana L.', 'Sam K.', 'Wei Z.', 'Maya T.', 'Omar H.', 'Lena P.', 'Chris B.'];
export function leadsFor(landlordId = 'hackberry', n = 6): Lead[] {
  const mine = LISTINGS.filter(l => l.landlord_id === landlordId);
  const eng = createEngine({ listings: LISTINGS, poolSize: 10 });
  const rng = mulberry32(2026);
  const out: Lead[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 4000) {
    const s = sampleStudent(rng, {}).s;
    const best = eng.bestListing(s, LISTINGS);
    if (best < 0 || LISTINGS[best].landlord_id !== landlordId) continue;
    const l = LISTINGS[best]; const e = eng.evaluate(s, l)!;
    const name = NAMES[out.length % NAMES.length];
    const reasons = [`${Math.round(e.mins)} min to ${s.base === 'Split' ? 'Central + North' : s.base}`, l.inUnit ? 'in-unit laundry' : '', e.over === 0 ? 'inside budget' : '', s.quiet && l.quiet > 0.6 ? 'quiet' : ''].filter(Boolean);
    out.push({
      id: `lead${out.length + 1}`, init: name.split(' ').map(w => w[0]).join(''), name, listing_id: l.id, unit: l.short, budget: Math.round(s.budget / 25) * 25,
      move_in: l.lease_start, who: `${s.group === 1 ? '1 bed' : s.group === 2 ? '+1 roommate' : `Group of ${s.group}`} · ${rng() < 0.5 ? 'guarantor ready' : 'income 3× rent'}`,
      guarantor: rng() < 0.5 ? 'Parent (US)' : 'None needed', reasons, cta: (['Invite', 'Invite', 'Confirm', 'Reply'] as const)[out.length % 4],
    });
  }
  return mine.length ? out : [];
}
export { byId };
