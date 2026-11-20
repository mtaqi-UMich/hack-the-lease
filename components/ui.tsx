'use client';
// Shared UI pieces ported from design/*.dc.html (SpendLess palette, pills for everything tappable).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useApp } from '@/lib/store';

export const SHADOW = '0 0.5px 1px rgba(29,31,26,.06), 0 3px 10px rgba(29,31,26,.08)';
export const C = { bg: '#FAF8F4', card: '#FFFFFF', ink: '#1D1F1A', muted: '#666666', indigo: '#5046F5', forest: '#224500', lime: '#A8F06B', cyan: '#B7F3F7', good: '#2F6B00', bad: '#B42318', listed: '#2F6B00', estimated: '#0A9BAA', unknown: '#B5AFA3', soft: '#F2EFE8', lilac: '#EEEDFE' };

export function initials(name: string) { return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

export function Nav() {
  const path = usePathname();
  const { name } = useApp();
  const icon = (href: string, label: string, svg: ReactNode) => (
    <Link href={href} aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: path === href ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.12)' }}>{svg}</Link>
  );
  return (
    <nav className="sticky top-3 z-20 mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-2 rounded-full pl-5 pr-2" style={{ background: C.forest, boxShadow: '0 10px 30px -12px rgba(34,69,0,.45)' }}>
      <Link href="/" className="text-[17px] font-semibold tracking-[-0.01em] text-white no-underline">Hack the Lease</Link>
      <div className="flex gap-1.5">
        {icon('/results', 'My matches', <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>)}
        {icon('/compare', 'Compare', <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="9.5" y="4" width="5" height="16" rx="1.5" /><rect x="16" y="4" width="5" height="16" rx="1.5" /></svg>)}
        <Link href="/id" aria-label="My housing ID" className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold no-underline" style={{ background: C.lime, color: C.forest }}>{initials(name)}</Link>
      </div>
    </nav>
  );
}

export function Page({ children, nav = true, width = 1080 }: { children: ReactNode; nav?: boolean; width?: number }) {
  return (
    <div className="relative min-h-screen px-4 pb-12 pt-3" style={{ background: C.bg }}>
      {nav && <Nav />}
      <main className="mx-auto mt-10 flex flex-col gap-6" style={{ maxWidth: width }}>{children}</main>
      <footer className="mx-auto mt-12 text-center text-[13px]" style={{ maxWidth: width, color: C.muted }}>
        All listings, landlords and student profiles are <b>Example</b> (synthetic) data. Commute times are Estimated from a synthetic timetable. Not legal advice.
      </footer>
    </div>
  );
}

export function ExampleTag({ text = 'Example data' }: { text?: string }) {
  return <span className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[13px] font-semibold" style={{ background: C.cyan, color: '#0A3D44' }}>{text}</span>;
}

export function Btn({ children, onClick, href, kind = 'primary', className = '', disabled, type }: { children: ReactNode; onClick?: () => void; href?: string; kind?: 'primary' | 'secondary' | 'soft' | 'ghost'; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  const style = kind === 'primary' ? { background: C.indigo, color: '#FFFFFF' } : kind === 'secondary' ? { background: '#FFFFFF', color: C.ink, boxShadow: SHADOW } : kind === 'soft' ? { background: C.soft, color: C.ink } : { background: 'transparent', color: C.indigo };
  const cls = `inline-flex h-[52px] items-center justify-center gap-2 rounded-full px-[22px] text-[17px] font-semibold no-underline transition-opacity disabled:opacity-40 cursor-pointer border-0 ${className}`;
  if (href) return <Link href={href} className={cls} style={style}>{children}</Link>;
  return <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className={cls} style={style}>{children}</button>;
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-[18px] bg-white ${className}`} style={{ boxShadow: SHADOW, ...style }}>{children}</div>;
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: 'rgba(29,31,26,.35)' }} onClick={onClose}>
      <div role="dialog" aria-label={title} className="flex w-full max-w-[560px] flex-col gap-3.5 rounded-t-[24px] bg-white px-5 pb-8 pt-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-bold tracking-[-0.02em]">{title}</span>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0" style={{ background: C.soft }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => { if (!text) return; const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [text, onDone]);
  if (!text) return null;
  return <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-[15px] font-semibold" style={{ background: C.forest, color: C.lime }}>{text}</div>;
}

export function ProvDot({ p }: { p?: 'Listed' | 'Estimated' | 'Unknown' }) {
  if (!p) return null;
  const col = p === 'Listed' ? C.listed : p === 'Estimated' ? C.estimated : C.unknown;
  return <span title={p} aria-label={p} className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: col }} />;
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1.5" aria-label={`Confidence ${pct}%`}>
      <div className="flex items-center justify-between text-[13px]"><span style={{ color: C.muted }}>{label ?? 'Chance your best place is in your top 3'}</span><span className="tnum font-semibold">{pct}%</span></div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#E3DFD6' }}><div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct >= 95 ? C.good : C.indigo }} /></div>
    </div>
  );
}

export const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');

export async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}
