// One page → listing fields, used both for "Read this page" and for each page of a multi-page scan.
// Order: site adapters → structured data → page text → AI fallback (only if rent or beds are missing) → map lookup.
import type { ReadResult } from './adapters';
import { mergeAI, readSnapshot, toExtracted } from './read';
import { snapshotPage, type PageSnapshot } from './snapshot';
import { detectChallenge, type Challenge } from './discover';
import { geocode } from './geocode';
import { DEFAULT_SITE, cacheGet, cacheSet, hash, type SavedPlace, type Store } from './store';
import type { Extracted } from '../../lib/extract';

export async function snapshotTab(tabId: number): Promise<PageSnapshot> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: snapshotPage });
  return res.result as PageSnapshot;
}

export const challengeOf = (s: PageSnapshot): Challenge | null => detectChallenge(s);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Wait (up to `maxMs`) for the student to finish a bot check in `tabId`, re-reading the page every 2 s.
 *  We never click, type or solve anything — the student does it. Resolves with the real page, or null on timeout/cancel. */
export async function waitForHuman(tabId: number, cancelled: () => boolean, maxMs = 5 * 60_000): Promise<PageSnapshot | null> {
  const end = Date.now() + maxMs;
  while (Date.now() < end && !cancelled()) {
    await sleep(2000);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status !== 'complete') continue;
      const s = await snapshotTab(tabId);
      if (!challengeOf(s)) { await sleep(1200); return snapshotTab(tabId); } // let the real page finish rendering
    } catch { return null; } // tab closed
  }
  return null;
}

/** Open `url` in a background tab and wait until it has loaded. */
export async function openAndLoad(url: string, timeoutMs = 25_000): Promise<chrome.tabs.Tab> {
  const tab = await chrome.tabs.create({ url, active: false });
  await new Promise<void>(resolve => {
    const t = setTimeout(done, timeoutMs);
    function done() { clearTimeout(t); chrome.tabs.onUpdated.removeListener(on); resolve(); }
    function on(id: number, info: chrome.tabs.TabChangeInfo) { if (id === tab.id && info.status === 'complete') done(); }
    chrome.tabs.onUpdated.addListener(on);
  });
  await sleep(1500); // most listing sites render prices with JavaScript after "complete"
  return tab;
}

export interface Analysed { read: ReadResult; coord?: [number, number]; aiNote: string }

export async function analyse(snap: PageSnapshot, store: Store, onStep?: (s: string) => void): Promise<Analysed> {
  const first = readSnapshot(snap);
  let read: ReadResult = first;
  let aiNote = '';
  if (first.needsAI && read.text.length > 80) {
    onStep?.('Reading the listing text…');
    const key = await hash(snap.url + read.text);
    let ai = await cacheGet<Extracted[]>('cache', key);
    if (!ai) {
      try {
        const r = await fetch(`${store.site ?? DEFAULT_SITE}/api/listings/extract`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: read.text, sourceHost: snap.host, installId: store.installId, profile: store.profile ?? {} }) });
        if (r.status === 429) aiNote = 'AI limit reached for this hour — showing what the page itself states.';
        else if (r.ok) { const j = await r.json() as { fields: Extracted[]; source: string; note?: string }; ai = j.fields; if (j.source !== 'ai') aiNote = j.note || 'AI not available — used our rule-based reader.'; else await cacheSet('cache', key, ai); }
      } catch { aiNote = 'Couldn’t reach Hack the Lease — showing what the page itself states.'; }
    }
    if (ai) read = mergeAI(read, ai);
  }
  let coord = read.coord;
  const address = read.fields.address?.value as string | undefined;
  if (!coord && address) { onStep?.('Finding it on the map…'); coord = (await geocode(address)) ?? undefined; }
  return { read, coord, aiNote };
}

export function labelOf(read: ReadResult, host: string, beds?: number): string {
  const a = read.fields.address?.value as string | undefined;
  const b = beds ?? (read.fields.beds?.value as number | undefined);
  return `${a ? a.split(',')[0] : host}${b != null ? ` · ${b === 0 ? 'Studio' : `${b}BR`}` : ''}`.slice(0, 40);
}

export async function toSaved(snap: PageSnapshot, a: Analysed, fields: Extracted[], label: string, scannedFrom?: string): Promise<SavedPlace> {
  return {
    id: 'X-' + (await hash(snap.url)), sourceUrl: snap.url, sourceHost: snap.host, capturedAt: new Date().toISOString(), title: snap.title, label, coord: a.coord, scannedFrom,
    fields: fields.map(f => ({ key: f.key, value: f.value, status: f.status, evidence: f.evidence, source: a.read.fields[f.key]?.source })),
  };
}

/** Fields for a scanned page: if it lists several floor plans and no single rent, take the cheapest plan that fits the group. */
export function scanFields(read: ReadResult, group: number | undefined): { fields: Extracted[]; beds?: number } {
  const f = { ...read.fields };
  if (!f.rent && read.units.length) {
    const fit = read.units.filter(u => group == null || (u.beds >= group && u.beds <= group + 1));
    const u = (fit.length ? fit : read.units).slice().sort((x, y) => x.rent - y.rent)[0];
    f.rent = { value: u.rent, evidence: `Cheapest floor plan that fits: ${u.label}`, source: 'page text' };
    f.beds = { value: u.beds, evidence: u.label, source: 'page text' };
    if (u.basis) f.price_basis = { value: u.basis, evidence: u.evidence ?? u.label, source: 'page text' };
    return { fields: toExtracted(f), beds: u.beds };
  }
  return { fields: toExtracted(f) };
}
