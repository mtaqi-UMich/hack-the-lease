import { NextResponse } from 'next/server';
import { checkListing, autoFix, DEMO_DRAFT, type ListingDraft } from '@/lib/compliance';

// POST { draft?: ListingDraft, fix?: boolean } → Ann Arbor compliance checks before publishing
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  let draft: ListingDraft = { ...DEMO_DRAFT, ...(b.draft ?? {}) };
  if (b.fix) draft = autoFix(draft);
  return NextResponse.json({ draft, ...checkListing(draft), example: true });
}
