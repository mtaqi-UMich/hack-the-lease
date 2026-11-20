// Side panel: reads the current tab (only after a click), scores it against the student's scorecard, saves on request.
import type { Found, ReadResult, Source, Unit } from './adapters';
import { mergeAI, readSnapshot, toExtracted } from './read';
import { snapshotPage, type PageSnapshot } from './snapshot';
import { geocode } from './geocode';
import { score, type Scored } from './score';
import { DEFAULT_SITE, cacheGet, cacheSet, deleteAll, hash, load, save, savePlace, type SavedPlace, type Store } from './store';
import type { Extracted, FieldKey } from '../../lib/extract';

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const app = () => $('#app');

interface State { snap?: PageSnapshot; read?: ReadResult; coord?: [number, number]; scored?: Scored; ms?: number; aiNote?: string; picked?: Unit; view: 'page' | 'saved'; busy?: string; error?: string }
let st: State = { view: 'page' };
let store: Store;

const SRC_LABEL: Record<Source, string> = { zillow: 'Zillow page data', 'apartments.com': 'Apartments.com page data', 'structured data': 'Page structured data', 'page meta': 'Page tags', 'page text': 'Page text', AI: 'Read by AI', you: 'You' };

async function activeTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }

async function inject(tabId: number): Promise<PageSnapshot> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: snapshotPage });
  return res.result as PageSnapshot;
}

/** Read the active tab. activeTab covers the toolbar click; for a later "Read this page" we ask once for that site. */
async function readPage() {
  const t0 = performance.now();
  st = { view: 'page', busy: 'Reading this page…' }; render();
  const tab = await activeTab();
  if (!tab?.id || !/^https?:/.test(tab.url ?? '')) { st = { view: 'page', error: 'Open a listing page, then click Read this page.' }; return render(); }
  let snap: PageSnapshot;
  try { snap = await inject(tab.id); }
  catch {
    const origin = new URL(tab.url!).origin + '/*';
    const ok = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!ok) { st = { view: 'page', error: 'Chrome needs your OK to read this page. Click the Hack the Lease button in the toolbar, or allow this site.' }; return render(); }
    snap = await inject(tab.id);
  }
  const first = readSnapshot(snap);
  let read: ReadResult = first;
  let aiNote = '';
  if (first.needsAI && read.text.length > 80) {
    st = { ...st, busy: 'Reading the listing text…' }; render();
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
  const address = read.fields.address?.value as string | undefined;
  let coord = read.coord;
  if (!coord && address) { st = { ...st, busy: 'Finding it on the map…' }; render(); coord = (await geocode(address)) ?? undefined; }
  st = { view: 'page', snap, read, coord, aiNote, ms: Math.round(performance.now() - t0) };
  rescore();
}

function currentFields(): Extracted[] {
  const f = { ...st.read!.fields };
  if (st.picked) { f.rent = { value: st.picked.rent, evidence: `You picked: ${st.picked.label}`, source: 'you' }; f.beds = { value: st.picked.beds, evidence: `You picked: ${st.picked.label}`, source: 'you' };
    if (st.picked.basis) f.price_basis = { value: st.picked.basis, evidence: st.picked.evidence ?? st.picked.label, source: st.snap?.host.includes('apartments.com') ? 'apartments.com' : 'page text' };
    if (st.picked.baths != null) f.baths = { value: st.picked.baths, evidence: `You picked: ${st.picked.label}`, source: 'you' }; }
  return toExtracted(f);
}
const labelFor = () => { const a = st.read?.fields.address?.value as string | undefined; const b = (st.picked?.beds ?? st.read?.fields.beds?.value) as number | undefined; return `${a ? a.split(',')[0] : st.snap?.host ?? 'Place'}${b != null ? ` · ${b === 0 ? 'Studio' : `${b}BR`}` : ''}`.slice(0, 40); };

function rescore() { if (!st.read) return render(); st.scored = score(currentFields(), st.coord, store.profile ?? {}, store.saved, labelFor()); render(); }

function answer(key: FieldKey, value: Extracted['value'], text: string) {
  st.read!.fields[key] = { value, evidence: `You answered: ${text}`, source: 'you' } as Found; rescore();
}

