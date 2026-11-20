'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, C, Page, SHADOW, money } from '@/components/ui';
import { useApp, useHydrated } from '@/lib/store';
import { encodeProfile } from '@/lib/wire';
import type { CardOut } from '@/lib/compare';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="h-full min-h-[420px] w-full animate-pulse rounded-[18px]" style={{ background: '#EDEAE3' }} /> });
const tone = (t: string) => t === 'good' ? C.good : t === 'bad' ? C.bad : C.ink;

export default function MapPage() {
  const { profile, shown } = useApp();
  const hydrated = useHydrated();
  const [cards, setCards] = useState<CardOut[]>([]);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    const ids = shown.length === 3 ? `&ids=${shown.join(',')}` : '';
    api<{ cards: CardOut[] }>(`/api/compare?p=${encodeProfile(profile)}${ids}`).then(x => { if (live) setCards(x.cards); }).catch(() => {});
    return () => { live = false; };
  }, [profile, shown, hydrated]);

  const h = cards[sel];
  const pins = useMemo(() => cards.map((c, i) => ({ id: c.id, lat: c.coord[0], lng: c.coord[1], on: i === sel, label: i === sel ? `#${i + 1} · ${money(c.total)}` : `#${i + 1}` })), [cards, sel]);
  const rows = h ? [
    ['Commute', `${h.commute.minutes} min · ${h.commute.label}`, h.commute.minutes <= 15 ? 'good' : h.commute.minutes >= 30 ? 'bad' : 'ink'],
    ['Night walk', h.mustHaves.night.main, h.mustHaves.night.tone],
    ['Lyft Night Owl', h.mustHaves.owl.main, h.mustHaves.owl.tone],
    ['TransLoc pickup', h.mustHaves.transloc.main, h.mustHaves.transloc.tone],
    ['Laundry', h.mustHaves.laundry.main, h.mustHaves.laundry.tone],
    ['Quiet', h.mustHaves.quiet.main, h.mustHaves.quiet.tone],
    ['Groceries', h.extras.groc, 'ink'],
    ['Bus stop', h.extras.bus, 'ink'],
  ] : [];

  return (
    <Page>
      <div className="flex items-center gap-3">
        <Link href="/compare" aria-label="Back to compare" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white" style={{ boxShadow: SHADOW }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></Link>
        <h1 className="m-0 text-[28px] font-bold tracking-[-0.03em] sm:text-[34px]">Your top 3 on the map</h1>
      </div>
      <div className="flex flex-wrap items-stretch gap-5">
        <aside className="flex min-w-0 max-w-full flex-[1_1_320px] flex-col gap-3.5 rounded-[18px] bg-white p-4" style={{ boxShadow: SHADOW }}>
          <div className="grid grid-cols-3 gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
            {cards.map((c, i) => <button key={c.id} onClick={() => setSel(i)} aria-pressed={sel === i} className="h-9 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: sel === i ? '#FFFFFF' : 'transparent', color: sel === i ? C.ink : C.muted }}>#{i + 1}</button>)}
          </div>
          {h ? (<>
            <div className="relative h-[140px] rounded-[12px]" style={{ background: h.photos[0] }}>
              <span className="absolute left-2 top-2 flex h-[26px] items-center rounded-full bg-white px-2.5 text-[13px] font-semibold">#{sel + 1} · {h.tag}</span>
              <span className="absolute bottom-2 left-2 flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold" style={{ background: C.cyan, color: '#0A3D44' }}>Example</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[20px] font-bold tracking-[-0.02em]">{h.short}</span>
              <span className="tnum text-[22px] font-bold">{money(h.total)}<span className="text-[13px] font-medium" style={{ color: C.muted }}> / mo</span></span>
            </div>
            <div className="flex flex-col">
              {rows.map(([l, v, t]) => <div key={l} className="flex justify-between gap-3 py-2.5 text-[15px]" style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}><span style={{ color: C.muted }}>{l}</span><span className="text-right font-semibold" style={{ color: tone(t) }}>{v}</span></div>)}
            </div>
            <div className="rounded-[12px] px-3.5 py-3 text-[15px]" style={{ background: '#F5F2EB' }}><span className="font-semibold" style={{ color: C.bad }}>Watch out: </span>{h.regret}</div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Link href="/compare" className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold no-underline" style={{ background: C.soft, color: C.ink }}>Compare</Link>
              <Link href={`/apply?id=${h.id}`} className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-white no-underline" style={{ background: C.indigo }}>Apply</Link>
            </div>
          </>) : <div className="h-64 animate-pulse rounded-[12px]" style={{ background: C.soft }} />}
        </aside>
        <div className="relative min-h-[420px] min-w-0 flex-[999_1_480px] rounded-[18px]" style={{ boxShadow: SHADOW }}>
          <MapView pins={pins} onPick={id => setSel(cards.findIndex(c => c.id === id))} />
        </div>
      </div>
    </Page>
  );
}
