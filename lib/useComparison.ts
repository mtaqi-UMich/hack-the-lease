'use client';
// One source of truth for "the places I'm comparing" — used by Compare (table), Results (cards) and Map.
// Handles 2-or-3 slots, the student's own brought listing ("BYO"), and the What-if reset.
import { useEffect, useState } from 'react';
import { api } from '@/components/ui';
import { setState, useApp, useHydrated } from './store';
import { encodeProfile } from './wire';
import { BROUGHT_ID, isOutside, type Brought } from './brought';
import { getSaved, type SavedPlace } from './extension';
import type { CompareResp } from '@/app/results/page';

export function useComparison() {
  const { profile, shown, seen, slots = 3, brought } = useApp();
  const hydrated = useHydrated();
  const [r, setR] = useState<CompareResp | null>(null);
  const [top, setTop] = useState<CompareResp | null>(null);
  // places saved by the browser extension (read from the extension at runtime; null = not loaded yet)
  const [saved, setSaved] = useState<SavedPlace[] | null>(null);
  useEffect(() => { if (!hydrated) return; getSaved().then(setSaved).catch(() => setSaved([])); }, [hydrated]);
  // /compare?add=X-… (from the extension's "Save & compare"): never silently replace a column — hand the new place to
  // the "Choose what to compare" picker, already ticked, and let the student decide what it sits next to.
  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  useEffect(() => {
    if (!saved || typeof window === 'undefined') return;
    // ?add=X-a or ?add=X-a,X-b,X-c ("Compare my best 3" from the extension)
    const adds = (new URLSearchParams(window.location.search).get('add') ?? '').split(',').filter(id => saved.some(p => p.id === id));
    if (!adds.length) return;
    window.history.replaceState(null, '', window.location.pathname);
    // several at once = the student already chose (extension's "Compare my best 3") → straight into the table
    if (adds.length >= 2) {
      setState(s => { const shown = adds.slice(0, s.slots ?? 3); return { shown, slots: Math.max(2, shown.length) as 2 | 3, seen: s.seen.filter(x => !shown.includes(x)) }; });
      return;
    }
    setPendingAdd(adds[0]);
  }, [saved]);

  useEffect(() => {
    if (!hydrated || saved === null) return;
    let live = true;
    (async () => {
      const p = encodeProfile(profile);
      const t = await api<CompareResp>(`/api/compare?p=${p}`);
      if (!live) return;
      setTop(t);
      // start from what the student chose; keep their brought listing even after a What-if reset
      let ids = shown.filter(id => id === BROUGHT_ID ? !!brought : id.startsWith('X-') ? saved.some(p => p.id === id) : true);
      if (!ids.length) ids = brought && !seen.includes(BROUGHT_ID) ? [...t.cards.map(c => c.id).slice(0, slots - 1), BROUGHT_ID] : t.cards.map(c => c.id);
      ids = Array.from(new Set(ids)).slice(0, slots);
      for (const id of [...t.cards.map(c => c.id), ...t.bench]) { if (ids.length >= slots) break; if (!ids.includes(id) && !seen.includes(id)) ids.push(id); }
      const same = !ids.some(isOutside) && ids.join() === t.cards.map(c => c.id).join();
      const outside: Record<string, Brought> = Object.fromEntries(saved.filter(x => ids.includes(x.id)).map(x => [x.id, { fields: x.fields, coord: x.coord, label: x.label, sourceHost: x.sourceHost }]));
      const out = same ? t : await api<CompareResp>('/api/compare', { p, ids, brought: ids.includes(BROUGHT_ID) ? brought : undefined, outside });
      if (!live) return;
      setR({ ...out, confidence: t.confidence, weights: out.weights ?? t.weights, considered: t.considered });
      const got = out.cards.map(c => c.id);
      if (got.join() !== shown.join()) setState({ shown: got });
    })().catch(() => {});
    return () => { live = false; };
  }, [profile, shown, seen, slots, brought, hydrated, saved]);

  const bench = (top?.bench_cards ?? []).filter(b => !shown.includes(b.id) && !seen.includes(b.id));
  /** "From zillow.com · private to you" for extension places, "Your listing" for /bring */
  const outsideTag = (id: string) => id === BROUGHT_ID ? 'Your listing' : saved?.find(p => p.id === id) ? `From ${saved.find(p => p.id === id)!.sourceHost} · private to you` : null;
  /** The listing page an extension place was saved from (for "Apply on …"). */
  const sourceOf = (id: string) => { const p = saved?.find(x => x.id === id); return p ? { url: p.sourceUrl, host: p.sourceHost } : null; };
  return { r, top, cards: r?.cards ?? [], bench, slots, profile, shown, seen, brought, saved: saved ?? [], outsideTag, sourceOf, pendingAdd, clearPendingAdd: () => setPendingAdd(null) };
}

/** Put exactly these places (2 or 3) side by side. */
export function chooseCompared(ids: string[]) {
  setState(s => ({ shown: ids, slots: (ids.length >= 3 ? 3 : 2) as 2 | 3, seen: s.seen.filter(x => !ids.includes(x)) }));
}

/** Set how many places to compare. Going 3 → 2 drops the last one (it can come back). */
export function setSlots(n: 2 | 3) { setState(s => ({ slots: n, shown: s.shown.slice(0, n) })); }
