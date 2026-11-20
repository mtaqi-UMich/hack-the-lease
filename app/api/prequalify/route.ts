import { NextResponse } from 'next/server';
import { prequalify, type PreQ } from '@/lib/apply';
import { byId } from '@/lib/data';

// POST { ids: string[], pay, credit, monthly?, group? } → verdict per listing. No SSN, no fee, nothing stored.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const q: PreQ = { pay: b.pay ?? 'parent', credit: b.credit ?? 'none', monthly: b.monthly != null ? Number(b.monthly) : undefined };
  const ids: string[] = Array.isArray(b.ids) ? b.ids : [];
  const results = ids.map(id => { const l = byId.get(id); return l ? { id, short: l.short, ...prequalify(l, q, b.group ?? 1) } : { id, error: 'not found' }; });
  return NextResponse.json({ results, stored: false, example: true });
}
