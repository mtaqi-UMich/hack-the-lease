'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, C, Page, SHADOW, Sheet, money } from '@/components/ui';
import { WhatIf } from '@/components/WhatIf';
import { setState, useApp, useHydrated } from '@/lib/store';
import { encodeProfile } from '@/lib/wire';
import type { CardOut } from '@/lib/compare';
import type { ScoreState } from '@/lib/session';
import { lineFor } from '@/lib/profileText';

export interface CompareResp {
  cards: CardOut[]; bench: string[]; bench_cards: { id: string; short: string; total: number; commute: number }[];
  confidence: number; alpha: number; alpha_range: number[];
  student: { base: string; mode: string; group: number; budget: number; parking: boolean };
  considered: number; weights: { label: string; pct: number }[] | null;
}

// ~20 attributes (PRD 1.3). Engine-backed ones change the ranking; filters remove listings; niche ones add rows on Compare.
const SCORECARD: { key: string; label: string; group: string }[] = [
  { key: 'laundry', label: 'In-unit laundry', group: 'Unit' }, { key: 'ac', label: 'Air conditioning', group: 'Unit' },
  { key: 'quiet', label: 'Quiet', group: 'Unit' }, { key: 'pet', label: 'Pets allowed', group: 'Unit' },
  { key: 'parking', label: 'Parking', group: 'Unit' }, { key: 'private_bath', label: 'Private bath', group: 'Unit' },
  { key: 'furnished', label: 'Furnished', group: 'Unit' }, { key: 'leaseFlex', label: 'Non-August start', group: 'Lease' },
  { key: 'nofees', label: 'No fees outside rent', group: 'Lease' }, { key: 'individual', label: 'Individual lease', group: 'Lease' },
  { key: 'matching', label: 'Landlord roommate matching', group: 'Lease' }, { key: 'night', label: 'Safe walk home at night', group: 'Neighbourhood' },
  { key: 'gym', label: 'Gym', group: 'Neighbourhood' }, { key: 'groc', label: 'Grocery', group: 'Neighbourhood' },
  { key: 'food', label: 'Late-night food', group: 'Neighbourhood' }, { key: 'bus', label: 'Bus stop', group: 'Neighbourhood' },
];

