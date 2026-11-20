// Address → coordinates, on the device, with OpenStreetMap Nominatim (usage policy: ≤1 request/second, cache results,
// identify the app). Results are cached in chrome.storage.local. If it fails, the commute is Unknown — never guessed.
import { cacheGet, cacheSet } from './store';

let last = 0;
const AA_BOX = '-83.86,42.35,-83.62,42.20'; // viewbox around Ann Arbor (lon1,lat1,lon2,lat2)

export async function geocode(address: string): Promise<[number, number] | null> {
  const key = address.trim().toLowerCase();
  const hit = await cacheGet<[number, number] | null>('geo', key);
  if (hit !== undefined) return hit;
  const wait = Math.max(0, last + 1100 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
  const q = /ann arbor|ypsilanti|\bmi\b|michigan|481\d\d/i.test(address) ? address : `${address}, Ann Arbor, MI`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=${AA_BOX}&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'en' }, referrerPolicy: 'strict-origin' });
    if (!r.ok) return null;
    const j = await r.json() as { lat: string; lon: string }[];
    const c: [number, number] | null = j[0] ? [Number(j[0].lat), Number(j[0].lon)] : null;
    await cacheSet('geo', key, c);
    return c;
  } catch { return null; }
}
