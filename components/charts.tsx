'use client';
// Small dependency-free SVG charts. Palette validated (indigo #5046F5 + green #2F6B00 pass lightness, chroma, CVD and contrast).
// Thin 2px lines, ≥8px markers, recessive grid, legend + direct labels, hover tooltips, every chart has a table nearby.
import { useState } from 'react';

const INK = '#1D1F1A', MUTED = '#666666', GRID = 'rgba(29,31,26,.10)';
export const SERIES = ['#5046F5', '#2F6B00'];
export type Fmt = 'pct' | 'num1' | 'num2';
const F: Record<Fmt, (v: number) => string> = { pct: v => `${Math.round(v * 100)}%`, num1: v => v.toFixed(1), num2: v => v.toFixed(2) };

export interface Series { name: string; values: number[] }
export function LineChart({ x, series, yMin = 0, yMax = 1, format = 'pct', xLabel, height = 220, label }: {
  x: (number | string)[]; series: Series[]; yMin?: number; yMax?: number; format?: Fmt; xLabel: string; height?: number; label: string;
}) {
  const fmt = F[format];
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = height, L = 44, R = 92, T = 12, B = 34;
  const px = (i: number) => L + (i / Math.max(1, x.length - 1)) * (W - L - R);
  const py = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => yMin + t * (yMax - yMin));
  // end-of-line labels, nudged apart so they never collide (min 15px)
  const labelY = (() => {
    const ys = series.map((s, i) => ({ i, y: py(s.values[s.values.length - 1]) + 4 })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < ys.length; k++) if (ys[k].y - ys[k - 1].y < 15) ys[k].y = ys[k - 1].y + 15;
    const out: number[] = []; ys.forEach(o => { out[o.i] = o.y; }); return out;
  })();
  return (
    <div className="flex flex-col gap-2">
      {series.length > 1 && <div className="flex flex-wrap gap-4 text-[13px]" style={{ color: MUTED }}>{series.map((s, i) => <span key={s.name} className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-4 rounded" style={{ background: SERIES[i] }} />{s.name}</span>)}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke={GRID} /><text x={L - 6} y={py(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{fmt(t)}</text></g>)}
        {x.map((v, i) => <text key={i} x={px(i)} y={H - B + 16} textAnchor="middle" fontSize="11" fill={MUTED}>{v}</text>)}
        <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" fontSize="11" fill={MUTED}>{xLabel}</text>
        {hover != null && <line x1={px(hover)} x2={px(hover)} y1={T} y2={H - B} stroke={GRID} strokeWidth={1.5} />}
        {series.map((s, si) => (
          <g key={s.name}>
            <polyline fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" points={s.values.map((v, i) => `${px(i)},${py(v)}`).join(' ')} />
            {s.values.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r={hover === i ? 5 : 4} fill={SERIES[si]} stroke="#FFFFFF" strokeWidth={2} />)}
            <text x={W - R + 8} y={labelY[si]} fontSize="12" fill={INK}>{s.name}</text>
          </g>
        ))}
        {x.map((_, i) => <rect key={i} x={px(i) - (W - L - R) / (2 * Math.max(1, x.length - 1))} y={T} width={(W - L - R) / Math.max(1, x.length - 1)} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        {hover != null && (() => {
          const bx = Math.min(px(hover) + 8, W - R - 120);
          return <g pointerEvents="none"><rect x={bx} y={T + 2} width={128} height={18 + series.length * 16} rx={8} fill="#FFFFFF" stroke={GRID} />
            <text x={bx + 8} y={T + 16} fontSize="11" fill={MUTED}>{xLabel} {x[hover]}</text>
            {series.map((s, si) => <text key={s.name} x={bx + 8} y={T + 32 + si * 16} fontSize="12" fill={INK}><tspan fill={SERIES[si]}>●</tspan> {fmt(s.values[hover])}</text>)}</g>;
        })()}
      </svg>
    </div>
  );
}

export function BarList({ rows, format = 'pct', max = 1, label }: { rows: { name: string; value: number; note?: string; muted?: boolean }[]; format?: Fmt; max?: number; label: string }) {
  const fmt = F[format];
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label={label}>
      {rows.map((r, i) => (
        <div key={r.name} role="listitem" className="grid items-center gap-3 rounded-[8px] px-1 py-0.5 text-[13px]" style={{ gridTemplateColumns: 'minmax(120px, 210px) 1fr 52px', background: hover === i ? 'rgba(29,31,26,.04)' : undefined }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} title={r.note ? `${r.name}: ${fmt(r.value)} — ${r.note}` : `${r.name}: ${fmt(r.value)}`}>
          <span style={{ color: INK }}>{r.name}</span>
          <div className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: r.muted ? '#C9C4BA' : SERIES[0] }} />
          <span className="tnum text-right font-semibold" style={{ color: INK }}>{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Reliability({ bins }: { bins: { lo: number; hi: number; n: number; meanConf: number; hitRate: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const S = 260, P = 34;
  const p = (v: number) => P + v * (S - 2 * P);
  const q = (v: number) => S - P - v * (S - 2 * P);
  const maxN = Math.max(...bins.map(b => b.n));
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[320px]" role="img" aria-label="Reliability diagram: confidence shown versus actual top-3 hit rate" onMouseLeave={() => setHover(null)}>
      {[0, 0.5, 1].map(t => <g key={t}><line x1={p(0)} x2={p(1)} y1={q(t)} y2={q(t)} stroke={GRID} /><text x={P - 6} y={q(t) + 4} textAnchor="end" fontSize="10" fill={MUTED}>{t * 100}%</text><text x={p(t)} y={S - P + 14} textAnchor="middle" fontSize="10" fill={MUTED}>{t * 100}%</text></g>)}
      <line x1={p(0)} y1={q(0)} x2={p(1)} y2={q(1)} stroke={MUTED} strokeDasharray="4 4" />
      <text x={p(0.62)} y={q(0.5)} fontSize="10" fill={MUTED}>perfect calibration</text>
      {bins.map((b, i) => <circle key={i} cx={p(b.meanConf)} cy={q(b.hitRate)} r={4 + 6 * Math.sqrt(b.n / maxN)} fill={SERIES[0]} fillOpacity={0.85} stroke="#FFFFFF" strokeWidth={2} onMouseEnter={() => setHover(i)} />)}
      <text x={S / 2} y={S - 4} textAnchor="middle" fontSize="10" fill={MUTED}>confidence shown</text>
      <text x={10} y={S / 2} textAnchor="middle" fontSize="10" fill={MUTED} transform={`rotate(-90 10 ${S / 2})`}>actually right</text>
      {hover != null && <g pointerEvents="none"><rect x={P + 4} y={P - 26} width={190} height={22} rx={6} fill="#FFFFFF" stroke={GRID} /><text x={P + 12} y={P - 11} fontSize="11" fill={INK}>shown {Math.round(bins[hover].meanConf * 100)}% · right {Math.round(bins[hover].hitRate * 100)}% · n={bins[hover].n}</text></g>}
    </svg>
  );
}
