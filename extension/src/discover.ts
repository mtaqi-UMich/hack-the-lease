// Pure helpers (unit-tested): spotting a "prove you're human" page, and finding listing links on a search-results page.
// We never solve or bypass a check: the panel pauses, brings that tab to the front and asks the student to do it.
import type { PageSnapshot } from './snapshot';

export interface Challenge { kind: string; message: string }

const TITLE_RX: [RegExp, string][] = [
  [/access to this page has been denied/i, 'Access check'],
  [/just a moment/i, 'Cloudflare check'],
  [/attention required/i, 'Cloudflare check'],
  [/are you a (human|robot)/i, 'Human check'],
  [/verify(ing)? you are (a )?human/i, 'Human check'],
  [/security check/i, 'Security check'],
  [/captcha/i, 'CAPTCHA'],
];
const TEXT_RX: [RegExp, string][] = [
  [/press\s*&\s*hold/i, 'Press & hold check'],
  [/verify (that )?you are (a )?human/i, 'Human check'],
  [/(complete|solve) the (security )?(check|captcha)/i, 'CAPTCHA'],
  [/checking (if the site connection is secure|your browser)/i, 'Cloudflare check'],
  [/please confirm you are not a robot/i, 'Human check'],
  [/unusual (traffic|activity) from your (computer|network)/i, 'Human check'],
];

/** Is this snapshot a bot-check page rather than the listing? Only short pages count: a listing that merely mentions "captcha" isn't one. */
export function detectChallenge(s: Pick<PageSnapshot, 'title' | 'text'> & { captcha?: string[] }): Challenge | null {
  const frames = s.captcha ?? [];
  const short = s.text.trim().length < 2500;
  const t = TITLE_RX.find(([rx]) => rx.test(s.title));
  const x = short ? TEXT_RX.find(([rx]) => rx.test(s.text)) : undefined;
  if (!t && !x && !(frames.length && short)) return null;
  const kind = t?.[1] ?? x?.[1] ?? 'Human check';
  return { kind, message: `${kind}: this site wants to make sure you’re a person. Please complete it in the page — we’ll carry on automatically as soon as it’s done.` };
}

/** Listing-detail URL patterns per site. Search pages link to many of these. */
const DETAIL: { host: RegExp; path: RegExp }[] = [
  { host: /(^|\.)zillow\.com$/, path: /^\/(homedetails\/[^/]+\/\d+_zpid|b\/[^/]+\/[A-Za-z0-9]+|apartments\/[^/]+\/[^/]+\/[A-Za-z0-9]+)\/?$/ },
  // property pages are /<name>-<city>-<state>/<7-char id>/; category pages like /ann-arbor-mi/studios/ have the same shape
  { host: /(^|\.)apartments\.com$/, path: /^\/[a-z0-9-]+-[a-z]{2}\/(?!(?:studios|duplex|luxury|condos|houses|balcony|lofts|cheap)\/?$)[a-z0-9]{7}\/?$/ },
  { host: /(^|\.)craigslist\.org$/, path: /\/\d{8,}\.html$/ },
  { host: /(^|\.)trulia\.com$/, path: /^\/(p|home|building)\// },
  { host: /(^|\.)rent\.com$/, path: /^\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+-\d+$/ },
  { host: /(^|\.)hotpads\.com$/, path: /\/(pad|building)\b/ },
];

/** Same-site listing-detail links from a results page, de-duplicated, in page order, capped. */
export function pickListingLinks(pageUrl: string, hrefs: string[], cap = 10): string[] {
  let base: URL; try { base = new URL(pageUrl); } catch { return []; }
  const host = base.hostname.replace(/^www\./, '');
  const rule = DETAIL.find(d => d.host.test(host));
  const out: string[] = []; const seen = new Set<string>();
  for (const h of hrefs) {
    let u: URL; try { u = new URL(h, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== host) continue;
    u.hash = ''; u.search = '';
    const key = u.toString();
    if (key === base.origin + base.pathname || seen.has(key)) continue;
    const ok = rule ? rule.path.test(u.pathname) : /\/(listing|listings|property|properties|rental|rentals|unit|units|apartment|apartments|floorplans?)\/[^/]+/i.test(u.pathname);
    if (!ok) continue;
    seen.add(key); out.push(key);
    if (out.length >= cap) break;
  }
  return out;
}

/** Wait between page loads so a scan looks like a person browsing, not a burst. */
export const PACE_MS = { min: 2500, max: 5000 };
export const pace = () => PACE_MS.min + Math.random() * (PACE_MS.max - PACE_MS.min);
