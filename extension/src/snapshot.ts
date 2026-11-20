// Runs INSIDE the listing page, only after the student clicks (chrome.scripting.executeScript).
// Must be self-contained: no imports, no closures — Chrome serialises this function.
// Reads only what the page already shows or embeds. No clicking, scrolling or extra requests.
export interface PageSnapshot {
  url: string; host: string; title: string;
  jsonld: string[];               // raw <script type="application/ld+json"> blocks
  nextData: string | null;        // Next.js __NEXT_DATA__ (Zillow and others)
  embedded: string[];             // other inline JSON blobs that look like listing data (Apartments.com etc.)
  meta: Record<string, string>;   // og:/twitter:/description/product: tags
  text: string;                   // visible text of the main content
  links?: string[];               // hrefs on the page (for scanning a results page)
  captcha?: string[];             // bot-check widgets present (iframes/containers), detected by selector only
}

export function snapshotPage(): PageSnapshot {
  const jsonld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent || '').filter(Boolean).slice(0, 25);
  const nd = document.getElementById('__NEXT_DATA__');
  // never truncate JSON (a cut-off blob can't be parsed); skip it if it's absurdly large
  const nextData = nd && nd.textContent && nd.textContent.length < 6_000_000 ? nd.textContent : null;
  const embedded: string[] = [];
  document.querySelectorAll('script:not([src])').forEach(s => {
    if (s.id === '__NEXT_DATA__') return; // already read above
    const t = s.textContent || '';
    if (t.length < 200 || t.length > 2_000_000 || embedded.length >= 6) return;
    if (/"(?:bedrooms|beds|rent|rentRange|unitTotal|monthlyRent)"\s*:/.test(t)) embedded.push(t);
  });
  const meta: Record<string, string> = {};
  document.querySelectorAll('meta[property], meta[name]').forEach(m => {
    const k = m.getAttribute('property') || m.getAttribute('name') || ''; const v = m.getAttribute('content') || '';
    if (k && v && /^(og:|twitter:|description$|product:|place:|zillow_fb:)/.test(k)) meta[k] = v.slice(0, 600);
  });
  // The biggest <main> wins. <article> is skipped: on Zillow the first one is only the description, which hides the
  // deposit, fees and move-in date. If <main> holds under a quarter of the page, it isn't the listing — use the body.
  const body = document.body as HTMLElement; const all = body.innerText || '';
  const main = Array.from(document.querySelectorAll('main, [role="main"]')).map(e => (e as HTMLElement).innerText || '').sort((a, b) => b.length - a.length)[0] ?? '';
  const text = (main.length > 400 && main.length > all.length * 0.25 ? main : all).slice(0, 40000);
  const links = Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href).filter(h => /^https?:/.test(h)).slice(0, 600);
  const captcha: string[] = [];
  for (const sel of ['#px-captcha', 'iframe[src*="captcha"]', 'iframe[src*="challenges.cloudflare.com"]', 'iframe[src*="hcaptcha"]', 'iframe[src*="recaptcha"]', '#challenge-form', '#cf-challenge-running', '.g-recaptcha', '.h-captcha'])
    if (document.querySelector(sel)) captcha.push(sel);
  return { url: location.href, host: location.hostname.replace(/^www\./, ''), title: document.title.slice(0, 200), jsonld, nextData, embedded, meta, text, links, captcha };
}
