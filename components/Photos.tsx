'use client';
// Swipeable photo carousel for a listing: exterior → living → kitchen → bedroom → bath → floor plan.
// Listings are Example data, so photos are illustrative stock photos (Unsplash licence), picked
// deterministically from the listing id so a place always shows the same set.
import { useRef, useState, type ReactNode } from 'react';

const SETS = { ext: 10, living: 13, kitchen: 6, bed: 5, bath: 3 } as const;
type Kind = keyof typeof SETS;
const SLIDES: { kind: Kind | 'plan'; label: string }[] = [
  { kind: 'ext', label: 'Outside' }, { kind: 'living', label: 'Living room' }, { kind: 'kitchen', label: 'Kitchen' },
  { kind: 'bed', label: 'Bedroom' }, { kind: 'bath', label: 'Bathroom' }, { kind: 'plan', label: 'Layout' },
];

function hash(s: string) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
const photo = (id: string, kind: Kind) => `/photos/${kind}-${(hash(id + kind) % SETS[kind]) + 1}.jpg`;
const bedsOf = (short: string) => { const m = short.match(/(\d+)\s*BR/i); return m ? Math.min(6, Number(m[1])) : 0; };

/** Simple schematic floor plan sized to the bedroom count (illustrative, not to scale). */
function FloorPlan({ beds }: { beds: number }) {
  const n = Math.max(1, beds);
  const W = 400, H = 240, P = 14, line = '#1D1F1A';
  const roomW = (W - 2 * P) / Math.max(n, 2);
  const label = (x: number, y: number, t: string) => <text x={x} y={y} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1D1F1A" fontFamily="-apple-system,Helvetica,Arial,sans-serif">{t}</text>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" style={{ background: '#FBFAF6' }} aria-label={`${beds ? `${beds}-bedroom` : 'Studio'} floor plan`}>
      <rect x={P} y={P} width={W - 2 * P} height={H - 2 * P} fill="#FFFFFF" stroke={line} strokeWidth="4" />
      {beds === 0 ? (<>
        <line x1={W * 0.68} y1={P} x2={W * 0.68} y2={H * 0.45} stroke={line} strokeWidth="2.5" />
        <line x1={W * 0.68} y1={H * 0.45} x2={W - P} y2={H * 0.45} stroke={line} strokeWidth="2.5" />
        {label(W * 0.34, H * 0.52, 'Studio · living + sleep')}{label(W * 0.84, H * 0.27, 'Bath')}
        <rect x={P + 10} y={H - P - 34} width={110} height={24} fill="#F2EFE8" />{label(P + 65, H - P - 17, 'Kitchen')}
      </>) : (<>
        <line x1={P} y1={H * 0.5} x2={W - P} y2={H * 0.5} stroke={line} strokeWidth="2.5" />
        {Array.from({ length: n - 1 }, (_, i) => <line key={i} x1={P + roomW * (i + 1)} y1={P} x2={P + roomW * (i + 1)} y2={H * 0.5} stroke={line} strokeWidth="2.5" />)}
        {Array.from({ length: n }, (_, i) => <g key={i}>{label(P + roomW * i + roomW / 2, H * 0.28, `Bed ${i + 1}`)}</g>)}
        {n === 1 && <>{label(P + roomW * 1.5, H * 0.28, 'Bath')}<line x1={P + roomW} y1={P} x2={P + roomW} y2={H * 0.5} stroke={line} strokeWidth="2.5" /></>}
        {n > 1 && <><line x1={W * 0.74} y1={H * 0.5} x2={W * 0.74} y2={H - P} stroke={line} strokeWidth="2.5" />{label(W * 0.87, H * 0.76, 'Bath')}</>}
        {label(n > 1 ? W * 0.38 : W * 0.5, H * 0.76, 'Living + kitchen')}
      </>)}
    </svg>
  );
}

export function PhotoCarousel({ id, short, className = '', rounded = 0, stock = true, children }: { id: string; short: string; className?: string; rounded?: number; stock?: boolean; children?: ReactNode }) {
  // a listing the student brought has no photos of ours — show only its layout, never stock photos
  const slides = stock ? SLIDES : SLIDES.filter(x => x.kind === 'plan');
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);
  const n = slides.length;
  const go = (d: number) => setI(x => (x + d + n) % n);
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  const s = slides[Math.min(i, n - 1)];
  return (
    <div className={`group relative overflow-hidden ${className}`} style={{ borderRadius: rounded, background: '#EDEAE3' }}
      onPointerDown={e => { startX.current = e.clientX; }}
      onPointerUp={e => { if (startX.current == null) return; const dx = e.clientX - startX.current; startX.current = null; if (Math.abs(dx) > 40) { swiped.current = true; go(dx < 0 ? 1 : -1); } }}
      onClickCapture={e => { if (swiped.current) { swiped.current = false; stop(e); } }}>
      <div className="flex h-full w-full transition-transform duration-500" style={{ transform: `translateX(-${i * 100}%)`, transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}>
        {slides.map((sl, k) => (
          <div key={sl.kind} className="h-full w-full flex-none">
            {sl.kind === 'plan' ? <FloorPlan beds={bedsOf(short)} />
              : <img src={photo(id, sl.kind)} alt={`${short} — ${sl.label.toLowerCase()} (illustrative photo)`} loading={k === 0 ? 'eager' : 'lazy'} draggable={false} className="h-full w-full select-none object-cover" />}
          </div>
        ))}
      </div>
      {children}
      {n > 1 && <>
      <button data-nav aria-label="Previous photo" onClick={e => { stop(e); go(-1); }} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100" style={{ boxShadow: '0 2px 8px rgba(29,31,26,.18)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button data-nav aria-label="Next photo" onClick={e => { stop(e); go(1); }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-white/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100" style={{ boxShadow: '0 2px 8px rgba(29,31,26,.18)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D1F1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      </>}
      {n > 1 && <div aria-label={`${s.label}, photo ${i + 1} of ${n}`} className="pointer-events-none absolute bottom-[13px] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/35 px-1.5 py-1">
        {slides.map((sl, k) => <span key={sl.kind} className="h-1.5 rounded-full transition-all duration-300" style={{ width: k === i ? 12 : 5, background: k === i ? '#FFFFFF' : 'rgba(255,255,255,.55)' }} />)}
      </div>}
    </div>
  );
}
