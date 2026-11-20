import { NextResponse } from 'next/server';
import { byId } from '@/lib/data';

// GET /api/poi?ids=a,b,c&category=gym|grocery|late_food|bus_stop
// Pre-computed per listing (synthetic Example POIs; real build: OpenStreetMap Overpass + OSRM walking times).
const CATS = {
  gym: (l: NonNullable<ReturnType<typeof byId.get>>) => l.amenities.gym_onsite ? { label: 'In building', minutes: 0 } : l.poi.gymMin != null ? { label: `${l.poi.gymMin} min walk`, minutes: l.poi.gymMin } : { label: 'None nearby', minutes: null },
  grocery: (l: NonNullable<ReturnType<typeof byId.get>>) => ({ label: `${l.poi.groceryMin} min walk`, minutes: l.poi.groceryMin }),
  late_food: (l: NonNullable<ReturnType<typeof byId.get>>) => ({ label: `${l.poi.lateFood} open late`, count: l.poi.lateFood }),
  bus_stop: (l: NonNullable<ReturnType<typeof byId.get>>) => ({ label: `${l.poi.busStopMin} min to stop`, minutes: l.poi.busStopMin }),
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
  const cat = (url.searchParams.get('category') ?? 'grocery') as keyof typeof CATS;
  if (!CATS[cat]) return NextResponse.json({ error: `category must be one of ${Object.keys(CATS).join(', ')}` }, { status: 400 });
  const out = ids.map(id => { const l = byId.get(id); return l ? { id, ...CATS[cat](l) } : { id, error: 'not found' }; });
  return NextResponse.json({ category: cat, results: out, provenance: 'Estimated', example: true });
}
