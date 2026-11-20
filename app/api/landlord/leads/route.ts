import { NextResponse } from 'next/server';
import { leadsFor } from '@/lib/apply';

// GET /api/landlord/leads?landlord=hackberry → pre-qualified leads (synthetic Example students)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('landlord') ?? 'hackberry';
  return NextResponse.json({ landlord: id, leads: leadsFor(id), example: true });
}
