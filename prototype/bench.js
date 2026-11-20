const H = require('./engine.js');
const N = +process.argv[2] || 100;
const eng = H.createEngine({ poolSize: 1500 });
const L = eng.listings;
const rng = H.mulberry32(999);
let tot = { clicks: 0, top1: 0, top3: 0, s5top1: 0, s5top3: 0, full17: 0 };
const clickHist = {};
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const truth = H.sampleStudent(rng, {}).s;
  const trueBest = eng.bestListing(truth, L);
  const r = H.runAdaptive(eng, truth);
  const top = r.st.rank.map(x => x.idx);
  tot.clicks += r.clicks; clickHist[r.clicks] = (clickHist[r.clicks] || 0) + 1;
  if (top[0] === trueBest) tot.top1++;
  if (top.slice(0, 3).includes(trueBest)) tot.top3++;
  const s = H.runStatic(eng, truth, Math.max(1, r.clicks));
  const ts = s.st.rank.map(x => x.idx);
  if (ts[0] === trueBest) tot.s5top1++;
  if (ts.slice(0, 3).includes(trueBest)) tot.s5top3++;
}
console.log('n', N, 'ms', Date.now() - t0);
console.log('avg clicks', (tot.clicks / N).toFixed(2), clickHist);
console.log('adaptive top1', tot.top1 / N, 'top3', tot.top3 / N);
console.log('static same clicks top1', tot.s5top1 / N, 'top3', tot.s5top3 / N);
console.log('listings', L.length, 'beds', L.map(l => l.beds + ':' + l.rent + ':' + l.hood.slice(0, 6)).join(' '));
