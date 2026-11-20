import { NextResponse } from 'next/server';
import { buildCards, topAndBench } from '@/lib/compare';
import { decodeProfile } from '@/lib/wire';
import { rankAll } from '@/lib/session';

// GET /api/compare?ids=a,b,c&p=<profile>   (no ids → our top 3 + bench)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const profile = decodeProfile(url.searchParams.get('p'));
  const idsParam = url.searchParams.get('ids');
  const rk = rankAll(profile);
  const ctx = { student: rk.student, pBest: new Map(rk.rows.map(x => [x.id, x.p])), utility: new Map(rk.rows.map(x => [x.id, x.ev?.u ?? null])) };
  let ids: string[]; let bench: string[] = [];
  if (idsParam) ids = idsParam.split(',').filter(Boolean).slice(0, 3);
  else { const tb = topAndBench(profile); ids = tb.shown; bench = tb.bench; }
  const cards = buildCards(ids, profile, ctx);
  const benchCards = bench.length ? buildCards(bench, profile, ctx).map(c => ({ id: c.id, short: c.short, total: c.total, commute: c.commute.minutes })) : [];
  return NextResponse.json({
    cards, bench, bench_cards: benchCards, confidence: rk.conf,
    alpha: Math.round(rk.student.alpha), alpha_range: rk.alphaRange.map(Math.round),
    student: { base: rk.student.base, mode: rk.student.mode, group: rk.student.group, budget: Math.round(rk.student.budget), parking: rk.student.parking },
    considered: rk.engine.listings.length, example: true,
    weights: (() => { const ev = rk.rows.find(r => r.id === ids[0])?.ev; if (!ev) return null; const parts = { Cost: ev.cost, Commute: ev.timeCost, Quality: ev.qualityValue, Extras: Math.max(0, ev.bonus - ev.qualityValue) }; const tot = Object.values(parts).reduce((a, b) => a + Math.abs(b), 0); return Object.entries(parts).map(([label, v]) => ({ label, pct: Math.round(Math.abs(v) / tot * 100) })); })(),
  });
}
