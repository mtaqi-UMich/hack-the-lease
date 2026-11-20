'use client';
// Header shared by the two views of your shortlist: the comparison table (/compare, default) and cards (/results).
// Holds the view toggle, "My priorities" (the per-person scorecard) and the 2-or-3 switch.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, C, SHADOW, Sheet } from './ui';
import { setState, useApp } from '@/lib/store';
import { setSlots } from '@/lib/useComparison';
import type { ScoreState } from '@/lib/session';

// ~20 attributes (PRD 1.3). Engine-backed ones change the ranking; filters remove listings; niche ones add rows on Compare.
const PRIORITIES: { key: string; label: string }[] = [
  { key: 'laundry', label: 'In-unit laundry' }, { key: 'ac', label: 'Air conditioning' }, { key: 'quiet', label: 'Quiet' }, { key: 'pet', label: 'Pets allowed' },
  { key: 'parking', label: 'Parking' }, { key: 'private_bath', label: 'Private bath' }, { key: 'furnished', label: 'Furnished' }, { key: 'leaseFlex', label: 'Non-August start' },
  { key: 'nofees', label: 'No fees outside rent' }, { key: 'individual', label: 'Individual lease' }, { key: 'matching', label: 'Landlord roommate matching' },
  { key: 'night', label: 'Safe walk home at night' }, { key: 'gym', label: 'Gym' }, { key: 'groc', label: 'Grocery' }, { key: 'food', label: 'Late-night food' }, { key: 'bus', label: 'Bus stop' },
];

export function PrioritiesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useApp();
  const [step, setStep] = useState<{ predicted_prefs: { key: string; value?: boolean }[] } | null>(null);
  useEffect(() => { if (open) api<typeof step>('/api/onboarding/step', { profile }).then(setStep).catch(() => {}); }, [open, profile]);
  const set = (k: string, v: ScoreState | 'guess') => setState(s => {
    const sc = { ...(s.profile.scorecard ?? {}) };
    if (v === 'guess') delete sc[k]; else sc[k] = v;
    return { profile: { ...s.profile, scorecard: sc }, shown: s.shown.filter(id => id === 'BYO') };
  });
  const guess = (k: string) => { const a = step?.predicted_prefs.find(x => x.key === k); return a ? (a.value ? 'Probably yes' : 'Probably not') : null; };
  return (
    <Sheet open={open} title="My priorities" onClose={onClose}>
      <span className="text-[15px]" style={{ color: C.muted }}>What matters to you in a place. Must = only show places that have it. Leave anything on “We’ll guess” — we show our guess.</span>
      <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
        {PRIORITIES.map(a => {
          const cur = profile.scorecard?.[a.key] ?? 'guess';
          return (
            <div key={a.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2" style={{ borderColor: 'rgba(29,31,26,.08)' }}>
              <span className="text-[15px] font-semibold">{a.label}{cur === 'guess' && guess(a.key) ? <span className="ml-2 text-[13px] font-normal" style={{ color: C.muted }}>{guess(a.key)}</span> : null}</span>
              <div className="flex gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
                {(['must', 'nice', 'dont_care', 'guess'] as const).map(v => (
                  <button key={v} onClick={() => set(a.key, v)} className="h-8 cursor-pointer rounded-full border-0 px-2.5 text-[13px] font-semibold" style={{ background: cur === v ? '#FFFFFF' : 'transparent', color: cur === v ? C.ink : C.muted }}>{{ must: 'Must', nice: 'Nice', dont_care: 'Don’t care', guess: 'We’ll guess' }[v]}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onClose} className="lift-sm h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>Update my matches</button>
    </Sheet>
  );
}

const Icon = { table: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>,
  cards: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="7.5" height="16" rx="2" /><rect x="13.5" y="4" width="7.5" height="16" rx="2" /></svg> };

export function CompareHeader({ view, subtitle, count }: { view: 'table' | 'cards'; subtitle: string; confidence?: number; count: number }) {
  const { slots = 3 } = useApp();
  const [open, setOpen] = useState(false);
  const seg = (on: boolean) => ({ background: on ? '#FFFFFF' : 'transparent', color: on ? C.ink : C.muted, boxShadow: on ? '0 1px 3px rgba(29,31,26,.12)' : undefined });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-[1_1_320px] flex-col gap-1.5">
          <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Your top {count || slots}</h1>
          <p className="m-0 text-[17px]" style={{ color: C.muted }}>{subtitle}</p>
        </div>
        <div className="flex gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }} role="group" aria-label="View">
          <Link href="/compare" aria-current={view === 'table' ? 'page' : undefined} className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold no-underline transition-all duration-300" style={seg(view === 'table')}>{Icon.table}Compare</Link>
          <Link href="/results" aria-current={view === 'cards' ? 'page' : undefined} className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold no-underline transition-all duration-300" style={seg(view === 'cards')}>{Icon.cards}Cards</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(true)} className="lift-sm flex h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-white px-4 text-[15px] font-semibold" style={{ boxShadow: SHADOW, color: C.ink }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>My priorities</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[14px] font-semibold" style={{ color: C.muted }}>Compare</span>
          <div className="flex gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }} role="group" aria-label="How many places to compare">
            {([2, 3] as const).map(n => <button key={n} onClick={() => setSlots(n)} aria-pressed={slots === n} className="h-9 w-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold transition-all duration-300" style={seg(slots === n)}>{n}</button>)}
          </div>
        </div>
      </div>
      <PrioritiesSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
