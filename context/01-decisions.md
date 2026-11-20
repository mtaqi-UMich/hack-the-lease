# Decision Log

The team's agreed decisions. Newest at the top. If you change a decision, don't delete the old one — strike it through and add the new one above it, with a one-line reason.

Format: `- YYYY-MM-DD — **Decision** — why — (who)`

- 2026-11-20 — **Pitch leads with hidden fees + comparing + regret** — renter-pain Pareto (docs/RESEARCH.md): hidden fees and "comparing is 2× harder than finding" are the pains we solve fully; regret data (noise/safety) justifies the Watch-out, Quiet and Night-walk rows; maintenance is honestly roadmap. Deck + analysis: docs/PITCH.md, docs/ANALYSIS.md, /analysis — (Claude build, from team research)
- 2026-11-20 — **Live app auto-deploys from GitHub main to Vercel** (https://hack-the-lease-kappa.vercel.app); PowerShell blocks `npx`, use `npx.cmd`/`npm.cmd` on Windows — (Claude build)
- 2026-11-20 — **Stop rule: up to 5 required screens, early stop at P(true best in top 3) ≥ τ = 0.95** — KICKOFF says "exactly 5 or stop early"; PRD 1.4 says "exactly 5"; prototype default τ was 0.9. Early stop keeps clicks low and the meter is calibrated (see /evidence) — (Claude build, from KICKOFF)
- 2026-11-20 — **"Sharpen my matches" = same engine with τ 0.99 and up to 8 screens total** — reuses the information-gain picker for optional questions (PRD 1.2) — (Claude build)
- 2026-11-20 — **Design wins for UI, PRD for logic; conflicts noted here:** (1) Onboarding design has 6 fixed screens; engine picks ≤5 by information gain. (2) Compare design has no time-vs-money or roommate-risk rows; added under "Before you sign". (3) Confidence badge kept in engine/API, not rendered on Compare (cut). (4) Design trade card shows two fixed prices; we show the engine's bisection amount on the same two-card layout. (5) Added a "What if…" strip (campus + budget) to Results and Compare for the brief's live-sensitivity requirement — (Claude build)
- 2026-11-20 — **120 Example listings (seed 42), 9 fictional landlords incl. Hackberry Lane** — supersedes "~30 listings" below; PRD/KICKOFF ask for ~120 — (Claude build)
- 2026-11-20 — **Commute uses a documented synthetic timetable stand-in labelled "Estimated"** — TheRide GTFS not fetched in the build window; walk 12.5 min/km × 1.3 detour; bus = walk to stop + headway/2 + ride + walk; MRide bus $0 — (Claude build)
- 2026-11-20 — **"Too far" / "Too expensive" constrain the replacement** — too far ⇒ value of time ≥ 1.5× current estimate and replacement must be closer; too expensive ⇒ budget lowered and replacement must be cheaper; if nothing qualifies we say so and show the next best — (Claude build)
- 2026-11-20 — **Bring any listing: Claude (claude-opus-5-5, low effort) with JSON-schema output when ANTHROPIC_API_KEY is set, rule-based reader otherwise; every value must quote a sentence found in the paste or it is dropped; pre-read Example cached for the demo** — (Claude build)

- 2026-11-19 — **Working direction: "This or That" trade-off engine + adaptive onboarding (≈5 screens, confidence meter)** — learns real preference weights from trade-off cards instead of sliders; gives a clean live sensitivity demo — (Taqi, not yet confirmed by partner)
- 2026-11-19 — **Use ~30 synthetic Ann Arbor listings (Haven on Geddes included), labeled synthetic** — brief requires labeling — (Taqi)
