'use client';
// Live sensitivity control (the brief's hard requirement): change one input → the ranking re-runs.
import { useEffect, useState } from 'react';
import { C, SHADOW } from './ui';
import { setState, useApp } from '@/lib/store';
import type { Base } from '@/lib/engine';

export function WhatIf({ studentBase, studentBudget }: { studentBase?: string; studentBudget?: number }) {
  const { profile } = useApp();
  const base = profile.base ?? studentBase;
  const [budget, setBudget] = useState<number>(profile.budget ?? studentBudget ?? 1150);
  useEffect(() => { setBudget(profile.budget ?? studentBudget ?? 1150); }, [profile.budget, studentBudget]);
  useEffect(() => {
    if (budget === (profile.budget ?? studentBudget)) return;
    const t = setTimeout(() => setState(s => ({ profile: { ...s.profile, budget }, shown: [] })), 350);
    return () => clearTimeout(t);
  }, [budget, profile.budget, studentBudget]);
  const setBase = (b: Base) => setState(s => ({ profile: { ...s.profile, base: b }, shown: [] }));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] bg-white px-4 py-3" style={{ boxShadow: SHADOW }} aria-label="What if">
      <span className="text-[13px] font-semibold" style={{ color: C.muted }}>What if…</span>
      <div className="flex flex-wrap gap-1.5">
        {(['Central', 'North', 'Medical', 'Split'] as Base[]).map(b => (
          <button key={b} onClick={() => setBase(b)} aria-pressed={base === b} className="lift-sm h-9 cursor-pointer rounded-full border-0 px-3.5 text-[14px] font-semibold" style={{ background: base === b ? C.indigo : C.soft, color: base === b ? '#FFFFFF' : C.ink }}>{b === 'Split' ? 'Mix' : b}</button>
        ))}
      </div>
      <label className="flex min-w-[220px] flex-1 items-center gap-2 text-[14px]">
        <span className="tnum w-[110px] font-semibold">${budget.toLocaleString('en-US')} / mo</span>
        <input type="range" min={700} max={2000} step={25} value={budget} onChange={e => setBudget(Number(e.target.value))} aria-label="What-if budget" className="flex-1" style={{ accentColor: C.indigo }} />
      </label>
    </div>
  );
}