function Results() {
  const { profile } = useApp();
  const sp = useSearchParams();
  const [r, setR] = useState<CompareResp | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [card, setCard] = useState(sp.get('score') === '1');
  const [step, setStep] = useState<{ optional_questions: { key: string; text: string; p: number }[]; predicted_prefs: { key: string; text: string; p: number; value?: boolean }[] } | null>(null);

  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    api<CompareResp>(`/api/compare?p=${encodeProfile(profile)}`).then(x => { if (!live) return; setR(x); setState({ shown: x.cards.map(c => c.id) }); }).catch(() => {});
    api<typeof step>('/api/onboarding/step', { profile }).then(x => { if (live) setStep(x); }).catch(() => {});
    return () => { live = false; };
  }, [profile, hydrated]);

  const optional = step?.optional_questions.length ?? 0;
  const setScore = (k: string, v: ScoreState | 'guess') => setState(s => {
    const sc = { ...(s.profile.scorecard ?? {}) };
    if (v === 'guess') delete sc[k]; else sc[k] = v;
    return { profile: { ...s.profile, scorecard: sc }, shown: [] };
  });
  const guessFor = (k: string) => { const a = step?.predicted_prefs.find(x => x.key === k); return a ? (a.value ? 'Probably yes' : 'Probably not') : null; };

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-[1_1_320px] flex-col gap-1.5">
          <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Your top 3</h1>
          <p className="m-0 text-[17px]" style={{ color: C.muted }}>Picked from {r?.considered ?? 120} places · all Example data</p>
        </div>
        <Link href="/compare" className="flex h-12 items-center rounded-full px-[22px] text-[17px] font-semibold text-white no-underline" style={{ background: C.indigo }}>Compare side by side</Link>
      </div>

      <WhatIf studentBase={r?.student.base} studentBudget={r?.student.budget} />

      <Link href="/onboarding?sharpen=1" className="flex items-center gap-3 rounded-[18px] px-5 py-4 no-underline" style={{ background: C.lilac }}>
        <span className="flex flex-1 flex-col gap-0.5"><span className="text-[17px] font-semibold" style={{ color: C.ink }}>Sharpen my matches</span>
          <span className="text-[15px]" style={{ color: '#3F35E0' }}>{r ? `${Math.round(r.confidence * 100)}% sure now · ` : ''}{r && r.confidence >= 0.99 ? 'up to 3 quick questions to pick between your top 3' : optional ? `up to ${Math.min(3, optional + 1)} quick questions could change your #3` : 'up to 3 quick questions'}</span></span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3F35E0" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </Link>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
        {(r?.cards ?? [null, null, null]).map((c, i) => c ? (
          <Link key={c.id} href="/compare" className="flex flex-col overflow-hidden rounded-[18px] bg-white no-underline" style={{ boxShadow: SHADOW, color: C.ink }}>
            <div className="relative h-40" style={{ background: c.photos[0] }}>
              <span className="absolute left-3 top-3 flex h-7 items-center rounded-full bg-white px-3 text-[13px] font-semibold">{i === 0 ? 'Best overall' : c.tag}</span>
              <span className="absolute right-3 top-3 flex h-7 items-center rounded-full px-3 text-[13px] font-semibold" style={{ background: C.cyan, color: '#0A3D44' }}>Example</span>
            </div>
            <div className="flex flex-col gap-1.5 px-5 pb-5 pt-[18px]">
              <div className="flex items-baseline justify-between gap-2"><span className="text-[17px] font-semibold">{c.short}</span><span className="tnum text-[22px] font-bold">{money(c.total)}</span></div>
              <span className="text-[15px]" style={{ color: C.muted }}>{lineFor(c)}</span>
              <span className="text-[13px]" style={{ color: C.muted }}>{c.name} · {c.landlord} · {Math.round(c.pBest * 100)}% chance this is your #1</span>
            </div>
          </Link>
        ) : <div key={i} className="h-[260px] animate-pulse rounded-[18px] bg-white" />)}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={() => setScoreOpen(o => !o)} aria-expanded={scoreOpen} className="h-11 cursor-pointer rounded-full border-0 px-[18px] text-[15px] font-semibold" style={{ background: C.soft, color: C.ink }}>How we rank</button>
        <button onClick={() => setCard(true)} className="h-11 cursor-pointer rounded-full border-0 px-[18px] text-[15px] font-semibold" style={{ background: C.soft, color: C.ink }}>My scorecard</button>
        <Link href="/map" className="flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold no-underline" style={{ background: C.soft, color: C.ink }}>See on map</Link>
        <Link href="/bring" className="flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold no-underline" style={{ background: C.soft, color: C.ink }}>Add a listing from elsewhere</Link>
      </div>

      {scoreOpen && r?.weights && (
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 rounded-[18px] bg-white p-5" style={{ boxShadow: SHADOW }}>
          {r.weights.map(w => (
            <div key={w.label} className="flex items-center gap-3 text-[15px]">
              <span className="w-[90px]">{w.label}</span>
              <div className="h-1.5 flex-1 rounded-full" style={{ background: '#E3DFD6' }}><div className="h-1.5 rounded-full" style={{ background: C.indigo, width: `${w.pct}%` }} /></div>
              <span className="tnum w-10 text-right" style={{ color: C.muted }}>{w.pct}%</span>
            </div>
          ))}
          <span className="text-[13px]" style={{ color: C.muted }}>Shares of your #1’s score in dollars a month. Your time is worth about ${r.alpha_range[0]}–${r.alpha_range[1]} an hour. Your must-haves are filters, not points.</span>
        </div>
      )}

      <Sheet open={card} title="My scorecard" onClose={() => setCard(false)}>
        <span className="text-[15px]" style={{ color: C.muted }}>Optional. Leave anything on “We’ll guess” — we show our guess.</span>
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
          {SCORECARD.map(a => {
            const cur = profile.scorecard?.[a.key] ?? 'guess';
            return (
              <div key={a.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2" style={{ borderColor: 'rgba(29,31,26,.08)' }}>
                <span className="text-[15px] font-semibold">{a.label}{cur === 'guess' && guessFor(a.key) ? <span className="ml-2 text-[13px] font-normal" style={{ color: C.muted }}>{guessFor(a.key)}</span> : null}</span>
                <div className="flex gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
                  {(['must', 'nice', 'dont_care', 'guess'] as const).map(v => (
                    <button key={v} onClick={() => setScore(a.key, v)} className="h-8 cursor-pointer rounded-full border-0 px-2.5 text-[13px] font-semibold" style={{ background: cur === v ? '#FFFFFF' : 'transparent', color: cur === v ? C.ink : C.muted }}>{{ must: 'Must', nice: 'Nice', dont_care: 'Don’t care', guess: 'We’ll guess' }[v]}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => setCard(false)} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>Update my matches</button>
      </Sheet>
    </Page>
  );
}

export default function ResultsPage() { return <Suspense><Results /></Suspense>; }
