'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { C, Page, SHADOW, money } from '@/components/ui';
import { WhatIf } from '@/components/WhatIf';
import { PhotoCarousel } from '@/components/Photos';
import { CompareHeader, PrioritiesSheet } from '@/components/CompareHeader';
import { useComparison } from '@/lib/useComparison';
import { isOutside } from '@/lib/brought';
import type { CardOut } from '@/lib/compare';
import { lineFor } from '@/lib/profileText';

export interface CompareResp {
  cards: CardOut[]; bench: string[]; bench_cards: { id: string; short: string; total: number; commute: number }[];
  confidence: number; alpha: number; alpha_range: number[];
  student: { base: string; mode: string; group: number; budget: number; parking: boolean };
  considered: number; weights: { label: string; pct: number }[] | null;
}

function Results() {
  const sp = useSearchParams();
  const { r, cards, outsideTag } = useComparison();
  const [scoreOpen, setScoreOpen] = useState(false);
  const [card, setCard] = useState(sp.get('score') === '1');

  return (
    <Page>
      <CompareHeader view="cards" count={cards.length} confidence={r?.confidence} subtitle={`Picked from ${r?.considered ?? 120} places · Example data`} />

      <WhatIf studentBase={r?.student.base} studentBudget={r?.student.budget} />

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
        {(r ? cards : [null, null, null]).map((c, i) => c ? (
          <Link key={c.id} href="/compare" className="lift flex flex-col overflow-hidden rounded-[18px] bg-white no-underline" style={{ boxShadow: SHADOW, color: C.ink }}>
            <PhotoCarousel id={c.id} short={c.short} stock={!isOutside(c.id)} className="h-48">
              <span className="absolute left-3 top-3 flex h-7 items-center rounded-full bg-white px-3 text-[13px] font-semibold">{isOutside(c.id) ? 'Your listing' : i === 0 ? 'Best overall' : c.tag}</span>
              <span className="absolute right-3 top-3 flex h-7 items-center rounded-full px-3 text-[13px] font-semibold" style={isOutside(c.id) ? { background: C.lilac, color: '#3F35E0' } : { background: C.cyan, color: '#0A3D44' }}>{isOutside(c.id) ? 'Found elsewhere' : 'Example'}</span>
            </PhotoCarousel>
            <div className="flex flex-col gap-1.5 px-5 pb-5 pt-[18px]">
              <div className="flex items-baseline justify-between gap-2"><span className="text-[17px] font-semibold">{c.short}</span><span className="tnum text-[22px] font-bold">{money(c.total)}</span></div>
              <span className="text-[15px]" style={{ color: C.muted }}>{lineFor(c)}</span>
              <span className="text-[13px]" style={{ color: outsideTag(c.id) ? '#3F35E0' : C.muted }}>{outsideTag(c.id) ?? `${c.name} · ${c.landlord}`}</span>
            </div>
          </Link>
        ) : <div key={i} className="h-[300px] animate-pulse rounded-[18px] bg-white" />)}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={() => setScoreOpen(o => !o)} aria-expanded={scoreOpen} className="lift-sm h-11 cursor-pointer rounded-full border-0 px-[18px] text-[15px] font-semibold" style={{ background: C.soft, color: C.ink }}>How we rank</button>
        <Link href="/map" className="lift-sm flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold no-underline" style={{ background: C.soft, color: C.ink }}>See on map</Link>
        <Link href="/bring" className="lift-sm flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold no-underline" style={{ background: C.soft, color: C.ink }}>Add a listing from elsewhere</Link>
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
          <span className="text-[13px]" style={{ color: C.muted }}>Shares of your top pick’s score in dollars a month. Your time is worth about ${r.alpha_range[0]}–${r.alpha_range[1]} an hour. Your must-haves are filters, not points.</span>
        </div>
      )}
      <PrioritiesSheet open={card} onClose={() => setCard(false)} />
    </Page>
  );
}

export default function ResultsPage() { return <Suspense><Results /></Suspense>; }
