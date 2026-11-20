import Link from 'next/link';
import report from '@/reports/validation.json';
import { Page } from '@/components/ui';

const C = { ink: '#1D1F1A', muted: '#666666', good: '#2F6B00', bad: '#B42318', lime: '#A8F06B', forest: '#224500', soft: '#F2EFE8', indigo: '#5046F5' };
const SH = '0 0.5px 1px rgba(29,31,26,.06), 0 3px 10px rgba(29,31,26,.08)';
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
type W = { p: number; lo: number; hi: number };
const ci = (w: W) => `${pct(w.lo)}–${pct(w.hi)}`;

function Claim({ id, title, result, bar, pass, children }: { id: string; title: string; result: string; bar: string; pass: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-white p-5" style={{ boxShadow: SH }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col"><span className="text-[13px] font-semibold" style={{ color: C.muted }}>{id}</span><span className="text-[19px] font-bold tracking-[-0.02em]">{title}</span></div>
        <span className="flex h-[26px] flex-none items-center rounded-full px-2.5 text-[13px] font-semibold" style={{ background: pass ? C.lime : '#FDE7E5', color: pass ? C.forest : C.bad }}>{pass ? 'Pass' : 'Not met'}</span>
      </div>
      <span className="tnum text-[28px] font-bold tracking-[-0.02em]">{result}</span>
      <span className="text-[14px]" style={{ color: C.muted }}>Bar: {bar}</span>
      {children}
    </div>
  );
}

