'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, C, SHADOW } from '@/components/ui';
import { getState } from '@/lib/store';
import type { Extracted } from '@/lib/extract';

interface Resp {
  fields: Extracted[]; questions: { key: string; text: string; options: string[] }[]; source: 'ai' | 'rules' | 'cache' | 'form';
  redactions: number; note: string; hood: string; missing: string[];
  rank: { rank: number | null; of: number; reason: string; perPerson: number; minutes: number | null } | null;
}
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
const STATUS = { Listed: { bg: C.lime, fg: C.forest }, Estimated: { bg: C.cyan, fg: '#0A3D44' }, Unknown: { bg: C.soft, fg: C.ink } };
const fmt = (f: Extracted) => {
  if (f.value == null) return '—';
  if (f.key === 'rent' || f.key === 'deposit' || f.key === 'application_fee') return `$${Number(f.value).toLocaleString('en-US')}`;
  if (f.key === 'price_basis') return f.value === 'per_bed' ? 'Per person' : 'Whole place';
  if (f.key === 'laundry') return ({ in_unit: 'In unit', in_building: 'In building', none: 'None' } as Record<string, string>)[String(f.value)] ?? String(f.value);
  if (typeof f.value === 'boolean') return f.value ? 'Yes' : 'No';
  if (Array.isArray(f.value)) return f.value.length ? f.value.join(', ') : 'None';
  if (f.key === 'sqft') return `${f.value} sq ft`;
  return String(f.value);
};

