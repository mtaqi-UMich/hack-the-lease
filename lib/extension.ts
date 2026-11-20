'use client';
// Website ↔ browser extension link (Chrome externally_connectable). Everything here runs in the student's browser:
// the site asks the extension for saved places at runtime; our server never stores them.
import type { Profile } from './session';
import type { Brought } from './brought';

/** Stable ID from the manifest "key" for the unpacked build. After a Chrome Web Store release, set NEXT_PUBLIC_EXTENSION_ID. */
export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || 'eejeemjdgpgpbkcmjddlnnnahdfhjjii';

export interface SavedPlace {
  id: string; sourceUrl: string; sourceHost: string; capturedAt: string; title: string; label: string;
  fields: Brought['fields']; coord?: [number, number];
}

type ChromeRuntime = { sendMessage: (id: string, msg: unknown, cb: (r: unknown) => void) => void; lastError?: { message?: string } };
const runtime = (): ChromeRuntime | null => {
  if (typeof window === 'undefined') return null;
  const c = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome;
  return c?.runtime?.sendMessage ? c.runtime : null;
};

function send<T>(msg: unknown, timeoutMs = 1500): Promise<T | null> {
  const rt = runtime(); if (!rt) return Promise.resolve(null);
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    try { rt.sendMessage(EXTENSION_ID, msg, r => { clearTimeout(t); void rt.lastError; resolve((r as T) ?? null); }); }
    catch { clearTimeout(t); resolve(null); }
  });
}

export const pingExtension = () => send<{ ok: boolean; version: string; connected: boolean; saved: number }>({ type: 'PING' });
export const sendScorecard = (profile: Profile, name: string) => send<{ ok: boolean }>({ type: 'SET_SCORECARD', profile, name });
export async function getSaved(): Promise<SavedPlace[]> { const r = await send<{ ok: boolean; saved: SavedPlace[] }>({ type: 'GET_SAVED' }); return r?.saved ?? []; }
