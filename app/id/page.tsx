'use client';
import { useEffect, useState } from 'react';
import { api, C, Page, SHADOW, Toast, initials, money } from '@/components/ui';
import { useApp, useHydrated } from '@/lib/store';
import { musts } from '@/lib/profileText';
import { ConnectExtension } from '@/components/ConnectExtension';

interface StepResp { confidence: number; predicted_prefs: { key: string; text: string; p: number; value?: boolean }[]; alpha_range: [number, number]; student: { base: string; mode: string; group: number; budget: number; parking: boolean } }

const LIVING: Record<string, string> = { alone: 'Just me', friend: 'Me + 1 friend', match: 'Match me with roommates' };
const BASE: Record<string, string> = { Central: 'Central Campus', North: 'North Campus', Medical: 'Medical Campus', Split: 'A mix' };
const MODE: Record<string, string> = { walk: 'Walk', bus: 'Bus', bike: 'Bike', drive: 'Car' };
export default function IdCardPage() {
  const { profile, name } = useApp();
  const [r, setR] = useState<StepResp | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hydrated = useHydrated();
  useEffect(() => { if (!hydrated) return; let live = true; api<StepResp>('/api/onboarding/step', { profile }).then(x => { if (live) setR(x); }).catch(() => {}); return () => { live = false; }; }, [profile, hydrated]);

  const s = r?.student;
  const living = profile.living === 'group' ? `A group of ${profile.groupN ?? 3}` : profile.living ? LIVING[profile.living] : s ? `${s.group === 1 ? 'Just me' : `${s.group} people`} (guessed)` : '…';
  const assumed = (r?.predicted_prefs ?? []).map(a => a.text.replace(/^No: You need a parking spot/, 'No car').replace(/^No: /, 'No ')).slice(0, 4);
  const field = (label: string, value: string, guessed = false) => (
    <div><div className="text-[13px]" style={{ color: 'rgba(255,255,255,.7)' }}>{label}{guessed ? ' · guessed' : ''}</div><div className="tnum text-[17px] font-semibold">{value}</div></div>
  );

  return (
    <Page width={880}>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Your housing ID</h1>
        <p className="m-0 text-[17px]" style={{ color: C.muted }}>This is what we match on. You can change it anytime.</p>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div className="relative min-w-0 flex-[1_1_340px] overflow-hidden rounded-[24px] text-white" style={{ background: C.forest, boxShadow: '0 1px 2px rgba(29,31,26,.06), 0 18px 40px -16px rgba(29,31,26,.22)' }}>
          <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-6">
            <div className="flex flex-col gap-1"><span className="text-[13px] font-semibold" style={{ color: C.lime }}>Example · Fall 2027</span><span className="text-[24px] font-bold tracking-[-0.02em]">{name}</span></div>
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px] font-bold" style={{ background: C.lime, color: C.forest }}>{initials(name)}</span>
          </div>
          <div className="mx-5 h-0" style={{ borderTop: '2px dashed rgba(255,255,255,.3)' }} />
          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            {field('Living', living, !profile.living)}
            {field('Budget', s ? `Up to ${money(profile.budget ?? s.budget)}` : '…', profile.budget == null)}
            {field('Classes', s ? BASE[profile.base ?? s.base] : '…', !profile.base)}
            {field('Getting there', s ? MODE[profile.mode ?? s.mode] : '…', !profile.mode)}
            {field('Time is worth', r ? `About $${Math.round(r.alpha_range[0])}–$${Math.round(r.alpha_range[1])} an hour` : '…', !(profile.cards))}
          </div>
          <div className="flex flex-wrap gap-1.5 px-6 pb-3">
            {musts(profile).map(m => <span key={m} className="flex h-[30px] items-center rounded-full px-3 text-[13px] font-semibold" style={{ background: C.lime, color: C.forest }}>{m}</span>)}
            {!musts(profile).length && <span className="text-[13px]" style={{ color: 'rgba(255,255,255,.7)' }}>No non-negotiables yet</span>}
          </div>
          {assumed.length > 0 && <div className="flex flex-wrap items-center gap-1.5 px-6 pb-6">
            <span className="text-[13px]" style={{ color: 'rgba(255,255,255,.7)' }}>We’re assuming:</span>
            {assumed.map(a => <a key={a} href="/results?score=1" className="flex h-[30px] items-center rounded-full px-3 text-[13px] font-semibold no-underline" style={{ background: 'rgba(255,255,255,.14)', color: '#FFFFFF' }}>{a} · fix</a>)}
          </div>}
        </div>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <ConnectExtension />
          <a href="/compare" className="lift-sm flex h-[52px] items-center justify-center rounded-full text-[17px] font-semibold text-white no-underline" style={{ background: C.indigo }}>Show my top 3</a>
          <div className="grid grid-cols-2 gap-2">
            <a href="/onboarding?fresh=1" className="flex h-12 items-center justify-center rounded-full bg-white text-[15px] font-semibold no-underline" style={{ color: C.ink, boxShadow: SHADOW }}>Edit answers</a>
            <button onClick={() => setToast('Share link copied (demo)')} className="h-12 cursor-pointer rounded-full border-0 bg-white text-[15px] font-semibold" style={{ color: C.ink, boxShadow: SHADOW }}>Share with roommate</button>
          </div>
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
