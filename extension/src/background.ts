// Service worker: opens the side panel, talks to our website (externally_connectable), manages the optional pill.
import { load, save } from './store';

const PILL_SITES = ['https://www.zillow.com/*', 'https://www.apartments.com/*'];

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const s = await load(); await syncPill(!!s.showPill);
});
chrome.runtime.onStartup.addListener(async () => { const s = await load(); await syncPill(!!s.showPill); });

export async function syncPill(show: boolean) {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ['htl-pill'] }).catch(() => []);
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: ['htl-pill'] }).catch(() => {});
  if (!show) return;
  const ok = await chrome.permissions.contains({ origins: PILL_SITES });
  if (ok) await chrome.scripting.registerContentScripts([{ id: 'htl-pill', matches: PILL_SITES, js: ['pill.js'], runAt: 'document_idle' }]);
}

// Messages from our website (only origins listed in manifest externally_connectable can send these).
chrome.runtime.onMessageExternal.addListener((msg: { type?: string; profile?: unknown; name?: string }, sender, reply) => {
  (async () => {
    const s = await load();
    if (msg?.type === 'PING') return reply({ ok: true, version: chrome.runtime.getManifest().version, connected: !!s.profile, saved: s.saved.length });
    if (msg?.type === 'SET_SCORECARD') {
      await save({ profile: msg.profile as never, name: typeof msg.name === 'string' ? msg.name.slice(0, 60) : undefined, site: sender.origin, connectedAt: new Date().toISOString() });
      chrome.runtime.sendMessage({ type: 'PROFILE_UPDATED' }).catch(() => {});
      return reply({ ok: true });
    }
    if (msg?.type === 'GET_SAVED') return reply({ ok: true, saved: s.saved });
    if (msg?.type === 'REMOVE_SAVED' && typeof (msg as { id?: string }).id === 'string') { await save({ saved: s.saved.filter(p => p.id !== (msg as { id: string }).id) }); return reply({ ok: true }); }
    reply({ ok: false, error: 'unknown message' });
  })();
  return true; // async reply
});

// Messages from our own pages (the pill, the panel).
chrome.runtime.onMessage.addListener((msg: { type?: string; show?: boolean }, sender, reply) => {
  if (msg?.type === 'OPEN_PANEL' && sender.tab?.id != null) {
    chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => setTimeout(() => chrome.runtime.sendMessage({ type: 'READ_NOW' }).catch(() => {}), 400)).catch(() => {});
    reply({ ok: true });
  }
  if (msg?.type === 'SYNC_PILL') { syncPill(!!msg.show).then(() => reply({ ok: true })); return true; }
  return false;
});
