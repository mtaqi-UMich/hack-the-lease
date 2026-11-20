'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, C, Meter, SHADOW, Sheet, Toast } from '@/components/ui';
import { getState, setState } from '@/lib/store';
import type { Profile, UIQuestion } from '@/lib/session';

interface StepResp {
  profile: Profile; next_question: UIQuestion | null; raw_next: { id: string; threshold?: number; dollars?: number; items?: unknown[] } | null;
  done: boolean; reason: string; screen: number; max_screens: number; confidence: number; match_count: number;
  student: { budget: number };
}

const KEYWORDS: [RegExp, string, string][] = [
  [/bath/i, 'private_bath', 'Private bath'], [/furnish/i, 'furnished', 'Furnished'], [/quiet|study/i, 'quiet', 'Quiet'],
  [/laundr|washer/i, 'laundry', 'In-unit laundry'], [/park|car/i, 'parking', 'Parking'], [/pet|dog|cat/i, 'pet', 'Pets OK'],
  [/\bac\b|air/i, 'ac', 'AC'], [/night|safe|walk home/i, 'night', 'Safe walk home at night'], [/fee/i, 'nofees', 'No surprise fees'],
];

function Onboarding() {
  const router = useRouter();
  const sp = useSearchParams();
  const sharpen = sp.get('sharpen') === '1';
  const [r, setR] = useState<StepResp | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [groupN, setGroupN] = useState(3);
  const [picks, setPicks] = useState<string[]>([]);
  const [budget, setBudget] = useState(1150);
  const [soft, setSoft] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'more' | 'sched' | null>(null);
  const [more, setMore] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const load = useCallback(async (profile: Profile, answer?: unknown) => {
    setBusy(true);
    try {
      const out = await api<StepResp>('/api/onboarding/step', { profile, answer, sharpen });
      setState({ profile: out.profile });
      if (out.done) { router.push(sharpen ? '/compare' : '/id'); return; }
      setR(out); setSel(null); setPicks([]);
      if (out.next_question?.kind === 'budget') setBudget(out.profile.budget ?? Math.round((out.student.budget || 1150) / 25) * 25);
    } finally { setBusy(false); }
  }, [router, sharpen]);

  useEffect(() => {
    if (started.current) return; started.current = true;
    if (sp.get('fresh') === '1') { setState({ profile: {}, history: [], shown: [], seen: [] }); load({}); }
    else load(getState().profile);
  }, [load, sp]);

  // live "N places fit" under the budget slider
  useEffect(() => {
    if (r?.next_question?.kind !== 'budget') return;
    const t = setTimeout(async () => {
      const out = await api<StepResp>('/api/onboarding/step', { profile: { ...getState().profile, budget } });
      setCount(out.match_count);
    }, 200);
    return () => clearTimeout(t);
  }, [budget, r?.next_question?.kind]);

  const q = r?.next_question;
  const canContinue = !!q && !busy && (q.kind === 'budget' || q.kind === 'must' || (q.kind === 'trade' ? sel != null : sel != null));

  async function next() {
    if (!q || !r) return;
    const profile = getState().profile;
    setState(s => ({ history: [...s.history, profile] }));
    let value: unknown = sel;
    let base = profile;
    if (q.kind === 'budget') { value = budget; base = { ...profile, hardBudget: !soft }; }
    if (q.kind === 'trade') value = sel === 'b' ? 'yes' : 'no';
    if (q.kind === 'must') value = picks;
    if (q.id === 'group' && sel === 'group') base = { ...base, groupN };
    await load(base, { q: r.raw_next, value });
  }
  async function back() {
    const h = getState().history;
    if (!h.length) { router.push(sharpen ? '/compare' : '/'); return; }
    const prev = h[h.length - 1];
    setState({ history: h.slice(0, -1), profile: prev });
    await load(prev);
  }
  function addMore() {
    const hits = KEYWORDS.filter(([re]) => re.test(more));
    if (!hits.length) { setToast('Saved — we’ll ask the landlord about it'); setSheet(null); return; }
    const p = getState().profile;
    const scorecard = { ...(p.scorecard ?? {}) };
    hits.forEach(([, k]) => { scorecard[k] = 'must'; });
    setState({ profile: { ...p, scorecard } });
    setToast(`Added as a must-have: ${hits.map(h => h[2]).join(', ')}`);
    setSheet(null); setMore('');
    load({ ...p, scorecard });
  }

  const stepLabel = r ? `${r.screen + 1} of ${r.max_screens}` : '';
  const progress = r ? Math.round((r.screen + 1) / r.max_screens * 100) : 0;
  const cheaper = Math.round((budget || 1100) / 25) * 25;

  return (
    <div className="relative min-h-screen px-4 pb-10 pt-4" style={{ background: C.bg }}>
      <div className="mx-auto flex max-w-[560px] flex-col gap-7">
        <div className="flex items-center gap-3">
          <button onClick={back} aria-label="Previous question" className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-white" style={{ boxShadow: SHADOW }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: '#E3DFD6' }}><div className="h-1.5 rounded-full transition-all" style={{ background: C.indigo, width: `${progress}%` }} /></div>
          <span className="tnum text-[13px] font-medium" style={{ color: C.muted }}>{sharpen ? 'Sharpen · ' : ''}{stepLabel}</span>
        </div>

        {r && <Meter value={r.confidence} />}

        {!q ? <div className="h-64 animate-pulse rounded-[24px] bg-white" /> : (<>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">{q.title}</h1>
            <p className="m-0 text-[17px]" style={{ color: C.muted }}>{q.sub}</p>
          </div>

          {q.kind === 'choice' && (
            <div className="flex flex-col gap-2.5">
              {q.options!.map(o => {
                const on = sel === o.value;
                return (
                  <button key={o.value} onClick={() => setSel(o.value)} aria-pressed={on} className="flex min-h-[60px] cursor-pointer items-center justify-between gap-3 rounded-[18px] px-[18px] py-3.5 text-left text-[17px] font-semibold" style={{ border: `2px solid ${on ? C.indigo : 'transparent'}`, background: on ? C.lilac : '#FFFFFF', color: C.ink }}>
                    <span>{o.label}</span>
                    <span className="h-[22px] w-[22px] flex-none rounded-full" style={{ border: `2px solid ${on ? C.indigo : '#E3DFD6'}`, background: on ? C.indigo : '#FFFFFF' }} />
                  </button>
                );
              })}
              {q.id === 'group' && sel === 'group' && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[15px]" style={{ color: C.muted }}>How many of you?</span>
                  {[3, 4, 5].map(n => <button key={n} onClick={() => setGroupN(n)} className="h-10 cursor-pointer rounded-full border-0 px-4 text-[15px] font-semibold" style={{ background: groupN === n ? C.indigo : '#FFFFFF', color: groupN === n ? '#FFFFFF' : C.ink, boxShadow: SHADOW }}>{n}</button>)}
                </div>
              )}
            </div>
          )}

          {q.kind === 'budget' && (
            <div className="flex flex-col gap-[18px] rounded-[24px] bg-white px-6 py-7" style={{ boxShadow: SHADOW }}>
              <div className="flex items-baseline gap-1.5"><span className="tnum text-[44px] font-bold tracking-[-0.03em]">${budget.toLocaleString('en-US')}</span><span className="text-[15px]" style={{ color: C.muted }}>a month</span></div>
              <input aria-label="Monthly budget" type="range" min={600} max={2200} step={25} value={budget} onChange={e => setBudget(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: C.indigo }} />
              <div className="flex justify-between text-[13px]" style={{ color: C.muted }}><span>$600</span><span>{count ?? r?.match_count ?? '…'} places fit</span><span>$2,200</span></div>
              <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
                <button onClick={() => setSoft(false)} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: soft ? 'transparent' : '#FFFFFF' }}>Hard limit</button>
                <button onClick={() => setSoft(true)} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: soft ? '#FFFFFF' : 'transparent' }}>Can stretch a bit</button>
              </div>
            </div>
          )}

          {q.kind === 'trade' && q.trade && (
            <div className="grid grid-cols-2 gap-3">
              {([['a', cheaper - q.trade.dollars, 22, 'cheaper, farther'], ['b', cheaper, 12, 'closer']] as const).map(([k, cost, mins, hint]) => (
                <button key={k} onClick={() => setSel(k)} aria-pressed={sel === k} className="flex cursor-pointer flex-col gap-1.5 rounded-[18px] bg-white p-5 text-left" style={{ border: `2px solid ${sel === k ? C.indigo : 'transparent'}`, boxShadow: SHADOW }}>
                  <span className="tnum text-[28px] font-bold" style={{ color: C.ink }}>${cost.toLocaleString('en-US')}</span>
                  <span className="text-[15px]" style={{ color: C.muted }}>{mins} min each way</span>
                  <span className="text-[13px]" style={{ color: C.muted }}>{hint}</span>
                </button>
              ))}
              <p className="col-span-2 m-0 text-[13px]" style={{ color: C.muted }}>Picking the closer one means you’d pay ${q.trade.dollars} a month to save 10 minutes each way.</p>
            </div>
          )}

          {q.kind === 'must' && (
            <div className="flex flex-wrap gap-2">
              {q.chips!.map(c => {
                const on = picks.includes(c.value);
                return <button key={c.value} onClick={() => setPicks(p => { const n = on ? p.filter(x => x !== c.value) : [...p, c.value]; return n.length > 3 ? n.slice(1) : n; })} aria-pressed={on} className="h-11 cursor-pointer rounded-full border-0 px-[18px] text-[15px] font-semibold" style={{ background: on ? C.indigo : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, boxShadow: SHADOW }}>{c.label}</button>;
              })}
            </div>
          )}

          <div className="flex flex-col gap-3.5 pt-2">
            <button onClick={next} disabled={!canContinue} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white disabled:opacity-40" style={{ background: C.indigo }}>
              {busy ? 'Thinking…' : (r && r.screen + 1 >= r.max_screens) ? (sharpen ? 'Update my matches' : 'See my housing ID') : 'Continue'}
            </button>
            <span className="text-center text-[13px]" style={{ color: C.muted }}>{q.why}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,31,26,.12)' }}>
            <button onClick={() => setSheet('more')} className="h-10 cursor-pointer rounded-full border-0 bg-transparent px-3.5 text-[15px] font-semibold" style={{ color: C.indigo }}>Something else matters? Add it</button>
            <button onClick={() => setSheet('sched')} className="h-10 cursor-pointer rounded-full border-0 bg-transparent px-3.5 text-[15px] font-medium" style={{ color: C.muted }}>Import class schedule</button>
          </div>
          <p className="m-0 text-center text-[12px]" style={{ color: C.muted }}>Matching against 120 Example (synthetic) listings. <Link href="/evidence" className="underline">How this works</Link></p>
        </>)}
      </div>

      <Sheet open={sheet === 'more'} title="Something else matters?" onClose={() => setSheet(null)}>
        <span className="text-[15px] leading-[1.45]" style={{ color: C.muted }}>Tell us in your own words. We turn it into a filter and show how many places still fit.</span>
        <input aria-label="What else matters" value={more} onChange={e => setMore(e.target.value)} placeholder="e.g. private bathroom, furnished, quiet for studying" className="h-12 rounded-[12px] px-3.5 text-[16px]" style={{ border: '1px solid rgba(29,31,26,.14)' }} />
        <button onClick={addMore} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>Add it</button>
      </Sheet>
      <Sheet open={sheet === 'sched'} title="Import your class schedule" onClose={() => setSheet(null)}>
        <span className="text-[15px] leading-[1.45]" style={{ color: C.muted }}>Optional, coming later. Upload your .ics schedule and we time your commute to each class. For now we use your campus answer: 2 trips a day, 5 days a week.</span>
        <button onClick={() => setSheet(null)} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>Maybe later</button>
      </Sheet>
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  );
}

export default function OnboardingPage() { return <Suspense><Onboarding /></Suspense>; }
