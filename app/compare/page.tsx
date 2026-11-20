'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { api, C, Page, ProvDot, SHADOW, Toast, money } from '@/components/ui';
import { WhatIf } from '@/components/WhatIf';
import { PhotoCarousel } from '@/components/Photos';
import { setState } from '@/lib/store';
import { useComparison } from '@/lib/useComparison';
import { isOutside } from '@/lib/brought';
import { CompareHeader } from '@/components/CompareHeader';
import type { CardOut, Cell, XReason } from '@/lib/compare';

type CellV = { main: string; color?: string; sub?: string; dot?: CardOut['cost']['lines'][number]['provenance'] };
type Row = { section: string } | { label: string; cells: CellV[] };
const tone = (t: Cell['tone']) => t === 'good' ? C.good : t === 'bad' ? C.bad : C.ink;
const NICHES: [keyof CardOut['extras'], string][] = [['gym', 'Gym'], ['groc', 'Groceries'], ['food', 'Late-night food'], ['park', 'Parking'], ['bus', 'Bus stop']];
const REASONS: [XReason, string][] = [['too_expensive', 'Too expensive'], ['too_far', 'Too far'], ['dont_like', 'Don’t like the place'], ['skip', 'Skip']];
const SLOTS = ['Sat 10 AM', 'Sat 2 PM', 'Sun 11 AM', 'Mon 5 PM'];

function buildRows(cards: CardOut[], niche: string[]): Row[] {
  const rows: Row[] = [];
  const sec = (s: string) => rows.push({ section: s });
  const row = (label: string, f: (c: CardOut) => CellV, collapse = false) => {
    const cells = cards.map(f);
    if (collapse && cards.length > 1 && cells.every(c => c.main === cells[0].main)) return; // rows where all are equal collapse
    rows.push({ label, cells });
  };
  sec('Cost');
  for (const key of ['rent', 'fees', 'utilities', 'parking', 'transport', 'laundry'] as const) {
    if (!cards.some(c => c.cost.lines.some(l => l.key === key))) continue;
    const label = cards[0].cost.lines.find(l => l.key === key)?.label ?? key;
    row(label, c => { const l = c.cost.lines.find(x => x.key === key); return l ? { main: l.amount == null ? '—' : money(l.amount), dot: l.provenance, sub: key === 'rent' ? c.leaseBadge : undefined } : { main: '—' }; }, key !== 'rent');
  }
  sec('Getting there');
  row('Commute', c => ({ main: `${c.commute.minutes} min`, color: c.commute.minutes <= 15 ? C.good : c.commute.minutes >= 30 ? C.bad : C.ink, sub: `${c.commute.label} · ${c.commute.hoursPerWeek} h a week${c.commute.waitMinPerWeek ? ` · ${c.commute.waitMinPerWeek} min waiting` : ''}`, dot: 'Estimated' }));
  row('Bus every', c => ({ main: c.commute.every }), true);
  sec('Your must-haves');
  row('Night walk', c => ({ main: c.mustHaves.night.main, color: tone(c.mustHaves.night.tone), sub: c.mustHaves.night.sub }));
  row('Lyft Pass', c => ({ main: c.mustHaves.owl.main, color: tone(c.mustHaves.owl.tone), sub: c.mustHaves.owl.sub }));
  row('TransLoc pickup', c => ({ main: c.mustHaves.transloc.main, color: tone(c.mustHaves.transloc.tone) }));
  row('Laundry', c => ({ main: c.mustHaves.laundry.main, color: tone(c.mustHaves.laundry.tone) }));
  row('Quiet', c => ({ main: c.mustHaves.quiet.main, color: tone(c.mustHaves.quiet.tone), dot: c.mustHaves.quiet.provenance }));
  sec('Before you sign');
  row('Watch out', c => ({ main: c.regret, color: c.regret.startsWith('No big') ? C.good : '#9A5B00' }));
  row('If a roommate leaves', c => ({ main: c.roommateRisk, color: c.roommateRisk.includes('$0') || c.roommateRisk.startsWith('Just') ? C.good : C.bad }));
  if (niche.length) { sec('Extras'); niche.forEach(k => row(NICHES.find(n => n[0] === k)![1], c => ({ main: c.extras[k as keyof CardOut['extras']] }))); }
  return rows;
}

