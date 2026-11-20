'use client';
// "Choose what to compare": our top 10 for this student (left) and the places they saved with the browser extension or
// brought via /bring (right). Tick 2 or 3 → they become the columns of the comparison table. Nothing is replaced silently.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, money } from './ui';
import { BROUGHT_ID, type Brought } from '@/lib/brought';
import type { SavedPlace } from '@/lib/extension';
import type { CompareResp } from '@/app/results/page';
import type { CardOut } from '@/lib/compare';

const MAX = 3;
interface Item { id: string; title: string; sub: string; price: string; href?: string }

const fieldOf = (fields: Brought['fields'], k: string) => fields.find(f => f.key === k && f.status === 'Listed')?.value ?? null;
function priceOf(fields: Brought['fields']) {
  const rent = fieldOf(fields, 'rent'); if (rent == null) return 'Rent unknown';
  const basis = fieldOf(fields, 'price_basis');
  return `${money(Number(rent))}${basis === 'per_bed' ? ' / person' : basis === 'per_unit' ? ' whole place' : ''}`;
}

export function ComparePicker({ open, onClose, onChoose, top, cards, saved, brought, shown, pendingAdd }: {
  open: boolean; onClose: () => void; onChoose: (ids: string[]) => void;
  top: CompareResp | null; cards: CardOut[]; saved: SavedPlace[]; brought?: Brought; shown: string[]; pendingAdd: string | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { if (open) setPicked(pendingAdd ? [...shown.filter(id => id !== pendingAdd), pendingAdd] : shown); }, [open, pendingAdd, shown]);
  if (!open) return null;

  // Left: our ranked suggestions (top 3 + bench), plus any Example place already in a column that fell out of the top 10
  const ranked: Item[] = [
    ...(top?.cards ?? []).map(c => ({ id: c.id, title: c.short, sub: `${c.tag} · ${c.commute.minutes} min`, price: `${money(c.total)} / person` })),
    ...(top?.bench_cards ?? []).map(b => ({ id: b.id, title: b.short, sub: `${b.commute} min`, price: `${money(b.total)} / person` })),
  ].slice(0, 10);
  for (const c of cards) if (!c.id.startsWith('X-') && c.id !== BROUGHT_ID && !ranked.some(x => x.id === c.id)) ranked.push({ id: c.id, title: c.short, sub: 'In your table', price: `${money(c.total)} / person` });
  // Right: the student's own places
  const mine: Item[] = [
    ...saved.map(p => ({ id: p.id, title: p.label, sub: `${p.sourceHost} · saved ${new Date(p.capturedAt).toLocaleDateString()}`, price: priceOf(p.fields), href: p.sourceUrl })),
    ...(brought ? [{ id: BROUGHT_ID, title: brought.label ?? 'Your listing', sub: 'Added on Hack the Lease', price: priceOf(brought.fields) }] : []),
  ];

  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length < MAX ? [...p, id] : p);
  const ok = picked.length >= 2 && picked.length <= MAX;

  const row = (it: Item, i?: number) => {
    const on = picked.includes(it.id); const full = !on && picked.length >= MAX;
    return (
      <div key={it.id} className="flex items-center gap-2.5 border-b py-2.5" style={{ borderColor: 'rgba(29,31,26,.08)', opacity: full ? 0.45 : 1 }}>
        <button onClick={() => toggle(it.id)} disabled={full} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} ${it.title}`}
          className="flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-0 p-0" style={{ background: on ? C.indigo : '#FFFFFF', boxShadow: on ? undefined : 'inset 0 0 0 1.5px rgba(29,31,26,.25)' }}>
          {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
        </button>
        <button onClick={() => toggle(it.id)} disabled={full} className="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left">
          <span className="truncate text-[15px] font-semibold" style={{ color: C.ink }}>{i != null ? `${i + 1}. ` : ''}{it.title}</span>
          <span className="truncate text-[13px]" style={{ color: C.muted }}>{it.sub}</span>
        </button>
        <span className="tnum flex-none text-right text-[14px] font-semibold" style={{ color: C.ink }}>{it.price}</span>
        {it.href && <a href={it.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${it.title} listing`} className="flex-none text-[13px] font-semibold no-underline" style={{ color: '#3F35E0' }}>Open ↗</a>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto px-4 py-[80px]" style={{ background: 'rgba(29,31,26,.35)' }} onClick={onClose}>
      <div role="dialog" aria-label="Choose what to compare" className="flex w-full max-w-[860px] flex-col gap-4 rounded-[24px] bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(29,31,26,.06), 0 18px 40px -16px rgba(29,31,26,.22)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-bold tracking-[-0.02em]">Choose what to compare</span>
            <span className="text-[15px]" style={{ color: C.muted }}>Tick 2 or 3 places — ours, yours, or a mix. They go side by side, priced the same way.</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-0" style={{ background: C.soft }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        {pendingAdd && <span className="rounded-[12px] px-3 py-2 text-[14px]" style={{ background: '#E9F8DA', color: C.good }}>Saved from the extension and ticked{picked.length > MAX ? ` — untick ${picked.length - MAX} to compare up to ${MAX}` : ''}.</span>}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold" style={{ color: C.muted }}>OUR TOP 10 FOR YOU · Example data</span>
            <div className="flex max-h-[46vh] flex-col overflow-y-auto pr-1">{ranked.length ? ranked.map((it, i) => row(it, i < 10 ? i : undefined)) : <span className="py-3 text-[14px]" style={{ color: C.muted }}>Loading…</span>}</div>
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold" style={{ color: C.muted }}>YOUR SAVED PLACES · private to you</span>
            <div className="flex max-h-[46vh] flex-col overflow-y-auto pr-1">
              {mine.length ? mine.map(it => row(it)) : (
                <div className="flex flex-col gap-2 py-3 text-[14px]" style={{ color: C.muted }}>
                  <span>Nothing saved yet. Open any listing (Zillow, Apartments.com, a landlord’s site), click the Hack the Lease extension, then <b>Save &amp; compare</b>.</span>
                  <span><Link href="/extension" style={{ color: '#3F35E0' }}>Get the extension</Link> · <Link href="/bring" style={{ color: '#3F35E0' }}>or paste a listing</Link></span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[14px]" style={{ color: C.muted }}>{picked.length} of {MAX} picked</span>
          <button onClick={() => ok && onChoose(picked)} disabled={!ok} className="lift-sm h-[52px] cursor-pointer rounded-full border-0 px-7 text-[17px] font-semibold text-white disabled:cursor-default disabled:opacity-40" style={{ background: C.indigo }}>Compare {picked.length >= 2 ? `these ${Math.min(picked.length, MAX)}` : '2 or 3'}</button>
        </div>
      </div>
    </div>
  );
}