export default function Evidence() {
  const r = report;
  const bins = r.H4.all_steps.bins.filter(b => b.n > 0);
  return (
    <Page>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">How we know it works</h1>
        <p className="m-0 max-w-[720px] text-[17px]" style={{ color: C.muted }}>{r.n.toLocaleString('en-US')} simulated students, each with a full hidden profile, answer our ≤ 5 adaptive screens. We check whether the place their <i>full</i> profile says is best lands in our top 3. All students and listings are Example (synthetic) data.</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        <Claim id="H1" title="Same answer as the long form" result={pct(r.H1.top3.p)} bar="≥ 95% of students’ true best in our top 3" pass={r.H1.pass}>
          <span className="text-[14px]">95% CI {ci(r.H1.top3)} (Wilson) · top-1 {pct(r.H1.top1.p)} · {r.H1.avg_clicks.toFixed(1)} screens on average vs 17 on Apartment List</span>
        </Claim>
        <Claim id="H2" title="Optional questions help" result={`${pct(r.H2.top1_before.p)} → ${pct(r.H2.top1_after.p)}`} bar="top-1 rises, top-3 doesn’t drop" pass={r.H2.pass}>
          <span className="text-[14px]">Top-1 match with up to 3 “Sharpen my matches” questions (+{r.H2.avg_optional_clicks.toFixed(1)} on average). Top-3: {pct(r.H2.top3_before.p)} → {pct(r.H2.top3_after.p)}.</span>
        </Claim>
        <Claim id="H3" title="The order of questions matters" result={`${pct(r.H3.adaptive_top3.p)} vs ${pct(r.H3.fixed_top3_same_clicks.p)}`} bar="adaptive beats a fixed order, McNemar p < 0.05" pass={r.H3.pass}>
          <span className="text-[14px]">Same students, same number of screens. McNemar: adaptive-only hits {r.H3.mcnemar.b}, fixed-only hits {r.H3.mcnemar.c}, p = {r.H3.mcnemar.p.toExponential(1)}. A fixed order needs all 5 screens to reach {pct(r.H3.fixed_top3_5_screens.p)}.</span>
        </Claim>
        <Claim id="H4" title="The confidence meter is honest" result={`${r.H4.ece_points.toFixed(1)} points`} bar="expected calibration error ≤ 5 points" pass={r.H4.pass}>
          <span className="text-[14px]">When the meter says “90% sure”, are we right about 90% of the time? Measured over every screen of every student.</span>
        </Claim>
      </div>

      <section className="flex flex-col gap-3 rounded-[18px] bg-white p-5" style={{ boxShadow: SH }}>
        <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">What if…? The decision changes when one input changes</h2>
        <p className="m-0 text-[15px]" style={{ color: C.muted }}>Baseline student: 2 people, classes on Central Campus, takes the bus, $1,150 each. Each row changes one thing.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}><th className="py-2 pr-3 text-left font-semibold">Change</th><th className="py-2 pr-3 text-left font-semibold">#1</th><th className="py-2 pr-3 text-left font-semibold">#2</th><th className="py-2 text-left font-semibold">#3</th></tr></thead>
            <tbody>{r.whatIf.map((w, i) => (
              <tr key={w.label} style={{ borderTop: '1px solid rgba(29,31,26,.08)', background: i === 0 ? '#FAF8F4' : undefined }}>
                <td className="py-2.5 pr-3 font-semibold">{w.label}</td>
                {w.top.map((t, j) => {
                  const changed = i > 0 && j === 0 && t.id !== r.whatIf[0].top[0].id;
                  return <td key={t.id} className="py-2.5 pr-3"><span className="font-semibold" style={{ color: changed ? C.indigo : C.ink }}>{t.short}{changed ? ' ●' : ''}</span><br /><span style={{ color: C.muted }}>${t.total.toLocaleString('en-US')} · {t.minutes} min {t.mode}</span></td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <span className="text-[13px]" style={{ color: C.muted }}>● = the #1 pick changed from the baseline. Try it live with the “What if…” bar on <Link href="/results" className="underline">your top 3</Link>.</span>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        <section className="flex flex-col gap-2 rounded-[18px] bg-white p-5" style={{ boxShadow: SH }}>
          <h2 className="m-0 text-[19px] font-bold">Calibration (H4)</h2>
          <table className="w-full border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}><th className="py-1.5 text-left font-semibold">Meter shows</th><th className="py-1.5 text-right font-semibold">Screens</th><th className="py-1.5 text-right font-semibold">Avg shown</th><th className="py-1.5 text-right font-semibold">Actually right</th></tr></thead>
            <tbody>{bins.map(b => (
              <tr key={b.lo} style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}>
                <td className="py-1.5">{Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%</td><td className="tnum py-1.5 text-right">{b.n}</td><td className="tnum py-1.5 text-right">{pct(b.meanConf)}</td><td className="tnum py-1.5 text-right">{pct(b.hitRate)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
        <section className="flex flex-col gap-2 rounded-[18px] bg-white p-5" style={{ boxShadow: SH }}>
          <h2 className="m-0 text-[19px] font-bold">Robustness</h2>
          <table className="w-full border-collapse text-[14px]">
            <thead><tr style={{ color: C.muted }}><th className="py-1.5 text-left font-semibold">Scenario</th><th className="py-1.5 text-right font-semibold">Top-3</th><th className="py-1.5 text-right font-semibold">95% CI</th></tr></thead>
            <tbody>{r.robustness.map(x => (
              <tr key={x.name} style={{ borderTop: '1px solid rgba(29,31,26,.08)' }}><td className="py-1.5 pr-2">{x.name} <span style={{ color: C.muted }}>(n={x.n})</span></td><td className="tnum py-1.5 text-right font-semibold" style={{ color: x.top3.p >= 0.95 ? C.good : x.top3.p >= 0.85 ? C.ink : C.bad }}>{pct(x.top3.p)}</td><td className="tnum py-1.5 text-right" style={{ color: C.muted }}>{ci(x.top3)}</td></tr>
            ))}</tbody>
          </table>
          <span className="text-[13px]" style={{ color: C.muted }}>Wrong answers hurt most — which is why every answer stays editable on the housing ID and X-button reasons feed back in.</span>
        </section>
      </div>

      <section className="flex flex-col gap-2 rounded-[18px] p-5" style={{ background: C.soft }}>
        <h2 className="m-0 text-[19px] font-bold">What this does and doesn’t prove</h2>
        <ul className="m-0 flex flex-col gap-1 pl-5 text-[15px]">
          <li>It proves the questions find what <b>our model</b> says is best, with ≤ 5 taps, and that the meter is honest about it.</li>
          <li>It doesn’t prove the model matches real students — the priors are invented. Next: a ~100-student UMich survey and a 15-minute hallway test with 5–8 students.</li>
          <li>Commute times use a synthetic timetable stand-in (Estimated), not TheRide’s GTFS feed yet.</li>
          <li>Plus {213} automated test cases: scenario rules, compare and bench, Bring any listing, landlord compliance, robustness, fairness and speed.</li>
        </ul>
        <span className="text-[12px]" style={{ color: C.muted }}>Generated {new Date(r.generated_at).toLocaleString('en-US')} · {r.listings} Example listings · {r.pool} particles · τ = {r.tau} · reproduce with <code>npm run simulate</code>. Full report: reports/validation.md</span>
      </section>
    </Page>
  );
}
