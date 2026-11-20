import Link from 'next/link';
import a from '@/reports/analysis.json';
import v from '@/reports/validation.json';
import { Page } from '@/components/ui';
import { LineChart, BarList, Reliability } from '@/components/charts';

const C = { ink: '#1D1F1A', muted: '#666666', good: '#2F6B00', bad: '#B42318', lime: '#A8F06B', forest: '#224500', soft: '#F2EFE8', indigo: '#5046F5' };
const SH = '0 0.5px 1px rgba(29,31,26,.06), 0 3px 10px rgba(29,31,26,.08)';
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const pv = (p: number) => (p < 1e-15 ? '< 10⁻¹⁵' : p < 1e-4 ? p.toExponential(1) : p.toFixed(3));

function Card({ title, children, sub }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[18px] bg-white p-5" style={{ boxShadow: SH }}>
      <div className="flex flex-col gap-0.5"><h2 className="m-0 text-[19px] font-bold tracking-[-0.02em]">{title}</h2>{sub && <span className="text-[14px]" style={{ color: C.muted }}>{sub}</span>}</div>
      {children}
    </section>
  );
}
function Stat({ value, label }: { value: string; label: string }) {
  return <div className="flex flex-col gap-0.5 rounded-[18px] bg-white p-4" style={{ boxShadow: SH }}><span className="tnum text-[28px] font-bold tracking-[-0.02em]">{value}</span><span className="text-[13px]" style={{ color: C.muted }}>{label}</span></div>;
}

