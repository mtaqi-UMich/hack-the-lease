// Everything the extension keeps lives on the student's device (chrome.storage.local). Nothing is sent to our server
// except: page text for the AI fallback (not stored there) and the saved places the student's own browser hands to
// /compare when they open it (computed per request, not stored).
import type { Profile } from '../../lib/session';
import type { Extracted } from '../../lib/extract';
import type { Source } from './adapters';

export interface SavedPlace {
  id: string;                       // "X-" + hash(url)
  sourceUrl: string; sourceHost: string; capturedAt: string; title: string;
  fields: (Pick<Extracted, 'key' | 'value' | 'status'> & { evidence: string | null; source?: Source })[];
  coord?: [number, number];
  label: string;                    // short name shown in the compare column
}
export interface Store { profile?: Profile; name?: string; site?: string; connectedAt?: string; saved: SavedPlace[]; installId: string; showPill?: boolean }

export const DEFAULT_SITE = 'https://hack-the-lease-kappa.vercel.app';

export async function load(): Promise<Store> {
  const s = await chrome.storage.local.get(null) as Partial<Store>;
  let installId = s.installId;
  if (!installId) { installId = crypto.randomUUID(); await chrome.storage.local.set({ installId }); }
  return { saved: [], ...s, installId } as Store;
}
export const save = (patch: Partial<Store>) => chrome.storage.local.set(patch);

export async function savePlace(p: SavedPlace) {
  const s = await load();
  const saved = [p, ...s.saved.filter(x => x.id !== p.id)].slice(0, 50);
  await save({ saved });
  return saved;
}
export async function deleteAll() { await chrome.storage.local.remove(['saved', 'cache', 'geo']); }

// small device caches: AI reads keyed by hash(url + text), geocodes keyed by address
export async function cacheGet<T>(bucket: 'cache' | 'geo', key: string): Promise<T | undefined> {
  const r = await chrome.storage.local.get(bucket); return (r[bucket] as Record<string, T> | undefined)?.[key];
}
export async function cacheSet<T>(bucket: 'cache' | 'geo', key: string, v: T) {
  const r = await chrome.storage.local.get(bucket); const m = (r[bucket] as Record<string, T> | undefined) ?? {};
  const keys = Object.keys(m); if (keys.length > 200) delete m[keys[0]];
  m[key] = v; await chrome.storage.local.set({ [bucket]: m });
}
export async function hash(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}