export default function ComparePage() {
  const { r, cards, bench, profile, seen, brought, outsideTag } = useComparison();
  const [niche, setNiche] = useState<string[]>([]);
  const [sheet, setSheet] = useState<null | { kind: 'replace' | 'message' | 'tour'; pos: number }>(null);
  const [reason, setReason] = useState<XReason>('skip');
  const [slot, setSlot] = useState(0);
  const [msg, setMsg] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = buildRows(cards, niche);
  const tgt = sheet ? cards[sheet.pos] : null;

  async function nextBest() {
    if (!sheet || !tgt) return;
    setBusy(true);
    try {
      const ids = cards.map(c => c.id);
      if (isOutside(tgt.id)) { setState({ shown: ids.filter(id => id !== tgt.id), seen: [...seen, tgt.id] }); setToast(`Removed ${tgt.short} — swapped in your next best match`); setSheet(null); return; }
      const ours = ids.filter(id => !isOutside(id));
      const out = await api<{ shown: string[]; cards: CardOut[]; bench: string[]; replacement: string | null; why: string; note: string; widened: string; profile: typeof profile }>('/api/bench/next', { profile, shown: ours, removed_id: tgt.id, reason, seen });
      const nextShown = ids.map(id => id === tgt.id ? out.replacement : id).filter(Boolean) as string[];
      setState({ profile: out.profile, shown: nextShown, seen: [...seen, tgt.id] });
      const rep = out.cards.find(c => c.id === out.replacement);
      setToast(rep ? `Swapped in ${rep.short} — ${out.why}${out.note ? '. ' + out.note : ''}${out.widened ? ' ' + out.widened : ''}` : 'You’ve seen every match — try Bring any listing');
      setSheet(null); setReason('skip');
    } finally { setBusy(false); }
  }
  function openMessage(pos: number) {
    const c = cards[pos];
    const unknown = c.cost.lines.filter(l => l.provenance === 'Unknown').map(l => `What is the ${l.label.toLowerCase()}?`);
    if (c.mustHaves.quiet.main === 'Unknown') unknown.push('Is the building quiet at night?');
    setMsg(`Hi! I found ${c.name} on Hack the Lease. ${unknown.length ? unknown.join(' ') + ' ' : ''}Are there any fees not in the listing? And is the ${c.cost.lines[0].note.includes('Per bed') ? 'bed' : 'unit'} still open for Fall 2027?`);
    setSheet({ kind: 'message', pos });
  }

  const cell = (v: CellV, k: number): ReactNode => (
    <div key={k} className="flex flex-col gap-0.5 px-2.5 py-3">
      <span className="tnum flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: v.color ?? C.ink }}><ProvDot p={v.dot} />{v.main}</span>
      {v.sub && <span className="text-[13px]" style={{ color: C.muted }}>{v.sub}</span>}
    </div>
  );
  const grid = { gridTemplateColumns: `116px repeat(${Math.max(1, cards.length)}, minmax(200px, 1fr))` };

  return (
    <Page>
      <CompareHeader view="table" count={cards.length} confidence={r?.confidence} subtitle={`Your share per month · commute to ${r ? ({ Central: 'Central Campus', North: 'North Campus', Medical: 'Medical Campus', Split: 'Central + North' } as Record<string, string>)[profile.base ?? r.student.base] : '…'} · Example data`} />

      <WhatIf studentBase={r?.student.base} studentBudget={r?.student.budget} />

      <div className="overflow-x-auto rounded-[18px] bg-white" style={{ boxShadow: SHADOW }}>
        <div className="min-w-[740px]">
          <div className="grid" style={grid}>
            <div className="sticky left-0 z-[1] bg-white" />
            {cards.map((c, pos) => (
              <div key={c.id} className="flex flex-col gap-2.5 px-2.5 pb-3 pt-3.5">
                <PhotoCarousel id={c.id} short={c.short} stock={!isOutside(c.id)} rounded={12} className="h-[150px]">
                  <span className="absolute left-2 top-2 flex h-[26px] items-center rounded-full bg-white px-2.5 text-[13px] font-semibold">{isOutside(c.id) ? 'Found elsewhere' : c.tag}</span>
                  <button onClick={() => { setReason('skip'); setSheet({ kind: 'replace', pos }); }} aria-label={`Replace ${c.short}`} className="lift-sm absolute right-1.5 top-1.5 z-[2] flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                  <span className="absolute bottom-2 left-2 flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold" style={isOutside(c.id) ? { background: C.lilac, color: '#3F35E0' } : { background: C.cyan, color: '#0A3D44' }}>{isOutside(c.id) ? 'Your listing' : 'Example'}</span>
                  {c.verified && <span className="absolute bottom-2 right-2 flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold" style={{ background: C.lime, color: C.forest }}>Verified</span>}
                </PhotoCarousel>
                <div className="flex flex-col"><span className="text-[17px] font-semibold">{c.short}</span><span className="text-[13px]" style={{ color: outsideTag(c.id) ? '#3F35E0' : C.muted }}>{outsideTag(c.id) ?? `${c.name} · ${c.landlord}`}</span></div>
                <div className="flex items-baseline gap-1"><span className="tnum text-[28px] font-bold tracking-[-0.02em]">{money(c.total)}</span><span className="text-[13px]" style={{ color: C.muted }}>/ person / mo</span></div>
              </div>
            ))}
          </div>
          {rows.map((row, i) => 'section' in row ? (
            <div key={i} className="grid" style={{ ...grid, background: C.bg }}>
              <div className="sticky left-0 z-[1] px-4 py-2.5 text-[13px] font-semibold" style={{ background: C.bg, color: C.muted }}>{row.section}</div>
            </div>
          ) : (
            <div key={i} className="grid" style={{ ...grid, borderTop: '1px solid rgba(29,31,26,.08)' }}>
              <div className="sticky left-0 z-[1] bg-white px-4 py-3 text-[15px]" style={{ color: C.muted }}>{row.label}</div>
              {row.cells.map(cell)}
            </div>
          ))}
          <div className="grid" style={{ ...grid, borderTop: '1px solid rgba(29,31,26,.08)' }}>
            <div className="sticky left-0 z-[1] bg-white" />
            {cards.map((c, pos) => (
              <div key={c.id} className="flex flex-col gap-2 px-2.5 pb-4 pt-3.5">
                {isOutside(c.id) ? <span className="flex h-11 items-center justify-center rounded-full text-center text-[13px]" style={{ background: C.soft, color: C.muted }}>Apply on the site you found it</span>
                  : <Link href={`/apply?id=${c.id}`} className="lift-sm flex h-11 items-center justify-center rounded-full text-[15px] font-semibold text-white no-underline" style={{ background: C.indigo }}>Check if I qualify</Link>}
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => openMessage(pos)} className="lift-sm h-10 cursor-pointer rounded-full border-0 text-[14px] font-semibold" style={{ background: C.soft }}>Message</button>
                  <button onClick={() => setSheet({ kind: 'tour', pos })} className="lift-sm h-10 cursor-pointer rounded-full border-0 text-[14px] font-semibold" style={{ background: C.soft }}>Tour</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[15px] font-semibold" style={{ color: C.muted }}>Add a row</span>
          <div className="flex gap-2"><Link href="/bring" className="lift-sm flex h-10 items-center rounded-full bg-white px-4 text-[15px] font-semibold no-underline" style={{ color: C.ink, boxShadow: SHADOW }}>+ Add a listing from elsewhere</Link>
          <Link href="/map" className="lift-sm flex h-10 items-center rounded-full bg-white px-4 text-[15px] font-semibold no-underline" style={{ color: C.ink, boxShadow: SHADOW }}>See on map</Link></div></div>
        <div className="flex flex-wrap gap-2">
          {NICHES.map(([k, l]) => { const on = niche.includes(k); return <button key={k} onClick={() => setNiche(n => on ? n.filter(x => x !== k) : [...n, k])} aria-pressed={on} className="lift-sm h-10 cursor-pointer rounded-full border-0 px-4 text-[15px] font-semibold" style={{ background: on ? C.indigo : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, boxShadow: SHADOW }}>{on ? '− ' : '+ '}{l}</button>; })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-[13px]" style={{ color: C.muted }}>
        <span className="flex items-center gap-1.5"><ProvDot p="Listed" />Listed by landlord</span>
        <span className="flex items-center gap-1.5"><ProvDot p="Estimated" />Estimated</span>
        <span className="flex items-center gap-1.5"><ProvDot p="Unknown" />Unknown — ask</span>
      </div>

      {sheet && tgt && (
        <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-[120px]" style={{ background: 'rgba(29,31,26,.35)' }} onClick={() => setSheet(null)}>
          <div role="dialog" aria-label={sheet.kind} className="flex w-full max-w-[440px] flex-col gap-3 rounded-[24px] bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(29,31,26,.06), 0 18px 40px -16px rgba(29,31,26,.22)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[20px] font-bold tracking-[-0.02em]">{sheet.kind === 'replace' ? `Replace ${tgt.short}` : sheet.kind === 'message' ? `Message · ${tgt.short}` : `Tour · ${tgt.short}`}</span>
              <button onClick={() => setSheet(null)} aria-label="Close" className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-0" style={{ background: C.soft }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            </div>
            {sheet.kind === 'replace' && (<>
              <span className="text-[13px] font-semibold" style={{ color: C.muted }}>Why? (optional — it sharpens your next match)</span>
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map(([k, l]) => <button key={k} onClick={() => setReason(k)} aria-pressed={reason === k} className="lift-sm h-9 cursor-pointer rounded-full border-0 px-3.5 text-[14px] font-semibold" style={{ background: reason === k ? C.indigo : C.soft, color: reason === k ? '#FFFFFF' : C.ink }}>{l}</button>)}
              </div>
              <button onClick={nextBest} disabled={busy} className="lift flex cursor-pointer flex-col gap-1 rounded-[18px] border-0 p-4 text-left" style={{ background: C.lilac }}>
                <span className="text-[17px] font-semibold" style={{ color: C.ink }}>{busy ? 'Re-ranking…' : 'Show me the next best match'}</span>
                <span className="text-[15px]" style={{ color: '#3F35E0' }}>{bench[0] ? `${bench[0].short} · ${money(bench[0].total)} / mo · ${Math.max(0, bench.length - 1)} more waiting` : 'You’ve seen every match — try Bring any listing'}</span>
              </button>
              {brought && !cards.some(c => c.id === 'BYO') && (
                <button onClick={() => { const ids = cards.map(c => c.id); ids[sheet.pos] = 'BYO'; setState({ shown: ids, seen: [...seen.filter(x => x !== 'BYO'), tgt.id] }); setSheet(null); setToast('Swapped in your listing'); }} className="lift flex cursor-pointer flex-col gap-1 rounded-[18px] border-0 p-4 text-left" style={{ background: '#E9F8DA' }}>
                  <span className="text-[17px] font-semibold" style={{ color: C.ink }}>Use the listing I brought</span>
                  <span className="text-[15px]" style={{ color: C.good }}>{brought.label ?? 'Your listing'} · priced the same way</span>
                </button>
              )}
              {cards.length === 3 && (
                <button onClick={() => { setState({ slots: 2, shown: cards.map(c => c.id).filter(id => id !== tgt.id), seen: [...seen, tgt.id] }); setSheet(null); setToast(`Removed ${tgt.short} — comparing 2`); }} className="lift flex cursor-pointer flex-col gap-1 rounded-[18px] border-0 bg-white p-4 text-left" style={{ boxShadow: 'inset 0 0 0 1px rgba(29,31,26,.12)' }}>
                  <span className="text-[17px] font-semibold" style={{ color: C.ink }}>Just remove it</span>
                  <span className="text-[15px]" style={{ color: C.muted }}>Compare the other 2 side by side</span>
                </button>
              )}
              <Link href={`/bring?slot=${sheet.pos}`} className="lift flex flex-col gap-1 rounded-[18px] p-4 no-underline" style={{ background: '#F5F2EB' }}>
                <span className="text-[17px] font-semibold" style={{ color: C.ink }}>Compare a place I found elsewhere</span>
                <span className="text-[15px]" style={{ color: C.muted }}>Paste text, a screenshot, or 4 fields — it takes this spot</span>
              </Link>
            </>)}
            {sheet.kind === 'message' && (<>
              <textarea aria-label="Message to landlord" value={msg} onChange={e => setMsg(e.target.value)} className="h-[130px] resize-none rounded-[12px] p-3 text-[16px] leading-[1.45]" style={{ border: '1px solid rgba(29,31,26,.14)' }} />
              <span className="text-[13px]" style={{ color: C.muted }}>Demo only — Example landlords don’t receive messages.</span>
              <button onClick={() => { setSheet(null); setToast('Message sent (demo)'); }} className="lift-sm h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>Send</button>
            </>)}
            {sheet.kind === 'tour' && (<>
              <div className="grid grid-cols-2 gap-2">{SLOTS.map((l, i) => <button key={l} onClick={() => setSlot(i)} className="lift-sm h-12 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: slot === i ? C.indigo : C.soft, color: slot === i ? '#FFFFFF' : C.ink }}>{l}</button>)}</div>
              <button onClick={() => { setSheet(null); setToast(`Tour requested · ${SLOTS[slot]} (demo)`); }} className="lift-sm h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white" style={{ background: C.indigo }}>Request tour</button>
            </>)}
          </div>
        </div>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </Page>
  );
}