export default function Analysis() {
  const mcRef = a.monteCarlo.find(m => m.particles === a.particles)!;
  const register = [
    { q: 'Do we find the true best?', h0: 'Top-3 accuracy ≤ 95%', test: 'Exact binomial, one-sided', stat: `${pct(a.H1.p)} (CI ${pct(a.H1.lo)}–${pct(a.H1.hi)})`, p: a.H1.pOneSidedVs95, want: 'reject' },
    { q: 'Does question order matter?', h0: 'Adaptive = fixed order at equal taps', test: 'McNemar (paired)', stat: `b=${a.mcnemar.b}, c=${a.mcnemar.c}; Δ ${pct(a.diffBootstrap.estimate)}`, p: a.mcnemar.p, want: 'reject' },
    { q: 'Do optional questions help?', h0: 'Top-1 unchanged after Sharpen', test: 'McNemar (paired)', stat: `${pct(v.H2.top1_before.p)} → ${pct(v.H2.top1_after.p)}`, p: v.H2.mcnemar_top1.p, want: 'reject' },
    { q: 'Is the meter honest?', h0: 'Confidence is calibrated', test: 'Hosmer–Lemeshow + ECE', stat: `χ²=${a.calibration.hosmerLemeshow.chi2.toFixed(1)}, ECE ${(a.calibration.ece * 100).toFixed(1)} pts`, p: a.calibration.hosmerLemeshow.p, want: 'keep' },
    { q: 'Are gain forecasts right?', h0: 'Realized − predicted bits = 0', test: 'Paired t-test', stat: `mean ${a.gain.diffTest.mean.toFixed(3)} bits, r=${a.gain.correlation.toFixed(2)}`, p: a.gain.diffTest.p, want: 'keep' },
    { q: 'Do trade-off cards learn α?', h0: 'α error unchanged by cards', test: 'Wilcoxon signed-rank', stat: `×${a.alpha.medianErrorFactorBefore.toFixed(2)} → ×${a.alpha.medianErrorFactorAfter.toFixed(2)}`, p: a.alpha.test.p, want: 'reject' },
    { q: 'Does the pick respond to real change?', h0: 'Flip rate (budget −$250) = flip rate (+$10)', test: 'Two-proportion z', stat: `z = ${a.sensitivityTest.z.toFixed(1)}`, p: a.sensitivityTest.p, want: 'reject' },
  ];
  return (
    <Page>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold" style={{ color: C.muted }}>Engineering & statistics · {a.n.toLocaleString('en-US')} simulated students · Example data</span>
        <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Why 5 taps are enough</h1>
        <p className="m-0 max-w-[760px] text-[17px]" style={{ color: C.muted }}>A Bayesian model of {a.particles.toLocaleString('en-US')} possible students, updated after every answer. Each screen asks the question that removes the most uncertainty about which listing is your best; we stop when the true best is {Math.round(a.tau * 100)}% likely to be in your top 3. Summary results are on <Link href="/evidence" className="underline">/evidence</Link>; the full write-up is <code>docs/ANALYSIS.md</code>.</p>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
        <Stat value={`${a.initialEntropy.toFixed(1)} bits`} label={`starting uncertainty (≈ ${Math.round(2 ** a.initialEntropy)} equally likely places)`} />
        <Stat value={`${a.gain.meanRealized.toFixed(2)} bits`} label="removed per screen, on average" />
        <Stat value={pct(a.H1.p)} label={`true best in top 3 after ${a.avgScreens.toFixed(1)} taps`} />
        <Stat value={`${(a.calibration.ece * 100).toFixed(1)} pts`} label="confidence-meter error (ECE)" />
        <Stat value={`${a.engineering.stepMsP95.toFixed(0)} ms`} label="p95 time per engine step" />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
        <Card title="Accuracy after each screen" sub="Share of students whose true best is in our top 3 — adaptive order vs a normal fixed form, same number of taps">
          <LineChart label="Top-3 accuracy by screen, adaptive vs fixed order" x={a.trajectory.map(t => t.k)} xLabel="screen" series={[{ name: 'Adaptive', values: a.trajectory.map(t => t.adaptiveTop3) }, { name: 'Fixed order', values: a.trajectory.map(t => t.fixedTop3) }]} />
        </Card>
        <Card title="Uncertainty left after each screen" sub="Mean entropy of “which listing is best”, in bits (1 bit = a coin flip)">
          <LineChart label="Mean entropy by screen" x={a.trajectory.map(t => t.k)} xLabel="screen" yMax={Math.ceil(a.initialEntropy)} format="num1" series={[{ name: 'Entropy', values: a.trajectory.map(t => t.meanEntropyBits) }]} />
        </Card>
      </div>

      <Card title="Hypothesis register" sub="Each claim stated as a null hypothesis and tested on the simulated cohort">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}>{['Question', 'H0', 'Test', 'Result', 'p', 'Decision'].map(h => <th key={h} className="py-2 pr-3 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody>{register.map(r => {
              const rejected = r.p < 0.05; const good = r.want === 'reject' ? rejected : !rejected;
              return (
                <tr key={r.q} style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}>
                  <td className="py-2.5 pr-3 font-semibold">{r.q}</td><td className="py-2.5 pr-3">{r.h0}</td><td className="py-2.5 pr-3" style={{ color: C.muted }}>{r.test}</td>
                  <td className="tnum py-2.5 pr-3">{r.stat}</td><td className="tnum whitespace-nowrap py-2.5 pr-3">{pv(r.p)}</td>
                  <td className="py-2.5"><span className="inline-flex h-[24px] items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold" style={{ background: good ? C.lime : '#FFF4DF', color: good ? C.forest : '#9A5B00' }}>{rejected ? 'Reject H0' : 'Keep H0'}{good ? ' ✓' : ' — see note'}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <span className="text-[13px]" style={{ color: C.muted }}>For calibration and gain forecasts, keeping H0 is the good outcome. Significance level 0.05. Hosmer–Lemeshow is very sensitive at this sample size, so read it together with the ECE.</span>
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
        <Card title="Choosing the stopping threshold τ" sub="Each point is a policy: average taps vs accuracy. We ship τ = 0.95 with a 5-screen cap">
          <div className="overflow-x-auto"><table className="w-full border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}><th className="py-1.5 text-left font-semibold">τ</th><th className="py-1.5 text-right font-semibold">Avg taps</th><th className="py-1.5 text-right font-semibold">Top-3 (95% CI)</th><th className="py-1.5 text-right font-semibold">Top-1</th></tr></thead>
            <tbody>{a.tauSweep.map(t => <tr key={t.tau} style={{ borderTop: '1px solid rgba(29,31,26,.08)', fontWeight: t.tau === a.tau ? 700 : 400, color: t.tau === a.tau ? C.indigo : C.ink }}><td className="py-1.5">{t.tau}</td><td className="tnum py-1.5 text-right">{t.avgScreens.toFixed(2)}</td><td className="tnum py-1.5 text-right">{pct(t.top3.p)} ({pct(t.top3.lo, 0)}–{pct(t.top3.hi, 0)})</td><td className="tnum py-1.5 text-right">{pct(t.top1)}</td></tr>)}</tbody>
          </table></div>
          <span className="text-[13px]" style={{ color: C.muted }}>Raising the cap above 5 changes almost nothing: {pct(a.capSweep[4].top3.p)} at 5 vs {pct(a.capSweep[7].top3.p)} at 8.</span>
        </Card>
        <Card title="Is the confidence meter honest?" sub={`When we say X% sure, are we right X% of the time? ECE ${(a.calibration.ece * 100).toFixed(1)} points; Brier skill ${pct(a.calibration.brierSkill, 0)}`}>
          <div className="flex flex-wrap items-center gap-4">
            <Reliability bins={a.calibration.bins.filter(b => b.n > 0)} />
            <table className="min-w-[200px] flex-1 border-collapse text-[13px]"><thead><tr style={{ color: C.muted }}><th className="text-left font-semibold">Shown</th><th className="text-right font-semibold">n</th><th className="text-right font-semibold">Right</th></tr></thead>
              <tbody>{a.calibration.bins.filter(b => b.n > 0).map(b => <tr key={b.lo} style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}><td>{pct(b.meanConf, 0)}</td><td className="tnum text-right">{b.n}</td><td className="tnum text-right">{pct(b.hitRate, 0)}</td></tr>)}</tbody></table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
        <Card title="Does the predicted gain come true?" sub={`Bits each question was expected to remove vs what it actually removed (r = ${a.gain.correlation.toFixed(2)})`}>
          <BarList label="Realized information gain by question" max={Math.max(...a.gain.byQuestion.map(g => g.realized ?? 0))} format="num2" rows={a.gain.byQuestion.filter(g => g.n).map(g => ({ name: `${({ group: 'Who you live with', deal: 'Must-haves', budget: 'Budget', base: 'Campus', mode: 'Getting around', card: 'Trade-off card' } as Record<string, string>)[g.q]} (n=${g.n})`, value: g.realized!, note: `predicted ${g.expected!.toFixed(2)} bits` }))} />
          <span className="text-[13px]" style={{ color: C.muted }}>{a.distinctOrders} different question orders were used across {a.n.toLocaleString('en-US')} students. Questions worth under 0.03 bits are never asked (smallest shown: {a.gain.minGainShown.toFixed(3)}).</span>
        </Card>
        <Card title="Big changes move the pick; tiny ones don’t" sub="Share of students whose #1 changes when one thing about them changes">
          <BarList label="Decision flip rate by input change" rows={a.sensitivity.map(s => ({ name: s.name, value: s.rate, muted: !s.meaningful }))} />
          <span className="text-[13px]" style={{ color: C.muted }}>Grey = noise-sized changes. What drives the #1 pick: rent {pct(a.utilityShares.rent, 0)}, commute time {pct(a.utilityShares.commuteTime, 0)}, quality {pct(a.utilityShares.quality, 0)}, over-budget penalty {pct(a.utilityShares.overBudgetPenalty, 0)}, extras {pct(a.utilityShares.extras, 0)}.</span>
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
        <Card title="Engineering: is the particle filter big enough?" sub={`Monte Carlo error falls as N^${a.mcSlope.toFixed(2)} (theory −0.5)`}>
          <table className="w-full border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}><th className="py-1.5 text-left font-semibold">Particles</th><th className="py-1.5 text-right font-semibold">Meter wobble</th><th className="py-1.5 text-right font-semibold">#1 matches 20k reference</th><th className="py-1.5 text-right font-semibold">ms / step</th></tr></thead>
            <tbody>{a.monteCarlo.map(m => <tr key={m.particles} style={{ borderTop: '1px solid rgba(29,31,26,.08)', fontWeight: m.particles === a.particles ? 700 : 400, color: m.particles === a.particles ? C.indigo : C.ink }}><td className="py-1.5">{m.particles.toLocaleString('en-US')}</td><td className="tnum py-1.5 text-right">±{(m.sdOfConfidence * 100).toFixed(1)} pts</td><td className="tnum py-1.5 text-right">{pct(m.top1AgreesWithReference, 0)}</td><td className="tnum py-1.5 text-right">{m.msPerStep.toFixed(0)}</td></tr>)}</tbody>
          </table>
          <span className="text-[13px]" style={{ color: C.muted }}>At {a.particles.toLocaleString('en-US')} particles the meter wobbles ±{(mcRef.sdOfConfidence * 100).toFixed(1)} points between random seeds; we fix the seed so the same answers always give the same result. Effective sample size after reweighting stays at {pct(a.engineering.essShare, 0)} of particles on average (minimum {a.engineering.essMin.toFixed(0)}), so the weights never collapse.</span>
        </Card>
        <Card title="Neutral marketplace" sub={`Landlord is not an input. Shuffling landlord labels across all listings changed ${a.landlordPermutationChanges} of ${a.n} #1 picks`}>
          <table className="w-full border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}><th className="py-1.5 text-left font-semibold">Landlord (fictional)</th><th className="py-1.5 text-right font-semibold">Listings</th><th className="py-1.5 text-right font-semibold">#1 picks</th></tr></thead>
            <tbody>{a.landlordTable.map(l => <tr key={l.landlord} style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}><td className="py-1.5">{l.landlord}</td><td className="tnum py-1.5 text-right">{pct(l.inventoryShare)}</td><td className="tnum py-1.5 text-right">{pct(l.top1Share)}</td></tr>)}</tbody>
          </table>
          <span className="text-[13px]" style={{ color: C.muted }}>Differences in #1 share come from location, price and features — Hackberry Lane gets no boost.</span>
        </Card>
      </div>

      <section className="flex flex-col gap-2 rounded-[18px] p-5" style={{ background: C.soft }}>
        <h2 className="m-0 text-[19px] font-bold">Assumptions we’re upfront about</h2>
        <ul className="m-0 flex flex-col gap-1 pl-5 text-[15px]">
          <li>The priors (campus mix, budgets, value of time, amenity rates) are invented; shifting them ±20% still gives 97–99% top-3 (see /evidence).</li>
          <li>“True best” means best under our utility function: −rent − value of time × commute hours + quality + amenity bonuses − 4 × over-budget.</li>
          <li>We prove the algorithm finds what the model says is best. Whether the model matches real students needs the survey and hallway test.</li>
          <li>Power: {a.power.nNeeded_95vs98} students are enough to tell 98% from 95% (α .05, power .8); we ran {a.n.toLocaleString('en-US')}.</li>
        </ul>
        <span className="text-[12px]" style={{ color: C.muted }}>Generated {new Date(a.generated_at).toLocaleString('en-US')} · reproduce with <code>npx tsx scripts/analysis.ts</code></span>
      </section>
    </Page>
  );
}
