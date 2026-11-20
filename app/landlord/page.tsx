'use client';
import { useEffect, useState } from 'react';
import { api, C, Page, SHADOW, Toast } from '@/components/ui';
import type { Lead } from '@/lib/apply';
import type { Check, ListingDraft } from '@/lib/compliance';

interface CheckResp { draft: ListingDraft; checks: Check[]; failures: number; publishable: boolean }

export default function LandlordPage() {
  const [tab, setTab] = useState<'leads' | 'check'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [chk, setChk] = useState<CheckResp | null>(null);
  const [draft, setDraft] = useState<Partial<ListingDraft>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => { api<{ leads: Lead[] }>('/api/landlord/leads?landlord=hackberry').then(x => setLeads(x.leads)).catch(() => {}); }, []);
  useEffect(() => { api<CheckResp>('/api/landlord/listing-check', { draft }).then(setChk).catch(() => {}); }, [draft]);

  async function fixAndPublish() {
    const out = await api<CheckResp>('/api/landlord/listing-check', { draft, fix: true });
    setChk(out); setDraft(out.draft); setPublished(true); setToast('Unit 4B is live (Example)');
  }
  const num = (k: keyof ListingDraft, label: string) => (
    <label className="flex flex-col gap-1 text-[13px]" style={{ color: C.muted }}>{label}
      <input inputMode="numeric" value={String((draft[k] as number | undefined) ?? (chk?.draft[k] as number | undefined) ?? '')} onChange={e => { setPublished(false); setDraft({ ...draft, [k]: Number(e.target.value.replace(/[^\d]/g, '')) }); }} className="h-11 rounded-[12px] bg-white px-3 text-[16px]" style={{ border: '1px solid rgba(29,31,26,.14)', color: C.ink }} />
    </label>
  );
  const toggle = (k: keyof ListingDraft, label: string) => {
    const v = (draft[k] as boolean | undefined) ?? (chk?.draft[k] as boolean | undefined) ?? false;
    return <button onClick={() => { setPublished(false); setDraft({ ...draft, [k]: !v }); }} aria-pressed={v} className="h-10 cursor-pointer rounded-full border-0 px-3.5 text-[14px] font-semibold" style={{ background: v ? C.forest : C.soft, color: v ? C.lime : C.ink }}>{v ? '✓ ' : ''}{label}</button>;
  };

  return (
    <Page width={880}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold" style={{ color: C.muted }}>Landlord view · Hackberry Lane · Example data</span>
        <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Your listings</h1>
        <p className="m-0 text-[17px]" style={{ color: C.muted }}>Every lead arrives pre-qualified. Ranking is never for sale.</p>
      </div>
      <div className="grid max-w-[420px] grid-cols-2 gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
        <button onClick={() => setTab('leads')} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: tab === 'leads' ? '#FFFFFF' : 'transparent' }}>Leads</button>
        <button onClick={() => setTab('check')} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: tab === 'check' ? '#FFFFFF' : 'transparent' }}>New listing{chk && chk.failures ? ` · ${chk.failures}` : ''}</button>
      </div>

      {tab === 'leads' && (
        <div className="flex flex-col gap-2.5">
          {leads.map(l => { const done = sent[l.id]; return (
            <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-[18px] bg-white p-4" style={{ boxShadow: SHADOW }}>
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[15px] font-bold" style={{ background: C.lime, color: C.forest }}>{l.init}</span>
              <div className="flex min-w-[200px] flex-1 flex-col">
                <span className="text-[17px] font-semibold">{l.name} <span className="text-[13px] font-medium" style={{ color: C.muted }}>· {l.unit}</span></span>
                <span className="text-[14px]" style={{ color: C.muted }}>{l.who} · budget ${l.budget.toLocaleString('en-US')} · move-in {l.move_in}</span>
                <span className="text-[13px]" style={{ color: C.good }}>Ranked you for: {l.reasons.join(', ')}</span>
              </div>
              <button onClick={() => { if (!done) { setSent({ ...sent, [l.id]: true }); setToast(l.cta === 'Reply' ? `Reply sent to ${l.name}` : l.cta === 'Confirm' ? `Tour confirmed with ${l.name}` : `${l.name} invited to apply`); } }} className="h-10 cursor-pointer rounded-full border-0 px-5 text-[15px] font-semibold" style={{ background: done ? C.soft : C.indigo, color: done ? C.muted : '#FFFFFF' }}>{done ? 'Sent' : l.cta}</button>
            </div>
          ); })}
          {!leads.length && <div className="h-40 animate-pulse rounded-[18px] bg-white" />}
          <p className="m-0 text-[13px]" style={{ color: C.muted }}>Leads are synthetic Example students who ranked a Hackberry unit #1. Real leads would carry the student’s housing ID only with their permission.</p>
        </div>
      )}

      {tab === 'check' && chk && (
        <div className="flex flex-wrap gap-5">
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[18px] bg-white p-5" style={{ boxShadow: SHADOW }}>
            <span className="text-[17px] font-semibold">Unit 4B · 2 bed · joint lease</span>
            <div className="grid grid-cols-2 gap-2.5">{num('rent', 'Advertised rent ($/mo)')}{num('deposit', 'Deposit ($)')}{num('application_fee', 'Application fee ($)')}</div>
            <div className="flex flex-wrap gap-1.5">{toggle('application_fee_refundable', 'Fee refundable')}{toggle('utilities_disclosed', 'Utilities disclosed')}{toggle('asks_criminal_history', 'Asks criminal history')}</div>
            <span className="text-[13px]" style={{ color: C.muted }}>Required fees: {chk.draft.required_fees.map(f => `${f.name} $${f.amount}${f.in_base_rent ? ' (in rent)' : ' (separate)'}`).join(', ') || 'none'}</span>
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            {chk.checks.map(c => (
              <div key={c.id} className="flex items-start gap-3 rounded-[18px] bg-white p-4" style={{ boxShadow: SHADOW }}>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[15px] font-bold" style={{ background: c.pass ? C.forest : C.bad, color: c.pass ? C.lime : '#FFFFFF' }}>{c.pass ? '✓' : '!'}</span>
                <div className="flex flex-col"><span className="text-[16px] font-semibold">{c.title}</span><span className="text-[14px]" style={{ color: C.muted }}>{c.sub}</span>{c.fix && <span className="text-[13px]" style={{ color: C.indigo }}>Fix: {c.fix}</span>}</div>
              </div>
            ))}
            <span className="text-[14px]" style={{ color: C.muted }}>{chk.failures ? 'Students who ticked “No surprise fees” won’t see this unit until it’s fixed.' : 'Ready to publish.'}</span>
            <button onClick={fixAndPublish} disabled={published} className="h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white disabled:opacity-60" style={{ background: C.indigo }}>{published ? 'Published' : chk.failures ? `Fix ${chk.failures} item${chk.failures > 1 ? 's' : ''} and publish` : 'Publish'}</button>
            <span className="text-[12px]" style={{ color: C.muted }}>Ann Arbor rules: ORD-26-04, Fair Chance Access to Housing, MCL 554.602. Not legal advice.</span>
          </div>
        </div>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
