'use client';
// Tiny client store: the student's answers + compare state, persisted per browser (convenience only).
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Profile } from './session';

export interface AppState {
  profile: Profile;
  history: Profile[];       // for the Back button in onboarding
  shown: string[];          // compare slots
  seen: string[];           // removed via X
  name: string;
  appliedTo?: string;
}
const KEY = 'htl-state-v1';
const initial: AppState = { profile: {}, history: [], shown: [], seen: [], name: 'Alex R.' };
let state: AppState = initial;
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { const raw = window.localStorage.getItem(KEY); if (raw) state = { ...initial, ...JSON.parse(raw) }; } catch { /* private mode etc. */ }
}
export function getState() { load(); return state; }
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  load();
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  subs.forEach(f => f());
}
export function resetState() { setState({ ...initial }); }
export function useApp(): AppState {
  return useSyncExternalStore(
    f => { subs.add(f); return () => subs.delete(f); },
    () => getState(),
    () => initial,
  );
}

/** true after the first client render, once the store has read localStorage */
export function useHydrated() { const [h, setH] = useState(false); useEffect(() => { getState(); setH(true); }, []); return h; }
