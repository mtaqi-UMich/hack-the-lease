# Claude Code kickoff — Hack the Lease

Paste everything below the line into Claude Code, opened in the `hack-the-lease` repo.

---

You are building **Hack the Lease**, a student-first rental marketplace for Ann Arbor (U-M students). Hackberry Lane is the launch partner. The demo is due **today, Fri Nov 20, 5:00 PM** (5-minute demo + 5-minute Q&A).

The judging rubric:

| Criterion | Weight |
| --- | --- |
| It works | 35% |
| Framing / product choices | 30% |
| Evidence / assumptions | 20% |
| UX | 15% |

The demo must show how the decision changes when inputs change. All data is synthetic and must be labelled "Example".

## Read first (source of truth)
1. `docs/PRD.md` — the full spec. **Every section is in scope:**
   - onboarding math
   - compare card computations (section 2.6)
   - bench logic
   - "Bring any listing"
   - landlord side
   - apply flow
   - Ann Arbor rules
   - testing and statistics
   - the build order
2. `design/*.dc.html` — the approved UI, one file per screen: Main, Onboarding, IdCard, Results, Compare, Map, BringListing, Apply, Landlord. Match their layout, copy, colours and flow exactly. They use the SpendLess palette and the Apple system font.
   - Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', …`
   - Background #FAF8F4, cards #FFFFFF, ink #1D1F1A, muted #666666
   - Indigo #5046F5 is the only action colour
   - Forest #224500 nav, lime #A8F06B, cyan #B7F3F7
   - Pills for everything tappable
   - Radius: 18px cards, 24px containers, 12px inputs
   - Each file is HTML plus a `class Component` with `renderVals()`. Treat them as the visual spec and port them to React components.
3. `prototype/engine.js` and `prototype/tests.js` — the working engine (13 tests pass) to port to TypeScript. Keep its behaviour.
4. `CLAUDE.md` and `context/` — follow this repo's existing workflow. Don't break the prompt-build GitHub Action.

## Stack
- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- Responsive: phone (390px) and desktop.
- Engine in `lib/engine/` as pure TypeScript, shared by client and server.
- Vitest for tests.
- Data: start with typed JSON seed files in `data/` (synthetic). Keep a Postgres/Supabase-ready schema in `lib/db/schema.ts`, but don't block on a database for the demo.
- AI route for "Bring any listing": use the Anthropic API with JSON-schema output, key in `ANTHROPIC_API_KEY`. **Never commit secrets.** Ship a cached example so the demo works offline.

## The engine — implement exactly as in PRD section 1.4 and 2.6

**Population model**
- 2,500 particles sampled from a small Bayesian network: campus → commute mode → parking need; budget → value of quality.
- Use the seeded RNG `mulberry32`.
- Value of time α: log-normal around a $25/h median.

**Update:** likelihood weighting on each answer.

**Utility:**
`−cost − α·commuteHours + 0.3·budget·quality + AC/quiet bonuses − 4·overBudget`

Hard filters: beds, parking, laundry, pets, lease start, and the student's non-negotiables.

**Next question:**
- Expected information gain: `gain(q) = H(best) − Σ P(a)·H(best|a)`.
- Skip any question below 0.03 bits.
- Skip an item whose answer is ≥95% predictable.

**Trade-off cards:** binary search on α, splitting at the posterior median.

**Stop rule:**
- Exactly 5 required screens, or stop early once P(true best in top 3) ≥ τ (default 0.95).
- Show a live confidence meter throughout.

**Predictions:**
- P(cares) ≥ 80% → an "assumed" chip.
- 20–80% → a candidate optional question.

**Commute**
- Per trip: the fastest of walk, bike or bus.
- Bus time = walk to the stop + wait from the timetable + ride + walk.
- Walk speed: 12.5 min/km × 1.3 detour.
- Precompute from TheRide GTFS into `data/commute.json`. If you can't fetch the feed, use a documented synthetic stand-in and mark it **Estimated**.

**True monthly cost**
- Rent + required fees + utilities + parking + transport + laundry.
- Each line is labelled Listed, Estimated or Unknown.
- Bus is $0 for students (MRide).

**Confidence badge:** keep the logic in the engine and API, but **do not show it on the Compare screen** (it was cut from the UI).

**"Watch out" line:** the weakest attribute among the 3 places, shown only if the gap is ≥15 min per trip or ≥$75 a month.

**Bench**
- The next 6 places by P(best).
- At most 2 units per building.
- Recompute after every X. The X reason ("too far" or "too expensive") updates α or the budget before re-ranking.

**Must-have rows:** night walk (route facts only, no crime data), Lyft Night Owl zone ($4 off, 8 PM–7 AM, in zone or not), TransLoc pickup coverage, laundry, quiet.

**Map page:** pins for the top 3; clicking a pin shows that place's features in the left panel. Use Leaflet + OpenStreetMap tiles if the network allows, otherwise the stylised map from `design/Map.dc.html`.

## API (PRD section 1.5, 2.5)
- `POST /api/onboarding/step`
- `GET /api/compare?ids=`
- `POST /api/bench/next`
- `GET /api/poi`
- `POST /api/listings/extract` ("Bring any listing": evidence sentence per field; missing fields = Unknown; never fetch URLs)
- `POST /api/prequalify`
- `POST /api/applications` (mock)
- `GET /api/landlord/leads`
- `POST /api/landlord/listing-check` (Ann Arbor compliance rules: fee ≤ $50 and refundable, required fees inside base rent, utilities disclosed, no criminal-history question, deposit ≤ 1.5× rent)

## Data
`data/listings.json`:
- ~120 synthetic Ann Arbor listings from several fictional landlords across 12 neighbourhoods.
- Hedonic pricing.
- Per-bed and per-unit leases, with every field from the PRD Listing schema (section 2.4).
- Seed: 42.

## Tests and statistics (PRD "Testing" section) — this is 20% of the grade

**Tests:**
- Port the 13 existing tests.
- Grow to ~200 Vitest cases across the PRD's suites: scenario rules, compare/bench, Bring any listing, landlord compliance, robustness, fairness, speed.

**Simulation:**
- `scripts/simulate.ts` runs 1,000 synthetic students and writes `reports/validation.md` + `reports/validation.json`:
  - **H1:** top-3 hit rate vs full information, with a Wilson 95% CI (pass ≥ 95%).
  - **H2:** optional questions raise the top-1 hit rate.
  - **H3:** adaptive vs fixed-order questions, McNemar paired test (p < 0.05).
  - **H4:** calibration — reliability table + expected calibration error ≤ 5 points.
  - Robustness: priors ±20%, 10% wrong answers.
- Add a `/evidence` page that renders this report, with a "what if" sensitivity table (e.g. budget $1,000 vs $1,800, North vs Central campus) to show how the decision changes.

## How to work
1. Start in plan mode. Read the files above, then give me a short build plan following PRD build order steps 1–10. Mark what ships by 5 PM vs what comes later.
2. Build in that order. After each step: run tests, commit with a clear message, push.
3. Keep `npm run dev`, `npm test` and `npm run simulate` working at every commit.
4. If something in the PRD conflicts with the design files, the design files win for UI and the PRD wins for logic. Note the conflict in `context/01-decisions.md`.
5. At the end:
   - Deploy to Vercel.
   - Write a 5-minute demo script in `docs/DEMO.md`: the click path, the sensitivity moment, the evidence page.
   - Put a cached fallback in place for every network call.
