// Side panel: reads the current tab (only after a click), scores it against the student's scorecard, saves on request.
// It can also scan a search-results page: open each listing in a background tab at a human pace, read it, score it and
// save it to the student's personal database on this device, then rank everything saved and open the best on /compare.
// If a site shows a "prove you're human" check, we stop, bring that tab forward and ask the student to complete it.
import type { Found, ReadResult, Source, Unit } from './adapters';
import { toExtracted } from './read';
import type { PageSnapshot } from './snapshot';
import { score, type Scored } from './score';
import { analyse, challengeOf, labelOf, openAndLoad, scanFields, snapshotTab, toSaved, waitForHuman } from './pipeline';
import { pace, pickListingLinks, type Challenge } from './discover';
import { bestIds, rankSaved } from './rank';
import { DEFAULT_SITE, deleteAll, load, save, savePlace, type Store } from './store';
import type { Extracted, FieldKey } from '../../lib/extract';
import { groupOf } from '../../lib/session';

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const app = () => $('#app');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface ScanState { from: string; links: string[]; done: number; saved: number; skipped: number; current?: string; waiting?: Challenge; finished?: boolean; log: string[] }
interface State {
  snap?: PageSnapshot; read?: ReadResult; coord?: [number, number]; scored?: Scored; ms?: number; aiNote?: string; picked?: Unit;
  view: 'page' | 'saved' | 'scan'; busy?: string; error?: string; challenge?: Challenge; links?: string[]; scan?: ScanState;
}
let st: State = { view: 'page' };
let store: Store;
let cancelled = false;

const SRC_LABEL: Record<Source, string> = { zillow: 'Zillow page data', 'apartments.com': 'Apartments.com page data', 'structured data': 'Page structured data', 'page meta': 'Page tags', 'page text': 'Page text', AI: 'Read by AI', you: 'You' };

async function activeTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }

/** Read the active tab. activeTab covers the toolbar click; for a later "Read this page" we ask once for that site. */
async function readPage() {
  const t0 = performance.now();
  cancelled = false;
  st = { view: 'page', busy: 'Reading this page…' }; render();
  const tab = await activeTab();
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) { st = { view: 'page', error: 'Open a listing page, then click Read this page.' }; return render(); }
  let snap: PageSnapshot;
  try { snap = await snapshotTab(tab.id); }
  catch {
    const origin = new URL(tab.url!).origin + '/*';
    const ok = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!ok) { st = { view: 'page', error: 'Chrome needs your OK to read this page. Click the Hack the Lease button in the toolbar, or allow this site.' }; return render(); }
    snap = await snapshotTab(tab.id);
  }
  const ch = challengeOf(snap);
  if (ch) {
    st = { view: 'page', challenge: ch }; render();
    const real = await waitForHuman(tab.id, () => cancelled);
    if (!real) { st = { view: 'page', error: cancelled ? 'Stopped.' : 'The check wasn’t completed. Finish it in the page, then click Read this page.' }; return render(); }
    snap = real;
  }
  const a = await analyse(snap, store, s => { st = { ...st, busy: s }; render(); });
  const links = pickListingLinks(snap.url, snap.links ?? [], 20);
  st = { view: 'page', snap, read: a.read, coord: a.coord, aiNote: a.aiNote, links, ms: Math.round(performance.now() - t0) };
  rescore();
}

function currentFields(): Extracted[] {
  const f = { ...st.read!.fields };
  if (st.picked) { f.rent = { value: st.picked.rent, evidence: `You picked: ${st.picked.label}`, source: 'you' }; f.beds = { value: st.picked.beds, evidence: `You picked: ${st.picked.label}`, source: 'you' };
    if (st.picked.basis) f.price_basis = { value: st.picked.basis, evidence: st.picked.evidence ?? st.picked.label, source: st.snap?.host.includes('apartments.com') ? 'apartments.com' : 'page text' };
    if (st.picked.baths != null) f.baths = { value: st.picked.baths, evidence: `You picked: ${st.picked.label}`, source: 'you' }; }
  return toExtracted(f);
}
const labelFor = () => st.read && st.snap ? labelOf(st.read, st.snap.host, st.picked?.beds) : 'Place';

function rescore() { if (!st.read) return render(); st.scored = score(currentFields(), st.coord, store.profile ?? {}, store.saved, labelFor()); render(); }

function answer(key: FieldKey, value: Extracted['value'], text: string) {
  st.read!.fields[key] = { value, evidence: `You answered: ${text}`, source: 'you' } as Found; rescore();
}

