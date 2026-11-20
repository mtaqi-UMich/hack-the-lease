import { NextResponse } from 'next/server';
import { byId } from '@/lib/data';
import { leaseReview } from '@/lib/apply';
import { APP_FEE_CAP } from '@/lib/compliance';

// POST { listing_id, housing_id, funding } → mock submission (Example). Never accepts SSN / credit / criminal history.
const FORBIDDEN = /ssn|social.?security|credit.?report|criminal/i;
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const l = byId.get(b.listing_id);
  if (!l) return NextResponse.json({ error: 'listing_id not found' }, { status: 404 });
  if (FORBIDDEN.test(JSON.stringify(b))) return NextResponse.json({ error: 'We never collect SSNs, credit reports or criminal history — the screening partner handles identity and credit.' }, { status: 400 });
  return NextResponse.json({
    id: `APP-${l.id}-${Date.now().toString(36).toUpperCase()}`, status: 'submitted', listing_id: l.id, unit: l.short,
    screening_fee: Math.min(35, APP_FEE_CAP), lease_review: leaseReview(l, b.group ?? 1), mock: true, example: true,
  });
}
