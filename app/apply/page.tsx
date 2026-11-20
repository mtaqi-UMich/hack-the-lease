'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, C, SHADOW, money } from '@/components/ui';
import { setState, useApp, useHydrated } from '@/lib/store';
import { groupOf } from '@/lib/session';
import type { Payer, Credit, Verdict } from '@/lib/apply';

const PAYS: [Payer, string][] = [['parent', 'Parent guarantor'], ['income', 'My income'], ['aid', 'Financial aid'], ['service', 'Guarantor service']];
const CREDITS: [Credit, string][] = [['none', 'None yet'], ['below650', 'Below 650'], ['650plus', '650+']];
const VCOL: Record<Verdict, { bg: string; fg: string }> = { 'Likely eligible': { bg: C.lime, fg: C.forest }, 'Likely needs a guarantor': { bg: '#FFF4DF', fg: '#9A5B00' }, 'Missing: proof of funds': { bg: C.soft, fg: C.ink }, 'Not accepted here': { bg: '#FDE7E4', fg: C.bad } };
const STEPS = [['Profile', 'From your housing ID'], ['Roommate', 'Your roommate applies with you'], ['Guarantor', 'We email your guarantor a 2-minute link'], ['Screening', 'A partner checks ID and credit · $35']];

function Apply() {
  const sp = useSearchParams();
  const { profile, shown, name } = useApp();
  const hydrated = useHydrated();
  const ours = shown.filter(x => x !== 'BYO');
  const [picked, setPicked] = useState<string | null>(null);
  const id = picked ?? sp.get('id') ?? ours[0];
  const [stage, setStage] = useState(0);
  const [pay, setPay] = useState<Payer>('parent');
  const [credit, setCredit] = useState<Credit>('none');
  const [monthly, setMonthly] = useState('');
  const [rights, setRights] = useState(false);
  const [done, setDone] = useState(0);
  const [pq, setPq] = useState<{ id: string; short: string; verdict: Verdict; why: string; rentPerPerson: number; rules: string }[]>([]);
  const [app, setApp] = useState<{ id: string; unit: string; lease_review: { label: string; value: string; flag?: string }[] } | null>(null);
  const [signed, setSigned] = useState(false);
  const group = profile.living === 'match' ? 1 : (groupOf(profile) ?? 1);
  const ids = Array.from(new Set([sp.get('id'), ...ours].filter(Boolean))).slice(0, 3) as string[];

  useEffect(() => {
    if (!hydrated || !ids.length) return;
    let live = true;
    const t = setTimeout(() => api<{ results: typeof pq }>('/api/prequalify', { ids, pay, credit, monthly: monthly ? Number(monthly) : undefined, group }).then(x => { if (live) setPq(x.results); }).catch(() => {}), 150);
    return () => { live = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, ids.join(), pay, credit, monthly, group]);

  async function submit() {
    const out = await api<NonNullable<typeof app>>('/api/applications', { listing_id: id, housing_id: { name, profile }, funding: { pay, credit, monthly }, group });
    setApp(out); setState({ appliedTo: id }); setStage(2);
  }
  const bar = (on: boolean) => <div className="h-1.5 flex-1 rounded-full" style={{ background: on ? C.indigo : '#E3DFD6' }} />;
  const target = pq.find(x => x.id === id);

  return (
    <div className="relative min-h-screen px-4 pb-12 pt-4" style={{ background: C.bg }}>
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <div className="flex items-center gap-3">
          <button onClick={() => stage > 0 && stage < 3 ? setStage(stage - 1) : history.back()} aria-label="Back" className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-white" style={{ boxShadow: SHADOW }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></button>
          <div className="flex flex-1 gap-1.5">{bar(true)}{bar(stage >= 1)}{bar(stage >= 2)}</div>
        </div>

        {stage === 0 && (<>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] font-bold tracking-[-0.03em] sm:text-[34px]">Check if you qualify</h1>
            <p className="m-0 text-[17px]" style={{ color: C.muted }}>30 seconds. No SSN, no fee, nothing stored.</p>
          </div>
          <div className="flex flex-col gap-2.5"><span className="text-[15px] font-semibold">Who pays the rent?</span>
            <div className="flex flex-wrap gap-2">{PAYS.map(([k, l]) => <button key={k} onClick={() => setPay(k)} aria-pressed={pay === k} className="lift-sm h-11 cursor-pointer rounded-full border-0 px-[18px] text-[15px] font-semibold" style={{ background: pay === k ? C.indigo : '#FFFFFF', color: pay === k ? '#FFFFFF' : C.ink, boxShadow: SHADOW }}>{l}</button>)}</div>
          </div>
          {(pay === 'income' || pay === 'aid') && <input aria-label="Monthly amount" inputMode="numeric" placeholder={`Monthly ${pay === 'aid' ? 'aid' : 'income'} ($)`} value={monthly} onChange={e => setMonthly(e.target.value.replace(/[^\d]/g, ''))} className="h-12 rounded-[12px] bg-white px-3.5 text-[16px]" style={{ border: '1px solid rgba(29,31,26,.14)' }} />}
          <div className="flex flex-col gap-2.5"><span className="text-[15px] font-semibold">US credit score</span>
            <div className="grid grid-cols-3 gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>{CREDITS.map(([k, l]) => <button key={k} onClick={() => setCredit(k)} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: credit === k ? '#FFFFFF' : 'transparent', color: credit === k ? C.ink : C.muted }}>{l}</button>)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px]" style={{ color: C.muted }}>Tap a place to apply there instead. Each landlord has its own rules.</span>
            {pq.map(x => (
              <button key={x.id} onClick={() => setPicked(x.id)} aria-pressed={x.id === id} className="lift flex cursor-pointer flex-col gap-1 rounded-[18px] border-0 bg-white p-4 text-left" style={{ boxShadow: x.id === id ? `inset 0 0 0 2px ${C.indigo}, ${SHADOW}` : SHADOW, color: C.ink }}>
                <div className="flex w-full items-center justify-between gap-2"><span className="text-[17px] font-semibold">{x.short}{x.id === id && <span className="ml-2 text-[13px] font-semibold" style={{ color: C.indigo }}>Applying here</span>}</span><span className="flex h-[26px] flex-none items-center rounded-full px-2.5 text-[13px] font-semibold" style={{ background: VCOL[x.verdict].bg, color: VCOL[x.verdict].fg }}>{x.verdict}</span></div>
                <span className="text-[14px]" style={{ color: C.muted }}>{money(x.rentPerPerson)} a month · {x.why}</span>
                <span className="text-[12px]" style={{ color: C.muted }}>{x.rules}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setRights(r => !r)} aria-expanded={rights} className="h-10 cursor-pointer self-start rounded-full border-0 bg-transparent px-0 text-[15px] font-semibold" style={{ color: C.indigo }}>Your rights in Ann Arbor {rights ? '−' : '+'}</button>
          {rights && <ul className="m-0 flex flex-col gap-1.5 rounded-[18px] bg-white p-4 pl-8 text-[14px]" style={{ boxShadow: SHADOW }}>
            <li>Application fee is capped at $50 and refunded if you aren’t offered the unit.</li>
            <li>Landlords can’t use criminal history (Fair Chance Access to Housing).</li>
            <li>Source of income and student status are protected — aid counts as income.</li>
            <li>Security deposit is capped at 1.5 months’ rent.</li>
            <li>Required fees must be inside the advertised rent (since Aug 1, 2026).</li>
            <li className="list-none pt-1" style={{ color: C.muted }}>Not legal advice.</li>
          </ul>}
          <button onClick={() => setStage(1)} disabled={!target || target.verdict === 'Not accepted here'} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white disabled:opacity-40" style={{ background: C.indigo }}>{target?.verdict === 'Not accepted here' ? `Pick another place or payer for ${target.short}` : `Start one application for ${target?.short ?? 'your top pick'}`}</button>
        </>)}

        {stage === 1 && (<>
          <div className="flex flex-col gap-2"><h1 className="m-0 text-[30px] font-bold tracking-[-0.03em]">One application</h1><p className="m-0 text-[17px]" style={{ color: C.muted }}>Like the Common App, but for rentals: fill it once and send it to any landlord here. Most of it comes from your housing ID, so this is 4 quick steps, not 4 forms.</p></div>
          <div className="flex flex-col gap-2">
            {STEPS.slice(0, group > 1 ? 4 : 4).map(([t, s], i) => {
              const st = i < done ? { bg: C.forest, fg: C.lime, mark: '✓' } : i === done ? { bg: C.indigo, fg: '#FFFFFF', mark: String(i + 1) } : { bg: C.soft, fg: C.ink, mark: String(i + 1) };
              return <div key={t} className="flex items-center gap-3 rounded-[18px] bg-white p-4" style={{ boxShadow: SHADOW }}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[15px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.mark}</span>
                <div className="flex flex-col"><span className="text-[17px] font-semibold">{t}</span><span className="text-[14px]" style={{ color: C.muted }}>{i === 1 && group <= 1 ? 'Just you — skipped' : s}</span></div>
              </div>;
            })}
          </div>
          <p className="m-0 text-[13px]" style={{ color: C.muted }}>We never ask for or store your SSN, credit report or criminal history — the screening partner handles identity and credit.</p>
          <button onClick={() => done >= STEPS.length - 1 ? submit() : setDone(done + 1)} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>{done >= STEPS.length - 1 ? 'Pay $35 and submit (demo)' : 'Continue'}</button>
        </>)}

        {stage === 2 && app && (<>
          <div className="flex flex-col gap-2"><h1 className="m-0 text-[30px] font-bold tracking-[-0.03em]">Before you sign</h1><p className="m-0 text-[17px]" style={{ color: C.muted }}>Plain-language summary of {app.unit}. Anything that breaks Ann Arbor rules is flagged.</p></div>
          <div className="flex flex-col rounded-[18px] bg-white px-5 py-2" style={{ boxShadow: SHADOW }}>
            {app.lease_review.map(l => <div key={l.label} className="flex flex-col gap-0.5 py-3" style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}>
              <div className="flex justify-between gap-3 text-[15px]"><span style={{ color: C.muted }}>{l.label}</span><span className="text-right font-semibold">{l.value}</span></div>
              {l.flag && <span className="text-[13px] font-semibold" style={{ color: C.bad }}>⚠ {l.flag}</span>}
            </div>)}
          </div>
          <label className="flex items-center gap-2 text-[15px]"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} className="h-5 w-5" style={{ accentColor: C.indigo }} />I’ve read the summary</label>
          <button onClick={() => setStage(3)} disabled={!signed} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white disabled:opacity-40" style={{ background: C.indigo }}>E-sign (demo)</button>
        </>)}

        {stage === 3 && app && (
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full text-[28px] font-bold" style={{ background: C.lime, color: C.forest }}>✓</span>
            <h1 className="m-0 text-[30px] font-bold tracking-[-0.03em]">Application sent</h1>
            <p className="m-0 max-w-[400px] text-[17px]" style={{ color: C.muted }}>{app.unit} · reference {app.id}. This is a demo with Example data — no real landlord received it.</p>
            <div className="flex gap-2"><Link href="/compare" className="flex h-12 items-center rounded-full bg-white px-5 text-[15px] font-semibold no-underline" style={{ color: C.ink, boxShadow: SHADOW }}>Back to compare</Link><Link href="/landlord" className="flex h-12 items-center rounded-full px-5 text-[15px] font-semibold text-white no-underline" style={{ background: C.indigo }}>See the landlord side</Link></div>
          </div>
        )}
      </div>
    </div>
  );
}
export default function ApplyPage() { return <Suspense><Apply /></Suspense>; }