async function saveAndCompare() {
  if (!st.read || !st.snap || !st.scored?.listing) return;
  const id = 'X-' + (await hash(st.snap.url));
  const fields = currentFields();
  const place: SavedPlace = { id, sourceUrl: st.snap.url, sourceHost: st.snap.host, capturedAt: new Date().toISOString(), title: st.snap.title, label: labelFor(), coord: st.coord,
    fields: fields.map(f => ({ key: f.key, value: f.value, status: f.status, evidence: f.evidence, source: st.read!.fields[f.key]?.source })) };
  store.saved = await savePlace(place);
  const site = store.site ?? DEFAULT_SITE;
  const url = `${site}/compare?add=${encodeURIComponent(id)}`;
  const [existing] = await chrome.tabs.query({ url: `${site}/*` });
  if (existing?.id != null) { await chrome.tabs.update(existing.id, { url, active: true }); if (existing.windowId != null) await chrome.windows.update(existing.windowId, { focused: true }); }
  else await chrome.tabs.create({ url });
  st.busy = undefined; render();
}

// ---------- rendering ----------
const prov = (p?: string) => p ? `<span class="dot ${p.toLowerCase()}" title="${esc(p)}"></span>` : '';
const tone = (t?: string) => t === 'good' ? 'good' : t === 'bad' ? 'bad' : '';

function connectionBar() {
  return store.profile
    ? `<div class="conn ok">Scored for <b>${esc(store.name ?? 'you')}</b> · <a href="#" data-act="saved">Saved (${store.saved.length})</a></div>`
    : `<div class="conn">Not connected — <a href="${esc(store.site ?? DEFAULT_SITE)}/id" target="_blank">open your housing ID</a> and click <b>Connect the extension</b> for personal scores. · <a href="#" data-act="saved">Saved (${store.saved.length})</a></div>`;
}

function render() {
  if (st.view === 'saved') return renderSaved();
  const head = `<header><span class="brand">Hack the Lease</span><button class="ghost" data-act="read">Read this page</button></header>${connectionBar()}`;
  if (st.busy) return void (app().innerHTML = `${head}<div class="busy"><span class="spin"></span>${esc(st.busy)}</div>`);
  if (st.error) return void (app().innerHTML = `${head}<p class="err">${esc(st.error)}</p>`);
  if (!st.read || !st.scored) return void (app().innerHTML = `${head}<div class="empty"><p>Open any rental listing — Zillow, Apartments.com, a landlord’s own site — and click <b>Read this page</b>.</p><p class="muted">We only read the page you’re on, only when you click. Nothing is crawled.</p></div>`);
  const { read, scored: s, snap } = st;
  const f = read.fields;
  const c = s.card;
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
    <div class="legend"><span>${prov('Listed')}Listed on the page</span><span>${prov('Estimated')}Estimated</span><span>${prov('Unknown')}Unknown</span></div>
    <button class="primary" data-act="save" ${c ? '' : 'disabled'}>Save &amp; compare</button>
    <p class="fine">Saved on this device only. Facts only — no photos or descriptions are kept.</p>`;
}

function renderSaved() {
  app().innerHTML = `<header><button class="ghost" data-act="back">‹ Back</button><span class="brand">Saved places</span><span></span></header>
    ${store.saved.length ? store.saved.map(p => `<div class="saved"><div><b>${esc(p.label)}</b><div class="muted">${esc(p.sourceHost)} · ${new Date(p.capturedAt).toLocaleDateString()}</div></div><button class="ghost" data-del="${esc(p.id)}">Remove</button></div>`).join('') : '<p class="muted">Nothing saved yet.</p>'}
    <section><label class="toggle"><input type="checkbox" id="pill" ${store.showPill ? 'checked' : ''}/> Show an “Add to Hack the Lease” button on Zillow and Apartments.com</label></section>
    <div class="actions"><button class="ghost" data-act="export">Export JSON</button><button class="danger" data-act="wipe">Delete all my saved places</button></div>
    <p class="fine">Everything here lives only in this browser. Deleting removes it, plus cached reads and map lookups.</p>`;
}

document.addEventListener('click', async e => {
  const t = (e.target as HTMLElement).closest('[data-act],[data-unit],[data-q],[data-del]') as HTMLElement | null; if (!t) return;
  if (t.dataset.act) e.preventDefault();
  const a = t.dataset.act;
  if (a === 'read') return readPage();
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
  if (a === 'back') { st.view = 'page'; return render(); }
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
