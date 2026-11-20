import { NextResponse } from 'next/server';
import { benchNext, buildCards, type XReason } from '@/lib/compare';

// POST { profile, shown[], removed_id, reason: too_expensive|too_far|dont_like|skip, seen[] }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.removed_id || !Array.isArray(b.shown)) return NextResponse.json({ error: 'removed_id and shown[] required' }, { status: 400 });
  const out = benchNext(b.profile ?? {}, b.shown, b.removed_id, (b.reason ?? 'skip') as XReason, b.seen ?? []);
  return NextResponse.json({ ...out, cards: buildCards(out.shown, out.profile), example: true });
}