async function openCompare(ids: string[]) {
  if (!ids.length) return;
  const site = store.site ?? DEFAULT_SITE;
  const url = `${site}/compare?add=${ids.map(encodeURIComponent).join(',')}`;
  const [existing] = await chrome.tabs.query({ url: `${site}/*` });
  if (existing?.id != null) { await chrome.tabs.update(existing.id, { url, active: true }); if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }); }
  else await chrome.tabs.create({ url });
}

async function saveAndCompare() {
  if (!st.read || !st.snap || !st.scored?.listing) return;
  const place = await toSaved(st.snap, { read: st.read, coord: st.coord, aiNote: '' }, currentFields(), labelFor());
  store.saved = await savePlace(place);
  await openCompare([place.id]);
  st.busy = undefined; render();
}

// ---------- multi-page scan ----------
async function scan(n: number) {
  if (!st.snap || !st.links?.length) return;
  cancelled = false;
  const links = st.links.slice(0, n);
  st = { ...st, view: 'scan', scan: { from: st.snap.url, links, done: 0, saved: 0, skipped: 0, log: [] } };
  render();
  const s = st.scan!;
  const group = groupOf(store.profile ?? {});
  for (const url of links) {
    if (cancelled) break;
    s.current = url; s.waiting = undefined; render();
    let tab: chrome.tabs.Tab | undefined;
    try {
      tab = await openAndLoad(url);
      let snap = await snapshotTab(tab.id!);
      const ch = challengeOf(snap);
      if (ch) {
        // bring the check to the student; they solve it, we wait
        s.waiting = ch; render();
        await chrome.tabs.update(tab.id!, { active: true });
        if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
        const real = await waitForHuman(tab.id!, () => cancelled);
        s.waiting = undefined;
        if (!real) { s.skipped++; s.log.push(`Skipped (check not completed): ${url}`); continue; }
        snap = real;
      }
      const a = await analyse(snap, store);
      const { fields, beds } = scanFields(a.read, group);
      const label = labelOf(a.read, snap.host, beds);
      const scored = score(fields, a.coord, store.profile ?? {}, store.saved, label);
      if (!scored.listing) { s.skipped++; s.log.push(`No rent or bedrooms on the page: ${label}`); }
      else { store.saved = await savePlace(await toSaved(snap, a, fields, label, s.from)); s.saved++; s.log.push(`Saved: ${label}${scored.rank.rank ? ` — #${scored.rank.rank} for you` : ''}`); }
    } catch { s.skipped++; s.log.push(`Couldn’t read: ${url}`); }
    finally {
      s.done++;
      if (tab?.id != null) await chrome.tabs.remove(tab.id).catch(() => {});
      render();
    }
    if (!cancelled && s.done < links.length) await sleep(pace());
  }
  s.current = undefined; s.finished = true; render();
}

// ---------- rendering ----------
const prov = (p?: string) => p ? `<span class="dot ${p.toLowerCase()}" title="${esc(p)}"></span>` : '';
const tone = (t?: string) => t === 'good' ? 'good' : t === 'bad' ? 'bad' : '';

function connectionBar() {
  return store.profile
    ? `<div class="conn ok">Scored for <b>${esc(store.name ?? 'you')}</b> · <a href="#" data-act="saved">My places (${store.saved.length})</a></div>`
    : `<div class="conn">Not connected — <a href="${esc(store.site ?? DEFAULT_SITE)}/id" target="_blank">open your housing ID</a> and click <b>Connect the extension</b> for personal scores. · <a href="#" data-act="saved">My places (${store.saved.length})</a></div>`;
}

function challengeBox(c: Challenge, inScan = false) {
  return `<section class="check"><h3>Please complete the check</h3><p>${esc(c.message)}</p>
    <p class="muted">${inScan ? 'We’ve brought that tab to the front. ' : ''}We never click or solve it for you.</p>
    <div class="busy"><span class="spin"></span>Waiting for you…</div><button class="ghost" data-act="stop">Stop</button></section>`;
}

function scanOffer() {
  const n = st.links?.length ?? 0;
  if (n < 2) return '';
  const opts = [5, 10, 20].filter(k => k <= n || k === 5).map(k => Math.min(k, n));
  return `<section class="scan"><h3>${n} listings on this page</h3><p class="muted">Read them one by one, score each against your scorecard and save them to your places. About 5–8 s each.</p>
    <div class="chips">${Array.from(new Set(opts)).map(k => `<button class="pick" data-scan="${k}">Scan ${k}</button>`).join('')}</div></section>`;
}

function render() {
  if (st.view === 'saved') return renderSaved();
  if (st.view === 'scan') return renderScan();
  const head = `<header><span class="brand">Hack the Lease</span><button class="ghost" data-act="read">Read this page</button></header>${connectionBar()}`;
  if (st.challenge) return void (app().innerHTML = `${head}${challengeBox(st.challenge)}`);
  if (st.busy) return void (app().innerHTML = `${head}<div class="busy"><span class="spin"></span>${esc(st.busy)}</div>`);
  if (st.error) return void (app().innerHTML = `${head}<p class="err">${esc(st.error)}</p>`);
  if (!st.read || !st.scored) return void (app().innerHTML = `${head}<div class="empty"><p>Open any rental listing — Zillow, Apartments.com, a landlord’s own site — and click <b>Read this page</b>.</p><p class="muted">On a search-results page you can scan several listings at once.</p></div>`);
  const { read, scored: s, snap } = st;
  const f = read.fields;
  const c = s.card;
  // a results page with no single listing on it: lead with the scan
  if (!c && (st.links?.length ?? 0) >= 2 && !f.rent && !read.units.length) return void (app().innerHTML = `${head}${scanOffer()}<p class="fine">Places are saved on this device only.</p>`);
  const srcChips = read.sources.map(x => `<span class="chip">${esc(SRC_LABEL[x])}</span>`).join('');
  const units = read.units.length > 1 && (!f.rent || st.picked) ? `<section><h3>Which unit?</h3><p class="muted">This page lists several floor plans. Pick the one you’d rent.</p><div class="chips">${read.units.map((u, i) => `<button class="pick ${st.picked === u ? 'on' : ''}" data-unit="${i}">${esc(u.label)}</button>`).join('')}</div></section>` : '';
  const qs = s.questions.map(q => `<section class="ask"><b>${esc(q.text)}</b><div class="chips">${q.options.map(o => `<button class="pick" data-q="${esc(q.key)}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div></section>`).join('');
  const basisSrc = f.price_basis ? `<p class="ev">“${esc(f.price_basis.evidence)}”</p>` : '';
  const costRows = c ? c.cost.lines.map(l => `<div class="row"><span>${esc(l.label)}</span><span class="v">${prov(l.provenance)}${l.amount == null ? 'Unknown — ask' : money(l.amount)}</span></div>`).join('') : '';
  const mh = c ? ([['Commute', s.commuteKnown ? `${c.commute.minutes} min · ${c.commute.label}` : (st.coord ? 'Unknown — outside the area we cover' : 'Unknown — no address found'), s.commuteKnown ? (c.commute.minutes <= 15 ? 'good' : c.commute.minutes >= 30 ? 'bad' : '') : ''],
    ['Night walk', s.commuteKnown ? c.mustHaves.night.main : 'Unknown', s.commuteKnown ? c.mustHaves.night.tone : ''], ['Lyft Pass', s.commuteKnown ? c.mustHaves.owl.main : 'Unknown', s.commuteKnown ? c.mustHaves.owl.tone : ''],
    ['TransLoc pickup', s.commuteKnown ? c.mustHaves.transloc.main : 'Unknown', s.commuteKnown ? c.mustHaves.transloc.tone : ''], ['Laundry', f.laundry ? c.mustHaves.laundry.main : 'Unknown', f.laundry ? c.mustHaves.laundry.tone : ''], ['Quiet', 'Unknown', '']] as [string, string, string][])
    .map(([l, v, t]) => `<div class="row"><span>${l}</span><span class="v ${tone(t)}">${esc(v)}</span></div>`).join('') : '';
  const rank = c ? `<section><h3>How it ranks</h3>
      <p class="big">${s.rank.rank ? `#${s.rank.rank} of ${s.rank.of} places for you` : esc(s.rank.reason)}</p>
      ${s.vsSaved.of ? `<p class="muted">Better than ${s.vsSaved.better} of your ${s.vsSaved.of} saved place${s.vsSaved.of > 1 ? 's' : ''}.</p>` : ''}
      <div class="top">${s.top3.map(t => `<div class="row"><span>${esc(t.short)} <span class="muted">· Example</span></span><span class="v">${money(t.total)}</span></div>`).join('')}</div>
      <p class="muted">Your marketplace top 3 for comparison (Example data).</p></section>` : '';
  const missing = s.missing.length ? `<section><h3>Not on the page (${s.missing.length})</h3><p class="muted">${s.missing.map(m => esc(m.label)).join(' · ')}</p>
      <textarea readonly id="asktext">${esc(s.askText)}</textarea><button class="ghost" data-act="copy">Copy “Ask the landlord” text</button></section>` : '';
  app().innerHTML = `${head}
    <div class="title"><div><b>${esc(labelFor())}</b><div class="muted">${esc(snap!.host)} · private to you</div></div>${c ? `<div class="price">${money(c.total)}<span>/ person / mo</span></div>` : ''}</div>
    <div class="chips src">${srcChips}${st.ms != null ? `<span class="chip">${(st.ms / 1000).toFixed(1)} s</span>` : ''}</div>
    ${st.aiNote ? `<p class="note">${esc(st.aiNote)}</p>` : ''}
    ${units}${qs}
    ${c ? `<section><h3>True monthly cost per person</h3>${costRows}<div class="row total"><span>Total</span><span class="v">${money(c.total)}</span></div>
      <p class="muted">${esc(c.leaseBadge)}</p>${basisSrc}</section>
      <section><h3>Your must-haves</h3>${mh}</section>${rank}` : `<section><p class="err">${esc(s.rank.reason)}</p>
      <p class="muted">The page doesn’t state it. Know it from the landlord? Type it — it’s marked “You”.</p>
      <div class="chips">${!f.rent ? '<input id="in-rent" inputmode="numeric" placeholder="Rent $ / month" />' : ''}${!f.beds && !st.picked ? '<input id="in-beds" inputmode="numeric" placeholder="Bedrooms" />' : ''}<button class="pick" data-act="typed">Use these</button></div></section>`}
    ${missing}
    ${scanOffer()}
    <div class="legend"><span>${prov('Listed')}Listed on the page</span><span>${prov('Estimated')}Estimated</span><span>${prov('Unknown')}Unknown</span></div>
    <button class="primary" data-act="save" ${c ? '' : 'disabled'}>Save &amp; compare</button>
    <p class="fine">Saved on this device only. Facts only — no photos or descriptions are kept.</p>`;
}

function renderScan() {
  const s = st.scan!;
  const pct = Math.round((s.done / s.links.length) * 100);
  app().innerHTML = `<header><button class="ghost" data-act="back">‹ Back</button><span class="brand">Scanning</span><span></span></header>
    <section><p class="big">${s.done} of ${s.links.length} pages</p><div class="bar"><span style="width:${pct}%"></span></div>
      <p class="muted">${s.saved} saved · ${s.skipped} skipped${s.current && !s.waiting ? ` · reading ${esc(new URL(s.current).pathname.slice(0, 48))}…` : ''}</p></section>
    ${s.waiting ? challengeBox(s.waiting, true) : ''}
    ${s.finished ? `<section><h3>Done</h3><p class="muted">Everything is ranked with the same engine as the website.</p>
      <button class="primary" data-act="best">Compare my best 3</button><button class="ghost" data-act="saved">See all my places, ranked</button></section>`
      : `<button class="ghost" data-act="stop">Stop scanning</button>`}
    <section><h3>Log</h3>${s.log.slice().reverse().map(l => `<p class="muted">${esc(l)}</p>`).join('') || '<p class="muted">Starting…</p>'}</section>
    <p class="fine">One page at a time, a few seconds apart, in your own browser. Each place is saved on this device only.</p>`;
}

function renderSaved() {
  const ranked = rankSaved(store.profile ?? {}, store.saved);
  const best = bestIds(ranked);
  const rows = ranked.map((r, i) => `<div class="saved ${i === 0 && r.rank != null ? 'best' : ''}"><div>
      <b>${i === 0 && r.rank != null ? '<span class="badge">Best for you</span> ' : ''}${esc(r.place.label)}</b>
      <div class="muted">${r.rank != null ? `#${r.rank} of ${r.of} for you · ` : ''}${r.perPerson != null ? `${money(r.perPerson)}/person` : ''}${r.minutes != null ? ` · ${r.minutes} min` : ''} · ${esc(r.place.sourceHost)}</div>
      ${r.reason ? `<div class="muted">${esc(r.reason)}</div>` : ''}</div>
      <div class="col"><a href="${esc(r.place.sourceUrl)}" target="_blank" class="ghost small">Open</a><button class="ghost small" data-del="${esc(r.place.id)}">Remove</button></div></div>`).join('');
  app().innerHTML = `<header><button class="ghost" data-act="back">‹ Back</button><span class="brand">My places</span><span></span></header>
    ${store.profile ? '' : '<p class="note">Connect your housing ID for personal ranking — until then we rank with default answers.</p>'}
    ${best.length ? `<button class="primary" data-act="best">Compare my best ${best.length}</button>` : ''}
    ${ranked.length ? rows : '<p class="muted">Nothing saved yet. Read a listing, or scan a search-results page.</p>'}
    <section><label class="toggle"><input type="checkbox" id="pill" ${store.showPill ? 'checked' : ''}/> Show an “Add to Hack the Lease” button on Zillow and Apartments.com</label></section>
    <div class="actions"><button class="ghost" data-act="export">Export JSON</button><button class="danger" data-act="wipe">Delete all my saved places</button></div>
    <p class="fine">Your places live only in this browser (up to 200). Deleting removes them, plus cached reads and map lookups.</p>`;
}

document.addEventListener('click', async e => {
  const t = (e.target as HTMLElement).closest('[data-act],[data-unit],[data-q],[data-del],[data-scan]') as HTMLElement | null; if (!t) return;
  if (t.dataset.act || t.dataset.scan) e.preventDefault();
  const a = t.dataset.act;
  if (t.dataset.scan) {
    // ask for this site once, inside the click (Chrome only allows permission prompts from a user gesture)
    const origin = new URL(st.snap!.url).origin + '/*';
    const ok = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!ok) { st.error = 'Chrome needs your OK to open listings on this site.'; return render(); }
    return scan(Number(t.dataset.scan));
  }
  if (a === 'read') return readPage();
  if (a === 'stop') { cancelled = true; return; }
  if (a === 'best') return openCompare(bestIds(rankSaved(store.profile ?? {}, store.saved)));
  if (a === 'save') { st.busy = 'Saving…'; render(); return saveAndCompare(); }
  if (a === 'copy') { await navigator.clipboard.writeText(($('#asktext') as HTMLTextAreaElement).value); t.textContent = 'Copied ✓'; return; }
  if (a === 'typed') {
    const rent = Number((document.getElementById('in-rent') as HTMLInputElement | null)?.value.replace(/[^\d]/g, '') || 0);
    const beds = (document.getElementById('in-beds') as HTMLInputElement | null)?.value.replace(/[^\d]/g, '');
    if (rent) st.read!.fields.rent = { value: rent, evidence: `You typed: $${rent}`, source: 'you' };
    if (beds) st.read!.fields.beds = { value: Number(beds), evidence: `You typed: ${beds} bedrooms`, source: 'you' };
    return rescore();
  }
  if (a === 'saved') { st.view = 'saved'; return render(); }
  if (a === 'back') { if (st.scan && !st.scan.finished) cancelled = true; st.view = 'page'; return render(); }
  if (a === 'export') { const blob = new Blob([JSON.stringify(store.saved, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = 'hack-the-lease-saved.json'; l.click(); URL.revokeObjectURL(u); return; }
  if (a === 'wipe') { if (!confirm('Delete all saved places from this browser? This can’t be undone.')) return; await deleteAll(); store = await load(); return render(); }
  if (t.dataset.unit) { st.picked = st.read!.units[Number(t.dataset.unit)]; return rescore(); }
  if (t.dataset.q) { const k = t.dataset.q as FieldKey; const v = t.dataset.v!; return answer(k, k === 'price_basis' ? (/person/i.test(v) ? 'per_bed' : 'per_unit') : k === 'beds' ? Number(v) : v, v); }
  if (t.dataset.del) { store.saved = store.saved.filter(p => p.id !== t.dataset.del); await save({ saved: store.saved }); return render(); }
});
document.addEventListener('change', async e => {
  const el = e.target as HTMLInputElement; if (el.id !== 'pill') return;
  if (el.checked) { const ok = await chrome.permissions.request({ origins: ['https://www.zillow.com/*', 'https://www.apartments.com/*'] }).catch(() => false); if (!ok) { el.checked = false; return; } }
  await save({ showPill: el.checked }); store.showPill = el.checked;
  await chrome.runtime.sendMessage({ type: 'SYNC_PILL', show: el.checked });
});
chrome.runtime.onMessage.addListener(async (m: { type?: string }) => {
  if (m?.type === 'READ_NOW') readPage();
  if (m?.type === 'PROFILE_UPDATED') { store = await load(); if (st.read) rescore(); else render(); }
});

(async () => { store = await load(); render(); readPage(); })();