export default function BringPage() {
  const [tab, setTab] = useState<'paste' | 'shot' | 'fields'>('paste');
  const [text, setText] = useState('');
  const [form, setForm] = useState({ rent: '', beds: '', address: '', price_basis: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [r, setR] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shot, setShot] = useState<{ url: string; status: string; via?: 'ai' | 'ocr' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Screenshot → text: Claude vision on the server when a key is set, otherwise on-device OCR (tesseract.js).
  async function readImage(file: File) {
    if (!file.type.startsWith('image/')) { setErr('That isn’t an image — try a PNG or JPG screenshot.'); return; }
    setErr(''); setR(null); setText('');
    const url = await new Promise<string>((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = no; fr.readAsDataURL(file); });
    setShot({ url, status: 'Reading your screenshot…' });
    let out = ''; let via: 'ai' | 'ocr' = 'ai';
    try {
      const res = await fetch('/api/listings/ocr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: url }) });
      if (res.ok) out = (await res.json()).text ?? '';
    } catch { /* fall through to on-device OCR */ }
    if (!out) {
      via = 'ocr';
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, { logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') setShot(s => s && { ...s, status: `Reading on your device… ${Math.round(m.progress * 100)}%` }); } });
        const { data } = await worker.recognize(file);
        await worker.terminate();
        out = data.text.trim();
      } catch { setShot(s => s && { ...s, status: 'Couldn’t read that image.' }); setErr('We couldn’t read that screenshot — try a sharper one, or paste the text.'); return; }
    }
    if (!out) { setShot(s => s && { ...s, status: 'No text found.' }); setErr('We didn’t find any text in that image.'); return; }
    setShot({ url, via, status: via === 'ai' ? 'Read by AI (Claude vision)' : 'Read on your device (OCR)' });
    setText(out); setAnswers({});
    await read({}, undefined, out);
  }
  useEffect(() => {
    if (tab !== 'shot') return;
    const onPaste = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); readImage(f); } };
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function read(extra?: Record<string, string>, mode?: 'cache', textOverride?: string) {
    setBusy(true); setErr('');
    const ans = { ...answers, ...(extra ?? {}) };
    try {
      const body = mode === 'cache' ? { mode: 'cache', answers: ans, profile: getState().profile }
        : tab === 'fields' ? { fields: { ...form, price_basis: form.price_basis || undefined }, answers: ans, profile: getState().profile }
        : { text: textOverride ?? text, answers: ans, profile: getState().profile };
      setR(await api<Resp>('/api/listings/extract', body));
    } catch { setErr('Something went wrong reading that — try the example below.'); }
    finally { setBusy(false); }
  }
  async function useExample() {
    const raw = await fetch('/api/listings/example').then(x => x.text()).catch(() => '');
    setTab('paste'); setText(raw); setAnswers({}); await read({}, 'cache');
  }
  const input = 'h-12 rounded-[12px] px-3.5 text-[16px] bg-white';
  const border = { border: '1px solid rgba(29,31,26,.14)' };

  return (
    <div className="relative min-h-screen px-4 pb-12 pt-4" style={{ background: C.bg }}>
      <div className="mx-auto flex max-w-[560px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/compare" aria-label="Back to compare" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white" style={{ boxShadow: SHADOW }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg></Link>
          <Link href="/" className="text-[15px] font-semibold no-underline" style={{ color: C.muted }}>Home</Link>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Bring any listing</h1>
          <p className="m-0 text-[17px] leading-[1.45]" style={{ color: C.muted }}>Found a place somewhere else? We’ll price it the same way. It stays private to you.</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
          {([['paste', 'Paste text'], ['shot', 'Screenshot'], ['fields', '4 fields']] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setR(null); setErr(''); }} aria-pressed={tab === k} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: tab === k ? '#FFFFFF' : 'transparent', color: tab === k ? C.ink : C.muted }}>{l}</button>
          ))}
        </div>

        {tab === 'paste' && <textarea aria-label="Listing text" value={text} onChange={e => setText(e.target.value)} placeholder="Select all on the listing page (Ctrl/Cmd + A), copy, and paste here." className="h-[150px] resize-none rounded-[12px] bg-white p-3.5 text-[16px] leading-[1.45]" style={border} />}
        {tab === 'shot' && (
          <div className="flex flex-col gap-2.5">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readImage(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) readImage(f); }}
              className="lift flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-white p-4 text-center text-[15px]" style={{ border: '2px dashed rgba(29,31,26,.2)', color: C.muted }}>
              {shot ? (<>
                <img src={shot.url} alt="Your screenshot" className="max-h-[220px] max-w-full rounded-[10px] object-contain" />
                <span className="text-[14px] font-semibold" style={{ color: shot.via ? C.good : C.indigo }}>{shot.status}</span>
                <span className="text-[13px]">Tap to choose a different screenshot</span>
              </>) : (<>
                <span className="text-[17px] font-semibold" style={{ color: C.indigo }}>Drop a screenshot, tap to choose one, or press ⌘V</span>
                <span>Zillow, Facebook Marketplace, a landlord’s site — anything with the rent on it.</span>
              </>)}
            </button>
            {shot?.via && text && (
              <details className="rounded-[12px] bg-white px-3.5 py-2.5 text-[14px]" style={{ border: '1px solid rgba(29,31,26,.14)' }}>
                <summary className="cursor-pointer font-semibold">Text we read — fix anything and re-read</summary>
                <textarea aria-label="Text read from screenshot" value={text} onChange={e => setText(e.target.value)} className="mt-2 h-[140px] w-full resize-none rounded-[10px] p-2.5 text-[15px] leading-[1.45]" style={{ border: '1px solid rgba(29,31,26,.14)' }} />
                <button onClick={() => { setAnswers({}); read({}); }} disabled={busy || !text.trim()} className="lift-sm mt-2 h-10 cursor-pointer rounded-full border-0 px-4 text-[14px] font-semibold text-white disabled:opacity-40" style={{ background: C.indigo }}>{busy ? 'Reading…' : 'Re-read'}</button>
              </details>
            )}
            <span className="text-center text-[13px]" style={{ color: C.muted }}>Emails and phone numbers are removed before anything is scored. The image isn’t stored.</span>
          </div>
        )}
        {tab === 'fields' && (
          <div className="grid grid-cols-2 gap-2.5">
            <input aria-label="Monthly rent" inputMode="numeric" placeholder="Rent ($ / month)" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value.replace(/[^\d]/g, '') })} className={input} style={border} />
            <input aria-label="Bedrooms" inputMode="numeric" placeholder="Bedrooms" value={form.beds} onChange={e => setForm({ ...form, beds: e.target.value.replace(/[^\d]/g, '') })} className={input} style={border} />
            <input aria-label="Address" placeholder="Address or street" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={`${input} col-span-2`} style={border} />
            <div className="col-span-2 grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: '#EDEAE3' }}>
              {([['per_bed', 'Per person'], ['per_unit', 'Whole place']] as const).map(([k, l]) => <button key={k} onClick={() => setForm({ ...form, price_basis: k })} className="h-10 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={{ background: form.price_basis === k ? '#FFFFFF' : 'transparent' }}>{l}</button>)}
            </div>
          </div>
        )}

        {tab !== 'shot' && (
          <div className="flex flex-col gap-2.5">
            <button onClick={() => { setAnswers({}); read({}); }} disabled={busy || (tab === 'paste' ? !text.trim() : !form.rent || !form.beds)} className="lift-sm h-[52px] cursor-pointer rounded-full border-0 text-[17px] font-semibold text-white disabled:opacity-40" style={{ background: C.indigo }}>{busy ? 'Reading…' : 'Read listing'}</button>
            <span className="text-center text-[13px]" style={{ color: C.muted }}>We only read what you paste. We never visit the site. Emails and phone numbers are removed first.</span>
            <button onClick={useExample} className="h-10 cursor-pointer self-center rounded-full border-0 bg-transparent px-3 text-[15px] font-semibold" style={{ color: C.indigo }}>Try the Example listing</button>
          </div>
        )}
        {err && <p className="m-0 text-[15px]" style={{ color: C.bad }}>{err}</p>}

        {r && (
          <div className="flex flex-col gap-1 rounded-[18px] bg-white p-5" style={{ boxShadow: SHADOW }}>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[17px] font-semibold">What we found</span>
              <span className="text-[12px]" style={{ color: C.muted }}>{{ ai: 'Read by AI · evidence checked', rules: 'Rule-based reader', cache: 'Example · pre-read', form: 'From your 4 fields' }[r.source]}{r.redactions ? ` · ${r.redactions} personal detail${r.redactions > 1 ? 's' : ''} removed` : ''}</span>
            </div>
            {r.fields.filter(f => f.status === 'Listed' || ['rent', 'price_basis', 'beds', 'address', 'fees', 'utilities_included'].includes(f.key)).map(f => (
              <div key={f.key} className="flex flex-col gap-0.5 py-2.5" style={{ borderTop: '1px solid rgba(29,31,26,.1)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex-1 text-[15px]" style={{ color: C.muted }}>{f.label}</span>
                  <span className="flex h-[22px] items-center rounded-full px-2 text-[12px] font-semibold" style={STATUS[f.status] ? { background: STATUS[f.status].bg, color: STATUS[f.status].fg } : undefined}>{f.status}</span>
                  <span className="tnum min-w-[72px] text-right text-[15px] font-semibold">{f.status === 'Unknown' ? 'Not on the listing' : fmt(f)}</span>
                </div>
                {f.evidence && <span className="text-[12px] italic" style={{ color: C.muted }}>“{f.evidence}”</span>}
              </div>
            ))}
            {r.note && <span className="pt-2 text-[12px]" style={{ color: C.muted }}>{r.note}</span>}

            {r.questions.length > 0 && r.questions.map(q => (
              <div key={q.key} className="mt-2 flex flex-col gap-2 rounded-[12px] p-3.5" style={{ background: C.lilac }}>
                <span className="text-[15px] font-semibold">{q.text}</span>
                <div className="flex flex-wrap gap-1.5">{q.options.map(o => <button key={o} onClick={() => { const a = { ...answers, [q.key]: o }; setAnswers(a); read(a, r.source === 'cache' ? 'cache' : undefined); }} className="h-9 cursor-pointer rounded-full border-0 bg-white px-3.5 text-[14px] font-semibold" style={{ boxShadow: SHADOW }}>{o}</button>)}</div>
              </div>
            ))}

            {r.rank && (
              <div className="mt-2 flex flex-col gap-2 rounded-[12px] p-3.5" style={{ background: '#F5F2EB' }}>
                <span className="text-[17px] font-semibold">{r.rank.rank ? `This would be your ${ordinal(r.rank.rank)} pick` : r.rank.reason}</span>
                <span className="text-[14px]" style={{ color: C.muted }}>{r.rank.rank ? `About $${r.rank.perPerson.toLocaleString('en-US')} rent per person${r.rank.minutes != null ? ` · ${r.rank.minutes} min each way` : ''} · area: ${r.hood} (Estimated). Scored against ${r.rank.of - 1} Example listings with your housing ID.` : 'Change your answers or ask the landlord about the missing details.'}</span>
                <div className="flex flex-wrap gap-2">
                  <Link href="/compare" className="flex h-10 items-center rounded-full px-4 text-[14px] font-semibold text-white no-underline" style={{ background: C.indigo }}>Back to compare</Link>
                  <button onClick={() => alert('Demo: we’d send the landlord an invite from you — never automatically.')} className="h-10 cursor-pointer rounded-full border-0 px-4 text-[14px] font-semibold" style={{ background: C.soft }}>Invite this landlord to list</button>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="m-0 text-center text-[12px]" style={{ color: C.muted }}>Private to you: never added to our search results, rankings or landlord lists. Facts only — no photos or descriptions are kept.</p>
      </div>
    </div>
  );
}
