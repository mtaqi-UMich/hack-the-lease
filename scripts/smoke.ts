import { step, applyUIAnswer, type Profile } from '../lib/session';
import { topAndBench, buildCards, benchNext } from '../lib/compare';
const t0 = Date.now();
let p: Profile = {};
const truth: Record<string, unknown> = { group: 'friend', mode: 'bus', base: 'North', budget: 1150, card: 'yes', deal: ['laundry'] };
for (let i = 0; i < 6; i++) {
  const s = step(p);
  console.log(`screen ${s.screen} conf ${(s.confidence*100).toFixed(1)}% next=${s.next?.id ?? '-'} done=${s.done} ${s.reason}`, Date.now() - t0, 'ms');
  if (s.done) break;
  p = applyUIAnswer(p, s.rawNext!, truth[s.rawNext!.id]);
}
const tb = topAndBench(p);
const cards = buildCards(tb.shown, p);
for (const c of cards) console.log(c.rank, c.tag, c.short, c.name, '$'+c.total, c.commute.minutes+'min', c.commute.label, '|', c.regret, '|', c.timeVsMoney, '|', c.badge.level, (c.pBest*100).toFixed(0)+'%');
console.log('bench', tb.bench);
const bn = benchNext(p, tb.shown, tb.shown[0], 'too_far');
console.log('X too_far ->', bn.replacement, bn.why, bn.note, bn.widened);
for (const base of ['Central', 'North'] as const) { const q = { ...p, base }; console.log(base, '→', buildCards(topAndBench(q).shown, q).map(c => c.short + ' ' + c.commute.minutes + 'm $' + c.total).join(' | ')); }
for (const budget of [1000, 1800]) { const q = { ...p, budget }; console.log(budget, '→', buildCards(topAndBench(q).shown, q).map(c => c.short + ' $' + c.total).join(' | ')); }
console.log('total', Date.now() - t0, 'ms');
