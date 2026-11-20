'use client';
// One source of truth for "the places I'm comparing" — used by Compare (table), Results (cards) and Map.
// Handles 2-or-3 slots, the student's own brought listing ("BYO"), and the What-if reset.
import { useEffect, useState } from 'react';
import { api } from '@/components/ui';
import { setState, useApp, useHydrated } from './store';
import { encodeProfile } from './wire';
import { BROUGHT_ID } from './brought';
import type { CompareResp } from '@/app/results/page';

export function useComparison() {
  const { profile, shown, seen, slots = 3, brought } = useApp();
  const hydrated = useHydrated();
  const [r, setR] = useState<CompareResp | null>(null);
  const [top, setTop] = useState<CompareResp | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    (async () => {
      const p = encodeProfile(profile);
      const t = await api<CompareResp>(`/api/compare?p=${p}`);
      if (!live) return;
      setTop(t);
      // start from what the student chose; keep their brought listing even after a What-if reset
      let ids = shown.filter(id => id !== BROUGHT_ID || brought);
      if (!ids.length) ids = brought && !seen.includes(BROUGHT_ID) ? [...t.cards.map(c => c.id).slice(0, slots - 1), BROUGHT_ID] : t.cards.map(c => c.id);
      ids = Array.from(new Set(ids)).slice(0, slots);
      for (const id of [...t.cards.map(c => c.id), ...t.bench]) { if (ids.length >= slots) break; if (!ids.includes(id) && !seen.includes(id)) ids.push(id); }
      const same = !ids.includes(BROUGHT_ID) && ids.join() === t.cards.map(c => c.id).join();
      const out = same ? t : await api<CompareResp>('/api/compare', { p, ids, brought: ids.includes(BROUGHT_ID) ? brought : undefined });
      if (!live) return;
      setR({ ...out, confidence: t.confidence, weights: out.weights ?? t.weights, considered: t.considered });
      const got = out.cards.map(c => c.id);
      if (got.join() !== shown.join()) setState({ shown: got });
    })().catch(() => {});
    return () => { live = false; };
  }, [profile, shown, seen, slots, brought, hydrated]);

  const bench = (top?.bench_cards ?? []).filter(b => !shown.includes(b.id) && !seen.includes(b.id));
  return { r, cards: r?.cards ?? [], bench, slots, profile, shown, seen, brought };
}

/** Set how many places to compare. Going 3 → 2 drops the last one (it can come back). */
export function setSlots(n: 2 | 3) { setState(s => ({ slots: n, shown: s.shown.slice(0, n) })); }
